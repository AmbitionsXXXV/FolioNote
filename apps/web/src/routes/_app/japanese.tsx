import { createFileRoute, Outlet } from "@tanstack/react-router"

import { JapaneseSectionNav } from "@/components/japanese/japanese-section-nav"

export const Route = createFileRoute("/_app/japanese")({
  component: JapaneseLayout
})

/** Shared frame for the Japanese hub: section pills above every sub-page. */
function JapaneseLayout() {
  return (
    <div className="px-4 pt-6 md:pt-8">
      <div className="mx-auto mb-6 flex max-w-5xl justify-center">
        <JapaneseSectionNav />
      </div>
      <Outlet />
    </div>
  )
}
