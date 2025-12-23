import { Link, Stack } from 'expo-router'
import { Button, Card } from 'heroui-native'
import { Text, View } from 'react-native'
import { Container } from '@/components/container'

export default function NotFoundScreen() {
	return (
		<>
			<Stack.Screen options={{ title: 'Oops!' }} />
			<Container>
				<View className="flex-1 items-center justify-center p-6">
					<Card className="max-w-md items-center p-8" variant="secondary">
						<Text className="mb-4 text-6xl">🤔</Text>
						<Card.Title className="mb-2 text-center text-2xl">
							Page Not Found
						</Card.Title>
						<Card.Description className="mb-6 text-center">
							Sorry, the page you're looking for doesn't exist.
						</Card.Description>
						<Link asChild href="/(tabs)/index">
							<Button className="bg-accent active:opacity-70">
								<Text className="font-medium text-accent-foreground text-base">
									Go to Home
								</Text>
							</Button>
						</Link>
					</Card>
				</View>
			</Container>
		</>
	)
}
