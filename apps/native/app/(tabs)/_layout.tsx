import { useSegments } from "expo-router"
import { NativeTabs } from "expo-router/unstable-native-tabs"
import { useThemeColor } from "heroui-native"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { CaptureAccessory } from "@/components/capture-accessory"
import { TabBarProvider, useTabBar } from "@/contexts/tab-bar-context"
import { playTabMotion } from "@/modules/tab-motion"
import type { TabMotionKind } from "@/modules/tab-motion"

/**
 * Router settings for NativeTabs
 * - initialRouteName: 'today' ensures deep links can navigate back to Today
 */
export const unstable_settings = {
  initialRouteName: "today"
}

/**
 * Tab order and the selection motion each icon plays (see the 图标与动效
 * page of the design canvas). Order must match the triggers below.
 */
const TAB_MOTIONS: { name: string; motion: TabMotionKind }[] = [
  { name: "today", motion: "stamp" },
  { name: "inbox", motion: "drop" },
  { name: "review", motion: "open" },
  { name: "japanese", motion: "bounce" }
]

/** Plays the selected tab's motion whenever the active tab changes. */
function useTabSelectionMotion() {
  const segments = useSegments()
  const activeTab = segments[1]
  const previousTab = useRef(activeTab)

  useEffect(() => {
    if (previousTab.current === activeTab) {
      return
    }
    previousTab.current = activeTab
    const index = TAB_MOTIONS.findIndex((tab) => tab.name === activeTab)
    if (index !== -1) {
      playTabMotion(index, TAB_MOTIONS[index].motion)
    }
  }, [activeTab])
}

/**
 * Four free-standing, icon-only tabs on the system Liquid Glass tab bar
 * (iOS 26), with the capture bar as the bottom accessory above them.
 * Settings lives behind the avatar in each tab's header.
 */
function Tabs() {
  const { t } = useTranslation()
  const { isHidden } = useTabBar()
  // Unselected icons are template SF Symbols tinted by the glass; selected
  // ones are duotone images that carry their own amber (see assets/tab-icons).
  const accentColor = useThemeColor("accent")
  useTabSelectionMotion()

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
          xcasset={{ default: "folio.today", selected: "folio.today.selected" }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="inbox">
        <NativeTabs.Trigger.Label hidden>
          {t("nav.inbox")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="inbox"
          xcasset={{ default: "folio.inbox", selected: "folio.inbox.selected" }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="review">
        <NativeTabs.Trigger.Label hidden>
          {t("nav.review")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="autorenew"
          xcasset={{
            default: "folio.review",
            selected: "folio.review.selected"
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="japanese">
        <NativeTabs.Trigger.Label hidden>
          {t("nav.japanese")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="translate"
          xcasset={{
            default: "folio.japanese",
            selected: "folio.japanese.selected"
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
