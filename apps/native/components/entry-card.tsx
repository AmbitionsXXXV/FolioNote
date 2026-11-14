import { formatDate } from "@folionote/locales"
import { PinIcon, StarIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useRouter } from "expo-router"
import { Card, PressableFeedback, useThemeColor } from "heroui-native"
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

interface EntryCardProps {
  entry: Entry
  onPress?: (entry: Entry) => void
  /** Whether to navigate to detail page on press (default: true) */
  navigateOnPress?: boolean
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

function formatUpdatedAtSafely(
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

export function EntryCard({
  entry,
  onPress,
  navigateOnPress = true
}: EntryCardProps) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const warningColor = useThemeColor("warning")
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

  return (
    <PressableFeedback onPress={handlePress}>
      <PressableFeedback.Highlight />
      <Card className="p-4" variant="secondary">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <View className="mb-1 flex-row items-center">
              {entry.isPinned && (
                <View className="mr-1">
                  <HugeiconsIcon color={accentColor} icon={PinIcon} size={14} />
                </View>
              )}
              <Text
                className="flex-1 text-base font-medium text-foreground"
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>

            {preview && (
              <Text className="mb-2 text-sm text-muted" numberOfLines={2}>
                {preview}
              </Text>
            )}

            <View className="flex-row items-center">
              <Text className="text-xs text-muted">{updatedAtText}</Text>
            </View>
          </View>

          {entry.isStarred && (
            <HugeiconsIcon color={warningColor} icon={StarIcon} size={18} />
          )}
        </View>
      </Card>
    </PressableFeedback>
  )
}
