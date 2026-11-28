import { formatDate } from "@folionote/locales"
import { PinIcon, StarIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useRouter } from "expo-router"
import { cn, PressableFeedback, useThemeColor } from "heroui-native"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

interface Entry {
  id: string
  title: string | null
  contentText: string | null
  isStarred: boolean | null
  isPinned: boolean | null
  isInbox: boolean | null
  createdAt: Date | string | number
  updatedAt: Date | string | number | null | undefined
}

interface EntryRowProps {
  entry: Entry
  onPress?: (entry: Entry) => void
  /** Whether to navigate to detail page on press (default: true) */
  navigateOnPress?: boolean
  /** Two lines of body text under the title (inbox); off for compact lists. */
  showPreview?: boolean
  /** Extra meta after the time, e.g. "收件箱". */
  meta?: string
}

function truncateText(text: string | null, maxLength: number): string {
  if (!text) {
    return ""
  }
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength)}...`
}

const DATE_FALLBACK_TEXT = "--"

function toValidDate(dateValue: Entry["updatedAt"]): Date | null {
  if (dateValue == null) {
    return null
  }

  const normalizedDate =
    dateValue instanceof Date ? dateValue : new Date(dateValue)
  if (Number.isNaN(normalizedDate.getTime())) {
    return null
  }

  return normalizedDate
}

export function formatUpdatedAtSafely(
  dateValue: Entry["updatedAt"],
  locale: string
): string {
  const normalizedDate = toValidDate(dateValue)
  if (!normalizedDate) {
    return DATE_FALLBACK_TEXT
  }

  try {
    return formatDate(normalizedDate, { locale, preset: "relative" })
  } catch {
    try {
      return formatDate(normalizedDate, { locale, preset: "medium" })
    } catch {
      return DATE_FALLBACK_TEXT
    }
  }
}

/**
 * One note as a row inside a GroupedCard: title (with pin / star marks),
 * optional two-line preview, then the relative time. Rows carry no card of
 * their own; the grouped card and hairline separators frame them.
 */
export function EntryRow({
  entry,
  onPress,
  navigateOnPress = true,
  showPreview = false,
  meta
}: EntryRowProps) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const accentColor = useThemeColor("accent")

  const handlePress = () => {
    if (onPress) {
      onPress(entry)
    } else if (navigateOnPress) {
      router.push(`/inbox/${entry.id}`)
    }
  }

  const title = entry.title || t("entryCard.untitled")
  const preview = entry.contentText
    ? truncateText(entry.contentText, 120)
    : t("entryCard.emptyNote")
  const updatedAtText = formatUpdatedAtSafely(entry.updatedAt, i18n.language)
  const metaText = meta ? `${updatedAtText} · ${meta}` : updatedAtText

  return (
    <PressableFeedback accessibilityRole="button" onPress={handlePress}>
      <PressableFeedback.Highlight />
      <View className="gap-0.5 px-4 py-3">
        <View className="flex-row items-center gap-1.5">
          {entry.isPinned && (
            <HugeiconsIcon color={accentColor} icon={PinIcon} size={13} />
          )}
          <Text
            className={cn(
              "flex-1 text-base text-foreground",
              showPreview ? "font-semibold" : "font-medium"
            )}
            numberOfLines={1}
          >
            {title}
          </Text>
          {entry.isStarred && (
            <HugeiconsIcon color={accentColor} icon={StarIcon} size={14} />
          )}
        </View>

        {showPreview && (
          <Text className="text-sm leading-5 text-muted" numberOfLines={2}>
            {preview}
          </Text>
        )}

        <Text className="text-[13px] text-muted">{metaText}</Text>
      </View>
    </PressableFeedback>
  )
}
