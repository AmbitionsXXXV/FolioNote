import { Button } from "@folionote/ui/button"
import { Progress } from "@folionote/ui/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@folionote/ui/select"
import { Skeleton } from "@folionote/ui/skeleton"
import { Chip } from "@heroui/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useHotkey } from "@tanstack/react-hotkeys"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { JapaneseLevelChip } from "@/components/japanese/japanese-level-chip"
import {
  JapanesePracticeTabs,
  PRACTICE_VIEW_MIN_HEIGHT
} from "@/components/japanese/japanese-practice-tabs"
import { JapaneseRuby } from "@/components/japanese/japanese-ruby"
import { parseFuriganaMarkup } from "@/lib/japanese-furigana"
import { circledAccent, pitchPattern } from "@/lib/japanese/pitch-accent"
import { cn } from "@/lib/utils"
import { orpc } from "@/utils/orpc"

const BATCH_SIZE = 20
const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const
const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u
const RATINGS = [
  { key: "1", rating: "again", labelKey: "japanese.study.again" },
  { key: "2", rating: "hard", labelKey: "japanese.study.hard" },
  { key: "3", rating: "good", labelKey: "japanese.study.good" }
] as const

type Level = (typeof LEVELS)[number]
type StudyDeck =
  | { kind: "level"; level: Level }
  | { kind: "moji"; collectionId: string }
  | { kind: "lexicon"; id: string }
type Decks = Awaited<ReturnType<typeof orpc.japanese.study.decks.call>>
type StudyCard = Awaited<
  ReturnType<typeof orpc.japanese.study.queue.call>
>["cards"][number]
type MeaningLanguage = keyof StudyCard["meanings"]

/** Decks travel in the URL as `level:N5`, `moji:<id>` or `lexicon:<id>`. */
function encodeDeck(deck: StudyDeck): string {
  if (deck.kind === "level") return `level:${deck.level}`
  if (deck.kind === "moji") return `moji:${deck.collectionId}`
  return `lexicon:${deck.id}`
}

function decodeDeck(value: string | undefined): StudyDeck | null {
  const separator = value?.indexOf(":") ?? -1
  if (!value || separator < 1) return null
  const kind = value.slice(0, separator)
  const id = value.slice(separator + 1)
  if (kind === "level") {
    const level = LEVELS.find((candidate) => candidate === id)
    return level ? { kind, level } : null
  }
  if (kind === "moji" && id) return { kind, collectionId: id }
  if (kind === "lexicon" && id) return { kind, id }
  return null
}

/** A deck from the URL, else the first MOJi list, else N5. */
function resolveDeck(param: string | undefined, decks: Decks): StudyDeck {
  const requested = decodeDeck(param)
  if (requested) return requested
  const firstMoji = decks.moji[0]
  return firstMoji
    ? { kind: "moji", collectionId: firstMoji.collectionId }
    : { kind: "level", level: "N5" }
}

function meaningOrder(language: string): MeaningLanguage[] {
  if (language.startsWith("ja")) return ["ja", "zh", "en"]
  if (language.startsWith("en")) return ["en", "zh", "ja"]
  return ["zh", "ja", "en"]
}

