import type { SubtitleCue } from "@folionote/utils/subtitles"
import { findActiveCueIndex } from "@folionote/utils/subtitles"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"

import { getBrowserTimeZone } from "@/components/streak/streak-utils"
import { useLearningProgress } from "@/components/streak/use-learning-progress"
import { orpc } from "@/utils/orpc"

import { ListenPlayer } from "./listen-player"

// Saving on every line change would be a request every few seconds; this
// keeps the server within one line of the truth without the chatter.
const PROGRESS_DEBOUNCE_MS = 2500

/** One saved video: resumes at the last line, or at `?t=` from a notebook link. */
export function JapaneseListenMaterial({
  materialId,
  startAtMs
}: {
  materialId: string
  startAtMs?: number
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const onProgress = useLearningProgress()
  const detail = useQuery(
    orpc.listening.get.queryOptions({ input: { id: materialId } })
  )

  const cues = useMemo<SubtitleCue[]>(
    () =>
      (detail.data?.segments ?? []).map((segment) => ({
        index: segment.position,
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.text
      })),
    [detail.data]
  )

  const save = useMutation(
    orpc.listening.progress.mutationOptions({
      onSuccess: ({ progress }) => {
        void queryClient.invalidateQueries({
          queryKey: orpc.listening.list.key()
        })
        if (progress) onProgress(progress)
      },
      // Progress is best-effort; the next line change retries it.
      meta: { silentError: true }
    })
  )
  const { mutate } = save
  const pendingRef = useRef<{ index: number; timer: number } | null>(null)
  const lastIndex = cues.length - 1

  const flush = useCallback(
    (index: number) => {
      mutate({
        id: materialId,
        segmentIndex: index,
        completed: index === lastIndex,
        timeZone: getBrowserTimeZone()
      })
    },
    [lastIndex, materialId, mutate]
  )

  const handleActiveIndexChange = useCallback(
    (index: number) => {
      if (pendingRef.current) window.clearTimeout(pendingRef.current.timer)
      // Reaching the last line is saved at once so the stamp shows right away.
      if (index === lastIndex) {
        pendingRef.current = null
        flush(index)
        return
      }
      pendingRef.current = {
        index,
        timer: window.setTimeout(() => {
          pendingRef.current = null
          flush(index)
        }, PROGRESS_DEBOUNCE_MS)
      }
    },
    [flush, lastIndex]
  )

  // Leaving the page saves the line that was still waiting for the debounce.
  useEffect(
    () => () => {
      const pending = pendingRef.current
      if (!pending) return
      window.clearTimeout(pending.timer)
      flush(pending.index)
    },
    [flush]
  )

  if (detail.isPending) {
    return (
      <p className="mx-auto max-w-5xl text-sm text-muted-foreground">
        {t("japanese.listen.library.loading")}
      </p>
    )
  }
  if (detail.isError) {
    return (
      <div className="mx-auto max-w-5xl text-sm" role="alert">
        <p className="text-muted-foreground">
          {t("japanese.listen.library.notFound")}
        </p>
        <Link className="mt-2 inline-block text-primary" to="/japanese/listen">
          {t("japanese.listen.library.back")}
        </Link>
      </div>
    )
  }

  const { material } = detail.data
  const fromLink =
    startAtMs === undefined ? -1 : findActiveCueIndex(cues, startAtMs)
  const initialIndex = Math.max(
    fromLink >= 0 ? fromLink : material.lastSegmentIndex,
    0
  )

  return (
    <div className="mx-auto w-full max-w-6xl pb-16">
      <ListenPlayer
        cues={cues}
        initialIndex={initialIndex}
        materialId={material.id}
        onActiveIndexChange={handleActiveIndexChange}
        onChangeSource={() => navigate({ to: "/japanese/listen" })}
        title={material.title}
        videoId={material.sourceRef}
      />
    </div>
  )
}
