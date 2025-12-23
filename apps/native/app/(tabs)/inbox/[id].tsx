import { ArrowLeft02Icon, Edit02Icon, StarIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Button, useThemeColor } from 'heroui-native'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { Container } from '@/components/container'
import { RichTextEditor, RichTextViewer } from '@/components/rich-text'
import { client, orpc, queryClient } from '@/utils/orpc'

export default function EntryDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const router = useRouter()
	const { t } = useTranslation()
	const [isEditing, setIsEditing] = useState(false)

	const foregroundColor = useThemeColor('foreground')
	const accentColor = useThemeColor('accent')
	const warningColor = useThemeColor('warning')

	// Fetch entry details
	const { data: entry, isLoading } = useQuery(
		orpc.entries.get.queryOptions({ input: { id: id ?? '' } })
	)

	// Update entry mutation
	const updateMutation = useMutation({
		mutationFn: (data: { contentJson?: string; contentText?: string }) =>
			client.entries.update({ id: id ?? '', ...data }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['entries'] })
		},
	})

	// Handle content change from editor
	const handleContentChange = useCallback(
		(json: string, text: string) => {
			updateMutation.mutate({ contentJson: json, contentText: text })
			return Promise.resolve()
		},
		[updateMutation]
	)

	// Handle save
	const handleSave = useCallback(() => {
		setIsEditing(false)
		return Promise.resolve()
	}, [])

	// Toggle edit mode
	const toggleEdit = useCallback(() => {
		setIsEditing((prev) => !prev)
	}, [])

	// Go back
	const handleBack = useCallback(() => {
		router.back()
	}, [router])

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
				<Text className="text-muted">{t('entry.notFound')}</Text>
			</Container>
		)
	}

	// Get content - prefer contentJson, fallback to content
	const contentJson = entry.contentJson ?? ''

	return (
		<>
			<Stack.Screen
				options={{
					title: entry.title ?? t('entry.untitled'),
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
							<Pressable className="p-2" onPress={toggleEdit}>
								<HugeiconsIcon
									color={isEditing ? accentColor : foregroundColor}
									icon={Edit02Icon}
									size={24}
								/>
							</Pressable>
						</View>
					),
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
								style: { flex: 1 },
							}}
							editable
							isDark
							onChange={handleContentChange}
							onSave={handleSave}
							placeholder={t('entry.placeholder')}
						/>
						{updateMutation.isPending && (
							<View className="absolute right-4 bottom-4 flex-row items-center gap-2 rounded-full bg-surface px-3 py-1">
								<ActivityIndicator color={accentColor} size="small" />
								<Text className="text-muted text-xs">{t('common.saving')}</Text>
							</View>
						)}
					</View>
				) : (
					<ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
						{contentJson ? (
							<RichTextViewer
								content={contentJson}
								dom={{
									scrollEnabled: false,
								}}
								isDark
							/>
						) : (
							<View className="flex-1 items-center justify-center p-8">
								<Text className="text-center text-muted">
									{t('entry.emptyContent')}
								</Text>
								<Button className="mt-4 bg-accent px-4 py-2" onPress={toggleEdit}>
									<Text className="font-medium text-foreground">
										{t('entry.startWriting')}
									</Text>
								</Button>
							</View>
						)}
					</ScrollView>
				)}
			</Container>
		</>
	)
}
