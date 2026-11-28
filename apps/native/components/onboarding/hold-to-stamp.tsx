import { useThemeColor } from "heroui-native"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated"
import type { SharedValue } from "react-native-reanimated"
import Svg, { Circle } from "react-native-svg"
import { useCSSVariable } from "uniwind"

import { haptics } from "@/lib/haptics"

/** How long the press has to be held to stamp. */
export const HOLD_MS = 800
const BUTTON = 92
const RING = BUTTON + 18
const RING_STROKE = 3
const RING_RADIUS = (RING - RING_STROKE) / 2
const RING_LENGTH = 2 * Math.PI * RING_RADIUS
/** The charge pulses get denser: 120ms apart at first, 40ms at the end. */
const FIRST_PULSE_GAP_MS = 120
const LAST_PULSE_GAP_MS = 40

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** Offsets (ms) at which a charge pulse fires during one full hold. */
const pulseSchedule = (): number[] => {
  const times: number[] = []
  let at = 0
  while (at < HOLD_MS) {
    times.push(at)
    const progress = at / HOLD_MS
    at += FIRST_PULSE_GAP_MS - (FIRST_PULSE_GAP_MS - LAST_PULSE_GAP_MS) * progress
  }
  return times
}
const PULSES = pulseSchedule()

/**
 * The stamp button: press and hold for 0.8s, the ring fills and the pulses
 * get denser; let go early and it springs back. `progress` (0…1) is shared
 * so the hovering seal can sink as the ring fills.
 */
export function HoldToStamp({
  progress,
  onStamp
}: {
  progress: SharedValue<number>
  onStamp: () => void
}) {
  const { t } = useTranslation()
  const stamp = String(useCSSVariable("--color-stamp") ?? "red")
  const background = useThemeColor("background")
  const reduceMotion = useReducedMotion()
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const breathe = useSharedValue(1)

  useEffect(() => {
    if (reduceMotion) return
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    )
  }, [breathe, reduceMotion])

  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer)
    },
    []
  )

  const clearTimers = () => {
    for (const timer of timers.current) clearTimeout(timer)
    timers.current = []
  }

  const pressIn = () => {
    clearTimers()
    progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear })
    timers.current = [
      ...PULSES.map((at) => setTimeout(haptics.charge, at)),
      setTimeout(() => {
        timers.current = []
        haptics.stamp()
        onStamp()
      }, HOLD_MS)
    ]
  }

  const pressOut = () => {
    if (timers.current.length === 0) return
    clearTimers()
    progress.value = withSpring(0, { damping: 16, stiffness: 180 })
  }

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_LENGTH * (1 - progress.value)
  }))
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value * (1 - 0.06 * progress.value) }]
  }))

  return (
    <View className="items-center justify-center" style={{ width: RING, height: RING }}>
      <Svg height={RING} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }} width={RING}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          fill="none"
          opacity={0.25}
          r={RING_RADIUS}
          stroke={stamp}
          strokeWidth={RING_STROKE}
        />
        <AnimatedCircle
          animatedProps={ringProps}
          cx={RING / 2}
          cy={RING / 2}
          fill="none"
          r={RING_RADIUS}
          stroke={stamp}
          strokeDasharray={`${RING_LENGTH} ${RING_LENGTH}`}
          strokeLinecap="round"
          strokeWidth={RING_STROKE}
        />
      </Svg>
      <Animated.View style={buttonStyle}>
        <Pressable
          accessibilityHint={t("onboarding.flow.stamp.holdHint")}
          accessibilityLabel={t("onboarding.flow.stamp.holdAria")}
          accessibilityRole="button"
          // VoiceOver users can't hold-and-wait; a double tap stamps.
          onAccessibilityTap={() => {
            haptics.stamp()
            onStamp()
          }}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={{
            width: BUTTON,
            height: BUTTON,
            borderRadius: BUTTON / 2,
            backgroundColor: stamp,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 4,
            borderColor: background
          }}
        >
          <Text className="text-[17px] font-bold text-stamp-foreground">
            {t("onboarding.flow.stamp.hold")}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}
