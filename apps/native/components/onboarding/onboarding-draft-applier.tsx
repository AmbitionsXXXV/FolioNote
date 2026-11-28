import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { useDataServiceContext } from "@/contexts/data-service-context"
import { authClient } from "@/lib/auth-client"
import { DEFAULT_REMINDER_TIME, loadReminderTime } from "@/lib/daily-reminder"
import {
  clearOnboardingDraft,
  DEMO_WORD,
  isDraftSettled,
  loadOnboardingDraft,
  saveOnboardingDraft,
  wantedParts
} from "@/lib/onboarding-draft"
import type { OnboardingDraft } from "@/lib/onboarding-draft"
import { getDeviceTimeZone } from "@/lib/study-day"
import { client, queryClient } from "@/utils/orpc"

type MeaningLanguage = "zh" | "en" | "ja"

const meaningLanguageFor = (language: string): MeaningLanguage => {
  if (language.startsWith("ja")) return "ja"
  if (language.startsWith("en")) return "en"
  return "zh"
}

/**
 * Writes what the reader did during onboarding once there is somewhere to
 * write it. Each part is marked applied as soon as it lands, so a failure
 * (offline, server error) is simply retried on the next launch or sign-in.
 */
export function OnboardingDraftApplier() {
  const { i18n } = useTranslation()
  const { dataService } = useDataServiceContext()
  const { data: session } = authClient.useSession()
  const isAuthenticated = !!session?.user
  const running = useRef(false)
  // The data service is rebuilt on every provider render; once nothing is
  // pending for this sign-in state, skip re-reading the draft.
  const settledFor = useRef<boolean | null>(null)

  useEffect(() => {
    if (!dataService || running.current) return
    if (settledFor.current === isAuthenticated) return
    running.current = true

    const apply = async () => {
      const draft = await loadOnboardingDraft()
      if (!draft?.outcome) {
        settledFor.current = isAuthenticated
        return
      }
      const wanted = wantedParts(draft)
      const next: OnboardingDraft = { ...draft, applied: { ...draft.applied } }

      if (wanted.note && !next.applied.note && draft.note) {
        await dataService.entries.create({ title: draft.note, isInbox: true })
        next.applied.note = true
        await saveOnboardingDraft(next)
      }

      if (wanted.word && !next.applied.word && isAuthenticated) {
        await client.japanese.notebook.save({
          headword: DEMO_WORD.headword,
          reading: DEMO_WORD.reading,
          baseForm: DEMO_WORD.headword,
          meaningLanguage: meaningLanguageFor(i18n.language),
          context: { sentence: DEMO_WORD.sentence }
        })
        next.applied.word = true
        await saveOnboardingDraft(next)
      }

      if (wanted.plan && !next.applied.plan && isAuthenticated && draft.plan) {
        const { plan } = draft
        const remindAt = plan.remind
          ? ((await loadReminderTime()) ?? DEFAULT_REMINDER_TIME)
          : null
        await client.streak.updateSettings({
          ...(plan.useJapanese ? { languages: ["ja" as const] } : {}),
          remindAt,
          timeZone: getDeviceTimeZone()
        })
        if (plan.useJapanese) {
          await client.japanese.study.updatePlan({
            dailyNewWords: plan.dailyNewWords,
            deck: {
              kind: "level",
              level: plan.level === "beginner" ? "N5" : plan.level
            }
          })
        }
        next.applied.plan = true
        await saveOnboardingDraft(next)
      }

      if (isDraftSettled(next)) {
        await clearOnboardingDraft()
        settledFor.current = isAuthenticated
      } else if (!isAuthenticated) {
        // Local mode: the rest waits for an account.
        settledFor.current = false
      }
      await queryClient.invalidateQueries()
    }

    apply()
      .catch((error: unknown) => {
        // Kept on the device; the next launch or sign-in tries again.
        console.warn("[Onboarding] Saving the first page failed:", error)
      })
      .finally(() => {
        running.current = false
      })
  }, [dataService, isAuthenticated, i18n.language])

  return null
}
