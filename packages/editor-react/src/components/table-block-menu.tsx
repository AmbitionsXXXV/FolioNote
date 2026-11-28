import type { TranslateFunction } from "@folionote/editor-core"
import {
  ArrowReloadHorizontalIcon,
  BorderLeft01Icon,
  BorderTop01Icon,
  Copy01Icon,
  Copy02Icon,
  Delete01Icon,
  DistributeHorizontalCenterIcon,
  File01Icon,
  InsertRowDownIcon,
  LinkSquare01Icon,
  Scissor01Icon,
  Share08Icon,
  TextIndent01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import type { Editor } from "@tiptap/core"
import { DOMSerializer } from "@tiptap/pm/model"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { TextSelection } from "@tiptap/pm/state"
import { useEffect, useRef } from "react"
import type { ReactNode } from "react"

const cx = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(" ")

/** Direct children of a node as an array. */
function childrenOf(node: ProseMirrorNode): ProseMirrorNode[] {
  const out: ProseMirrorNode[] = []
  for (let i = 0; i < node.childCount; i++) {
    out.push(node.child(i))
  }
  return out
}

/** Whether the table's first row is entirely header cells. */
function isHeaderRowOn(table: ProseMirrorNode): boolean {
  if (table.childCount === 0) {
    return false
  }
  const firstRow = table.child(0)
  return (
    firstRow.childCount > 0 &&
    childrenOf(firstRow).every((cell) => cell.type.name === "tableHeader")
  )
}

/** Whether every row's first cell is a header cell. */
function isHeaderColumnOn(table: ProseMirrorNode): boolean {
  if (table.childCount === 0) {
    return false
  }
  return childrenOf(table).every(
    (row) => row.childCount > 0 && row.child(0).type.name === "tableHeader"
  )
}

export interface TableBlockMenuProps {
  editor: Editor
  /** The table node (kept fresh by the node view's re-render). */
  node: ProseMirrorNode
  /** Absolute position of the table node. */
  getPos: () => number | undefined
  /** The rendered table element, used to measure width for distribute. */
  tableElement: HTMLTableElement | null
  /** Anchor coordinates (viewport) for the menu. */
  position: { x: number; y: number }
  t?: TranslateFunction
  onClose: () => void
}

interface MenuItemProps {
  icon: IconSvgElement
  label: string
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  title?: string
  trailing?: ReactNode
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
  title,
  trailing
}: MenuItemProps) {
  return (
    <button
      className={cx(
        "table-menu-item",
        danger && "table-menu-item-danger",
        disabled && "table-menu-item-disabled"
      )}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      <HugeiconsIcon className="size-4" icon={icon} />
      <span>{label}</span>
      {trailing}
    </button>
  )
}

function ToggleSwitch({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={cx("table-menu-switch", on && "is-on")}>
      <span className="table-menu-switch-thumb" />
    </span>
  )
}

/**
 * Block-level context menu for a table, mirroring Lark's table block menu.
 *
 * Implemented actions: cut, copy, duplicate, delete, header-row / header-column
 * toggles, distribute columns evenly, and add-block-below. Platform-only items
 * (sync block, indent, share, save as template, copy link) are rendered as
 * disabled placeholders to preserve visual parity.
 */
