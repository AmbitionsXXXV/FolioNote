import { formatDate } from "@folionote/locales"
import { ArrowRight01Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { cn, useThemeColor } from "heroui-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"
import Animated, {
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  ZoomIn
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { haptics } from "@/lib/haptics"
import { STAMP_GLYPHS } from "@/lib/stamp-glyph"
import type { StampGlyph } from "@/lib/stamp-glyph"

import { HoldToStamp } from "../hold-to-stamp"
import {
  OnboardingTopBar,
  PrimaryButton,
  StepHeading
} from "../onboarding-chrome"
import { PaperSeal } from "../paper-seal"

const SEAL_SIZE = 168
const DAYS_IN_WEEK = 7
const SEAL_SPRING = { damping: 9, stiffness: 170, mass: 0.8 } as const

/** Monday-first week around today, as dates. */
const weekAround = (today: Date): Date[] => {
  const mondayOffset = (today.getDay() + 6) % DAYS_IN_WEEK
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const day = new Date(today)
    day.setDate(today.getDate() - mondayOffset + index)
    return day
  })
}

export function StampStep({
  glyph,
  onGlyphChange,
  onBack,
  onNext,
  nextLabel
}: {
  glyph: StampGlyph
  onGlyphChange: (glyph: StampGlyph) => void
  onBack: () => void
  onNext: () => void
  nextLabel: string
}) {
  const { t, i18n } = useTranslation()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const accentForeground = useThemeColor("accent-foreground")
  const [done, setDone] = useState(false)
  const hold = useSharedValue(0)
  const landed = useSharedValue(0)
  const ripple = useSharedValue(0)
  const today = new Date()
  const week = weekAround(today)
  const caption = t("onboarding.flow.stamp.dayOne")

  const stampDown = () => {
    setDone(true)
    if (reduceMotion) {
      landed.value = withTiming(1, { duration: 200 })
      return
    }
    landed.value = withSpring(1, SEAL_SPRING)
    ripple.value = withDelay(260, withTiming(1, { duration: 760 }))
  }

  const sealStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: 0.22 + 0.78 * landed.value }
    }
    // Hovering: big, tilted, lifted and faint; sinks while the ring fills.
    const hover = {
      scale: interpolate(hold.value, [0, 1], [1.32, 1.18]),
      lift: interpolate(hold.value, [0, 1], [-14, -4]),
      rotate: 4,
      opacity: interpolate(hold.value, [0, 1], [0.22, 0.45])
    }
    const scale = interpolate(landed.value, [0, 1], [hover.scale, 1])
    return {
      opacity: interpolate(landed.value, [0, 0.3, 1], [hover.opacity, 1, 1]),
      transform: [
        { translateY: interpolate(landed.value, [0, 1], [hover.lift, 0]) },
        { scale },
        { rotate: `${interpolate(landed.value, [0, 1], [hover.rotate, -8])}deg` }
      ]
    }
  })
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: ripple.value === 0 ? 0 : 0.5 * (1 - ripple.value),
    transform: [{ scale: 1 + 0.55 * ripple.value }]
  }))
  const slotStyle = useAnimatedStyle(() => ({ opacity: 0.7 * (1 - landed.value) }))

  return (
    <View className="flex-1 bg-background">
      <OnboardingTopBar onBack={onBack} progress={5} />
      <View className="flex-1 px-6" style={{ paddingTop: insets.top + 72 }}>
        <View className="items-center">
          <StepHeading
            subtitle={
              done ? t("onboarding.flow.stamp.doneBody") : t("onboarding.flow.stamp.body")
            }
            title={
              done ? t("onboarding.flow.stamp.doneTitle") : t("onboarding.flow.stamp.title")
            }
          />
        </View>

        <View
          className="mx-4 mt-6 h-[318px] items-center justify-between rounded-[22px] bg-surface px-[18px] pt-[18px] pb-4"
          style={{
            transform: [{ rotate: "-2deg" }],
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 17,
            shadowOffset: { width: 0, height: 14 }
          }}
        >
          <View className="flex-row items-baseline justify-between self-stretch">
            <Text className="text-[15px] font-semibold text-foreground">
              {formatDate(today, {
                locale: i18n.language,
                options: { month: "long", day: "numeric" }
              })}
            </Text>
            <Text className="text-[13px] text-muted">
              {formatDate(today, {
                locale: i18n.language,
                options: { weekday: "short" }
              })}
              {" · "}
              {t("onboarding.flow.stamp.pageOne")}
            </Text>
          </View>

          <View style={{ width: SEAL_SIZE, height: SEAL_SIZE }}>
            <Animated.View
              className="absolute inset-0 rounded-full border-[1.5px] border-dashed border-muted/60"
              style={slotStyle}
            />
            <Animated.View
              className="absolute inset-0 rounded-full border-[3px] border-stamp"
              style={rippleStyle}
            />
            <Animated.View
              accessibilityLabel={t("onboarding.flow.stamp.sealAria")}
              accessibilityRole="image"
              className="absolute inset-0"
              style={sealStyle}
            >
              <PaperSeal caption={caption} glyph={glyph} size={SEAL_SIZE} />
            </Animated.View>
          </View>

          <View className="flex-row self-stretch">
            {week.map((day) => {
              const isToday = day.toDateString() === today.toDateString()
              return (
                <View className="flex-1 items-center gap-[5px]" key={day.toDateString()}>
                  <Text className="text-[11px] text-muted">
                    {formatDate(day, {
                      locale: i18n.language,
                      options: { weekday: "narrow" }
                    })}
                  </Text>
                  <View
                    className={cn(
                      "size-[26px] items-center justify-center rounded-full",
                      isToday && done && "border-[1.8px] border-stamp",
                      isToday && !done && "border-[1.5px] border-dashed border-muted/60",
                      !isToday && "bg-default"
                    )}
                  >
                    {isToday && done ? (
                      <Animated.Text
                        className="text-[11px] font-black text-stamp"
                        entering={ZoomIn.delay(reduceMotion ? 0 : 320)}
                      >
                        {glyph}
                      </Animated.Text>
                    ) : null}
                  </View>
                </View>
              )
            })}
          </View>
        </View>

        <View className="mt-7 flex-row items-center justify-center gap-2.5">
          <Text className="mr-1 text-[13px] text-muted">
            {t("onboarding.flow.stamp.glyphLabel")}
          </Text>
          {STAMP_GLYPHS.map((option) => {
            const selected = option === glyph
            return (
              <Pressable
                accessibilityLabel={t("onboarding.flow.stamp.glyphAria", { glyph: option })}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={cn(
                  "size-11 items-center justify-center rounded-full",
                  selected ? "border-2 border-stamp" : "border border-divider bg-surface"
                )}
                key={option}
                onPress={() => {
                  if (selected) return
                  haptics.tap()
                  onGlyphChange(option)
                }}
              >
                <Text
                  className={cn("text-[19px] font-black", selected ? "text-stamp" : "text-muted")}
                >
                  {option}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <View className="items-center px-6" style={{ paddingBottom: insets.bottom + 12 }}>
        {done ? (
          <Animated.View className="self-stretch" entering={FadeIn.delay(reduceMotion ? 0 : 700)}>
            <PrimaryButton
              label={nextLabel}
              onPress={onNext}
              trailing={
                <HugeiconsIcon color={accentForeground} icon={ArrowRight01Icon} size={18} />
              }
            />
          </Animated.View>
        ) : (
          <HoldToStamp onStamp={stampDown} progress={hold} />
        )}
      </View>
    </View>
  )
}
