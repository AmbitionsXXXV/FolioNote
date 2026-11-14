import {
  AVATAR_MAX_COMPRESSED_SIZE,
  AVATAR_TARGET_IMAGE_SIZE,
  AVATAR_TARGET_QUALITY,
  RATE_LIMIT_POLL_INTERVAL_LIMITED,
  RATE_LIMIT_POLL_INTERVAL_NORMAL,
  RATE_LIMIT_STALE_TIME
} from "@folionote/constants"
import { formatTimeWithI18n } from "@folionote/utils"
import {
  Cancel01Icon,
  Delete02Icon,
  ImageUploadIcon,
  Time02Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as ImageManipulator from "expo-image-manipulator"
import * as ImagePicker from "expo-image-picker"
import {
  Avatar,
  BottomSheet,
  cn,
  PressableFeedback,
  useThemeColor
} from "heroui-native"
import { useEffect, useImperativeHandle, useState } from "react"
import { useTranslation } from "react-i18next"
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native"

import { client } from "@/utils/orpc"

type AllowedAvatarMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp"

const ALLOWED_AVATAR_TYPES: readonly AllowedAvatarMimeType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
] as const

interface AvatarUploaderProps {
  currentImageUrl?: string | null
  userName?: string
  onAvatarChange?: (newUrl: string | null) => void
  className?: string
  size?: number
  disableDirectPress?: boolean
  ref?: React.Ref<AvatarUploaderRef>
}

export interface AvatarUploaderRef {
  openActionSheet: () => void
  pickImage: () => void
}

function getInitials(name?: string): string {
  if (!name) {
    return ""
  }
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function useAvatarConfig() {
  return useQuery({
    queryKey: ["storage", "avatarConfig"],
    queryFn: () => client.storage.getAvatarConfig(),
    staleTime: Number.POSITIVE_INFINITY
  })
}

function useAvatarRateLimit() {
  const { data: rateLimitStatus, refetch: refetchRateLimit } = useQuery({
    queryKey: ["storage", "rateLimitStatus", "update"],
    queryFn: () => client.storage.getRateLimitStatus({ action: "update" }),
    staleTime: RATE_LIMIT_STALE_TIME,
    refetchInterval: (query) => {
      const { data } = query.state
      return data?.isLimited
        ? RATE_LIMIT_POLL_INTERVAL_LIMITED
        : RATE_LIMIT_POLL_INTERVAL_NORMAL
    }
  })

  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    if (!rateLimitStatus?.isLimited) {
      setCountdown(null)
      return
    }

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil((rateLimitStatus.resetAt - Date.now()) / 1000)
      )
      setCountdown(remaining)
      if (remaining === 0) {
        refetchRateLimit()
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [rateLimitStatus?.isLimited, rateLimitStatus?.resetAt, refetchRateLimit])

  return {
    rateLimitStatus,
    refetchRateLimit,
    countdown,
    isRateLimited: rateLimitStatus?.isLimited ?? false
  }
}

async function compressImage(
  uri: string
): Promise<{ uri: string; base64: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: AVATAR_TARGET_IMAGE_SIZE } }],
    {
      compress: AVATAR_TARGET_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true
    }
  )

  if (result.base64) {
    const sizeInBytes = (result.base64.length * 3) / 4
    if (sizeInBytes > AVATAR_MAX_COMPRESSED_SIZE) {
      const lowerQualityResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: AVATAR_TARGET_IMAGE_SIZE } }],
        {
          compress: 0.5,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        }
      )
      return {
        uri: lowerQualityResult.uri,
        base64: lowerQualityResult.base64 ?? ""
      }
    }
  }

  return {
    uri: result.uri,
    base64: result.base64 ?? ""
  }
}

function useAvatarUpload(
  onAvatarChange?: (newUrl: string | null) => void,
  refetchRateLimit?: () => void
) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      base64,
      contentType
    }: {
      base64: string
      contentType: AllowedAvatarMimeType
    }) =>
      client.storage.updateAvatar({
        fileData: base64,
        contentType,
        filename: "avatar.jpg"
      }),
    onSuccess: (data) => {
      onAvatarChange?.(data.imageUrl)
      queryClient.invalidateQueries({ queryKey: ["session"] })
      refetchRateLimit?.()
      Alert.alert(
        t("avatar.success", "Success"),
        t("avatar.uploadSuccess", "Avatar uploaded successfully")
      )
    },
    onError: (error) => {
      if (error.message.includes("Rate limit")) {
        refetchRateLimit?.()
      }
      Alert.alert(
        t("common.error", "Error"),
        t("avatar.uploadError", "Failed to upload avatar: {{message}}", {
          message: error.message
        })
      )
    }
  })
}