export function TableBlockMenu({
  editor,
  node,
  getPos,
  tableElement,
  position,
  t,
  onClose
}: TableBlockMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  const label = (key: string, fallback: string) =>
    t?.(`editor.table.block.${key}`) ?? fallback

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  // Keep the menu inside the viewport.
  useEffect(() => {
    const menu = menuRef.current
    if (!menu) {
      return
    }
    const rect = menu.getBoundingClientRect()
    let x = position.x
    let y = position.y
    if (rect.right > window.innerWidth) {
      x = window.innerWidth - rect.width - 8
    }
    if (rect.bottom > window.innerHeight) {
      y = window.innerHeight - rect.height - 8
    }
    menu.style.left = `${Math.max(8, x)}px`
    menu.style.top = `${Math.max(8, y)}px`
  }, [position])

  const headerRowOn = isHeaderRowOn(node)
  const headerColumnOn = isHeaderColumnOn(node)

  /** Serialize the table node to HTML for the clipboard. */
  const serializeHtml = () => {
    const serializer = DOMSerializer.fromSchema(editor.schema)
    const dom = serializer.serializeNode(node) as HTMLElement
    const wrapper = document.createElement("div")
    wrapper.append(dom)
    return wrapper.innerHTML
  }

  const copyToClipboard = async () => {
    const html = serializeHtml()
    const text = node.textContent
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" })
          })
        ])
      } else {
        await navigator.clipboard?.writeText(text)
      }
    } catch {
      // Clipboard may be unavailable (insecure context / denied permission).
    }
  }

  /** Run a chained command after placing the selection inside the first cell. */
  const runInTable = (build: (pos: number) => void) => {
    const pos = getPos()
    if (typeof pos === "number") {
      build(pos)
    }
  }

  const toggleHeader = (which: "Row" | "Column") => {
    runInTable((pos) => {
      const chain = editor.chain().command(({ tr, dispatch }) => {
        if (dispatch) {
          tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))
        }
        return true
      })
      if (which === "Row") {
        chain.toggleHeaderRow().run()
      } else {
        chain.toggleHeaderColumn().run()
      }
    })
  }

  const handleCopy = () => {
    void copyToClipboard()
    onClose()
  }

  const handleCut = () => {
    void copyToClipboard()
    runInTable((pos) => {
      editor.chain().focus().deleteTableBlock({ pos }).run()
    })
    onClose()
  }

  const handleDuplicate = () => {
    runInTable((pos) => {
      editor.chain().focus().duplicateTableBlock({ pos }).run()
    })
    onClose()
  }

  const handleDelete = () => {
    runInTable((pos) => {
      editor.chain().focus().deleteTableBlock({ pos }).run()
    })
    onClose()
  }

  const handleDistribute = () => {
    runInTable((pos) => {
      editor
        .chain()
        .focus()
        .distributeTableColumns({ pos, totalWidth: tableElement?.offsetWidth })
        .run()
    })
    onClose()
  }

  const handleAddBelow = () => {
    runInTable((pos) => {
      editor.chain().focus().insertParagraphAfterTable({ pos }).run()
    })
    onClose()
  }

  const comingSoon = label("comingSoon", "Coming soon")

  return (
    <div
      className="table-menu table-block-menu"
      ref={menuRef}
      style={{ position: "fixed", left: position.x, top: position.y }}
    >
      <div className="table-menu-section">
        <MenuItem
          disabled
          icon={ArrowReloadHorizontalIcon}
          label={label("syncBlock", "Sync block")}
          title={comingSoon}
        />
        <MenuItem
          disabled
          icon={TextIndent01Icon}
          label={label("indent", "Indent")}
          title={comingSoon}
        />
      </div>

      <div className="table-menu-divider" />

      <div className="table-menu-section">
        <MenuItem
          icon={Scissor01Icon}
          label={label("cut", "Cut")}
          onClick={handleCut}
        />
        <MenuItem
          icon={Copy01Icon}
          label={label("copy", "Copy")}
          onClick={handleCopy}
        />
        <MenuItem
          icon={Copy02Icon}
          label={label("duplicate", "Duplicate")}
          onClick={handleDuplicate}
        />
        <MenuItem
          danger
          icon={Delete01Icon}
          label={label("delete", "Delete")}
          onClick={handleDelete}
        />
      </div>

      <div className="table-menu-divider" />

      <div className="table-menu-section">
        <MenuItem
          disabled
          icon={Share08Icon}
          label={label("share", "Share")}
          title={comingSoon}
        />
        <MenuItem
          disabled
          icon={File01Icon}
          label={label("saveAsTemplate", "Save as template")}
          title={comingSoon}
        />
        <MenuItem
          disabled
          icon={LinkSquare01Icon}
          label={label("copyLink", "Copy link")}
          title={comingSoon}
        />
      </div>

      <div className="table-menu-divider" />

      <div className="table-menu-section">
        <MenuItem
          icon={BorderTop01Icon}
          label={label("headerRow", "Header row")}
          onClick={() => toggleHeader("Row")}
          trailing={<ToggleSwitch on={headerRowOn} />}
        />
        <MenuItem
          icon={BorderLeft01Icon}
          label={label("headerColumn", "Header column")}
          onClick={() => toggleHeader("Column")}
          trailing={<ToggleSwitch on={headerColumnOn} />}
        />
        <MenuItem
          icon={DistributeHorizontalCenterIcon}
          label={label("distributeColumns", "Distribute columns evenly")}
          onClick={handleDistribute}
        />
      </div>

      <div className="table-menu-divider" />

      <div className="table-menu-section">
        <MenuItem
          icon={InsertRowDownIcon}
          label={label("addBelow", "Add block below")}
          onClick={handleAddBelow}
        />
      </div>
    </div>
  )
}
