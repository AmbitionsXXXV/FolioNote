import { Button } from "@folionote/ui/button"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { BrandLockup } from "@/components/brand-lockup"
import { useScrollDirection } from "@/hooks/use-scroll-direction"
import { cn } from "@/lib/utils"

interface ShareHeaderProps {
  showBranding: boolean
}

/**
 * Header component for share page
 * Fixed at top, hides on scroll down, shows on scroll up
 */
export function ShareHeader({ showBranding }: ShareHeaderProps) {
  const { t } = useTranslation()
  const { scrollDirection, isAtTop } = useScrollDirection({ threshold: 10 })

  const isVisible = isAtTop || scrollDirection === "up"

  return (
    <header
      className={cn(
        "fixed top-0 right-0 left-0 z-50 border-b bg-background/95 backdrop-blur-sm transition-transform duration-300 supports-backdrop-filter:bg-background/80",
        isVisible ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        {showBranding ? (
          <Link to="/">
            <BrandLockup iconClassName="size-8" wordmarkClassName="text-2xl" />
          </Link>
        ) : (
          <div />
        )}
        {showBranding && (
          <Link to="/">
            <Button size="sm" variant="outline">
              {t("share.createYourOwn")}
            </Button>
          </Link>
        )}
      </div>
    </header>
  )
}