function useAvatarDelete(
  onAvatarChange?: (newUrl: string | null) => void,
  refetchRateLimit?: () => void
) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => client.storage.deleteAvatar(),
    onSuccess: () => {
      onAvatarChange?.(null)
      queryClient.invalidateQueries({ queryKey: ["session"] })
      refetchRateLimit?.()
      Alert.alert(
        t("avatar.success", "Success"),
        t("avatar.deleteSuccess", "Avatar deleted successfully")
      )
    },
    onError: (error) => {
      if (error.message.includes("Rate limit")) {
        refetchRateLimit?.()
      }
      Alert.alert(
        t("common.error", "Error"),
        t("avatar.deleteError", "Failed to delete avatar: {{message}}", {
          message: error.message
        })
      )
    }
  })
}

export function AvatarUploader({
  currentImageUrl,
  userName,
  onAvatarChange,
  className,
  size = 48,
  disableDirectPress = false,
  ref
}: AvatarUploaderProps): React.ReactElement {
  const { t } = useTranslation()
  const [actionSheetVisible, setActionSheetVisible] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const accentColor = useThemeColor("accent")
  const foregroundColor = useThemeColor("foreground")
  const mutedColor = useThemeColor("muted")
  const dangerColor = useThemeColor("danger")
  const warningColor = useThemeColor("warning")

  const { rateLimitStatus, refetchRateLimit, countdown, isRateLimited } =
    useAvatarRateLimit()
  const { data: config } = useAvatarConfig()

  const uploadMutation = useAvatarUpload(onAvatarChange, refetchRateLimit)
  const deleteMutation = useAvatarDelete(onAvatarChange, refetchRateLimit)

  const isLoading = uploadMutation.isPending || deleteMutation.isPending
  const displayUrl = previewUrl ?? currentImageUrl

  const getFormattedRateLimit = (): {
    value: number
    unit: string
  } => {
    const seconds =
      countdown !== null
        ? countdown
        : Math.ceil((rateLimitStatus?.resetInMs ?? 0) / 1000)
    return formatTimeWithI18n(seconds, t, { maxUnit: "hour" })
  }

  const validateFile = (mimeType: string, fileSize: number): string | null => {
    if (!config) {
      return null
    }

    if (!ALLOWED_AVATAR_TYPES.includes(mimeType as AllowedAvatarMimeType)) {
      return t("avatar.invalidType")
    }

    if (fileSize > config.maxSize) {
      return t("avatar.fileTooLarge", { size: config.maxSizeMB })
    }

    return null
  }

  const pickImage = async () => {
    if (isRateLimited) {
      const { value, unit } = getFormattedRateLimit()
      Alert.alert(
        t("avatar.rateLimited"),
        t("avatar.rateLimitedWait", { value, unit })
      )
      return
    }

    setActionSheetVisible(false)

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissionResult.granted) {
      Alert.alert(t("common.permissionRequired"), t("avatar.permissionDenied"))
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1
    })

    if (result.canceled || !result.assets[0]) {
      return
    }

    const asset = result.assets[0]
    const mimeType = asset.mimeType ?? "image/jpeg"
    const fileSize = asset.fileSize ?? 0

    const error = validateFile(mimeType, fileSize)
    if (error) {
      Alert.alert(t("common.error"), error)
      return
    }

    setPreviewUrl(asset.uri)

    try {
      const compressed = await compressImage(asset.uri)
      uploadMutation.mutate(
        {
          base64: compressed.base64,
          contentType: "image/jpeg"
        },
        {
          // Clear the optimistic preview once the upload settles: on success the
          // server URL takes over via onAvatarChange, on error we revert.
          onSettled: () => setPreviewUrl(null)
        }
      )
    } catch {
      setPreviewUrl(null)
      Alert.alert(t("common.error"), t("avatar.compressError"))
    }
  }

  const handleDelete = () => {
    setActionSheetVisible(false)
    Alert.alert(t("avatar.deleteTitle"), t("avatar.deleteConfirmation"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("avatar.delete"),
        style: "destructive",
        onPress: () => deleteMutation.mutate()
      }
    ])
  }

  const handlePress = () => {
    if (isLoading || disableDirectPress) {
      return
    }

    if (displayUrl) {
      setActionSheetVisible(true)
    } else {
      pickImage()
    }
  }

  const closeActionSheet = () => {
    setActionSheetVisible(false)
  }

  useImperativeHandle(
    ref,
    () => ({
      openActionSheet: () => {
        if (!isLoading) {
          setActionSheetVisible(true)
        }
      },
      pickImage: () => {
        if (!isLoading) {
          pickImage()
        }
      }
    }),
    [isLoading, pickImage]
  )

  const borderRadius = size / 2

  return (
    <View className={cn("items-center", className)}>
      <Pressable
        disabled={isLoading}
        onPress={handlePress}
        style={{
          width: size,
          height: size,
          borderRadius,
          overflow: "hidden"
        }}
      >
        <Avatar
          alt={userName ?? "User avatar"}
          color="accent"
          style={{ width: size, height: size }}
        >
          {displayUrl && <Avatar.Image source={{ uri: displayUrl }} />}
          <Avatar.Fallback>
            {userName ? getInitials(userName) : undefined}
          </Avatar.Fallback>
        </Avatar>

        {isLoading && (
          <View
            className="absolute inset-0 items-center justify-center bg-black/50"
            style={{ borderRadius }}
          >
            <ActivityIndicator color="white" size="small" />
          </View>
        )}
      </Pressable>

      <BottomSheet
        isOpen={actionSheetVisible}
        onOpenChange={setActionSheetVisible}
      >
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content>
            <BottomSheet.Title className="mb-4 text-center text-lg font-semibold">
              {t("avatar.actions")}
            </BottomSheet.Title>

            <RateLimitWarning
              countdown={countdown}
              isRateLimited={isRateLimited}
              warningColor={warningColor}
            />

            <RateLimitStatus
              isRateLimited={isRateLimited}
              mutedColor={mutedColor}
              rateLimitStatus={rateLimitStatus}
            />

            <View className="gap-2">
              <UploadButton
                accentColor={accentColor}
                foregroundColor={foregroundColor}
                isRateLimited={isRateLimited}
                mutedColor={mutedColor}
                onPress={pickImage}
              />

              {displayUrl && (
                <DeleteButton
                  dangerColor={dangerColor}
                  onPress={handleDelete}
                />
              )}
            </View>

            <CancelButton
              foregroundColor={foregroundColor}
              mutedColor={mutedColor}
              onPress={closeActionSheet}
            />
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </View>
  )
}

