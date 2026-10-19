import { DEFAULT_MODEL_PROVIDER_LIST, MODEL_TYPES } from "@folionote/model-list"
import type { ModelType } from "@folionote/model-list"
import { Button } from "@folionote/ui/button"
import { Input } from "@folionote/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@folionote/ui/select"
import { Skeleton } from "@folionote/ui/skeleton"
import { Switch } from "@folionote/ui/switch"
import {
  Cancel01Icon,
  Key01Icon,
  Search01Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { ProviderLogo } from "@/components/brand-logo"
import { ModelProviderCard } from "@/components/settings/model-provider-card"
import {
  useAiModelCatalog,
  useSetModelEnabled,
  useSetProviderEnabled
} from "@/hooks/use-ai-model-catalog"
import type {
  CatalogModel,
  CatalogProvider
} from "@/hooks/use-ai-model-catalog"
import { useModelProviderConfig } from "@/hooks/use-model-provider-config"
import type { ModelProviderConfig } from "@/hooks/use-model-provider-config"

export const Route = createFileRoute("/_app/settings/models")({
  component: ModelsSettingsPage
})

const RECENCY_WINDOW_MONTHS = 6

/**
 * Cutoff date (ISO `YYYY-MM-DD`) for the default "recent models" filter.
 *
 * Anchored to the first day of the month `RECENCY_WINDOW_MONTHS` months ago, so
 * the value is stable for the whole calendar month and only rolls over on the
 * 1st. This avoids recomputing a sliding cutoff on every render and keeps the
 * memoized filter dependency stable.
 */
function getRecencyCutoff(now: Date): string {
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - RECENCY_WINDOW_MONTHS, 1)
  )
  return cutoff.toISOString().slice(0, 10)
}

