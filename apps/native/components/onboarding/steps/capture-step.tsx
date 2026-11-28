import {
  Add01Icon,
  ArrowRight01Icon,
  ArrowUp02Icon,
  InboxIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { cn, useThemeColor } from "heroui-native"
import type { ComponentRef } from "react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Keyboard, Pressable, Text, TextInput, View } from "react-native"
import { KeyboardStickyView } from "react-native-keyboard-controller"
import Animated, {
  FadeIn,
  useReducedMotion,
  withSpring,
  withTiming,
  ZoomIn
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { haptics } from "@/lib/haptics"

import {
  Glass,
  OnboardingTopBar,
  PrimaryButton,
  StepHeading
} from "../onboarding-chrome"

/** How long the card takes to fly up before it lands (the drop haptic). */
const LAND_AFTER_MS = 380
const FLY_SPRING = { damping: 13, stiffness: 150, mass: 0.9 } as const

/** The card rises from the input bar into the inbox slot, then bounces once. */
const flyIntoInbox = () => {
  "worklet"
  return {
    initialValues: {
      opacity: 0,
      transform: [{ translateY: 360 }, { scale: 0.9 }]
    },
    animations: {
      opacity: withTiming(1, { duration: 180 }),
      transform: [
        { translateY: withSpring(0, FLY_SPRING) },
        { scale: withSpring(1, FLY_SPRING) }
      ]
    }
  }
}

export function CaptureStep({
  initialNote,
  onBack,
  onSkip,
  onCaptured,
  onNext
}: {
  initialNote: string | null
  onBack: () => void
  onSkip?: () => void
  onCaptured: (note: string) => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const muted = useThemeColor("muted")
  const foreground = useThemeColor("foreground")
  const accentForeground = useThemeColor("accent-foreground")
  const [text, setText] = useState("")
  const [sent, setSent] = useState<string | null>(initialNote)
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null)

  const ideas = [
    t("onboarding.flow.capture.idea1"),
    t("onboarding.flow.capture.idea2"),
    t("onboarding.flow.capture.idea3")
  ]
  const ready = text.trim().length > 0

  const send = () => {
    const note = text.trim()
    if (!note) return
    Keyboard.dismiss()
    setSent(note)
    onCaptured(note)
    setTimeout(haptics.drop, reduceMotion ? 0 : LAND_AFTER_MS)
  }

  return (
    <View className="flex-1 bg-background">
      <OnboardingTopBar onBack={onBack} onSkip={onSkip} progress={1} />

      <View className="flex-1 px-6" style={{ paddingTop: insets.top + 72 }}>
        <StepHeading
          subtitle={t("onboarding.flow.capture.body")}
          title={t("onboarding.flow.capture.title")}
        />

        <View className="mt-7 -mx-2 gap-2.5">
          <View className="flex-row items-center gap-1.5 px-2">
            <HugeiconsIcon color={muted} icon={InboxIcon} size={15} />
            <Text className="text-[13px] font-semibold text-muted">
              {t("onboarding.flow.capture.inbox")}
            </Text>
          </View>

          {sent ? (
            <Animated.View
              className="min-h-[76px] flex-row items-center gap-3 rounded-[20px] bg-surface px-4 py-3.5"
              entering={reduceMotion ? FadeIn.duration(200) : flyIntoInbox}
              style={{
                shadowColor: "#000",
                shadowOpacity: 0.08,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 10 }
              }}
            >
              <View className="min-w-0 flex-1 gap-[3px]">
                <Text className="text-base font-medium leading-[22px] text-foreground">
                  {sent}
                </Text>
                <Text className="text-[13px] text-muted">
                  {t("onboarding.flow.capture.justNow")}
                </Text>
              </View>
              <Animated.View
                className="rounded-full bg-accent-soft px-2.5 py-1"
                entering={ZoomIn.delay(LAND_AFTER_MS).springify()}
              >
                <Text className="text-[13px] font-semibold text-accent-soft-foreground">
                  {t("onboarding.flow.capture.points")}
                </Text>
              </Animated.View>
            </Animated.View>
          ) : (
            <View className="h-[76px] items-center justify-center rounded-[20px] border-[1.5px] border-dashed border-muted/50">
              <Text className="text-sm text-muted">
                {t("onboarding.flow.capture.slot")}
              </Text>
            </View>
          )}
        </View>

        {sent ? (
          <Animated.Text
            className="mt-5 text-[15px] leading-[22px] text-muted"
            entering={FadeIn.delay(LAND_AFTER_MS + 120)}
          >
            {t("onboarding.flow.capture.after")}
          </Animated.Text>
        ) : (
          <View className="mt-6 -mx-2 gap-2">
            <Text className="px-2 text-[13px] text-muted">
              {t("onboarding.flow.capture.ideasLabel")}
            </Text>
            {ideas.map((idea) => (
              <Pressable
                accessibilityRole="button"
                className="min-h-12 justify-center rounded-[14px] bg-surface px-4 py-2.5 active:opacity-70"
                key={idea}
                onPress={() => {
                  haptics.tap()
                  setText(idea)
                  inputRef.current?.focus()
                }}
              >
                <Text className="text-[15px] leading-5 text-foreground">
                  {idea}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {sent ? (
        <View className="px-6" style={{ paddingBottom: insets.bottom + 12 }}>
          <PrimaryButton
            label={t("onboarding.flow.capture.next")}
            onPress={onNext}
            trailing={
              <HugeiconsIcon
                color={accentForeground}
                icon={ArrowRight01Icon}
                size={18}
              />
            }
          />
        </View>
      ) : (
        <KeyboardStickyView offset={{ opened: insets.bottom - 8 }}>
          <View className="px-4" style={{ paddingBottom: insets.bottom + 8 }}>
            <Glass
              style={{
                minHeight: 54,
                borderRadius: 27,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 6,
                paddingLeft: 16,
                paddingRight: 6
              }}
            >
              <HugeiconsIcon color={foreground} icon={Add01Icon} size={20} />
              <TextInput
                accessibilityLabel={t("onboarding.flow.capture.inputLabel")}
                autoFocus
                className="max-h-[120px] min-w-0 flex-1 py-2 text-base leading-[22px] text-foreground"
                multiline
                onChangeText={setText}
                onSubmitEditing={send}
                placeholder={t("onboarding.flow.capture.placeholder")}
                placeholderTextColor={muted}
                ref={inputRef}
                returnKeyType="send"
                submitBehavior="submit"
                value={text}
              />
              <Pressable
                accessibilityLabel={t("onboarding.flow.capture.send")}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready }}
                className={cn(
                  "size-[42px] items-center justify-center rounded-full",
                  ready ? "bg-accent" : "bg-transparent"
                )}
                disabled={!ready}
                onPress={send}
              >
                <HugeiconsIcon
                  color={ready ? accentForeground : muted}
                  icon={ArrowUp02Icon}
                  size={20}
                />
              </Pressable>
            </Glass>
          </View>
        </KeyboardStickyView>
      )}
    </View>
  )
}