interface RateLimitWarningProps {
  isRateLimited: boolean
  countdown: number | null
  warningColor: string
}

function RateLimitWarning({
  isRateLimited,
  countdown,
  warningColor
}: RateLimitWarningProps): React.ReactElement | null {
  const { t } = useTranslation()

  if (!isRateLimited || countdown === null) {
    return null
  }

  const { value, unit } = formatTimeWithI18n(countdown, t, { maxUnit: "hour" })

  return (
    <View className="mb-4 flex-row items-center gap-2 rounded-lg bg-warning/10 p-3">
      <HugeiconsIcon color={warningColor} icon={Time02Icon} size={16} />
      <Text className="flex-1 text-sm text-foreground">
        {t("avatar.rateLimitedWait", { value, unit })}
      </Text>
    </View>
  )
}

interface RateLimitStatusProps {
  rateLimitStatus?: {
    remaining: number
    limit: number
    isLimited: boolean
  } | null
  isRateLimited: boolean
  mutedColor: string
}

function RateLimitStatus({
  rateLimitStatus,
  isRateLimited,
  mutedColor
}: RateLimitStatusProps): React.ReactElement | null {
  const { t } = useTranslation()

  if (!rateLimitStatus || isRateLimited) {
    return null
  }

  return (
    <View className="mb-4 flex-row items-center gap-2">
      <HugeiconsIcon color={mutedColor} icon={Time02Icon} size={14} />
      <Text className="text-xs text-muted">
        {t("avatar.remainingUploads", {
          remaining: rateLimitStatus.remaining,
          limit: rateLimitStatus.limit
        })}
      </Text>
    </View>
  )
}

interface UploadButtonProps {
  isRateLimited: boolean
  onPress: () => void
  mutedColor: string
  accentColor: string
  foregroundColor: string
}

function UploadButton({
  isRateLimited,
  onPress,
  mutedColor,
  accentColor,
  foregroundColor
}: UploadButtonProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <PressableFeedback
      className="flex-row items-center rounded-xl px-4 py-3"
      isDisabled={isRateLimited}
      onPress={onPress}
      style={{
        backgroundColor: `${mutedColor}10`,
        opacity: isRateLimited ? 0.5 : 1
      }}
    >
      <PressableFeedback.Highlight />
      <HugeiconsIcon color={accentColor} icon={ImageUploadIcon} size={20} />
      <Text
        className="ml-3 flex-1 font-medium"
        style={{ color: foregroundColor }}
      >
        {t("avatar.reupload")}
      </Text>
    </PressableFeedback>
  )
}

interface DeleteButtonProps {
  onPress: () => void
  dangerColor: string
}

function DeleteButton({
  onPress,
  dangerColor
}: DeleteButtonProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <PressableFeedback
      className="flex-row items-center rounded-xl px-4 py-3"
      onPress={onPress}
      style={{ backgroundColor: `${dangerColor}10` }}
    >
      <PressableFeedback.Highlight />
      <HugeiconsIcon color={dangerColor} icon={Delete02Icon} size={20} />
      <Text className="ml-3 flex-1 font-medium text-danger">
        {t("avatar.delete")}
      </Text>
    </PressableFeedback>
  )
}

interface CancelButtonProps {
  onPress: () => void
  mutedColor: string
  foregroundColor: string
}

function CancelButton({
  onPress,
  mutedColor,
  foregroundColor
}: CancelButtonProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <View className="mt-4">
      <PressableFeedback
        className="items-center rounded-xl py-3"
        onPress={onPress}
        style={{ backgroundColor: `${mutedColor}20` }}
      >
        <PressableFeedback.Highlight />
        <HugeiconsIcon color={foregroundColor} icon={Cancel01Icon} size={18} />
        <Text className="ml-2 font-medium" style={{ color: foregroundColor }}>
          {t("common.cancel")}
        </Text>
      </PressableFeedback>
    </View>
  )
}

export default AvatarUploader
