import { parseSubtitles } from "@folionote/utils/subtitles"
import type { SubtitleCue } from "@folionote/utils/subtitles"
import { parseYouTubeVideoId } from "@folionote/utils/youtube"
import { Button, Input, Label, TextArea, TextField } from "@heroui/react"
import { Upload01Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ChangeEvent } from "react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { ListenVideoPreview } from "./listen-video-preview"

export interface ListenSource {
  videoInput: string
  videoId: string
  subtitleText: string
  cues: SubtitleCue[]
}

const SUBTITLE_FILE_ACCEPT =
  ".srt,.vtt,text/vtt,application/x-subrip,text/plain"
// A two-hour SRT is ~150 KB; anything far larger is almost certainly the wrong file.
const MAX_SUBTITLE_FILE_BYTES = 2 * 1024 * 1024

/**
 * Link + captions intake. Release builds only take captions the user supplies
 * (pasted or uploaded SRT/VTT); we never fetch YouTube's caption tracks here.
 */
export function ListenSourceForm({
  initialVideoInput,
  initialSubtitleText,
  onSubmit
}: {
  initialVideoInput: string
  initialSubtitleText: string
  onSubmit: (source: ListenSource) => void
}) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [videoInput, setVideoInput] = useState(initialVideoInput)
  const [subtitleText, setSubtitleText] = useState(initialSubtitleText)
  const [fileName, setFileName] = useState<string | null>(null)
  const [videoError, setVideoError] = useState(false)
  const [subtitleError, setSubtitleError] = useState<string | null>(null)

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.size > MAX_SUBTITLE_FILE_BYTES) {
      setSubtitleError(t("japanese.listen.source.fileTooLarge"))
      return
    }
    try {
      setSubtitleText(await file.text())
      setFileName(file.name)
      setSubtitleError(null)
    } catch {
      setSubtitleError(t("japanese.listen.source.fileUnreadable"))
    }
  }

  const handleSubmit = () => {
    const videoId = parseYouTubeVideoId(videoInput)
    const cues = parseSubtitles(subtitleText)
    setVideoError(videoId === null)
    setSubtitleError(
      cues.length === 0 ? t("japanese.listen.source.noCues") : null
    )
    if (videoId === null || cues.length === 0) return
    onSubmit({ videoInput: videoInput.trim(), videoId, subtitleText, cues })
  }

  const cueCount = parseSubtitles(subtitleText).length
  const typedVideoId = parseYouTubeVideoId(videoInput)

  return (
    <form
      className="flex flex-col gap-5 rounded-2xl bg-surface p-5 ring-1 ring-border/60 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
    >
      <TextField
        isInvalid={videoError}
        onChange={(value) => {
          setVideoInput(value)
          setVideoError(false)
        }}
        value={videoInput}
      >
        <Label>{t("japanese.listen.source.videoLabel")}</Label>
        <Input
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…"
        />
        {videoError ? (
          <p className="text-xs text-danger" role="alert">
            {t("japanese.listen.source.videoInvalid")}
          </p>
        ) : null}
      </TextField>
      {typedVideoId ? (
        <ListenVideoPreview key={typedVideoId} videoUrl={typedVideoId} />
      ) : null}

      <div className="flex flex-col gap-2">
        <TextField
          isInvalid={subtitleError !== null}
          onChange={(value) => {
            setSubtitleText(value)
            setFileName(null)
            setSubtitleError(null)
          }}
          value={subtitleText}
        >
          <Label>{t("japanese.listen.source.subtitleLabel")}</Label>
          <TextArea
            className="min-h-40 font-mono text-xs"
            placeholder={t("japanese.listen.source.subtitlePlaceholder")}
            spellCheck={false}
          />
        </TextField>
        <div className="flex flex-wrap items-center gap-3">
          <input
            accept={SUBTITLE_FILE_ACCEPT}
            className="sr-only"
            onChange={handleFile}
            ref={fileInputRef}
            tabIndex={-1}
            type="file"
          />
          <Button
            onPress={() => fileInputRef.current?.click()}
            size="sm"
            variant="outline"
          >
            <HugeiconsIcon aria-hidden="true" icon={Upload01Icon} size={16} />
            {t("japanese.listen.source.upload")}
          </Button>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {fileName ? `${fileName} · ` : ""}
            {subtitleText.trim().length > 0
              ? t("japanese.listen.source.cueCount", { count: cueCount })
              : t("japanese.listen.source.subtitleHint")}
          </p>
        </div>
        {subtitleError ? (
          <p className="text-xs text-danger" role="alert">
            {subtitleError}
          </p>
        ) : null}
      </div>

      <div>
        <Button type="submit" variant="primary">
          {t("japanese.listen.source.start")}
        </Button>
      </div>
    </form>
  )
}
