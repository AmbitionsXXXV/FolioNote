import { NativeTabs } from "expo-router/unstable-native-tabs"
import { useThemeColor } from "heroui-native"
import { useTranslation } from "react-i18next"

import { CaptureAccessory } from "@/components/capture-accessory"
import { TabBarProvider, useTabBar } from "@/contexts/tab-bar-context"

/**
 * Router settings for NativeTabs
 * - initialRouteName: 'today' ensures deep links can navigate back to Today
 */
export const unstable_settings = {
  initialRouteName: "today"
}

/**
 * Four free-standing, icon-only tabs on the system Liquid Glass tab bar
 * (iOS 26), with the capture bar as the bottom accessory above them.
 * Settings lives behind the avatar in each tab's header.
 */
function Tabs() {
  const { t } = useTranslation()
  const { isHidden } = useTabBar()
  // Selected tab reads as the app's amber; unselected icons follow the glass.
  const accentColor = useThemeColor("accent")

  return (
    <NativeTabs
      hidden={isHidden}
      minimizeBehavior="onScrollDown"
      tintColor={accentColor}
    >
      <NativeTabs.BottomAccessory>
        <CaptureAccessory />
      </NativeTabs.BottomAccessory>

      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Label hidden>
          {t("nav.today")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="today"
          sf={{ default: "sun.max", selected: "sun.max.fill" }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="inbox">
        <NativeTabs.Trigger.Label hidden>
          {t("nav.inbox")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="inbox"
          sf={{ default: "tray", selected: "tray.fill" }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="review">
        <NativeTabs.Trigger.Label hidden>
          {t("nav.review")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="autorenew"
          sf={{
            default: "arrow.clockwise",
            selected: "arrow.clockwise.circle.fill"
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="japanese">
        <NativeTabs.Trigger.Label hidden>
          {t("nav.japanese")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="translate"
          sf={{
            default: "character.book.closed",
            selected: "character.book.closed.fill"
          }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}

export default function TabLayout() {
  return (
    <TabBarProvider>
      <Tabs />
    </TabBarProvider>
  )
}
