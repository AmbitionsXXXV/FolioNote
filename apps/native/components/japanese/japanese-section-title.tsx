import { cn } from "heroui-native"
import { Text } from "react-native"

/** Small uppercase label above a group of content, announced as a header. */
export function JapaneseSectionTitle({
  children,
  className
}: {
  children: string
  className?: string
}) {
  return (
    <Text
      accessibilityRole="header"
      className={cn(
        "text-xs font-medium uppercase tracking-wide text-muted",
        className
      )}
    >
      {children}
    </Text>
  )
}