function ModelsSettingsPage() {
  const { t } = useTranslation()
  const {
    config,
    isLoaded,
    getProviderConfig,
    updateProviderConfig,
    removeProviderConfig,
    setDefaultProvider
  } = useModelProviderConfig()

  const {
    providers: catalogProviders,
    models: catalogModels,
    isLoading: isCatalogLoading
  } = useAiModelCatalog()
  const setModelEnabled = useSetModelEnabled()
  const setProviderEnabled = useSetProviderEnabled()

  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<ModelType | "all">("all")
  const [recentOnly, setRecentOnly] = useState(true)
  // Computed once per mount; stable for the whole calendar month (see getRecencyCutoff).
  const recencyCutoff = useMemo(() => getRecencyCutoff(new Date()), [])

  const handleConfigure = useCallback(
    (providerId: string, providerConfig: ModelProviderConfig) => {
      updateProviderConfig(providerId, providerConfig)
    },
    [updateProviderConfig]
  )

  const handleRemove = useCallback(
    (providerId: string) => {
      removeProviderConfig(providerId)
    },
    [removeProviderConfig]
  )

  const handleSetDefault = useCallback(
    (providerId: string) => {
      setDefaultProvider(providerId)
    },
    [setDefaultProvider]
  )

  const handleToggleModel = useCallback(
    (model: CatalogModel) => {
      setModelEnabled.mutate({
        providerId: model.providerId,
        id: model.id,
        type: model.type as ModelType,
        enabled: !model.enabled
      })
    },
    [setModelEnabled]
  )

  const handleToggleProvider = useCallback(
    (provider: CatalogProvider) => {
      setProviderEnabled.mutate({
        providerId: provider.id,
        enabled: !provider.enabled
      })
    },
    [setProviderEnabled]
  )

  const filteredModels = useMemo(() => {
    let result = catalogModels

    if (recentOnly) {
      result = result.filter(
        (m) => m.releasedAt != null && m.releasedAt >= recencyCutoff
      )
    }

    if (typeFilter !== "all") {
      result = result.filter((m) => m.type === typeFilter)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(
        (m) =>
          m.displayName.toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query) ||
          m.providerId.toLowerCase().includes(query)
      )
    }

    return result
  }, [catalogModels, typeFilter, searchQuery, recentOnly, recencyCutoff])

  const modelsByProvider = useMemo(() => {
    const grouped = new Map<string, CatalogModel[]>()
    for (const model of filteredModels) {
      const existing = grouped.get(model.providerId) || []
      existing.push(model)
      grouped.set(model.providerId, existing)
    }
    return grouped
  }, [filteredModels])

  const getProviderInfo = useCallback(
    (providerId: string): CatalogProvider =>
      catalogProviders.find((p) => p.id === providerId) || {
        id: providerId,
        name: providerId,
        enabled: false,
        source: "seed"
      },
    [catalogProviders]
  )

  const enabledCount = catalogModels.filter((m) => m.enabled).length
  const totalCount = catalogModels.length

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold md:text-2xl">
          {t("settings.models.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.models.description")}
        </p>
      </div>

      {/* BYOK callout */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-border/60 bg-surface-secondary/30 p-4">
        <HugeiconsIcon
          className="mt-0.5 size-5 shrink-0 text-primary"
          icon={Key01Icon}
        />
        <div className="flex-1">
          <p className="text-sm font-medium">
            {t("settings.models.byokTitle")}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {t("settings.models.byokDescription")}
          </p>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="space-y-3">
        {isLoaded ? (
          DEFAULT_MODEL_PROVIDER_LIST.map((provider) => (
            <ModelProviderCard
              config={getProviderConfig(provider.id)}
              isDefault={config.defaultProvider === provider.id}
              key={provider.id}
              onConfigure={handleConfigure}
              onRemove={handleRemove}
              onSetDefault={handleSetDefault}
              provider={provider}
            />
          ))
        ) : (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton className="h-20 w-full rounded-xl" key={i} />
            ))}
          </div>
        )}
      </div>

      {/* Model List */}
      <div className="mt-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {t("settings.models.modelList.enabledCount", {
                count: enabledCount
              })}
            </span>
            <span className="text-muted-foreground/30">/</span>
            <span>
              {t("settings.models.modelList.totalCount", {
                count: totalCount
              })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Switch
                aria-label={t("settings.models.modelList.recentOnly")}
                checked={recentOnly}
                onCheckedChange={setRecentOnly}
              />
              <span className="text-sm whitespace-nowrap text-muted-foreground">
                {t("settings.models.modelList.recentOnly")}
              </span>
            </div>

            <Select
              onValueChange={(value) =>
                setTypeFilter(value as ModelType | "all")
              }
              value={typeFilter}
            >
              <SelectTrigger className="h-8 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("settings.models.modelList.allTypes")}
                </SelectItem>
                {MODEL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`settings.models.modelList.type.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <HugeiconsIcon
                className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                icon={Search01Icon}
              />
              <Input
                className="h-8 w-[180px] pr-7 pl-8 text-sm"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("settings.models.modelList.searchPlaceholder")}
                value={searchQuery}
              />
              {searchQuery && (
                <Button
                  className="absolute top-1/2 right-1 size-5 -translate-y-1/2"
                  onClick={() => setSearchQuery("")}
                  size="icon"
                  variant="ghost"
                >
                  <HugeiconsIcon className="size-3" icon={Cancel01Icon} />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="divide-y rounded-lg border bg-card">
          <ModelListContent
            filteredModels={filteredModels}
            getProviderInfo={getProviderInfo}
            isCatalogLoading={isCatalogLoading}
            modelsByProvider={modelsByProvider}
            onToggleModel={handleToggleModel}
            onToggleProvider={handleToggleProvider}
            t={t}
          />
        </div>
      </div>

      <div className="h-8" />
    </div>
  )
}

function ModelListContent({
  isCatalogLoading,
  filteredModels,
  modelsByProvider,
  getProviderInfo,
  onToggleModel,
  onToggleProvider,
  t
}: {
  isCatalogLoading: boolean
  filteredModels: CatalogModel[]
  modelsByProvider: Map<string, CatalogModel[]>
  getProviderInfo: (id: string) => CatalogProvider
  onToggleModel: (model: CatalogModel) => void
  onToggleProvider: (provider: CatalogProvider) => void
  t: ReturnType<typeof useTranslation>["t"]
}) {
  if (isCatalogLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton className="h-12 w-full" key={i} />
        ))}
      </div>
    )
  }

  if (filteredModels.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        {t("settings.models.modelList.noResults")}
      </div>
    )
  }

  return (
    <>
      {[...modelsByProvider.entries()].map(([providerId, models]) => (
        <ModelProviderGroup
          getProviderInfo={getProviderInfo}
          key={providerId}
          models={models}
          onToggleModel={onToggleModel}
          onToggleProvider={onToggleProvider}
          providerId={providerId}
          t={t}
        />
      ))}
    </>
  )
}

function ModelProviderGroup({
  providerId,
  models,
  getProviderInfo,
  onToggleModel,
  onToggleProvider,
  t
}: {
  providerId: string
  models: CatalogModel[]
  getProviderInfo: (id: string) => CatalogProvider
  onToggleModel: (model: CatalogModel) => void
  onToggleProvider: (provider: CatalogProvider) => void
  t: ReturnType<typeof useTranslation>["t"]
}) {
  const provider = getProviderInfo(providerId)

  return (
    <div>
      <div className="flex items-center justify-between bg-surface-secondary/20 px-4 py-2">
        <div className="flex items-center gap-2">
          <ProviderLogo
            className="size-4"
            id={provider.id}
            logo={provider.logo}
            name={provider.name}
          />
          <span className="text-sm font-medium">{provider.name}</span>
          <span className="text-xs text-muted-foreground">
            ({models.length})
          </span>
        </div>
        <Switch
          aria-label={t("settings.models.modelList.toggleProvider", {
            provider: provider.name
          })}
          checked={provider.enabled}
          onCheckedChange={() => onToggleProvider(provider)}
        />
      </div>

      <div className="divide-y divide-border/50">
        {models.map((model) => (
          <ModelRow
            key={`${model.providerId}-${model.id}-${model.type}`}
            model={model}
            onToggle={onToggleModel}
            t={t}
          />
        ))}
      </div>
    </div>
  )
}

function ModelRow({
  model,
  onToggle,
  t
}: {
  model: CatalogModel
  onToggle: (model: CatalogModel) => void
  t: ReturnType<typeof useTranslation>["t"]
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-surface-secondary/10">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm">{model.displayName}</span>
          <span className="shrink-0 rounded bg-surface-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
            {t(`settings.models.modelList.type.${model.type}`)}
          </span>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {model.id}
        </div>
      </div>
      <Switch
        checked={model.enabled}
        className="ml-4 shrink-0"
        onCheckedChange={() => onToggle(model)}
      />
    </div>
  )
}
