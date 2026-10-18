import { Badge } from "@folionote/ui/badge"
import { Button } from "@folionote/ui/button"
import { Progress } from "@folionote/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@folionote/ui/tooltip"
import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  InformationCircleIcon,
  RefreshIcon,
  Rocket01Icon,
  Tick02Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useHotkey } from "@tanstack/react-hotkeys"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  JapanesePracticeTabs,
  PRACTICE_VIEW_MIN_HEIGHT
} from "@/components/japanese/japanese-practice-tabs"
import type {
  JlptLevel,
  JlptLevelFilter,
  JlptQuestion,
  JlptSection,
  JlptSectionFilter
} from "@/lib/jlpt-exam"
import {
  filterJlptQuestions,
  JLPT_LEVEL_BADGE_COLOR,
  JLPT_LEVELS,
  JLPT_SECTIONS,
  JLPT_TYPE_HINT_KEY
} from "@/lib/jlpt-exam"

import { JlptAnalysisPanel } from "./jlpt-analysis-panel"
import { JLPT_EXAM_QUESTIONS } from "./jlpt-exam-data"
import { JlptQuestionCard } from "./jlpt-question-card"

function FilterChip({
  isActive,
  activeClass,
  label,
  onClick
}: {
  isActive: boolean
  activeClass: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={isActive}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
        isActive
          ? activeClass
          : "border-border/50 bg-transparent text-muted-foreground hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

function JlptExamResults({
  answeredCount,
  correctCount,
  accuracyPercent,
  deckLength,
  missedQuestions,
  onRestart
}: {
  answeredCount: number
  correctCount: number
  accuracyPercent: number
  deckLength: number
  missedQuestions: JlptQuestion[]
  onRestart: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <div className="flex flex-1 flex-col items-center px-4 py-12">
        <div className="animate-fade-in flex size-20 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/40">
          <HugeiconsIcon
            className="size-10 text-emerald-400"
            icon={Rocket01Icon}
          />
        </div>
        <h1 className="animate-fade-in mt-8 text-3xl font-bold tracking-tight delay-100">
          {t("review.jlptExam.completedTitle")}
        </h1>
        <p className="animate-fade-in mt-3 max-w-md text-center text-base text-muted-foreground delay-200">
          {t("review.jlptExam.completedDescription", {
            correct: correctCount,
            total: deckLength
          })}
        </p>

        <div className="animate-fade-in mt-10 grid w-full max-w-lg gap-4 delay-300 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/50 bg-card/60 p-5 text-center">
            <p className="text-xs text-muted-foreground">
              {t("review.jlptExam.statsAnswered")}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {answeredCount}
            </p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/60 p-5 text-center">
            <p className="text-xs text-muted-foreground">
              {t("review.jlptExam.statsCorrect")}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {correctCount}
            </p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/60 p-5 text-center">
            <p className="text-xs text-muted-foreground">
              {t("review.jlptExam.statsAccuracy")}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {accuracyPercent}%
            </p>
          </div>
        </div>

        {missedQuestions.length > 0 ? (
          <div className="animate-fade-in mt-10 w-full max-w-2xl delay-400">
            <h2 className="mb-4 text-lg font-semibold">
              {t("review.jlptExam.reviewMissed")}
            </h2>
            <div className="flex flex-col gap-3">
              {missedQuestions.map((question) => {
                const correct = question.choices.find(
                  (choice) => choice.id === question.correctChoiceId
                )
                return (
                  <div
                    className="rounded-xl border border-border/50 bg-card/60 p-4"
                    key={question.id}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Badge
                        className={JLPT_LEVEL_BADGE_COLOR[question.level]}
                        variant="outline"
                      >
                        {question.level}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t(`review.jlptExam.types.${question.type}`)}
                      </span>
                    </div>
                    <p className="font-script-ja text-sm">{question.prompt}</p>
                    <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-300">
                      {t("review.jlptExam.correctAnswerLabel")}：{correct?.text}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="animate-fade-in mt-8 text-sm text-emerald-600 delay-400 dark:text-emerald-300">
            {t("review.jlptExam.noMistakes")}
          </p>
        )}

        <Button
          className="animate-fade-in mt-10 delay-400"
          onClick={onRestart}
          size="lg"
          type="button"
          variant="outline"
        >
          <HugeiconsIcon className="mr-2 size-4" icon={RefreshIcon} />
          {t("review.jlptExam.restart")}
        </Button>
      </div>
    </div>
  )
}

function JlptExamFilters({
  levelFilter,
  sectionFilter,
  onSelectLevel,
  onSelectSection
}: {
  levelFilter: JlptLevelFilter
  sectionFilter: JlptSectionFilter
  onSelectLevel: (next: JlptLevelFilter) => void
  onSelectSection: (next: JlptSectionFilter) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex shrink-0 flex-col gap-2 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip
          activeClass="border-primary/40 bg-primary/10 text-primary"
          isActive={levelFilter === "all"}
          label={t("review.jlptExam.levelAll")}
          onClick={() => onSelectLevel("all")}
        />
        {JLPT_LEVELS.map((level: JlptLevel) => (
          <FilterChip
            activeClass={JLPT_LEVEL_BADGE_COLOR[level]}
            isActive={levelFilter === level}
            key={level}
            label={level}
            onClick={() => onSelectLevel(level)}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip
          activeClass="border-primary/40 bg-primary/10 text-primary"
          isActive={sectionFilter === "all"}
          label={t("review.jlptExam.sectionAll")}
          onClick={() => onSelectSection("all")}
        />
        {JLPT_SECTIONS.map((section: JlptSection) => (
          <FilterChip
            activeClass="border-primary/40 bg-primary/10 text-primary"
            isActive={sectionFilter === section}
            key={section}
            label={t(`review.jlptExam.sections.${section}`)}
            onClick={() => onSelectSection(section)}
          />
        ))}
      </div>
    </div>
  )
}

function JlptExamQuestionPanel({
  question,
  selectedChoiceId,
  answered,
  isLast,
  onSelectChoice,
  onNext
}: {
  question: JlptQuestion | undefined
  selectedChoiceId: string | null
  answered: boolean
  isLast: boolean
  onSelectChoice: (choiceId: string) => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-6">
      {question ? (
        <div className="flex w-full max-w-2xl flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={JLPT_LEVEL_BADGE_COLOR[question.level]}
              variant="outline"
            >
              {question.level}
            </Badge>
            <Badge className="text-muted-foreground" variant="outline">
              {t(`review.jlptExam.sections.${question.section}`)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t(`review.jlptExam.types.${question.type}`)}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            {t(`review.jlptExam.hint.${JLPT_TYPE_HINT_KEY[question.type]}`)}
          </p>

          <JlptQuestionCard
            key={question.id}
            onSelect={onSelectChoice}
            question={question}
            selectedChoiceId={selectedChoiceId}
          />

          {answered && (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
                {question.promptReading && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">
                      {t("review.jlptExam.readingLabel")}：
                    </span>
                    <span className="font-script-ja">
                      {question.promptReading}
                    </span>
                  </p>
                )}
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">
                    {t("review.jlptExam.translationLabel")}：
                  </span>
                  {question.translation}
                </p>
              </div>

              <JlptAnalysisPanel question={question} />

              <Button
                className="self-end bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30"
                onClick={onNext}
                type="button"
                variant="ghost"
              >
                {isLast
                  ? t("review.jlptExam.finish")
                  : t("review.jlptExam.next")}
              </Button>
            </div>
          )}

          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground/60">
            <HugeiconsIcon className="size-3" icon={InformationCircleIcon} />
            {t("review.jlptExam.disclaimer")}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-lg font-semibold">
            {t("review.jlptExam.emptyTitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("review.jlptExam.emptyDescription")}
          </p>
        </div>
      )}
    </div>
  )
}

function JlptExamBottomBar({
  canGoPrevious,
  answered,
  onPrevious,
  onNext,
  onRestart
}: {
  canGoPrevious: boolean
  answered: boolean
  onPrevious: () => void
  onNext: () => void
  onRestart: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between gap-2 border-t border-border/50 bg-background px-4 py-3 sm:px-6">
      <Tooltip>
        <TooltipTrigger
          aria-label={t("common.back")}
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-40"
          disabled={!canGoPrevious}
          onClick={onPrevious}
          type="button"
        >
          <HugeiconsIcon className="size-5" icon={ArrowLeft02Icon} />
        </TooltipTrigger>
        <TooltipContent side="top">← {t("common.back")}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          aria-label={t("review.jlptExam.restart")}
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground"
          onClick={onRestart}
          type="button"
        >
          <HugeiconsIcon className="size-4" icon={RefreshIcon} />
        </TooltipTrigger>
        <TooltipContent side="top">
          {t("review.jlptExam.restart")}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          aria-label={t("common.next")}
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-40"
          disabled={!answered}
          onClick={onNext}
          type="button"
        >
          <HugeiconsIcon className="size-5" icon={ArrowRight02Icon} />
        </TooltipTrigger>
        <TooltipContent side="top">→ {t("common.next")}</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function JapaneseExamView() {
  const { t } = useTranslation()
  const [levelFilter, setLevelFilter] = useState<JlptLevelFilter>("all")
  const [sectionFilter, setSectionFilter] = useState<JlptSectionFilter>("all")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isComplete, setIsComplete] = useState(false)

  const deck = useMemo(
    () => filterJlptQuestions(JLPT_EXAM_QUESTIONS, levelFilter, sectionFilter),
    [levelFilter, sectionFilter]
  )

  const currentQuestion = deck[currentIndex]
  const selectedChoiceId = currentQuestion
    ? (answers[currentQuestion.id] ?? null)
    : null
  const answered = selectedChoiceId !== null

  const { answeredCount, correctCount } = useMemo(() => {
    let answeredTotal = 0
    let correctTotal = 0
    for (const question of deck) {
      const chosen = answers[question.id]
      if (chosen === undefined) {
        continue
      }
      answeredTotal += 1
      if (chosen === question.correctChoiceId) {
        correctTotal += 1
      }
    }
    return { answeredCount: answeredTotal, correctCount: correctTotal }
  }, [deck, answers])

  const accuracyPercent =
    answeredCount === 0 ? 100 : Math.round((correctCount / answeredCount) * 100)
  const overallProgressPercent =
    deck.length > 0 ? Math.round((currentIndex / deck.length) * 100) : 0

  const resetRun = useCallback(() => {
    setCurrentIndex(0)
    setIsComplete(false)
  }, [])

  const handleSelectLevel = useCallback(
    (next: JlptLevelFilter) => {
      setLevelFilter(next)
      resetRun()
    },
    [resetRun]
  )

  const handleSelectSection = useCallback(
    (next: JlptSectionFilter) => {
      setSectionFilter(next)
      resetRun()
    },
    [resetRun]
  )

  const handleSelectChoice = useCallback(
    (choiceId: string) => {
      if (!currentQuestion || answers[currentQuestion.id] !== undefined) {
        return
      }
      setAnswers((previous) => ({
        ...previous,
        [currentQuestion.id]: choiceId
      }))
    },
    [currentQuestion, answers]
  )

  const handleNext = useCallback(() => {
    if (currentIndex >= deck.length - 1) {
      setIsComplete(true)
      return
    }
    setCurrentIndex((previous) => previous + 1)
  }, [currentIndex, deck.length])

  const handlePrevious = useCallback(() => {
    if (currentIndex <= 0) {
      return
    }
    setCurrentIndex((previous) => previous - 1)
  }, [currentIndex])

  const handleRestart = useCallback(() => {
    setAnswers((previous) => {
      const next = { ...previous }
      for (const question of deck) {
        delete next[question.id]
      }
      return next
    })
    setCurrentIndex(0)
    setIsComplete(false)
  }, [deck])

  useHotkey("ArrowLeft", (event) => {
    event.preventDefault()
    handlePrevious()
  })

  useHotkey("ArrowRight", (event) => {
    if (!answered) {
      return
    }
    event.preventDefault()
    handleNext()
  })

  useHotkey("Enter", (event) => {
    if (!answered) {
      return
    }
    event.preventDefault()
    handleNext()
  })

  const missedQuestions = useMemo(
    () =>
      deck.filter((question) => {
        const chosen = answers[question.id]
        return chosen !== undefined && chosen !== question.correctChoiceId
      }),
    [deck, answers]
  )

  if (isComplete) {
    return (
      <JlptExamResults
        accuracyPercent={accuracyPercent}
        answeredCount={answeredCount}
        correctCount={correctCount}
        deckLength={deck.length}
        missedQuestions={missedQuestions}
        onRestart={handleRestart}
      />
    )
  }

  return (
    <div
      className={`flex flex-col bg-background text-foreground ${PRACTICE_VIEW_MIN_HEIGHT}`}
    >
      {/* Top bar */}
      <div className="animate-fade-in flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <JapanesePracticeTabs />
          <h1 className="sr-only">{t("review.jlptExam.title")}</h1>
          {deck.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              ({currentIndex + 1}/{deck.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-amber-400 dark:text-amber-300">
          <HugeiconsIcon className="size-3.5" icon={Tick02Icon} />
          <span className="text-sm font-medium tabular-nums">
            {correctCount}/{answeredCount}
          </span>
        </div>
      </div>

      <Progress
        className="h-1 shrink-0 rounded-none bg-surface-secondary [&>div]:bg-emerald-500 [&>div]:transition-all [&>div]:duration-300 [&>div]:ease-out"
        value={overallProgressPercent}
      />

      <JlptExamFilters
        levelFilter={levelFilter}
        onSelectLevel={handleSelectLevel}
        onSelectSection={handleSelectSection}
        sectionFilter={sectionFilter}
      />

      <JlptExamQuestionPanel
        answered={answered}
        isLast={currentIndex === deck.length - 1}
        onNext={handleNext}
        onSelectChoice={handleSelectChoice}
        question={currentQuestion}
        selectedChoiceId={selectedChoiceId}
      />

      <JlptExamBottomBar
        answered={answered}
        canGoPrevious={currentIndex > 0}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onRestart={handleRestart}
      />
    </div>
  )
}
