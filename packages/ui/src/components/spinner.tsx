import { cn } from "@folionote/ui/lib/utils"
import { Loading03Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"

type SpinnerProps = Omit<
  React.ComponentProps<typeof HugeiconsIcon>,
  "icon" | "strokeWidth"
> & {
  strokeWidth?: number
}

function Spinner({ className, strokeWidth = 2, ...props }: SpinnerProps) {
  return (
    <HugeiconsIcon
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      icon={Loading03Icon}
      role="status"
      strokeWidth={strokeWidth}
      {...props}
    />
  )
}

export { Spinner }
