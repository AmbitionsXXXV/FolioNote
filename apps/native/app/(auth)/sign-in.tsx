import { router } from "expo-router"
import type { ComponentRef } from "react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, TextInput, View } from "react-native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { z } from "zod"

import { BrandLockup } from "@/components/brand-lockup"
import { FormCard, FormRow, useShake } from "@/components/onboarding/auth-form"
import {
  GlassBackButton,
  PrimaryButton
} from "@/components/onboarding/onboarding-chrome"
import { PaperSeal } from "@/components/onboarding/paper-seal"
import { authClient } from "@/lib/auth-client"
import { haptics } from "@/lib/haptics"
import { queryClient } from "@/utils/orpc"

type FieldErrors = Partial<Record<"email" | "password", string>>

const backToStart = () =>
  router.replace({ pathname: "/(auth)/onboarding", params: { start: "1" } })

export default function SignInScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { style: shakeStyle, shake } = useShake()
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null)

  const submit = async () => {
    const found: FieldErrors = {}
    if (!z.email().safeParse(email.trim()).success) {
      found.email = t("auth.invalidEmail")
    }
    if (!password) found.password = t("auth.passwordRequired")
    setErrors(found)
    if (Object.keys(found).length > 0) {
      shake()
      return
    }

    setIsSubmitting(true)
    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password
      })
      if (result.error) {
        // Wrong credentials belong to the password row.
        setErrors({
          password: result.error.message || t("auth.signInFailed")
        })
        shake()
        setIsSubmitting(false)
        return
      }
      haptics.done()
      queryClient.refetchQueries()
      // Stack.Protected moves to Today once the session updates.
    } catch {
      setErrors({ password: t("auth.signInFailed") })
      shake()
      setIsSubmitting(false)
    }
  }

  return (
    <View className="flex-1 bg-background">
      {/* A faint 続 seal in the corner, under everything. */}
      <View
        accessibilityElementsHidden
        className="absolute"
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={{
          right: -70,
          bottom: -60,
          opacity: 0.13,
          transform: [{ rotate: "-12deg" }]
        }}
      >
        <PaperSeal glyph="続" size={300} />
      </View>

      <View className="absolute left-4 z-10" style={{ top: insets.top + 6 }}>
        <GlassBackButton
          onPress={() => (router.canGoBack() ? router.back() : backToStart())}
        />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{
          paddingTop: insets.top + 84,
          paddingBottom: insets.bottom + 24
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-2.5 px-6">
          <BrandLockup
            className="mb-3.5 gap-2.5"
            size={36}
            wordmarkClassName="text-[23px] text-foreground"
          />
          <Text
            accessibilityRole="header"
            className="text-[34px] font-bold leading-10 tracking-tight text-foreground"
          >
            {t("onboarding.flow.signIn.title")}
          </Text>
          <Text className="text-base leading-6 text-muted">
            {t("onboarding.flow.signIn.body")}
          </Text>
        </View>

        <View className="mt-8 gap-4 px-4">
          <FormCard shakeStyle={shakeStyle}>
            <FormRow
              autoComplete="email"
              error={errors.email}
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
              autoComplete="current-password"
              error={errors.password}
              inputRef={passwordRef}
              isLast
              isPassword
              label={t("auth.password")}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              placeholder={t("onboarding.flow.form.passwordPlaceholder")}
              returnKeyType="go"
              textContentType="password"
              value={password}
            />
          </FormCard>
          <PrimaryButton
            isLoading={isSubmitting}
            label={t("auth.signIn")}
            onPress={submit}
          />
          <View className="h-11 flex-row items-center justify-center">
            <Text className="text-[15px] text-muted">{t("auth.noAccount")}</Text>
            <Pressable
              accessibilityRole="link"
              className="px-1 py-3"
              onPress={backToStart}
            >
              <Text className="text-[15px] font-semibold text-accent">
                {t("onboarding.flow.signIn.fromStart")}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  )
}
