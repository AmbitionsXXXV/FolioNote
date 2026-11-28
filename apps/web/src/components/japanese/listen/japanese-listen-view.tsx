import { parseSubtitles } from "@folionote/utils/subtitles"
import { parseYouTubeVideoId } from "@folionote/utils/youtube"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { ListenPlayer } from "./listen-player"
import type { ListenSource } from "./listen-source-form"
import { ListenSourceForm } from "./listen-source-form"

// Per-browser convenience only: reopening the page resumes the last video.
// Saved materials move to the database in the MVP.
const LAST_SOURCE_STORAGE_KEY = "folionote:japanese-listen:last-source"

interface StoredSource {
  videoInput: string
  subtitleText: string
}

const readStoredSource = (): StoredSource | null => {
  try {
    const raw = window.localStorage.getItem(LAST_SOURCE_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "videoInput" in parsed &&
      "subtitleText" in parsed &&
      typeof parsed.videoInput === "string" &&
      typeof parsed.subtitleText === "string"
    ) {
      return {
        videoInput: parsed.videoInput,
        subtitleText: parsed.subtitleText
      }
    }
  } catch {
    // Storage blocked or corrupted: start from an empty form.
  }
  return null
}

const writeStoredSource = (source: StoredSource) => {
  try {
    window.localStorage.setItem(LAST_SOURCE_STORAGE_KEY, JSON.stringify(source))
  } catch {
    // Quota or private mode; resuming is optional.
  }
}

/** YouTube 听读 prototype: paste a link + captions, then listen line by line. */
export function JapaneseListenView() {
  const { t } = useTranslation()
  const [stored, setStored] = useState<StoredSource | null>(null)
  const [hasReadStorage, setHasReadStorage] = useState(false)
  const [source, setSource] = useState<ListenSource | null>(null)

  // localStorage only exists in the browser; read it after hydration.
  useEffect(() => {
    const saved = readStoredSource()
    setStored(saved)
    setHasReadStorage(true)
    if (!saved) return
    const videoId = parseYouTubeVideoId(saved.videoInput)
    const cues = parseSubtitles(saved.subtitleText)
    if (videoId && cues.length > 0) {
      setSource({ ...saved, videoId, cues })
    }
  }, [])

  const handleSubmit = (next: ListenSource) => {
    writeStoredSource({
      videoInput: next.videoInput,
      subtitleText: next.subtitleText
    })
    setStored({ videoInput: next.videoInput, subtitleText: next.subtitleText })
    setSource(next)
  }

  return (
    <div className="mx-auto w-full max-w-5xl pb-16">
      <header className="mb-6 border-b border-border/60 pb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t("japanese.listen.title")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("japanese.listen.description")}
        </p>
      </header>

      {source ? (
        <ListenPlayer
          cues={source.cues}
          key={`${source.videoId}:${source.subtitleText.length}`}
          onChangeSource={() => setSource(null)}
          videoId={source.videoId}
        />
      ) : null}
      {!source && hasReadStorage ? (
        <ListenSourceForm
          initialSubtitleText={stored?.subtitleText ?? ""}
          initialVideoInput={stored?.videoInput ?? ""}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  )
}
