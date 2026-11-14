import { Search01Icon } from "@hugeicons-pro/core-stroke-rounded"
import { createFileRoute, useSearch } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { PageContainer } from "@/components/page-container"
import { PageHeader } from "@/components/page-header"
import { AdvancedSearch } from "@/components/search"
import type { SearchFiltersValue } from "@/components/search/search-filters"
import { searchQuerySchema } from "@/lib/search-schemas"

export const Route = createFileRoute("/_app/search")({
  component: SearchPage,
  validateSearch: searchQuerySchema
})

function SearchPage() {
  const { t } = useTranslation()
  const { q } = useSearch({ from: "/_app/search" })

  // Parse URL params to filters - only on client side
  const [initialFilters, setInitialFilters] = useState<SearchFiltersValue>({})

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const params = new URLSearchParams(window.location.search)
    const tags = params.get("tags")
    const sources = params.get("sources")
    const from = params.get("from")
    const to = params.get("to")
    const isInbox = params.get("isInbox")
    const isStarred = params.get("isStarred")

    const parsedFilters: SearchFiltersValue = {}

    if (tags) {
      parsedFilters.tagIds = tags.split(",").filter(Boolean)
    }
    if (sources) {
      parsedFilters.sourceIds = sources.split(",").filter(Boolean)
    }
    if (from || to) {
      parsedFilters.dateRange = {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined
      }
    }
    if (isInbox === "true") {
      parsedFilters.isInbox = true
    }
    if (isStarred === "true") {
      parsedFilters.isStarred = true
    }

    setInitialFilters(parsedFilters)
  }, [])

  return (
    <PageContainer width="default">
      <PageHeader
        description={t("search.advancedDescription")}
        icon={Search01Icon}
        title={t("search.advanced")}
      />

      {/* Advanced Search Component */}
      <AdvancedSearch
        initialFilters={initialFilters}
        initialQuery={q}
        showHistory
        showSuggestions
      />
    </PageContainer>
  )
}
