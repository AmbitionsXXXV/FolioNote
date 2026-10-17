import { createFileRoute } from "@tanstack/react-router"

import { JapaneseTypingPractice } from "@/components/review"

export const Route = createFileRoute("/_app/japanese/practice/typing")({
  component: JapaneseTypingPractice
})
