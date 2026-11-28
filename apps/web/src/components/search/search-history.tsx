import { Button } from "@folionote/ui/button"
import {
  Clock04Icon,
  Delete02Icon,
  Search01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { orpc } from "@/utils/orpc"

import type { SearchHistoryFilters, SearchHistoryItem } from "./types"

export type { SearchHistoryFilters } from "./types"

interface SearchHistoryProps {
  onSelect: (query: string, filters?: SearchHistoryFilters | null) => void
  className?: string
  limit?: number
}

export function SearchHistory({
  onSelect,
  className,
  limit = 10
}: SearchHistoryProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: historyData = [], isLoading } = useQuery({
    queryKey: ["search", "history", limit],
    queryFn: () => orpc.search.getHistory.call({ limit })
  })
  const history = historyData as SearchHistoryItem[]

  const deleteAllMutation = useMutation({
    mutationFn: () => orpc.search.deleteHistory.call({ deleteAll: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search", "history"] })
      toast.success(t("search.historyCleared"))
    }
  })

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => orpc.search.deleteHistory.call({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search", "history"] })
    }
  })

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="h-10 animate-pulse rounded-md bg-surface-secondary" />
        <div className="h-10 animate-pulse rounded-md bg-surface-secondary" />
        <div className="h-10 animate-pulse rounded-md bg-surface-secondary" />
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className={cn("py-8 text-center", className)}>
        <HugeiconsIcon
          className="mx-auto mb-2 size-8 text-muted-foreground/50"
          icon={Clock04Icon}
        />
        <p className="text-sm text-muted-foreground">{t("search.noHistory")}</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {t("search.recentSearches")}
        </p>
        <Button
          className="h-auto px-2 py-1 text-xs"
          disabled={deleteAllMutation.isPending}
          onClick={() => deleteAllMutation.mutate()}
          variant="ghost"
        >
          {t("search.clearHistory")}
        </Button>
      </div>
      {history.map((item) => (
        <div
          className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-surface-secondary"
          key={item.id}
        >
          <button
            className="flex flex-1 items-center gap-2 text-left"
            onClick={() => onSelect(item.query, item.filters)}
            type="button"
          >
            <HugeiconsIcon
              className="size-4 shrink-0 text-muted-foreground"
              icon={Search01Icon}
            />
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm">{item.query}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(item.createdAt), {
                  addSuffix: true
                })}
                {item.resultCount !== null &&
                  ` · ${t("search.resultCount", { count: item.resultCount })}`}
              </p>
            </div>
          </button>
          <Button
            className="size-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            disabled={deleteItemMutation.isPending}
            onClick={(e) => {
              e.stopPropagation()
              deleteItemMutation.mutate(item.id)
            }}
            variant="ghost"
          >
            <HugeiconsIcon className="size-3.5" icon={Delete02Icon} />
          </Button>
        </div>
      ))}
    </div>
  )
}
