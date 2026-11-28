import {
  FlashIcon,
  HelpCircleIcon,
  RefreshIcon,
  Tick01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect"
import { Button, useThemeColor } from "heroui-native"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ActivityIndicator, Platform, Text, View } from "react-native"

type Rating = "again" | "hard" | "good" | "easy"

interface ReviewRatingButtonsProps {
  onRating: (rating: Rating) => void
  isPending: boolean
}

/**
 * Floating action bar for immersive screens: Liquid Glass on iOS 26, a
 * solid surface elsewhere.
 */
function GlassActionBar({ children }: { children: ReactNode }) {
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive
        style={{ borderRadius: 30, padding: 8 }}
      >
        {children}
      </GlassView>
    )
  }
  return <View className="rounded-[30px] bg-surface p-2">{children}</View>
}

export function ReviewRatingButtons({
  onRating,
  isPending
}: ReviewRatingButtonsProps) {
  const { t } = useTranslation()
  const accentColor = useThemeColor("accent")
  const accentForegroundColor = useThemeColor("accent-foreground")
  const successColor = useThemeColor("success")
  const dangerColor = useThemeColor("danger")
  const warningColor = useThemeColor("warning")

  return (
    <View className="mt-4">
      <GlassActionBar>
        <View className="flex-row justify-between">
          {/* Again */}
          <Button
            className="mr-2 flex-1 items-center bg-danger/10 active:opacity-70"
            isDisabled={isPending}
            onPress={() => onRating("again")}
          >
            <HugeiconsIcon color={dangerColor} icon={RefreshIcon} size={24} />
            <Text className="mt-1 text-sm font-medium text-danger">
              {t("review.again")}
            </Text>
          </Button>

          {/* Hard */}
          <Button
            className="mr-2 flex-1 items-center bg-warning/10 active:opacity-70"
            isDisabled={isPending}
            onPress={() => onRating("hard")}
          >
            <HugeiconsIcon
              color={warningColor}
              icon={HelpCircleIcon}
              size={24}
            />
            <Text className="mt-1 text-sm font-medium text-warning">
              {t("review.hard")}
            </Text>
          </Button>

          {/* Good: the expected answer, so it is the one filled button */}
          <Button
            className="mr-2 flex-1 items-center bg-accent active:opacity-70"
            isDisabled={isPending}
            onPress={() => onRating("good")}
          >
            <HugeiconsIcon
              color={accentForegroundColor}
              icon={Tick01Icon}
              size={24}
            />
            <Text className="mt-1 text-sm font-medium text-accent-foreground">
              {t("review.good")}
            </Text>
          </Button>

          {/* Easy */}
          <Button
            className="flex-1 items-center bg-success/10 active:opacity-70"
            isDisabled={isPending}
            onPress={() => onRating("easy")}
          >
            <HugeiconsIcon color={successColor} icon={FlashIcon} size={24} />
            <Text className="mt-1 text-sm font-medium text-success">
              {t("review.easy")}
            </Text>
          </Button>
        </View>
      </GlassActionBar>

      {isPending && (
        <View className="absolute inset-0 items-center justify-center rounded-[30px] bg-background/80">
          <ActivityIndicator color={accentColor} />
        </View>
      )}
    </View>
  )
}
