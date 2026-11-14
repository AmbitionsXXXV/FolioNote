import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput
} from "@gorhom/bottom-sheet"
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet"
import {
  Cancel01Icon,
  LockPasswordIcon,
  SquareUnlock01Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useThemeColor } from "heroui-native"
import { useImperativeHandle, useRef, useState } from "react"
import type { Ref } from "react"
import { useTranslation } from "react-i18next"
import { Alert, Pressable, Text, View } from "react-native"

import { client, orpc, queryClient } from "@/utils/orpc"

interface EntryPasswordSheetProps {
  entryId: string
}

export interface EntryPasswordSheetRef {
  open: () => void
  close: () => void
}

interface SheetHeaderProps {
  foregroundColor: string
  mutedColor: string
  onClose: () => void
}

/**
 * Title bar with lock icon and a close button.
 */
const SheetHeader = ({
  foregroundColor,
  mutedColor,
  onClose
}: SheetHeaderProps) => {
  const { t } = useTranslation()
  return (
    <View className="mb-4 flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <HugeiconsIcon
          color={foregroundColor}
          icon={LockPasswordIcon}
          size={24}
        />
        <Text className="text-lg font-semibold text-foreground">
          {t("privacy.title")}
        </Text>
      </View>
      <Pressable onPress={onClose}>
        <HugeiconsIcon color={mutedColor} icon={Cancel01Icon} size={24} />
      </Pressable>
    </View>
  )
}

interface ConfirmPasswordSectionProps {
  confirmPassword: string
  setConfirmPassword: (value: string) => void
  passwordsMatch: boolean
  mutedColor: string
}

/**
 * Confirm-password input plus its mismatch warning, shared by both views.
 */
const ConfirmPasswordSection = ({
  confirmPassword,
  setConfirmPassword,
  passwordsMatch,
  mutedColor
}: ConfirmPasswordSectionProps) => {
  const { t } = useTranslation()
  return (
    <>
      <Text className="mb-2 text-sm text-foreground">
        {t("privacy.confirmPassword")}
      </Text>
      <BottomSheetTextInput
        autoCapitalize="none"
        className="mb-3 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
        onChangeText={setConfirmPassword}
        placeholder={t("privacy.confirmPlaceholder")}
        placeholderTextColor={mutedColor}
        secureTextEntry
        value={confirmPassword}
      />
      {confirmPassword.length > 0 && !passwordsMatch && (
        <Text className="mb-3 text-sm text-danger">
          {t("privacy.passwordMismatch")}
        </Text>
      )}
    </>
  )
}

interface HasPasswordViewProps {
  password: string
  confirmPassword: string
  setPassword: (value: string) => void
  setConfirmPassword: (value: string) => void
  passwordsMatch: boolean
  isValidPassword: boolean
  foregroundColor: string
  mutedColor: string
  warningColor: string
  accentColor: string
  onRemovePassword: () => void
  onSetPassword: () => void
  isRemovePending: boolean
  isSetPending: boolean
}

/**
 * View shown when the entry is already password-protected: change or remove.
 */
