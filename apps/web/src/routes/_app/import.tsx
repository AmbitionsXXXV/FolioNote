import {
  Button,
  Description,
  Label,
  Radio,
  RadioGroup,
  Switch,
  Tabs
} from "@heroui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import {
  ClaudePageSourcePanel,
  GoogleDocsSourcePanel,
  NotionSourcePanel,
  WebSourcePanel
} from "@/components/imports/import-source-panels"
import type { ImportSourceInput } from "@/components/imports/import-source-panels"
import { IMPORT_SOURCE_KINDS } from "@/lib/imports"
import type { ImportSourceKind } from "@/lib/imports"
import { orpc } from "@/utils/orpc"

const importSearchSchema = z.object({
  source: z
    .enum(["notion", "google_docs", "claude_page", "web"])
    .catch("notion")
})

export const Route = createFileRoute("/_app/import")({
  component: ImportPage,
  validateSearch: importSearchSchema
})

type ImportMode = "snapshot" | "watch" | "pull"

function defaultModeFor(kind: ImportSourceKind): ImportMode {
  return kind === "notion" ? "pull" : "watch"
}

/** Fall back when the chosen mode isn't available for this source. */
function effectiveModeOf(
  mode: ImportMode,
  canPull: boolean,
  canWatch: boolean
): ImportMode {
  if (mode === "pull" && canPull) return "pull"
  if (mode !== "snapshot" && canWatch) return "watch"
  return "snapshot"
}

/** Sources with a revision the server can poll (Notion, Google Docs). */
const WATCHABLE: ReadonlySet<ImportSourceInput["provider"]> = new Set([
  "notion",
  "google_docs"
])

function SourcePanel({
  kind,
  onSourceChange
}: {
  kind: ImportSourceKind
  onSourceChange: (source: ImportSourceInput | null) => void
}) {
  switch (kind) {
    case "notion":
      return <NotionSourcePanel onSourceChange={onSourceChange} />
    case "google_docs":
      return <GoogleDocsSourcePanel onSourceChange={onSourceChange} />
    case "claude_page":
      return <ClaudePageSourcePanel onSourceChange={onSourceChange} />
    default:
      return <WebSourcePanel onSourceChange={onSourceChange} />
  }
}

