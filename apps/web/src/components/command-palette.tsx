import { Command } from "@heroui-pro/react/command"
import {
  BookOpen01Icon,
  FilterIcon,
  InboxIcon,
  Link01Icon,
  Search01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useHotkey } from "@tanstack/react-hotkeys"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { useCommandPalette } from "@/contexts/command-palette-context"
import { useDebounce } from "@/hooks/use-debounce"
import { orpc } from "@/utils/orpc"

const SEARCH_DEBOUNCE_MS = 300

function HintKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-separator bg-surface-secondary px-1 font-sans text-[10px] text-muted">
      {children}
    </kbd>
  )
}

export function CommandPalette() {
  const { t } = useTranslation()
  const { open, setOpen, toggle } = useCommandPalette()
  const [search, setSearch] = useState("")
  const navigate = useNavigate()

  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS)

  useHotkey("Mod+K", (event) => {
    event.preventDefault()
    toggle()
  })

  // Reset the query whenever the palette closes.
  useEffect(() => {
    if (!open) {
      setSearch("")
    }
  }, [open])

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["command-search", debouncedSearch],
    queryFn: () =>
      orpc.search.entries.call({ query: debouncedSearch, limit: 5 }),
    enabled: debouncedSearch.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 1000
  })

  const isLoading = isFetching && debouncedSearch.length > 0
  const entries = searchResults?.items ?? []
  const hasQuery = search.trim().length > 0

  const runAction = useCallback(
    (action: () => void) => {
      setOpen(false)
      action()
    },
    [setOpen]
  )

  return (
    <Command>
      <Command.Backdrop isOpen={open} onOpenChange={setOpen} variant="blur">
        <Command.Container>
          {/* Items are server-filtered + conditionally rendered, so disable
              the built-in client-side filter and drive the list ourselves. */}
          <Command.Dialog
            // The Pro `.command__dialog` rule sets radius to calc(var(--radius)*2)
            // (~48px) and is unlayered, so it outranks Tailwind utilities — a
            // 48px radius clips the full-bleed input/footer rows at the corners.
            // Inline style guarantees the override; 16px matches HeroUI's convention.
            filter={() => true}
            inputValue={search}
            onInputChange={setSearch}
            style={{ borderRadius: "1rem" }}
          >
            <Command.InputGroup>
              <Command.InputGroup.Prefix>
                <HugeiconsIcon
                  className="size-4 text-muted"
                  icon={Search01Icon}
                />
              </Command.InputGroup.Prefix>
              <Command.InputGroup.Input
                onKeyDownCapture={(event) => {
                  // Close on Escape instead of React Aria SearchField's default
                  // "clear first, close second" — matches command-palette convention.
                  if (event.key === "Escape") {
                    event.preventDefault()
                    setOpen(false)
                  }
                }}
                placeholder={t("commandPalette.searchPlaceholder")}
              />
              {isLoading && (
                <Command.InputGroup.Suffix>
                  <span className="block size-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/70" />
                </Command.InputGroup.Suffix>
              )}
              <Command.InputGroup.ClearButton />
            </Command.InputGroup>

            <Command.List
              aria-label={t("commandPalette.title")}
              renderEmptyState={() => (
                <span className="text-sm text-muted">
                  {isLoading
                    ? t("commandPalette.searching")
                    : t("commandPalette.noResults")}
                </span>
              )}
            >
              {entries.length > 0 && (
                <Command.Group heading={t("commandPalette.entries")}>
                  {entries.map((entry) => (
                    <Command.Item
                      id={`entry-${entry.id}`}
                      key={entry.id}
                      onAction={() =>
                        runAction(() =>
                          navigate({
                            to: "/entries/$id",
                            params: { id: entry.id }
                          })
                        )
                      }
                      textValue={entry.title || t("commandPalette.untitled")}
                    >
                      <HugeiconsIcon
                        className="size-4 text-muted"
                        icon={Search01Icon}
                      />
                      <span className="line-clamp-1 flex-1">
                        {entry.title || t("commandPalette.untitled")}
                      </span>
                    </Command.Item>
                  ))}
                  <Command.Item
                    id="search-more"
                    onAction={() =>
                      runAction(() =>
                        navigate({ to: "/search", search: { q: search } })
                      )
                    }
                    textValue={t("commandPalette.advancedSearch")}
                  >
                    <HugeiconsIcon
                      className="size-4 text-muted"
                      icon={FilterIcon}
                    />
                    <span className="flex-1">
                      {t("commandPalette.advancedSearch")}
                    </span>
                  </Command.Item>
                </Command.Group>
              )}

              {hasQuery && entries.length === 0 && !isLoading && (
                <Command.Group>
                  <Command.Item
                    id="advanced-search"
                    onAction={() =>
                      runAction(() =>
                        navigate({ to: "/search", search: { q: search } })
                      )
                    }
                    textValue={t("commandPalette.tryAdvancedSearch")}
                  >
                    <HugeiconsIcon
                      className="size-4 text-muted"
                      icon={FilterIcon}
                    />
                    <span className="flex-1">
                      {t("commandPalette.tryAdvancedSearch")}
                    </span>
                  </Command.Item>
                </Command.Group>
              )}

              <Command.Group heading={t("commandPalette.quickNavigation")}>
                <Command.Item
                  id="nav-inbox"
                  onAction={() => runAction(() => navigate({ to: "/inbox" }))}
                  textValue={t("nav.inbox")}
                >
                  <HugeiconsIcon
                    className="size-4 text-muted"
                    icon={InboxIcon}
                  />
                  <span className="flex-1">{t("nav.inbox")}</span>
                </Command.Item>
                <Command.Item
                  id="nav-library"
                  onAction={() => runAction(() => navigate({ to: "/library" }))}
                  textValue={t("nav.library")}
                >
                  <HugeiconsIcon
                    className="size-4 text-muted"
                    icon={BookOpen01Icon}
                  />
                  <span className="flex-1">{t("nav.library")}</span>
                </Command.Item>
                <Command.Item
                  id="nav-sources"
                  onAction={() => runAction(() => navigate({ to: "/sources" }))}
                  textValue={t("nav.sources")}
                >
                  <HugeiconsIcon
                    className="size-4 text-muted"
                    icon={Link01Icon}
                  />
                  <span className="flex-1">{t("nav.sources")}</span>
                </Command.Item>
                <Command.Item
                  id="nav-search"
                  onAction={() =>
                    runAction(() =>
                      navigate({ to: "/search", search: { q: "" } })
                    )
                  }
                  textValue={t("search.advanced")}
                >
                  <HugeiconsIcon
                    className="size-4 text-muted"
                    icon={Search01Icon}
                  />
                  <span className="flex-1">{t("search.advanced")}</span>
                </Command.Item>
              </Command.Group>
            </Command.List>

            <Command.Footer className="flex items-center gap-3 text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <HintKey>↑</HintKey>
                <HintKey>↓</HintKey>
                {t("commandPalette.navigate")}
              </span>
              <span className="flex items-center gap-1">
                <HintKey>↵</HintKey>
                {t("commandPalette.select")}
              </span>
              <span className="flex items-center gap-1">
                <HintKey>esc</HintKey>
                {t("commandPalette.close")}
              </span>
            </Command.Footer>
          </Command.Dialog>
        </Command.Container>
      </Command.Backdrop>
    </Command>
  )
}
