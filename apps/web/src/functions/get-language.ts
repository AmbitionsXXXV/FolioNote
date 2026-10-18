import { parseAcceptLanguage } from "@folionote/locales"
import { createIsomorphicFn } from "@tanstack/react-start"
import {
  getCookie,
  getRequestHeader,
  setCookie
} from "@tanstack/react-start/server"

import i18n, {
  asSupportedLanguage,
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE
} from "@/lib/i18n"

/** The UI language for this render: the saved choice, else the browser's. */
export const getLanguage = createIsomorphicFn()
  .server(() => {
    const saved = asSupportedLanguage(getCookie(LANGUAGE_COOKIE))
    if (saved) {
      return saved
    }
    const preferred = parseAcceptLanguage(
      getRequestHeader("accept-language") ?? null
    )
    // Save the guess so the client boots in the same language and hydrates
    // the server's markup without a mismatch.
    setCookie(LANGUAGE_COOKIE, preferred, {
      path: "/",
      maxAge: LANGUAGE_COOKIE_MAX_AGE,
      sameSite: "lax"
    })
    return preferred
  })
  .client(() => i18n.language)
