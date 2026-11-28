import { ViewIcon, ViewOffIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useThemeColor } from "heroui-native"
import type { ComponentRef, ReactNode, Ref } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { TextInputProps } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming
} from "react-native-reanimated"

import { haptics } from "@/lib/haptics"

/**
 * Sign-in / sign-up form pieces in the tab pages' inset-grouped style: one
 * white card of labelled rows, hairlines between them, an error under the
 * row it belongs to, and a three-shake with the 出错 haptic.
 */

const SHAKE_DISTANCE = 8
const SHAKE_STEP_MS = 55

export function useShake() {
  const offset = useSharedValue(0)
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }]
  }))
  const shake = () => {
    haptics.error()
    const step = { duration: SHAKE_STEP_MS }
    offset.value = withSequence(
      withTiming(-SHAKE_DISTANCE, step),
      withTiming(SHAKE_DISTANCE, step),
      withTiming(-SHAKE_DISTANCE, step),
      withTiming(SHAKE_DISTANCE, step),
      withTiming(-SHAKE_DISTANCE / 2, step),
      withTiming(0, step)
    )
  }
  return { style, shake }
}

export function FormCard({
  children,
  shakeStyle
}: {
  children: ReactNode
  shakeStyle?: ReturnType<typeof useShake>["style"]
}) {
  return (
    <Animated.View className="overflow-hidden rounded-[20px] bg-surface" style={shakeStyle}>
      {children}
    </Animated.View>
  )
}

export function FormRow({
  label,
  error,
  isLast = false,
  isPassword = false,
  inputRef,
  ...inputProps
}: TextInputProps & {
  label: string
  error?: string | null
  isLast?: boolean
  isPassword?: boolean
  inputRef?: Ref<ComponentRef<typeof TextInput>>
}) {
  const { t } = useTranslation()
  const muted = useThemeColor("muted")
  const [revealed, setRevealed] = useState(false)

  return (
    <View className="ml-4">
      <View className="min-h-[52px] flex-row items-center pr-3">
        <Text className="w-24 text-base text-foreground" numberOfLines={1}>
          {label}
        </Text>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
          className="h-11 min-w-0 flex-1 text-base text-foreground"
          placeholderTextColor={muted}
          ref={inputRef}
          secureTextEntry={isPassword && !revealed}
          {...inputProps}
        />
        {isPassword ? (
          <Pressable
            accessibilityLabel={
              revealed ? t("onboarding.flow.form.hidePassword") : t("onboarding.flow.form.showPassword")
            }
            accessibilityRole="button"
            className="size-11 items-center justify-center"
            onPress={() => {
              haptics.tap()
              setRevealed((value) => !value)
            }}
          >
            <HugeiconsIcon color={muted} icon={revealed ? ViewOffIcon : ViewIcon} size={20} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" className="-mt-1.5 pr-4 pb-2.5 text-[13px] text-danger">
          {error}
        </Text>
      ) : null}
      {isLast ? null : (
        <View className="bg-divider" style={{ height: StyleSheet.hairlineWidth }} />
      )}
    </View>
  )
}
