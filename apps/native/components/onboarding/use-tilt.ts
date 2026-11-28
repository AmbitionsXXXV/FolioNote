import { DeviceMotion } from "expo-sensors"
import { useEffect } from "react"
import { useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated"
import type { SharedValue } from "react-native-reanimated"

const UPDATE_INTERVAL_MS = 50
/** Radians of tilt that map to the full parallax offset. */
const FULL_TILT_RAD = 0.35
const TILT_SPRING = { damping: 20, stiffness: 120 } as const

const clampUnit = (value: number) => Math.max(-1, Math.min(1, value))

/**
 * How far the phone is tilted from where it was held when the page opened,
 * as -1…1 on each axis. Stays at 0 with Reduce Motion or without a sensor.
 */
export function useTilt(): { x: SharedValue<number>; y: SharedValue<number> } {
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) return
    let subscription: { remove: () => void } | null = null
    let baseline: { beta: number; gamma: number } | null = null
    let cancelled = false

    DeviceMotion.isAvailableAsync()
      .then((available) => {
        if (!available || cancelled) return
        DeviceMotion.setUpdateInterval(UPDATE_INTERVAL_MS)
        subscription = DeviceMotion.addListener(({ rotation }) => {
          if (!rotation) return
          baseline ??= { beta: rotation.beta, gamma: rotation.gamma }
          x.value = withSpring(
            clampUnit((rotation.gamma - baseline.gamma) / FULL_TILT_RAD),
            TILT_SPRING
          )
          y.value = withSpring(
            clampUnit((rotation.beta - baseline.beta) / FULL_TILT_RAD),
            TILT_SPRING
          )
        })
      })
      .catch(() => {
        // No motion sensor (simulator): the cards simply stay put.
      })

    return () => {
      cancelled = true
      subscription?.remove()
    }
  }, [reduceMotion, x, y])

  return { x, y }
}
