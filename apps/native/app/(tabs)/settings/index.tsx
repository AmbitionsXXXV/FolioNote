import {
  formatUserNo,
  getDaysSince,
  LANGUAGE_LABELS
} from "@folionote/constants"
import { supportedLanguages } from "@folionote/locales"
import type { SupportedLanguage } from "@folionote/locales"
import {
  ArrowRight01Icon,
  Delete02Icon,
  Logout03Icon,
  Moon02Icon,
  Sun03Icon,
  Tick02Icon,
  TranslationIcon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react-native"
import Constants from "expo-constants"
import { ImpactFeedbackStyle, impactAsync } from "expo-haptics"
import { router } from "expo-router"
import {
  Avatar,
  BottomSheet,
  Button,
  cn,
  Dialog,
  PressableFeedback,
  Switch,
  useThemeColor
} from "heroui-native"
import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  View
} from "react-native"
import Animated, { ZoomIn } from "react-native-reanimated"

import { BrandLockup } from "@/components/brand-lockup"
import { Container } from "@/components/container"
import { useAppTheme } from "@/contexts/app-theme-context"
import { useAvatarState } from "@/hooks"
import { authClient } from "@/lib/auth-client"

type AvatarState = ReturnType<typeof useAvatarState>
type AvatarUser = AvatarState["user"]

export default function SettingsScreen() {
  const { i18n } = useTranslation()
  const { data: session } = authClient.useSession()
  const { isLight, toggleTheme } = useAppTheme()
  const [languageModalVisible, setLanguageModalVisible] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false)
  const { currentImageUrl, user } = useAvatarState()

  const currentLanguage = i18n.language as SupportedLanguage

  const handleLanguageChange = (lang: SupportedLanguage) => {
    if (Platform.OS === "ios") {
      impactAsync(ImpactFeedbackStyle.Light)
    }
    i18n.changeLanguage(lang)
    setLanguageModalVisible(false)
  }

  const handleThemeToggle = () => {
    if (Platform.OS === "ios") {
      impactAsync(ImpactFeedbackStyle.Light)
    }
    toggleTheme()
  }

  const handleSignOutPress = () => {
    if (Platform.OS === "ios") {
      impactAsync(ImpactFeedbackStyle.Light)
    }
    setSignOutDialogOpen(true)
  }

  const handleSignOutConfirm = async () => {
    if (Platform.OS === "ios") {
      impactAsync(ImpactFeedbackStyle.Medium)
    }
    setSignOutDialogOpen(false)
    setIsSigningOut(true)
    try {
      // 首先撤销所有其他 session，确保彻底登出
      try {
        await authClient.revokeSessions()
      } catch (error) {
        console.warn("Failed to revoke sessions:", error)
      }

      // 然后执行标准的 signOut
      await authClient.signOut()
      router.replace("/(auth)/sign-in")
    } catch {
      // Handle error silently
    }
    setIsSigningOut(false)
  }

  return (
    <Container className="flex-1" disableScroll disableTopInset>
      <ScrollView
        // iOS: 自动调整内容偏移以适应透明 header (Liquid Glass)
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {session?.user && (
          <ProfileHeaderCard currentImageUrl={currentImageUrl} user={user} />
        )}

        <AppearanceSection isLight={isLight} onToggle={handleThemeToggle} />

        <LanguageSection
          currentLanguage={currentLanguage}
          onPress={() => setLanguageModalVisible(true)}
        />

        {session?.user && (
          <DangerZoneSection
            isSigningOut={isSigningOut}
            onSignOutPress={handleSignOutPress}
          />
        )}

        <AppInfoFooter />
      </ScrollView>

      <SignOutDialog
        isOpen={signOutDialogOpen}
        onConfirm={handleSignOutConfirm}
        onOpenChange={setSignOutDialogOpen}
      />

      <LanguageBottomSheet
        currentLanguage={currentLanguage}
        isOpen={languageModalVisible}
        onOpenChange={setLanguageModalVisible}
        onSelect={handleLanguageChange}
      />
    </Container>
  )
}

