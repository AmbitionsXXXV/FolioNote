import {
  OPENJLPT_ATTRIBUTION,
  OPENJLPT_LICENSE_URL,
  OPENJLPT_REPO_URL
} from "@folionote/constants"
import { cn } from "heroui-native"
import { useTranslation } from "react-i18next"
import { Text, View } from "react-native"

import { JapaneseExternalLink } from "./japanese-external-link"

/**
 * CC BY-SA 4.0 requires this notice wherever OpenJLPT data is shown, so the
 * hub and the word screen both render it.
 */
export function JapaneseAttribution({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <View className={cn("items-center px-2", className)}>
      <Text className="text-center text-xs leading-4 text-muted">
        {OPENJLPT_ATTRIBUTION}
      </Text>
      <View className="flex-row items-center gap-3">
        <JapaneseExternalLink
          label={t("japanese.attribution.repo")}
          url={OPENJLPT_REPO_URL}
        />
        <Text className="text-xs text-muted">·</Text>
        <JapaneseExternalLink
          label={t("japanese.attribution.license")}
          url={OPENJLPT_LICENSE_URL}
        />
      </View>
    </View>
  )
}
