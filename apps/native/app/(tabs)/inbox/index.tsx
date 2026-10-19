import { Add01Icon, MailOpen01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { FlashList } from "@shopify/flash-list"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Button,
  Card,
  cn,
  Input,
  TextField,
  useThemeColor
} from "heroui-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ActivityIndicator, RefreshControl, Text, View } from "react-native"

import { Container } from "@/components/container"
import { EntryCard } from "@/components/entry-card"
import { useDataServiceContext } from "@/contexts/data-service-context"

interface QuickCaptureProps {
  onCapture: (value: string) => void
  isPending: boolean
}

function QuickCapture({ onCapture, isPending }: QuickCaptureProps) {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState("")
  const foregroundColor = useThemeColor("foreground")

  const handleSubmit = () => {
    const trimmedValue = inputValue.trim()
    if (trimmedValue) {
      onCapture(trimmedValue)
      setInputValue("")
    }
  }

  return (
    <Card className="p-4" variant="secondary">
      <View className="flex-row items-center">
        <TextField className="mr-3 flex-1">
          <Input
            onChangeText={setInputValue}
            onSubmitEditing={handleSubmit}
            placeholder={t("entry.quickCapture")}
            returnKeyType="done"
            value={inputValue}
          />
        </TextField>
        <Button
          className={cn(
            "size-12 items-center justify-center bg-accent active:opacity-70",
            (!inputValue.trim() || isPending) && "opacity-50"
          )}
          isDisabled={!inputValue.trim() || isPending}
          onPress={handleSubmit}
        >
          {isPending ? (
            <ActivityIndicator color={foregroundColor} size="small" />
          ) : (
            <HugeiconsIcon color={foregroundColor} icon={Add01Icon} size={24} />
          )}
        </Button>
      </View>
    </Card>
  )
}

export default function InboxScreen() {
  const { t } = useTranslation()
  const { dataService, isMigrating } = useDataServiceContext()
  const queryClient = useQueryClient()
  const mutedColor = useThemeColor("muted")
  const accentColor = useThemeColor("accent")

  // Fetch inbox entries using DataService
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["entries", "list", "inbox"],
    queryFn: () => dataService?.entries.list({ filter: "inbox", limit: 50 }),
    enabled: !!dataService
  })

  // Create entry mutation using DataService
  const createEntryMutation = useMutation({
    mutationFn: (title: string) => {
      if (!dataService) {
        throw new Error("DataService not available")
      }
      return dataService.entries.create({ title, isInbox: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries", "list"] })
    }
  })

  const handleCapture = (text: string) => {
    createEntryMutation.mutate(text)
  }

  const entries = data?.items ?? []

  // Show loading while migrating or loading data
  if (isMigrating || isLoading || !dataService) {
    return (
      <Container className="flex-1 items-center justify-center" disableTopInset>
        <ActivityIndicator color={accentColor} size="large" />
      </Container>
    )
  }

  return (
    <Container className="flex-1" disableScroll disableTopInset>
      <FlashList
        contentContainerStyle={{
          paddingHorizontal: 16
        }}
        // iOS: 自动调整内容偏移以适应透明 header (Liquid Glass)
        contentInsetAdjustmentBehavior="automatic"
        data={entries}
        ItemSeparatorComponent={() => <View className="h-3" />}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center py-20">
            <HugeiconsIcon color={mutedColor} icon={MailOpen01Icon} size={64} />
            <Text className="mt-4 text-center text-lg text-muted">
              {t("entry.emptyInbox")}
            </Text>
            <Text className="mt-2 px-8 text-center text-sm text-muted">
              {t("home.actionDescription.newEntry")}
            </Text>
          </View>
        )}
        ListHeaderComponent={() => (
          <View className="mb-4">
            <QuickCapture
              isPending={createEntryMutation.isPending}
              onCapture={handleCapture}
            />

            {entries.length > 0 && (
              <Text className="mt-4 text-sm text-muted">
                {t("entry.count", { count: entries.length })}
              </Text>
            )}
          </View>
        )}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              refetch()
            }}
            refreshing={isRefetching}
            tintColor={accentColor}
          />
        }
        renderItem={({ item }) => <EntryCard entry={item} />}
      />
    </Container>
  )
}
