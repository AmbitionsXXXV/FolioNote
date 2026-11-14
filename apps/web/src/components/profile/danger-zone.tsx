import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@folionote/ui/alert-dialog"
import { Button } from "@folionote/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@folionote/ui/card"
import { Separator } from "@folionote/ui/separator"
import { Alert01Icon, Logout03Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { DangerZoneProps } from "@/types/profile"

/**
 * Danger zone card with sign out and delete account options
 */
export function DangerZone({ onSignOut }: DangerZoneProps) {
  const { t } = useTranslation()
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false)

  return (
    <Card className="rounded-3xl border border-destructive/40 bg-card/70 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display font-semibold text-destructive">
          <HugeiconsIcon className="size-5" icon={Alert01Icon} />
          {t("profile.dangerZone")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sign Out All Devices */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{t("profile.signOutAllDevices")}</p>
            <p className="text-sm text-pretty text-muted-foreground">
              {t("profile.signOutAllDevicesDescription")}
            </p>
          </div>
          <Button onClick={() => setSignOutDialogOpen(true)} variant="outline">
            {t("auth.signOut")}
          </Button>
        </div>

        {/* Sign Out Confirmation Dialog */}
        <AlertDialog
          onOpenChange={setSignOutDialogOpen}
          open={signOutDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <HugeiconsIcon
                  className="size-5 text-destructive"
                  icon={Alert01Icon}
                />
                {t("profile.signOutConfirmTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-pretty">
                {t("profile.signOutConfirmDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={onSignOut} variant="destructive">
                <HugeiconsIcon className="mr-2 size-4" icon={Logout03Icon} />
                {t("auth.signOut")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Separator />

        {/* Delete Account */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{t("profile.deleteAccount")}</p>
            <p className="text-sm text-pretty text-muted-foreground">
              {t("profile.deleteAccountDescription")}
            </p>
          </div>
          <Button disabled variant="destructive">
            {t("profile.deleteAccount")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
