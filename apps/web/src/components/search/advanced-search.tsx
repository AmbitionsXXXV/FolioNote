import { Button } from "@folionote/ui/button"
import { Input } from "@folionote/ui/input"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient
} from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { EntryList } from "@/components/entry-list"
import { Reveal } from "@/components/reveal"
import { Surface } from "@/components/surface"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"
import type { Entry } from "@/types"
import { orpc } from "@/utils/orpc"

import { ActiveFilterBadges, SearchFilters } from "./search-filters"
import { SearchHistory } from "./search-history"
import { SearchSuggestions } from "./search-suggestions"
import type { SearchFiltersValue, SearchHistoryFilters } from "./types"

export type { SearchFiltersValue } from "./types"

/**
 * Build URL search params from query and filters
 */
function buildSearchParams(
  query: string,
  filters: SearchFiltersValue
): URLSearchParams {
  const params = new URLSearchParams()
  if (query) {
    params.set("q", query)
  }
  if (filters.tagIds?.length) {
    params.set("tags", filters.tagIds.join(","))
  }
  if (filters.sourceIds?.length) {
    params.set("sources", filters.sourceIds.join(","))
  }
  if (filters.dateRange?.from) {
    params.set("from", filters.dateRange.from.toISOString())
  }
  if (filters.dateRange?.to) {
    params.set("to", filters.dateRange.to.toISOString())
  }
  if (filters.isInbox) {
    params.set("isInbox", "true")
  }
  if (filters.isStarred) {
    params.set("isStarred", "true")
  }
  return params
}

const EMPTY_FILTERS: SearchFiltersValue = {}

interface AdvancedSearchProps {
  initialQuery?: string
  initialFilters?: SearchFiltersValue
  onSearch?: (query: string, filters: SearchFiltersValue) => void
  showHistory?: boolean
  showSuggestions?: boolean
  className?: string
}

// Type for the API response
interface AdvancedSearchResponse {
  items: Entry[]
  nextCursor?: string
  hasMore: boolean
  query: string
  filters: {
    tagIds?: string[]
    sourceIds?: string[]
    dateRange?: { from?: Date; to?: Date }
    isInbox?: boolean
    isStarred?: boolean
  }
  usedFts: boolean
}

