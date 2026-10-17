import type { TranslateFunction } from "@folionote/editor-core"
import {
  DragDropVerticalIcon,
  LayoutTable01Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { TextSelection } from "@tiptap/pm/state"
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import { useCallback, useEffect, useRef, useState } from "react"

import { TableBlockMenu } from "./table-block-menu"
import { TableControls } from "./table-controls"
import { TableMenu } from "./table-menu"

export type MenuState = {
  type: "row" | "column"
  index: number
  position: { x: number; y: number }
} | null

type BlockMenuState = { x: number; y: number } | null

interface ControlPosition {
  top: number
  left: number
}

type EditorChain = ReturnType<NodeViewProps["editor"]["chain"]>
type RunOnCell = (
  rowIndex: number,
  columnIndex: number,
  build: (chain: EditorChain) => void
) => void

const POSITION_EPSILON_PX = 0.5

/** Track the document's dark mode via the `.dark` class on <html>. */
function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const update = () => setIsDark(root.classList.contains("dark"))
    update()
    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

interface TableHover {
  contentRef: React.RefObject<HTMLTableSectionElement | null>
  tableElement: HTMLTableElement | null
  setTableElement: (table: HTMLTableElement | null) => void
  hoveredRow: number | null
  setHoveredRow: (index: number | null) => void
  hoveredColumn: number | null
  setHoveredColumn: (index: number | null) => void
  rowControlPosition: ControlPosition | null
  columnControlPosition: ControlPosition | null
}

/**
 * Hover tracking + floating control positioning for the table node view.
 *
 * Owns the table element ref, the hovered row/column, and the computed screen
 * positions for the row/column add controls. Listens to pointer movement,
 * scroll, resize, and table layout changes to keep the controls anchored.
 */
function useTableHover(): TableHover {
  const [tableElement, setTableElement] = useState<HTMLTableElement | null>(
    null
  )
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null)
  const [rowControlPosition, setRowControlPosition] =
    useState<ControlPosition | null>(null)
  const [columnControlPosition, setColumnControlPosition] =
    useState<ControlPosition | null>(null)
  const contentRef = useRef<HTMLTableSectionElement>(null)
  const hoveredRowIndexRef = useRef<number | null>(null)
  const hoveredColumnIndexRef = useRef<number | null>(null)

  // Update table element ref when mounted
  useEffect(() => {
    if (contentRef.current) {
      const table = contentRef.current.closest("table")
      setTableElement(table)
    }
  }, [])

  const updateControlPositions = useCallback(
    (rowIndex: number, columnIndex: number) => {
      if (!tableElement) {
        return
      }

      const wrapperElement = tableElement.closest(
        ".table-node-wrapper"
      ) as HTMLElement | null
      if (!wrapperElement) {
        return
      }

      const wrapperRect = wrapperElement.getBoundingClientRect()
      const tableRect = tableElement.getBoundingClientRect()
      const tableRows = [...tableElement.rows]
      const rowElement = tableRows[rowIndex]

      if (!rowElement) {
        setRowControlPosition(null)
        setColumnControlPosition(null)
        return
      }

      const rowRect = rowElement.getBoundingClientRect()
      const nextRowPosition = {
        top: rowRect.top - wrapperRect.top + rowRect.height / 2,
        left: tableRect.left - wrapperRect.left
      }

      setRowControlPosition((current) => {
        if (
          current &&
          Math.abs(current.top - nextRowPosition.top) < POSITION_EPSILON_PX &&
          Math.abs(current.left - nextRowPosition.left) < POSITION_EPSILON_PX
        ) {
          return current
        }
        return nextRowPosition
      })

      const columnCell =
        rowElement.cells[columnIndex] ?? tableRows[0]?.cells[columnIndex]
      if (!columnCell) {
        setColumnControlPosition(null)
        return
      }

      const columnRect = columnCell.getBoundingClientRect()
      const nextColumnPosition = {
        top: tableRect.top - wrapperRect.top,
        left: columnRect.left - wrapperRect.left + columnRect.width / 2
      }

      setColumnControlPosition((current) => {
        if (
          current &&
          Math.abs(current.top - nextColumnPosition.top) <
            POSITION_EPSILON_PX &&
          Math.abs(current.left - nextColumnPosition.left) < POSITION_EPSILON_PX
        ) {
          return current
        }
        return nextColumnPosition
      })
    },
    [tableElement]
  )

  useEffect(() => {
    if (!tableElement) {
      return
    }

    const wrapperElement = tableElement.closest(
      ".table-node-wrapper"
    ) as HTMLElement | null
    if (!wrapperElement) {
      return
    }

    const handleMouseMove = (event: Event) => {
      const eventTarget = event.target as HTMLElement | null
      if (!eventTarget) {
        return
      }

      const cellElement = eventTarget.closest(
        "td, th"
      ) as HTMLTableCellElement | null
      if (!cellElement) {
        return
      }

      if (!tableElement.contains(cellElement)) {
        return
      }

      const rowElement = cellElement.parentElement as HTMLTableRowElement | null
      if (!rowElement) {
        return
      }

      const { rowIndex } = rowElement
      const columnIndex = cellElement.cellIndex

      if (hoveredRowIndexRef.current !== rowIndex) {
        hoveredRowIndexRef.current = rowIndex
        setHoveredRow(rowIndex)
      }

      if (hoveredColumnIndexRef.current !== columnIndex) {
        hoveredColumnIndexRef.current = columnIndex
        setHoveredColumn(columnIndex)
      }

      updateControlPositions(rowIndex, columnIndex)
    }

    const handleMouseLeave = () => {
      hoveredRowIndexRef.current = null
      hoveredColumnIndexRef.current = null
      setHoveredRow(null)
      setHoveredColumn(null)
      setRowControlPosition(null)
      setColumnControlPosition(null)
    }

    wrapperElement.addEventListener("mousemove", handleMouseMove)
    wrapperElement.addEventListener("mouseleave", handleMouseLeave)

    return () => {
      wrapperElement.removeEventListener("mousemove", handleMouseMove)
      wrapperElement.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [tableElement, updateControlPositions])

  useEffect(() => {
    if (!tableElement) {
      return
    }

    const handleLayoutUpdate = () => {
      const rowIndex = hoveredRowIndexRef.current
      const columnIndex = hoveredColumnIndexRef.current
      if (rowIndex === null || columnIndex === null) {
        return
      }

      updateControlPositions(rowIndex, columnIndex)
    }

    window.addEventListener("scroll", handleLayoutUpdate, true)
    window.addEventListener("resize", handleLayoutUpdate)

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(handleLayoutUpdate)
    if (resizeObserver) {
      resizeObserver.observe(tableElement)
    }

    return () => {
      window.removeEventListener("scroll", handleLayoutUpdate, true)
      window.removeEventListener("resize", handleLayoutUpdate)
      resizeObserver?.disconnect()
    }
  }, [tableElement, updateControlPositions])

  return {
    contentRef,
    tableElement,
    setTableElement,
    hoveredRow,
    setHoveredRow,
    hoveredColumn,
    setHoveredColumn,
    rowControlPosition,
    columnControlPosition
  }
}

interface TableBlockHandleProps {
  t: TranslateFunction | undefined
  onOpen: (event: React.MouseEvent) => void
}

/** Block handle pill: table-type action icon + drag dots. */
function TableBlockHandle({ t, onOpen }: TableBlockHandleProps) {
  return (
    <div className="table-block-handle" contentEditable={false}>
      <button
        aria-label={t?.("editor.table.block.menuLabel") ?? "Table options"}
        className="table-block-handle-action"
        onClick={onOpen}
        type="button"
      >
        <HugeiconsIcon className="size-4" icon={LayoutTable01Icon} />
      </button>
      <button
        aria-label={t?.("editor.table.block.menuLabel") ?? "Table options"}
        className="table-block-handle-drag"
        onClick={onOpen}
        type="button"
      >
        <HugeiconsIcon className="size-4" icon={DragDropVerticalIcon} />
      </button>
    </div>
  )
}

interface TableSectionMenuProps {
  menuState: MenuState
  isDarkMode: boolean
  rowCount: number
  columnCount: number
  editor: NodeViewProps["editor"]
  runOnCell: RunOnCell
  withPos: (fn: (pos: number) => void) => void
  closeMenu: () => void
  t: TranslateFunction | undefined
}

/** Context menu for a hovered row or column (alignment, move, delete, …). */
function TableSectionMenu({
  menuState,
  isDarkMode,
  rowCount,
  columnCount,
  editor,
  runOnCell,
  withPos,
  closeMenu,
  t
}: TableSectionMenuProps) {
  if (!menuState) {
    return null
  }
  const { type, index, position } = menuState
  const isRow = type === "row"

  const setBackgroundColor = (color: string | null) =>
    withPos((pos) =>
      isRow
        ? editor.commands.setTableRowAttribute({
            pos,
            index,
            name: "backgroundColor",
            value: color
          })
        : editor.commands.setTableColumnAttribute({
            pos,
            index,
            name: "backgroundColor",
            value: color
          })
    )

  const setAlign = (align: string) =>
    withPos((pos) =>
      isRow
        ? editor.commands.setTableRowAttribute({
            pos,
            index,
            name: "textAlign",
            value: align
          })
        : editor.commands.setTableColumnAttribute({
            pos,
            index,
            name: "textAlign",
            value: align
          })
    )

  const canMoveUp = isRow && index > 0
  const canMoveDown = isRow && index < rowCount - 1
  const canMoveLeft = !isRow && index > 0
  const canMoveRight = !isRow && index < columnCount - 1

  return (
    <TableMenu
      currentBackgroundColor={null}
      isDarkMode={isDarkMode}
      onAddAfter={() => {
        runOnCell(isRow ? index : 0, isRow ? 0 : index, (chain) =>
          // biome-ignore lint/suspicious/noExplicitAny: extension-table command typing
          (isRow
            ? (chain as any).addRowAfter()
            : (chain as any).addColumnAfter()
          ).run()
        )
        closeMenu()
      }}
      onAddBefore={() => {
        runOnCell(isRow ? index : 0, isRow ? 0 : index, (chain) =>
          // biome-ignore lint/suspicious/noExplicitAny: extension-table command typing
          (isRow
            ? (chain as any).addRowBefore()
            : (chain as any).addColumnBefore()
          ).run()
        )
        closeMenu()
      }}
      onClearContents={() => {
        withPos((pos) =>
          isRow
            ? editor.commands.clearTableRow({ pos, index })
            : editor.commands.clearTableColumn({ pos, index })
        )
        closeMenu()
      }}
      onClose={closeMenu}
      onDelete={() => {
        runOnCell(isRow ? index : 0, isRow ? 0 : index, (chain) =>
          // biome-ignore lint/suspicious/noExplicitAny: extension-table command typing
          (isRow
            ? (chain as any).deleteRow()
            : (chain as any).deleteColumn()
          ).run()
        )
        closeMenu()
      }}
      onDuplicate={() => {
        withPos((pos) =>
          isRow
            ? editor.commands.duplicateTableRow({ pos, index })
            : editor.commands.duplicateTableColumn({ pos, index })
        )
        closeMenu()
      }}
      onMoveDown={
        canMoveDown
          ? () => {
              withPos((pos) =>
                editor.commands.moveTableRow({
                  pos,
                  from: index,
                  to: index + 1
                })
              )
              closeMenu()
            }
          : undefined
      }
      onMoveLeft={
        canMoveLeft
          ? () => {
              withPos((pos) =>
                editor.commands.moveTableColumn({
                  pos,
                  from: index,
                  to: index - 1
                })
              )
              closeMenu()
            }
          : undefined
      }
      onMoveRight={
        canMoveRight
          ? () => {
              withPos((pos) =>
                editor.commands.moveTableColumn({
                  pos,
                  from: index,
                  to: index + 1
                })
              )
              closeMenu()
            }
          : undefined
      }
      onMoveUp={
        canMoveUp
          ? () => {
              withPos((pos) =>
                editor.commands.moveTableRow({
                  pos,
                  from: index,
                  to: index - 1
                })
              )
              closeMenu()
            }
          : undefined
      }
      onSetAlign={(align) => {
        setAlign(align)
        closeMenu()
      }}
      onSetBackgroundColor={(color) => {
        setBackgroundColor(color)
        closeMenu()
      }}
      onToggleHeader={() => {
        runOnCell(isRow ? index : 0, isRow ? 0 : index, (chain) =>
          // biome-ignore lint/suspicious/noExplicitAny: extension-table command typing
          (isRow
            ? (chain as any).toggleHeaderRow()
            : (chain as any).toggleHeaderColumn()
          ).run()
        )
        closeMenu()
      }}
      position={position}
      t={t}
      type={type}
    />
  )
}

/**
 * Enhanced TableNodeView wrapper component.
 *
 * Provides row/column controls, context menus, a floating add toolbar, and a
 * Lark-style block menu (opened from the ⠿ handle) for table manipulation.
 */
export function TableNodeView({
  editor,
  node,
  getPos,
  extension
}: NodeViewProps) {
  const t = (extension.options as { t?: TranslateFunction }).t
  const isDarkMode = useIsDarkMode()

  const {
    contentRef,
    tableElement,
    setTableElement,
    hoveredRow,
    setHoveredRow,
    hoveredColumn,
    setHoveredColumn,
    rowControlPosition,
    columnControlPosition
  } = useTableHover()
  const [menuState, setMenuState] = useState<MenuState>(null)
  const [blockMenu, setBlockMenu] = useState<BlockMenuState>(null)

  const rowCount = node.childCount
  const columnCount = node.childCount > 0 ? node.child(0).childCount : 0

  // Column widths for the <colgroup>. Rendering a colgroup (as the default
  // TableView does) is what lets prosemirror-tables' column resizing apply and
  // persist widths — our custom node view replaced that TableView.
  const colWidths: Array<number | null> = []
  if (node.childCount > 0) {
    const firstRow = node.child(0)
    for (let i = 0; i < firstRow.childCount; i++) {
      const cell = firstRow.child(i)
      const colspan = (cell.attrs.colspan as number | undefined) ?? 1
      const colwidth = cell.attrs.colwidth as number[] | null
      for (let j = 0; j < colspan; j++) {
        colWidths.push(colwidth?.[j] ?? null)
      }
    }
  }

  // ── Command plumbing ──────────────────────────────────────────────────────

  /** Resolve a document position inside the cell at (rowIndex, columnIndex). */
  const cellInsidePos = useCallback(
    (rowIndex: number, columnIndex: number): number | null => {
      const pos = getPos()
      if (typeof pos !== "number") {
        return null
      }
      const table = editor.state.doc.nodeAt(pos)
      if (!table || table.type.name !== "table" || table.childCount === 0) {
        return null
      }
      const r = Math.min(Math.max(rowIndex, 0), table.childCount - 1)
      const row = table.child(r)
      if (row.childCount === 0) {
        return null
      }
      const c = Math.min(Math.max(columnIndex, 0), row.childCount - 1)
      let p = pos + 1 // into table, before first row
      for (let i = 0; i < r; i++) {
        p += table.child(i).nodeSize
      }
      p += 1 // into row, before first cell
      for (let i = 0; i < c; i++) {
        p += row.child(i).nodeSize
      }
      p += 1 // into cell, before its first child
      return p
    },
    [editor, getPos]
  )

  /** Run a chained command with the selection first placed in a given cell. */
  const runOnCell = useCallback<RunOnCell>(
    (rowIndex, columnIndex, build) => {
      const inside = cellInsidePos(rowIndex, columnIndex)
      if (inside === null) {
        return
      }
      const chain = editor.chain().command(({ tr, dispatch }) => {
        if (dispatch) {
          tr.setSelection(TextSelection.near(tr.doc.resolve(inside)))
        }
        return true
      })
      build(chain)
    },
    [editor, cellInsidePos]
  )

  /** Invoke a callback with the current table position, if available. */
  const withPos = useCallback(
    (fn: (pos: number) => void) => {
      const pos = getPos()
      if (typeof pos === "number") {
        fn(pos)
      }
    },
    [getPos]
  )

  const closeMenu = useCallback(() => setMenuState(null), [])

  // Row operations
  const handleAddRowAfter = useCallback(
    (index: number) => {
      runOnCell(index, hoveredColumn ?? 0, (chain) =>
        // biome-ignore lint/suspicious/noExplicitAny: extension-table command typing
        (chain as any).addRowAfter().run()
      )
    },
    [runOnCell, hoveredColumn]
  )

  // Column operations
  const handleAddColumnAfter = useCallback(
    (index: number) => {
      runOnCell(hoveredRow ?? 0, index, (chain) =>
        // biome-ignore lint/suspicious/noExplicitAny: extension-table command typing
        (chain as any).addColumnAfter().run()
      )
    },
    [runOnCell, hoveredRow]
  )

  // Menu handlers
  const handleOpenMenu = useCallback(
    (type: "row" | "column", index: number, event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setBlockMenu(null)
      setMenuState({
        type,
        index,
        position: { x: event.clientX, y: event.clientY }
      })
    },
    []
  )

  const handleOpenBlockMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    // Anchor the menu to the whole pill, regardless of which segment is clicked.
    const pill = (event.currentTarget as HTMLElement).closest(
      ".table-block-handle"
    )
    const rect = (pill ?? event.currentTarget).getBoundingClientRect()
    setMenuState(null)
    setBlockMenu({ x: rect.left, y: rect.bottom + 4 })
  }, [])

  return (
    <NodeViewWrapper className="table-node-wrapper">
      {/* Block handle ─ table-type action icon + drag dots, in one pill */}
      <TableBlockHandle onOpen={handleOpenBlockMenu} t={t} />

      {/* Row Controls - Left side */}
      <TableControls
        hoveredIndex={hoveredRow}
        onAdd={handleAddRowAfter}
        onHover={setHoveredRow}
        onMenuOpen={(index, event) => handleOpenMenu("row", index, event)}
        position={rowControlPosition}
        type="row"
      />

      {/* Column Controls - Top side */}
      <TableControls
        hoveredIndex={hoveredColumn}
        onAdd={handleAddColumnAfter}
        onHover={setHoveredColumn}
        onMenuOpen={(index, event) => handleOpenMenu("column", index, event)}
        position={columnControlPosition}
        type="column"
      />

      {/* Table Content — wide tables scroll inside the block instead of
          pushing the page sideways; controls stay outside the scroller. */}
      <div className="table-scroll">
        <table
          ref={(element) => {
            if (element) {
              setTableElement(element)
            }
          }}
        >
          {/* Colgroup drives column widths and enables column resizing */}
          <colgroup>
            {colWidths.map((width, index) => (
              <col
                // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
                key={`col-${index}`}
                style={width ? { width: `${width}px` } : undefined}
              />
            ))}
          </colgroup>
          {/*
					Render the content (rows) into the tbody
					Tiptap/ProseMirror expects the content to be the rows
				*/}
          {/* @ts-expect-error - tbody is a valid HTML tag but not typed in NodeViewContent props */}
          <NodeViewContent as="tbody" ref={contentRef} />
        </table>
      </div>

      {/* Row/Column Context Menu */}
      <TableSectionMenu
        closeMenu={closeMenu}
        columnCount={columnCount}
        editor={editor}
        isDarkMode={isDarkMode}
        menuState={menuState}
        rowCount={rowCount}
        runOnCell={runOnCell}
        t={t}
        withPos={withPos}
      />

      {/* Block Menu (image-2 parity) */}
      {blockMenu && (
        <TableBlockMenu
          editor={editor}
          getPos={getPos}
          node={node}
          onClose={() => setBlockMenu(null)}
          position={blockMenu}
          t={t}
          tableElement={tableElement}
        />
      )}
    </NodeViewWrapper>
  )
}
