import { getFaviconUrl, getHostname } from "@folionote/utils"
import {
  Button,
  Input,
  Label,
  SearchField,
  TextArea,
  TextField
} from "@heroui/react"
import { NotionIcon, Upload01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import type { ChangeEvent } from "react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { useDebounce } from "@/hooks/use-debounce"
import { pickGoogleDoc, readGooglePickerConfig } from "@/lib/google-picker"
import { notionConnectUrl, requestGoogleDocsAccess } from "@/lib/imports"
import { cn } from "@/lib/utils"
import { client, orpc } from "@/utils/orpc"

/** Mirrors ImportSourceSchema in packages/api/src/routers/imports.ts. */
export type ImportSourceInput =
  | { provider: "notion"; ref: string; connectionId?: string }
  | { provider: "google_docs"; ref: string }
  | { provider: "web"; url: string }
  | { provider: "claude_page"; markdown: string; title?: string; url?: string }

interface PanelProps {
  onSourceChange: (source: ImportSourceInput | null) => void
}

const SEARCH_DEBOUNCE_MS = 350
const MARKDOWN_FILE = /\.(md|markdown|txt)$/i

function currentUrl(): string {
  return window.location.href
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[10px] bg-surface-secondary px-3 py-2.5 text-sm text-muted-foreground">
      {children}
    </p>
  )
}

type NotionPageIcon =
  | { type: "emoji"; emoji: string }
  | { type: "image"; url: string }

/**
 * A clipped page shows its source site's favicon; otherwise the page's own
 * Notion icon, falling back to the Notion logo.
 */
function NotionPageGlyph({
  icon,
  sourceUrl
}: {
  icon: NotionPageIcon | null
  sourceUrl: string | null
}) {
  let imageUrl: string | null = null
  if (sourceUrl) {
    imageUrl = getFaviconUrl(sourceUrl)
  } else if (icon?.type === "image") {
    imageUrl = icon.url
  }
  if (imageUrl) {
    return (
      <img
        alt=""
        className="size-4 shrink-0 rounded-sm object-contain"
        loading="lazy"
        referrerPolicy="no-referrer"
        src={imageUrl}
      />
    )
  }
  if (icon?.type === "emoji") {
    return (
      <span aria-hidden="true" className="w-4 shrink-0 text-center leading-4">
        {icon.emoji}
      </span>
    )
  }
  return (
    <HugeiconsIcon
      aria-hidden="true"
      className="size-4 shrink-0 text-muted-foreground"
      icon={NotionIcon}
    />
  )
}

export function NotionSourcePanel({ onSourceChange }: PanelProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [link, setLink] = useState("")
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS)
  const connections = useQuery(orpc.imports.connections.queryOptions())
  const notion = connections.data?.notion
  const isConnected = (notion?.connections.length ?? 0) > 0
  const pages = useQuery({
    ...orpc.imports.searchNotion.queryOptions({
      input: { query: debouncedQuery }
    }),
    enabled: isConnected
  })

  if (connections.isPending) {
    return <Notice>{t("imports.loading")}</Notice>
  }
  if (!notion?.configured) {
    return <Notice>{t("imports.notion.notConfigured")}</Notice>
  }
  if (!isConnected) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          {t("imports.notion.connectHint")}
        </p>
        <a
          className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-accent-foreground"
          href={notionConnectUrl(currentUrl())}
        >
          {t("imports.notion.connect")}
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchField onChange={setQuery} value={query}>
        <Label>{t("imports.notion.searchLabel")}</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input
            placeholder={t("imports.notion.searchPlaceholder")}
          />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      <ul
        aria-label={t("imports.notion.pagesLabel")}
        className="flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-[10px] bg-surface-secondary p-1"
      >
        {pages.data?.map((page) => (
          <li key={page.id}>
            <button
              aria-pressed={selectedId === page.id}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-tertiary",
                selectedId === page.id && "bg-accent/12 hover:bg-accent/16"
              )}
              onClick={() => {
                setSelectedId(page.id)
                setLink("")
                onSourceChange({
                  provider: "notion",
                  ref: page.id,
                  connectionId: page.connectionId
                })
              }}
              type="button"
            >
              <NotionPageGlyph icon={page.icon} sourceUrl={page.sourceUrl} />
              <span className="min-w-0 flex-1 truncate">{page.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {page.sourceUrl
                  ? getHostname(page.sourceUrl)
                  : page.workspaceName}
              </span>
            </button>
          </li>
        ))}
        {pages.data?.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">
            {t("imports.notion.noPages")}
          </li>
        ) : null}
        {pages.isPending ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">
            {t("imports.loading")}
          </li>
        ) : null}
      </ul>

      <TextField
        onChange={(value) => {
          setLink(value)
          setSelectedId(null)
          onSourceChange(
            value.trim() ? { provider: "notion", ref: value.trim() } : null
          )
        }}
        value={link}
      >
        <Label>{t("imports.notion.linkLabel")}</Label>
        <Input placeholder="https://www.notion.so/…" />
      </TextField>

      <p className="text-xs text-muted-foreground">
        {t("imports.notion.notListed")}{" "}
        <a
          className="text-accent underline-offset-2 hover:underline"
          href={notionConnectUrl(currentUrl())}
        >
          {t("imports.notion.editAccess")}
        </a>
      </p>
    </div>
  )
}