function DeckPicker({
  decks,
  value,
  onChange
}: {
  decks: Decks
  value: string
  onChange: (deck: string) => void
}) {
  const { t } = useTranslation()
  const options = [
    ...decks.moji.map((deck) => ({
      value: encodeDeck({ kind: "moji", collectionId: deck.collectionId }),
      label: deck.title,
      group: "moji",
      ...deck
    })),
    ...decks.levels.map((deck) => ({
      value: encodeDeck({ kind: "level", level: deck.level }),
      label: t("japanese.study.levelDeck", { level: deck.level }),
      group: "levels",
      ...deck
    })),
    ...decks.lexicons.map((deck) => ({
      value: encodeDeck({ kind: "lexicon", id: deck.id }),
      label: deck.name,
      group: "lexicons",
      ...deck
    }))
  ]
  const groups = (["moji", "levels", "lexicons"] as const).filter((group) =>
    options.some((option) => option.group === group)
  )
  const current = options.find((option) => option.value === value)

  return (
    <Select onValueChange={(next) => next && onChange(next)} value={value}>
      <SelectTrigger
        aria-label={t("japanese.study.deck")}
        className="max-w-56 min-w-40"
      >
        <SelectValue>
          <span className="truncate">
            {current?.label ?? t("japanese.study.deck")}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-60">
        {groups.map((group) => (
          <SelectGroup key={group}>
            <SelectLabel>{t(`japanese.study.groups.${group}`)}</SelectLabel>
            {options
              .filter((option) => option.group === group)
              .map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="flex-1 truncate">{option.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {option.due > 0
                      ? t("japanese.study.dueCount", { count: option.due })
                      : `${option.studied}/${option.total}`}
                  </span>
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

function PitchReading({
  reading,
  accents
}: {
  reading: string
  accents: number[]
}) {
  const [first] = accents
  const label = accents.map(circledAccent).join("")
  if (first === undefined || !KANA_ONLY.test(reading)) {
    return (
      <span className="flex items-center gap-2">
        <span lang="ja">{reading}</span>
        {label ? <span className="text-xs text-primary">{label}</span> : null}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="flex text-xl" lang="ja">
        {pitchPattern(reading, first).map((mora, index) => (
          <span
            className={cn(
              "border-transparent px-px pt-1",
              mora.high && "border-t-2 border-t-primary",
              mora.drop && "border-r-2 border-r-primary"
            )}
            // Morae repeat (さ in さかさま), so position is the identity.
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
          >
            {mora.text}
          </span>
        ))}
      </span>
      <span className="sr-only" lang="ja">
        {reading}
      </span>
      <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-primary ring-1 ring-primary/35">
        {label}
      </span>
    </span>
  )
}

function StudyCardFace({
  card,
  revealed,
  onReveal
}: {
  card: StudyCard
  revealed: boolean
  onReveal: () => void
}) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const [primaryLanguage] = meaningOrder(language).filter(
    (lang) => card.meanings[lang].length > 0
  )
  const meanings = primaryLanguage ? card.meanings[primaryLanguage] : []
  const japaneseGloss =
    primaryLanguage && primaryLanguage !== "ja" ? card.meanings.ja : []
  const example = card.example
  const exampleTranslation = language.startsWith("zh")
    ? (example?.zh ?? example?.en)
    : (example?.en ?? example?.zh)

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex flex-wrap justify-center gap-1.5">
          {card.level ? (
            <JapaneseLevelChip approximate level={card.level} />
          ) : null}
          {card.partOfSpeech ? (
            <Chip size="sm" variant="soft">
              {card.partOfSpeech}
            </Chip>
          ) : null}
          <Chip
            color={card.isNew ? "success" : "warning"}
            size="sm"
            variant="soft"
          >
            {card.isNew ? t("japanese.study.new") : t("japanese.study.review")}
          </Chip>
        </div>
        <p
          className="font-script-ja text-5xl leading-tight font-semibold md:text-6xl"
          lang="ja"
        >
          {card.word}
        </p>
        {revealed ? (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-muted-foreground">
            {card.reading ? (
              <PitchReading
                accents={card.pitchAccents}
                reading={card.reading}
              />
            ) : null}
            {card.romaji ? (
              <span className="font-mono text-sm">{card.romaji}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {revealed ? (
        <div className="flex flex-col gap-3">
          <section className="rounded-2xl border border-border/50 bg-card/60 p-4">
            <h2 className="text-xs text-muted-foreground">
              {t("japanese.word.meanings")}
            </h2>
            {meanings.length > 0 ? (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-base marker:text-primary">
                {meanings.map((meaning) => (
                  <li key={meaning}>{meaning}</li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("japanese.study.noMeaning")}
              </p>
            )}
            {japaneseGloss.length > 0 ? (
              <p className="mt-2 text-sm text-muted-foreground" lang="ja">
                {japaneseGloss.join("；")}
              </p>
            ) : null}
          </section>

          {example ? (
            <section className="rounded-2xl border border-border/50 bg-card/60 p-4">
              <h2 className="text-xs text-muted-foreground">
                {t("japanese.word.examples")}
              </h2>
              <p
                className="mt-2 font-script-ja text-lg leading-[1.9]"
                lang="ja"
              >
                {example.furigana ? (
                  <JapaneseRuby
                    segments={parseFuriganaMarkup(example.furigana)}
                  />
                ) : (
                  example.ja
                )}
              </p>
              {exampleTranslation ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {exampleTranslation}
                </p>
              ) : null}
            </section>
          ) : null}

          {"vocabId" in card.key ? (
            <Link
              className="self-end text-sm text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
              params={{ id: card.key.vocabId }}
              to="/japanese/word/$id"
            >
              {t("japanese.study.openWord")}
            </Link>
          ) : null}
        </div>
      ) : (
        <Button
          className="self-center rounded-xl border-dashed"
          onClick={onReveal}
          size="lg"
          variant="outline"
        >
          {t("japanese.study.reveal")}
          <kbd className="rounded border border-border px-1.5 text-[11px] text-muted-foreground">
            Space
          </kbd>
        </Button>
      )}
    </div>
  )
}

function StudySession({ deck }: { deck: StudyDeck }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [ratedCount, setRatedCount] = useState(0)

  const queue = useQuery(
    orpc.japanese.study.queue.queryOptions({
      input: { deck, limit: BATCH_SIZE },
      // The batch is a snapshot: refetching mid-session would reshuffle cards.
      staleTime: Number.POSITIVE_INFINITY,
      refetchOnWindowFocus: false
    })
  )
  const cards = queue.data?.cards ?? []
  const card = cards[index]
  const isBatchDone = cards.length > 0 && index >= cards.length

  const rate = useMutation(
    orpc.japanese.study.rate.mutationOptions({
      onSuccess: () => {
        // Only the deck counts; the batch itself stays a fixed snapshot.
        queryClient.invalidateQueries({
          queryKey: orpc.japanese.study.decks.key()
        })
        setRatedCount((count) => count + 1)
        setRevealed(false)
        setIndex((current) => current + 1)
      },
      onError: () => {
        toast.error(t("japanese.study.rateFailed"))
      }
    })
  )

  const handleRate = (rating: (typeof RATINGS)[number]["rating"]) => {
    if (!card || !revealed || rate.isPending) return
    rate.mutate({ key: card.key, rating })
  }

  const startNextBatch = async () => {
    await queryClient.invalidateQueries({
      queryKey: orpc.japanese.study.key()
    })
    setIndex(0)
    setRevealed(false)
  }

  useHotkey("Space", (event) => {
    if (!card || revealed) return
    event.preventDefault()
    setRevealed(true)
  })
  useHotkey("Enter", (event) => {
    if (!isBatchDone) return
    event.preventDefault()
    startNextBatch()
  })
  useHotkey("1", (event) => {
    if (!revealed) return
    event.preventDefault()
    handleRate("again")
  })
  useHotkey("2", (event) => {
    if (!revealed) return
    event.preventDefault()
    handleRate("hard")
  })
  useHotkey("3", (event) => {
    if (!revealed) return
    event.preventDefault()
    handleRate("good")
  })

  let body: ReactNode
  if (queue.isPending) {
    body = (
      <div className="flex w-full max-w-xl flex-col items-center gap-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-16 w-48" />
        <Skeleton className="h-11 w-44" />
      </div>
    )
  } else if (queue.isError) {
    body = (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-lg font-semibold">
          {t("japanese.study.loadFailed")}
        </p>
        <Button onClick={() => queue.refetch()} variant="outline">
          {t("japanese.study.retry")}
        </Button>
      </div>
    )
  } else if (cards.length === 0) {
    body = (
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <p className="text-lg font-semibold">
          {t("japanese.study.emptyTitle")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("japanese.study.emptyDescription")}
        </p>
      </div>
    )
  } else if (isBatchDone || !card) {
    body = (
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <p className="text-2xl font-semibold">
          {t("japanese.study.doneTitle")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("japanese.study.doneDescription", { count: ratedCount })}
        </p>
        <Button className="mt-2" onClick={startNextBatch}>
          {t("japanese.study.nextBatch")}
          <HugeiconsIcon className="size-4" icon={ArrowRight01Icon} />
        </Button>
      </div>
    )
  } else {
    body = (
      <StudyCardFace
        card={card}
        onReveal={() => setRevealed(true)}
        revealed={revealed}
      />
    )
  }

  const showRatings = Boolean(card) && !isBatchDone

  return (
    <>
      <div className="flex shrink-0 items-center justify-end px-4 pb-2 text-xs text-muted-foreground tabular-nums sm:px-6">
        {cards.length > 0
          ? t("japanese.study.position", {
              current: Math.min(index + 1, cards.length),
              total: cards.length
            })
          : null}
      </div>
      <Progress
        className="h-1 shrink-0 rounded-none bg-surface-secondary [&>div]:bg-primary [&>div]:transition-all [&>div]:duration-300"
        value={cards.length > 0 ? (index / cards.length) * 100 : 0}
      />

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        {body}
      </div>

      {showRatings ? (
        <div className="sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-border/50 bg-background px-4 py-3 sm:px-6">
          {RATINGS.map(({ key, rating, labelKey }) => (
            <Button
              className="h-11 min-w-28 rounded-xl"
              disabled={!revealed || rate.isPending}
              key={rating}
              onClick={() => handleRate(rating)}
              variant="outline"
            >
              {t(labelKey)}
              <kbd className="text-[11px] text-muted-foreground">{key}</kbd>
            </Button>
          ))}
        </div>
      ) : null}
    </>
  )
}

/** Flashcards over the word bank with per-user spaced repetition. */
export function JapaneseVocabStudy({
  deckParam,
  onDeckChange
}: {
  deckParam: string | undefined
  onDeckChange: (deck: string) => void
}) {
  const { t } = useTranslation()
  const decks = useQuery(orpc.japanese.study.decks.queryOptions())
  const deck = decks.data ? resolveDeck(deckParam, decks.data) : null
  const deckKey = deck ? encodeDeck(deck) : null

  return (
    <div
      className={cn(
        "flex flex-col bg-background text-foreground",
        PRACTICE_VIEW_MIN_HEIGHT
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <JapanesePracticeTabs />
        {decks.data && deckKey ? (
          <DeckPicker
            decks={decks.data}
            onChange={onDeckChange}
            value={deckKey}
          />
        ) : null}
        {decks.isPending ? <Skeleton className="h-8 w-44" /> : null}
      </div>
      {decks.isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-lg font-semibold">
            {t("japanese.study.loadFailed")}
          </p>
          <Button onClick={() => decks.refetch()} variant="outline">
            {t("japanese.study.retry")}
          </Button>
        </div>
      ) : null}
      {deck && deckKey ? <StudySession deck={deck} key={deckKey} /> : null}
    </div>
  )
}
