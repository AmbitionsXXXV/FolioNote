import { Skeleton } from "@folionote/ui/skeleton"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

import type { JapaneseReadingUnit } from "./japanese-analyzed-sentence"

export const READING_UNITS: JapaneseReadingUnit[] = [
  "word",
  "phrase",
  "morpheme"
]

const UNIT_LABEL_KEY: Record<JapaneseReadingUnit, string> = {
  word: "japanese.reading.unitWord",
  phrase: "japanese.reading.unitPhrase",
  morpheme: "japanese.reading.unitMorpheme"
}

/** Native form controls on the Japanese pages share this look. */
export const NATIVE_SELECT_CLASS =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 sm:text-sm"

export const PILL_BUTTON_CLASS =
  "rounded-full px-3 py-1 text-xs font-medium text-foreground ring-1 ring-border transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"

export const isServiceUnavailable = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "SERVICE_UNAVAILABLE"

export function TogglePill({
  isPressed,
  label,
  onToggle
}: {
  isPressed: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <button
      aria-pressed={isPressed}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none",
        isPressed
          ? "bg-primary/12 text-foreground ring-1 ring-primary/20"
          : "text-muted-foreground ring-1 ring-border hover:text-foreground"
      )}
      onClick={onToggle}
      type="button"
    >
      {label}
    </button>
  )
}

interface SegmentedOption<T extends string> {
  value: T
  label: string
}

/** Pill-shaped single choice (radiogroup semantics) used for view and import switches. */
export function JapaneseSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "sm",
  className
}: {
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  size?: "sm" | "md"
  className?: string
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        "inline-flex rounded-full bg-surface-secondary p-0.5",
        className
      )}
      role="radiogroup"
    >
      {options.map((option) => {
        const isChecked = option.value === value
        return (
          <button
            aria-checked={isChecked}
            className={cn(
              "rounded-full font-medium transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none",
              size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
              isChecked
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            role="radio"
            type="button"
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function UnitSelector({
  unit,
  onChange
}: {
  unit: JapaneseReadingUnit
  onChange: (unit: JapaneseReadingUnit) => void
}) {
  const { t } = useTranslation()

  return (
    <JapaneseSegmented
      label={t("japanese.reading.unitLabel")}
      onChange={onChange}
      options={READING_UNITS.map((candidate) => ({
        value: candidate,
        label: t(UNIT_LABEL_KEY[candidate])
      }))}
      value={unit}
    />
  )
}

/** Furigana / romaji toggles shared by every reading surface. */
export function ReadingDisplayToggles({
  showFurigana,
  showRomaji,
  onToggleFurigana,
  onToggleRomaji
}: {
  showFurigana: boolean
  showRomaji: boolean
  onToggleFurigana: () => void
  onToggleRomaji: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-1.5">
      <TogglePill
        isPressed={showFurigana}
        label={t("japanese.reading.furigana")}
        onToggle={onToggleFurigana}
      />
      <TogglePill
        isPressed={showRomaji}
        label={t("japanese.reading.romaji")}
        onToggle={onToggleRomaji}
      />
    </div>
  )
}

export function SentenceSkeleton() {
  return (
    <div className="space-y-3 py-3">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-9 w-10" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-14" />
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

export function SentenceError({
  error,
  onRetry,
  retryLabel
}: {
  error: unknown
  onRetry: () => void
  retryLabel?: string
}) {
  const { t } = useTranslation()
  const message = isServiceUnavailable(error)
    ? t("japanese.reading.engineStarting")
    : t("japanese.reading.analyzeFailed")

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground"
      role="alert"
    >
      <span>{message}</span>
      <button className={PILL_BUTTON_CLASS} onClick={onRetry} type="button">
        {retryLabel ?? t("japanese.reading.retry")}
      </button>
    </div>
  )
}
