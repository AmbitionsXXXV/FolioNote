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
  UserIcon,
  ViewIcon,
  ViewOffSlashIcon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useForm } from "@tanstack/react-form"
import type { AnyFieldApi } from "@tanstack/react-form"
import { Link, useRouter, useSearch } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import z from "zod"

import { BrandLockup } from "@/components/brand-lockup"
import { useSocialAuth } from "@/hooks/use-social-auth"
import { authClient } from "@/lib/auth-client"
import { prettifyFormErrors } from "@/lib/form-error"

import Loader from "./loader"

const PASSWORD_MIN_LENGTH = 8

/**
 * Render a sign-up form UI and handle user registration flow.
 *
 * Renders a name, email, and password form with validation; while the authentication
 * session is pending, renders a Loader instead. Submitting the form attempts to
 * create an account via the auth client — on success navigates to `/dashboard` and
 * shows a success toast; on error shows an error toast with the server message.
 *
 * @returns A React element containing the sign-up form or a Loader when the session is pending.
 */
export default function SignUpForm() {
  const { t } = useTranslation()
  const router = useRouter()
  const { isPending } = authClient.useSession()
  const [showPassword, setShowPassword] = useState(false)
  const { redirect: redirectTo } = useSearch({ from: "/register" })
  const webUrl = import.meta.env.VITE_WEB_URL?.replace(/\/+$/, "") ?? ""

  const googleAuth = useSocialAuth({
    provider: "google",
    callbackURL: redirectTo || `${webUrl}/activity`,
    // Send OAuth failures back to the web login page, not the auth/API origin.
    errorCallbackURL: `${webUrl}/login`,
    errorMessageKey: "auth.signUpFailed"
  })

  const signUpSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t("auth.nameRequired")),
        email: z.email(t("auth.invalidEmail")),
        password: z
          .string()
          .min(1, t("auth.passwordRequired"))
          .min(PASSWORD_MIN_LENGTH, t("auth.passwordTooShort"))
      }),
    [t]
  )

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: ""
    },
    validators: {
      onSubmit: signUpSchema
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name
        },
        {
          onSuccess: () => {
            toast.success(t("auth.signUpSuccess"))
            // Use reloadDocument to trigger a full page reload
            // This ensures cookies are properly sent with the new request
            router.navigate({
              to: redirectTo || "/activity",
              reloadDocument: true
            })
          },
          onError: (error) => {
            if (import.meta.env.DEV) {
              console.warn("[SignUp] Auth error:", error.error.message)
            }
            toast.error(error.error.message || t("auth.signUpFailed"))
          }
        }
      )
    },
    onSubmitInvalid: ({ formApi }) => {
      if (import.meta.env.DEV) {
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

  if (isPending) {
    return <Loader />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background to-muted/20 px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-md">
        <SignUpHeader />

        {/* Card Container */}
        <div className="rounded-2xl border bg-card p-8 shadow-xl dark:border-border/50 dark:bg-card/50">
          <form
            id="sign-up-form"
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              form.handleSubmit()
            }}
          >
            <FieldGroup className="gap-5">
              <form.Field
                name="name"
                validators={{
                  onBlur: z.string().min(1, t("auth.nameRequired"))
                }}
              >
                {(field) => <NameField field={field} />}
              </form.Field>

              <form.Field
                name="email"
                validators={{
                  onBlur: z.email(t("auth.invalidEmail"))
                }}
              >
                {(field) => <EmailField field={field} />}
              </form.Field>

              <form.Field
                name="password"
                validators={{
                  onBlur: z
                    .string()
                    .min(1, t("auth.passwordRequired"))
                    .min(PASSWORD_MIN_LENGTH, t("auth.passwordTooShort"))
                }}
              >
                {(field) => (
                  <PasswordField
                    field={field}
                    onToggleShowPassword={() => setShowPassword(!showPassword)}
                    showPassword={showPassword}
                  />
                )}
              </form.Field>

              {/* Password Requirements Hint */}
              <p className="-mt-3 text-xs text-muted-foreground">
                {t("auth.passwordRequirements")}
              </p>

              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <SubmitButton
                    canSubmit={canSubmit}
                    isSubmitting={isSubmitting}
                  />
                )}
              </form.Subscribe>

              {/* Separator */}
              <FieldSeparator className="my-2">
                <span className="px-4 text-xs tracking-wider text-muted-foreground uppercase">
                  {t("auth.orContinueWith")}
                </span>
              </FieldSeparator>

              <GoogleSignUpButton
                isPending={googleAuth.isPending}
                onClick={() => googleAuth.mutate()}
              />
            </FieldGroup>
          </form>

          <SignInLink redirectTo={redirectTo} />
        </div>

        {/* Terms & Privacy */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t("auth.termsAgreement")}
        </p>
      </div>
    </div>
  )
}

