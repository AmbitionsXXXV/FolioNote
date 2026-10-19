import { cn } from "heroui-native"
import { Image, Text, View } from "react-native"

interface BrandLockupProps {
  className?: string
  iconOnly?: boolean
  size?: number
  wordmarkClassName?: string
}

export function BrandLockup({
  className,
  iconOnly = false,
  size = 40,
  wordmarkClassName = "text-2xl text-foreground"
}: BrandLockupProps) {
  return (
    <View className={cn("flex-row items-center gap-3", className)}>
      <Image
        accessible={iconOnly}
        accessibilityIgnoresInvertColors
        accessibilityLabel={iconOnly ? "FolioNote" : undefined}
        accessibilityRole="image"
        source={require("@/assets/images/brand-mark.png")}
        style={{ height: size, width: size }}
      />
      {!iconOnly && (
        <Text
          className={wordmarkClassName}
          style={{ fontFamily: "LeckerliOne" }}
        >
          FolioNote
        </Text>
      )}
    </View>
  )
}
