import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@folionote/ui/alert-dialog"
import { Badge } from "@folionote/ui/badge"
import { Button } from "@folionote/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@folionote/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@folionote/ui/dialog"
import { Input } from "@folionote/ui/input"
import { Label } from "@folionote/ui/label"
import {
  Add01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Key01Icon,
  LinkSquare02Icon,
  Tick02Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ProviderLogo } from "@/components/brand-logo"
import { useAiProviderConfig } from "@/hooks/use-ai-provider-config"
import { AI_PROVIDERS } from "@/lib/ai-provider-config"
import type { AiProviderInfo } from "@/lib/ai-provider-config"
import { cn } from "@/lib/utils"

interface ProviderItemProps {
  provider: AiProviderInfo
  isConfigured: boolean
  isDefault: boolean
  onConfigure: () => void
  onSetDefault: () => void
  onRemove: () => void
}

function ProviderItem({
  provider,
  isConfigured,
  isDefault,
  onConfigure,
  onSetDefault,
  onRemove
}: ProviderItemProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-3 transition-colors",
        isDefault && "border-primary/50 bg-primary/5"
      )}
    >
      <div className="flex items-center gap-3">
        <ProviderLogo
          className="size-8"
          id={provider.id}
          name={provider.name}
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{provider.name}</span>
            {isConfigured && (
              <Badge className="gap-1" variant="secondary">
                <HugeiconsIcon
                  className="size-3"
                  icon={CheckmarkCircle02Icon}
                />
                {t("aiProvider.configured")}
              </Badge>
            )}
            {isDefault && (
              <Badge className="gap-1" variant="default">
                {t("aiProvider.default")}
              </Badge>
            )}
          </div>
          <a
            className="text-xs text-muted-foreground hover:text-primary hover:underline"
            href={provider.docsUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t("aiProvider.getApiKey")}
            <HugeiconsIcon
              className="ml-1 inline-block size-3"
              icon={LinkSquare02Icon}
            />
          </a>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isConfigured && !isDefault && (
          <Button
            aria-label={t("aiProvider.setAsDefault")}
            onClick={onSetDefault}
            size="sm"
            variant="ghost"
          >
            <HugeiconsIcon className="mr-1 size-4" icon={Tick02Icon} />
            {t("aiProvider.setAsDefault")}
          </Button>
        )}
        <Button
          onClick={onConfigure}
          size="sm"
          variant={isConfigured ? "outline" : "default"}
        >
          <HugeiconsIcon
            className="mr-1 size-4"
            icon={isConfigured ? Key01Icon : Add01Icon}
          />
          {isConfigured ? t("aiProvider.edit") : t("aiProvider.configure")}
        </Button>
        {isConfigured && (
          <Button
            aria-label={t("aiProvider.remove")}
            onClick={onRemove}
            size="icon"
            variant="ghost"
          >
            <HugeiconsIcon
              className="size-4 text-destructive"
              icon={Delete02Icon}
            />
          </Button>
        )}
      </div>
    </div>
  )
}

interface ConfigDialogProps {
  provider: AiProviderInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  initialApiKey?: string
  initialBaseUrl?: string
  onSave: (apiKey: string, baseUrl: string) => void
}

