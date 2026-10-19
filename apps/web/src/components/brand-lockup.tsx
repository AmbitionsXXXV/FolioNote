import { cn } from "@/lib/utils"

interface BrandLockupProps {
  className?: string
  iconClassName?: string
  iconOnly?: boolean
  wordmarkClassName?: string
}

export function BrandLockup({
  className,
  iconClassName,
  iconOnly = false,
  wordmarkClassName
}: BrandLockupProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        alt={iconOnly ? "FolioNote" : ""}
        aria-hidden={iconOnly ? undefined : "true"}
        className={cn("size-8 shrink-0", iconClassName)}
        src="/brand/folionote-app-icon.png"
      />
      {!iconOnly && (
        <span
          className={cn(
            "font-script-en font-script text-xl leading-none font-semibold tracking-tight text-foreground",
            wordmarkClassName
          )}
        >
          Folio<span className="text-primary">Note</span>
        </span>
      )}
    </span>
  )
}
