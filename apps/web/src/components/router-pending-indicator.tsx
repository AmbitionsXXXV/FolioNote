import { useRouterState } from "@tanstack/react-router"
import { AnimatePresence, motion } from "motion/react"

export function RouterPendingIndicator() {
  // Router 1.170 replaced `isTransitioning` with `status`.
  const isTransitioning = useRouterState({
    select: (state) => state.status === "pending"
  })

  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-x-0 top-0 z-9999 h-[3px] overflow-hidden"
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          <div className="absolute inset-0 bg-primary/20" />
          <motion.div
            animate={{ x: "100%" }}
            className="absolute inset-y-0 left-0 w-2/5 rounded-r-full bg-primary shadow-[0_0_8px_rgba(var(--primary)/0.4)]"
            initial={{ x: "-100%" }}
            transition={{
              duration: 1.2,
              repeat: Number.POSITIVE_INFINITY,
              ease: [0.4, 0, 0.2, 1]
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
