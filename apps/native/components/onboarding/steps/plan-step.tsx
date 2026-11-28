import {
  ArrowRight01Icon,
  Notification01Icon,
  Tick02Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { cn, useThemeColor } from "heroui-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View
} from "react-native"
import { KeyboardStickyView } from "react-native-keyboard-controller"
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useCSSVariable } from "uniwind"

import { haptics } from "@/lib/haptics"
import {
  DAILY_NEW_WORDS_MAX,
  DAILY_NEW_WORDS_MIN,
  JAPANESE_LEVELS
} from "@/lib/onboarding-draft"
import type { JapaneseLevel, OnboardingPlan } from "@/lib/onboarding-draft"

import {
  OnboardingTopBar,
  PrimaryButton,
  StepHeading
} from "../onboarding-chrome"
import { RulerWheel } from "../ruler-wheel"

const NON_DIGITS = /[^0-9]/g
const clampCount = (count: number) =>
  Math.max(DAILY_NEW_WORDS_MIN, Math.min(DAILY_NEW_WORDS_MAX, count))
/** Roughly two new words a minute, never less than a minute. */
const minutesFor = (count: number) => Math.max(1, Math.round(count / 2))

function UseCard({
  title,
  subtitle,
  isOn,
  onToggle
}: {
  title: string
  subtitle: string
  isOn: boolean
  onToggle: () => void
}) {
  const accentForeground = useThemeColor("accent-foreground")
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isOn }}
      className={cn(
        "flex-1 gap-1 rounded-[18px] bg-surface p-3.5 active:opacity-80",
        isOn ? "border-[1.5px] border-accent" : "border border-divider"
      )}
      onPress={onToggle}
    >
      <View className="flex-row items-start justify-between">
        <Text className="text-base font-semibold text-foreground">{title}</Text>
        <View
          className={cn(
            "size-[22px] items-center justify-center rounded-full",
            isOn ? "bg-accent" : "border-[1.5px] border-muted/60"
          )}
        >
          {isOn ? (
            <HugeiconsIcon
              color={accentForeground}
              icon={Tick02Icon}
              size={14}
            />
          ) : null}
        </View>
      </View>
      <Text className="text-[13px] text-muted">{subtitle}</Text>
    </Pressable>
  )
}

