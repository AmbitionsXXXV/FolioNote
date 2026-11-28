import { router } from "expo-router"

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"

/** Settings › 再看一遍引导: the onboarding as a walk-through, nothing saved. */
export default function WelcomeReplayScreen() {
  return <OnboardingFlow mode="replay" onClose={() => router.back()} />
}
