import { StorageKey } from "@folionote/constants"
import {
  CloudIcon,
  NoteEditIcon,
  RefreshIcon
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react-native"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { router } from "expo-router"
import * as SecureStore from "expo-secure-store"
import { Button, useThemeColor } from "heroui-native"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ActivityIndicator, Text, View } from "react-native"
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { BrandLockup } from "@/components/brand-lockup"
import { Container } from "@/components/container"
import { useLocalMode } from "@/contexts/local-mode-context"

export default function OnboardingScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const accentColor = useThemeColor("accent")
  const mutedColor = useThemeColor("muted")
  const { enableLocalMode } = useLocalMode()
  const [isSkipping, setIsSkipping] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)

  useEffect(() => {
    async function checkAnimationStatus() {
      try {
        const hasSeen = await SecureStore.getItemAsync(
          StorageKey.HAS_SEEN_ONBOARDING
        )
        if (!hasSeen) {
          setShouldAnimate(true)
          await SecureStore.setItemAsync(StorageKey.HAS_SEEN_ONBOARDING, "true")
        }
      } catch (error) {
        console.error("Failed to check onboarding status:", error)
      }
      setIsReady(true)
    }
    checkAnimationStatus()
  }, [])

  const handleSignIn = () => {
    router.push("/(auth)/sign-in")
  }

  const handleSignUp = () => {
    router.push("/(auth)/sign-up")
  }

  const handleSkipLogin = async () => {
    setIsSkipping(true)
    try {
      await enableLocalMode()
      // Stack.Protected will automatically navigate when isLocalMode becomes true
      // No need to manually call router.replace
    } catch {
      // Error is logged in context
      setIsSkipping(false)
    }
  }

  const getEntryAnimation = (
    delay: number,
    animation: typeof FadeInDown | typeof ZoomIn = FadeInDown
  ) => (shouldAnimate ? animation.delay(delay).springify() : undefined)

  if (!isReady) {
    return <Container className="flex-1" />
  }

  return (
    <Container className="flex-1">
      <View
        className="flex-1 justify-between"
        style={{ paddingBottom: insets.bottom }}
      >
        {/* Hero Section */}
        <View className="flex-1 items-center justify-center px-8">
          {/* Logo / Icon */}
          <Animated.View
            className="mb-8"
            entering={getEntryAnimation(100, ZoomIn)}
          >
            <BrandLockup
              size={64}
              wordmarkClassName="text-4xl text-foreground"
            />
          </Animated.View>

          {/* Tagline */}
          <Animated.View entering={getEntryAnimation(300)}>
            <Text className="mb-8 px-4 text-center text-lg text-muted">
              {t("onboarding.tagline")}
            </Text>
          </Animated.View>

          {/* Features */}
          <View className="w-full max-w-sm">
            <Animated.View entering={getEntryAnimation(400)}>
              <FeatureItem
                accentColor={accentColor}
                description={t("onboarding.feature1Desc")}
                icon={NoteEditIcon}
                title={t("onboarding.feature1")}
              />
            </Animated.View>
            <Animated.View entering={getEntryAnimation(500)}>
              <FeatureItem
                accentColor={accentColor}
                description={t("onboarding.feature2Desc")}
                icon={RefreshIcon}
                title={t("onboarding.feature2")}
              />
            </Animated.View>
            <Animated.View entering={getEntryAnimation(600)}>
              <FeatureItem
                accentColor={accentColor}
                description={t("onboarding.feature3Desc")}
                icon={CloudIcon}
                title={t("onboarding.feature3")}
              />
            </Animated.View>
          </View>
        </View>

        {/* Action Buttons */}
        <Animated.View className="px-6" entering={getEntryAnimation(700)}>
          {/* Sign Up Button (Primary) */}
          <Button
            className="mb-3 flex-row items-center justify-center bg-accent active:opacity-80"
            onPress={handleSignUp}
          >
            <Text className="text-lg font-semibold text-white">
              {t("auth.createAccount")}
            </Text>
          </Button>

          {/* Sign In Button (Secondary) */}
          <Button
            className="border-divider mb-3 flex-row items-center justify-center border bg-surface active:opacity-80"
            onPress={handleSignIn}
          >
            <Text className="text-lg font-semibold text-foreground">
              {t("auth.signIn")}
            </Text>
          </Button>

          {/* Skip Login Button (Tertiary) */}
          <Button
            className="flex-row items-center justify-center active:opacity-80"
            isDisabled={isSkipping}
            onPress={handleSkipLogin}
            variant="ghost"
          >
            {isSkipping ? (
              <ActivityIndicator color={mutedColor} size="small" />
            ) : (
              <Text className="font-medium text-accent/90">
                {t("onboarding.skipLogin")}
              </Text>
            )}
          </Button>

          {/* Local Mode Hint */}
          <Text className="mt-2 px-4 text-center text-xs text-muted">
            {t("onboarding.localModeHint")}
          </Text>
        </Animated.View>
      </View>
    </Container>
  )
}

function FeatureItem({
  icon,
  title,
  description,
  accentColor
}: {
  icon: IconSvgElement
  title: string
  description: string
  accentColor: string
}) {
  return (
    <View className="mb-4 flex-row items-start">
      <View className="mr-4 size-10 items-center justify-center rounded-full bg-accent/10">
        <HugeiconsIcon color={accentColor} icon={icon} size={20} />
      </View>
      <View className="flex-1">
        <Text className="mb-1 font-semibold text-foreground">{title}</Text>
        <Text className="text-sm text-muted">{description}</Text>
      </View>
    </View>
  )
}
