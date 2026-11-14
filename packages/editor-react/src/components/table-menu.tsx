import type { TranslateFunction } from "@folionote/editor-core"
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  Copy01Icon,
  Delete01Icon,
  PaintBoardIcon,
  SquareArrowDownDoubleIcon,
  SquareArrowLeftDoubleIcon,
  SquareArrowRightDoubleIcon,
  SquareArrowUpDoubleIcon,
  TableIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useRef, useState } from "react"

import { TABLE_COLORS, TABLE_COLORS_DARK } from "../extensions/table-extension"

/** Resolve an `editor.table.*` label with an English fallback. */
function makeLabel(t?: TranslateFunction) {
  return (key: string, fallback: string) =>
    t?.(`editor.table.${key}`) ?? fallback
}

interface ColorPickerProps {
  colors: ReadonlyArray<{ name: string; value: string }>
  currentBackgroundColor: string | null | undefined
  onSetBackgroundColor: (color: string | null) => void
  onClose: () => void
  defaultLabel: string
}

function ColorPicker({
  colors,
  currentBackgroundColor,
  onSetBackgroundColor,
  onClose,
  defaultLabel
}: ColorPickerProps) {
  return (
    <div className="table-menu-color-picker">
      <button
        className={`table-menu-color-item ${currentBackgroundColor ? "" : "active"}`}
        onClick={() => {
          onSetBackgroundColor(null)
          onClose()
        }}
        title={defaultLabel}
        type="button"
      >
        <span className="table-menu-color-swatch table-menu-color-default">
          <HugeiconsIcon className="size-3" icon={Cancel01Icon} />
        </span>
        <span>{defaultLabel}</span>
      </button>
      {colors.map((color) => (
        <button
          className={`table-menu-color-item ${currentBackgroundColor === color.value ? "active" : ""}`}
          key={color.name}
          onClick={() => {
            onSetBackgroundColor(color.value)
            onClose()
          }}
          title={color.name}
          type="button"
        >
          <span
            className="table-menu-color-swatch"
            style={{ backgroundColor: color.value }}
          />
          <span>{color.name}</span>
        </button>
      ))}
    </div>
  )
}

interface AlignSectionProps {
  label: (key: string, fallback: string) => string
  onSetAlign?: (align: string) => void
}

function AlignSection({ label, onSetAlign }: AlignSectionProps) {
  if (!onSetAlign) {
    return null
  }
  return (
    <>
      <div className="table-menu-divider" />
      <div className="table-menu-section table-menu-align-row">
        <button
          aria-label={label("alignLeft", "Align left")}
          className="table-menu-align-btn"
          onClick={() => onSetAlign("left")}
          title={label("alignLeft", "Align left")}
          type="button"
        >
          <HugeiconsIcon className="size-4" icon={TextAlignLeftIcon} />
        </button>
        <button
          aria-label={label("alignCenter", "Align center")}
          className="table-menu-align-btn"
          onClick={() => onSetAlign("center")}
          title={label("alignCenter", "Align center")}
          type="button"
        >
          <HugeiconsIcon className="size-4" icon={TextAlignCenterIcon} />
        </button>
        <button
          aria-label={label("alignRight", "Align right")}
          className="table-menu-align-btn"
          onClick={() => onSetAlign("right")}
          title={label("alignRight", "Align right")}
          type="button"
        >
          <HugeiconsIcon className="size-4" icon={TextAlignRightIcon} />
        </button>
      </div>
    </>
  )
}

interface MoveSectionProps {
  isRow: boolean
  label: (key: string, fallback: string) => string
  onMoveUp?: () => void
  onMoveDown?: () => void
  onMoveLeft?: () => void
  onMoveRight?: () => void
}

