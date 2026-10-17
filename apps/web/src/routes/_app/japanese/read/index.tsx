import { createFileRoute } from "@tanstack/react-router"

import { JapaneseReadingView } from "@/components/japanese/japanese-reading-view"

export const Route = createFileRoute("/_app/japanese/read/")({
  component: JapaneseReadingView
})
