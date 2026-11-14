import {
  ArrowRight01Icon,
  Edit02Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useQueryClient } from "@tanstack/react-query"
import { ImpactFeedbackStyle, impactAsync } from "expo-haptics"
import {
  BottomSheet,
  Button,
  Card,
  Input,
  PressableFeedback,
  TextField,
  useThemeColor
} from "heroui-native"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  View
} from "react-native"

import { AvatarUploader } from "@/components/avatar-uploader"
import type { AvatarUploaderRef } from "@/components/avatar-uploader"
import { Container } from "@/components/container"
import { useAvatarState } from "@/hooks"
import { authClient } from "@/lib/auth-client"

/**
 * Profile settings page - secondary route under settings
 * Shows user avatar and name with edit functionality
 */
export default function ProfileScreen() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const { currentImageUrl, setLocalImageUrl, user } = useAvatarState()
  const avatarUploaderRef = useRef<AvatarUploaderRef>(null)

  // Name edit state
  const [nameSheetOpen, setNameSheetOpen] = useState(false)
  const [editingName, setEditingName] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)

  const mutedColor = useThemeColor("muted")
  const foregroundColor = useThemeColor("foreground")

  // Handle edit photo button press
  const handleEditPhoto = () => {
    if (Platform.OS === "ios") {
      impactAsync(ImpactFeedbackStyle.Light)
    }
    avatarUploaderRef.current?.openActionSheet()
  }

  // Handle name edit press
  const handleNamePress = () => {
    if (Platform.OS === "ios") {
      impactAsync(ImpactFeedbackStyle.Light)
    }
    setEditingName(session?.user?.name ?? "")
    setNameSheetOpen(true)
  }

  // Handle save name
  const handleSaveName = async () => {
    const trimmedName = editingName.trim()
    if (!trimmedName) {
      Alert.alert(t("common.error"), t("auth.nameRequired"))
      return
    }

    if (trimmedName === session?.user?.name) {
      setNameSheetOpen(false)
      return
    }

    if (Platform.OS === "ios") {
      impactAsync(ImpactFeedbackStyle.Medium)
    }

    setIsUpdating(true)
    try {
      await authClient.updateUser({
        name: trimmedName
      })
      // Invalidate session to refresh user data
      queryClient.invalidateQueries({ queryKey: ["session"] })
      setNameSheetOpen(false)
      Alert.alert(t("common.save"), t("profile.nameUpdated"))
    } catch {
      Alert.alert(t("common.error"), t("profile.nameUpdateFailed"))
    }
    setIsUpdating(false)
  }

  return (
    <Container className="flex-1" disableScroll disableTopInset>
      <ScrollView
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Avatar Section */}
        <View className="mb-8 items-center">
          {/* Large Avatar */}
          <View
            className="rounded-full bg-white p-[4px] shadow-lg"
            style={{ boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)" }}
          >
            <AvatarUploader
              currentImageUrl={currentImageUrl}
              disableDirectPress
              onAvatarChange={setLocalImageUrl}
              ref={avatarUploaderRef}
              size={100}
              userName={user?.name}
            />
          </View>

          {/* Edit Photo Button */}
          <PressableFeedback
            className="mt-4 flex-row items-center gap-2 rounded-full bg-[#FFFBFF] px-4 py-2 shadow-lg dark:bg-[#3f324a]"
            onPress={handleEditPhoto}
          >
            <HugeiconsIcon
              color={foregroundColor}
              icon={Edit02Icon}
              size={16}
            />
            <Text className="text-sm font-medium text-foreground">
              {t("profile.editPhoto")}
            </Text>
          </PressableFeedback>
        </View>

        {/* Profile Info Card */}
        <Card className="overflow-hidden p-0" variant="secondary">
          {/* Name Row */}
          <PressableFeedback
            className="flex-row items-center justify-between bg-[#FFFBFF] px-4 py-3.5 dark:bg-[#3f324a]"
            onPress={handleNamePress}
          >
            <PressableFeedback.Highlight />
            <Text className="text-foreground">{t("profile.name")}</Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-muted">
                {session?.user?.name ?? t("common.other")}
              </Text>
              <HugeiconsIcon
                color={mutedColor}
                icon={ArrowRight01Icon}
                size={16}
              />
            </View>
          </PressableFeedback>
        </Card>
      </ScrollView>

      {/* Name Edit Bottom Sheet */}
      <BottomSheet isOpen={nameSheetOpen} onOpenChange={setNameSheetOpen}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content keyboardBehavior="extend">
            <BottomSheet.Title className="mb-4 text-center text-lg font-semibold">
              {t("profile.editName")}
            </BottomSheet.Title>

            <View className="mb-6">
              <TextField>
                <Input
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoFocus
                  onChangeText={setEditingName}
                  placeholder={t("auth.namePlaceholder")}
                  returnKeyType="done"
                  value={editingName}
                />
              </TextField>
            </View>

            <Button isDisabled={isUpdating} onPress={handleSaveName}>
              {isUpdating ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Button.Label>{t("common.save")}</Button.Label>
              )}
            </Button>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </Container>
  )
}
