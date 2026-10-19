import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { BrandLockup } from "@/components/brand-lockup"

interface ShareFooterProps {
  showBranding: boolean
}

/**
 * Footer component for share page
 */
export function ShareFooter({ showBranding }: ShareFooterProps) {
  const { t } = useTranslation()

  if (!showBranding) {
    return null
  }

  return (
    <footer className="border-t py-8">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-pretty text-muted-foreground">
          {t("share.poweredBy")}{" "}
          <Link className="inline-flex align-middle" to="/">
            <BrandLockup iconClassName="size-4" wordmarkClassName="text-sm" />
          </Link>
        </p>
      </div>
    </footer>
  )
}
