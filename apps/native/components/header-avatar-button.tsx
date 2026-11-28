import { router } from "expo-router"
import { Avatar } from "heroui-native"
import { useTranslation } from "react-i18next"
import { Pressable } from "react-native"

import { authClient } from "@/lib/auth-client"

const initialsOf = (name: string | undefined): string =>
  name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"

/**
 * Top-right avatar in every tab header; opens Settings, which no longer has
 * a tab of its own.
 */
export function HeaderAvatarButton() {
  const { t } = useTranslation()
  const { data: session } = authClient.useSession()
  const user = session?.user

  return (
    <Pressable
      accessibilityLabel={t("common.settings")}
      accessibilityRole="button"
      className="px-1.5"
      hitSlop={8}
      onPress={() => router.push("/settings")}
    >
      <Avatar
        alt={user?.name ?? t("common.settings")}
        className="size-8"
        color="accent"
      >
        {user?.image ? <Avatar.Image source={{ uri: user.image }} /> : null}
        <Avatar.Fallback>{initialsOf(user?.name)}</Avatar.Fallback>
      </Avatar>
    </Pressable>
  )
}
