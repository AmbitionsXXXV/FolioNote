import { Button } from "@heroui/react"
import { PlugSocketIcon } from "@hugeicons/core-free-icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { SyncStatusLabel } from "@/components/imports/entry-source-status"
import { PageContainer } from "@/components/page-container"
import { PageHeader } from "@/components/page-header"
import { notionConnectUrl, requestGoogleDocsAccess } from "@/lib/imports"
import { orpc } from "@/utils/orpc"

const connectionsSearchSchema = z.object({
  notion: z.enum(["connected", "denied", "failed", "unauthorized"]).optional()
})

export const Route = createFileRoute("/_app/settings/connections")({
  component: ConnectionsPage,
  validateSearch: connectionsSearchSchema
})

function SourceCard({
  mark,
  title,
  subtitle,
  description,
  children
}: {
  mark: string
  title: string
  subtitle: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-7 place-items-center rounded-md bg-foreground text-[13px] font-bold text-background"
        >
          {mark}
        </span>
        <div className="min-w-0">
          <div className="font-semibold">{title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {children ? (
        <div className="mt-auto flex flex-wrap gap-1.5">{children}</div>
      ) : null}
    </div>
  )
}

function ConnectLink({
  children,
  href
}: {
  children: React.ReactNode
  href: string
}) {
  return (
    <a
      className="inline-flex h-8 items-center rounded-lg bg-surface-secondary px-3 text-sm hover:bg-surface-tertiary"
      href={href}
    >
      {children}
    </a>
  )
}

function useNotionResultToast() {
  const { t } = useTranslation()
  const { notion } = Route.useSearch()
  const navigate = Route.useNavigate()
  useEffect(() => {
    if (!notion) return
    if (notion === "connected") {
      toast.success(t("imports.notion.connected"))
    } else {
      toast.error(t(`imports.notion.result.${notion}`))
    }
    void navigate({ search: {}, replace: true })
  }, [notion, navigate, t])
}

function SyncedEntries() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const links = useQuery(orpc.imports.listLinks.queryOptions())
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: orpc.imports.key() })
  const check = useMutation(
    orpc.imports.checkLink.mutationOptions({ onSettled: refresh })
  )

  return (
    <section aria-labelledby="synced-heading" className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold" id="synced-heading">
        {t("imports.synced.title")}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-secondary/60 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">
                {t("imports.synced.entry")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("imports.synced.source")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("imports.synced.mode")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("imports.synced.status")}
              </th>
              <th className="px-3 py-2 font-medium">
                <span className="sr-only">{t("imports.synced.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {links.data?.map((link) => (
              <tr className="border-t border-border" key={link.id}>
                <td className="px-3 py-2.5">
                  <Link
                    className="font-medium hover:underline"
                    params={{ id: link.entryId }}
                    to="/entries/$id"
                  >
                    {link.title || t("entry.untitled")}
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  {t(`imports.providers.${link.provider}`)}
                </td>
                <td className="px-3 py-2.5">
                  {t(`imports.mode.${link.mode}`)}
                </td>
                <td className="px-3 py-2.5">
                  <SyncStatusLabel status={link.status} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  {link.mode === "watch" ? (
                    <Button
                      isDisabled={check.isPending}
                      onPress={() => check.mutate({ entryId: link.entryId })}
                      size="sm"
                      variant="ghost"
                    >
                      {t("imports.synced.check")}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {links.data?.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-6 text-center text-muted-foreground"
                  colSpan={5}
                >
                  {t("imports.synced.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ConnectionsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false)
  const connections = useQuery(orpc.imports.connections.queryOptions())
  const disconnect = useMutation(
    orpc.imports.disconnectNotion.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: orpc.imports.key() })
    })
  )
  useNotionResultToast()

  const here =
    typeof window === "undefined"
      ? ""
      : (window.location.href.split("?")[0] ?? "")
  const notion = connections.data?.notion
  const google = connections.data?.google
  const googleReady = Boolean(google?.linked && google.hasDocsScope)
  let googleSubtitle = t("imports.notConnected")
  if (googleReady) {
    googleSubtitle = t("imports.google.ready")
  } else if (google?.linked) {
    googleSubtitle = t("imports.google.signedIn")
  }

  const allowGoogle = async () => {
    setIsLinkingGoogle(true)
    try {
      await requestGoogleDocsAccess(here)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("imports.failed"))
      setIsLinkingGoogle(false)
    }
  }

  return (
    <PageContainer width="default">
      <PageHeader
        description={t("imports.connections.description")}
        icon={PlugSocketIcon}
        title={t("imports.connections.title")}
      />

      <div className="flex flex-col gap-8">
        <section
          aria-labelledby="sources-heading"
          className="flex flex-col gap-3"
        >
          <h2 className="text-[15px] font-semibold" id="sources-heading">
            {t("imports.connections.sources")}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3">
            <SourceCard
              description={t("imports.notion.cardDescription")}
              mark="N"
              subtitle={
                notion?.connections.length
                  ? notion.connections
                      .map((c) => c.workspaceName ?? "Notion")
                      .join(" · ")
                  : t("imports.notConnected")
              }
              title="Notion"
            >
              {notion?.configured ? (
                <ConnectLink href={notionConnectUrl(here)}>
                  {notion.connections.length
                    ? t("imports.notion.editAccess")
                    : t("imports.notion.connect")}
                </ConnectLink>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t("imports.notion.notConfigured")}
                </span>
              )}
              {notion?.connections.map((connection) => (
                <Button
                  isDisabled={disconnect.isPending}
                  key={connection.id}
                  onPress={() =>
                    disconnect.mutate({ connectionId: connection.id })
                  }
                  size="sm"
                  variant="ghost"
                >
                  {t("imports.notion.disconnect", {
                    name: connection.workspaceName ?? "Notion"
                  })}
                </Button>
              ))}
            </SourceCard>

            <SourceCard
              description={t("imports.google.cardDescription")}
              mark="G"
              subtitle={googleSubtitle}
              title="Google Docs"
            >
              {google?.configured && !googleReady ? (
                <Button
                  isDisabled={isLinkingGoogle}
                  onPress={allowGoogle}
                  size="sm"
                  variant="primary"
                >
                  {t("imports.google.allow")}
                </Button>
              ) : null}
              {google && !google.configured ? (
                <span className="text-xs text-muted-foreground">
                  {t("imports.google.notConfigured")}
                </span>
              ) : null}
            </SourceCard>

            <SourceCard
              description={t("imports.claude.cardDescription")}
              mark="C"
              subtitle={t("imports.claude.subtitle")}
              title={t("imports.providers.claude_page")}
            >
              <Link
                className="inline-flex h-8 items-center rounded-lg bg-surface-secondary px-3 text-sm hover:bg-surface-tertiary"
                search={{ source: "claude_page" }}
                to="/import"
              >
                {t("imports.claude.import")}
              </Link>
            </SourceCard>

            <SourceCard
              description={t("imports.web.cardDescription")}
              mark="W"
              subtitle={t("imports.web.subtitle")}
              title={t("imports.providers.web")}
            />
          </div>
        </section>

        <SyncedEntries />
      </div>
    </PageContainer>
  )
}
