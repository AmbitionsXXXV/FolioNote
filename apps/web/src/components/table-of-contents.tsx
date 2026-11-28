import { TextAlignLeftIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import type { TOCItemType } from "fumadocs-core/toc"
import {
  TOCProvider,
  TOCScrollArea,
  useActiveAnchors,
  useTOCItems
} from "fumadocs-ui/components/toc"
import { TOCEmpty, TOCItem, TOCItems } from "fumadocs-ui/components/toc/clerk"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

type TableOfContentsPosition = "left" | "right"

interface TableOfContentsProps {
  /** Array of TOC items to display (fumadocs format) */
  items: TOCItemType[]
  /** Additional CSS classes */
  className?: string
  /** Which side the TOC column is rendered on (call sites place it accordingly) */
  position?: TableOfContentsPosition
}

/**
 * Table of Contents sidebar using fumadocs-ui's "clerk" variant, which renders
 * the curved active-line indicator + active highlighting out of the box.
 *
 * Active tracking is driven by TOCProvider's IntersectionObserver, which finds
 * headings via document.getElementById. The heading ids come from the HeadingIds
 * editor extension (lib/heading-id-extension.ts), so they match the TOC anchors.
 *
 * Hidden on mobile (< lg breakpoint).
 */
export function TableOfContents({
  items,
  className,
  position = "right"
}: TableOfContentsProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <TOCProvider toc={items}>
      <TocPanel className={className} position={position} />
    </TOCProvider>
  )
}

/**
 * Panel body, rendered inside TOCProvider so it can observe active-heading state.
 *
 * clerk's active-line indicator (ThumbTrack) writes its track position imperatively
 * from a listener that only fires on an active-heading *change*. It mounts late
 * (gated behind clerk's geometry-measurement pass), so on first load it registers
 * that listener after the IntersectionObserver has already emitted its one initial
 * callback — missing it — and its initial render saw no active item, leaving the
 * line clipped to zero height until the user scrolls (which forces a fresh emit).
 * The active text color is unaffected: each TOCItem seeds its state synchronously
 * on mount.
 *
 * Fix: once the observer reports an active anchor, remount the item list a single
 * time. The freshly mounted ThumbTrack reads the now-active state on its first
 * render and draws the line immediately. The observer lives on TOCProvider above,
 * so it is not reset by this remount.
 */
function TocPanel({
  className,
  position
}: {
  className?: string
  position: TableOfContentsPosition
}) {
  const { t } = useTranslation()
  // 0 = initial mount, 1 = remounted once active tracking became available.
  const [itemsKey, setItemsKey] = useState<0 | 1>(0)
  const syncActiveLine = useCallback(() => setItemsKey(1), [])

  return (
    <div
      className={cn(
        // Sticky TOC column
        "sticky top-(--folio-nav-height) flex h-[calc(100dvh-var(--folio-nav-height))] w-[268px] shrink-0 flex-col p-4 pt-12",
        // Hidden on mobile, visible on lg+
        "hidden lg:flex",
        className
      )}
      data-position={position}
    >
      <h3
        className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground"
        id="toc-title"
      >
        <HugeiconsIcon className="size-4" icon={TextAlignLeftIcon} />
        {t("common.onThisPage")}
      </h3>

      {itemsKey === 0 && <ActiveLineSync onReady={syncActiveLine} />}
      <TocItemList key={itemsKey} />
    </div>
  )
}

/**
 * Renders nothing; watches the TOCProvider observer and fires `onReady` the first
 * time it reports an active heading. The parent unmounts it right after firing, so
 * steady-state scrolling pays no extra re-render cost. See TocPanel for why.
 */
function ActiveLineSync({ onReady }: { onReady: () => void }) {
  const activeAnchors = useActiveAnchors()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current || activeAnchors.length === 0) {
      return
    }
    fired.current = true
    onReady()
  }, [activeAnchors, onReady])

  return null
}

/**
 * Renders fumadocs' clerk TOC items from the TOCProvider context. Items are read
 * via useTOCItems so the clerk thumb can match item references when computing the
 * curved path.
 */
function TocItemList() {
  const items = useTOCItems()

  return (
    <TOCScrollArea className="flex-1">
      <TOCItems>
        {items.length === 0 && <TOCEmpty />}
        {items.map((item) => (
          <TOCItem item={item} key={item.url} />
        ))}
      </TOCItems>
    </TOCScrollArea>
  )
}
