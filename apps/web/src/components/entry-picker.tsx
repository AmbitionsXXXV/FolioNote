import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@folionote/ui/dialog"
import { Input } from "@folionote/ui/input"
import { Skeleton } from "@folionote/ui/skeleton"
import { FileEditIcon, Search01Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { useImperativeHandle, useState } from "react"
import type { Ref } from "react"
import { useTranslation } from "react-i18next"

import type { Entry } from "@/types"
import { orpc } from "@/utils/orpc"

/**
 * Ref methods for EntryPicker component
 */
export interface EntryPickerRef {
  open: () => void
  close: () => void
}

const formatDate = (date: Entry["updatedAt"]) => {
  const d = new Date(date)
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  })
}

const getPreview = (contentText: string | null | undefined) => {
  if (!contentText) {
    return ""
  }
  const text = contentText.trim()
  return text.length > 50 ? `${text.slice(0, 50)}...` : text
}

interface EntryPickerProps {
  ref?: Ref<EntryPickerRef>
  /** Called when an entry is selected */
  onSelect: (entry: Entry) => void
  /** Entry ID to exclude from the list (e.g., current entry) */
  excludeId?: string
  /** Entry IDs to exclude from the list (e.g., already attached notes) */
  excludeIds?: string[]
  /** Dialog title */
  title?: string
  /** Only show Library entries (isInbox = false) */
  libraryOnly?: boolean
}

/**
 * A dialog component for selecting an entry to reference.
 * Supports search filtering and keyboard navigation.
 */
export function EntryPicker({
  ref,
  onSelect,
  excludeId,
  excludeIds = [],
  title,
  libraryOnly = false
}: EntryPickerProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Build all excluded IDs
  const allExcludedIds = new Set([
    ...(excludeId ? [excludeId] : []),
    ...excludeIds
  ])

  // Fetch entries - use 'all' for normal mode, 'all' with client-side filter for library-only
  // The server 'all' filter returns non-deleted entries
  const { data: entriesData, isLoading } = useQuery({
    queryKey: ["entries", libraryOnly ? "library" : "all", "picker"],
    queryFn: () => orpc.entries.list.call({ filter: "all", limit: 100 }),
    enabled: isOpen
  })

  const entries = (entriesData?.items ?? []) as Entry[]

  // Filter entries by search query, exclude IDs, and optionally library-only
  const filteredEntries = entries.filter((entry) => {
    // Exclude specified IDs
    if (allExcludedIds.has(entry.id)) {
      return false
    }

    // Library-only filter: exclude inbox entries
    if (libraryOnly && entry.isInbox) {
      return false
    }

    // Search query filter
    if (!searchQuery.trim()) {
      return true
    }

    const query = searchQuery.toLowerCase()
    const titleMatch = entry.title?.toLowerCase().includes(query)
    const contentMatch = entry.contentText?.toLowerCase().includes(query)

    return titleMatch || contentMatch
  })

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    open: () => {
      setIsOpen(true)
      setSearchQuery("")
    },
    close: () => setIsOpen(false)
  }))

  const handleSelect = (entry: Entry) => {
    onSelect(entry)
    setIsOpen(false)
    setSearchQuery("")
  }

  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title || t("entryPicker.selectEntry")}</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <HugeiconsIcon
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            icon={Search01Icon}
          />
          <Input
            autoFocus
            className="pl-9"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("entryPicker.searchPlaceholder")}
            value={searchQuery}
          />
        </div>

        {/* Entries list */}
        <div className="max-h-80 overflow-y-auto">
          {(() => {
            if (isLoading) {
              return (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-16 rounded-lg bg-surface-secondary" />
                  <Skeleton className="h-16 rounded-lg bg-surface-secondary" />
                  <Skeleton className="h-16 rounded-lg bg-surface-secondary" />
                </div>
              )
            }

            if (filteredEntries.length > 0) {
              return (
                <div className="space-y-1">
                  {filteredEntries.map((entry) => (
                    <button
                      className="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-surface-secondary"
                      key={entry.id}
                      onClick={() => handleSelect(entry)}
                      type="button"
                    >
                      <HugeiconsIcon
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        icon={FileEditIcon}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {entry.title || t("entryPicker.untitled")}
                        </p>
                        {entry.contentText ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {getPreview(entry.contentText)}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(entry.updatedAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )
            }

            return (
              <div className="py-8 text-center text-muted-foreground">
                {searchQuery ? (
                  <p>{t("entryPicker.noMatchingEntries")}</p>
                ) : (
                  <p>{t("entryPicker.noEntriesAvailable")}</p>
                )}
              </div>
            )
          })()}
        </div>
      </DialogContent>
    </Dialog>
  )
}
