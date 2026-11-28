import { cn } from "@/lib/utils"

interface StreakSealProps {
  days: number
  label: string
  ariaLabel: string
  /** Plays the press-down animation, used when the day was just stamped. */
  pressed?: boolean
  size?: number
  className?: string
}

/** The big hanko seal that carries the streak count. */
export function StreakSeal({
  days,
  label,
  ariaLabel,
  pressed = false,
  size = 112,
  className
}: StreakSealProps) {
  const isEmpty = days === 0
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "relative shrink-0",
        isEmpty ? "text-muted/40" : "text-stamp",
        pressed && "animate-stamp-press",
        className
      )}
      role="img"
      style={{ height: size, width: size }}
    >
      <svg aria-hidden="true" className="size-full" viewBox="0 0 112 112">
        <circle
          cx="56"
          cy="56"
          fill="none"
          r="50"
          stroke="currentColor"
          strokeWidth="5"
        />
        <circle
          cx="56"
          cy="56"
          fill="none"
          r="42"
          stroke="currentColor"
          strokeDasharray="3 4"
          strokeWidth="1.5"
        />
      </svg>
      <div className="absolute inset-0 flex -rotate-8 flex-col items-center justify-center">
        <span className="text-[40px] leading-none font-black tabular-nums">
          {days}
        </span>
        <span className="mt-1 text-[13px] font-bold tracking-[0.2em]">
          {label}
        </span>
      </div>
    </div>
  )
}
