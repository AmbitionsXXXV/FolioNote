import { Button } from "@folionote/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@folionote/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@folionote/ui/field"
import { Input } from "@folionote/ui/input"
import { Spinner } from "@folionote/ui/spinner"
import { getPasswordStrength } from "@folionote/utils"
import {
  CheckmarkCircle02Icon,
  LockPasswordIcon,
  SquareUnlock01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useForm } from "@tanstack/react-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import z from "zod"

import { cn } from "@/lib/utils"
import { orpc } from "@/utils/orpc"

import { ConfirmDeleteDialog } from "./confirm-delete-dialog"

// 密码强度指示器的稳定 ID
const STRENGTH_BAR_IDS = ["bar-1", "bar-2", "bar-3", "bar-4"] as const

// 密码强度对应的颜色（静态样式类）
const strengthColors = [
  "bg-destructive",
  "bg-orange-500",
  "bg-amber-500",
  "bg-green-500",
  "bg-green-600"
]

interface PasswordStrengthIndicatorProps {
  password: string
}

/**
 * 密码强度指示器
 */
function PasswordStrengthIndicator({
  password
}: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation()
  const strength = useMemo(() => getPasswordStrength(password), [password])

  if (!password) {
    return null
  }

  const strengthLabels = [
    t("privacy.strengthWeak"),
    t("privacy.strengthFair"),
    t("privacy.strengthGood"),
    t("privacy.strengthStrong"),
    t("privacy.strengthVeryStrong")
  ]

  return (
    <div aria-live="polite" className="space-y-1.5" role="status">
      <div className="flex gap-1">
        {STRENGTH_BAR_IDS.map((id, index) => (
          <div
            className={cn(
              "h-1 flex-1 rounded-full",
              index < strength
                ? strengthColors[strength]
                : "bg-surface-secondary"
            )}
            key={id}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {strengthLabels[strength]}
      </p>
    </div>
  )
}

/**
 * 创建/校验密码的 TanStack Form 实例
 */
function useEntryPasswordForm(onSetPassword: (password: string) => void) {
  const { t } = useTranslation()

  // 构建密码验证 schema
  const passwordSchema = useMemo(
    () =>
      z
        .object({
          password: z.string().min(4, t("privacy.minLength")),
          confirmPassword: z.string()
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t("privacy.passwordMismatch"),
          path: ["confirmPassword"]
        }),
    [t]
  )

  return useForm({
    defaultValues: {
      password: "",
      confirmPassword: ""
    },
    validators: {
      onSubmit: passwordSchema
    },
    onSubmit: ({ value }) => {
      onSetPassword(value.password)
    }
  })
}

type EntryPasswordForm = ReturnType<typeof useEntryPasswordForm>

interface NewPasswordFieldProps {
  form: EntryPasswordForm
  label: string
}

/**
 * 新密码字段（含强度指示器）
 */
function NewPasswordField({ form, label }: NewPasswordFieldProps) {
  const { t } = useTranslation()
  return (
    <form.Field
      name="password"
      validators={{
        onBlur: z.string().min(4, t("privacy.minLength"))
      }}
    >
      {(field) => {
        const isInvalid =
          field.state.meta.isTouched && !field.state.meta.isValid
        return (
          <Field data-invalid={isInvalid || undefined}>
            <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
            <Input
              autoComplete="new-password"
              id={field.name}
              minLength={4}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder={t("privacy.passwordPlaceholder")}
              type="password"
              value={field.state.value}
            />
            <PasswordStrengthIndicator password={field.state.value} />
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
          </Field>
        )
      }}
    </form.Field>
  )
}

interface ConfirmPasswordFieldProps {
  form: EntryPasswordForm
  minLengthToShow: number
}

/**
 * 确认密码字段（仅在主密码达到长度阈值后显示）
 */
function ConfirmPasswordField({
  form,
  minLengthToShow
}: ConfirmPasswordFieldProps) {
  const { t } = useTranslation()
  return (
    <form.Subscribe selector={(state) => state.values.password}>
      {(password) =>
        password.length >= minLengthToShow && (
          <form.Field
            name="confirmPassword"
            validators={{
              onChangeListenTo: ["password"],
              onChange: ({ value, fieldApi }) => {
                if (
                  value &&
                  fieldApi.form.getFieldValue("password") !== value
                ) {
                  return t("privacy.passwordMismatch")
                }
                return
              }
            }}
          >
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              const passwordsMatch =
                field.state.value === form.getFieldValue("password") &&
                field.state.value.length > 0
              return (
                <Field data-invalid={isInvalid || undefined}>
                  <FieldLabel htmlFor={field.name}>
                    {t("privacy.confirmPassword")}
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      autoComplete="new-password"
                      className={cn(
                        "pr-10",
                        passwordsMatch &&
                          "border-green-500 focus-visible:border-green-500 focus-visible:ring-green-500/30"
                      )}
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t("privacy.confirmPlaceholder")}
                      type="password"
                      value={field.state.value}
                    />
                    {passwordsMatch && (
                      <HugeiconsIcon
                        className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-green-500"
                        icon={CheckmarkCircle02Icon}
                      />
                    )}
                  </div>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          </form.Field>
        )
      }
    </form.Subscribe>
  )
}

interface SubmitPasswordButtonProps {
  form: EntryPasswordForm
  className: string
  label: string
  setPasswordPending: boolean
}

/**
 * 提交按钮（根据表单状态与提交中状态禁用）
 */
function SubmitPasswordButton({
  form,
  className,
  label,
  setPasswordPending
}: SubmitPasswordButtonProps) {
  return (
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
      {([canSubmit, isSubmitting]) => (
        <Button
          className={className}
          disabled={!canSubmit || isSubmitting || setPasswordPending}
          type="submit"
        >
          {(isSubmitting || setPasswordPending) && (
            <Spinner className="size-4" />
          )}
          <HugeiconsIcon className="size-4" icon={LockPasswordIcon} />
          {label}
        </Button>
      )}
    </form.Subscribe>
  )
}

/**
 * 加载状态
 */
function LoadingState() {
  const { t } = useTranslation()
  return (
    <div
      aria-busy="true"
      aria-label={t("common.loading")}
      className="flex items-center justify-center py-8"
      role="status"
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-6" />
        <span className="text-sm text-muted-foreground">
          {t("common.loading")}
        </span>
      </div>
    </div>
  )
}

interface HasPasswordFormProps {
  form: EntryPasswordForm
  onRemovePassword: () => void
  removePending: boolean
  setPasswordPending: boolean
}

/**
 * 已设置密码的条目：修改或移除密码
 */
function HasPasswordForm({
  form,
  onRemovePassword,
  removePending,
  setPasswordPending
}: HasPasswordFormProps) {
  const { t } = useTranslation()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <FieldGroup className="gap-4">
        <div
          className="flex items-center gap-3 rounded-lg border border-amber-200/50 bg-amber-50/50 p-4 dark:border-amber-800/50 dark:bg-amber-950/30"
          role="status"
        >
          <HugeiconsIcon
            className="size-5 shrink-0 text-amber-600 dark:text-amber-400"
            icon={LockPasswordIcon}
          />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {t("privacy.currentlyProtected")}
          </p>
        </div>

        <NewPasswordField form={form} label={t("privacy.newPassword")} />

        <ConfirmPasswordField form={form} minLengthToShow={1} />

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            className="w-full sm:w-auto"
            disabled={removePending}
            onClick={onRemovePassword}
            type="button"
            variant="outline"
          >
            <HugeiconsIcon className="mr-2 size-4" icon={SquareUnlock01Icon} />
            {t("privacy.removePassword")}
          </Button>
          <SubmitPasswordButton
            className="w-full gap-2 sm:w-auto"
            form={form}
            label={t("privacy.changePassword")}
            setPasswordPending={setPasswordPending}
          />
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

interface NoPasswordFormProps {
  form: EntryPasswordForm
  onCancel: () => void
  setPasswordPending: boolean
}

/**
 * 未设置密码的条目：设置密码
 */
function NoPasswordForm({
  form,
  onCancel,
  setPasswordPending
}: NoPasswordFormProps) {
  const { t } = useTranslation()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <FieldGroup className="gap-4">
        <NewPasswordField form={form} label={t("privacy.password")} />

        <ConfirmPasswordField form={form} minLengthToShow={4} />

        <DialogFooter>
          <Button onClick={onCancel} type="button" variant="outline">
            {t("common.cancel")}
          </Button>
          <SubmitPasswordButton
            className="gap-2"
            form={form}
            label={t("privacy.setPassword")}
            setPasswordPending={setPasswordPending}
          />
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

interface EntryPasswordDialogProps {
  entryId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Dialog for setting or removing password protection on an entry
 */
export function EntryPasswordDialog({
  entryId,
  open,
  onOpenChange
}: EntryPasswordDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  // Check if entry has password
  const { data: passwordStatus, isLoading } = useQuery({
    queryKey: ["entry-password", entryId],
    queryFn: () => orpc.entries.checkPassword.call({ id: entryId }),
    enabled: open
  })

  // Set password mutation
  const setPasswordMutation = useMutation({
    mutationFn: (newPassword: string) =>
      orpc.entries.setPassword.call({ id: entryId, password: newPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry-password", entryId] })
      queryClient.invalidateQueries({ queryKey: ["entries", entryId] })
      toast.success(t("privacy.passwordSet"))
      onOpenChange(false)
    },
    onError: () => {
      toast.error(t("privacy.setPasswordError"))
    }
  })

  // Remove password mutation
  const removePasswordMutation = useMutation({
    mutationFn: () => orpc.entries.removePassword.call({ id: entryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry-password", entryId] })
      queryClient.invalidateQueries({ queryKey: ["entries", entryId] })
      toast.success(t("privacy.passwordRemoved"))
      onOpenChange(false)
    },
    onError: () => {
      toast.error(t("privacy.removePasswordError"))
    }
  })

  // TanStack Form 实例
  const form = useEntryPasswordForm((password) => {
    setPasswordMutation.mutate(password)
  })

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      form.reset()
    }
  }, [open, form])

  const handleRemovePassword = useCallback(() => {
    setShowRemoveConfirm(true)
  }, [])

  const handleConfirmRemovePassword = useCallback(() => {
    removePasswordMutation.mutate()
    setShowRemoveConfirm(false)
  }, [removePasswordMutation])

  const hasPassword = passwordStatus?.hasPassword ?? false

  // Determine which content to render
  const renderContent = () => {
    if (isLoading) {
      return <LoadingState />
    }
    if (hasPassword) {
      return (
        <HasPasswordForm
          form={form}
          onRemovePassword={handleRemovePassword}
          removePending={removePasswordMutation.isPending}
          setPasswordPending={setPasswordMutation.isPending}
        />
      )
    }
    return (
      <NoPasswordForm
        form={form}
        onCancel={() => onOpenChange(false)}
        setPasswordPending={setPasswordMutation.isPending}
      />
    )
  }

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HugeiconsIcon className="size-5" icon={LockPasswordIcon} />
              {t("privacy.title")}
            </DialogTitle>
            <DialogDescription>
              {hasPassword
                ? t("privacy.changeOrRemove")
                : t("privacy.setDescription")}
            </DialogDescription>
          </DialogHeader>

          {renderContent()}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        cancelText={t("common.cancel")}
        confirmText={t("privacy.removePassword")}
        description={t("privacy.removeConfirm")}
        isLoading={removePasswordMutation.isPending}
        onConfirm={handleConfirmRemovePassword}
        onOpenChange={setShowRemoveConfirm}
        open={showRemoveConfirm}
        title={t("privacy.removePassword")}
      />
    </>
  )
}
