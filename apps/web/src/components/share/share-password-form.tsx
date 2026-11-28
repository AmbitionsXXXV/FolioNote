import { Button } from "@folionote/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@folionote/ui/card"
import { Input } from "@folionote/ui/input"
import { Spinner } from "@folionote/ui/spinner"
import { LockPasswordIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import type { PasswordFormProps } from "@/types/share"

/**
 * Password form component for protected share links
 */
export function SharePasswordForm({
  password,
  onPasswordChange,
  onSubmit,
  isPending,
  error
}: PasswordFormProps) {
  const { t } = useTranslation()

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (password.length > 0) {
        onSubmit()
      }
    },
    [password, onSubmit]
  )

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-surface-secondary">
            <HugeiconsIcon
              className="size-6 text-muted-foreground"
              icon={LockPasswordIcon}
            />
          </div>
          <CardTitle className="text-balance">
            {t("share.passwordRequired")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              autoFocus
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder={t("share.enterPassword")}
              type="password"
              value={password}
            />
            {error && (
              <p className="text-sm text-destructive">
                {t("share.wrongPassword")}
              </p>
            )}
            <Button
              className="w-full"
              disabled={password.length === 0 || isPending}
              type="submit"
            >
              {isPending ? <Spinner className="mr-2 size-4" /> : null}
              {t("share.unlock")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
