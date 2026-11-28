import { ArrowRight01Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { cn, useThemeColor } from "heroui-native"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { haptics } from "@/lib/haptics"
import type { RatingFeel } from "@/lib/haptics"

import {
  OnboardingTopBar,
  PrimaryButton,
  StepHeading
} from "../onboarding-chrome"

const FLIP_MS = 520
const FLIP_EASING = Easing.bezier(0.2, 0.8, 0.2, 1)
/** Interval stops on the timeline; each rating lands on one of them. */
const STOP_KEYS = [
  "tenMinutes",
  "tomorrow",
  "threeDays",
  "oneWeek",
  "oneMonth"
] as const
const STOP_OF: Record<RatingFeel, number> = { again: 0, hard: 1, good: 2 }

const cardShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.1,
  shadowRadius: 17,
  shadowOffset: { width: 0, height: 14 }
} as const

function TimelineStop({ label, isHit }: { label: string; isHit: boolean }) {
  const size = useSharedValue(8)
  useEffect(() => {
    size.value = withTiming(isHit ? 14 : 8, { duration: 240 })
  }, [isHit, size])
  const dotStyle = useAnimatedStyle(() => ({
    width: size.value,
    height: size.value,
    marginTop: (14 - size.value) / 2
  }))
  return (
    <View className="flex-1 items-center gap-1.5">
      <Animated.View
        className={cn("rounded-full", isHit ? "bg-accent" : "bg-divider")}
        style={dotStyle}
      />
      <Text
        className={cn(
          "text-[11px]",
          isHit ? "font-semibold text-foreground" : "text-muted"
        )}
      >
        {label}
      </Text>
    </View>
  )
}

