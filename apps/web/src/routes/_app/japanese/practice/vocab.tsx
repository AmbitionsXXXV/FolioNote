import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { JapaneseVocabStudy } from "@/components/japanese/japanese-vocab-study"

const vocabSearchSchema = z.object({
  /** Chosen deck, kept in the URL so a refresh stays on it. */
  deck: z.string().max(200).optional().catch(undefined)
})

export const Route = createFileRoute("/_app/japanese/practice/vocab")({
  component: VocabPracticePage,
  validateSearch: vocabSearchSchema
})

function VocabPracticePage() {
  const { deck } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <JapaneseVocabStudy
      deckParam={deck}
      onDeckChange={(next) =>
        navigate({ replace: true, search: { deck: next } })
      }
    />
  )
}
