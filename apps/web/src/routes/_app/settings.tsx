import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation
} from "@tanstack/react-router"
import { motion } from "motion/react"

import { SettingsNav } from "@/components/settings"

export const Route = createFileRoute("/_app/settings")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/settings") {
      throw redirect({ to: "/settings/general" })
    }
  },
  component: SettingsLayout
})

function SettingsLayout() {
  // Route.fullPath is the constant "/settings"; key on the real pathname so
  // the fade replays when switching between settings sub-pages.
  const pathname = useLocation({ select: (location) => location.pathname })
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row md:gap-10 md:px-8 md:py-12">
      <SettingsNav />
      <div className="min-w-0 flex-1">
        <motion.div
          animate={{ opacity: 1 }}
          initial={{ opacity: 0 }}
          key={pathname}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  )
}
