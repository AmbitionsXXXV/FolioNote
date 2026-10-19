import { createFileRoute } from "@tanstack/react-router"

import { JapaneseArticleReadingView } from "@/components/japanese/japanese-article-reading-view"

export const Route = createFileRoute("/_app/japanese/read/$articleId")({
  component: JapaneseArticlePage
})

function JapaneseArticlePage() {
  const { articleId } = Route.useParams()
  return <JapaneseArticleReadingView articleId={articleId} />
}
