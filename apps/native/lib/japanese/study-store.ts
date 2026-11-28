/**
 * Offline support for daily vocabulary study.
 *
 * Every rating goes into a local queue first and is sent from there, so a
 * session works the same with or without a connection. Each queued rating
 * carries its own id and the time it was made: the server applies a replay
 * once and counts it on the day the reader actually studied.
 *
 * The last batch of cards fetched for each deck is kept too, so a session
 * can start offline.
 */
import { ORPCError } from "@orpc/client"
import Storage from "expo-sqlite/kv-store"

import { getDeviceTimeZone } from "@/lib/study-day"
import { client } from "@/utils/orpc"

import { cardId, deckKey } from "./study-deck"
import type { StudyCard, StudyDeck, StudyRating } from "./study-deck"

const PENDING_KEY = "jp-study:pending-ratings"
const cardsKey = (deck: StudyDeck) => `jp-study:cards:${deckKey(deck)}`

interface PendingRating {
  clientId: string
  key: StudyCard["key"]
  /** cardId(card), to leave rated cards out of a cached batch. */
  cardId: string
  rating: StudyRating
  occurredAt: string
  timeZone?: string
}

type Listener = (count: number) => void
const listeners = new Set<Listener>()
let pendingCount = 0

const notify = (count: number) => {
  pendingCount = count
  for (const listener of listeners) listener(count)
}

/** Subscribe to the number of ratings waiting to be sent. */
export const subscribePendingRatings = (listener: Listener) => {
  listeners.add(listener)
  listener(pendingCount)
  return () => {
    listeners.delete(listener)
  }
}

const readPending = async (): Promise<PendingRating[]> => {
  const stored = await Storage.getItem(PENDING_KEY)
  if (!stored) return []
  try {
    return JSON.parse(stored) as PendingRating[]
  } catch {
    // A corrupt queue cannot be replayed; starting empty beats crashing.
    return []
  }
}

const writePending = async (pending: PendingRating[]) => {
  await Storage.setItem(PENDING_KEY, JSON.stringify(pending))
  notify(pending.length)
}

const newClientId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

// Ratings are queued and flushed one at a time, so writes never interleave.
let chain: Promise<unknown> = Promise.resolve()
const serialized = <T>(task: () => Promise<T>): Promise<T> => {
  // Run after the previous task whether it succeeded or not.
  const run = chain.catch(() => undefined).then(task)
  chain = run.catch(() => undefined)
  return run
}

/** Server answers that will never change on retry: drop the rating. */
const isPermanentFailure = (error: unknown) =>
  error instanceof ORPCError &&
  (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST")

/**
 * Send queued ratings oldest first. Stops at the first network failure and
 * leaves the rest for the next try. Resolves to how many are still waiting.
 */
export const flushPendingRatings = (): Promise<number> =>
  serialized(async () => {
    const pending = await readPending()
    while (pending.length > 0) {
      const next = pending[0] as PendingRating
      try {
        await client.japanese.study.rate({
          key: next.key,
          rating: next.rating,
          clientId: next.clientId,
          occurredAt: new Date(next.occurredAt),
          timeZone: next.timeZone
        })
      } catch (error) {
        if (!isPermanentFailure(error)) break
      }
      pending.shift()
      await writePending(pending)
    }
    notify(pending.length)
    return pending.length
  })

/** Queue a rating and try to send it right away. */
export const queueRating = async (card: StudyCard, rating: StudyRating) => {
  await serialized(async () => {
    const pending = await readPending()
    pending.push({
      clientId: newClientId(),
      key: card.key,
      cardId: cardId(card),
      rating,
      occurredAt: new Date().toISOString(),
      timeZone: getDeviceTimeZone()
    })
    await writePending(pending)
  })
  // Sending is best effort; the queue keeps the rating until it lands.
  flushPendingRatings().catch(() => undefined)
}

/** Remember the batch just fetched so the same deck can be studied offline. */
export const cacheCards = async (deck: StudyDeck, cards: StudyCard[]) => {
  await Storage.setItem(cardsKey(deck), JSON.stringify(cards))
}

/** The last fetched batch for a deck, minus cards rated since. */
export const cachedCards = async (deck: StudyDeck): Promise<StudyCard[]> => {
  const stored = await Storage.getItem(cardsKey(deck))
  if (!stored) return []
  let cards: StudyCard[]
  try {
    cards = JSON.parse(stored) as StudyCard[]
  } catch {
    return []
  }
  const pending = await readPending()
  const rated = new Set(pending.map((entry) => entry.cardId))
  return cards.filter((card) => !rated.has(cardId(card)))
}
