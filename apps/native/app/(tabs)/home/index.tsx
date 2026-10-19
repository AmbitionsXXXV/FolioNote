import { formatDate } from "@folionote/locales"
import { getGreetingKey, getTzOffset } from "@folionote/utils"
import {
  ArrowRight01Icon,
  BookOpen01Icon,
  CloudIcon,
  InboxIcon,
  LanguageSkillIcon,
  NoteIcon,
  Rocket01Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useQuery } from "@tanstack/react-query"
import { router } from "expo-router"
import { Button, Card, PressableFeedback, useThemeColor } from "heroui-native"
import type { ComponentProps, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from "react-native"

import { BrandLockup } from "@/components/brand-lockup"
import { Container } from "@/components/container"
import { EntryCard } from "@/components/entry-card"
import { useLocalMode } from "@/contexts/local-mode-context"
import { authClient } from "@/lib/auth-client"
import { orpc } from "@/utils/orpc"

type TranslateFn = ReturnType<typeof useTranslation>["t"]
type SessionUser = NonNullable<
  ReturnType<typeof authClient.useSession>["data"]
>["user"]
type HugeIcon = ComponentProps<typeof HugeiconsIcon>["icon"]

interface RecentEntry {
  id: string
  title: string | null
  contentText: string | null
  isStarred: boolean | null
  isPinned: boolean | null
  isInbox: boolean | null
  createdAt: Date
  updatedAt: Date
}

interface RecentEntriesContentProps {
  entries: RecentEntry[]
  isLoading: boolean
  accentColor: string
  mutedColor: string
  t: (key: string) => string
}

/**
 * Recent entries content component
 */
function RecentEntriesContent({
  entries,
  isLoading,
  accentColor,
  mutedColor,
  t
}: RecentEntriesContentProps) {
  if (isLoading) {
    return (
      <View className="items-center py-8">
        <ActivityIndicator color={accentColor} />
      </View>
    )
  }

  if (entries.length === 0) {
    return (
      <Card className="p-6" variant="secondary">
        <View className="items-center">
          <HugeiconsIcon color={mutedColor} icon={NoteIcon} size={48} />
          <Text className="mt-3 text-center text-muted">
            {t("activity.noRecentEntries")}
          </Text>
          <Text className="mt-1 text-center text-sm text-muted">
            {t("activity.startCapturing")}
          </Text>
        </View>
      </Card>
    )
  }

  return (
    <View className="gap-3">
      {entries.map((entry) => (
        <EntryCard entry={entry} key={entry.id} />
      ))}
    </View>
  )
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation()
  const { data: session } = authClient.useSession()
  const { isLocalMode, disableLocalMode } = useLocalMode()
  const {
    data: healthData,
    isLoading: isHealthLoading,
    refetch: refetchHealth
  } = useQuery(orpc.healthCheck.queryOptions())

  const accentColor = useThemeColor("accent")
  const mutedColor = useThemeColor("muted")
  const successColor = useThemeColor("success")
  const warningColor = useThemeColor("warning")

  const handleSignIn = async () => {
    await disableLocalMode()
    router.replace("/(auth)/sign-in")
  }

  // Fetch due stats if logged in
  const {
    data: dueStats,
    isLoading: isLoadingStats,
    refetch: refetchStats,
    isRefetching: isRefetchingStats
  } = useQuery({
    ...orpc.review.getDueStats.queryOptions({
      input: { tzOffset: getTzOffset() }
    }),
    enabled: !!session?.user
  })

  // Fetch recent entries
  const {
    data: recentData,
    isLoading: isLoadingRecent,
    refetch: refetchRecent
  } = useQuery({
    ...orpc.entries.list.queryOptions({ input: { filter: "all", limit: 4 } }),
    enabled: !!session?.user
  })

  // Fetch today stats for total entries count
  const { data: todayStats, isLoading: isLoadingTodayStats } = useQuery({
    ...orpc.review.getTodayStats.queryOptions({
      input: { tzOffset: getTzOffset() }
    }),
    enabled: !!session?.user
  })

  // Fetch inbox count
  const { data: inboxData, isLoading: isLoadingInbox } = useQuery({
    ...orpc.entries.list.queryOptions({ input: { filter: "inbox", limit: 1 } }),
    enabled: !!session?.user,
    select: (data) => ({
      count: data.items.length,
      hasMore: data.hasMore
    })
  })

  const isConnected = healthData === "OK"
  const isLoading = isHealthLoading

  const handleRefresh = () => {
    refetchHealth()
    if (session?.user) {
      refetchStats()
      refetchRecent()
    }
  }

  const navigateToInbox = () => {
    router.push("/inbox" as never)
  }

  const navigateToLibrary = () => {
    router.push("/today" as never)
  }

  const navigateToReview = () => {
    router.push("/review" as never)
  }

  const navigateToJapanese = () => {
    router.push("/japanese")
  }

  const totalDue = (dueStats?.overdue ?? 0) + (dueStats?.dueToday ?? 0)
  const recentEntries = recentData?.items?.filter((e) => !e.isInbox) ?? []
  const greetingKey = getGreetingKey()

  return (
    <Container className="flex-1" disableScroll disableTopInset>
      <ScrollView
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            onRefresh={handleRefresh}
            refreshing={isRefetchingStats}
            tintColor={accentColor}
          />
        }
      >
        <HomeHeader
          greetingKey={greetingKey}
          isConnected={isConnected}
          isLoading={isLoading}
          language={i18n.language}
          onReviewPress={navigateToReview}
          t={t}
          totalDue={totalDue}
          user={session?.user}
        />

        {isLocalMode && !session?.user && (
          <LocalModeBanner
            accentColor={accentColor}
            onSignIn={handleSignIn}
            t={t}
          />
        )}

        {session?.user && (
          <RecentEntriesSection
            accentColor={accentColor}
            entries={recentEntries}
            isLoading={isLoadingRecent}
            mutedColor={mutedColor}
            onViewAll={navigateToLibrary}
            t={t}
          />
        )}

        <QuickAccessSection
          accentColor={accentColor}
          inboxData={inboxData}
          isLoadingInbox={isLoadingInbox}
          isLoadingStats={isLoadingStats}
          isLoadingTodayStats={isLoadingTodayStats}
          mutedColor={mutedColor}
          onInbox={navigateToInbox}
          onJapanese={navigateToJapanese}
          onLibrary={navigateToLibrary}
          onReview={navigateToReview}
          successColor={successColor}
          t={t}
          todayStats={todayStats}
          totalDue={totalDue}
          warningColor={warningColor}
        />

        {/* Loading indicator for stats */}
        {session?.user && isLoadingStats && (
          <View className="items-center py-4">
            <ActivityIndicator color={accentColor} />
          </View>
        )}
      </ScrollView>
    </Container>
  )
}

