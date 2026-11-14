import { Button } from "@folionote/ui/button"
import { Input } from "@folionote/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@folionote/ui/select"
import {
  FilterIcon,
  Search01Icon,
  ViewIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useReactFlow } from "@xyflow/react"
import { useCallback } from "react"
import type { ChangeEvent } from "react"
import { useTranslation } from "react-i18next"

interface GraphToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  includeInferred: boolean
  onToggleInferred: () => void
  tagFilter: string
  onTagFilterChange: (value: string) => void
  tags: Array<{ id: string; name: string }>
  isConnecting: boolean
  onToggleConnectMode: () => void
}

export function GraphToolbar({
  search,
  onSearchChange,
  includeInferred,
  onToggleInferred,
  tagFilter,
  onTagFilterChange,
  tags,
  isConnecting,
  onToggleConnectMode
}: GraphToolbarProps) {
  const { t } = useTranslation()
  const { fitView } = useReactFlow()

  const handleSearchInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value)
    },
    [onSearchChange]
  )

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur-sm">
      <div className="relative max-w-[300px] min-w-[180px] flex-1">
        <HugeiconsIcon
          className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          icon={Search01Icon}
        />
        <Input
          className="h-8 pl-8 text-sm"
          onChange={handleSearchInput}
          placeholder={t("graph.searchPlaceholder")}
          value={search}
        />
      </div>

      {tags.length > 0 && (
        <Select
          onValueChange={(v) => onTagFilterChange(v ?? "all")}
          value={tagFilter}
        >
          <SelectTrigger className="h-8 w-auto min-w-[130px] gap-2 text-sm">
            <HugeiconsIcon className="size-3.5" icon={FilterIcon} />
            <SelectValue placeholder={t("graph.filterByTag")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("graph.allTags")}</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Button
        className="h-8 gap-1.5 text-xs"
        onClick={onToggleInferred}
        size="sm"
        variant={includeInferred ? "secondary" : "outline"}
      >
        <HugeiconsIcon className="size-3.5" icon={ViewIcon} />
        {t("graph.inferredEdges")}
      </Button>

      <Button
        className="h-8 gap-1.5 text-xs"
        onClick={onToggleConnectMode}
        size="sm"
        variant={isConnecting ? "default" : "outline"}
      >
        {isConnecting ? t("graph.connectingDone") : t("graph.addLink")}
      </Button>

      <Button
        className="h-8 text-xs"
        onClick={() => fitView({ duration: 300 })}
        size="sm"
        variant="ghost"
      >
        {t("graph.fitView")}
      </Button>
    </div>
  )
}
