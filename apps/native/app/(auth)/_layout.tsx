import { isLiquidGlassAvailable } from "expo-glass-effect"
import { Stack } from "expo-router"
import { useThemeColor } from "heroui-native"
import { useTranslation } from "react-i18next"
import { Platform, View } from "react-native"

import { useAppTheme } from "@/contexts/app-theme-context"

export default function AuthLayout() {
  const { t } = useTranslation()
  const { isDark } = useAppTheme()
  const backgroundColor = useThemeColor("background")
  const foregroundColor = useThemeColor("foreground")

  // iOS 26+ Liquid Glass: 系统会自动应用玻璃效果
  // 在非 Liquid Glass 环境下使用传统的模糊效果
  const isLiquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable()
  const blurEffect = isDark ? "dark" : "light"

  return (
    <View className="flex-1" style={{ backgroundColor }}>
      <Stack
        screenOptions={{
          headerShown: true,
          headerBackTitle: "",
          headerBackButtonDisplayMode: "minimal",
          // iOS 26 Liquid Glass: headerTransparent 让内容可以延伸到 header 下方
          headerTransparent: true,
          // 非 Liquid Glass 环境使用模糊效果
          headerBlurEffect: isLiquidGlass ? undefined : blurEffect,
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: Platform.select({
              ios: undefined,
              android: backgroundColor
            })
          },
          headerTintColor: foregroundColor,
          headerTitleStyle: {
            fontWeight: "700",
            fontSize: 18
          },
          contentStyle: { backgroundColor },
          gestureEnabled: true,
          fullScreenGestureEnabled: true
        }}
      >
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        {/* The page draws its own glass back button; no title bar. */}
        <Stack.Screen
          name="sign-in"
          options={{ headerShown: false, title: t("auth.signIn") }}
        />
      </Stack>
    </View>
  )
}