export function AdvancedSearch({
  initialQuery = "",
  initialFilters = EMPTY_FILTERS,
  onSearch,
  showHistory = true,
  showSuggestions = true,
  className
}: AdvancedSearchProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState(initialQuery)
  const [filters, setFilters] = useState<SearchFiltersValue>(initialFilters)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  // Sync filters when initialFilters prop changes (e.g., from URL parsing)
  useEffect(() => {
    if (Object.keys(initialFilters).length > 0) {
      setFilters(initialFilters)
    }
  }, [initialFilters])

  // Determine if we should show the dropdown (history/suggestions)
  const showDropdown =
    isInputFocused && query.length === 0 && (showHistory || showSuggestions)

  // Check if any search criteria is active
  const hasSearchCriteria = Boolean(
    debouncedQuery.length > 0 ||
    (filters.tagIds && filters.tagIds.length > 0) ||
    (filters.sourceIds && filters.sourceIds.length > 0) ||
    filters.dateRange?.from ||
    filters.dateRange?.to ||
    filters.isInbox ||
    filters.isStarred
  )

  // Perform advanced search
  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch
  } = useInfiniteQuery<AdvancedSearchResponse>({
    queryKey: ["search", "advanced", debouncedQuery, filters],
    queryFn: ({ pageParam }) =>
      orpc.search.advanced.call({
        query: debouncedQuery || undefined,
        tagIds: filters.tagIds,
        sourceIds: filters.sourceIds,
        dateRange: filters.dateRange
          ? {
              from: filters.dateRange.from,
              to: filters.dateRange.to
            }
          : undefined,
        isInbox: filters.isInbox,
        isStarred: filters.isStarred,
        cursor: pageParam as string | undefined,
        limit: 20,
        saveToHistory: false // We save manually on form submit
      }) as Promise<AdvancedSearchResponse>,
    getNextPageParam: (lastPage) => lastPage?.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: hasSearchCriteria
  })

  // Save search to history mutation
  const saveHistoryMutation = useMutation({
    mutationFn: (params: { query: string; resultCount: number }) =>
      orpc.search.saveHistory.call({
        query: params.query,
        filters: {
          tagIds: filters.tagIds,
          sourceIds: filters.sourceIds,
          dateRange: filters.dateRange
            ? {
                from: filters.dateRange.from,
                to: filters.dateRange.to
              }
            : undefined,
          isInbox: filters.isInbox,
          isStarred: filters.isStarred
        },
        resultCount: params.resultCount
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search", "history"] })
    }
  })

  const entries =
    data?.pages?.flatMap((page) => (page?.items ?? []).filter(Boolean)) ?? []

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setIsInputFocused(false)

      if (query.trim()) {
        // Save to history
        saveHistoryMutation.mutate({
          query: query.trim(),
          resultCount: entries.length
        })
      }

      onSearch?.(query, filters)
    },
    [query, filters, entries.length, saveHistoryMutation, onSearch]
  )

  // Handle suggestion/history selection
  const handleSelectSuggestion = useCallback(
    (selectedQuery: string, selectedFilters?: SearchHistoryFilters | null) => {
      setQuery(selectedQuery)
      if (selectedFilters) {
        // Parse date strings back to Date objects if present
        const parsedFilters: SearchFiltersValue = {
          tagIds: selectedFilters.tagIds,
          sourceIds: selectedFilters.sourceIds,
          isInbox: selectedFilters.isInbox,
          isStarred: selectedFilters.isStarred,
          dateRange: selectedFilters.dateRange
            ? {
                from: selectedFilters.dateRange.from
                  ? new Date(selectedFilters.dateRange.from)
                  : undefined,
                to: selectedFilters.dateRange.to
                  ? new Date(selectedFilters.dateRange.to)
                  : undefined
              }
            : undefined
        }
        setFilters(parsedFilters)
      }
      setIsInputFocused(false)
      inputRef.current?.blur()
    },
    []
  )

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: SearchFiltersValue) => {
    setFilters(newFilters)
  }, [])

  // Handle entry click - navigate to entry
  const handleEntryClick = useCallback(
    (entryId: string) => {
      navigate({ to: "/entries/$id", params: { id: entryId } })
    },
    [navigate]
  )

  // Update URL when search changes (if onSearch not provided)
  useEffect(() => {
    if (typeof window === "undefined" || onSearch) {
      return
    }
    if (!hasSearchCriteria) {
      return
    }

    const params = buildSearchParams(debouncedQuery, filters)
    window.history.replaceState(null, "", `?${params.toString()}`)
  }, [debouncedQuery, filters, onSearch, hasSearchCriteria])

  // Wrap entries to match Entry type with click handler
  const entriesWithClick = entries.map((entry) => ({
    ...entry,
    onClick: () => handleEntryClick(entry.id)
  }))

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search form */}
      <Surface className="p-4">
        <form onSubmit={handleSubmit}>
          <div className="flex gap-2">
            <div className="relative flex-1 rounded-md transition-shadow focus-within:ring-2 focus-within:ring-primary/30">
              <HugeiconsIcon
                className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
                icon={Search01Icon}
              />
              <Input
                className="pl-10"
                onBlur={() => {
                  // Delay to allow click on dropdown items
                  setTimeout(() => setIsInputFocused(false), 200)
                }}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                placeholder={t("search.placeholder")}
                ref={inputRef}
                type="search"
                value={query}
              />

              {/* Dropdown for history and suggestions */}
              {showDropdown && (
                <div className="absolute top-full right-0 left-0 z-50 mt-1 rounded-md border bg-popover p-3 shadow-md">
                  {showSuggestions && (
                    <SearchSuggestions
                      className="mb-4"
                      onSelect={(s) => handleSelectSuggestion(s)}
                      query=""
                    />
                  )}
                  {showHistory && (
                    <SearchHistory onSelect={handleSelectSuggestion} />
                  )}
                </div>
              )}
            </div>
            <SearchFilters onChange={handleFiltersChange} value={filters} />
            <Button type="submit">{t("common.search")}</Button>
          </div>
        </form>

        {/* Active filters display */}
        <ActiveFilterBadges
          className="mt-3"
          onChange={handleFiltersChange}
          value={filters}
        />
      </Surface>

      {/* Search results */}
      {hasSearchCriteria ? (
        <Reveal className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {(() => {
              if (isLoading) {
                return t("common.loading")
              }
              if (isError) {
                return t("common.error")
              }
              return t("search.resultCount", { count: entries.length })
            })()}
          </p>
          <EntryList
            emptyMessage={t("search.noResults")}
            entries={entriesWithClick}
            errorMessage={
              isError ? (error?.message ?? t("common.unknownError")) : undefined
            }
            hasMore={hasNextPage}
            isLoading={isLoading}
            isLoadingMore={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
            onRetry={refetch}
          />
        </Reveal>
      ) : (
        <Reveal className="flex flex-col items-center justify-center py-16 text-center">
          <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
            <HugeiconsIcon
              className="size-7 text-primary"
              icon={Search01Icon}
            />
          </span>
          <p className="mb-2 font-display font-semibold text-muted-foreground">
            {t("search.advanced")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("search.placeholder")}
          </p>
        </Reveal>
      )}
    </div>
  )
}
