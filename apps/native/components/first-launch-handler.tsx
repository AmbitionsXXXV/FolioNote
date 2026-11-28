import type { SupportedLanguage } from "@folionote/locales"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { useAppTheme } from "@/contexts/app-theme-context"
import { useFirstLaunch } from "@/hooks"

/**
 * First launch: follow the system's color scheme and language. There is no
 * language prompt any more; the onboarding cover has a language switch in
 * its top-right corner for anyone who wants another one.
 */
export function FirstLaunchHandler() {
  const { i18n } = useTranslation()
  const { setTheme } = useAppTheme()
  const currentLanguage = i18n.language as SupportedLanguage

  const { isLoading, isFirstLaunch, systemPreferences, completeFirstLaunch } =
    useFirstLaunch(currentLanguage)

  useEffect(() => {
    if (isLoading || !isFirstLaunch || !systemPreferences) {
      return
    }
    setTheme(systemPreferences.systemColorScheme)
    const apply = async () => {
      if (systemPreferences.detectedLanguage) {
        await i18n.changeLanguage(systemPreferences.detectedLanguage)
      }
      await completeFirstLaunch()
    }
    apply().catch((error: unknown) => {
      console.error("Failed to apply first-launch preferences:", error)
    })
  }, [
    isLoading,
    isFirstLaunch,
    systemPreferences,
    setTheme,
    completeFirstLaunch,
    i18n
  ])

  return null
}
