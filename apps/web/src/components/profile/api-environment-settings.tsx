import { Card, CardContent, CardHeader, CardTitle } from "@folionote/ui/card"
import { Label } from "@folionote/ui/label"
import { Switch } from "@folionote/ui/switch"
import {
  CloudServerIcon,
  ComputerIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTranslation } from "react-i18next"

import { useApiEnvironment } from "@/hooks/use-api-environment"

/**
 * API Environment settings card with local/remote toggle
 * Only shown in development mode
 */
export function ApiEnvironmentSettings() {
  const { t } = useTranslation()
  const { setApiEnvironment, serverUrl, isRemote } = useApiEnvironment()

  // Only show in development mode
  if (import.meta.env.MODE === "production") {
    return null
  }

  return (
    <Card className="rounded-3xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 font-display font-semibold">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
            <HugeiconsIcon
              className="size-5 text-primary"
              icon={CloudServerIcon}
            />
          </span>
          {t("settings.apiEnvironment.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Environment Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Label className="cursor-pointer" htmlFor="api-env">
              {t("settings.apiEnvironment.useRemoteServer")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {isRemote
                ? t("settings.apiEnvironment.remoteDescription")
                : t("settings.apiEnvironment.localDescription")}
            </p>
          </div>
          <Switch
            checked={isRemote}
            id="api-env"
            onCheckedChange={(checked) =>
              setApiEnvironment(checked ? "remote" : "local")
            }
          />
        </div>

        {/* Current Server URL Display */}
        <div className="rounded-2xl border border-border/60 bg-surface-secondary/30 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <HugeiconsIcon
              className="size-3.5"
              icon={isRemote ? CloudServerIcon : ComputerIcon}
            />
            {t("settings.apiEnvironment.currentServer")}
          </div>
          <code className="font-mono text-xs text-foreground">{serverUrl}</code>
        </div>

        {/* CORS Notice for Remote Server */}
        {isRemote && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
            <p className="text-xs text-blue-900 dark:text-blue-200">
              💡 {t("settings.apiEnvironment.corsNotice")}
            </p>
          </div>
        )}

        {/* Warning */}
        <p className="text-xs text-muted-foreground">
          ⚠️ {t("settings.apiEnvironment.reloadWarning")}
        </p>
      </CardContent>
    </Card>
  )
}