interface ProfileHeaderCardProps {
  currentImageUrl: AvatarState["currentImageUrl"]
  user: AvatarUser
}

/** Tappable user card that navigates to the profile screen. */
function ProfileHeaderCard({ currentImageUrl, user }: ProfileHeaderCardProps) {
  const { t } = useTranslation()
  const mutedColor = useThemeColor("muted")
  const accentColor = useThemeColor("accent")

  return (
    <PressableFeedback
      className="mb-6 overflow-hidden rounded-2xl text-shadow-accent"
      onPress={() => router.push("/profile")}
      style={{ boxShadow: "0px 4px 12px rgba(139, 92, 246, 0.15)" }}
    >
      <View
        style={{
          padding: 16,
          borderRadius: 16,
          experimental_backgroundImage: `linear-gradient(135deg, ${accentColor}95, ${accentColor}60, ${accentColor}25)`
        }}
      >
        <View className="flex-row items-center">
          {/* Avatar */}
          <View
            className="mr-3 rounded-full bg-white p-[3px] text-shadow-black"
            style={{ boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)" }}
          >
            <Avatar
              alt={user?.name ?? "User avatar"}
              className="size-14 shadow-lg"
              color="accent"
            >
              {currentImageUrl && (
                <Avatar.Image source={{ uri: currentImageUrl }} />
              )}
              <Avatar.Fallback>
                {user?.name
                  ?.split(" ")
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) ?? "?"}
              </Avatar.Fallback>
            </Avatar>
          </View>

          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg font-semibold text-foreground">
                {user?.name ?? t("common.other")}
              </Text>
            </View>

            {/* Founding Member Badge & Joined Days */}
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-muted">
                {t("profile.foundingMember")}
              </Text>
              {user?.no && (
                <Text
                  className="text-sm font-semibold text-accent"
                  style={{ fontFamily: "LeckerliOne" }}
                >
                  No.{formatUserNo(user.no)}
                </Text>
              )}
            </View>

            {/* Joined Days */}
            <View className="mt-1 flex-row items-center gap-1">
              <Text className="text-xs text-muted">
                <Trans
                  components={{
                    1: (
                      <Text
                        className="text-xs font-semibold text-accent"
                        style={{ fontFamily: "LeckerliOne" }}
                      />
                    )
                  }}
                  i18nKey="profile.joinedDays"
                  values={{ count: getDaysSince(user?.createdAt) }}
                />
              </Text>
            </View>
          </View>

          <HugeiconsIcon color={mutedColor} icon={ArrowRight01Icon} size={20} />
        </View>
      </View>
    </PressableFeedback>
  )
}

interface AppearanceSectionProps {
  isLight: boolean
  onToggle: () => void
}

/** Theme heading plus the light/dark toggle row. */
function AppearanceSection({ isLight, onToggle }: AppearanceSectionProps) {
  const { t } = useTranslation()
  const mutedColor = useThemeColor("muted")
  const accentColor = useThemeColor("accent")
  const infoColor = useThemeColor("default")
  const accentForegroundColor = useThemeColor("accent-foreground")

  return (
    <>
      {/* Appearance Section */}
      <Text className="mb-3 text-lg font-semibold text-foreground">
        {t("common.theme")}
      </Text>

      <PressableFeedback
        className="mb-3 rounded-3xl bg-[#FFFBFF] p-4 dark:bg-[#3f324a]"
        onPress={onToggle}
      >
        <View className="flex-row items-center">
          <View className="mr-3 size-10 items-center justify-center rounded-lg bg-accent/10">
            <HugeiconsIcon
              color={accentColor}
              icon={isLight ? Sun03Icon : Moon02Icon}
              size={24}
            />
          </View>
          <View className="flex-1">
            <Text className="font-medium text-foreground">
              {t("common.theme")}
            </Text>
            <Text className="text-sm text-muted">
              {isLight ? t("common.themeLight") : t("common.themeDark")}
            </Text>
          </View>
          <Switch
            animation={{
              backgroundColor: {
                value: [mutedColor, accentColor]
              }
            }}
            className="h-[32px] w-[56px]"
            isSelected={isLight}
            onSelectedChange={onToggle}
          >
            <Switch.Thumb
              animation={{
                left: {
                  value: 4,
                  springConfig: {
                    damping: 30,
                    stiffness: 300,
                    mass: 1
                  }
                }
              }}
              className="size-[22px]"
            />
            <Switch.StartContent className="left-2">
              {isLight && (
                <Animated.View entering={ZoomIn.springify()} key="sun">
                  <HugeiconsIcon
                    color={accentForegroundColor}
                    icon={Sun03Icon}
                    size={16}
                  />
                </Animated.View>
              )}
            </Switch.StartContent>
            <Switch.EndContent className="right-2">
              {!isLight && (
                <Animated.View entering={ZoomIn.springify()} key="moon">
                  <HugeiconsIcon
                    color={infoColor}
                    icon={Moon02Icon}
                    size={16}
                  />
                </Animated.View>
              )}
            </Switch.EndContent>
          </Switch>
        </View>
      </PressableFeedback>
    </>
  )
}