export function PlanStep({
  initialPlan,
  onBack,
  onSkip,
  onDone
}: {
  initialPlan: OnboardingPlan
  onBack: () => void
  onSkip?: () => void
  onDone: (plan: OnboardingPlan) => void
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const accent = useThemeColor("accent")
  const accentForeground = useThemeColor("accent-foreground")
  const divider = String(useCSSVariable("--color-hairline") ?? "gray")
  const [plan, setPlan] = useState(initialPlan)
  const [typed, setTyped] = useState<string | null>(null)

  const change = (patch: Partial<OnboardingPlan>) =>
    setPlan((current) => ({ ...current, ...patch }))

  const toggle = (key: "useNotes" | "useJapanese" | "remind") => {
    haptics.tap()
    change({ [key]: !plan[key] })
  }

  const typeCount = (text: string) => {
    const digits = text.replace(NON_DIGITS, "").slice(0, 2)
    setTyped(digits)
    const parsed = Number.parseInt(digits, 10)
    if (!Number.isNaN(parsed)) change({ dailyNewWords: clampCount(parsed) })
  }

  return (
    <View className="flex-1 bg-background">
      <OnboardingTopBar onBack={onBack} onSkip={onSkip} progress={4} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 72,
          paddingHorizontal: 24,
          paddingBottom: 24
        }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <StepHeading
          subtitle={t("onboarding.flow.plan.body")}
          title={t("onboarding.flow.plan.title")}
        />

        <Text className="mt-6 mb-2 px-1 text-[13px] font-semibold text-muted">
          {t("onboarding.flow.plan.usesLabel")}
        </Text>
        <View className="flex-row gap-2.5">
          <UseCard
            isOn={plan.useNotes}
            onToggle={() => toggle("useNotes")}
            subtitle={t("onboarding.flow.plan.notesSub")}
            title={t("onboarding.flow.plan.notes")}
          />
          <UseCard
            isOn={plan.useJapanese}
            onToggle={() => toggle("useJapanese")}
            subtitle={t("onboarding.flow.plan.japaneseSub")}
            title={t("onboarding.flow.plan.japanese")}
          />
        </View>

        {plan.useJapanese ? (
          <Animated.View
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(160)}
            layout={LinearTransition}
          >
            <Text className="mt-5 mb-2 px-1 text-[13px] font-semibold text-muted">
              {t("onboarding.flow.plan.levelLabel")}
            </Text>
            <View
              accessibilityLabel={t("onboarding.flow.plan.levelLabel")}
              accessibilityRole="radiogroup"
              className="flex-row gap-1.5"
            >
              {JAPANESE_LEVELS.map((level: JapaneseLevel) => {
                const selected = plan.level === level
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    className={cn(
                      "h-10 flex-1 items-center justify-center rounded-xl",
                      selected ? "bg-accent-soft" : "bg-surface"
                    )}
                    key={level}
                    onPress={() => {
                      haptics.tap()
                      change({ level })
                    }}
                  >
                    <Text
                      className={cn(
                        "text-[14px] font-semibold",
                        selected
                          ? "text-accent-soft-foreground"
                          : "text-foreground"
                      )}
                    >
                      {level === "beginner"
                        ? t("onboarding.flow.plan.beginner")
                        : level}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <View className="mt-3 gap-1 rounded-[20px] bg-surface px-4 pt-3.5 pb-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-foreground">
                  {t("onboarding.flow.plan.newWords")}
                </Text>
                <Text className="text-[13px] text-muted">
                  {t("onboarding.flow.plan.minutes", {
                    count: minutesFor(plan.dailyNewWords)
                  })}
                </Text>
              </View>
              <View className="flex-row items-baseline justify-center gap-1">
                <TextInput
                  accessibilityHint={t("onboarding.flow.plan.countHint", {
                    min: DAILY_NEW_WORDS_MIN,
                    max: DAILY_NEW_WORDS_MAX
                  })}
                  accessibilityLabel={t("onboarding.flow.plan.newWords")}
                  className="min-w-[72px] text-center text-[44px] font-bold text-foreground"
                  keyboardType="number-pad"
                  maxLength={2}
                  onBlur={() => setTyped(null)}
                  onChangeText={typeCount}
                  returnKeyType="done"
                  selectTextOnFocus
                  style={{ fontVariant: ["tabular-nums"] }}
                  value={typed ?? String(plan.dailyNewWords)}
                />
                <Text className="text-base text-muted">
                  {t("onboarding.flow.plan.unit")}
                </Text>
              </View>
              <RulerWheel
                accessibilityLabel={t("onboarding.flow.plan.newWords")}
                max={DAILY_NEW_WORDS_MAX}
                min={DAILY_NEW_WORDS_MIN}
                onChange={(dailyNewWords) => {
                  setTyped(null)
                  change({ dailyNewWords })
                }}
                value={plan.dailyNewWords}
              />
            </View>
          </Animated.View>
        ) : null}

        <Animated.View
          className="mt-5 flex-row items-center gap-3 rounded-[20px] bg-surface px-4 py-3"
          layout={LinearTransition}
        >
          <View className="size-[30px] items-center justify-center rounded-[9px] bg-accent/15">
            <HugeiconsIcon color={accent} icon={Notification01Icon} size={17} />
          </View>
          <View className="flex-1">
            <Text className="text-base text-foreground">
              {t("onboarding.flow.plan.remind")}
            </Text>
            <Text className="text-xs text-muted">
              {t("onboarding.flow.plan.remindSub")}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t("onboarding.flow.plan.remind")}
            ios_backgroundColor={divider}
            onValueChange={() => toggle("remind")}
            trackColor={{ false: divider, true: accent }}
            value={plan.remind}
          />
        </Animated.View>
      </ScrollView>

      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <View
          className="px-6 pt-2"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <PrimaryButton
            isDisabled={!(plan.useNotes || plan.useJapanese)}
            label={t("onboarding.flow.plan.done")}
            onPress={() => onDone(plan)}
            trailing={
              <HugeiconsIcon
                color={accentForeground}
                icon={ArrowRight01Icon}
                size={18}
              />
            }
          />
        </View>
      </KeyboardStickyView>
    </View>
  )
}
