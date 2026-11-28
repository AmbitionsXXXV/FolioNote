import {
  ArrowRight01Icon,
  BookmarkAdd01Icon,
  CheckmarkCircle02Icon,
  RepeatIcon,
  SparklesIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import * as Speech from "expo-speech"
import { cn, useThemeColor } from "heroui-native"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"
import Animated, {
  Easing,
  FadeIn,
  SlideInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useCSSVariable } from "uniwind"

import { haptics } from "@/lib/haptics"
import { speakJapanese } from "@/lib/japanese-speech"
import { DEMO_WORD } from "@/lib/onboarding-draft"

import {
  Glass,
  OnboardingTopBar,
  PrimaryButton,
  StepHeading
} from "../onboarding-chrome"

/** The spoken line, cut into the pieces that light up as they are read. */
const CHUNKS = ["木漏れ日", "が", "とても", "きれい", "でした", "。"] as const
const CHUNK_STARTS: number[] = []
let chunkOffset = 0
for (const chunk of CHUNKS) {
  CHUNK_STARTS.push(chunkOffset)
  chunkOffset += chunk.length
}
const chunkAt = (charIndex: number) => {
  let found = 0
  for (const [index, start] of CHUNK_STARTS.entries()) {
    if (charIndex >= start) found = index
  }
  return found
}

/** Bar heights from the canvas waveform (13 played, 17 still ahead). */
const BARS = [
  42, 10, 42, 26, 14, 10, 26, 10, 26, 34, 34, 14, 42, 10, 30, 18, 20, 34, 18,
  14, 42, 10, 42, 18, 14, 14, 18, 42, 20, 26
] as const
const PLAYED_BARS = 13
const WAVEFORM = BARS.map((height, position) => ({
  id: `bar-${position.toString()}`,
  height,
  position
}))

function WaveBar({
  height,
  index,
  playing,
  played
}: {
  height: number
  index: number
  playing: boolean
  played: boolean
}) {
  const scale = useSharedValue(1)
  useEffect(() => {
    if (!playing) {
      scale.value = withTiming(1, { duration: 200 })
      return
    }
    const period = 900 + ((index * 137) % 700)
    scale.value = withDelay(
      (index * 53) % 400,
      withRepeat(
        withSequence(
          withTiming(0.45, { duration: period / 2, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    )
  }, [index, playing, scale])
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }))
  return (
    <Animated.View
      className={cn("w-1 rounded-full", played ? "bg-warning" : "bg-stage-foreground/30")}
      style={[{ height }, style]}
    />
  )
}

export function ListenStep({
  initialSaved,
  onBack,
  onSkip,
  onSaved,
  onNext
}: {
  initialSaved: boolean
  onBack: () => void
  onSkip?: () => void
  onSaved: () => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const accentForeground = useThemeColor("accent-foreground")
  const accent = useThemeColor("accent")
  const softForeground = String(
    useCSSVariable("--color-accent-soft-foreground") ?? accent
  )
  const goodForeground = String(
    useCSSVariable("--color-good-soft-foreground") ?? accent
  )
  const stageForeground = String(
    useCSSVariable("--color-stage-foreground") ?? accentForeground
  )
  const [playing, setPlaying] = useState(false)
  const [spoken, setSpoken] = useState<number | null>(null)
  const [open, setOpen] = useState(initialSaved)
  const [saved, setSaved] = useState(initialSaved)

  const play = useCallback(() => {
    setPlaying(true)
    setSpoken(0)
    speakJapanese(DEMO_WORD.sentence, 0.9, (charIndex) =>
      setSpoken(chunkAt(charIndex))
    )
      .catch(() => {
        // No Japanese voice: the line is still on screen to read.
      })
      .finally(() => {
        setPlaying(false)
        setSpoken(null)
      })
  }, [])

  // Read the line once on arrival; stop talking when the page goes away.
  useEffect(() => {
    const timer = setTimeout(play, 450)
    return () => {
      clearTimeout(timer)
      Speech.stop()
    }
  }, [play])

  const pick = () => {
    haptics.tap()
    setOpen(true)
  }

  const save = () => {
    haptics.drop()
    setSaved(true)
    onSaved()
  }

  return (
    <View className="flex-1 bg-background">
      <OnboardingTopBar onBack={onBack} onSkip={onSkip} progress={3} />
      <View className="flex-1 px-6" style={{ paddingTop: insets.top + 72 }}>
        <StepHeading
          subtitle={t("onboarding.flow.listen.body")}
          title={t("onboarding.flow.listen.title")}
        />

        <View className="mt-7 h-[132px] justify-between rounded-[20px] bg-stage px-[18px] py-4">
          <View
            accessibilityElementsHidden
            className="h-14 flex-row items-center justify-between"
            importantForAccessibility="no-hide-descendants"
          >
            {WAVEFORM.map((bar) => (
              <WaveBar
                height={bar.height}
                index={bar.position}
                key={bar.id}
                played={bar.position < PLAYED_BARS}
                playing={playing && !reduceMotion}
              />
            ))}
          </View>
          <View className="flex-row items-center gap-2.5">
            <Pressable
              accessibilityLabel={t("onboarding.flow.listen.replay")}
              accessibilityRole="button"
              className="size-9 items-center justify-center rounded-full bg-stage-foreground/15 active:opacity-70"
              hitSlop={4}
              onPress={() => {
                haptics.tap()
                play()
              }}
            >
              <HugeiconsIcon color={stageForeground} icon={RepeatIcon} size={16} />
            </Pressable>
            <Text className="text-[13px] text-stage-muted" style={{ fontVariant: ["tabular-nums"] }}>
              0:42 / 3:15
            </Text>
            <Text className="ml-auto text-xs text-stage-muted">
              {t("onboarding.flow.listen.source")}
            </Text>
          </View>
        </View>

        <View className="mt-6 gap-3">
          <Text className="text-[15px] text-muted/70">今日は公園を散歩しました。</Text>
          <View className="flex-row flex-wrap items-baseline">
            <Pressable
              accessibilityLabel={t("onboarding.flow.listen.wordAria", {
                word: DEMO_WORD.headword
              })}
              accessibilityRole="button"
              className={cn(
                "-ml-1.5 mr-0.5 rounded-[10px] bg-accent-soft px-1.5 py-0.5",
                open && "border-2 border-accent"
              )}
              onPress={pick}
            >
              <Text
                className={cn(
                  "text-2xl font-bold leading-9",
                  spoken === 0 ? "text-accent" : "text-accent-soft-foreground"
                )}
              >
                {CHUNKS[0]}
              </Text>
            </Pressable>
            {CHUNKS.slice(1).map((chunk, offset) => (
              <Text
                className={cn(
                  "text-2xl font-bold leading-9",
                  spoken === offset + 1 ? "text-accent" : "text-foreground"
                )}
                key={chunk}
              >
                {chunk}
              </Text>
            ))}
          </View>
          <Text className="-mt-1.5 text-sm text-muted">
            {t("onboarding.flow.listen.translation")}
          </Text>
          <Text className="text-[15px] text-muted/70">また来たいと思います。</Text>
        </View>

        {open ? null : (
          <Animated.View className="mt-8 flex-row" entering={FadeIn.delay(900)}>
            <View className="flex-row items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-2">
              <HugeiconsIcon color={softForeground} icon={SparklesIcon} size={15} />
              <Text className="text-sm font-medium text-accent-soft-foreground">
                {t("onboarding.flow.listen.hint")}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>

      {open ? (
        <Animated.View
          accessibilityLabel={DEMO_WORD.headword}
          accessibilityViewIsModal
          className="absolute inset-x-2"
          entering={reduceMotion ? FadeIn : SlideInDown.springify().damping(18)}
          style={{ bottom: Math.max(insets.bottom - 26, 8) }}
        >
          <Glass
            className="rounded-[34px]"
            style={{
              borderRadius: 34,
              paddingTop: 10,
              paddingHorizontal: 20,
              paddingBottom: 26,
              gap: 12
            }}
          >
            <View className="h-[5px] w-9 self-center rounded-full bg-muted/40" />
            <View className="mt-1 flex-row items-baseline gap-2.5">
              <Text className="text-[28px] font-bold text-foreground">
                {DEMO_WORD.headword}
              </Text>
              <Text className="text-[15px] text-muted">{DEMO_WORD.reading}</Text>
              <View className="ml-auto rounded-full bg-default px-2.5 py-[3px]">
                <Text className="text-xs text-muted">{t("onboarding.flow.flip.noun")}</Text>
              </View>
            </View>
            <Text className="text-[17px] text-foreground">
              {t("onboarding.flow.demoMeaning")}
            </Text>
            <Text className="text-[13px] leading-5 text-muted">
              {t("onboarding.flow.listen.keeps")}
            </Text>
            {saved ? (
              <View className="gap-2.5">
                <Animated.View
                  className="h-11 flex-row items-center justify-center gap-1.5 rounded-full bg-good-soft"
                  entering={ZoomIn.springify()}
                >
                  <HugeiconsIcon color={goodForeground} icon={CheckmarkCircle02Icon} size={17} />
                  <Text className="text-[15px] font-semibold text-good-soft-foreground">
                    {t("onboarding.flow.listen.saved")}
                  </Text>
                </Animated.View>
                <PrimaryButton
                  label={t("onboarding.flow.listen.next")}
                  onPress={onNext}
                  trailing={
                    <HugeiconsIcon color={accentForeground} icon={ArrowRight01Icon} size={18} />
                  }
                />
              </View>
            ) : (
              <PrimaryButton
                label={t("onboarding.flow.listen.save")}
                onPress={save}
                trailing={
                  <HugeiconsIcon color={accentForeground} icon={BookmarkAdd01Icon} size={18} />
                }
              />
            )}
          </Glass>
        </Animated.View>
      ) : null}
    </View>
  )
}
