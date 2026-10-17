import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { openBrowserAsync } from "expo-web-browser"
import { cn, useThemeColor } from "heroui-native"
import { Pressable, Text } from "react-native"

interface JapaneseExternalLinkProps {
  label: string
  url: string
  className?: string
  textClassName?: string
}

/** In-app browser link with a 44pt tall touch target. */
export function JapaneseExternalLink({
  label,
  url,
  className,
  textClassName
}: JapaneseExternalLinkProps) {
  const linkColor = useThemeColor("link")

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="link"
      className={cn(
        "min-h-11 flex-row items-center gap-1 active:opacity-60",
        className
      )}
      onPress={() => {
        openBrowserAsync(url)
      }}
    >
      <Text className={cn("text-xs font-medium text-link", textClassName)}>
        {label}
      </Text>
      <HugeiconsIcon color={linkColor} icon={ArrowUpRight01Icon} size={12} />
    </Pressable>
  )
}
