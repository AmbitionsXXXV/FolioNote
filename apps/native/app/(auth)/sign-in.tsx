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

export default function SignInScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const headerHeight = useHeaderHeight()
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 创建带有国际化错误消息的 schema
  const signInSchema = z.object({
    email: z.email(t("auth.invalidEmail")),
    password: z.string().min(1, t("auth.passwordRequired"))
  })

  const form = useForm({
    defaultValues: {
      email: "",
      password: ""
    },
    validators: {
      onSubmit: signInSchema
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)

      await authClient.signIn.email(
        {
          email: value.email.trim(),
          password: value.password
        },
        {
          onError(signInError) {
            // 使用 prettifyError 格式化日志输出
            if (__DEV__) {
              console.warn("[SignIn] Auth error:", signInError.error?.message)
            }
            setSubmitError(signInError.error?.message || t("auth.signInFailed"))
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
          console.warn("[SignIn] Form validation failed:")
          for (const error of errors) {
            if (error && typeof error === "object" && "issues" in error) {
              // 使用 prettifyError 格式化输出
              console.warn(prettifyFormErrors(error as unknown as z.ZodError))
              break
            }
          }
        }
      }
    }
  })

  const navigateToSignUp = () => {
    router.replace("/(auth)/sign-up")
  }

  return (
    <Container className="flex-1" disableContentInsetAdjustment disableTopInset>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View
          className="flex-1 px-6"
          style={{ paddingBottom: insets.bottom, paddingTop: headerHeight }}
        >
          {/* Form */}
          <View className="flex-1 pt-2">
            {/* Welcome Text */}
            <Text className="mb-2 text-xl font-semibold text-foreground">
              {t("auth.welcomeBack")}
            </Text>
            <Text className="mb-8 text-muted">{t("auth.signInSubtitle")}</Text>

            {/* Form Error Message */}
            {submitError ? (
              <View className="mb-4 rounded-xl bg-danger/10 p-4">
                <Text className="text-sm text-danger">{submitError}</Text>
              </View>
            ) : null}

            {/* Email Input */}
            <form.Field
              name="email"
              validators={{
                onBlur: z.email(t("auth.invalidEmail"))
              }}
            >
              {(field) => {
                // 提取第一个错误消息，支持 Zod v4 的 flattenError 格式
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
                onBlur: z.string().min(1, t("auth.passwordRequired"))
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
                    isInvalid={
                      field.state.meta.isTouched &&
                      field.state.meta.errors.length > 0
                    }
                  >
                    <Label>{t("auth.password")}</Label>
                    <Input
                      autoCapitalize="none"
                      autoComplete="password"
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
          </View>

          {/* Bottom Actions */}
          <View>
            {/* Sign In Button */}
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
                    t("auth.signIn")
                  )}
                </Button>
              )}
            </form.Subscribe>

            {/* Sign Up Link */}
            <View className="flex-row items-center justify-center">
              <Text className="text-muted">{t("auth.noAccount")} </Text>
              <Button onPress={navigateToSignUp} size="sm" variant="ghost">
                <Text className="text-accent">{t("auth.signUp")}</Text>
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Container>
  )
}