interface LanguageSectionProps {
  currentLanguage: SupportedLanguage
  onPress: () => void
}

/** Language heading plus the row that opens the language picker. */
function LanguageSection({ currentLanguage, onPress }: LanguageSectionProps) {
  const { t } = useTranslation()
  const mutedColor = useThemeColor("muted")
  const successColor = useThemeColor("success")

  return (
    <>
      {/* Language Section */}
      <Text className="mt-4 mb-3 text-lg font-semibold text-foreground">
        {t("common.language")}
      </Text>

      <PressableFeedback
        className="mb-3 rounded-2xl bg-[#FFFBFF] p-4 dark:bg-[#3f324a]"
        onPress={onPress}
      >
        <View className="flex-row items-center">
          <View className="mr-3 size-10 items-center justify-center rounded-lg bg-success/10">
            <HugeiconsIcon
              color={successColor}
              icon={TranslationIcon}
              size={24}
            />
          </View>
          <View className="flex-1">
            <Text className="font-medium text-foreground">
              {t("common.language")}
            </Text>
            <Text className="text-sm text-muted">
              {LANGUAGE_LABELS[currentLanguage]}
            </Text>
          </View>
          <HugeiconsIcon color={mutedColor} icon={ArrowRight01Icon} size={20} />
        </View>
      </PressableFeedback>
    </>
  )
}

interface DangerZoneSectionProps {
  isSigningOut: boolean
  onSignOutPress: () => void
}

/** Danger zone with sign-out (active) and delete-account (disabled) rows. */
function DangerZoneSection({
  isSigningOut,
  onSignOutPress
}: DangerZoneSectionProps) {
  const { t } = useTranslation()
  const dangerColor = useThemeColor("danger")

  return (
    <>
      <Text className="mt-4 mb-3 text-lg font-semibold text-danger">
        {t("profile.dangerZone")}
      </Text>

      {/* Sign Out */}
      <PressableFeedback
        className="mb-3 rounded-2xl border border-danger/30 bg-[#FFFBFF] p-4 dark:bg-[#3f324a]"
        isDisabled={isSigningOut}
        onPress={onSignOutPress}
      >
        <View className="flex-row items-center">
          <View className="mr-3 size-10 items-center justify-center rounded-lg bg-danger/10">
            <HugeiconsIcon color={dangerColor} icon={Logout03Icon} size={24} />
          </View>
          <View className="flex-1">
            <Text className="font-medium text-danger">
              {t("profile.signOutAllDevices")}
            </Text>
            <Text className="text-xs text-muted">
              {t("profile.signOutAllDevicesDescription")}
            </Text>
          </View>
          {isSigningOut && (
            <ActivityIndicator color={dangerColor} size="small" />
          )}
        </View>
      </PressableFeedback>

      {/* Delete Account */}
      <PressableFeedback
        className="mb-3 rounded-2xl border border-danger/30 bg-[#FFFBFF] p-4 opacity-50 dark:bg-[#3f324a]"
        isDisabled
      >
        <View className="flex-row items-center">
          <View className="mr-3 size-10 items-center justify-center rounded-lg bg-danger/10">
            <HugeiconsIcon color={dangerColor} icon={Delete02Icon} size={24} />
          </View>
          <View className="flex-1">
            <Text className="font-medium text-danger">
              {t("profile.deleteAccount")}
            </Text>
            <Text className="text-xs text-muted">
              {t("profile.deleteAccountDescription")}
            </Text>
          </View>
        </View>
      </PressableFeedback>
    </>
  )
}

