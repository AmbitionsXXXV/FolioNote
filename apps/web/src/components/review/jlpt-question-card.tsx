import { Tick02Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import type { JlptChoice, JlptQuestion } from "@/lib/jlpt-exam"
import { getJlptChoiceById } from "@/lib/jlpt-exam"

// JLPT answer sheets number the four options 1–4 (language-neutral).
const CHOICE_LABELS = ["1", "2", "3", "4"]

/**
 * Splits a prompt into plain text, the answer blank (＿＿＿, used by
 * context/grammarForm), and the bracketed focus word (「…」, used by
 * kanjiReading/paraphrase). A prompt carries one or the other, never both.
 */
const PROMPT_SEGMENT_REGEX = /([＿_]{2,})|「([^」]*)」/g

type PromptSegment =
  | { kind: "text"; value: string }
  | { kind: "blank" }
  | { kind: "target"; value: string }

function buildPromptSegments(prompt: string): PromptSegment[] {
  const segments: PromptSegment[] = []
  let lastIndex = 0

  for (const match of prompt.matchAll(PROMPT_SEGMENT_REGEX)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      segments.push({ kind: "text", value: prompt.slice(lastIndex, index) })
    }
    if (match[1]) {
      segments.push({ kind: "blank" })
    } else {
      segments.push({ kind: "target", value: match[2] ?? "" })
    }
    lastIndex = index + match[0].length
  }

  if (lastIndex < prompt.length) {
    segments.push({ kind: "text", value: prompt.slice(lastIndex) })
  }

  return segments
}

function PromptText({
  prompt,
  answered,
  filledText
}: {
  prompt: string
  answered: boolean
  filledText: string
}) {
  const segments = buildPromptSegments(prompt)

  return (
    <p className="text-2xl leading-relaxed font-medium text-balance md:text-3xl">
      {segments.map((segment, index) => {
        if (segment.kind === "text") {
          // eslint-disable-next-line react/no-array-index-key -- static, order-stable segments
          return <span key={`t${index}`}>{segment.value}</span>
        }
        // Bracketed focus word (kanjiReading/paraphrase): no substitution —
        // the answer is a reading/synonym, not a fill-in — so tint it emerald
        // once answered to mirror the filled-blank feedback below.
        if (segment.kind === "target") {
          return (
            <span key={`g${index}`}>
              <span className="text-muted-foreground/50">「</span>
              <span
                className={
                  answered
                    ? "font-semibold text-emerald-600 underline decoration-emerald-500/40 decoration-dotted underline-offset-4 dark:text-emerald-300"
                    : "font-semibold text-primary underline decoration-primary/40 decoration-dotted underline-offset-4"
                }
              >
                {segment.value}
              </span>
              <span className="text-muted-foreground/50">」</span>
            </span>
          )
        }
        return answered ? (
          <span
            className="rounded-md bg-emerald-500/15 px-1.5 font-semibold text-emerald-600 dark:text-emerald-300"
            key={`b${index}`}
          >
            {filledText}
          </span>
        ) : (
          <span
            className="mx-1 inline-block min-w-16 border-b-2 border-dashed border-primary/50 align-middle"
            key={`b${index}`}
          >
            &nbsp;
          </span>
        )
      })}
    </p>
  )
}

function ChoiceButton({
  choice,
  label,
  answered,
  isCorrect,
  isSelected,
  onSelect
}: {
  choice: JlptChoice
  label: string
  answered: boolean
  isCorrect: boolean
  isSelected: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()

  let stateClass =
    "border-border/60 bg-card/40 hover:border-primary/40 hover:bg-card/70"
  let badgeClass =
    "border-border/60 bg-surface-secondary/60 text-muted-foreground"

  if (answered && isCorrect) {
    stateClass = "border-emerald-500/50 bg-emerald-500/10"
    badgeClass = "border-emerald-500/50 bg-emerald-500/20 text-emerald-500"
  } else if (answered && isSelected) {
    stateClass = "border-rose-500/50 bg-rose-500/10"
    badgeClass = "border-rose-500/50 bg-rose-500/20 text-rose-500"
  } else if (answered) {
    stateClass = "border-border/40 bg-card/20 opacity-60"
  }

  // The badge glyph (✓/✕) is decorative; screen readers get an sr-only label.
  let badgeContent: ReactNode = label
  if (answered && isCorrect) {
    badgeContent = (
      <>
        <span aria-hidden="true" className="flex">
          <HugeiconsIcon className="size-3.5" icon={Tick02Icon} />
        </span>
        <span className="sr-only">{t("review.jlptExam.correct")}</span>
      </>
    )
  } else if (answered && isSelected) {
    badgeContent = (
      <>
        <span aria-hidden="true">✕</span>
        <span className="sr-only">{t("review.jlptExam.incorrect")}</span>
      </>
    )
  }

  return (
    <button
      aria-pressed={isSelected}
      className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${stateClass}`}
      disabled={answered}
      onClick={onSelect}
      type="button"
    >
      <span
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold ${badgeClass}`}
      >
        {badgeContent}
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-script-ja text-base">{choice.text}</span>
        {answered && (
          <span
            className={`text-xs leading-snug ${
              isCorrect
                ? "text-emerald-600/90 dark:text-emerald-300/90"
                : "text-muted-foreground"
            }`}
          >
            {choice.note}
          </span>
        )}
      </span>
    </button>
  )
}

interface JlptQuestionCardProps {
  question: JlptQuestion
  selectedChoiceId: string | null
  onSelect: (choiceId: string) => void
}

export function JlptQuestionCard({
  question,
  selectedChoiceId,
  onSelect
}: JlptQuestionCardProps) {
  const answered = selectedChoiceId !== null
  const correctChoice = getJlptChoiceById(question, question.correctChoiceId)

  return (
    <div className="flex flex-col gap-6">
      <PromptText
        answered={answered}
        filledText={correctChoice?.text ?? ""}
        prompt={question.prompt}
      />

      <div className="flex flex-col gap-2.5">
        {question.choices.map((choice, index) => (
          <ChoiceButton
            answered={answered}
            choice={choice}
            isCorrect={choice.id === question.correctChoiceId}
            isSelected={choice.id === selectedChoiceId}
            key={choice.id}
            label={CHOICE_LABELS[index] ?? String(index + 1)}
            onSelect={() => onSelect(choice.id)}
          />
        ))}
      </div>
    </div>
  )
}
