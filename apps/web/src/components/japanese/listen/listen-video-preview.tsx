import { formatCueTime } from "@folionote/utils/subtitles"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { orpc } from "@/utils/orpc"

const MS_PER_SECOND = 1000

/** Title / channel / thumbnail card for the link being entered, from the server. */
export function ListenVideoPreview({ videoUrl }: { videoUrl: string }) {
  const { t } = useTranslation()
  const info = useQuery({
    ...orpc.youtube.videoInfo.queryOptions({ input: { url: videoUrl } }),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    // The inline card explains failures; no global toast.
    meta: { silentError: true }
  })

  if (info.isPending) {
    return (
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {t("japanese.listen.source.previewLoading")}
      </p>
    )
  }
  if (info.isError) {
    return (
      <p className="text-xs text-muted-foreground" role="status">
        {t("japanese.listen.source.previewUnavailable")}
      </p>
    )
  }

  const video = info.data
  return (
    <div className="flex gap-3 rounded-xl bg-surface-secondary p-3">
      {video.thumbnailUrl ? (
        <img
          alt=""
          className="aspect-video w-28 shrink-0 rounded-lg object-cover"
          height={63}
          src={video.thumbnailUrl}
          width={112}
        />
      ) : null}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="line-clamp-2 text-sm font-medium">{video.title}</p>
        <p className="text-xs text-muted-foreground">
          {[
            video.channelTitle,
            video.durationSeconds === null
              ? null
              : formatCueTime(video.durationSeconds * MS_PER_SECOND)
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {video.embeddable === false ? (
          <p className="text-xs text-danger" role="alert">
            {t("japanese.listen.player.error.embedDisabled")}
          </p>
        ) : null}
      </div>
    </div>
  )
}
