import "@/global.css"
import { QueryClientProvider } from "@tanstack/react-query"
import { useFonts } from "expo-font"
import { isLiquidGlassAvailable } from "expo-glass-effect"
import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { HeroUINativeProvider, useThemeColor } from "heroui-native"
import type { ComponentProps } from "react"
import { useEffect } from "react"
import { I18nextProvider, useTranslation } from "react-i18next"
import { ActivityIndicator, Platform, View } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { KeyboardProvider } from "react-native-keyboard-controller"

import { FirstLaunchHandler } from "@/components/first-launch-handler"
import { AppThemeProvider, useAppTheme } from "@/contexts/app-theme-context"
import { DataServiceProvider } from "@/contexts/data-service-context"
import { LocalModeProvider, useLocalMode } from "@/contexts/local-mode-context"
import { authClient } from "@/lib/auth-client"
import { i18n } from "@/lib/i18n"
import { queryClient } from "@/utils/orpc"

SplashScreen.preventAutoHideAsync()

export const unstable_settings = {
  initialRouteName: "(auth)"
}

/**
 * Protected Routes Navigator
 * Uses Stack.Protected for declarative route guarding (SDK 53+)
 * - Automatically handles deep link protection
 * - Navigates automatically when auth state changes
 * - Supports local mode (skip login) for offline-first usage
 */
function StackLayout() {
  const { t } = useTranslation()
  const { isDark } = useAppTheme()
  const { data: session, isPending: isAuthPending } = authClient.useSession()
  const { isLocalMode, isLoading: isLocalModeLoading } = useLocalMode()

  const backgroundColor = useThemeColor("background")
  const foregroundColor = useThemeColor("foreground")

  // iOS 26+ Liquid Glass: 系统会自动应用玻璃效果
  const isLiquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable()
  const blurEffect = isDark ? "dark" : "light"

  const isAuthenticated = !!session?.user
  // User can access protected routes if authenticated OR in local mode
  const canAccessApp = isAuthenticated || isLocalMode

  // Show loading while checking auth state or local mode state
  if (isAuthPending || isLocalModeLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    )
  }

  // Shared look for screens pushed on top of the tabs (profile, Japanese).
  const detailScreenOptions = {
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
    headerBackButtonDisplayMode: "generic",
    gestureEnabled: true,
    gestureDirection: "horizontal",
    fullScreenGestureEnabled: !isLiquidGlass,
    contentStyle: {
      backgroundColor
    }
  } satisfies ComponentProps<typeof Stack.Screen>["options"]

  return (
    <Stack screenOptions={{}}>
      {/* Protected routes for authenticated users or local mode */}
      <Stack.Protected guard={canAccessApp}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="profile"
          options={{ ...detailScreenOptions, title: t("nav.profile") }}
        />
        <Stack.Screen
          name="japanese/index"
          options={{
            ...detailScreenOptions,
            title: t("japanese.title"),
            headerLargeTitle: true,
            headerLargeTitleShadowVisible: false
          }}
        />
        <Stack.Screen
          name="japanese/word/[id]"
          options={{ ...detailScreenOptions, title: "" }}
        />
        <Stack.Screen
          name="japanese/read"
          options={{
            ...detailScreenOptions,
            title: t("japanese.reading.title")
          }}
        />
      </Stack.Protected>

      {/* Protected routes for unauthenticated users (not in local mode) */}
      <Stack.Protected guard={!canAccessApp}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  )
}

export default function Layout() {
  const [loaded, error] = useFonts({
    LeckerliOne: require("@/assets/fonts/LeckerliOne.ttf")
  })

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync()
    }
  }, [loaded, error])

  if (!(loaded || error)) {
    return null
  }

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <AppThemeProvider>
              <LocalModeProvider>
                <DataServiceProvider>
                  <HeroUINativeProvider>
                    <StackLayout />
                    <FirstLaunchHandler />
                  </HeroUINativeProvider>
                </DataServiceProvider>
              </LocalModeProvider>
            </AppThemeProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </I18nextProvider>
  )
}
