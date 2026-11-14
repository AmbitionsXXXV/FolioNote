import { LANGUAGE_LABELS } from "@folionote/constants"
import { supportedLanguages } from "@folionote/locales"
import type { SupportedLanguage } from "@folionote/locales"
import { Card, CardContent, CardHeader, CardTitle } from "@folionote/ui/card"
import { Label } from "@folionote/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@folionote/ui/select"
import { LanguageCircleIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTranslation } from "react-i18next"

/**
 * Language and region settings card
 */
export function LanguageSettings() {
  const { t, i18n } = useTranslation()

  return (
    <Card className="rounded-3xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display font-semibold">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
            <HugeiconsIcon
              className="size-5 text-primary"
              icon={LanguageCircleIcon}
            />
          </span>
          {t("profile.languageAndRegion")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Language Selection */}
        <div className="flex items-center justify-between">
          <Label htmlFor="language">{t("common.language")}</Label>
          <Select
            onValueChange={(value) => value && i18n.changeLanguage(value)}
            value={i18n.language as SupportedLanguage}
          >
            <SelectTrigger className="w-40" id="language">
              <SelectValue>
                {LANGUAGE_LABELS[i18n.language as SupportedLanguage] ||
                  i18n.language}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {supportedLanguages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {LANGUAGE_LABELS[lang] || lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
