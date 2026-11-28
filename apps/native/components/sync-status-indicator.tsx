/**
 * Sync Status Indicator Component
 *
 * Displays current sync status with visual indicators.
 * Shows syncing animation, sync errors, conflicts, and offline state.
 */

import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  CloudIcon,
  Loading03Icon,
  WifiDisconnected01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import type { IconSvgElement } from "@hugeicons/react-native"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { cn, useThemeColor } from "heroui-native"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Animated, Pressable, Text, View } from "react-native"

import { useSync } from "@/contexts/sync-context"

interface SyncStatusIndicatorProps {
  /**
   * Whether tapping triggers a sync
   */
  interactive?: boolean
  /**
   * Whether to show the label text
   */
  showLabel?: boolean
  /**
   * Size of the indicator icon
   */
  size?: number
}

export function SyncStatusIndicator({
  size = 20,
  showLabel = false,
  interactive = true
}: SyncStatusIndicatorProps) {
  const { t } = useTranslation()
  const { syncState, isOnline, metadata, conflicts, sync } = useSync()

  // Theme colors
  const mutedColor = useThemeColor("muted")
  const accentColor = useThemeColor("accent")
  const warningColor = useThemeColor("warning")
  const dangerColor = useThemeColor("danger")
  const successColor = useThemeColor("success")

  // Create the Animated.Value once via lazy state init instead of reading
  // useRef().current during render (which also reconstructed it each render).
  const [rotateAnim] = useState(() => new Animated.Value(0))

  // Rotate animation for syncing state
  useEffect(() => {
    if (syncState === "syncing") {
      const animation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true
        })
      )
      animation.start()
      return () => animation.stop()
    }
    rotateAnim.setValue(0)
  }, [syncState, rotateAnim])

  const handlePress = () => {
    if (interactive && syncState !== "syncing" && isOnline) {
      sync()
    }
  }

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"]
  })

  // Determine icon and color based on state
  const getStatusConfig = (): {
    icon: IconSvgElement
    color: string
    label: string
    animated?: boolean
  } => {
    if (!isOnline) {
      return {
        icon: WifiDisconnected01Icon,
        color: mutedColor,
        label: t("sync.offline")
      }
    }

    if (syncState === "syncing") {
      return {
        icon: Loading03Icon,
        color: accentColor,
        label: t("sync.syncing"),
        animated: true
      }
    }

    if (syncState === "conflict" || conflicts.length > 0) {
      return {
        icon: Alert02Icon,
        color: warningColor,
        label: t("sync.conflict")
      }
    }

    if (syncState === "error") {
      return {
        icon: Alert02Icon,
        color: dangerColor,
        label: t("sync.error")
      }
    }

    // Check pending operations
    if (metadata && metadata.pendingOperationsCount > 0) {
      return {
        icon: CloudIcon,
        color: warningColor,
        label: t("sync.pending", { count: metadata.pendingOperationsCount })
      }
    }

    return {
      icon: CheckmarkCircle02Icon,
      color: successColor,
      label: t("sync.synced")
    }
  }

  const config = getStatusConfig()

  const content = (
    <View className="flex-row items-center gap-2">
      {config.animated ? (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <HugeiconsIcon color={config.color} icon={config.icon} size={size} />
        </Animated.View>
      ) : (
        <HugeiconsIcon color={config.color} icon={config.icon} size={size} />
      )}
      {showLabel && (
        <Text className="text-sm" style={{ color: config.color }}>
          {config.label}
        </Text>
      )}
    </View>
  )

  if (interactive && isOnline && syncState !== "syncing") {
    return (
      <Pressable
        accessibilityLabel={config.label}
        accessibilityRole="button"
        className="rounded-lg p-2 active:bg-muted/20"
        onPress={handlePress}
      >
        {content}
      </Pressable>
    )
  }

  return (
    <View accessibilityLabel={config.label} className="p-2">
      {content}
    </View>
  )
}

/**
 * Compact sync status badge for headers
 */
export function SyncStatusBadge() {
  const { syncState, isOnline, metadata, conflicts } = useSync()
  const { t } = useTranslation()

  // Only show badge when there's something notable
  if (
    isOnline &&
    syncState === "idle" &&
    conflicts.length === 0 &&
    (!metadata || metadata.pendingOperationsCount === 0)
  ) {
    return null
  }

  const getBadgeConfig = () => {
    if (!isOnline) {
      return {
        text: t("sync.offline"),
        bgColor: "bg-muted/20",
        textColor: "text-muted"
      }
    }

    if (syncState === "syncing") {
      return {
        text: t("sync.syncing"),
        bgColor: "bg-accent/10",
        textColor: "text-accent"
      }
    }

    if (syncState === "conflict" || conflicts.length > 0) {
      return {
        text: t("sync.conflictCount", { count: conflicts.length }),
        bgColor: "bg-warning/10",
        textColor: "text-warning"
      }
    }

    if (syncState === "error") {
      return {
        text: t("sync.error"),
        bgColor: "bg-danger/10",
        textColor: "text-danger"
      }
    }

    if (metadata && metadata.pendingOperationsCount > 0) {
      return {
        text: t("sync.pendingCount", {
          count: metadata.pendingOperationsCount
        }),
        bgColor: "bg-warning/10",
        textColor: "text-warning"
      }
    }

    return null
  }

  const config = getBadgeConfig()
  if (!config) {
    return null
  }

  return (
    <View className={cn("rounded-full px-2 py-1", config.bgColor)}>
      <Text className={cn("font-medium text-xs", config.textColor)}>
        {config.text}
      </Text>
    </View>
  )
}
