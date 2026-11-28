import { createFileRoute } from "@tanstack/react-router"

import { JapaneseListenView } from "@/components/japanese/listen/japanese-listen-view"

export const Route = createFileRoute("/_app/japanese/listen/")({
  component: JapaneseListenView
})
