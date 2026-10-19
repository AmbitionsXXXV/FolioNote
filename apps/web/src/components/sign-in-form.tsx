import { Button } from "@folionote/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator
} from "@folionote/ui/field"
import { Input } from "@folionote/ui/input"
import { Spinner } from "@folionote/ui/spinner"
import {
  GoogleIcon,
  Mail01Icon,
  SecurityLockIcon,
  ViewIcon,
  ViewOffSlashIcon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useForm } from "@tanstack/react-form"
import { Link, useRouter, useSearch } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import z from "zod"

import { BrandLockup } from "@/components/brand-lockup"
import { useSocialAuth } from "@/hooks/use-social-auth"
import { authClient } from "@/lib/auth-client"
import { prettifyFormErrors } from "@/lib/form-error"

import Loader from "./loader"

/**
 * Renders the sign-in form and handles user authentication.
 *
 * Displays a loader while session state is pending, validates email and password, submits credentials,
 * navigates to the dashboard and shows a success toast on success, and shows an error toast on failure.
 *
 * @returns The React element for the sign-in form.
 */
export default function SignInForm() {
  const { t } = useTranslation()
  const router = useRouter()
  const { isPending } = authClient.useSession()
  const [showPassword, setShowPassword] = useState(false)
  const { redirect: redirectTo, error: oauthError } = useSearch({
    from: "/login"
  })
  const webUrl = import.meta.env.VITE_WEB_URL?.replace(/\/+$/, "") ?? ""

  const googleAuth = useSocialAuth({
    provider: "google",
    callbackURL: redirectTo || `${webUrl}/activity`,
    // Send OAuth failures back to this page (?error=<code>), not the API origin.
    errorCallbackURL: `${webUrl}/login`,
    errorMessageKey: "auth.signInFailed"
  })

  // Surface an OAuth failure redirected back from the auth server (e.g. Google
  // account_not_linked) as a toast instead of a bare ?error= query param.
  useEffect(() => {
    if (!oauthError) {
      return
    }
    toast.error(
      oauthError === "account_not_linked"
        ? t("auth.accountNotLinked")
        : t("auth.signInFailed")
    )
  }, [oauthError, t])

  const signInSchema = useMemo(
    () =>
      z.object({
        email: z.email(t("auth.invalidEmail")),
        password: z.string().min(8, t("auth.passwordTooShort"))
      }),
    [t]
  )

  const form = useForm({
    defaultValues: {
      email: "",
      password: ""
    },
    validators: {
      onSubmit: signInSchema
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password
        },
        {
          onSuccess: () => {
            toast.success(t("auth.signInSuccess"))
            // Use reloadDocument to trigger a full page reload
            // This ensures cookies are properly sent with the new request
            router.navigate({
              to: redirectTo || "/activity",
              reloadDocument: true
            })
          },
          onError: (error) => {
            if (import.meta.env.DEV) {
              console.warn("[SignIn] Auth error:", error.error.message)
            }
            toast.error(error.error.message || t("auth.signInFailed"))
          }
        }
      )
    },
    onSubmitInvalid: ({ formApi }) => {
      if (import.meta.env.DEV) {
        const { errors } = formApi.state
        if (errors.length > 0) {
          console.warn("[SignIn] Form validation failed:")
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

  if (isPending) {
    return <Loader />
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
          <h1 className="mb-2 text-3xl font-bold">{t("auth.welcome")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.signInSubtitle")}
          </p>
        </div>

        {/* Card Container */}
        <div className="rounded-2xl border bg-card p-8 shadow-xl dark:border-border/50 dark:bg-card/50">
          <form
            id="sign-in-form"
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

              {/* Password Field */}
              <form.Field
                name="password"
                validators={{
                  onBlur: z.string().min(1, t("auth.passwordRequired"))
                }}
              >
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor={field.name}>
                        {t("auth.password")}
                      </FieldLabel>
                      <div className="relative">
                        <HugeiconsIcon
                          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                          icon={SecurityLockIcon}
                        />
                        <Input
                          aria-invalid={isInvalid}
                          autoComplete="current-password"
                          className="pr-10 pl-10 transition-all duration-200 hover:border-primary/50"
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder={t("auth.passwordPlaceholder")}
                          type={showPassword ? "text" : "password"}
                          value={field.state.value}
                        />
                        <button
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                          type="button"
                        >
                          <HugeiconsIcon
                            className="size-4"
                            icon={showPassword ? ViewOffSlashIcon : ViewIcon}
                          />
                        </button>
                      </div>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              </form.Field>

              {/* Forgot Password Link */}
              <div className="flex items-center justify-end text-sm">
                <Link
                  className="text-primary transition-colors hover:underline"
                  to="/forgot-password"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>

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
                    {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
                  </Button>
                )}
              </form.Subscribe>

              {/* Separator */}
              <FieldSeparator className="my-2">
                <span className="px-4 text-xs tracking-wider text-muted-foreground uppercase">
                  {t("auth.orContinueWith")}
                </span>
              </FieldSeparator>

              {/* Google Sign In */}
              <Button
                className="w-full gap-2 transition-all duration-200 hover:shadow-md active:scale-95"
                disabled={googleAuth.isPending}
                onClick={() => googleAuth.mutate()}
                type="button"
                variant="outline"
              >
                {googleAuth.isPending ? (
                  <Spinner className="size-5" />
                ) : (
                  <HugeiconsIcon className="size-5" icon={GoogleIcon} />
                )}
                <span>{t("auth.continueWithGoogle")}</span>
              </Button>
            </FieldGroup>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">{t("auth.noAccount")}</span>{" "}
            <Link
              className="font-semibold text-primary hover:underline"
              search={{ redirect: redirectTo }}
              to="/register"
            >
              {t("auth.signUp")}
            </Link>
          </div>
        </div>

        {/* Trust Badge */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t("auth.secureLogin")}
        </p>
      </div>
    </div>
  )
}