function MoveSection({
  isRow,
  label,
  onMoveUp,
  onMoveDown,
  onMoveLeft,
  onMoveRight
}: MoveSectionProps) {
  if (isRow) {
    if (!(onMoveUp || onMoveDown)) {
      return null
    }
  } else if (!(onMoveLeft || onMoveRight)) {
    return null
  }

  return (
    <>
      <div className="table-menu-divider" />
      <div className="table-menu-section">
        {isRow ? (
          <>
            {onMoveUp && (
              <button
                className="table-menu-item"
                onClick={onMoveUp}
                type="button"
              >
                <HugeiconsIcon className="size-4" icon={ArrowUp01Icon} />
                <span>{label("moveUp", "Move up")}</span>
              </button>
            )}
            {onMoveDown && (
              <button
                className="table-menu-item"
                onClick={onMoveDown}
                type="button"
              >
                <HugeiconsIcon className="size-4" icon={ArrowDown01Icon} />
                <span>{label("moveDown", "Move down")}</span>
              </button>
            )}
          </>
        ) : (
          <>
            {onMoveLeft && (
              <button
                className="table-menu-item"
                onClick={onMoveLeft}
                type="button"
              >
                <HugeiconsIcon className="size-4" icon={ArrowLeft01Icon} />
                <span>{label("moveLeft", "Move left")}</span>
              </button>
            )}
            {onMoveRight && (
              <button
                className="table-menu-item"
                onClick={onMoveRight}
                type="button"
              >
                <HugeiconsIcon className="size-4" icon={ArrowRight01Icon} />
                <span>{label("moveRight", "Move right")}</span>
              </button>
            )}
          </>
        )}
      </div>
    </>
  )
}

interface ActionsSectionProps {
  isRow: boolean
  label: (key: string, fallback: string) => string
  onDuplicate?: () => void
  onToggleHeader?: () => void
}

function ActionsSection({
  isRow,
  label,
  onDuplicate,
  onToggleHeader
}: ActionsSectionProps) {
  if (!(onDuplicate || onToggleHeader)) {
    return null
  }

  return (
    <>
      <div className="table-menu-divider" />
      <div className="table-menu-section">
        {onDuplicate && (
          <button
            className="table-menu-item"
            onClick={onDuplicate}
            type="button"
          >
            <HugeiconsIcon className="size-4" icon={Copy01Icon} />
            <span>
              {label(
                isRow ? "duplicateRow" : "duplicateColumn",
                isRow ? "Duplicate row" : "Duplicate column"
              )}
            </span>
          </button>
        )}
        {onToggleHeader && (
          <button
            className="table-menu-item"
            onClick={onToggleHeader}
            type="button"
          >
            <HugeiconsIcon className="size-4" icon={TableIcon} />
            <span>
              {label(
                isRow ? "toggleHeaderRow" : "toggleHeaderColumn",
                isRow ? "Toggle header row" : "Toggle header column"
              )}
            </span>
          </button>
        )}
      </div>
    </>
  )
}

export interface TableMenuProps {
  type: "row" | "column"
  position: { x: number; y: number }
  onClose: () => void
  onAddBefore: () => void
  onAddAfter: () => void
  onDelete: () => void
  onToggleHeader?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onMoveLeft?: () => void
  onMoveRight?: () => void
  onDuplicate?: () => void
  onClearContents?: () => void
  onSetBackgroundColor?: (color: string | null) => void
  onSetAlign?: (align: string) => void
  currentBackgroundColor?: string | null
  isDarkMode?: boolean
  t?: TranslateFunction
}

/**
 * Enhanced TableMenu component
 * Context menu for row/column operations with extended functionality
 * Inspired by AFFiNE's table cell context menu
 */
