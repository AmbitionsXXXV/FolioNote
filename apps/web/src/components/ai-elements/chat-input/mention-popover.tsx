import { cn } from "@folionote/ui/lib/utils"
import { FileEditIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import type { RefObject } from "react"

export interface MentionItem {
  id: string
  title: string
}

const MENTION_MAX_VISIBLE = 8

/**
 * Walk backwards from `cursorPosition` to find the triggering `@` index.
 * Returns -1 if no valid `@` is found.
 */
export function findAtIndex(value: string, cursorPosition: number): number {
  for (let i = cursorPosition - 1; i >= 0; i--) {
    const ch = value.at(i)
    if (ch === "@") {
      return i
    }
    if (ch === " " || ch === "\n" || ch === "\r") {
      return -1
    }
  }
  return -1
}

function filterItems(items: MentionItem[], query: string): MentionItem[] {
  const normalizedQuery = query.trim().toLowerCase()
  const result: MentionItem[] = []

  for (const item of items) {
    if (result.length >= MENTION_MAX_VISIBLE) {
      break
    }
    if (
      !normalizedQuery ||
      item.title.toLowerCase().includes(normalizedQuery)
    ) {
      result.push(item)
    }
  }

  return result
}

// ============================================================================
// Component
// ============================================================================

export interface MentionPopoverProps {
  open: boolean
  filteredItems: MentionItem[]
  selectedIndex: number
  emptyText: string
  onSelect: (item: MentionItem) => void
  onHover: (index: number) => void
}

/**
 * Lightweight mention popover that floats above the textarea.
 * All state is owned by `useMentionPopover`; this is a pure render component.
 */
export function MentionPopover({
  open,
  filteredItems,
  selectedIndex,
  emptyText,
  onSelect,
  onHover
}: MentionPopoverProps) {
  const listId = useId()
  const menuRef = useRef<HTMLDivElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    const menu = menuRef.current
    if (!menu) {
      return
    }

    const selectedEl = menu.querySelector('[data-selected="true"]')
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [selectedIndex])

  if (!open) {
    return null
  }

  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-64" role="listbox">
      <div
        className="max-h-72 overflow-auto rounded-lg border bg-popover p-1 shadow-lg"
        ref={menuRef}
      >
        {filteredItems.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          filteredItems.map((item, index) => {
            const isSelected = index === selectedIndex
            return (
              <button
                aria-selected={isSelected}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  "transition-colors duration-150 motion-reduce:transition-none",
                  isSelected
                    ? "bg-surface-secondary text-foreground"
                    : "hover:bg-surface-secondary/70"
                )}
                data-selected={isSelected}
                id={`${listId}-option-${item.id}`}
                key={item.id}
                onClick={() => onSelect(item)}
                onMouseDown={(e) => {
                  // Prevent textarea blur on click
                  e.preventDefault()
                }}
                onMouseEnter={() => onHover(index)}
                role="option"
                type="button"
              >
                <HugeiconsIcon
                  className="size-3 shrink-0 text-muted-foreground"
                  icon={FileEditIcon}
                />
                <span className="truncate">{item.title}</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Hook
// ============================================================================

interface UseMentionPopoverOptions {
  items: MentionItem[]
  onSelect: (item: MentionItem) => void
  emptyText: string
  anchorRef: RefObject<HTMLTextAreaElement | null>
}

/**
 * Manages mention popover state driven by textarea value changes.
 *
 * - `detectMention(value, cursor)` -- call on every textarea change
 * - `handleKey(key)` -- call from a native keydown listener; returns true if consumed
 * - `popoverProps` -- spread onto `<MentionPopover>`
 */
export function useMentionPopover({
  items,
  onSelect,
  emptyText
}: UseMentionPopoverOptions) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filtered = filterItems(items, query)

  // Reset the highlighted item during render when the query or items change,
  // so it never points at a stale row for a frame.
  const [prevQuery, setPrevQuery] = useState(query)
  const [prevItems, setPrevItems] = useState(items)
  if (query !== prevQuery || items !== prevItems) {
    setPrevQuery(query)
    setPrevItems(items)
    setSelectedIndex(0)
  }

  const close = useCallback(() => {
    setOpen(false)
    setQuery("")
    setSelectedIndex(0)
  }, [])

  /** Call whenever the textarea value changes. */
  const detectMention = useCallback((value: string, cursorPosition: number) => {
    const atIndex = findAtIndex(value, cursorPosition)

    if (atIndex < 0) {
      setOpen(false)
      setQuery("")
      return
    }

    // @ must be at start of input or preceded by whitespace
    if (atIndex > 0) {
      const charBefore = value.at(atIndex - 1)
      if (charBefore !== " " && charBefore !== "\n" && charBefore !== "\r") {
        setOpen(false)
        setQuery("")
        return
      }
    }

    const afterAt = value.slice(atIndex + 1, cursorPosition)

    if (afterAt.includes("\n")) {
      setOpen(false)
      setQuery("")
      return
    }

    setQuery(afterAt)
    setOpen(true)
  }, [])

  // Stable refs so the native keydown handler always reads fresh values
  const stateRef = useRef({ open, filtered, selectedIndex })
  stateRef.current = { open, filtered, selectedIndex }

  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const closeRef = useRef(close)
  closeRef.current = close

  /**
   * Handle a keyboard key pressed in the textarea.
   * Returns `true` if the key was consumed (caller should preventDefault).
   */
  const handleKey = useCallback((key: string): boolean => {
    const { open: isOpen, filtered: f, selectedIndex: idx } = stateRef.current

    if (!isOpen) {
      return false
    }

    if (key === "Escape") {
      closeRef.current()
      return true
    }

    if (f.length === 0) {
      return false
    }

    if (key === "ArrowUp") {
      setSelectedIndex((prev) => (prev <= 0 ? f.length - 1 : prev - 1))
      return true
    }
    if (key === "ArrowDown") {
      setSelectedIndex((prev) => (prev >= f.length - 1 ? 0 : prev + 1))
      return true
    }
    if (key === "Enter") {
      const item = f.at(idx)
      if (item) {
        onSelectRef.current(item)
      }
      return true
    }

    return false
  }, [])

  const handleHover = useCallback((index: number) => {
    setSelectedIndex(index)
  }, [])

  return {
    open,
    query,
    detectMention,
    close,
    handleKey,
    popoverProps: {
      open,
      filteredItems: filtered,
      selectedIndex,
      emptyText,
      onSelect,
      onHover: handleHover
    } satisfies MentionPopoverProps
  }
}
