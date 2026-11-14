import {
  Add01Icon,
  MoreHorizontalIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"

export interface TableControlsProps {
  type: "row" | "column"
  hoveredIndex: number | null
  onHover: (index: number | null) => void
  onAdd: (index: number) => void
  onMenuOpen: (index: number, event: React.MouseEvent) => void
  position: { top: number; left: number } | null
}

/**
 * TableControls component
 * Renders + buttons and three-dot menu triggers for row/column manipulation
 */
export function TableControls({
  type,
  hoveredIndex,
  onHover,
  onAdd,
  onMenuOpen,
  position
}: TableControlsProps) {
  if (hoveredIndex === null || !position) {
    return null
  }

  return (
    <div className={`table-controls table-controls-${type}`} style={position}>
      <button
        aria-label={type === "row" ? "Add row" : "Add column"}
        className="table-control-add"
        onClick={() => onAdd(hoveredIndex)}
        onMouseEnter={() => onHover(hoveredIndex)}
        type="button"
      >
        <HugeiconsIcon className="size-3" icon={Add01Icon} />
      </button>
      <button
        aria-label={type === "row" ? "Row options" : "Column options"}
        className="table-control-menu"
        onClick={(e) => onMenuOpen(hoveredIndex, e)}
        onMouseEnter={() => onHover(hoveredIndex)}
        type="button"
      >
        <HugeiconsIcon className="size-3" icon={MoreHorizontalIcon} />
      </button>
    </div>
  )
}
