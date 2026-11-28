import { StorageKey } from "@folionote/constants"
import * as SecureStore from "expo-secure-store"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { View } from "react-native"
import Animated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
  useReducedMotion
} from "react-native-reanimated"

import { useLocalMode } from "@/contexts/local-mode-context"
import { DEFAULT_REMINDER_TIME, scheduleDailyReminder } from "@/lib/daily-reminder"
import { DEFAULT_DAILY_NEW_WORDS, saveOnboardingDraft } from "@/lib/onboarding-draft"
import type { OnboardingOutcome, OnboardingPlan } from "@/lib/onboarding-draft"
import { DEFAULT_STAMP_GLYPH, useSaveStampGlyph, useStampGlyph } from "@/lib/stamp-glyph"
import type { StampGlyph } from "@/lib/stamp-glyph"

import { CaptureStep } from "./steps/capture-step"
import { CoverStep } from "./steps/cover-step"
import { FlipStep } from "./steps/flip-step"
import { ListenStep } from "./steps/listen-step"
import { PlanStep } from "./steps/plan-step"
import { SignUpStep } from "./steps/sign-up-step"
import { StampStep } from "./steps/stamp-step"

type Step = "cover" | "capture" | "flip" | "listen" | "plan" | "stamp" | "signUp"

const DEFAULT_PLAN: OnboardingPlan = {
  useNotes: true,
  useJapanese: true,
  level: "N5",
  dailyNewWords: DEFAULT_DAILY_NEW_WORDS,
  remind: true
}

/**
 * First-run onboarding: try the app first (write a note, flip a card, hear a
 * line, set a pace, stamp day one), sign up last.
 *
 * `first-run` really saves what was done once the reader signs up, signs in
 * or picks local mode. `replay` (Settings › 再看一遍引导) is a walk-through:
 * nothing is written, and it ends after the stamp.
 */
export function OnboardingFlow({
  mode,
  onSignIn,
  onClose
}: {
  mode: "first-run" | "replay"
  /** First run: go to the sign-in screen. */
  onSignIn?: () => void
  /** Replay: leave the walk-through. */
  onClose?: () => void
}) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const { enableLocalMode } = useLocalMode()
  const savedGlyph = useStampGlyph()
  const saveGlyph = useSaveStampGlyph()
  const [step, setStep] = useState<Step>("cover")
  const [direction, setDirection] = useState<1 | -1>(1)
  // Pages visited, so back returns where the reader came from (after skip too).
  const [history, setHistory] = useState<Step[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [wordSaved, setWordSaved] = useState(false)
  const [plan, setPlan] = useState<OnboardingPlan | null>(null)
  const [glyph, setGlyph] = useState<StampGlyph | null>(null)
  const isReplay = mode === "replay"
  const stampGlyph = glyph ?? savedGlyph ?? DEFAULT_STAMP_GLYPH

  const go = (next: Step) => {
    setDirection(1)
    setHistory((visited) => [...visited, step])
    setStep(next)
  }
  const back = () => {
    const previous = history[history.length - 1]
    if (!previous) return
    setDirection(-1)
    setHistory((visited) => visited.slice(0, -1))
    setStep(previous)
  }
  const skip = () => {
    if (isReplay) {
      onClose?.()
      return
    }
    go("signUp")
  }

  const markSeen = () =>
    SecureStore.setItemAsync(StorageKey.HAS_SEEN_ONBOARDING, "true")

  const persist = async (outcome: OnboardingOutcome) => {
    await saveOnboardingDraft({
      note,
      wordSaved,
      plan,
      outcome,
      applied: { note: false, word: false, plan: false }
    })
    await markSeen()
  }

  const finish = async (outcome: OnboardingOutcome) => {
    await persist(outcome)
    if (outcome === "local") await enableLocalMode()
  }

  const goSignIn = async () => {
    // If they sign in from here, the note and the word still get saved.
    if (note || wordSaved) {
      await persist("sign-in")
    } else {
      await markSeen()
    }
    onSignIn?.()
  }

  const finishPlan = async (chosen: OnboardingPlan) => {
    let final = chosen
    if (chosen.remind && !isReplay) {
      const granted = await scheduleDailyReminder(DEFAULT_REMINDER_TIME, {
        title: t("reminder.title"),
        body: t("reminder.body")
      }).catch(() => false)
      if (!granted) final = { ...chosen, remind: false }
    }
    setPlan(final)
    go("stamp")
  }

  const changeGlyph = (next: StampGlyph) => {
    setGlyph(next)
    saveGlyph(next).catch(() => {
      // Only a device preference; the stamp still shows the pick.
    })
  }

  const entering = (() => {
    if (reduceMotion) return FadeIn.duration(220)
    return (direction === 1 ? SlideInRight : SlideInLeft).springify().damping(22)
  })()
  const skipAction = isReplay ? onClose : skip

  const renderStep = () => {
    switch (step) {
      case "cover":
        return (
          <CoverStep
            onClose={isReplay ? onClose : undefined}
            onHaveAccount={isReplay ? undefined : goSignIn}
            onStart={() => go("capture")}
          />
        )
      case "capture":
        return (
          <CaptureStep
            initialNote={note}
            onBack={back}
            onCaptured={setNote}
            onNext={() => go("flip")}
            onSkip={skipAction}
          />
        )
      case "flip":
        return <FlipStep onBack={back} onNext={() => go("listen")} onSkip={skipAction} />
      case "listen":
        return (
          <ListenStep
            initialSaved={wordSaved}
            onBack={back}
            onNext={() => go("plan")}
            onSaved={() => setWordSaved(true)}
            onSkip={skipAction}
          />
        )
      case "plan":
        return (
          <PlanStep
            initialPlan={plan ?? DEFAULT_PLAN}
            onBack={back}
            onDone={finishPlan}
            onSkip={skipAction}
          />
        )
      case "stamp":
        return (
          <StampStep
            glyph={stampGlyph}
            nextLabel={isReplay ? t("common.done") : t("onboarding.flow.stamp.next")}
            onBack={back}
            onGlyphChange={changeGlyph}
            onNext={() => (isReplay ? onClose?.() : go("signUp"))}
          />
        )
      case "signUp":
        return (
          <SignUpStep
            glyph={stampGlyph}
            note={note}
            onBack={back}
            onFinish={finish}
            onSignIn={goSignIn}
            plan={plan}
            wordSaved={wordSaved}
          />
        )
      default:
        return null
    }
  }

  return (
    <View className="flex-1 bg-background">
      <Animated.View
        className="flex-1"
        entering={entering}
        key={step}
      >
        {renderStep()}
      </Animated.View>
    </View>
  )
}
