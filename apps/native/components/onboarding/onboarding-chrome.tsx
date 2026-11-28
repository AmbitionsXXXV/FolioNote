import { ArrowLeft02Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect"
import { cn, useThemeColor } from "heroui-native"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View
} from "react-native"
import type { StyleProp, ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

/**
 * Shared chrome for the onboarding pages: Liquid Glass controls floating over
 * the page (a solid surface where glass is unavailable), the step progress
 * bar, page titles and the amber primary button.
 */

const hasGlass = Platform.OS === "ios" && isLiquidGlassAvailable()

export function Glass({
  children,
  style,
  className
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  className?: string
}) {
  if (hasGlass) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive style={style}>
        {children}
      </GlassView>
    )
  }
  return (
    <View
      className={cn("border border-divider bg-surface", className)}
      style={style}
    >
      {children}
    </View>
  )
}

export function GlassBackButton({
  onPress,
  label
}: {
  onPress: () => void
  label?: string
}) {
  const { t } = useTranslation()
  const foreground = useThemeColor("foreground")
  return (
    <Pressable
      accessibilityLabel={label ?? t("common.back")}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
    >
      <Glass
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <HugeiconsIcon color={foreground} icon={ArrowLeft02Icon} size={20} />
      </Glass>
    </Pressable>
  )
}

export function GlassPillButton({
  label,
  onPress,
  icon,
  accessibilityLabel
}: {
  label: string
  onPress: () => void
  icon?: ReactNode
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
    >
      <Glass
        style={{
          height: 44,
          borderRadius: 22,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 6
        }}
      >
        {icon}
        <Text className="text-[15px] font-medium text-foreground">{label}</Text>
      </Glass>
    </Pressable>
  )
}

const PROGRESS_SEGMENTS = [1, 2, 3, 4, 5] as const

/** Back, the five-segment progress bar and (optionally) skip. */
export function OnboardingTopBar({
  progress,
  onBack,
  onSkip
}: {
  progress: number
  onBack: () => void
  onSkip?: () => void
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  return (
    <View
      className="absolute inset-x-4 z-10 flex-row items-center gap-3.5"
      style={{ top: insets.top + 6 }}
    >
      <GlassBackButton label={t("onboarding.flow.previous")} onPress={onBack} />
      <View
        accessibilityLabel={t("onboarding.flow.progress")}
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: PROGRESS_SEGMENTS.length,
          now: progress
        }}
        className="flex-1 flex-row gap-[5px]"
      >
        {PROGRESS_SEGMENTS.map((segment) => (
          <View
            className={cn(
              "h-1 flex-1 rounded-full",
              segment <= progress ? "bg-accent" : "bg-divider"
            )}
            key={segment}
          />
        ))}
      </View>
      {onSkip ? (
        <GlassPillButton label={t("onboarding.flow.skip")} onPress={onSkip} />
      ) : (
        <View className="w-11" />
      )}
    </View>
  )
}

export function StepHeading({
  title,
  subtitle
}: {
  title: string
  subtitle?: string
}) {
  return (
    <View className="gap-2">
      <Text
        accessibilityRole="header"
        className="text-[30px] leading-9 font-bold tracking-tight text-foreground"
      >
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-base leading-6 text-muted">{subtitle}</Text>
      ) : null}
    </View>
  )
}

export function PrimaryButton({
  label,
  onPress,
  isDisabled = false,
  isLoading = false,
  trailing
}: {
  label: string
  onPress: () => void
  isDisabled?: boolean
  isLoading?: boolean
  trailing?: ReactNode
}) {
  const accentForeground = useThemeColor("accent-foreground")
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled || isLoading }}
      className={cn(
        "h-14 flex-row items-center justify-center gap-2 rounded-full bg-accent active:opacity-80",
        (isDisabled || isLoading) && "opacity-50"
      )}
      disabled={isDisabled || isLoading}
      onPress={onPress}
    >
      {isLoading ? (
        <ActivityIndicator color={accentForeground} />
      ) : (
        <>
          <Text className="text-[17px] font-semibold text-accent-foreground">
            {label}
          </Text>
          {trailing}
        </>
      )}
    </Pressable>
  )
}