interface HomeHeaderProps {
  user: SessionUser | undefined
  greetingKey: string
  totalDue: number
  isConnected: boolean
  isLoading: boolean
  language: string
  onReviewPress: () => void
  t: TranslateFn
}

/**
 * Greeting header for logged-in users, or brand + connection status otherwise.
 */
function HomeHeader({
  user,
  greetingKey,
  totalDue,
  isConnected,
  isLoading,
  language,
  onReviewPress,
  t
}: HomeHeaderProps) {
  return (
    <View className="mb-6">
      {user ? (
        <>
          <Text className="mb-1 text-2xl font-bold text-foreground">
            {t(`activity.${greetingKey}`, { name: user.name })}
          </Text>
          <Text className="text-muted">
            {formatDate(new Date(), {
              locale: language,
              options: { weekday: "long", month: "long", day: "numeric" }
            })}
          </Text>
          {totalDue > 0 && (
            <Pressable
              className="mt-2 flex-row items-center"
              onPress={onReviewPress}
            >
              <Text className="text-sm">
                {t("activity.reviewReminder", { count: totalDue })}
              </Text>
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
            </Pressable>
          )}
        </>
      ) : (
        <>
          <BrandLockup
            className="mb-2"
            size={40}
            wordmarkClassName="text-3xl text-foreground"
          />
          <View className="flex-row items-center">
            <View
              className={`mr-2 h-2 w-2 rounded-full ${isConnected ? "bg-success" : "bg-danger"}`}
            />
            <Text className="text-sm text-muted">
              {(() => {
                if (isLoading) {
                  return t("home.connecting")
                }
                if (isConnected) {
                  return t("home.systemReady")
                }
                return t("home.offline")
              })()}
            </Text>
          </View>
        </>
      )}
    </View>
  )
}

interface LocalModeBannerProps {
  accentColor: string
  onSignIn: () => void
  t: TranslateFn
}

/**
 * Banner prompting local-mode users to sign in.
 */
function LocalModeBanner({ accentColor, onSignIn, t }: LocalModeBannerProps) {
  return (
    <Card
      className="mb-4 border border-accent-soft-hover bg-accent/5 p-4"
      variant="secondary"
    >
      <View className="flex-row items-center">
        <View className="mr-3 size-10 items-center justify-center rounded-full bg-accent/10">
          <HugeiconsIcon color={accentColor} icon={CloudIcon} size={20} />
        </View>
        <View className="flex-1">
          <Text className="font-medium text-foreground">
            {t("onboarding.localModeTitle")}
          </Text>
          <Text className="text-xs text-muted">
            {t("onboarding.localModeHint")}
          </Text>
        </View>
        <Button
          className="bg-accent px-3 py-2 active:opacity-70"
          onPress={onSignIn}
        >
          <Text className="text-xs font-medium text-white">
            {t("auth.signIn")}
          </Text>
        </Button>
      </View>
    </Card>
  )
}

interface RecentEntriesSectionProps {
  entries: RecentEntry[]
  isLoading: boolean
  accentColor: string
  mutedColor: string
  onViewAll: () => void
  t: TranslateFn
}

