import { Button, Chip } from "@heroui/react"
import { useTranslation } from "react-i18next"

import type { BrowserEngineState } from "@/lib/japanese/browser-engine"
import {
  DICTIONARY_DOWNLOAD_MB,
  isBrowserAnalyzerReady
} from "@/lib/japanese/browser-engine"

function EngineProgressBar({
  fraction,
  label
}: {
  fraction: number
  label: string
}) {
  const percent = Math.round(fraction * 100)
  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percent}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-secondary"
      role="progressbar"
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

/**
 * Offers the in-browser engine when the server can't analyze, then shows the
 * one-time download / start progress. Renders nothing while the server works.
 */
export function JapaneseBrowserEngineBanner({
  engine,
  onEnable,
  serverUnavailable
}: {
  engine: BrowserEngineState
  onEnable: () => void
  serverUnavailable: boolean
}) {
  const { t } = useTranslation()
  const { progress, status } = engine

  if (status === "downloading" || status === "building") {
    const fraction =
      progress && progress.totalBytes > 0
        ? progress.bytes / progress.totalBytes
        : 0
    const label =
      status === "downloading"
        ? t("japanese.engine.downloading", {
            percent: Math.round(fraction * 100)
          })
        : t("japanese.engine.building")
    return (
      <div
        aria-live="polite"
        className="space-y-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3"
        role="status"
      >
        <p className="text-sm text-foreground">{label}</p>
        {status === "downloading" && (
          <EngineProgressBar fraction={fraction} label={label} />
        )}
      </div>
    )
  }

  if (status === "error") {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/40 px-4 py-3"
        role="alert"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm text-foreground">
            {t("japanese.engine.web.failed")}
          </p>
          {engine.error && (
            <p className="text-xs break-words text-muted-foreground">
              {engine.error}
            </p>
          )}
        </div>
        <Button onPress={onEnable} size="sm" variant="outline">
          {t("japanese.engine.retry")}
        </Button>
      </div>
    )
  }

  if (serverUnavailable && !isBrowserAnalyzerReady()) {
    return (
      <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4">
        <p className="font-medium text-foreground">
          {t("japanese.engine.web.offerTitle")}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {t("japanese.engine.web.offerDescription", {
            size: DICTIONARY_DOWNLOAD_MB
          })}
        </p>
        <Button onPress={onEnable} size="sm" variant="primary">
          {t("japanese.engine.offerAction")}
        </Button>
      </div>
    )
  }
  return null
}

/** Marks sentences that this browser segmented instead of the server. */
export function JapaneseBrowserEngineBadge() {
  const { t } = useTranslation()
  return (
    <Chip color="success" size="sm" variant="soft">
      {t("japanese.engine.web.badge")}
    </Chip>
  )
}
