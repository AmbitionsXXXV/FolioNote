import { Button } from "@folionote/ui/button"
import {
  Add01Icon,
  BookOpen01Icon,
  StarIcon
} from "@hugeicons-pro/core-stroke-rounded"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useSearch } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { EntryList } from "@/components/entry-list"
import { PageContainer } from "@/components/page-container"
import { PageHeader } from "@/components/page-header"
import { orpc } from "@/utils/orpc"

type FilterType = "all" | "starred" | "pinned"

/**
 * Library page URL params schema
 * - tagId: Optional tag filter from tags page navigation
 */
const librarySearchSchema = z.object({
  tagId: z.string().optional()
})

export type LibrarySearchParams = z.infer<typeof librarySearchSchema>

const filters: {
  key: FilterType
  labelKey: string
  icon?: IconSvgElement
}[] = [
  { key: "all", labelKey: "review.allItems" },
  { key: "starred", labelKey: "entry.starred", icon: StarIcon }
]

export const Route = createFileRoute("/_app/library")({
  validateSearch: librarySearchSchema,
  loader: ({ context: { queryClient } }) => {
    queryClient.ensureInfiniteQueryData({
      queryKey: ["entries", "library", "all", undefined],
      queryFn: () => orpc.entries.list.call({ filter: "all", limit: 20 }),
      initialPageParam: undefined as string | undefined
    })
  },
  component: LibraryPage
})

/**
 * Display the library view with a header, filter tabs, and a paginated list of user entries.
 *
 * Supports switching between filters (e.g., all, starred) and loading additional pages of entries;
 * shows an appropriate empty-state message per active filter.
 * Also supports filtering by tagId from URL search params.
 *
 * @returns The React element for the library page UI.
 */
function LibraryPage() {
  const { t } = useTranslation()
  const { tagId } = useSearch({ from: "/_app/library" })
  const [filter, setFilter] = useState<FilterType>("all")

  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ["entries", "library", filter, tagId],
    queryFn: ({ pageParam }) =>
      orpc.entries.list.call({
        filter: filter === "all" ? "all" : filter,
        tagId,
        cursor: pageParam,
        limit: 20
      }),
    getNextPageParam: (lastPage) => lastPage?.nextCursor,
    initialPageParam: undefined as string | undefined
  })

  // Flatten all pages and filter out inbox entries for 'all' filter with safe access
  const allEntries =
    data?.pages?.flatMap((page) => (page?.items ?? []).filter(Boolean)) ?? []
  const entries =
    filter === "all" ? allEntries.filter((e) => !e.isInbox) : allEntries

  return (
    <PageContainer>
      <PageHeader
        actions={
          <Link to="/entries/new">
            <Button>
              <HugeiconsIcon className="mr-2 size-4" icon={Add01Icon} />
              {t("entry.newEntry")}
            </Button>
          </Link>
        }
        description={t("entry.emptyLibrary")}
        icon={BookOpen01Icon}
        title={t("entry.library")}
      />

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2">
        {filters.map(({ key, labelKey, icon }) => (
          <Button
            className="rounded-lg"
            key={key}
            onClick={() => setFilter(key)}
            size="sm"
            variant={filter === key ? "default" : "outline"}
          >
            {icon ? (
              <HugeiconsIcon className="mr-1 size-4" icon={icon} />
            ) : null}
            {t(labelKey)}
          </Button>
        ))}
      </div>

      {/* Entry list */}
      <EntryList
        emptyMessage={t("entry.emptyLibrary")}
        entries={entries}
        errorMessage={
          isError ? (error?.message ?? t("common.unknownError")) : undefined
        }
        hasMore={hasNextPage}
        isLoading={isLoading}
        isLoadingMore={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        onRetry={refetch}
      />
    </PageContainer>
  )
}
