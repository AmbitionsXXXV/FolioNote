import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

interface TabBarContextValue {
  isHidden: boolean
  setHidden: (hidden: boolean) => void
}

const TabBarContext = createContext<TabBarContextValue | null>(null)

/**
 * Lets an immersive screen (a review session) hide the floating tab bar and
 * its input accessory so its own bottom action bar is never covered.
 */
export function TabBarProvider({ children }: { children: ReactNode }) {
  const [isHidden, setHidden] = useState(false)
  const value = useMemo(() => ({ isHidden, setHidden }), [isHidden])
  return (
    <TabBarContext.Provider value={value}>{children}</TabBarContext.Provider>
  )
}

export function useTabBar(): TabBarContextValue {
  const context = useContext(TabBarContext)
  if (!context) {
    throw new Error("useTabBar must be used inside TabBarProvider")
  }
  return context
}

/** Hide the tab bar while `hidden` is true; restores it on unmount. */
export function useHideTabBar(hidden: boolean) {
  const { setHidden } = useTabBar()
  useEffect(() => {
    setHidden(hidden)
    return () => setHidden(false)
  }, [hidden, setHidden])
}
