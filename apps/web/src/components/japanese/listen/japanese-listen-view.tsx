import { Button } from "@heroui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { orpc } from "@/utils/orpc"

import type { ListenSource } from "./listen-source-form"
import { ListenSourceForm } from "./listen-source-form"

const PERCENT = 100
const ADD_ERROR_KEYS: Record<string, string> = {
  BAD_REQUEST: "japanese.listen.player.error.embedDisabled",
  NOT_FOUND: "japanese.listen.player.error.unavailable"
}

/** 听读 home: the reader's videos with their progress, plus "add a video". */
export function JapaneseListenView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const materials = useQuery(orpc.listening.list.queryOptions())
  const [isAdding, setIsAdding] = useState(false)

  const create = useMutation(
    orpc.listening.create.mutationOptions({
      onSuccess: async ({ id }) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.listening.key()
        })
        await navigate({
          params: { materialId: id },
          to: "/japanese/listen/$materialId"
        })
      },
      onError: (error) => {
        const code = "code" in error ? error.code : null
        // The form already checks the link and captions, so a server
        // BAD_REQUEST here means the owner blocks embedding.
        const key =
          ADD_ERROR_KEYS[String(code)] ?? "japanese.listen.library.addFailed"
        toast.error(t(key))
      }
    })
  )

  const handleSubmit = (source: ListenSource) => {
    create.mutate({
      url: source.videoId,
      captions: {
        text: source.subtitleText,
        ...(source.fileName ? { fileName: source.fileName } : {})
      }
    })
  }

  const items = materials.data ?? []
  const showForm = isAdding || (materials.isSuccess && items.length === 0)

  return (
    <div className="mx-auto w-full max-w-5xl pb-16">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("japanese.listen.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("japanese.listen.description")}
          </p>
        </div>
        {showForm ? null : (
          <Button onPress={() => setIsAdding(true)} variant="primary">
            {t("japanese.listen.library.add")}
          </Button>
        )}
      </header>

      {showForm ? (
        <div className="mb-8">
          <ListenSourceForm
            isSubmitting={create.isPending}
            onSubmit={handleSubmit}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            {t("japanese.listen.library.captionPolicy")}
          </p>
        </div>
      ) : null}

      {materials.isError ? (
        <p className="text-sm text-muted-foreground" role="alert">
          {t("japanese.listen.library.loadFailed")}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const lineCount = Math.max(item.segmentCount, 1)
            const reached = Math.min(item.lastSegmentIndex + 1, lineCount)
            const percent = item.completedAt
              ? PERCENT
              : Math.round((reached / lineCount) * PERCENT)
            return (
              <li key={item.id}>
                <Link
                  className="flex gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border/60 transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                  params={{ materialId: item.id }}
                  to="/japanese/listen/$materialId"
                >
                  {item.thumbnailUrl ? (
                    <img
                      alt=""
                      className="aspect-video w-32 shrink-0 rounded-xl object-cover"
                      height={72}
                      loading="lazy"
                      src={item.thumbnailUrl}
                      width={128}
                    />
                  ) : (
                    <span className="aspect-video w-32 shrink-0 rounded-xl bg-surface-tertiary" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="line-clamp-2 text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.completedAt
                        ? t("japanese.listen.library.finished")
                        : t("japanese.listen.library.progress", {
                            current: reached,
                            total: item.segmentCount
                          })}
                    </span>
                    <span
                      aria-hidden="true"
                      className="mt-auto h-1 overflow-hidden rounded-full bg-surface-secondary"
                    >
                      <span
                        className="block h-1 rounded-full bg-primary"
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
