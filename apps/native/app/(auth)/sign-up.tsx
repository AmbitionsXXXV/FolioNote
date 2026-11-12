import { useForm } from "@tanstack/react-form"
import { router } from "expo-router"
import { useHeaderHeight } from "expo-router/react-navigation"
import { Button, FieldError, Input, Label, TextField } from "heroui-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { z } from "zod"

import { Container } from "@/components/container"
import { authClient } from "@/lib/auth-client"
import { prettifyFormErrors } from "@/utils/form-error"
import { queryClient } from "@/utils/orpc"

// 声明 Expo/React Native 的全局 __DEV__ 变量
declare const __DEV__: boolean

const PASSWORD_MIN_LENGTH = 10

export default function SignUpScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const headerHeight = useHeaderHeight()
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 创建带有国际化错误消息的 schema
  const signUpSchema = z.object({
    name: z.string().min(1, t("auth.nameRequired")),
    email: z.email(t("auth.invalidEmail")),
    password: z
      .string()
      .min(1, t("auth.passwordRequired"))
      .min(PASSWORD_MIN_LENGTH, t("auth.passwordTooShort"))
  })

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: ""
    },
    validators: {
      onSubmit: signUpSchema
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)

      await authClient.signUp.email(
        {
          name: value.name.trim(),
          email: value.email.trim(),
          password: value.password
        },
        {
          onError(signUpError) {
            if (__DEV__) {
              console.warn("[SignUp] Auth error:", signUpError.error?.message)
            }
            setSubmitError(signUpError.error?.message || t("auth.signUpFailed"))
          },
          onSuccess() {
            form.reset()
            queryClient.refetchQueries()
            // Stack.Protected will automatically navigate when session state updates
          }
        }
      )
    },
    onSubmitInvalid: ({ formApi }) => {
      // 表单验证失败时，记录格式化的错误日志
      if (__DEV__) {
        const { errors } = formApi.state
        if (errors.length > 0) {
          console.warn("[SignUp] Form validation failed:")
          for (const error of errors) {
            if (error && typeof error === "object" && "issues" in error) {
              console.warn(prettifyFormErrors(error as unknown as z.ZodError))
              break
            }
          }
        }
      }
    }
  })

  const navigateToSignIn = () => {
    router.replace("/(auth)/sign-in")
  }

  return (
    <Container
      className="flex-1"
      disableBottomInset
      disableContentInsetAdjustment
      disableTopInset
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View
          className="flex-1 px-6"
          style={{ paddingTop: headerHeight, paddingBottom: insets.bottom }}
        >
          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
            {/* Form */}
            <View>
              {/* Welcome Text */}
              <Text className="mb-2 text-xl font-semibold text-foreground">
                {t("auth.getStarted")}
              </Text>
              <Text className="mb-8 text-muted">
                {t("auth.signUpSubtitle")}
              </Text>

              {/* Form Error Message */}
              {submitError ? (
                <View className="mb-4 rounded-xl bg-danger/10 p-4">
                  <Text className="text-sm text-danger">{submitError}</Text>
                </View>
              ) : null}

              {/* Name Input */}
              <form.Field
                name="name"
                validators={{
                  onBlur: z.string().min(1, t("auth.nameRequired"))
                }}
              >
                {(field) => {
                  const errorMessage = field.state.meta.errors[0]
                  const displayError =
                    typeof errorMessage === "string"
                      ? errorMessage
                      : errorMessage?.message

                  return (
                    <TextField
                      className="mb-4"
                      isInvalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    >
                      <Label>{t("auth.name")}</Label>
                      <Input
                        autoCapitalize="words"
                        autoComplete="name"
                        onBlur={field.handleBlur}
                        onChangeText={field.handleChange}
                        placeholder={t("auth.namePlaceholder")}
                        value={field.state.value}
                      />
                      <FieldError>{displayError}</FieldError>
                    </TextField>
                  )
                }}
              </form.Field>

              {/* Email Input */}
              <form.Field
                name="email"
                validators={{
                  onBlur: z.email(t("auth.invalidEmail"))
                }}
              >
                {(field) => {
                  const errorMessage = field.state.meta.errors[0]
                  const displayError =
                    typeof errorMessage === "string"
                      ? errorMessage
                      : errorMessage?.message

                  return (
                    <TextField
                      className="mb-4"
                      isInvalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    >
                      <Label>{t("auth.email")}</Label>
                      <Input
                        autoCapitalize="none"
                        autoComplete="email"
                        keyboardType="email-address"
                        onBlur={field.handleBlur}
                        onChangeText={field.handleChange}
                        placeholder={t("auth.emailPlaceholder")}
                        value={field.state.value}
                      />
                      <FieldError>{displayError}</FieldError>
                    </TextField>
                  )
                }}
              </form.Field>

              {/* Password Input */}
              <form.Field
                name="password"
                validators={{
                  onBlur: z
                    .string()
                    .min(1, t("auth.passwordRequired"))
                    .min(PASSWORD_MIN_LENGTH, t("auth.passwordTooShort"))
                }}
              >
                {(field) => {
                  const errorMessage = field.state.meta.errors[0]
                  const displayError =
                    typeof errorMessage === "string"
                      ? errorMessage
                      : errorMessage?.message

                  return (
                    <TextField
                      className="mb-2"
                      isInvalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    >
                      <Label>{t("auth.password")}</Label>
                      <Input
                        autoCapitalize="none"
                        autoComplete="password-new"
                        onBlur={field.handleBlur}
                        onChangeText={field.handleChange}
                        onSubmitEditing={() => form.handleSubmit()}
                        placeholder={t("auth.passwordPlaceholder")}
                        returnKeyType="done"
                        secureTextEntry
                        value={field.state.value}
                      />
                      <FieldError>{displayError}</FieldError>
                    </TextField>
                  )
                }}
              </form.Field>

              {/* Password Hint */}
              <Text className="text-xs text-muted">
                {t("auth.passwordHint")}
              </Text>
            </View>
          </ScrollView>

          {/* Bottom Actions */}
          <View>
            {/* Sign Up Button */}
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  className="mb-4 w-full"
                  isDisabled={!canSubmit || isSubmitting}
                  onPress={() => form.handleSubmit()}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    t("auth.signUp")
                  )}
                </Button>
              )}
            </form.Subscribe>

            {/* Sign In Link */}
            <View className="flex-row items-center justify-center">
              <Text className="text-muted">{t("auth.haveAccount")} </Text>
              <Button onPress={navigateToSignIn} size="sm" variant="ghost">
                <Text className="text-accent">{t("auth.signIn")}</Text>
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Container>
  )
}
