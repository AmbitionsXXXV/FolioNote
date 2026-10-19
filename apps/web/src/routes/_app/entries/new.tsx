import { Button } from "@folionote/ui/button"
import { Input } from "@folionote/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@folionote/ui/tooltip"
import { ArrowLeft01Icon, Loading02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useHotkey } from "@tanstack/react-hotkeys"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { EntryEditor } from "@/components/entry-editor"
import { TableOfContents } from "@/components/table-of-contents"
import { useTocPosition } from "@/hooks/use-toc-position"
import { parseTocFromContent } from "@/lib/toc"
import { cn } from "@/lib/utils"
import { orpc } from "@/utils/orpc"

export const Route = createFileRoute("/_app/entries/new")({
  component: NewEntryPage
})

/**
 * Page for composing a new entry and saving it to the library.
 *
 * Presents a title input and rich editor, lets the user save a new entry (which invalidates the entries cache, shows success or error toasts, and navigates to the new entry's edit page), and provides a back button to return to the library.
 *
 * @returns The rendered JSX for the New Entry page component
 */
function NewEntryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLDivElement>(null)
  const [tocPosition] = useTocPosition()
  const [tocRenderKey, setTocRenderKey] = useState(0)

  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [contentJson, setContentJson] = useState("")
  // Debounced content for TOC (500ms delay to match editor's debounce)
  const [debouncedContentJson, setDebouncedContentJson] = useState("")
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: {
      title?: string
      content?: string
      contentJson?: string
      isInbox?: boolean
    }) => orpc.entries.create.call(data),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ["entries"] })
      toast.success(t("entry.created"))
      // Navigate to the new entry's edit page
      if (entry) {
        navigate({ to: "/entries/$id", params: { id: entry.id } })
      }
    },
    onError: () => {
      toast.error(t("entry.createFailed"))
    }
  })

  const handleContentChange = useCallback((html: string, json: string) => {
    setContent(html)
    setContentJson(json)

    // Debounce TOC update (500ms to match editor's internal debounce)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedContentJson(json)
    }, 500)
  }, [])

  // Cleanup debounce timer on unmount
  useEffect(
    () => () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    },
    []
  )

  const handleSave = useCallback(() => {
    createMutation.mutate({
      title,
      content,
      contentJson,
      isInbox: false // New entries from this page go to library
    })
  }, [createMutation, title, content, contentJson])

  const handleGoBack = useCallback(() => {
    navigate({ to: "/library" })
  }, [navigate])

  // Keyboard shortcut: ⌘/Ctrl + S to save
  useHotkey("Mod+S", (event) => {
    event.preventDefault()
    if (title.trim() || content.trim()) {
      handleSave()
    }
  })

  // Parse TOC items from debounced content
  const tocItems = useMemo(
    () => parseTocFromContent(debouncedContentJson),
    [debouncedContentJson]
  )

  // Headings get stable slug ids from the HeadingIds editor extension, but the
  // fumadocs TOC sets up its observer on mount — before TipTap (immediatelyRender:
  // false) has rendered them. Remount the TOC once the ids are present in the DOM.
  useEffect(() => {
    const container = contentRef.current
    if (!container || tocItems.length === 0) {
      return
    }

    let didRemount = false

    const remountWhenHeadingsReady = () => {
      const hasAnyObservedHeading = tocItems.some((item) => {
        // URL is always prefixed with # by makeUniqueItems
        const id = item.url.slice(1)
        if (!id) {
          return false
        }

        // getElementById (not querySelector(`#${id}`)): slugs from numeric
        // headings (e.g. "2026-1-7") are valid ids but invalid CSS selectors.
        const element = document.getElementById(id)
        return element !== null && container.contains(element)
      })

      if (hasAnyObservedHeading && !didRemount) {
        didRemount = true
        setTocRenderKey((prev) => prev + 1)
        return true
      }

      return hasAnyObservedHeading
    }

    if (typeof MutationObserver === "undefined") {
      remountWhenHeadingsReady()
      return
    }

    if (remountWhenHeadingsReady()) {
      return
    }

    const observer = new MutationObserver(() => {
      if (remountWhenHeadingsReady()) {
        observer.disconnect()
      }
    })

    observer.observe(container, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [tocItems])

  const hasToc = tocItems.length > 0

  return (
    <div
      className={cn(
        "container mx-auto flex",
        hasToc ? "max-w-6xl" : "max-w-4xl"
      )}
    >
      {/* TOC on left side */}
      {hasToc && tocPosition === "left" && (
        <TableOfContents
          items={tocItems}
          key={tocRenderKey}
          position={tocPosition}
        />
      )}

      {/* Main content. The left gutter fits the block handle, which sits
          outside the text column and would be clipped by the scrolling <main>. */}
      <div className="min-w-0 flex-1 px-4 py-6 md:pl-20">
        {/* Header toolbar */}
        <nav className="mb-6 flex items-center justify-between">
          <Button
            aria-label={t("common.back")}
            onClick={handleGoBack}
            size="sm"
            variant="ghost"
          >
            <HugeiconsIcon className="mr-2 size-4" icon={ArrowLeft01Icon} />
            {t("common.back")}
          </Button>

          <Tooltip>
            <TooltipTrigger
              aria-describedby="save-shortcut"
              aria-label={t("common.save")}
              className="group/button inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent bg-primary bg-clip-padding px-2.5 text-sm font-medium whitespace-nowrap text-black transition-all outline-none select-none hover:bg-primary/80 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
              disabled={
                createMutation.isPending || !(title.trim() || content.trim())
              }
              onClick={handleSave}
            >
              {createMutation.isPending ? (
                <>
                  <HugeiconsIcon
                    className="mr-1 size-4 animate-spin"
                    icon={Loading02Icon}
                  />
                  <span>{t("editor.saving")}</span>
                </>
              ) : (
                t("common.save")
              )}
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span className="flex items-center gap-1.5">
                {t("common.save")}
                <kbd className="rounded border border-border/50 bg-surface-secondary/50 px-1.5 py-0.5 font-mono text-[10px]">
                  ⌘&nbsp;S
                </kbd>
              </span>
            </TooltipContent>
          </Tooltip>
        </nav>

        {/* Title input */}
        <Input
          aria-label={t("entry.title")}
          autoComplete="off"
          autoFocus
          className="mb-4 h-auto border-none bg-transparent py-2 font-display text-2xl font-semibold tracking-tight shadow-none transition-colors placeholder:text-muted-foreground/60 focus-visible:ring-0 md:text-3xl"
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("entry.title")}
          spellCheck={false}
          value={title}
        />

        {/* Editor — flows directly on the page canvas (Lark-style), no card */}
        <div ref={contentRef}>
          <EntryEditor
            content={contentJson}
            contentFormat="json"
            onChange={handleContentChange}
            placeholder={t("editor.placeholder")}
          />
        </div>
      </div>

      {/* TOC on right side */}
      {hasToc && tocPosition === "right" && (
        <TableOfContents
          items={tocItems}
          key={tocRenderKey}
          position={tocPosition}
        />
      )}
    </div>
  )
}
