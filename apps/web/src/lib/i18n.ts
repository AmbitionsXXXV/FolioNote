import { getI18nConfig, supportedLanguages } from "@folionote/locales"
import type { SupportedLanguage } from "@folionote/locales"
import i18n from "i18next"
import { initReactI18next } from "react-i18next"

/**
 * The chosen UI language lives in a cookie rather than localStorage so the
 * server can render a refresh in that language too.
 */
export const LANGUAGE_COOKIE = "folio-lang"
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function asSupportedLanguage(
  value: string | null | undefined
): SupportedLanguage | null {
  return supportedLanguages.find((language) => language === value) ?? null
}

function readLanguageCookie(): SupportedLanguage | undefined {
  if (typeof document === "undefined") {
    return undefined
  }
  const prefix = `${LANGUAGE_COOKIE}=`
  const saved = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length)
  return asSupportedLanguage(saved) ?? undefined
}

i18n.use(initReactI18next).init(getI18nConfig(readLanguageCookie()))

if (typeof document !== "undefined") {
  i18n.on("languageChanged", (language) => {
    document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; samesite=lax`
  })
}

export default i18n