/** App name and version footer pinned to the bottom of the scroll view. */
function AppInfoFooter() {
  return (
    <View className="mt-auto items-center pt-8">
      <BrandLockup size={24} wordmarkClassName="text-lg text-accent" />
      <Text className="mt-1 text-xs text-muted">
        v{Constants.expoConfig?.version}
      </Text>
    </View>
  )
}

interface SignOutDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

/** Confirmation dialog shown before signing out of all devices. */
function SignOutDialog({
  isOpen,
  onConfirm,
  onOpenChange
}: SignOutDialogProps) {
  const { t } = useTranslation()
  const dangerColor = useThemeColor("danger")

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <View className="mb-5 gap-1.5">
            <View className="mb-2 flex-row items-center gap-2">
              <HugeiconsIcon
                color={dangerColor}
                icon={Logout03Icon}
                size={20}
              />
              <Dialog.Title>{t("profile.signOutConfirmTitle")}</Dialog.Title>
            </View>
            <Dialog.Description>
              {t("profile.signOutConfirmDescription")}
            </Dialog.Description>
          </View>
          <View className="flex-row justify-end gap-3">
            <Button
              onPress={() => onOpenChange(false)}
              size="sm"
              variant="ghost"
            >
              <Text className="text-foreground">{t("common.cancel")}</Text>
            </Button>
            <Button className="bg-danger" onPress={onConfirm} size="sm">
              <Text className="text-white">{t("auth.signOut")}</Text>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

interface LanguageBottomSheetProps {
  currentLanguage: SupportedLanguage
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (lang: SupportedLanguage) => void
}

/** Bottom sheet listing supported languages with the active one highlighted. */
function LanguageBottomSheet({
  currentLanguage,
  isOpen,
  onOpenChange,
  onSelect
}: LanguageBottomSheetProps) {
  const { t } = useTranslation()
  const accentForegroundColor = useThemeColor("accent-foreground")

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <BottomSheet.Title className="mb-4 text-center text-lg font-semibold">
            {t("common.language")}
          </BottomSheet.Title>

          <View className="gap-1">
            {supportedLanguages.map((lang) => (
              <PressableFeedback
                className={cn(
                  "flex-row items-center justify-between rounded-xl px-4 py-3",
                  currentLanguage === lang ? "bg-accent" : "bg-transparent"
                )}
                key={lang}
                onPress={() => onSelect(lang)}
              >
                <PressableFeedback.Highlight />
                <Text
                  className={cn(
                    "text-base text-foreground",
                    currentLanguage === lang
                      ? "font-medium text-accent-foreground"
                      : "font-normal text-foreground"
                  )}
                >
                  {LANGUAGE_LABELS[lang]}
                </Text>
                {currentLanguage === lang && (
                  <HugeiconsIcon
                    color={accentForegroundColor}
                    icon={Tick02Icon}
                    size={24}
                    strokeWidth={2.5}
                  />
                )}
              </PressableFeedback>
            ))}
          </View>

          <View className="mt-4 gap-3">
            <PressableFeedback
              className="items-center rounded-xl bg-muted/20 py-3"
              onPress={() => onOpenChange(false)}
            >
              <PressableFeedback.Highlight />
              <Text className="font-medium text-foreground">
                {t("common.close")}
              </Text>
            </PressableFeedback>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  )
}
