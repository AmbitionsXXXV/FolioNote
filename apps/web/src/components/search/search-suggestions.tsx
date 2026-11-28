import { Search01Icon, StarIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { orpc } from "@/utils/orpc"

import type { SearchSuggestion } from "./types"

interface SearchSuggestionsProps {
  query: string
  onSelect: (suggestion: string) => void
  className?: string
  limit?: number
}

export function SearchSuggestions({
  query,
  onSelect,
  className,
  limit = 5
}: SearchSuggestionsProps) {
  const { t } = useTranslation()

  const { data: suggestionsData = [], isLoading } = useQuery({
    queryKey: ["search", "suggestions", query, limit],
    queryFn: () =>
      orpc.search.getSuggestions.call({
        query: query || undefined,
        limit
      }),
    enabled: true
  })
  const suggestions = suggestionsData as SearchSuggestion[]

  if (isLoading || suggestions.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-1", className)}>
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        {query ? t("search.suggestions") : t("search.popularSearches")}
      </p>
      {suggestions.map((suggestion) => (
        <button
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-surface-secondary"
          key={suggestion.query}
          onClick={() => onSelect(suggestion.query)}
          type="button"
        >
          <HugeiconsIcon
            className="size-4 shrink-0 text-muted-foreground"
            icon={query ? Search01Icon : StarIcon}
          />
          <span className="flex-1 truncate text-sm">{suggestion.query}</span>
          {suggestion.count > 1 && (
            <span className="text-xs text-muted-foreground">
              {suggestion.count}x
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
