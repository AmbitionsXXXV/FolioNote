import { cn } from "heroui-native"
import type { PropsWithChildren } from "react"
import { Platform, ScrollView, View } from "react-native"
import type { ViewProps } from "react-native"
import Animated, { FadeIn } from "react-native-reanimated"
import type { AnimatedProps } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const AnimatedView = Animated.createAnimatedComponent(View)

type Props = AnimatedProps<ViewProps> & {
  className?: string
  disableScroll?: boolean
  disableTopInset?: boolean
  /**
   * When true, disables automatic content inset adjustment for transparent headers.
   * Use this for pages that don't need extra space for transparent navigation bars.
   */
  disableContentInsetAdjustment?: boolean
}

function getContentInsetAdjustmentBehavior(
  disableContentInsetAdjustment: boolean
): "never" | "automatic" | undefined {
  if (Platform.OS !== "ios") {
    return undefined
  }
  return disableContentInsetAdjustment ? "never" : "automatic"
}

export function Container({
  children,
  className,
  disableScroll = false,
  disableTopInset = false,
  disableContentInsetAdjustment = false,
  entering,
  ...props
}: PropsWithChildren<Props>) {
  const insets = useSafeAreaInsets()

  return (
    <AnimatedView
      className={cn("flex-1 bg-background", className)}
      // Gentle, app-wide screen entrance (mirrors the web shell fade-in);
      // callers can override by passing their own `entering`.
      entering={entering ?? FadeIn.duration(350)}
      // No bottom inset: on iOS 26+ content scrolls under the Liquid Glass
      // tab bar and home indicator. Scroll views get their bottom inset from
      // contentInsetAdjustmentBehavior="automatic"; padding here left an
      // opaque strip of background below the tab bar.
      style={{ paddingTop: disableTopInset ? 0 : insets.top }}
      {...props}
    >
      {disableScroll ? (
        children
      ) : (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          contentInsetAdjustmentBehavior={getContentInsetAdjustmentBehavior(
            disableContentInsetAdjustment
          )}
        >
          {children}
        </ScrollView>
      )}
    </AnimatedView>
  )
}
