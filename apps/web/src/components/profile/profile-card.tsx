import { formatUserNo, getDaysSince } from "@folionote/constants"
import { Button } from "@folionote/ui/button"
import {
  Calendar03Icon,
  Edit02Icon,
  UserAccountIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRef } from "react"
import { Trans, useTranslation } from "react-i18next"

import { AvatarUploader } from "@/components/avatar-uploader"
import type { AvatarUploaderRef } from "@/components/avatar-uploader"
import { Surface } from "@/components/surface"
import { useAvatarState } from "@/hooks/use-avatar-state"

/**
 * Profile card component displaying user avatar and information
 */
export function ProfileCard() {
  const { t } = useTranslation()
  const avatarUploaderRef = useRef<AvatarUploaderRef>(null)
  const {
    currentImageUrl,
    setLocalImageUrl: onLocalImageUrlChange,
    user
  } = useAvatarState()

  return (
    <Surface className="p-6">
      <div className="mb-6 space-y-1.5">
        <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
            <HugeiconsIcon
              className="size-5 text-primary"
              icon={UserAccountIcon}
            />
          </span>
          {t("profile.settings")}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          {t("profile.avatarHelp")}
        </p>
      </div>
      <div className="flex flex-col items-center gap-8">
        {/* Avatar Section */}
        <div className="flex aspect-square flex-col items-center gap-4">
          <div className="flex items-center justify-center rounded-full bg-white p-1 shadow-xl">
            <AvatarUploader
              avatarClassName="size-24!"
              currentImageUrl={currentImageUrl}
              onAvatarChange={onLocalImageUrlChange}
              ref={avatarUploaderRef}
              size="lg"
              userName={user?.name}
            />
          </div>
          <Button
            className="rounded-full shadow-xl"
            onClick={() => avatarUploaderRef.current?.open()}
            size="sm"
            variant="outline"
          >
            <HugeiconsIcon className="mr-2 size-4" icon={Edit02Icon} />
            {t("profile.editPhoto")}
          </Button>
        </div>

        {/* Info Section */}
        <div className="w-full space-y-1">
          {/* Name */}
          <div className="flex items-center justify-between rounded-lg p-3">
            <span className="text-sm text-muted-foreground">
              {t("profile.name")}
            </span>
            <span className="font-display text-lg font-semibold text-foreground">
              {user?.name}
            </span>
          </div>

          {/* Email */}
          <div className="flex items-center justify-between rounded-lg p-3">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="truncate text-muted-foreground">
              {user?.email}
            </span>
          </div>

          {/* Founding Member */}
          {user?.no && (
            <div className="flex items-center justify-between rounded-lg p-3">
              <span className="text-sm text-muted-foreground">
                {t("profile.foundingMember")}
              </span>
              <span className="rounded bg-surface-secondary px-1.5 py-0.5 font-number text-lg font-semibold text-primary tabular-nums dark:bg-transparent">
                No.{formatUserNo(user.no)}
              </span>
            </div>
          )}

          {/* Joined */}
          <div className="flex items-center justify-between rounded-lg p-3">
            <span className="text-sm text-muted-foreground">
              {t("profile.joined")}
            </span>
            <div className="flex items-center gap-1.5 text-sm">
              <HugeiconsIcon
                className="size-4 text-muted-foreground"
                icon={Calendar03Icon}
              />
              <span className="text-muted-foreground">
                <Trans
                  components={{
                    1: (
                      <span className="font-number text-lg font-semibold text-primary tabular-nums" />
                    )
                  }}
                  i18nKey="profile.joinedDays"
                  values={{ count: getDaysSince(user?.createdAt) }}
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Surface>
  )
}
