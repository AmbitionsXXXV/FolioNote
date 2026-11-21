import type { BottomSheetRef } from "heroui-native"
import { useCallback, useEffect, useRef } from "react"

/**
 * Drives heroui-native's imperative BottomSheet (TrueSheet) from `isOpen` state,
 * so call sites keep their controlled `isOpen` / `onOpenChange` props.
 * Spread the result onto `<BottomSheet>`.
 */
export function useBottomSheetOpenState(
  isOpen: boolean,
  onOpenChange: (isOpen: boolean) => void
) {
  const ref = useRef<BottomSheetRef>(null)
  // TrueSheet's native dismiss expects a presented sheet, so only dismiss what we presented.
  const isPresentedRef = useRef(false)

  useEffect(() => {
    const sheet = ref.current
    if (!sheet) {
      return
    }
    if (isOpen && !isPresentedRef.current) {
      isPresentedRef.current = true
      sheet.present().catch((error: unknown) => {
        isPresentedRef.current = false
        onOpenChange(false)
        console.error("Failed to present bottom sheet", error)
      })
    } else if (!isOpen && isPresentedRef.current) {
      sheet.dismiss().catch((error: unknown) => {
        console.error("Failed to dismiss bottom sheet", error)
      })
    }
  }, [isOpen, onOpenChange])

  // Fires however the sheet closed: drag, dimmed-area tap, Android back or dismiss().
  const onDidDismiss = useCallback(() => {
    isPresentedRef.current = false
    onOpenChange(false)
  }, [onOpenChange])

  return { ref, onDidDismiss }
}
