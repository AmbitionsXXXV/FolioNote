import { ArrowRight01Icon } from "@hugeicons-pro/core-stroke-rounded"
import type { IconSvgElement } from "@hugeicons/react-native"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { cn, PressableFeedback, useThemeColor } from "heroui-native"
import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

/**
 * iOS inset-grouped building blocks for the tab pages: a section heading,
 * a white card on the warm background, and rows separated by hairlines
 * that start after the icon tile (like Settings).
 */

interface GroupedSectionProps {
  title: string
  actionLabel?: string
  onAction?: () => void
  children: ReactNode
}

export function GroupedSection({
  title,
  actionLabel,
  onAction,
  children
}: GroupedSectionProps) {
  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between px-1">
        <Text
          accessibilityRole="header"
          className="text-xl font-bold text-foreground"
        >
          {title}
        </Text>
        {actionLabel && onAction ? (
          <Text
            accessibilityRole="button"
            className="text-[15px] text-accent"
            onPress={onAction}
          >
            {actionLabel}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  )
}

export function GroupedCard({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <View className={cn("overflow-hidden rounded-3xl bg-surface", className)}>
      {children}
    </View>
  )
}

type TileTone = "accent" | "neutral"

export function IconTile({
  icon,
  tone = "accent"
}: {
  icon: IconSvgElement
  tone?: TileTone
}) {
  const accentColor = useThemeColor("accent")
  const mutedColor = useThemeColor("muted")
  const isAccent = tone === "accent"

  return (
    <View
      className={cn(
        "size-[30px] items-center justify-center rounded-[9px]",
        isAccent ? "bg-accent/15" : "bg-default"
      )}
    >
      <HugeiconsIcon
        color={isAccent ? accentColor : mutedColor}
        icon={icon}
        size={17}
      />
    </View>
  )
}

/** Hairline that starts at the row's text, not the card edge. */
export function RowSeparator({ inset = 58 }: { inset?: number }) {
  return (
    <View
      className="bg-divider"
      style={{ height: StyleSheet.hairlineWidth, marginLeft: inset }}
    />
  )
}

interface GroupedRowProps {
  label: string
  sublabel?: string
  icon?: IconSvgElement
  iconTone?: TileTone
  value?: string | number
  valueClassName?: string
  /** Replaces the chevron, e.g. a checkmark in a single-select list. */
  accessory?: ReactNode
  showChevron?: boolean
  onPress?: () => void
  accessibilityState?: { selected?: boolean; disabled?: boolean }
}

export function GroupedRow({
  label,
  sublabel,
  icon,
  iconTone,
  value,
  valueClassName,
  accessory,
  showChevron = true,
  onPress,
  accessibilityState
}: GroupedRowProps) {
  const mutedColor = useThemeColor("muted")
  const trailing =
    accessory ??
    (showChevron && onPress ? (
      <HugeiconsIcon color={mutedColor} icon={ArrowRight01Icon} size={16} />
    ) : null)

  const content = (
    <View
      className={cn(
        "flex-row items-center gap-3 pr-4 pl-4",
        sublabel ? "min-h-[58px] py-2" : "min-h-[52px]"
      )}
    >
      {icon ? <IconTile icon={icon} tone={iconTone} /> : null}
      <View className="min-w-0 flex-1">
        <Text className="text-base text-foreground" numberOfLines={1}>
          {label}
        </Text>
        {sublabel ? (
          <Text className="text-[13px] text-muted" numberOfLines={2}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {value === undefined ? null : (
        <Text
          className={cn("text-base text-muted tabular-nums", valueClassName)}
        >
          {value}
        </Text>
      )}
      {trailing}
    </View>
  )

  if (!onPress) {
    return content
  }

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      onPress={onPress}
    >
      <PressableFeedback.Highlight />
      {content}
    </PressableFeedback>
  )
}
