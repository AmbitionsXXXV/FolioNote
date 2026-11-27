import { isLiquidGlassAvailable } from "expo-glass-effect"
import { Stack } from "expo-router"
import { useThemeColor } from "heroui-native"
import { Platform, View } from "react-native"

import { useAppTheme } from "@/contexts/app-theme-context"

import { HeaderAvatarButton } from "./header-avatar-button"

/**
 * Shared Stack configuration for tab screens
 * Provides consistent header styling with Liquid Glass support
 *
 * Usage:
 * ```tsx
 * export default function TabLayout() {
 *   return (
 *     <TabStack>
 *       <TabStack.Screen name="index" options={{ title: 'Home' }} />
 *       <TabStack.Screen name="detail" options={{ title: 'Detail' }} />
 *     </TabStack>
 *   )
 * }
 * ```
 */
export function TabStack({ children }: { children?: React.ReactNode }) {
  const { isDark } = useAppTheme()
  const backgroundColor = useThemeColor("background")
  const foregroundColor = useThemeColor("foreground")

  const renderAvatar = () => <HeaderAvatarButton />

  // iOS 26+ Liquid Glass: 系统会自动应用玻璃效果
  // 在非 Liquid Glass 环境下使用传统的模糊效果
  const isLiquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable()
  const blurEffect = isDark ? "dark" : "light"

  return (
    <View className="flex-1" style={{ backgroundColor }}>
      <Stack
        screenOptions={{
          headerTitleAlign: "center",
          // iOS 26 Liquid Glass: headerTransparent 让内容可以延伸到 header 下方
          headerTransparent: true,
          // 非 Liquid Glass 环境使用模糊效果
          headerBlurEffect: isLiquidGlass ? undefined : blurEffect,
          headerTintColor: foregroundColor,
          headerTitleStyle: {
            fontFamily: "Inter_600SemiBold"
          },
          // 禁用 header 底部的阴影/分隔线
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: Platform.select({
              ios: undefined,
              android: backgroundColor
            })
          },
          // Settings has no tab; the avatar opens it (theme lives there too).
          headerRight: renderAvatar,
          headerBackButtonDisplayMode: "generic",
          gestureEnabled: true,
          gestureDirection: "horizontal",
          fullScreenGestureEnabled: !isLiquidGlass,
          contentStyle: {
            backgroundColor
          }
        }}
      >
        {children}
      </Stack>
    </View>
  )
}

// Re-export Stack.Screen for convenience
TabStack.Screen = Stack.Screen