/**
 * Recent entries section with header and content.
 */
function RecentEntriesSection({
  entries,
  isLoading,
  accentColor,
  mutedColor,
  onViewAll,
  t
}: RecentEntriesSectionProps) {
  return (
    <View className="mb-6">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-foreground">
          {t("activity.recentEntries")}
        </Text>
        <Pressable className="flex-row items-center" onPress={onViewAll}>
          <Text className="mr-1 text-sm text-muted">
            {t("activity.viewAll")}
          </Text>
          <HugeiconsIcon color={mutedColor} icon={ArrowRight01Icon} size={16} />
        </Pressable>
      </View>

      <RecentEntriesContent
        accentColor={accentColor}
        entries={entries}
        isLoading={isLoading}
        mutedColor={mutedColor}
        t={t}
      />
    </View>
  )
}

interface QuickAccessCardProps {
  onPress: () => void
  iconWrapperClassName: string
  iconColor: string
  icon: HugeIcon
  title: string
  subtitle: ReactNode
  mutedColor: string
}

/**
 * Single quick-access row card (inbox, library, review).
 */
function QuickAccessCard({
  onPress,
  iconWrapperClassName,
  iconColor,
  icon,
  title,
  subtitle,
  mutedColor
}: QuickAccessCardProps) {
  return (
    <PressableFeedback onPress={onPress}>
      <PressableFeedback.Highlight />
      <Card className="p-4" variant="secondary">
        <View className="flex-row items-center">
          <View className={iconWrapperClassName}>
            <HugeiconsIcon color={iconColor} icon={icon} size={24} />
          </View>
          <View className="flex-1">
            <Text className="font-medium text-foreground">{title}</Text>
            <Text className="text-sm text-muted">{subtitle}</Text>
          </View>
          <HugeiconsIcon color={mutedColor} icon={ArrowRight01Icon} size={20} />
        </View>
      </Card>
    </PressableFeedback>
  )
}

interface QuickAccessSectionProps {
  accentColor: string
  mutedColor: string
  successColor: string
  warningColor: string
  isLoadingInbox: boolean
  inboxData: { count: number; hasMore: boolean } | undefined
  isLoadingTodayStats: boolean
  todayStats: { totalEntries: number } | undefined
  isLoadingStats: boolean
  totalDue: number
  onInbox: () => void
  onJapanese: () => void
  onLibrary: () => void
  onReview: () => void
  t: TranslateFn
}

/**
 * Quick access shortcuts to inbox, library, review, and Japanese study.
 */
function QuickAccessSection({
  accentColor,
  mutedColor,
  successColor,
  warningColor,
  isLoadingInbox,
  inboxData,
  isLoadingTodayStats,
  todayStats,
  isLoadingStats,
  totalDue,
  onInbox,
  onJapanese,
  onLibrary,
  onReview,
  t
}: QuickAccessSectionProps) {
  return (
    <View>
      <Text className="mb-3 text-lg font-semibold text-foreground">
        {t("activity.quickAccess")}
      </Text>

      <View className="gap-3">
        <QuickAccessCard
          icon={InboxIcon}
          iconColor={accentColor}
          iconWrapperClassName="mr-3 size-12 items-center justify-center rounded-lg bg-accent/10"
          mutedColor={mutedColor}
          onPress={onInbox}
          subtitle={
            isLoadingInbox ? (
              "..."
            ) : (
              <>
                {t("activity.inboxCount", {
                  count: inboxData?.count ?? 0
                })}
                {inboxData?.hasMore ? "+" : ""}
              </>
            )
          }
          title={t("nav.inbox")}
        />

        <QuickAccessCard
          icon={BookOpen01Icon}
          iconColor={successColor}
          iconWrapperClassName="mr-3 size-12 items-center justify-center rounded-lg bg-success/10"
          mutedColor={mutedColor}
          onPress={onLibrary}
          subtitle={
            isLoadingTodayStats
              ? "..."
              : t("activity.libraryCount", {
                  count: todayStats?.totalEntries ?? 0
                })
          }
          title={t("nav.library")}
        />

        <QuickAccessCard
          icon={Rocket01Icon}
          iconColor={warningColor}
          iconWrapperClassName="mr-3 size-12 items-center justify-center rounded-lg bg-warning/10"
          mutedColor={mutedColor}
          onPress={onReview}
          subtitle={
            isLoadingStats ? "..." : t("activity.dueCount", { count: totalDue })
          }
          title={t("nav.review")}
        />

        <QuickAccessCard
          icon={LanguageSkillIcon}
          iconColor={accentColor}
          iconWrapperClassName="mr-3 size-12 items-center justify-center rounded-lg bg-accent/10"
          mutedColor={mutedColor}
          onPress={onJapanese}
          subtitle={t("japanese.entry.subtitle")}
          title={t("japanese.entry.title")}
        />
      </View>
    </View>
  )
}
