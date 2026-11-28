import { formatDate } from "@folionote/locales"
import type { ComponentRef } from "react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, TextInput, View } from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"
import { DEFAULT_REMINDER_TIME } from "@/lib/daily-reminder"
import { haptics } from "@/lib/haptics"
import { DEMO_WORD } from "@/lib/onboarding-draft"
import type { OnboardingOutcome, OnboardingPlan } from "@/lib/onboarding-draft"
import type { StampGlyph } from "@/lib/stamp-glyph"
import { queryClient } from "@/utils/orpc"

import { FormCard, FormRow, useShake } from "../auth-form"
import {
  GlassBackButton,
  PrimaryButton,
  StepHeading
} from "../onboarding-chrome"
import { PaperSeal } from "../paper-seal"

const PASSWORD_MIN_LENGTH = 10
const FOLD_MS = 360

type FieldErrors = Partial<Record<"name" | "email" | "password", string>>

export function SignUpStep({
  note,
  wordSaved,
  plan,
  glyph,
  onBack,
  onSignIn,
  onFinish
}: {
  note: string | null
  wordSaved: boolean
  plan: OnboardingPlan | null
  glyph: StampGlyph
  onBack: () => void
  onSignIn: () => void
  /** Persist the draft with how onboarding ended; resolves when stored. */
  onFinish: (outcome: OnboardingOutcome) => Promise<void>
}) {
  const { t, i18n } = useTranslation()
  const insets = useSafeAreaInsets()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoingLocal, setIsGoingLocal] = useState(false)
  const { style: shakeStyle, shake } = useShake()
  const fold = useSharedValue(0)
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null)
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null)

  const receiptStyle = useAnimatedStyle(() => ({
    opacity: 1 - fold.value,
    transform: [
      { perspective: 900 },
      { rotate: "-1.5deg" },
      { rotateX: `${fold.value * 80}deg` },
      { scale: 1 - 0.1 * fold.value }
    ]
  }))

  const validate = (): FieldErrors => {
    const found: FieldErrors = {}
    if (!name.trim()) found.name = t("auth.nameRequired")
    if (!z.email().safeParse(email.trim()).success)
      found.email = t("auth.invalidEmail")
    if (password.length < PASSWORD_MIN_LENGTH)
      found.password = t("auth.passwordTooShort")
    return found
  }

  const submit = async () => {
    const found = validate()
    setErrors(found)
    setSubmitError(null)
    if (Object.keys(found).length > 0) {
      shake()
      return
    }
    setIsSubmitting(true)
    try {
      await onFinish("sign-up")
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password
      })
      if (result.error) {
        setSubmitError(result.error.message || t("auth.signUpFailed"))
        shake()
        setIsSubmitting(false)
        return
      }
      haptics.done()
      fold.value = withTiming(1, { duration: FOLD_MS })
      // The session update moves the app to Today on its own.
      queryClient.refetchQueries()
    } catch {
      setSubmitError(t("auth.signUpFailed"))
      shake()
      setIsSubmitting(false)
    }
  }

  const goLocal = async () => {
    setIsGoingLocal(true)
    try {
      await onFinish("local")
    } catch {
      setIsGoingLocal(false)
    }
  }

  const planLine = (): string | null => {
    if (!plan?.useJapanese) return null
    if (!plan.remind) {
      return t("onboarding.flow.signUp.receiptPlan", {
        count: plan.dailyNewWords
      })
    }
    return t("onboarding.flow.signUp.receiptPlanRemind", {
      count: plan.dailyNewWords,
      time: DEFAULT_REMINDER_TIME
    })
  }

  const receiptLines = [
    note ? t("onboarding.flow.signUp.receiptNote") : null,
    wordSaved
      ? t("onboarding.flow.signUp.receiptWord", { word: DEMO_WORD.headword })
      : null,
    planLine()
  ].filter((line): line is string => line !== null)

  return (
    <View className="flex-1 bg-background">
      <View className="absolute left-4 z-10" style={{ top: insets.top + 6 }}>
        <GlassBackButton onPress={onBack} />
      </View>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{
          paddingTop: insets.top + 72,
          paddingBottom: insets.bottom + 24
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-6">
          <StepHeading
            subtitle={t("onboarding.flow.signUp.body")}
            title={t("onboarding.flow.signUp.title")}
          />
        </View>

        <Animated.View
          className="mx-7 mt-6 flex-row gap-3 rounded-[20px] bg-surface px-[18px] py-4"
          style={[
            {
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowRadius: 17,
              shadowOffset: { width: 0, height: 14 }
            },
            receiptStyle
          ]}
        >
          <View className="min-w-0 flex-1 gap-[7px]">
            <Text className="text-xs font-semibold tracking-wider text-muted">
              {t("onboarding.flow.signUp.receiptTitle", {
                date: formatDate(new Date(), {
                  locale: i18n.language,
                  options: { month: "long", day: "numeric" }
                })
              })}
            </Text>
            {receiptLines.length > 0 ? (
              receiptLines.map((line) => (
                <Text className="text-[15px] text-foreground" key={line}>
                  {line}
                </Text>
              ))
            ) : (
              <Text className="text-[15px] text-foreground">
                {t("onboarding.flow.signUp.receiptEmpty")}
              </Text>
            )}
          </View>
          <View
            className="self-center"
            style={{ transform: [{ rotate: "-8deg" }] }}
          >
            <PaperSeal
              caption={t("onboarding.flow.stamp.dayOne")}
              glyph={glyph}
              size={72}
            />
          </View>
        </Animated.View>

        <View className="mt-6 gap-4 px-4">
          <FormCard shakeStyle={shakeStyle}>
            <FormRow
              autoCapitalize="words"
              autoComplete="nickname"
              error={errors.name}
              label={t("onboarding.flow.form.nickname")}
              onChangeText={setName}
              onSubmitEditing={() => emailRef.current?.focus()}
              placeholder={t("onboarding.flow.form.nicknamePlaceholder")}
              returnKeyType="next"
              submitBehavior="submit"
              textContentType="nickname"
              value={name}
            />
            <FormRow
              autoComplete="email"
              error={errors.email}
              inputRef={emailRef}
              keyboardType="email-address"
              label={t("auth.email")}
              onChangeText={setEmail}
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder="name@example.com"
              returnKeyType="next"
              submitBehavior="submit"
              textContentType="emailAddress"
              value={email}
            />
            <FormRow
              autoComplete="new-password"
              error={errors.password}
              inputRef={passwordRef}
              isLast
              isPassword
              label={t("auth.password")}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              placeholder={t("onboarding.flow.form.passwordMin")}
              returnKeyType="go"
              textContentType="newPassword"
              value={password}
            />
          </FormCard>
          {submitError ? (
            <Text
              accessibilityLiveRegion="polite"
              className="-mt-2 px-4 text-[13px] text-danger"
            >
              {submitError}
            </Text>
          ) : null}
          <PrimaryButton
            isLoading={isSubmitting}
            label={t("onboarding.flow.signUp.submit")}
            onPress={submit}
          />
          <View className="items-center gap-0.5">
            <View className="h-11 flex-row items-center">
              <Text className="text-[15px] text-muted">
                {t("auth.haveAccount")}
              </Text>
              <Pressable
                accessibilityRole="link"
                className="px-1 py-3"
                onPress={onSignIn}
              >
                <Text className="text-[15px] font-semibold text-accent">
                  {t("auth.signIn")}
                </Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              className="h-11 justify-center px-3"
              disabled={isGoingLocal}
              onPress={goLocal}
            >
              <Text className="text-[15px] text-muted underline">
                {t("onboarding.flow.signUp.local")}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  )
}
