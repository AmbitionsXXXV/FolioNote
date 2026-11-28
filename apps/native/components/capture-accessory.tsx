import { Add01Icon, Mic01Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { router } from "expo-router"
import { NativeTabs } from "expo-router/unstable-native-tabs"
import { useThemeColor } from "heroui-native"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

const openCapture = () => {
  router.navigate({ pathname: "/inbox", params: { capture: "1" } })
}

/**
 * The glass "jot something down" bar above the tabs (iOS 26 bottom
 * accessory). The system draws the glass; this only lays out the row.
 * Tapping it opens the inbox with quick capture focused.
 */
export function CaptureAccessory() {
  const { t } = useTranslation()
  const placement = NativeTabs.BottomAccessory.usePlacement()
  const foregroundColor = useThemeColor("foreground")
  const mutedColor = useThemeColor("muted")

  if (placement === "inline") {
    return (
      <Pressable
        accessibilityLabel={t("nav.capture")}
        accessibilityRole="button"
        className="flex-1 flex-row items-center justify-center gap-2 px-3"
        onPress={openCapture}
      >
        <HugeiconsIcon color={foregroundColor} icon={Add01Icon} size={20} />
        <Text className="text-sm text-muted" numberOfLines={1}>
          {t("nav.capture")}
        </Text>
      </Pressable>
    )
  }

  return (
    <Pressable
      accessibilityHint={t("nav.capturePlaceholder")}
      accessibilityLabel={t("nav.capture")}
      accessibilityRole="button"
      className="flex-1 flex-row items-center gap-3 px-4"
      onPress={openCapture}
    >
      <HugeiconsIcon color={foregroundColor} icon={Add01Icon} size={22} />
      <Text className="flex-1 text-base text-muted" numberOfLines={1}>
        {t("nav.capturePlaceholder")}
      </Text>
      <View accessibilityElementsHidden importantForAccessibility="no">
        <HugeiconsIcon color={mutedColor} icon={Mic01Icon} size={20} />
      </View>
    </Pressable>
  )
}
