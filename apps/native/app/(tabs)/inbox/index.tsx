import { Add01Icon, MailOpen01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react-native'
import { FlashList } from '@shopify/flash-list'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Card, useThemeColor } from 'heroui-native'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	Text,
	TextInput,
	View,
} from 'react-native'
import { Container } from '@/components/container'
import { EntryCard } from '@/components/entry-card'
import { client, orpc, queryClient } from '@/utils/orpc'

export default function InboxScreen() {
	const { t } = useTranslation()
	const [quickCaptureText, setQuickCaptureText] = useState('')
	const mutedColor = useThemeColor('muted')
	const foregroundColor = useThemeColor('foreground')
	const accentColor = useThemeColor('accent')

	// Fetch inbox entries
	const { data, isLoading, isRefetching, refetch } = useQuery(
		orpc.entries.list.queryOptions({ input: { filter: 'inbox', limit: 50 } })
	)

	// Create entry mutation
	const createEntryMutation = useMutation({
		mutationFn: (title: string) => client.entries.create({ title, isInbox: true }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['entries', 'list'] })
			setQuickCaptureText('')
		},
	})

	const handleQuickCapture = useCallback(() => {
		const trimmedText = quickCaptureText.trim()
		if (trimmedText) {
			createEntryMutation.mutate(trimmedText)
		}
	}, [quickCaptureText, createEntryMutation])

	const entries = data?.items ?? []

	const renderItem = useCallback(
		({ item }: { item: (typeof entries)[0] }) => <EntryCard entry={item} />,
		[]
	)

	const renderHeader = useCallback(
		() => (
			<View className="mb-4">
				{/* Quick Capture */}
				<Card className="p-4" variant="secondary">
					<View className="flex-row items-center">
						<TextInput
							className="mr-3 flex-1 rounded-lg border border-divider bg-surface px-4 py-3 text-foreground"
							onChangeText={setQuickCaptureText}
							onSubmitEditing={handleQuickCapture}
							placeholder={t('entry.quickCapture')}
							placeholderTextColor={mutedColor}
							returnKeyType="done"
							value={quickCaptureText}
						/>
						<Pressable
							className="h-12 w-12 items-center justify-center rounded-lg bg-accent active:opacity-70"
							disabled={!quickCaptureText.trim() || createEntryMutation.isPending}
							onPress={handleQuickCapture}
							style={{
								opacity:
									!quickCaptureText.trim() || createEntryMutation.isPending
										? 0.5
										: 1,
							}}
						>
							{createEntryMutation.isPending ? (
								<ActivityIndicator color={foregroundColor} size="small" />
							) : (
								<HugeiconsIcon color={foregroundColor} icon={Add01Icon} size={24} />
							)}
						</Pressable>
					</View>
				</Card>

				{/* Entry count */}
				{entries.length > 0 && (
					<Text className="mt-4 text-muted text-sm">
						{t('entry.count', { count: entries.length })}
					</Text>
				)}
			</View>
		),
		[
			quickCaptureText,
			handleQuickCapture,
			createEntryMutation.isPending,
			entries.length,
			t,
			mutedColor,
			foregroundColor,
		]
	)

	const renderEmpty = useCallback(
		() => (
			<View className="flex-1 items-center justify-center py-20">
				<HugeiconsIcon color={mutedColor} icon={MailOpen01Icon} size={64} />
				<Text className="mt-4 text-center text-lg text-muted">
					{t('entry.emptyInbox')}
				</Text>
				<Text className="mt-2 px-8 text-center text-muted text-sm">
					{t('home.actionDescription.newEntry')}
				</Text>
			</View>
		),
		[t, mutedColor]
	)

	const renderFooter = useCallback(() => null, [])

	if (isLoading) {
		return (
			<Container className="flex-1 items-center justify-center">
				<ActivityIndicator color={accentColor} size="large" />
			</Container>
		)
	}

	return (
		<Container className="flex-1" disableScroll>
			<FlashList
				contentContainerStyle={{ padding: 16, flexGrow: 1 }}
				data={entries}
				ItemSeparatorComponent={() => <View className="h-3" />}
				keyExtractor={(item) => item.id}
				ListEmptyComponent={renderEmpty}
				ListFooterComponent={renderFooter}
				ListHeaderComponent={renderHeader}
				refreshControl={
					<RefreshControl
						onRefresh={refetch}
						refreshing={isRefetching}
						tintColor={accentColor}
					/>
				}
				renderItem={renderItem}
			/>
		</Container>
	)
}
