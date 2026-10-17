import {
  OPENJLPT_ATTRIBUTION,
  OPENJLPT_LICENSE_URL,
  OPENJLPT_REPO_URL
} from "@folionote/constants"
import { useTranslation } from "react-i18next"

const LINK_CLASS =
  "underline underline-offset-4 decoration-border transition-colors hover:text-foreground hover:decoration-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"

/**
 * CC BY-SA 4.0 requires this notice wherever OpenJLPT data is shown, so the
 * hub and the word page both render it.
 */
export function JapaneseAttribution({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <footer
      className={`text-center text-xs text-pretty text-muted-foreground/80 ${className ?? ""}`}
    >
      <p>{OPENJLPT_ATTRIBUTION}</p>
      <p className="mt-1">
        <a
          className={LINK_CLASS}
          href={OPENJLPT_REPO_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t("japanese.attribution.repo")}
        </a>
        <span aria-hidden="true"> · </span>
        <a
          className={LINK_CLASS}
          href={OPENJLPT_LICENSE_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t("japanese.attribution.license")}
        </a>
      </p>
    </footer>
  )
}
