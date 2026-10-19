import type { ModelProviderCard as ProviderCardType } from "@folionote/model-list"
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@folionote/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@folionote/ui/collapsible"
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
  Settings02Icon,
  Tick02Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ProviderLogo } from "@/components/brand-logo"
import { cn } from "@/lib/utils"

interface ProviderConfig {
  apiKey: string
  baseUrl?: string
}

interface ModelProviderCardProps {
  provider: ProviderCardType
  config?: ProviderConfig
  isDefault: boolean
  onConfigure: (providerId: string, config: ProviderConfig) => void
  onRemove: (providerId: string) => void
  onSetDefault: (providerId: string) => void
}

/**
 * Individual model provider card with configuration options
 */
export function ModelProviderCard({
  provider,
  config,
  isDefault,
  onConfigure,
  onRemove,
  onSetDefault
}: ModelProviderCardProps) {
  const { t } = useTranslation()
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const isConfigured = Boolean(config?.apiKey?.trim())

  const handleSaveConfig = useCallback(
    (apiKey: string, baseUrl: string) => {
      onConfigure(provider.id, {
        apiKey,
        baseUrl: baseUrl.trim() || undefined
      })
      setConfigDialogOpen(false)
      toast.success(
        t("settings.models.configSaved", { provider: provider.name })
      )
    },
    [onConfigure, provider.id, provider.name, t]
  )

  const handleSetDefault = useCallback(() => {
    onSetDefault(provider.id)
    toast.success(
      t("settings.models.setAsDefaultSuccess", { provider: provider.name })
    )
  }, [onSetDefault, provider.id, provider.name, t])

  const handleConfirmRemove = useCallback(() => {
    onRemove(provider.id)
    setRemoveDialogOpen(false)
    toast.success(t("settings.models.removed", { provider: provider.name }))
  }, [onRemove, provider.id, provider.name, t])

  return (
    <>
      <Collapsible onOpenChange={setIsOpen} open={isOpen}>
        <Card
          className={cn(
            "transition-colors",
            isDefault && "border-primary/50 bg-primary/5"
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Provider Logo */}
                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
                  <ProviderLogo
                    className="size-8"
                    id={provider.id}
                    logo={provider.logo}
                    name={provider.name}
                  />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {provider.name}
                    {isConfigured && (
                      <Badge className="gap-1" variant="secondary">
                        <HugeiconsIcon
                          className="size-3"
                          icon={CheckmarkCircle02Icon}
                        />
                        {t("settings.models.configured")}
                      </Badge>
                    )}
                    {isDefault && (
                      <Badge className="gap-1" variant="default">
                        {t("settings.models.default")}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="line-clamp-1 text-xs">
                    {provider.description}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isConfigured && !isDefault && (
                  <Button
                    aria-label={t("settings.models.setAsDefault")}
                    onClick={handleSetDefault}
                    size="sm"
                    variant="ghost"
                  >
                    <HugeiconsIcon className="mr-1 size-4" icon={Tick02Icon} />
                    {t("settings.models.setAsDefault")}
                  </Button>
                )}
                <Button
                  className="rounded-lg"
                  onClick={() => setConfigDialogOpen(true)}
                  size="sm"
                  variant={isConfigured ? "outline" : "default"}
                >
                  <HugeiconsIcon
                    className="mr-1 size-4"
                    icon={isConfigured ? Key01Icon : Add01Icon}
                  />
                  {isConfigured
                    ? t("settings.models.edit")
                    : t("settings.models.configure")}
                </Button>
                <CollapsibleTrigger
                  aria-label={t("settings.models.viewModels")}
                  className="inline-flex size-9 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                >
                  <HugeiconsIcon
                    className={cn(
                      "size-4 transition-transform",
                      isOpen && "rotate-180"
                    )}
                    icon={Settings02Icon}
                  />
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="border-t pt-4">
              <div className="space-y-4">
                {/* Provider Info */}
                <div className="flex flex-wrap gap-4 text-sm">
                  {provider.url && (
                    <a
                      className="flex items-center gap-1 text-muted-foreground hover:text-primary hover:underline"
                      href={provider.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <HugeiconsIcon
                        className="size-3"
                        icon={LinkSquare02Icon}
                      />
                      {t("settings.models.website")}
                    </a>
                  )}
                  {provider.apiKeyUrl && (
                    <a
                      className="flex items-center gap-1 text-muted-foreground hover:text-primary hover:underline"
                      href={provider.apiKeyUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <HugeiconsIcon className="size-3" icon={Key01Icon} />
                      {t("settings.models.getApiKey")}
                    </a>
                  )}
                  {provider.modelsUrl && (
                    <a
                      className="flex items-center gap-1 text-muted-foreground hover:text-primary hover:underline"
                      href={provider.modelsUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <HugeiconsIcon
                        className="size-3"
                        icon={LinkSquare02Icon}
                      />
                      {t("settings.models.viewDocs")}
                    </a>
                  )}
                </div>

                {/* Provider Settings Info */}
                <div className="rounded-lg bg-surface-secondary/50 p-3">
                  <h4 className="mb-2 text-sm font-medium">
                    {t("settings.models.capabilities")}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {provider.settings.showModelFetcher && (
                      <Badge variant="outline">
                        {t("settings.models.capability.modelFetcher")}
                      </Badge>
                    )}
                    {provider.settings.supportResponsesApi && (
                      <Badge variant="outline">
                        {t("settings.models.capability.responsesApi")}
                      </Badge>
                    )}
                    {provider.settings.showApiKey !== false && (
                      <Badge variant="outline">
                        {t("settings.models.capability.apiKey")}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Remove Button */}
                {isConfigured && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setRemoveDialogOpen(true)}
                      size="sm"
                      variant="ghost"
                    >
                      <HugeiconsIcon
                        className="mr-1 size-4 text-destructive"
                        icon={Delete02Icon}
                      />
                      {t("settings.models.removeConfig")}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Configure Dialog */}
      <ConfigDialog
        initialApiKey={config?.apiKey}
        initialBaseUrl={config?.baseUrl}
        onOpenChange={setConfigDialogOpen}
        onSave={handleSaveConfig}
        open={configDialogOpen}
        provider={provider}
      />

      {/* Remove Confirmation Dialog */}
      <AlertDialog onOpenChange={setRemoveDialogOpen} open={removeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.models.removeConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.models.removeConfirmDescription", {
                provider: provider.name
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmRemove}
            >
              {t("settings.models.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface ConfigDialogProps {
  provider: ProviderCardType
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
  }, [apiKey, baseUrl, onSave])

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("settings.models.configureProvider", {
              provider: provider.name
            })}
          </DialogTitle>
          <DialogDescription>
            {t("settings.models.configureDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="provider-api-key">
              {t("settings.models.apiKey")}
            </Label>
            <Input
              autoComplete="off"
              id="provider-api-key"
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("settings.models.apiKeyPlaceholder", {
                provider: provider.name
              })}
              spellCheck={false}
              type="password"
              value={apiKey}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.models.apiKeyHint")}
            </p>
          </div>
          {provider.settings.proxyUrl !== false && (
            <div className="space-y-2">
              <Label htmlFor="provider-base-url">
                {t("settings.models.baseUrl")}
                <span className="ml-1 text-muted-foreground">
                  ({t("common.optional")})
                </span>
              </Label>
              <Input
                autoComplete="off"
                id="provider-base-url"
                inputMode="url"
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={
                  typeof provider.settings.proxyUrl === "object"
                    ? provider.settings.proxyUrl.placeholder
                    : provider.url
                }
                spellCheck={false}
                type="url"
                value={baseUrl}
              />
              <p className="text-xs text-muted-foreground">
                {t("settings.models.baseUrlHint")}
              </p>
            </div>
          )}
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
