import * as SecureStore from "expo-secure-store"

/**
 * What the reader really did during first-run onboarding, kept on the device
 * until it can be written: the note goes in as soon as there is a data
 * service (account or local mode), the word and the plan need an account.
 *
 * How it ends decides what is saved (design decision 2):
 * - sign-up: everything.
 * - sign-in to an existing account: only the note and the word; the
 *   existing daily plan stays untouched.
 * - local mode: the note now, the word once the reader signs in later.
 */

export type JapaneseLevel = "beginner" | "N5" | "N4" | "N3" | "N2" | "N1"
export const JAPANESE_LEVELS: readonly JapaneseLevel[] = [
  "beginner",
  "N5",
  "N4",
  "N3",
  "N2",
  "N1"
]

export type OnboardingOutcome = "sign-up" | "sign-in" | "local"

export interface OnboardingPlan {
  useNotes: boolean
  useJapanese: boolean
  level: JapaneseLevel
  dailyNewWords: number
  remind: boolean
}

export interface OnboardingDraft {
  note: string | null
  wordSaved: boolean
  plan: OnboardingPlan | null
  outcome: OnboardingOutcome | null
  applied: { note: boolean; word: boolean; plan: boolean }
}

/** The demo word every step shares: write it, flip it, hear it. */
export const DEMO_WORD = {
  headword: "木漏れ日",
  reading: "こもれび",
  sentence: "木漏れ日がとてもきれいでした。"
} as const

export const DAILY_NEW_WORDS_MIN = 1
export const DAILY_NEW_WORDS_MAX = 50
export const DEFAULT_DAILY_NEW_WORDS = 10

const DRAFT_KEY = "folio_onboarding_draft"

export const emptyDraft = (): OnboardingDraft => ({
  note: null,
  wordSaved: false,
  plan: null,
  outcome: null,
  applied: { note: false, word: false, plan: false }
})

export async function loadOnboardingDraft(): Promise<OnboardingDraft | null> {
  const raw = await SecureStore.getItemAsync(DRAFT_KEY)
  if (!raw) return null
  try {
    return { ...emptyDraft(), ...(JSON.parse(raw) as OnboardingDraft) }
  } catch {
    // A draft we cannot read is not worth crashing over; drop it.
    await SecureStore.deleteItemAsync(DRAFT_KEY)
    return null
  }
}

export async function saveOnboardingDraft(
  draft: OnboardingDraft
): Promise<void> {
  await SecureStore.setItemAsync(DRAFT_KEY, JSON.stringify(draft))
}

export async function clearOnboardingDraft(): Promise<void> {
  await SecureStore.deleteItemAsync(DRAFT_KEY)
}

/** Which parts of the draft this outcome should ever write. */
export function wantedParts(draft: OnboardingDraft) {
  return {
    note: !!draft.note,
    word: draft.wordSaved,
    plan: draft.outcome === "sign-up" && !!draft.plan
  }
}

export const isDraftSettled = (draft: OnboardingDraft): boolean => {
  const wanted = wantedParts(draft)
  return (
    (!wanted.note || draft.applied.note) &&
    (!wanted.word || draft.applied.word) &&
    (!wanted.plan || draft.applied.plan)
  )
}
