import {
  ArrowLeft02Icon,
  Edit02Icon,
  LockPasswordIcon,
  Share01Icon,
  StarIcon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { Button, useThemeColor } from "heroui-native"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native"

import { Container } from "@/components/container"
import { EntryPasswordSheet } from "@/components/entry-password-sheet"
import type { EntryPasswordSheetRef } from "@/components/entry-password-sheet"
import { RichTextEditor, RichTextViewer } from "@/components/rich-text"
import { ShareSheet } from "@/components/share-sheet"
import type { ShareSheetRef } from "@/components/share-sheet"
import { useAppTheme } from "@/contexts/app-theme-context"
import { client, orpc, queryClient } from "@/utils/orpc"

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const { isDark } = useAppTheme()

  const foregroundColor = useThemeColor("foreground")
  const accentColor = useThemeColor("accent")
  const warningColor = useThemeColor("warning")

  // Sheet refs
  const shareSheetRef = useRef<ShareSheetRef>(null)
  const passwordSheetRef = useRef<EntryPasswordSheetRef>(null)

  // Handle share
  const handleShare = () => {
    shareSheetRef.current?.open()
  }

  // Handle password
  const handlePassword = () => {
    passwordSheetRef.current?.open()
  }

  // Fetch entry details
  const { data: entry, isLoading } = useQuery(
    orpc.entries.get.queryOptions({ input: { id: id ?? "" } })
  )

  // Update entry mutation
  const updateMutation = useMutation({
    mutationFn: (data: { contentJson?: string; contentText?: string }) =>
      client.entries.update({ id: id ?? "", ...data }),
    onSuccess: () => {
      // oRPC keys look like [["entries", "get"], { input }]; a plain
      // ["entries"] key matches none of them.
      queryClient.invalidateQueries({ queryKey: orpc.entries.key() })
    }
  })

  // Handle content change from editor
  const handleContentChange = (json: string, text: string) => {
    updateMutation.mutate({ contentJson: json, contentText: text })
    return Promise.resolve()
  }

  // Handle save
  const handleSave = () => {
    setIsEditing(false)
    return Promise.resolve()
  }

  // Toggle edit mode
  const toggleEdit = () => {
    setIsEditing((prev) => !prev)
  }

  // Go back
  const handleBack = () => {
    router.back()
  }

  if (isLoading) {
    return (
      <Container className="flex-1 items-center justify-center" disableTopInset>
        <ActivityIndicator color={accentColor} size="large" />
      </Container>
    )
  }

  if (!entry) {
    return (
      <Container className="flex-1 items-center justify-center" disableTopInset>
        <Text className="text-muted">{t("entry.notFound")}</Text>
      </Container>
    )
  }

  // Get content - prefer contentJson, fallback to content
  const contentJson = entry.contentJson ?? ""

  return (
    <>
      <Stack.Screen
        options={{
          title: entry.title ?? t("entry.untitled"),
          headerLeft: () => (
            <Pressable className="p-2" onPress={handleBack}>
              <HugeiconsIcon
                color={foregroundColor}
                icon={ArrowLeft02Icon}
                size={24}
              />
            </Pressable>
          ),
          headerRight: () => (
            <View className="flex-row items-center gap-2">
              {entry.isStarred && (
                <HugeiconsIcon color={warningColor} icon={StarIcon} size={20} />
              )}
              <Pressable className="p-2" onPress={handleShare}>
                <HugeiconsIcon
                  color={foregroundColor}
                  icon={Share01Icon}
                  size={24}
                />
              </Pressable>
              <Pressable className="p-2" onPress={handlePassword}>
                <HugeiconsIcon
                  color={foregroundColor}
                  icon={LockPasswordIcon}
                  size={24}
                />
              </Pressable>
              <Pressable className="p-2" onPress={toggleEdit}>
                <HugeiconsIcon
                  color={isEditing ? accentColor : foregroundColor}
                  icon={Edit02Icon}
                  size={24}
                />
              </Pressable>
            </View>
          )
        }}
      />

      <Container className="flex-1" disableScroll disableTopInset>
        {isEditing ? (
          <View style={{ flex: 1 }}>
            <RichTextEditor
              autoFocus
              content={contentJson}
              dom={{
                scrollEnabled: true,
                matchContents: false,
                style: { flex: 1 }
              }}
              editable
              isDark={isDark}
              onChange={handleContentChange}
              onSave={handleSave}
              placeholder={t("entry.placeholder")}
            />
            {updateMutation.isPending && (
              <View className="absolute right-4 bottom-4 flex-row items-center gap-2 rounded-full bg-surface px-3 py-1">
                <ActivityIndicator color={accentColor} size="small" />
                <Text className="text-xs text-muted">{t("common.saving")}</Text>
              </View>
            )}
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            // iOS: 自动调整内容偏移以适应透明 header (Liquid Glass)
            contentContainerStyle={{ flexGrow: 1 }}
            contentInsetAdjustmentBehavior="automatic"
          >
            {contentJson ? (
              <RichTextViewer content={contentJson} isDark={isDark} />
            ) : (
              <View className="flex-1 items-center justify-center p-8">
                <Text className="text-center text-muted">
                  {t("entry.emptyContent")}
                </Text>
                <Button
                  className="mt-4 bg-accent px-4 py-2"
                  onPress={toggleEdit}
                >
                  <Text className="font-medium text-foreground">
                    {t("entry.startWriting")}
                  </Text>
                </Button>
              </View>
            )}
          </ScrollView>
        )}
      </Container>

      {/* Share sheet */}
      <ShareSheet
        entryId={id ?? ""}
        entryTitle={entry.title ?? ""}
        ref={shareSheetRef}
      />

      {/* Password sheet */}
      <EntryPasswordSheet entryId={id ?? ""} ref={passwordSheetRef} />
    </>
  )
}
