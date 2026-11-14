import { Button } from "@folionote/ui/button"
import {
  AiBrain01Icon,
  Setting06Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

interface EmptyStateProps {
  hasApiKey: boolean
}

export function EmptyState({ hasApiKey }: EmptyStateProps) {
  const { t } = useTranslation()

  return (
    <div className="flex h-full animate-in flex-col items-center justify-center text-center duration-200 fade-in-0 motion-reduce:animate-none">
      <HugeiconsIcon
        className="animate-float mb-4 size-12 text-muted-foreground/50 motion-reduce:animate-none"
        icon={AiBrain01Icon}
      />
      <h3 className="mb-2 bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-lg font-medium text-balance text-transparent">
        {t("knowledge.emptyState.title")}
      </h3>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">
        {t("knowledge.emptyState.description")}
      </p>
      {!hasApiKey && (
        <div className="mt-4">
          <Link to="/settings/models">
            <Button
              className="border border-border/60 bg-background/70 shadow-sm backdrop-blur-sm transition-colors duration-200 hover:bg-background/90 motion-reduce:transition-none"
              variant="outline"
            >
              <HugeiconsIcon className="mr-2 size-4" icon={Setting06Icon} />
              {t("knowledge.manageApiKeys")}
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
