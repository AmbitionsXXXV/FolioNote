import { Card, CardContent, CardHeader, CardTitle } from "@folionote/ui/card"
import { Label } from "@folionote/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@folionote/ui/select"
import {
  ComputerIcon,
  Moon02Icon,
  Sun03Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"

import type { AppearanceSettingsProps } from "@/types/profile"

/**
 * Appearance settings card with theme selection
 */
export function AppearanceSettings({ mounted }: AppearanceSettingsProps) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <Card className="rounded-3xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display font-semibold">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
            <HugeiconsIcon className="size-5 text-primary" icon={Moon02Icon} />
          </span>
          {t("profile.appearance")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Theme Selection */}
        <div className="flex items-center justify-between">
          <Label htmlFor="theme">{t("common.theme")}</Label>
          <Select
            onValueChange={(value) => value && setTheme(value)}
            value={mounted ? theme : "system"}
          >
            <SelectTrigger className="w-40" id="theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon className="size-4" icon={Sun03Icon} />
                  {t("common.themeLight")}
                </div>
              </SelectItem>
              <SelectItem value="dark">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon className="size-4" icon={Moon02Icon} />
                  {t("common.themeDark")}
                </div>
              </SelectItem>
              <SelectItem value="system">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon className="size-4" icon={ComputerIcon} />
                  {t("common.themeSystem")}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
