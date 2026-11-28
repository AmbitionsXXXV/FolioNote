import { buttonVariants } from "@folionote/ui/button"
import {
  FileNotFoundIcon,
  Home01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

/**
 * Default 404 Not Found component.
 * Displays a friendly message and provides navigation back to home.
 */
export function NotFound() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        {/* Not Found Icon */}
        <div className="flex size-16 items-center justify-center rounded-full bg-surface-secondary">
          <HugeiconsIcon
            className="size-8 text-muted-foreground"
            icon={FileNotFoundIcon}
            strokeWidth={2}
          />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">404</h2>
          <p className="text-sm text-muted-foreground">{t("error.notFound")}</p>
        </div>

        {/* Action Button */}
        <Link className={buttonVariants({ variant: "default" })} to="/">
          <HugeiconsIcon className="mr-2 size-4" icon={Home01Icon} />
          {t("nav.home")}
        </Link>
      </div>
    </div>
  )
}
