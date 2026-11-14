import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@folionote/ui/collapsible"
import {
  ArrowDown01Icon,
  BookOpen01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ComponentProps } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

export type SourcesProps = ComponentProps<"div">

export const Sources = ({ className, ...props }: SourcesProps) => (
  <Collapsible
    className={cn("not-prose mb-4 text-primary text-xs", className)}
    {...props}
  />
)

export type SourcesTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number
}

export const SourcesTrigger = ({
  className,
  count,
  children,
  ...props
}: SourcesTriggerProps) => {
  const { t } = useTranslation()
  const label = t("knowledge.sourcesUsed", { count })

  return (
    <CollapsibleTrigger
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      {children ?? (
        <>
          <p className="font-medium">{label}</p>
          <HugeiconsIcon className="size-4" icon={ArrowDown01Icon} />
        </>
      )}
    </CollapsibleTrigger>
  )
}

export type SourcesContentProps = ComponentProps<typeof CollapsibleContent>

export const SourcesContent = ({
  className,
  ...props
}: SourcesContentProps) => (
  <CollapsibleContent
    className={cn(
      "mt-3 flex w-fit flex-col gap-2",
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  />
)

export type SourceProps = ComponentProps<"a">

export const Source = ({ href, title, children, ...props }: SourceProps) => {
  const label = title ?? href ?? ""

  return (
    <a
      className="flex items-center gap-2"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      {...props}
    >
      {children ?? (
        <>
          <HugeiconsIcon className="size-4" icon={BookOpen01Icon} />
          <span className="block font-medium">{label}</span>
        </>
      )}
    </a>
  )
}
