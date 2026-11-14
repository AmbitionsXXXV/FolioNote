import { InboxIcon } from "@hugeicons-pro/core-stroke-rounded"
import { useInfiniteQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { EntryList } from "@/components/entry-list"
import { PageContainer } from "@/components/page-container"
import { PageHeader } from "@/components/page-header"
import { QuickCapture } from "@/components/quick-capture"
import { orpc } from "@/utils/orpc"

export const Route = createFileRoute("/_app/inbox")({
  loader: ({ context: { queryClient } }) => {
    queryClient.ensureInfiniteQueryData({
      queryKey: ["entries", "inbox"],
      queryFn: () => orpc.entries.list.call({ filter: "inbox", limit: 20 }),
      initialPageParam: undefined as string | undefined
    })
  },
  component: InboxPage
})

/**
 * Renders the inbox page with header, quick-capture input, and an infinitely paginated entry list.
 *
 * @returns The page's React element containing the inbox header, QuickCapture input, and EntryList wired to infinite query state
 */
function InboxPage() {
  const { t } = useTranslation()
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
    queryKey: ["entries", "inbox"],
    queryFn: ({ pageParam }) =>
      orpc.entries.list.call({
        filter: "inbox",
        cursor: pageParam,
        limit: 20
      }),
    getNextPageParam: (lastPage) => lastPage?.nextCursor,
    initialPageParam: undefined as string | undefined
  })

  // Flatten all pages into a single array with safe access
  const entries =
    data?.pages?.flatMap((page) => (page?.items ?? []).filter(Boolean)) ?? []

  return (
    <PageContainer>
      <PageHeader
        description={t("entry.quickCapture")}
        icon={InboxIcon}
        title={t("entry.inbox")}
      />

      {/* Quick capture */}
      <div className="mb-8">
        <QuickCapture placeholder={t("entry.placeholder")} />
      </div>

      {/* Entry list */}
      <EntryList
        emptyMessage={t("entry.emptyInbox")}
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
