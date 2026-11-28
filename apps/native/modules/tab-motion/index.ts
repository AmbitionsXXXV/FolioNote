import { requireOptionalNativeModule } from "expo"

/** Motions defined on the design canvas (图标与动效). */
export type TabMotionKind = "stamp" | "drop" | "open" | "bounce"

interface TabMotionNative {
  play(index: number, kind: TabMotionKind): void
}

// Optional: absent on Android, on web, and in builds made before this module
// existed. The tab bar then just switches icons without the extra motion.
const native = requireOptionalNativeModule<TabMotionNative>("TabMotion")

/** Plays the selection motion on the tab icon at `index` (left to right). */
export function playTabMotion(index: number, kind: TabMotionKind): void {
  native?.play(index, kind)
}