function PreviewPanel({ source }: { source: ImportSourceInput | null }) {
  const { t } = useTranslation()
  const preview = useQuery({
    ...orpc.imports.preview.queryOptions({
      input: { source: source as ImportSourceInput }
    }),
    enabled: source !== null,
    retry: false,
    staleTime: 60_000
  })

  return (
    <aside
      aria-label={t("imports.preview.title")}
      className="min-w-0 flex-[1_1_340px] overflow-hidden rounded-xl border border-border"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs text-muted-foreground">
        <span className="text-sm font-semibold text-foreground">
          {t("imports.preview.title")}
        </span>
        {preview.data ? (
          <span>
            {t("imports.preview.entries", { count: preview.data.items.length })}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-5 p-4">
        {source === null ? (
          <p className="text-sm text-muted-foreground">
            {t("imports.preview.empty")}
          </p>
        ) : null}
        {source !== null && preview.isPending ? (
          <p className="text-sm text-muted-foreground">
            {t("imports.preview.loading")}
          </p>
        ) : null}
        {preview.error ? (
          <p className="text-sm text-danger" role="alert">
            {preview.error.message}
          </p>
        ) : null}
        {preview.data?.items.map((item) => (
          <article className="flex flex-col gap-2" key={item.title}>
            <h3 className="text-lg leading-snug font-semibold" lang="ja">
              {item.title}
            </h3>
            <p className="line-clamp-4 text-sm text-muted-foreground" lang="ja">
              {item.excerpt}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("imports.preview.blocks", { count: item.blockCount })}
            </p>
            {item.warnings.length > 0 ? (
              <div>
                <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  {t("imports.preview.changes")}
                </div>
                <ul className="rounded-[10px] bg-surface-secondary py-1 text-sm">
                  {item.warnings.map((warning) => (
                    <li
                      className="flex justify-between gap-3 px-3 py-1.5"
                      key={warning.kind}
                    >
                      <span>
                        {t(`imports.warnings.${warning.kind}.from`, {
                          defaultValue: warning.from
                        })}
                        {warning.count > 1 ? ` ×${warning.count}` : ""}
                      </span>
                      <span className="text-accent">
                        {t(`imports.warnings.${warning.kind}.to`, {
                          defaultValue: warning.to
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </aside>
  )
}

function ImportPage() {
  const { t } = useTranslation()
  const { source: kind } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [source, setSource] = useState<ImportSourceInput | null>(null)
  const [mode, setMode] = useState<ImportMode>(defaultModeFor(kind))
  const [toInbox, setToInbox] = useState(false)
  const canWatch = source !== null && WATCHABLE.has(source.provider)
  // Pull needs Notion's stable block ids.
  const canPull = kind === "notion"
  const effectiveMode = effectiveModeOf(mode, canPull, canWatch)

  const commit = useMutation(
    orpc.imports.commit.mutationOptions({
      onSuccess: async (result) => {
        await queryClient.invalidateQueries({ queryKey: ["entries"] })
        await queryClient.invalidateQueries({ queryKey: orpc.imports.key() })
        toast.success(t("imports.done", { count: result.entries.length }))
        const [first] = result.entries
        if (first) {
          await navigate({ to: "/entries/$id", params: { id: first.id } })
        }
      },
      onError: (error) => {
        toast.error(error.message)
      }
    })
  )

  const selectKind = (next: ImportSourceKind) => {
    setSource(null)
    setMode(defaultModeFor(next))
    void navigate({ to: "/import", search: { source: next }, replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-10 pb-16 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {t("imports.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("imports.subtitle")}
          </p>
        </div>
        <Link
          className="text-sm text-accent hover:underline"
          to="/settings/connections"
        >
          {t("imports.manageConnections")}
        </Link>
      </header>

      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-label={t("imports.sourceLabel")}
          className="min-w-0 flex-[999_1_520px] rounded-xl border border-border bg-surface/40"
        >
          <Tabs
            onSelectionChange={(key) => selectKind(key as ImportSourceKind)}
            selectedKey={kind}
          >
            <Tabs.ListContainer className="border-b border-border p-2">
              <Tabs.List aria-label={t("imports.sourceLabel")}>
                {IMPORT_SOURCE_KINDS.map((option) => (
                  // No Tabs.Indicator: its slide animation starts from the
                  // default tab on a deep link and can stick mid-translate.
                  <Tabs.Tab
                    className="data-[selected=true]:bg-segment data-[selected=true]:shadow-surface"
                    id={option}
                    key={option}
                  >
                    {t(`imports.sources.${option}`)}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {IMPORT_SOURCE_KINDS.map((option) => (
              <Tabs.Panel className="p-5" id={option} key={option}>
                <SourcePanel kind={option} onSourceChange={setSource} />
              </Tabs.Panel>
            ))}
          </Tabs>

          <div className="flex flex-col gap-5 border-t border-border p-5">
            <RadioGroup
              name="import-mode"
              onChange={(value) => setMode(value as ImportMode)}
              orientation="horizontal"
              value={effectiveMode}
            >
              <Label>{t("imports.mode.label")}</Label>
              {canPull ? (
                <Radio value="pull">
                  <Radio.Content>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    {t("imports.mode.pull")}
                  </Radio.Content>
                  <Description>{t("imports.mode.pullDesc")}</Description>
                </Radio>
              ) : null}
              <Radio value="snapshot">
                <Radio.Content>
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  {t("imports.mode.snapshot")}
                </Radio.Content>
                <Description>{t("imports.mode.snapshotDesc")}</Description>
              </Radio>
              <Radio isDisabled={!canWatch} value="watch">
                <Radio.Content>
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  {t("imports.mode.watch")}
                </Radio.Content>
                <Description>
                  {canWatch || source === null
                    ? t("imports.mode.watchDesc")
                    : t("imports.mode.watchUnavailable")}
                </Description>
              </Radio>
            </RadioGroup>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Switch
                className="flex-row items-center gap-2"
                isSelected={toInbox}
                onChange={setToInbox}
                size="sm"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Content>
                  <Label className="text-sm">{t("imports.toInbox")}</Label>
                </Switch.Content>
              </Switch>
              <Button
                isDisabled={source === null}
                isPending={commit.isPending}
                onPress={() => {
                  if (!source) return
                  commit.mutate({
                    source,
                    mode: effectiveMode,
                    isInbox: toInbox
                  })
                }}
                variant="primary"
              >
                {t("imports.submit")}
              </Button>
            </div>
          </div>
        </section>

        <PreviewPanel source={source} />
      </div>
    </div>
  )
}