function ConfigDialog({
  provider,
  open,
  onOpenChange,
  initialApiKey = "",
  initialBaseUrl = "",
  onSave
}: ConfigDialogProps) {
  const { t } = useTranslation()
  const [apiKey, setApiKey] = useState(initialApiKey)
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl)

  // Reset form when provider changes
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setApiKey(initialApiKey)
        setBaseUrl(initialBaseUrl)
      }
      onOpenChange(nextOpen)
    },
    [initialApiKey, initialBaseUrl, onOpenChange]
  )

  const handleSave = useCallback(() => {
    onSave(apiKey, baseUrl)
    onOpenChange(false)
  }, [apiKey, baseUrl, onSave, onOpenChange])

  if (!provider) {
    return null
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ProviderLogo
              className="size-6"
              id={provider.id}
              name={provider.name}
            />
            {t("aiProvider.configureProvider", { provider: provider.name })}
          </DialogTitle>
          <DialogDescription>
            {t("aiProvider.configureDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="provider-api-key">{t("aiProvider.apiKey")}</Label>
            <Input
              autoComplete="off"
              id="provider-api-key"
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("aiProvider.apiKeyPlaceholder", {
                provider: provider.name
              })}
              spellCheck={false}
              type="password"
              value={apiKey}
            />
            <p className="text-xs text-muted-foreground">
              {t("aiProvider.apiKeyHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="provider-base-url">
              {t("aiProvider.baseUrl")}
              <span className="ml-1 text-muted-foreground">
                ({t("common.optional")})
              </span>
            </Label>
            <Input
              autoComplete="off"
              id="provider-base-url"
              inputMode="url"
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={provider.defaultBaseUrl}
              spellCheck={false}
              type="url"
              value={baseUrl}
            />
            <p className="text-xs text-muted-foreground">
              {t("aiProvider.baseUrlHint")}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            {t("common.cancel")}
          </Button>
          <Button disabled={!apiKey.trim()} onClick={handleSave}>
            {t("common.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * AI Provider settings card for managing API keys per provider.
 */
export function AiProviderSettings() {
  const { t } = useTranslation()
  const {
    config,
    isLoaded,
    getProviderConfig,
    isProviderConfigured,
    updateProviderConfig,
    removeProviderConfig,
    setDefaultProvider
  } = useAiProviderConfig()

  const [configProvider, setConfigProvider] = useState<AiProviderInfo | null>(
    null
  )
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [providerToRemove, setProviderToRemove] =
    useState<AiProviderInfo | null>(null)

  const handleConfigure = useCallback((provider: AiProviderInfo) => {
    setConfigProvider(provider)
    setConfigDialogOpen(true)
  }, [])

  const handleSaveConfig = useCallback(
    (apiKey: string, baseUrl: string) => {
      if (!configProvider) {
        return
      }
      updateProviderConfig(configProvider.id, {
        apiKey,
        baseUrl: baseUrl.trim() || undefined
      })
      toast.success(
        t("aiProvider.configSaved", { provider: configProvider.name })
      )
    },
    [configProvider, updateProviderConfig, t]
  )

  const handleSetDefault = useCallback(
    (provider: AiProviderInfo) => {
      setDefaultProvider(provider.id)
      toast.success(
        t("aiProvider.setAsDefaultSuccess", { provider: provider.name })
      )
    },
    [setDefaultProvider, t]
  )

  const handleRemoveClick = useCallback((provider: AiProviderInfo) => {
    setProviderToRemove(provider)
    setRemoveDialogOpen(true)
  }, [])

  const handleConfirmRemove = useCallback(() => {
    if (!providerToRemove) {
      return
    }
    removeProviderConfig(providerToRemove.id)
    toast.success(t("aiProvider.removed", { provider: providerToRemove.name }))
    setRemoveDialogOpen(false)
    setProviderToRemove(null)
  }, [providerToRemove, removeProviderConfig, t])

  const currentConfig = configProvider
    ? getProviderConfig(configProvider.id)
    : undefined

  if (!isLoaded) {
    return null
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon className="size-5" icon={Key01Icon} />
            {t("aiProvider.title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("aiProvider.description")}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {AI_PROVIDERS.map((provider) => (
            <ProviderItem
              isConfigured={isProviderConfigured(provider.id)}
              isDefault={config.defaultProvider === provider.id}
              key={provider.id}
              onConfigure={() => handleConfigure(provider)}
              onRemove={() => handleRemoveClick(provider)}
              onSetDefault={() => handleSetDefault(provider)}
              provider={provider}
            />
          ))}
        </CardContent>
      </Card>

      <ConfigDialog
        initialApiKey={currentConfig?.apiKey}
        initialBaseUrl={currentConfig?.baseUrl}
        onOpenChange={setConfigDialogOpen}
        onSave={handleSaveConfig}
        open={configDialogOpen}
        provider={configProvider}
      />

      <AlertDialog onOpenChange={setRemoveDialogOpen} open={removeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("aiProvider.removeConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("aiProvider.removeConfirmDescription", {
                provider: providerToRemove?.name
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmRemove}
            >
              {t("aiProvider.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
