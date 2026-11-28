import { Link, Redirect, Stack } from "expo-router"
import { Button, Card } from "heroui-native"
import { Text, View } from "react-native"

import { Container } from "@/components/container"
import { useLocalMode } from "@/contexts/local-mode-context"
import { authClient } from "@/lib/auth-client"

export default function NotFoundScreen() {
  const { data: session, isPending } = authClient.useSession()
  const { isLocalMode, isLoading } = useLocalMode()
  const isSignedOut = !(isPending || isLoading || session?.user || isLocalMode)
  // Signed out, "/" points into the guarded tabs: start at onboarding
  // (which itself forwards to sign-in once it has been seen).
  if (isSignedOut) {
    return <Redirect href="/(auth)/onboarding" />
  }

  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
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
            <Link asChild href="/(tabs)/today">
              <Button className="bg-accent active:opacity-70">
                <Text className="text-base font-medium text-accent-foreground">
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
