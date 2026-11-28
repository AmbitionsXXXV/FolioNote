import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Settings02Icon,
  VolumeHighIcon,
  WifiDisconnected01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect"
import { ImpactFeedbackStyle, impactAsync } from "expo-haptics"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import {
  Button,
  PressableFeedback,
  Spinner,
  useThemeColor
} from "heroui-native"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Alert, Platform, ScrollView, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { JapaneseRuby } from "@/components/japanese/japanese-ruby"
import { useIsOnline } from "@/hooks/use-network-state"
import { parseFuriganaMarkup } from "@/lib/japanese-furigana"
import {
  loadSpeechPrefs,
  prefetchAudio,
  pronounce,
  stopPronouncing
} from "@/lib/japanese/pronounce"
import type { SpeechPrefs } from "@/lib/japanese/pronounce"
import {
  cardId,
  cardMeanings,
  DEFAULT_DECK,
  deckKey,
  parseDeckKey
} from "@/lib/japanese/study-deck"
import type {
  StudyCard,
  StudyDeck,
  StudyRating
} from "@/lib/japanese/study-deck"
import {
  cacheCards,
  cachedCards,
  flushPendingRatings,
  queueRating,
  subscribePendingRatings
} from "@/lib/japanese/study-store"
import { getDeviceTimeZone } from "@/lib/study-day"
import { client, orpc } from "@/utils/orpc"

/** Cards fetched (and cached for offline use) per session. */
const BATCH_SIZE = 50
/** A forgotten card comes back after this many other cards. */
const REQUEUE_GAP = 4
const WORD_FONT_SIZE = 64
const EXAMPLE_FONT_SIZE = 18
const SECONDS_PER_MINUTE = 60
const MS_PER_SECOND = 1000
const CIRCLED_ONE = 0x24_60
const CIRCLED_ZERO = 0x24_ea
const RATINGS: StudyRating[] = ["again", "hard", "good"]

interface Batch {
  cards: StudyCard[]
  /** Served from the phone's cache because the server was unreachable. */
  offline: boolean
}

/**
 * Today's batch: due reviews (up to the plan's cap) then new words (up to
 * what is left of the daily target, or `extraNew` when the reader asked for
 * more). Falls back to the cached batch when offline.
 */
async function loadBatch(
  deck: StudyDeck,
  extraNew: number | null,
  timeZone: string | undefined
): Promise<Batch> {
  try {
    // Send offline ratings first so today's counts include them.
    await flushPendingRatings()
    const plan = await client.japanese.study.plan({ timeZone })
    const { cards } = await client.japanese.study.queue({
      deck,
      limit: BATCH_SIZE,
      newLimit: extraNew ?? plan.today.newRemaining
    })
    const reviews = cards.filter((card) => !card.isNew)
    const fresh = cards.filter((card) => card.isNew)
    const { reviewRemaining } = plan.today
    const batch = [
      ...(reviewRemaining === null
        ? reviews
        : reviews.slice(0, reviewRemaining)),
      ...fresh
    ]
    await cacheCards(deck, batch)
    prefetchAudio(
      batch.flatMap((card) => [card.audio.word, card.audio.example])
    ).catch(() => undefined)
    return { cards: batch, offline: false }
  } catch (error) {
    const cached = await cachedCards(deck)
    if (cached.length > 0) return { cards: cached, offline: true }
    throw error
  }
}

const usePendingRatings = () => {
  const [count, setCount] = useState(0)
  useEffect(() => subscribePendingRatings(setCount), [])
  return count
}

const circledAccent = (accent: number) =>
  String.fromCodePoint(accent === 0 ? CIRCLED_ZERO : CIRCLED_ONE + accent - 1)

const spokenWord = (card: StudyCard) => card.reading ?? card.word

/** Floating bar for immersive screens: Liquid Glass on iOS 26, a solid surface elsewhere. */
function GlassBar({
  children,
  radius,
  className
}: {
  children: ReactNode
  radius: number
  className?: string
}) {
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive
        style={{ borderRadius: radius }}
      >
        <View className={className}>{children}</View>
      </GlassView>
    )
  }
  return (
    <View
      className={`bg-surface ${className ?? ""}`}
      style={{ borderRadius: radius }}
    >
      {children}
    </View>
  )
}