export function FlipStep({
  onBack,
  onSkip,
  onNext
}: {
  onBack: () => void
  onSkip?: () => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const accentForeground = useThemeColor("accent-foreground")
  const [flipped, setFlipped] = useState(false)
  const [rating, setRating] = useState<RatingFeel | null>(null)
  // Ratings appear once the card has landed, so a tap never hits mid-flip.
  const [canRate, setCanRate] = useState(false)
  const turn = useSharedValue(0)

  const flip = () => {
    if (flipped) return
    setFlipped(true)
    if (reduceMotion) {
      turn.value = 1
      haptics.flip()
      setCanRate(true)
      return
    }
    setTimeout(() => setCanRate(true), FLIP_MS)
    turn.value = withTiming(1, { duration: FLIP_MS, easing: FLIP_EASING })
    // The card is edge-on at about 40% of the eased curve.
    setTimeout(haptics.flip, FLIP_MS * 0.3)
  }

  const rate = (value: RatingFeel) => {
    haptics.rate(value)
    setRating(value)
  }

  const frontStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - turn.value }
      : {
          transform: [
            { perspective: 1200 },
            { scale: interpolate(turn.value, [0, 0.5, 1], [1, 0.88, 1]) },
            { rotateY: `${interpolate(turn.value, [0, 1], [0, 180])}deg` }
          ]
        }
  )
  const backStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: turn.value }
      : {
          transform: [
            { perspective: 1200 },
            { scale: interpolate(turn.value, [0, 0.5, 1], [1, 0.88, 1]) },
            { rotateY: `${interpolate(turn.value, [0, 1], [180, 360])}deg` }
          ]
        }
  )

  const hit = rating ? STOP_OF[rating] : -1

  return (
    <View className="flex-1 bg-background">
      <OnboardingTopBar onBack={onBack} onSkip={onSkip} progress={2} />
      <View className="flex-1 px-6" style={{ paddingTop: insets.top + 72 }}>
        <View style={{ zIndex: 2 }}>
          <StepHeading
            subtitle={t("onboarding.flow.flip.body")}
            title={t("onboarding.flow.flip.title")}
          />
        </View>

        <View className="mt-7 h-[286px]" style={{ zIndex: 1 }}>
          <Animated.View
            className="absolute inset-0"
            style={[{ backfaceVisibility: "hidden" }, frontStyle]}
          >
            <Pressable
              accessibilityHint={t("onboarding.flow.flip.tapToFlip")}
              accessibilityLabel={t("onboarding.flow.flip.flipAria")}
              accessibilityRole="button"
              className="flex-1 items-center justify-center gap-4 rounded-3xl bg-surface"
              onPress={flip}
              style={cardShadow}
            >
              <Text className="text-[58px] leading-[64px] font-bold text-foreground">
                木漏れ日
              </Text>
              <Text className="text-[13px] text-muted">
                {t("onboarding.flow.flip.tapToFlip")}
              </Text>
            </Pressable>
          </Animated.View>

          <Animated.View
            className="absolute inset-0 gap-2 rounded-3xl bg-surface p-6"
            pointerEvents={flipped ? "auto" : "none"}
            style={[cardShadow, { backfaceVisibility: "hidden" }, backStyle]}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[15px] text-muted">こもれび</Text>
              <View className="rounded-full bg-default px-2.5 py-[3px]">
                <Text className="text-xs text-muted">
                  {t("onboarding.flow.flip.noun")}
                </Text>
              </View>
            </View>
            <Text className="text-[34px] leading-[40px] font-bold text-foreground">
              木漏れ日
            </Text>
            <Text className="text-[19px] font-semibold text-foreground">
              {t("onboarding.flow.demoMeaning")}
            </Text>
            <View className="bg-divider my-2 h-px" />
            <Text className="text-[17px] leading-[26px] text-foreground">
              木漏れ日の中を歩く。
            </Text>
            <Text className="text-sm text-muted">
              {t("onboarding.flow.flip.exampleMeaning")}
            </Text>
          </Animated.View>
        </View>

        {canRate && !rating ? (
          <Animated.View
            className="mt-6 flex-row gap-2"
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(160)}
          >
            <RateButton
              className="bg-again-soft"
              label={t("onboarding.flow.flip.again")}
              labelClassName="text-again-soft-foreground"
              onPress={() => rate("again")}
            />
            <RateButton
              className="bg-default"
              label={t("onboarding.flow.flip.hard")}
              labelClassName="text-foreground"
              onPress={() => rate("hard")}
            />
            <RateButton
              className="bg-good-soft"
              label={t("onboarding.flow.flip.good")}
              labelClassName="text-good-soft-foreground"
              onPress={() => rate("good")}
            />
          </Animated.View>
        ) : null}

        {rating ? (
          <Animated.View
            className="mt-6 gap-3.5 rounded-[20px] bg-surface px-[18px] pt-4 pb-3.5"
            entering={FadeIn.delay(120)}
          >
            <Text className="text-[15px] text-foreground">
              <Text className="text-muted">
                {t("onboarding.flow.flip.nextLabel")}
              </Text>
              <Text className="font-semibold">
                {t(`onboarding.flow.flip.next.${rating}`)}
              </Text>
            </Text>
            <View className="flex-row">
              {STOP_KEYS.map((key, index) => (
                <TimelineStop
                  isHit={index === hit}
                  key={key}
                  label={t(`onboarding.flow.flip.stops.${key}`)}
                />
              ))}
            </View>
          </Animated.View>
        ) : null}
      </View>

      {rating ? (
        <Animated.View
          className="px-6"
          entering={FadeIn.delay(200)}
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <PrimaryButton
            label={t("onboarding.flow.flip.continue")}
            onPress={onNext}
            trailing={
              <HugeiconsIcon
                color={accentForeground}
                icon={ArrowRight01Icon}
                size={18}
              />
            }
          />
        </Animated.View>
      ) : null}
    </View>
  )
}

function RateButton({
  label,
  className,
  labelClassName,
  onPress
}: {
  label: string
  className: string
  labelClassName: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className={cn(
        "h-[58px] flex-1 items-center justify-center rounded-[18px] active:opacity-70",
        className
      )}
      onPress={onPress}
    >
      <Text className={cn("text-base font-semibold", labelClassName)}>
        {label}
      </Text>
    </Pressable>
  )
}