const HasPasswordView = ({
  password,
  confirmPassword,
  setPassword,
  setConfirmPassword,
  passwordsMatch,
  isValidPassword,
  foregroundColor,
  mutedColor,
  warningColor,
  accentColor,
  onRemovePassword,
  onSetPassword,
  isRemovePending,
  isSetPending
}: HasPasswordViewProps) => {
  const { t } = useTranslation()
  const isSetDisabled = !(isValidPassword && passwordsMatch) || isSetPending
  return (
    <View>
      {/* Status indicator */}
      <View
        className="mb-4 flex-row items-center gap-2 rounded-lg p-3"
        style={{ backgroundColor: `${warningColor}20` }}
      >
        <HugeiconsIcon color={warningColor} icon={LockPasswordIcon} size={20} />
        <Text style={{ color: warningColor }}>
          {t("privacy.currentlyProtected")}
        </Text>
      </View>

      {/* New password input */}
      <Text className="mb-2 text-sm text-foreground">
        {t("privacy.newPassword")}
      </Text>
      <BottomSheetTextInput
        autoCapitalize="none"
        className="mb-3 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
        onChangeText={setPassword}
        placeholder={t("privacy.passwordPlaceholder")}
        placeholderTextColor={mutedColor}
        secureTextEntry
        value={password}
      />

      {password.length > 0 && (
        <ConfirmPasswordSection
          confirmPassword={confirmPassword}
          mutedColor={mutedColor}
          passwordsMatch={passwordsMatch}
          setConfirmPassword={setConfirmPassword}
        />
      )}

      {/* Action buttons */}
      <View className="mt-4 flex-row gap-3">
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border py-3"
          disabled={isRemovePending}
          onPress={onRemovePassword}
        >
          <HugeiconsIcon
            color={foregroundColor}
            icon={SquareUnlock01Icon}
            size={20}
          />
          <Text className="font-semibold text-foreground">
            {t("privacy.removePassword")}
          </Text>
        </Pressable>
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-2 rounded-lg py-3"
          disabled={isSetDisabled}
          onPress={onSetPassword}
          style={{
            backgroundColor: accentColor,
            opacity: isSetDisabled ? 0.5 : 1
          }}
        >
          <HugeiconsIcon color="white" icon={LockPasswordIcon} size={20} />
          <Text className="font-semibold text-white">
            {t("privacy.changePassword")}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

interface NoPasswordViewProps {
  password: string
  confirmPassword: string
  setPassword: (value: string) => void
  setConfirmPassword: (value: string) => void
  passwordsMatch: boolean
  isValidPassword: boolean
  mutedColor: string
  accentColor: string
  onSetPassword: () => void
  isSetPending: boolean
}

/**
 * View shown when the entry has no password yet: set one.
 */
const NoPasswordView = ({
  password,
  confirmPassword,
  setPassword,
  setConfirmPassword,
  passwordsMatch,
  isValidPassword,
  mutedColor,
  accentColor,
  onSetPassword,
  isSetPending
}: NoPasswordViewProps) => {
  const { t } = useTranslation()
  const isSetDisabled = !(isValidPassword && passwordsMatch) || isSetPending
  return (
    <View>
      <Text className="mb-4 text-muted">{t("privacy.setDescription")}</Text>

      {/* Password input */}
      <Text className="mb-2 text-sm text-foreground">
        {t("privacy.password")}
      </Text>
      <BottomSheetTextInput
        autoCapitalize="none"
        className="mb-3 rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
        onChangeText={setPassword}
        placeholder={t("privacy.passwordPlaceholder")}
        placeholderTextColor={mutedColor}
        secureTextEntry
        value={password}
      />
      {password.length > 0 && password.length < 4 && (
        <Text className="mb-3 text-sm text-muted">
          {t("privacy.minLength")}
        </Text>
      )}

      {password.length >= 4 && (
        <ConfirmPasswordSection
          confirmPassword={confirmPassword}
          mutedColor={mutedColor}
          passwordsMatch={passwordsMatch}
          setConfirmPassword={setConfirmPassword}
        />
      )}

      {/* Set password button */}
      <Pressable
        className="mt-4 flex-row items-center justify-center gap-2 rounded-lg py-3"
        disabled={isSetDisabled}
        onPress={onSetPassword}
        style={{
          backgroundColor: accentColor,
          opacity: isSetDisabled ? 0.5 : 1
        }}
      >
        <HugeiconsIcon color="white" icon={LockPasswordIcon} size={20} />
        <Text className="font-semibold text-white">
          {t("privacy.setPassword")}
        </Text>
      </Pressable>
    </View>
  )
}

// Render backdrop
const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
)

/**
 * EntryPasswordSheet component for managing password protection on Native
 */
export const EntryPasswordSheet = ({
  entryId,
  ref
}: EntryPasswordSheetProps & { ref?: Ref<EntryPasswordSheetRef> }) => {
  const { t } = useTranslation()
  const bottomSheetRef = useRef<BottomSheet>(null)

  // Theme colors
  const foregroundColor = useThemeColor("foreground")
  const mutedColor = useThemeColor("muted")
  const accentColor = useThemeColor("accent")
  const surfaceColor = useThemeColor("surface")
  const warningColor = useThemeColor("warning")

  // Form state
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Snap points
  const snapPoints = ["50%"]

  // Expose ref methods
  useImperativeHandle(ref, () => ({
    open: () => {
      setPassword("")
      setConfirmPassword("")
      bottomSheetRef.current?.expand()
    },
    close: () => bottomSheetRef.current?.close()
  }))

  // Check if entry has password
  const { data: passwordStatus } = useQuery(
    orpc.entries.checkPassword.queryOptions({ input: { id: entryId } })
  )

  // Set password mutation
  const setPasswordMutation = useMutation({
    mutationFn: (newPassword: string) =>
      client.entries.setPassword({ id: entryId, password: newPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [["entries", "checkPassword"]]
      })
      queryClient.invalidateQueries({ queryKey: [["entries", "get"]] })
      Alert.alert(t("common.success"), t("privacy.passwordSet"))
      bottomSheetRef.current?.close()
    },
    onError: () => {
      Alert.alert(t("common.error"), t("privacy.setPasswordError"))
    }
  })

  // Remove password mutation
  const removePasswordMutation = useMutation({
    mutationFn: () => client.entries.removePassword({ id: entryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [["entries", "checkPassword"]]
      })
      queryClient.invalidateQueries({ queryKey: [["entries", "get"]] })
      Alert.alert(t("common.success"), t("privacy.passwordRemoved"))
      bottomSheetRef.current?.close()
    },
    onError: () => {
      Alert.alert(t("common.error"), t("privacy.removePasswordError"))
    }
  })

  // Handle set password
  const handleSetPassword = () => {
    if (password.length >= 4 && password === confirmPassword) {
      setPasswordMutation.mutate(password)
    }
  }

  // Handle remove password
  const handleRemovePassword = () => {
    Alert.alert(t("privacy.removePassword"), t("privacy.removeConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: () => removePasswordMutation.mutate()
      }
    ])
  }

  const passwordsMatch = password === confirmPassword
  const isValidPassword = password.length >= 4

  return (
    <BottomSheet
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: surfaceColor }}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      index={-1}
      ref={bottomSheetRef}
      snapPoints={snapPoints}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ padding: 16 }}
        style={{ flex: 1 }}
      >
        <SheetHeader
          foregroundColor={foregroundColor}
          mutedColor={mutedColor}
          onClose={() => bottomSheetRef.current?.close()}
        />

        {passwordStatus?.hasPassword ? (
          <HasPasswordView
            accentColor={accentColor}
            confirmPassword={confirmPassword}
            foregroundColor={foregroundColor}
            isRemovePending={removePasswordMutation.isPending}
            isSetPending={setPasswordMutation.isPending}
            isValidPassword={isValidPassword}
            mutedColor={mutedColor}
            onRemovePassword={handleRemovePassword}
            onSetPassword={handleSetPassword}
            password={password}
            passwordsMatch={passwordsMatch}
            setConfirmPassword={setConfirmPassword}
            setPassword={setPassword}
            warningColor={warningColor}
          />
        ) : (
          <NoPasswordView
            accentColor={accentColor}
            confirmPassword={confirmPassword}
            isSetPending={setPasswordMutation.isPending}
            isValidPassword={isValidPassword}
            mutedColor={mutedColor}
            onSetPassword={handleSetPassword}
            password={password}
            passwordsMatch={passwordsMatch}
            setConfirmPassword={setConfirmPassword}
            setPassword={setPassword}
          />
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

EntryPasswordSheet.displayName = "EntryPasswordSheet"