export function GoogleDocsSourcePanel({ onSourceChange }: PanelProps) {
  const { t } = useTranslation()
  const [link, setLink] = useState("")
  const [picked, setPicked] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const connections = useQuery(orpc.imports.connections.queryOptions())
  const google = connections.data?.google
  const pickerConfig = readGooglePickerConfig()

  const allowAccess = async () => {
    setIsWorking(true)
    try {
      await requestGoogleDocsAccess(currentUrl())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("imports.failed"))
      setIsWorking(false)
    }
  }

  const openPicker = async () => {
    if (!pickerConfig) return
    setIsWorking(true)
    try {
      const { accessToken } = await client.imports.googlePickerToken()
      const doc = await pickGoogleDoc(pickerConfig, accessToken)
      if (doc) {
        setPicked(doc.name)
        setLink("")
        onSourceChange({ provider: "google_docs", ref: doc.id })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("imports.failed"))
    } finally {
      setIsWorking(false)
    }
  }

  if (connections.isPending) {
    return <Notice>{t("imports.loading")}</Notice>
  }
  if (!google?.configured) {
    return <Notice>{t("imports.google.notConfigured")}</Notice>
  }
  if (!(google.linked && google.hasDocsScope)) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          {google.linked
            ? t("imports.google.scopeHint")
            : t("imports.google.linkHint")}
        </p>
        <Button
          isDisabled={isWorking}
          onPress={allowAccess}
          size="sm"
          variant="primary"
        >
          {t("imports.google.allow")}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {pickerConfig ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            isDisabled={isWorking}
            onPress={openPicker}
            size="sm"
            variant="secondary"
          >
            {t("imports.google.pick")}
          </Button>
          {picked ? <span className="text-sm">{picked}</span> : null}
        </div>
      ) : null}
      <TextField
        onChange={(value) => {
          setLink(value)
          setPicked(null)
          onSourceChange(
            value.trim() ? { provider: "google_docs", ref: value.trim() } : null
          )
        }}
        value={link}
      >
        <Label>{t("imports.google.linkLabel")}</Label>
        <Input placeholder="https://docs.google.com/document/d/…" />
      </TextField>
      <p className="text-xs text-muted-foreground">
        {t("imports.google.pickedOnly")}
      </p>
    </div>
  )
}

export function ClaudePageSourcePanel({ onSourceChange }: PanelProps) {
  const { t } = useTranslation()
  const [url, setUrl] = useState("")
  const [markdown, setMarkdown] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)

  const emit = (nextMarkdown: string, nextUrl: string) => {
    onSourceChange(
      nextMarkdown.trim()
        ? {
            provider: "claude_page",
            markdown: nextMarkdown,
            url: nextUrl.trim() || undefined
          }
        : null
    )
  }

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!(file && MARKDOWN_FILE.test(file.name))) return
    const text = await file.text()
    setMarkdown(text)
    emit(text, url)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("imports.claude.hint")}
      </p>
      <TextField
        onChange={(value) => {
          setUrl(value)
          emit(markdown, value)
        }}
        type="url"
        value={url}
      >
        <Label>{t("imports.claude.linkLabel")}</Label>
        <Input placeholder="https://claude.ai/…" />
      </TextField>
      <TextField
        onChange={(value) => {
          setMarkdown(value)
          emit(value, url)
        }}
        value={markdown}
      >
        <Label>{t("imports.claude.markdownLabel")}</Label>
        <TextArea className="min-h-48 font-mono text-xs" placeholder="# …" />
      </TextField>
      <div>
        <input
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          aria-label={t("imports.claude.file")}
          className="sr-only"
          onChange={readFile}
          ref={fileInput}
          type="file"
        />
        <Button
          onPress={() => fileInput.current?.click()}
          size="sm"
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4"
            icon={Upload01Icon}
          />
          {t("imports.claude.file")}
        </Button>
      </div>
    </div>
  )
}

export function WebSourcePanel({ onSourceChange }: PanelProps) {
  const { t } = useTranslation()
  const [url, setUrl] = useState("")

  const submit = () => {
    const trimmed = url.trim()
    onSourceChange(trimmed ? { provider: "web", url: trimmed } : null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <TextField
          className="flex-1"
          onChange={setUrl}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              submit()
            }
          }}
          type="url"
          value={url}
        >
          <Label>{t("imports.web.urlLabel")}</Label>
          <Input
            inputMode="url"
            placeholder="https://www3.nhk.or.jp/news/easy/…"
          />
        </TextField>
        <Button isDisabled={!url.trim()} onPress={submit} variant="secondary">
          {t("imports.web.fetch")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("imports.web.hint")}</p>
    </div>
  )
}
