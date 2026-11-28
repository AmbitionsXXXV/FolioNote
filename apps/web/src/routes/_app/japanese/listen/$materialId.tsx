import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { JapaneseListenMaterial } from "@/components/japanese/listen/japanese-listen-material"

// `t` is the line time in ms, used by notebook links to jump back into a video.
const SearchSchema = z.object({
  t: z.coerce.number().int().min(0).optional()
})

export const Route = createFileRoute("/_app/japanese/listen/$materialId")({
  validateSearch: SearchSchema,
  component: ListenMaterialRoute
})

function ListenMaterialRoute() {
  const { materialId } = Route.useParams()
  const { t } = Route.useSearch()
  return (
    <JapaneseListenMaterial
      key={materialId}
      materialId={materialId}
      startAtMs={t}
    />
  )
}
