import { Button } from "@folionote/ui/button"
import { VolumeHighIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { isJapaneseSpeechSupported, speakJapanese } from "@/lib/japanese/speech"
import { cn } from "@/lib/utils"

// Support never changes while the page is open.
const subscribeToNothing = () => () => {}

/**
 * Reads Japanese text aloud with the system voice. Renders nothing where the
 * browser has no speech synthesis, decided after mount so SSR markup matches.
 */
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
  const supported = useSyncExternalStore(
    subscribeToNothing,
    isJapaneseSpeechSupported,
    () => false
  )
  const [speaking, setSpeaking] = useState(false)

  if (!supported) return null

  const handlePress = async () => {
    setSpeaking(true)
    try {
      await speakJapanese(text)
    } catch {
      toast.error(t("japanese.speech.failed"))
    } finally {
      setSpeaking(false)
    }
  }

  return (
    <Button
      aria-label={label ?? t("japanese.speech.playWord", { text })}
      className={cn(speaking && "text-primary", className)}
      onClick={() => {
        void handlePress()
      }}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      <HugeiconsIcon aria-hidden="true" icon={VolumeHighIcon} />
    </Button>
  )
}
