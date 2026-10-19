import { Button } from "@folionote/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@folionote/ui/field"
import { Input } from "@folionote/ui/input"
import { Spinner } from "@folionote/ui/spinner"
import {
  ArrowLeft02Icon,
  Mail01Icon,
  SentIcon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useForm } from "@tanstack/react-form"
import { Link } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import z from "zod"

import { BrandLockup } from "@/components/brand-lockup"
import { authClient } from "@/lib/auth-client"
import { prettifyFormErrors } from "@/lib/form-error"

/**
 * Renders the forgot password form and handles password reset request.
 *
 * Validates email input, submits request to auth client, and shows success message
 * with instructions to check email.
 *
 * @returns The React element for the forgot password form.
 */
export default function ForgotPasswordForm() {
  const { t } = useTranslation()
  const [emailSent, setEmailSent] = useState(false)
  const [sentEmail, setSentEmail] = useState("")

  const forgotPasswordSchema = useMemo(
    () =>
      z.object({
        email: z.email(t("auth.invalidEmail"))
      }),
    [t]
  )

  const form = useForm({
    defaultValues: {
      email: ""
    },
    validators: {
      onSubmit: forgotPasswordSchema
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: "/reset-password"
      })

      if (error) {
        if (import.meta.env.DEV) {
          console.warn("[ForgotPassword] Auth error:", error.message)
        }
        toast.error(error.message || t("auth.forgotPasswordFailed"))
        return
      }

      setSentEmail(value.email)
      setEmailSent(true)
      toast.success(t("auth.resetEmailSent"))
    },
    onSubmitInvalid: ({ formApi }) => {
      if (import.meta.env.DEV) {
        const { errors } = formApi.state
        if (errors.length > 0) {
          console.warn("[ForgotPassword] Form validation failed:")
          for (const error of errors) {
            if (error && typeof error === "object" && "issues" in error) {
              console.warn(prettifyFormErrors(error as unknown as z.ZodError))
            }
          }
        }
      }
    }
  })

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background to-muted/20 px-4 py-6 sm:px-6 sm:py-10">
        <div className="w-full max-w-md">
          {/* Success Icon */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-green-500 shadow-lg">
              <HugeiconsIcon className="size-8 text-white" icon={SentIcon} />
            </div>
            <h1 className="mb-2 text-3xl font-bold">
              {t("auth.checkYourEmail")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("auth.resetEmailSentTo", { email: sentEmail })}
            </p>
          </div>

          {/* Card Container */}
          <div className="rounded-2xl border bg-card p-8 shadow-xl dark:border-border/50 dark:bg-card/50">
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                {t("auth.checkSpamFolder")}
              </p>

              <Button
                className="w-full"
                onClick={() => {
                  setEmailSent(false)
                  form.reset()
                }}
                variant="outline"
              >
                {t("auth.tryDifferentEmail")}
              </Button>
            </div>

            {/* Back to Login Link */}
            <div className="mt-6 text-center text-sm">
              <Link
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                to="/login"
              >
                <HugeiconsIcon className="size-4" icon={ArrowLeft02Icon} />
                {t("auth.backToSignIn")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background to-muted/20 px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-md">
        {/* Branding Section */}
        <div className="mb-8 text-center">
          <BrandLockup
            className="mb-5 justify-center"
            iconClassName="size-14"
            wordmarkClassName="text-3xl"
          />
          <h1 className="mb-2 text-3xl font-bold">
            {t("auth.forgotPasswordTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.forgotPasswordSubtitle")}
          </p>
        </div>

        {/* Card Container */}
        <div className="rounded-2xl border bg-card p-8 shadow-xl dark:border-border/50 dark:bg-card/50">
          <form
            id="forgot-password-form"
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              form.handleSubmit()
            }}
          >
            <FieldGroup className="gap-5">
              {/* Email Field */}
              <form.Field
                name="email"
                validators={{
                  onBlur: z.email(t("auth.invalidEmail"))
                }}
              >
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor={field.name}>
                        {t("auth.email")}
                      </FieldLabel>
                      <div className="relative">
                        <HugeiconsIcon
                          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                          icon={Mail01Icon}
                        />
                        <Input
                          aria-invalid={isInvalid}
                          autoComplete="email"
                          className="pl-10 transition-all duration-200 hover:border-primary/50"
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder={t("auth.emailPlaceholder")}
                          type="email"
                          value={field.state.value}
                        />
                      </div>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              </form.Field>

              {/* Submit Button */}
              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    className="w-full gap-2 transition-all duration-200 hover:shadow-md active:scale-95"
                    disabled={!canSubmit || isSubmitting}
                    type="submit"
                  >
                    {isSubmitting && <Spinner className="size-4" />}
                    {isSubmitting
                      ? t("auth.sendingResetEmail")
                      : t("auth.sendResetEmail")}
                  </Button>
                )}
              </form.Subscribe>
            </FieldGroup>
          </form>

          {/* Back to Login Link */}
          <div className="mt-6 text-center text-sm">
            <Link
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              to="/login"
            >
              <HugeiconsIcon className="size-4" icon={ArrowLeft02Icon} />
              {t("auth.backToSignIn")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
