import { createFileRoute } from "@tanstack/react-router"

import { JapaneseExamView } from "@/components/review"

export const Route = createFileRoute("/_app/japanese/practice/exam")({
  component: JapaneseExamView
})