function CircleButton({
  label,
  icon,
  onPress
}: {
  label: string
  icon: typeof Cancel01Icon
  onPress: () => void
}) {
  const foreground = useThemeColor("foreground")
  return (
    <GlassBar radius={22}>
      <PressableFeedback
        accessibilityLabel={label}
        accessibilityRole="button"
        className="size-11 items-center justify-center"
        onPress={onPress}
      >
        <HugeiconsIcon color={foreground} icon={icon} size={20} />
      </PressableFeedback>
    </GlassBar>
  )
}

function SpeakButton({
  label,
  onPress,
  size = 48
}: {
  label: string
  onPress: () => void
  size?: number
}) {
  const foreground = useThemeColor("foreground")
  return (
    <PressableFeedback
      accessibilityLabel={label}
      accessibilityRole="button"
      className="items-center justify-center rounded-full bg-default"
      hitSlop={8}
      onPress={onPress}
      style={{ width: size, height: size }}
    >
      <HugeiconsIcon color={foreground} icon={VolumeHighIcon} size={size / 2} />
    </PressableFeedback>
  )
}

function CardTags({ card }: { card: StudyCard }) {
  const { t } = useTranslation()
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {card.level ? (
        <Text className="overflow-hidden rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
          {card.level}
        </Text>
      ) : null}
      {card.partOfSpeech ? (
        <Text className="overflow-hidden rounded-full bg-default px-2.5 py-0.5 text-xs font-semibold text-foreground">
          {card.partOfSpeech}
        </Text>
      ) : null}
      {card.isNew ? (
        <Text className="overflow-hidden rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
          {t("japanese.daily.new")}
        </Text>
      ) : null}
    </View>
  )
}

