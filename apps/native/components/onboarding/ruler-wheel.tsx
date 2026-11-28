import { cn } from "heroui-native"
import type { ComponentRef } from "react"
import { useEffect, useRef, useState } from "react"
import { ScrollView, Text, View } from "react-native"
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent
} from "react-native"

import { haptics } from "@/lib/haptics"

/** Distance between two ticks; one tick is one word. */
const TICK_SPACING = 12
const MAJOR_EVERY = 5

/**
 * A horizontal ruler you drag like a dial: the value under the centre line
 * is selected, each tick passed gives a 轻点. Snaps to whole values.
 */
export function RulerWheel({
  min,
  max,
  value,
  onChange,
  accessibilityLabel
}: {
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  accessibilityLabel: string
}) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const [width, setWidth] = useState(0)
  const dragging = useRef(false)
  const lastValue = useRef(value)
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i)

  const offsetOf = (target: number) => (target - min) * TICK_SPACING

  // Follow outside changes (typed number) without echoing them back.
  useEffect(() => {
    if (dragging.current || width === 0) return
    lastValue.current = value
    scrollRef.current?.scrollTo({ x: (value - min) * TICK_SPACING, animated: true })
  }, [min, value, width])

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!dragging.current) return
    const raw = Math.round(event.nativeEvent.contentOffset.x / TICK_SPACING) + min
    const next = Math.max(min, Math.min(max, raw))
    if (next === lastValue.current) return
    lastValue.current = next
    haptics.tap()
    onChange(next)
  }

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width)
  }

  const step = (delta: number) => {
    const next = Math.max(min, Math.min(max, value + delta))
    if (next === value) return
    haptics.tap()
    onChange(next)
  }

  const sidePadding = Math.max(0, width / 2)

  return (
    <View
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
      accessible
      className="h-14 justify-center"
      onAccessibilityAction={(event) => {
        step(event.nativeEvent.actionName === "increment" ? 1 : -1)
      }}
      onLayout={handleLayout}
    >
      {width > 0 ? (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: sidePadding }}
          contentOffset={{ x: offsetOf(value), y: 0 }}
          decelerationRate="fast"
          horizontal
          onMomentumScrollEnd={() => {
            dragging.current = false
          }}
          onScroll={handleScroll}
          onScrollBeginDrag={() => {
            dragging.current = true
          }}
          onScrollEndDrag={(event) => {
            // No momentum: the drag itself ends the gesture.
            if (event.nativeEvent.velocity?.x === 0) dragging.current = false
          }}
          ref={scrollRef}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          snapToInterval={TICK_SPACING}
        >
          {ticks.map((tick) => {
            const major = tick % MAJOR_EVERY === 0
            return (
              <View
                className="items-center"
                key={tick}
                style={{ width: TICK_SPACING, marginLeft: tick === min ? -TICK_SPACING / 2 : 0 }}
              >
                <View
                  className={cn(
                    "w-[1.5px] rounded-full",
                    major ? "h-5 bg-muted/60" : "h-2.5 bg-divider"
                  )}
                />
                {major ? (
                  <Text
                    className={cn(
                      "absolute top-6 w-8 text-center text-[11px]",
                      tick === value ? "font-semibold text-foreground" : "text-muted"
                    )}
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {tick}
                  </Text>
                ) : null}
              </View>
            )
          })}
        </ScrollView>
      ) : null}
      <View
        className="absolute top-0 h-7 w-[3px] rounded-full bg-accent"
        pointerEvents="none"
        style={{ left: sidePadding - 1.5 }}
      />
    </View>
  )
}
