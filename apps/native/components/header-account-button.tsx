import { router } from "expo-router"
import { useThemeColor } from "heroui-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable } from "react-native"
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"

import { useAppTheme } from "@/contexts/app-theme-context"

import {
  ACCOUNT_ACTIVE_FILL_PATH,
  ACCOUNT_ACTIVE_LINE_PATH,
  ACCOUNT_OUTLINE_PATH
} from "./account-glyph-paths"

// Same values as the selected tab icons (assets/tab-icons): amber lines one
// step lighter than the accent, with a light fill underneath.
const ACTIVE_COLORS = {
  light: { line: "#AF7131", fillOpacity: 0.2 },
  dark: { line: "#ECA748", fillOpacity: 0.3 }
} as const

// SPRING_BOUNCY from the motion presets (stiffness 400, damping 25, mass 0.8).
const SPRING_BOUNCY = { stiffness: 400, damping: 25, mass: 0.8 } as const
const COG_START_ROTATION = -60
// Long enough for the cog to land before Settings slides over it.
const NAVIGATE_DELAY_MS = 220
// By the time Settings has covered the header, go back to the resting icon.
const RESET_DELAY_MS = 700

/**
 * Top-right account button in every tab header; opens Settings, which has no
 * tab of its own. At rest it is a person in a circle; on press the circle
 * turns into a cog with a short spin, then Settings opens.
 */
export function HeaderAccountButton() {
  const { t } = useTranslation()
  const { isDark } = useAppTheme()
  const restColor = useThemeColor("foreground")
  const [isActive, setIsActive] = useState(false)
  const rotation = useSharedValue(0)
  const scale = useSharedValue(1)

  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }]
  }))

  const handlePress = () => {
    setIsActive(true)
    const spring = { ...SPRING_BOUNCY, reduceMotion: ReduceMotion.System }
    rotation.value = withSequence(
      withTiming(COG_START_ROTATION, { duration: 0 }),
      withSpring(0, spring)
    )
    scale.value = withSequence(
      withTiming(0.8, { duration: 0 }),
      withSpring(1, spring)
    )
    setTimeout(() => router.push("/settings"), NAVIGATE_DELAY_MS)
    setTimeout(() => setIsActive(false), RESET_DELAY_MS)
  }

  const active = isDark ? ACTIVE_COLORS.dark : ACTIVE_COLORS.light

  return (
    <Pressable
      accessibilityLabel={t("common.settings")}
      accessibilityRole="button"
      className="size-9 items-center justify-center"
      hitSlop={8}
      onPress={handlePress}
    >
      <Animated.View style={glyphStyle}>
        <Svg height={24} viewBox="0 0 24 24" width={24}>
          {isActive ? (
            <>
              <Path
                d={ACCOUNT_ACTIVE_FILL_PATH}
                fill={active.line}
                fillOpacity={active.fillOpacity}
              />
              <Path d={ACCOUNT_ACTIVE_LINE_PATH} fill={active.line} />
            </>
          ) : (
            <Path d={ACCOUNT_OUTLINE_PATH} fill={restColor} />
          )}
        </Svg>
      </Animated.View>
    </Pressable>
  )
}
