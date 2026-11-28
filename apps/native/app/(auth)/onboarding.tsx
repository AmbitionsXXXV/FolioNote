import { StorageKey } from "@folionote/constants"
import { Redirect, router, useLocalSearchParams } from "expo-router"
import * as SecureStore from "expo-secure-store"
import { useEffect, useState } from "react"
import { View } from "react-native"

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"

/**
 * Entry of the signed-out area. The first time on this iPhone it is the
 * onboarding; after that it goes straight to sign-in, unless sign-in sent
 * the reader back here on purpose (`?start=1`, "从第一页开始").
 */
export default function OnboardingScreen() {
  const { start } = useLocalSearchParams<{ start?: string }>()
  const [hasSeen, setHasSeen] = useState<boolean | null>(
    start === "1" ? false : null
  )

  useEffect(() => {
    if (hasSeen !== null) return
    SecureStore.getItemAsync(StorageKey.HAS_SEEN_ONBOARDING)
      .then((value) => setHasSeen(value === "true"))
      .catch(() => setHasSeen(false))
  }, [hasSeen])

  if (hasSeen === null) {
    return <View className="flex-1 bg-background" />
  }
  if (hasSeen) {
    return <Redirect href="/(auth)/sign-in" />
  }
  return (
    <OnboardingFlow
      mode="first-run"
      onSignIn={() => router.push("/(auth)/sign-in")}
    />
  )
}