/** Branding header with logo, title, and subtitle. */
function SignUpHeader() {
  const { t } = useTranslation()
  return (
    <div className="mb-8 text-center">
      <BrandLockup
        className="mb-5 justify-center"
        iconClassName="size-14"
        wordmarkClassName="text-3xl"
      />
      <h1 className="mb-2 text-3xl font-bold">{t("auth.createAccount")}</h1>
      <p className="text-sm text-muted-foreground">
        {t("auth.signUpSubtitle")}
      </p>
    </div>
  )
}

interface NameFieldProps {
  field: AnyFieldApi
}

/** Name input row with leading icon and validation error. */
function NameField({ field }: NameFieldProps) {
  const { t } = useTranslation()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={field.name}>{t("auth.name")}</FieldLabel>
      <div className="relative">
        <HugeiconsIcon
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          icon={UserIcon}
        />
        <Input
          aria-invalid={isInvalid}
          autoComplete="name"
          className="pl-10 transition-all duration-200 hover:border-primary/50"
          id={field.name}
          name={field.name}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder={t("auth.namePlaceholder")}
          value={field.state.value}
        />
      </div>
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}

interface EmailFieldProps {
  field: AnyFieldApi
}

/** Email input row with leading icon and validation error. */
function EmailField({ field }: EmailFieldProps) {
  const { t } = useTranslation()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={field.name}>{t("auth.email")}</FieldLabel>
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
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}

interface PasswordFieldProps {
  field: AnyFieldApi
  showPassword: boolean
  onToggleShowPassword: () => void
}

/** Password input row with leading icon and show/hide toggle. */
function PasswordField({
  field,
  showPassword,
  onToggleShowPassword
}: PasswordFieldProps) {
  const { t } = useTranslation()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={field.name}>{t("auth.password")}</FieldLabel>
      <div className="relative">
        <HugeiconsIcon
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          icon={SecurityLockIcon}
        />
        <Input
          aria-invalid={isInvalid}
          autoComplete="new-password"
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
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          onClick={onToggleShowPassword}
          type="button"
        >
          <HugeiconsIcon
            className="size-4"
            icon={showPassword ? ViewOffSlashIcon : ViewIcon}
          />
        </button>
      </div>
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}

interface SubmitButtonProps {
  canSubmit: boolean | undefined
  isSubmitting: boolean | undefined
}

/** Primary submit button reflecting the form's submit state. */
function SubmitButton({ canSubmit, isSubmitting }: SubmitButtonProps) {
  const { t } = useTranslation()
  return (
    <Button
      className="w-full gap-2 transition-all duration-200 hover:shadow-md active:scale-95"
      disabled={!canSubmit || isSubmitting}
      type="submit"
    >
      {isSubmitting && <Spinner className="size-4" />}
      {isSubmitting ? t("auth.creatingAccount") : t("auth.signUp")}
    </Button>
  )
}

interface GoogleSignUpButtonProps {
  isPending: boolean
  onClick: () => void
}

/** Google OAuth sign-up button. */
function GoogleSignUpButton({ isPending, onClick }: GoogleSignUpButtonProps) {
  const { t } = useTranslation()
  return (
    <Button
      className="w-full gap-2 transition-all duration-200 hover:shadow-md active:scale-95"
      disabled={isPending}
      onClick={onClick}
      type="button"
      variant="outline"
    >
      {isPending ? (
        <Spinner className="size-5" />
      ) : (
        <HugeiconsIcon className="size-5" icon={GoogleIcon} />
      )}
      <span>{t("auth.continueWithGoogle")}</span>
    </Button>
  )
}

interface SignInLinkProps {
  redirectTo: string | undefined
}

/** Footer link to the sign-in page, preserving the redirect target. */
function SignInLink({ redirectTo }: SignInLinkProps) {
  const { t } = useTranslation()
  return (
    <div className="mt-6 text-center text-sm">
      <span className="text-muted-foreground">{t("auth.hasAccount")}</span>{" "}
      <Link
        className="font-semibold text-primary hover:underline"
        search={{ redirect: redirectTo }}
        to="/login"
      >
        {t("auth.signIn")}
      </Link>
    </div>
  )
}
