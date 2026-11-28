import { cn } from "heroui-native"
import { Text, View } from "react-native"
import Svg, { Circle } from "react-native-svg"
import { useCSSVariable } from "uniwind"

/**
 * The red check-in seal: a thick outer ring, a dashed inner ring, the glyph
 * and a small caption ("1 日目"). Sized by `size`; everything scales from it.
 */
export function PaperSeal({
  glyph,
  caption,
  size = 92,
  className
}: {
  glyph: string
  caption?: string
  size?: number
  className?: string
}) {
  const stamp = String(useCSSVariable("--color-stamp") ?? "red")
  const outer = size * 0.445
  const inner = size * 0.37
  return (
    <View
      className={cn("items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <Svg height={size} style={{ position: "absolute" }} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={outer}
          stroke={stamp}
          strokeWidth={size * 0.045}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={inner}
          stroke={stamp}
          strokeDasharray={`${size * 0.035} ${size * 0.045}`}
          strokeWidth={size * 0.014}
        />
      </Svg>
      <Text
        className="font-black text-stamp"
        style={{ fontSize: size * 0.37, lineHeight: size * 0.42 }}
      >
        {glyph}
      </Text>
      {caption ? (
        <Text
          className="font-bold text-stamp"
          style={{
            fontSize: Math.max(8, size * 0.1),
            letterSpacing: size * 0.015,
            marginTop: size * 0.02
          }}
        >
          {caption}
        </Text>
      ) : null}
    </View>
  )
}
