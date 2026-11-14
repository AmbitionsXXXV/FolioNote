import { Badge } from "@folionote/ui/badge"
import { Button } from "@folionote/ui/button"
import { Calendar } from "@folionote/ui/calendar"
import { Checkbox } from "@folionote/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@folionote/ui/popover"
import { Separator } from "@folionote/ui/separator"
import {
  Calendar03Icon,
  Cancel01Icon,
  FilterIcon,
  Link01Icon,
  Tag01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useId, useState } from "react"
import type { DateRange } from "react-day-picker"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { orpc } from "@/utils/orpc"

import type { SearchFiltersValue, Source, Tag } from "./types"

export type { SearchFiltersValue } from "./types"

interface SearchFiltersProps {
  value: SearchFiltersValue
  onChange: (filters: SearchFiltersValue) => void
  className?: string
}

interface TagFilterSectionProps {
  tags: Tag[]
  selectedTagIds: string[]
  onToggle: (tagId: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
}

function TagFilterSection({
  tags,
  selectedTagIds,
  onToggle,
  isExpanded,
  onToggleExpand
}: TagFilterSectionProps) {
  const { t } = useTranslation()
  const selectedCount = tags.filter((tag) =>
    selectedTagIds.includes(tag.id)
  ).length

  return (
    <div className="p-3">
      <button
        className="flex w-full items-center justify-between rounded-lg font-display text-sm font-medium tracking-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        onClick={onToggleExpand}
        type="button"
      >
        <span className="flex items-center gap-2">
          <HugeiconsIcon className="size-4 text-primary" icon={Tag01Icon} />
          {t("search.filterByTags")}
        </span>
        {selectedCount > 0 && (
          <Badge
            className="border-primary/15 bg-primary/10 text-xs text-primary"
            variant="secondary"
          >
            {selectedCount}
          </Badge>
        )}
      </button>
      {isExpanded && (
        <div className="mt-2 no-scrollbar max-h-32 space-y-1 overflow-y-auto">
          {tags.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              {t("tag.noTags")}
            </p>
          ) : (
            tags.map((tag) => (
              <div
                aria-checked={selectedTagIds.includes(tag.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/30",
                  selectedTagIds.includes(tag.id) && "bg-primary/10"
                )}
                key={tag.id}
                onClick={() => onToggle(tag.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onToggle(tag.id)
                  }
                }}
                role="checkbox"
                tabIndex={0}
              >
                <Checkbox
                  checked={selectedTagIds.includes(tag.id)}
                  onCheckedChange={() => onToggle(tag.id)}
                  tabIndex={-1}
                />
                {tag.color ? (
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                ) : (
                  <HugeiconsIcon
                    className="size-3 text-muted-foreground"
                    icon={Tag01Icon}
                  />
                )}
                <span className="text-sm">{tag.name}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

interface SourceFilterSectionProps {
  sources: Source[]
  selectedSourceIds: string[]
  onToggle: (sourceId: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
}

function SourceFilterSection({
  sources,
  selectedSourceIds,
  onToggle,
  isExpanded,
  onToggleExpand
}: SourceFilterSectionProps) {
  const { t } = useTranslation()
  const selectedCount = sources.filter((source) =>
    selectedSourceIds.includes(source.id)
  ).length

  return (
    <div className="p-3">
      <button
        className="flex w-full items-center justify-between rounded-lg font-display text-sm font-medium tracking-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        onClick={onToggleExpand}
        type="button"
      >
        <span className="flex items-center gap-2">
          <HugeiconsIcon className="size-4 text-primary" icon={Link01Icon} />
          {t("search.filterBySources")}
        </span>
        {selectedCount > 0 && (
          <Badge
            className="border-primary/15 bg-primary/10 text-xs text-primary"
            variant="secondary"
          >
            {selectedCount}
          </Badge>
        )}
      </button>
      {isExpanded && (
        <div className="mt-2 no-scrollbar max-h-32 space-y-1 overflow-y-auto">
          {sources.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              {t("source.noSources")}
            </p>
          ) : (
            sources.map((source) => (
              <div
                aria-checked={selectedSourceIds.includes(source.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/30",
                  selectedSourceIds.includes(source.id) && "bg-primary/10"
                )}
                key={source.id}
                onClick={() => onToggle(source.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onToggle(source.id)
                  }
                }}
                role="checkbox"
                tabIndex={0}
              >
                <Checkbox
                  checked={selectedSourceIds.includes(source.id)}
                  onCheckedChange={() => onToggle(source.id)}
                  tabIndex={-1}
                />
                <HugeiconsIcon
                  className="size-3 text-muted-foreground"
                  icon={Link01Icon}
                />
                <span className="line-clamp-1 text-sm">{source.title}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

interface DateRangeFilterSectionProps {
  dateRange?: { from?: Date; to?: Date }
  onChange: (range: DateRange | undefined) => void
  isExpanded: boolean
  onToggleExpand: () => void
}

function DateRangeFilterSection({
  dateRange,
  onChange,
  isExpanded,
  onToggleExpand
}: DateRangeFilterSectionProps) {
  const { t } = useTranslation()
  const hasDateRange = dateRange?.from || dateRange?.to

  return (
    <div className="p-3">
      <button
        className="flex w-full items-center justify-between rounded-lg font-display text-sm font-medium tracking-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        onClick={onToggleExpand}
        type="button"
      >
        <span className="flex items-center gap-2">
          <HugeiconsIcon
            className="size-4 text-primary"
            icon={Calendar03Icon}
          />
          {t("search.dateRange")}
        </span>
        {hasDateRange && (
          <Badge
            className="border-primary/15 bg-primary/10 text-xs text-primary"
            variant="secondary"
          >
            {dateRange.from?.toLocaleDateString()}
            {dateRange.to && ` - ${dateRange.to.toLocaleDateString()}`}
          </Badge>
        )}
      </button>
      {isExpanded && (
        <div className="mt-2">
          <Calendar
            className="rounded-md border"
            mode="range"
            onSelect={onChange}
            selected={{
              from: dateRange?.from,
              to: dateRange?.to
            }}
          />
        </div>
      )}
    </div>
  )
}

export function SearchFilters({
  value,
  onChange,
  className
}: SearchFiltersProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [showTagList, setShowTagList] = useState(false)
  const [showSourceList, setShowSourceList] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const inboxCheckboxId = useId()
  const starredCheckboxId = useId()

  // Fetch tags - API returns array directly
  const { data: tagsData = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => orpc.tags.list.call({})
  })
  const tags = tagsData as Tag[]

  // Fetch sources - API returns paginated response
  const { data: sourcesData } = useQuery({
    queryKey: ["sources"],
    queryFn: () => orpc.sources.list.call({})
  })
  const sources = (sourcesData?.items ?? []) as Source[]

  const handleTagToggle = useCallback(
    (tagId: string) => {
      const currentTagIds = value.tagIds ?? []
      const newTagIds = currentTagIds.includes(tagId)
        ? currentTagIds.filter((id) => id !== tagId)
        : [...currentTagIds, tagId]
      onChange({
        ...value,
        tagIds: newTagIds.length > 0 ? newTagIds : undefined
      })
    },
    [value, onChange]
  )

  const handleSourceToggle = useCallback(
    (sourceId: string) => {
      const currentSourceIds = value.sourceIds ?? []
      const newSourceIds = currentSourceIds.includes(sourceId)
        ? currentSourceIds.filter((id) => id !== sourceId)
        : [...currentSourceIds, sourceId]
      onChange({
        ...value,
        sourceIds: newSourceIds.length > 0 ? newSourceIds : undefined
      })
    },
    [value, onChange]
  )

  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      if (!range) {
        onChange({ ...value, dateRange: undefined })
        return
      }
      onChange({
        ...value,
        dateRange: { from: range.from, to: range.to }
      })
    },
    [value, onChange]
  )

  const handleInboxToggle = useCallback(
    (checked: boolean | "indeterminate") => {
      onChange({ ...value, isInbox: checked === true ? true : undefined })
    },
    [value, onChange]
  )

  const handleStarredToggle = useCallback(
    (checked: boolean | "indeterminate") => {
      onChange({ ...value, isStarred: checked === true ? true : undefined })
    },
    [value, onChange]
  )

  const handleClearFilters = useCallback(() => {
    onChange({})
  }, [onChange])

  const activeFilterCount =
    (value.tagIds?.length ?? 0) +
    (value.sourceIds?.length ?? 0) +
    (value.dateRange?.from || value.dateRange?.to ? 1 : 0) +
    (value.isInbox ? 1 : 0) +
    (value.isStarred ? 1 : 0)

  return (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <PopoverTrigger
        render={
          <Button
            className={cn("gap-2", className)}
            variant={activeFilterCount > 0 ? "secondary" : "outline"}
          />
        }
      >
        <HugeiconsIcon className="size-4" icon={FilterIcon} />
        <span>{t("search.filters")}</span>
        {activeFilterCount > 0 && (
          <Badge
            className="ml-1 border-primary/15 bg-primary/10 px-1.5 py-0 text-xs text-primary"
            variant="secondary"
          >
            {activeFilterCount}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 rounded-3xl border border-border/60 bg-card/70 p-0 shadow-sm backdrop-blur-sm"
      >
        <div className="no-scrollbar max-h-96 overflow-y-auto">
          <TagFilterSection
            isExpanded={showTagList}
            onToggle={handleTagToggle}
            onToggleExpand={() => setShowTagList(!showTagList)}
            selectedTagIds={value.tagIds ?? []}
            tags={tags}
          />

          <Separator />

          <SourceFilterSection
            isExpanded={showSourceList}
            onToggle={handleSourceToggle}
            onToggleExpand={() => setShowSourceList(!showSourceList)}
            selectedSourceIds={value.sourceIds ?? []}
            sources={sources}
          />

          <Separator />

          <DateRangeFilterSection
            dateRange={value.dateRange}
            isExpanded={showDatePicker}
            onChange={handleDateRangeChange}
            onToggleExpand={() => setShowDatePicker(!showDatePicker)}
          />

          <Separator />

          {/* Quick filters */}
          <div className="p-3">
            <p className="mb-2 font-display text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("common.other")}
            </p>
            <div className="space-y-2">
              <div className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={value.isInbox ?? false}
                  id={inboxCheckboxId}
                  onCheckedChange={handleInboxToggle}
                />
                <label
                  className="cursor-pointer text-sm"
                  htmlFor={inboxCheckboxId}
                >
                  {t("entry.inbox")}
                </label>
              </div>
              <div className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={value.isStarred ?? false}
                  id={starredCheckboxId}
                  onCheckedChange={handleStarredToggle}
                />
                <label
                  className="cursor-pointer text-sm"
                  htmlFor={starredCheckboxId}
                >
                  {t("entry.starred")}
                </label>
              </div>
            </div>
          </div>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <>
              <Separator />
              <div className="p-3">
                <Button
                  className="w-full gap-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  onClick={handleClearFilters}
                  variant="ghost"
                >
                  <HugeiconsIcon className="size-4" icon={Cancel01Icon} />
                  {t("search.clearFilters")}
                </Button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Component to display active filter badges that can be removed
 */
export function ActiveFilterBadges({
  value,
  onChange,
  className
}: SearchFiltersProps) {
  const { t } = useTranslation()

  // Fetch tags - API returns array directly
  const { data: tagsData = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => orpc.tags.list.call({})
  })
  const tags = tagsData as Tag[]

  // Fetch sources - API returns paginated response
  const { data: sourcesData } = useQuery({
    queryKey: ["sources"],
    queryFn: () => orpc.sources.list.call({})
  })
  const sources = (sourcesData?.items ?? []) as Source[]

  const selectedTags = tags.filter((tag) => value.tagIds?.includes(tag.id))
  const selectedSources = sources.filter((source) =>
    value.sourceIds?.includes(source.id)
  )

  const handleRemoveTag = (tagId: string) => {
    const newTagIds = value.tagIds?.filter((id) => id !== tagId)
    onChange({ ...value, tagIds: newTagIds?.length ? newTagIds : undefined })
  }

  const handleRemoveSource = (sourceId: string) => {
    const newSourceIds = value.sourceIds?.filter((id) => id !== sourceId)
    onChange({
      ...value,
      sourceIds: newSourceIds?.length ? newSourceIds : undefined
    })
  }

  const handleRemoveDateRange = () => {
    onChange({ ...value, dateRange: undefined })
  }

  const handleRemoveInbox = () => {
    onChange({ ...value, isInbox: undefined })
  }

  const handleRemoveStarred = () => {
    onChange({ ...value, isStarred: undefined })
  }

  const hasAnyFilter =
    selectedTags.length > 0 ||
    selectedSources.length > 0 ||
    value.dateRange?.from ||
    value.dateRange?.to ||
    value.isInbox ||
    value.isStarred

  if (!hasAnyFilter) {
    return null
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {selectedTags.map((tag) => (
        <Badge
          className="gap-1 border-primary/15 bg-primary/10 pr-1 text-primary"
          key={tag.id}
          variant="secondary"
        >
          <HugeiconsIcon className="size-3" icon={Tag01Icon} />
          {tag.name}
          <button
            className="ml-1 rounded-full p-0.5 transition-colors outline-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/30"
            onClick={() => handleRemoveTag(tag.id)}
            type="button"
          >
            <HugeiconsIcon className="size-3" icon={Cancel01Icon} />
          </button>
        </Badge>
      ))}
      {selectedSources.map((source) => (
        <Badge
          className="gap-1 border-primary/15 bg-primary/10 pr-1 text-primary"
          key={source.id}
          variant="secondary"
        >
          <HugeiconsIcon className="size-3" icon={Link01Icon} />
          <span className="max-w-24 truncate">{source.title}</span>
          <button
            className="ml-1 rounded-full p-0.5 transition-colors outline-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/30"
            onClick={() => handleRemoveSource(source.id)}
            type="button"
          >
            <HugeiconsIcon className="size-3" icon={Cancel01Icon} />
          </button>
        </Badge>
      ))}
      {(value.dateRange?.from || value.dateRange?.to) && (
        <Badge
          className="gap-1 border-primary/15 bg-primary/10 pr-1 text-primary"
          variant="secondary"
        >
          <HugeiconsIcon className="size-3" icon={Calendar03Icon} />
          {value.dateRange.from?.toLocaleDateString()}
          {value.dateRange.to &&
            ` - ${value.dateRange.to.toLocaleDateString()}`}
          <button
            className="ml-1 rounded-full p-0.5 transition-colors outline-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/30"
            onClick={handleRemoveDateRange}
            type="button"
          >
            <HugeiconsIcon className="size-3" icon={Cancel01Icon} />
          </button>
        </Badge>
      )}
      {value.isInbox && (
        <Badge
          className="gap-1 border-primary/15 bg-primary/10 pr-1 text-primary"
          variant="secondary"
        >
          {t("entry.inbox")}
          <button
            className="ml-1 rounded-full p-0.5 transition-colors outline-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/30"
            onClick={handleRemoveInbox}
            type="button"
          >
            <HugeiconsIcon className="size-3" icon={Cancel01Icon} />
          </button>
        </Badge>
      )}
      {value.isStarred && (
        <Badge
          className="gap-1 border-primary/15 bg-primary/10 pr-1 text-primary"
          variant="secondary"
        >
          {t("entry.starred")}
          <button
            className="ml-1 rounded-full p-0.5 transition-colors outline-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/30"
            onClick={handleRemoveStarred}
            type="button"
          >
            <HugeiconsIcon className="size-3" icon={Cancel01Icon} />
          </button>
        </Badge>
      )}
    </div>
  )
}
