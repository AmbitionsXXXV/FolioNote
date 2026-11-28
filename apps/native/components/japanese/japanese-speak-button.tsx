import { VolumeHighIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useThemeColor } from "heroui-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Alert, Pressable } from "react-native"

import { speakJapanese } from "@/lib/japanese-speech"

const ICON_SIZE = 20
const HIT_SLOP = 8

/** Reads Japanese text aloud with the system voice. */
export function JapaneseSpeakButton({
  text,
  label,
  className
}: {
  text: string
  /** Accessible name; defaults to "Play “<text>”". */
  label?: string
  className?: string
}) {
  const { t } = useTranslation()
  const mutedColor = useThemeColor("muted")
  const accentColor = useThemeColor("accent")
  const [speaking, setSpeaking] = useState(false)

  const handlePress = async () => {
    setSpeaking(true)
    try {
      await speakJapanese(text)
    } catch {
      Alert.alert(t("common.error"), t("japanese.speech.failed"))
    } finally {
      setSpeaking(false)
    }
  }

  return (
    <Pressable
      accessibilityLabel={label ?? t("japanese.speech.playWord", { text })}
      accessibilityRole="button"
      className={className}
      hitSlop={HIT_SLOP}
      onPress={() => {
        void handlePress()
      }}
    >
      <HugeiconsIcon
        color={speaking ? accentColor : mutedColor}
        icon={VolumeHighIcon}
        size={ICON_SIZE}
      />
    </Pressable>
  )
}
