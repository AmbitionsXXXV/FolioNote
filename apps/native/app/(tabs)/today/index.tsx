import { getTzOffset } from "@folionote/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { router } from "expo-router"
import { useThemeColor } from "heroui-native"
import { useTranslation } from "react-i18next"
import { ActivityIndicator } from "react-native"

import { Container } from "@/components/container"
import { StreakCheckInCard } from "@/components/streak-check-in-card"
import { TodayContent } from "@/components/today-content"
import {
  LocalModeBanner,
  RecentEntriesSection
} from "@/components/today-home-sections"
import { useDataServiceContext } from "@/contexts/data-service-context"
import { useLocalMode } from "@/contexts/local-mode-context"
import { authClient } from "@/lib/auth-client"
import { orpc } from "@/utils/orpc"

/**
 * Today (the former Home merged in): greeting, the check-in stamp and daily
 * goal, today's review, quick stats and recent entries.
 */
export default function TodayScreen() {
  const { t } = useTranslation()
  const { data: session } = authClient.useSession()
  const { isLocalMode, disableLocalMode } = useLocalMode()
  const { dataService, isMigrating } = useDataServiceContext()
  const queryClient = useQueryClient()
  const accentColor = useThemeColor("accent")
  const mutedColor = useThemeColor("muted")
  const isSignedIn = !!session?.user

  const {
    data: todayStats,
    isLoading: isLoadingTodayStats,
    refetch: refetchTodayStats,
    isRefetching: isRefetchingTodayStats
  } = useQuery({
    queryKey: ["review", "todayStats"],
    queryFn: () => dataService?.review.getTodayStats(getTzOffset()),
    enabled: !!dataService
  })

  const {
    data: dueStats,
    isLoading: isLoadingDueStats,
    refetch: refetchDueStats,
    isRefetching: isRefetchingDueStats
  } = useQuery({
    queryKey: ["review", "dueStats"],
    queryFn: () => dataService?.review.getDueStats(getTzOffset()),
    enabled: !!dataService
  })

  const { data: recentData, isLoading: isLoadingRecent } = useQuery({
    ...orpc.entries.list.queryOptions({ input: { filter: "all", limit: 4 } }),
    enabled: isSignedIn
  })

  const handleRefresh = () => {
    refetchTodayStats()
    refetchDueStats()
    queryClient.invalidateQueries({ queryKey: orpc.streak.key() })
    queryClient.invalidateQueries({ queryKey: orpc.entries.list.key() })
  }

  const handleSignIn = async () => {
    await disableLocalMode()
    router.replace("/(auth)/sign-in")
  }

  // Show loading while migrating or loading data
  const isLoading =
    isMigrating || isLoadingTodayStats || isLoadingDueStats || !dataService
  if (isLoading) {
    return (
      <Container className="flex-1 items-center justify-center">
        <ActivityIndicator color={accentColor} size="large" />
      </Container>
    )
  }

  const isRefetching = isRefetchingTodayStats || isRefetchingDueStats
  const userName = session?.user?.name?.split(" ")[0] ?? t("common.other")
  const recentEntries = recentData?.items?.filter((e) => !e.isInbox) ?? []

  return (
    <Container className="flex-1" disableScroll disableTopInset>
      <TodayContent
        dueToday={dueStats?.dueToday ?? 0}
        footer={
          isSignedIn ? (
            <RecentEntriesSection
              accentColor={accentColor}
              entries={recentEntries}
              isLoading={isLoadingRecent}
              mutedColor={mutedColor}
              onViewAll={() => router.navigate("/inbox")}
              t={t}
            />
          ) : null
        }
        header={
          <>
            {isLocalMode && !isSignedIn && (
              <LocalModeBanner
                accentColor={accentColor}
                onSignIn={handleSignIn}
                t={t}
              />
            )}
            <StreakCheckInCard enabled={isSignedIn} />
          </>
        }
        isRefetching={isRefetching}
        newCount={dueStats?.newCount ?? 0}
        onRefresh={handleRefresh}
        onStartReview={() => router.navigate("/review")}
        overdue={dueStats?.overdue ?? 0}
        reviewedToday={todayStats?.reviewedToday ?? 0}
        starredEntries={todayStats?.starredEntries ?? 0}
        // The check-in card shows the streak when signed in; the header
        // badge is the offline / local-mode fallback.
        streak={isSignedIn ? 0 : (todayStats?.streak ?? 0)}
        totalEntries={todayStats?.totalEntries ?? 0}
        unreviewedEntries={todayStats?.unreviewedEntries ?? 0}
        userName={userName}
      />
    </Container>
  )
}