export function TableMenu({
  type,
  position,
  onClose,
  onAddBefore,
  onAddAfter,
  onDelete,
  onToggleHeader,
  onMoveUp,
  onMoveDown,
  onMoveLeft,
  onMoveRight,
  onDuplicate,
  onClearContents,
  onSetBackgroundColor,
  onSetAlign,
  currentBackgroundColor,
  isDarkMode = false,
  t
}: TableMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const label = makeLabel(t)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (showColorPicker) {
          setShowColorPicker(false)
        } else {
          onClose()
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose, showColorPicker])

  // Adjust menu position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) {
      return
    }

    const menu = menuRef.current
    const rect = menu.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let adjustedX = position.x
    let adjustedY = position.y

    if (rect.right > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 8
    }
    if (rect.bottom > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 8
    }

    menu.style.left = `${adjustedX}px`
    menu.style.top = `${adjustedY}px`
  }, [position])

  const isRow = type === "row"
  const colors = isDarkMode ? TABLE_COLORS_DARK : TABLE_COLORS

  return (
    <div
      className="table-menu"
      ref={menuRef}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y
      }}
    >
      {/* Background Color Section */}
      {onSetBackgroundColor && (
        <>
          <div className="table-menu-section">
            <button
              className="table-menu-item table-menu-item-with-submenu"
              onClick={() => setShowColorPicker(!showColorPicker)}
              type="button"
            >
              <HugeiconsIcon className="size-4" icon={PaintBoardIcon} />
              <span>{label("backgroundColor", "Background color")}</span>
              <span className="table-menu-item-arrow">›</span>
            </button>

            {showColorPicker && (
              <ColorPicker
                colors={colors}
                currentBackgroundColor={currentBackgroundColor}
                defaultLabel={label("defaultColor", "Default")}
                onClose={() => setShowColorPicker(false)}
                onSetBackgroundColor={onSetBackgroundColor}
              />
            )}
          </div>

          {currentBackgroundColor && (
            <button
              className="table-menu-item"
              onClick={() => onSetBackgroundColor(null)}
              type="button"
            >
              <HugeiconsIcon className="size-4" icon={Cancel01Icon} />
              <span>
                {label(
                  isRow ? "clearRowStyle" : "clearColumnStyle",
                  isRow ? "Clear row style" : "Clear column style"
                )}
              </span>
            </button>
          )}

          <div className="table-menu-divider" />
        </>
      )}

      {/* Insert Section */}
      <div className="table-menu-section">
        <button className="table-menu-item" onClick={onAddBefore} type="button">
          <HugeiconsIcon
            className="size-4"
            icon={isRow ? SquareArrowUpDoubleIcon : SquareArrowLeftDoubleIcon}
          />
          <span>
            {label(
              isRow ? "insertAbove" : "insertLeft",
              isRow ? "Insert above" : "Insert left"
            )}
          </span>
        </button>
        <button className="table-menu-item" onClick={onAddAfter} type="button">
          <HugeiconsIcon
            className="size-4"
            icon={
              isRow ? SquareArrowDownDoubleIcon : SquareArrowRightDoubleIcon
            }
          />
          <span>
            {label(
              isRow ? "insertBelow" : "insertRight",
              isRow ? "Insert below" : "Insert right"
            )}
          </span>
        </button>
      </div>

      <AlignSection label={label} onSetAlign={onSetAlign} />

      <MoveSection
        isRow={isRow}
        label={label}
        onMoveDown={onMoveDown}
        onMoveLeft={onMoveLeft}
        onMoveRight={onMoveRight}
        onMoveUp={onMoveUp}
      />

      <ActionsSection
        isRow={isRow}
        label={label}
        onDuplicate={onDuplicate}
        onToggleHeader={onToggleHeader}
      />

      {/* Clear & Delete Section */}
      <div className="table-menu-divider" />
      <div className="table-menu-section">
        {onClearContents && (
          <button
            className="table-menu-item"
            onClick={onClearContents}
            type="button"
          >
            <HugeiconsIcon className="size-4" icon={Cancel01Icon} />
            <span>
              {label(
                isRow ? "clearRowContents" : "clearColumnContents",
                isRow ? "Clear row contents" : "Clear column contents"
              )}
            </span>
          </button>
        )}
        <button
          className="table-menu-item table-menu-item-danger"
          onClick={onDelete}
          type="button"
        >
          <HugeiconsIcon className="size-4" icon={Delete01Icon} />
          <span>
            {label(
              isRow ? "deleteRow" : "deleteColumn",
              isRow ? "Delete row" : "Delete column"
            )}
          </span>
        </button>
      </div>
    </div>
  )
}
