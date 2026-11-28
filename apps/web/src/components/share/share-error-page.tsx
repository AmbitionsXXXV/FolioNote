import { Button } from "@folionote/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@folionote/ui/card"
import { ViewOffIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import type { ShareErrorPageProps } from "@/types/share"

/**
 * Error page component for share errors
 */
export function ShareErrorPage({ title, description }: ShareErrorPageProps) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-surface-secondary">
            <HugeiconsIcon
              className="size-6 text-muted-foreground"
              icon={ViewOffIcon}
            />
          </div>
          <CardTitle className="text-balance">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-6 text-pretty text-muted-foreground">
            {description}
          </p>
          <Link to="/">
            <Button>{t("share.goHome")}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