function CardBack({
  card,
  language,
  slow
}: {
  card: StudyCard
  language: string
  slow: boolean
}) {
  const { t } = useTranslation()
  const meanings = cardMeanings(card, language)
  const { example } = card
  const translation = language.startsWith("zh")
    ? (example?.zh ?? example?.en)
    : (example?.en ?? example?.zh)
  const [accent] = card.pitchAccents
  return (
    <View className="gap-4">
      <CardTags card={card} />
      <View className="flex-row items-center gap-3.5">
        <View className="flex-1 gap-1">
          <Text className="text-[44px] leading-[52px] font-bold text-foreground">
            {card.word}
          </Text>
          <View className="flex-row flex-wrap items-baseline gap-x-2">
            {card.reading && card.reading !== card.word ? (
              <Text className="text-lg text-foreground">{card.reading}</Text>
            ) : null}
            {accent === undefined ? null : (
              <Text className="text-[15px] text-accent">
                {circledAccent(accent)}
              </Text>
            )}
            {card.romaji ? (
              <Text className="text-[13px] text-muted">{card.romaji}</Text>
            ) : null}
          </View>
        </View>
        <SpeakButton
          label={t("japanese.daily.session.speakWord", { text: card.word })}
          onPress={() => {
            pronounce(spokenWord(card), {
              audioUrl: card.audio.word,
              slow
            }).catch(() => undefined)
          }}
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-xs font-semibold text-muted">
          {t("japanese.daily.session.meanings")}
        </Text>
        {meanings.length > 0 ? (
          meanings.slice(0, 4).map((meaning, index) => (
            // Meanings can repeat across languages; order is the identity.
            // oxlint-disable-next-line react/no-array-index-key
            <Text className="text-[17px] leading-6 text-foreground" key={index}>
              {meanings.length > 1 ? `${index + 1}. ` : ""}
              {meaning}
            </Text>
          ))
        ) : (
          <Text className="text-[15px] text-muted">
            {t("japanese.daily.session.noMeaning")}
          </Text>
        )}
      </View>

      {example ? (
        <View className="gap-1.5 rounded-xl bg-default px-3.5 py-3">
          <View className="flex-row items-center">
            <Text className="flex-1 text-xs font-semibold text-muted">
              {example.source === "context"
                ? t("japanese.daily.session.exampleContext")
                : t("japanese.daily.session.exampleBank")}
            </Text>
            <SpeakButton
              label={t("japanese.daily.session.speakExample")}
              onPress={() => {
                pronounce(example.ja, {
                  audioUrl: card.audio.example,
                  slow
                }).catch(() => undefined)
              }}
              size={36}
            />
          </View>
          {example.furigana ? (
            <JapaneseRuby
              fontSize={EXAMPLE_FONT_SIZE}
              segments={parseFuriganaMarkup(example.furigana)}
              wrap
            />
          ) : (
            <Text className="text-lg leading-8 text-foreground">
              {example.ja}
            </Text>
          )}
          {translation ? (
            <Text className="text-sm text-muted">{translation}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function RatingBar({ onRate }: { onRate: (rating: StudyRating) => void }) {
  const { t } = useTranslation()
  const styles: Record<StudyRating, { box: string; text: string }> = {
    again: { box: "bg-danger/10", text: "text-danger" },
    hard: { box: "bg-default", text: "text-foreground" },
    good: { box: "bg-accent", text: "text-accent-foreground" },
    easy: { box: "bg-success/10", text: "text-success" }
  }
  return (
    <GlassBar className="flex-row gap-1.5 p-2" radius={30}>
      {RATINGS.map((rating) => (
        <PressableFeedback
          accessibilityRole="button"
          className={`h-16 flex-1 items-center justify-center rounded-[22px] ${styles[rating].box}`}
          key={rating}
          onPress={() => onRate(rating)}
        >
          <Text className={`text-base font-bold ${styles[rating].text}`}>
            {t(`japanese.daily.session.${rating}`)}
          </Text>
        </PressableFeedback>
      ))}
    </GlassBar>
  )
}

function DoneView({
  tally,
  forgotten,
  elapsedMs,
  pending,
  onFinish,
  onMore
}: {
  tally: { new: number; review: number }
  forgotten: StudyCard[]
  elapsedMs: number
  pending: number
  onFinish: () => void
  onMore: () => void
}) {
  const { t } = useTranslation()
  const success = useThemeColor("success")
  const timeZone = getDeviceTimeZone()
  const today = useQuery(
    orpc.streak.getToday.queryOptions({ input: { timeZone } })
  )
  const seconds = Math.round(elapsedMs / MS_PER_SECOND)
  const time = `${Math.floor(seconds / SECONDS_PER_MINUTE)}′${String(
    seconds % SECONDS_PER_MINUTE
  ).padStart(2, "0")}″`
  const goal = today.data
  const goalMet = goal ? goal.todayPoints >= goal.dailyGoal : false

  return (
    <View className="flex-1">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 92, gap: 12 }}
        contentInsetAdjustmentBehavior="never"
      >
        <View className="items-center gap-1.5 pb-2">
          <View className="size-14 items-center justify-center rounded-full bg-success/15">
            <HugeiconsIcon
              color={success}
              icon={CheckmarkCircle02Icon}
              size={28}
            />
          </View>
          <Text
            accessibilityRole="header"
            className="text-[28px] font-bold text-foreground"
          >
            {t("japanese.daily.done.title")}
          </Text>
        </View>
        <View className="flex-row gap-2">
          {[
            [t("japanese.daily.done.new"), String(tally.new)],
            [t("japanese.daily.done.review"), String(tally.review)],
            [t("japanese.daily.done.time"), time]
          ].map(([label, value]) => (
            <View
              className="flex-1 items-center gap-1 rounded-3xl bg-surface px-2 py-3.5"
              key={label}
            >
              <Text className="text-xs text-muted">{label}</Text>
              <Text className="text-2xl font-bold text-foreground tabular-nums">
                {value}
              </Text>
            </View>
          ))}
        </View>
        {goal ? (
          <View className="gap-2.5 rounded-3xl bg-surface p-4">
            <View className="flex-row justify-between">
              <Text className="text-sm font-bold text-foreground">
                {t("japanese.daily.done.goal")}
              </Text>
              <Text
                className={`text-sm font-semibold ${goalMet ? "text-success" : "text-muted"}`}
              >
                {goal.todayPoints} / {goal.dailyGoal}
                {goalMet ? ` · ${t("japanese.daily.done.goalMet")}` : ""}
              </Text>
            </View>
            <View className="h-2.5 overflow-hidden rounded-full bg-default">
              <View
                className="h-2.5 rounded-full bg-accent"
                style={{
                  width: `${Math.min(1, goal.todayPoints / Math.max(1, goal.dailyGoal)) * 100}%`
                }}
              />
            </View>
          </View>
        ) : null}
        {forgotten.length > 0 ? (
          <View className="gap-2.5 rounded-3xl bg-surface p-4">
            <Text className="text-[13px] text-muted">
              {t("japanese.daily.done.forgotten", { count: forgotten.length })}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {forgotten.map((card) => (
                <Text
                  className="overflow-hidden rounded-xl bg-accent/15 px-3 py-1.5 text-base text-foreground"
                  key={cardId(card)}
                >
                  {card.word}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
        <Text className="text-center text-xs text-muted">
          {pending > 0
            ? t("japanese.daily.done.pending", { count: pending })
            : t("japanese.daily.done.synced")}
        </Text>
      </ScrollView>
      <View className="gap-2.5 px-4 pb-9">
        <Button className="h-[54px] rounded-full bg-accent" onPress={onFinish}>
          <Button.Label className="text-[17px] font-semibold text-accent-foreground">
            {t("japanese.daily.done.finish")}
          </Button.Label>
        </Button>
        <Button
          className="h-[50px] rounded-full"
          onPress={onMore}
          variant="tertiary"
        >
          <Button.Label className="text-base font-semibold">
            {t("japanese.daily.done.moreNew")}
          </Button.Label>
        </Button>
      </View>
    </View>
  )
}

function CenteredMessage({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-center text-xl font-bold text-foreground">
        {title}
      </Text>
      {description ? (
        <Text className="text-center text-[15px] leading-6 text-muted">
          {description}
        </Text>
      ) : null}
      {children}
    </View>
  )
}

/**
 * Immersive daily vocabulary session: the front shows the word, a tap
 * reveals reading, meanings and an example, and three ratings schedule it.
 */
export default function DailyStudyScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const online = useIsOnline()
  const accent = useThemeColor("accent")
  const muted = useThemeColor("muted")
  const params = useLocalSearchParams<{ deck?: string; extra?: string }>()
  const deck = parseDeckKey(params.deck) ?? DEFAULT_DECK
  const extraNew = params.extra ? Number(params.extra) : null
  const timeZone = getDeviceTimeZone()
  const language = i18n.resolvedLanguage ?? i18n.language
  const pending = usePendingRatings()

  const batch = useQuery({
    queryKey: ["jp-daily-batch", deckKey(deck), extraNew],
    queryFn: () => loadBatch(deck, extraNew, timeZone),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false
  })

  const [prefs, setPrefs] = useState<SpeechPrefs>(loadSpeechPrefs)
  // The plan sheet can change speech settings mid-session.
  useFocusEffect(
    useCallback(() => {
      setPrefs(loadSpeechPrefs())
    }, [])
  )

  const [queue, setQueue] = useState<StudyCard[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [tally, setTally] = useState({ new: 0, review: 0 })
  const [forgotten, setForgotten] = useState<StudyCard[]>([])
  const seen = useRef(new Set<string>())
  const startedAt = useRef(Date.now())
  const [finishedAt, setFinishedAt] = useState<number | null>(null)

  useEffect(() => {
    if (batch.data) {
      setQueue(batch.data.cards)
      setIndex(0)
      setRevealed(false)
    }
  }, [batch.data])

  const current = queue?.[index]
  const finished = queue !== null && queue.length > 0 && index >= queue.length

  // Read each new card aloud as it appears.
  useEffect(() => {
    if (!(current && prefs.autoSpeak)) return
    pronounce(spokenWord(current), {
      audioUrl: current.audio.word,
      slow: prefs.slow
    }).catch(() => undefined)
  }, [current, prefs.autoSpeak, prefs.slow])

  useEffect(() => stopPronouncing, [])

  // Back online: send what was rated offline.
  useEffect(() => {
    if (online) flushPendingRatings().catch(() => undefined)
  }, [online])

  useEffect(() => {
    if (!finished) return
    setFinishedAt(Date.now())
    flushPendingRatings()
      .catch(() => undefined)
      .finally(() => {
        queryClient.invalidateQueries({ queryKey: orpc.japanese.study.key() })
        queryClient.invalidateQueries({ queryKey: orpc.streak.key() })
      })
  }, [finished, queryClient])

  const reveal = () => {
    setRevealed(true)
    if (current?.example && prefs.speakExample) {
      pronounce(current.example.ja, {
        audioUrl: current.audio.example,
        slow: prefs.slow
      }).catch(() => undefined)
    }
  }

  const rate = (rating: StudyRating) => {
    if (!current) return
    stopPronouncing()
    impactAsync(ImpactFeedbackStyle.Light).catch(() => undefined)
    const id = cardId(current)
    const firstTime = !seen.current.has(id)
    seen.current.add(id)
    setTally((before) =>
      current.isNew && firstTime
        ? { ...before, new: before.new + 1 }
        : { ...before, review: before.review + 1 }
    )
    if (rating === "again") {
      setForgotten((before) =>
        before.some((card) => cardId(card) === id)
          ? before
          : [...before, current]
      )
      setQueue((before) => {
        if (!before) return before
        const next = [...before]
        next.splice(index + 1 + REQUEUE_GAP, 0, { ...current, isNew: false })
        return next
      })
    }
    queueRating(current, rating).catch(() => {
      Alert.alert(t("common.error"), t("japanese.daily.session.rateFailed"))
    })
    setIndex((before) => before + 1)
    setRevealed(false)
  }

  const studyMore = () => {
    router.replace({
      pathname: "/japanese/study",
      params: { deck: deckKey(deck), extra: "5" }
    })
  }

  const remaining = queue?.slice(index) ?? []
  const againLeft = remaining.filter((card) =>
    seen.current.has(cardId(card))
  ).length
  const newLeft = remaining.filter(
    (card) => card.isNew && !seen.current.has(cardId(card))
  ).length
  const reviewLeft = remaining.length - againLeft - newLeft
  const total = queue?.length ?? 0
  const progress = total > 0 ? Math.min(1, index / total) : 0

  let body: ReactNode
  if (batch.isPending || (batch.data && queue === null)) {
    body = (
      <View className="flex-1 items-center justify-center">
        <Spinner />
      </View>
    )
  } else if (batch.isError) {
    body = (
      <CenteredMessage title={t("japanese.daily.session.loadFailed")}>
        <Button onPress={() => batch.refetch()} variant="tertiary">
          <Button.Label>{t("japanese.daily.session.retry")}</Button.Label>
        </Button>
      </CenteredMessage>
    )
  } else if (finished) {
    body = (
      <DoneView
        elapsedMs={(finishedAt ?? Date.now()) - startedAt.current}
        forgotten={forgotten}
        onFinish={() => router.back()}
        onMore={studyMore}
        pending={pending}
        tally={tally}
      />
    )
  } else if (!current) {
    body = (
      <CenteredMessage
        description={t("japanese.daily.session.emptyDescription")}
        title={t("japanese.daily.session.emptyTitle")}
      >
        <Button className="rounded-full bg-accent" onPress={studyMore}>
          <Button.Label className="text-accent-foreground">
            {t("japanese.daily.moreNew")}
          </Button.Label>
        </Button>
      </CenteredMessage>
    )
  } else {
    body = (
      <View className="flex-1" style={{ paddingTop: insets.top + 70 }}>
        <Text className="text-center text-xs text-muted">
          {t("japanese.daily.session.counts", {
            new: newLeft,
            review: reviewLeft,
            again: againLeft
          })}
        </Text>
        <View className="mt-2 flex-1 px-4 pb-[132px]">
          {revealed ? (
            <ScrollView
              className="flex-1 rounded-3xl bg-surface"
              contentContainerStyle={{ padding: 22 }}
            >
              <CardBack card={current} language={language} slow={prefs.slow} />
            </ScrollView>
          ) : (
            <PressableFeedback
              accessibilityHint={t("japanese.daily.session.revealHint")}
              accessibilityLabel={current.word}
              accessibilityRole="button"
              className="flex-1 items-center gap-4 rounded-3xl bg-surface p-[22px]"
              onPress={reveal}
            >
              <CardTags card={current} />
              <View className="flex-1 items-center justify-center gap-4">
                <Text
                  className="text-center font-bold text-foreground"
                  style={{
                    fontSize: WORD_FONT_SIZE,
                    lineHeight: WORD_FONT_SIZE * 1.15
                  }}
                >
                  {current.word}
                </Text>
                <Text className="text-sm text-muted">
                  {t("japanese.daily.session.think")}
                </Text>
              </View>
              <Text className="text-xs text-muted">
                {t("japanese.daily.session.tapToFlip")}
              </Text>
            </PressableFeedback>
          )}
        </View>
        <View
          className="absolute inset-x-4"
          style={{ bottom: insets.bottom + 12 }}
        >
          {revealed ? (
            <RatingBar onRate={rate} />
          ) : (
            <GlassBar className="flex-row gap-2 p-2" radius={30}>
              <PressableFeedback
                accessibilityLabel={t("japanese.daily.session.speakWord", {
                  text: current.word
                })}
                accessibilityRole="button"
                className="size-[60px] items-center justify-center rounded-[22px] bg-default"
                onPress={() => {
                  pronounce(spokenWord(current), {
                    audioUrl: current.audio.word,
                    slow: prefs.slow
                  }).catch(() => undefined)
                }}
                onLongPress={() => {
                  pronounce(spokenWord(current), {
                    audioUrl: current.audio.word,
                    slow: true
                  }).catch(() => undefined)
                }}
              >
                <HugeiconsIcon color={accent} icon={VolumeHighIcon} size={24} />
              </PressableFeedback>
              <Button
                className="h-[60px] flex-1 rounded-[22px] bg-accent"
                onPress={reveal}
              >
                <Button.Label className="text-[17px] font-semibold text-accent-foreground">
                  {t("japanese.daily.session.reveal")}
                </Button.Label>
              </Button>
            </GlassBar>
          )}
        </View>
      </View>
    )
  }

  const showTopBar = !(finished || batch.isPending)
  return (
    <View className="flex-1 bg-background">
      {body}
      {showTopBar ? (
        <View
          className="absolute inset-x-4 flex-row items-center gap-2.5"
          style={{ top: insets.top + 8 }}
        >
          <CircleButton
            icon={Cancel01Icon}
            label={t("japanese.daily.session.close")}
            onPress={() => router.back()}
          />
          <View className="flex-1">
            <GlassBar
              className="h-11 flex-row items-center gap-2.5 px-4"
              radius={22}
            >
              <View
                accessibilityLabel={t("japanese.daily.session.progress")}
                accessibilityValue={{ min: 0, max: total, now: index }}
                accessible
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-default"
              >
                <View
                  className="h-1.5 rounded-full bg-accent"
                  style={{ width: `${progress * 100}%` }}
                />
              </View>
              <Text className="text-[13px] font-semibold text-foreground tabular-nums">
                {Math.min(index + 1, total)} / {total}
              </Text>
              {pending > 0 || batch.data?.offline ? (
                <View
                  accessibilityLabel={t("japanese.daily.session.pending", {
                    count: pending
                  })}
                  accessible
                  className="flex-row items-center gap-1"
                >
                  <HugeiconsIcon
                    color={muted}
                    icon={WifiDisconnected01Icon}
                    size={14}
                  />
                  <Text className="text-xs font-semibold text-muted">
                    {pending}
                  </Text>
                </View>
              ) : null}
            </GlassBar>
          </View>
          <CircleButton
            icon={Settings02Icon}
            label={t("japanese.daily.session.settings")}
            onPress={() => router.push("/japanese/plan")}
          />
        </View>
      ) : null}
    </View>
  )
}
