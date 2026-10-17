import { ArrowRight01Icon, Rocket01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { PageContainer } from "@/components/page-container"
import { PageHeader } from "@/components/page-header"
import { Reveal } from "@/components/reveal"
import { Surface } from "@/components/surface"
import { getUserTimezoneOffset, REVIEW_RULES } from "@/constants"
import type { ReviewDashboardProps } from "@/types/review"
import { orpc } from "@/utils/orpc"

import { StatsContent } from "./stats-content"

/**
 * ReviewDashboard - Main dashboard for review feature
 */
export function ReviewDashboard({ onStartReview }: ReviewDashboardProps) {
  const { t } = useTranslation()
  const tzOffset = getUserTimezoneOffset()

  const {
    data: stats,
    isLoading: isLoadingStats,
    isError: isStatsError,
    error: statsError,
    refetch: refetchStats
  } = useQuery({
    queryKey: ["review", "stats", tzOffset],
    queryFn: () => orpc.review.getTodayStats.call({ tzOffset })
  })

  const { data: dueStats, isLoading: isLoadingDueStats } = useQuery({
    queryKey: ["review", "dueStats", tzOffset],
    queryFn: () => orpc.review.getDueStats.call({ tzOffset })
  })

  return (
    <PageContainer className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 hidden size-80 translate-x-1/3 -translate-y-1/4 rounded-full bg-linear-to-br from-primary/5 via-purple-500/4 to-transparent blur-3xl sm:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 hidden size-64 -translate-x-1/4 translate-y-1/4 rounded-full bg-linear-to-tr from-blue-500/4 via-cyan-500/3 to-transparent blur-3xl sm:block"
      />

      <PageHeader
        description={t("review.description")}
        icon={Rocket01Icon}
        title={t("nav.review")}
      />

      <Reveal
        className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        delay={60}
      >
        <StatsContent
          dueStats={dueStats}
          errorMessage={statsError?.message}
          isError={isStatsError}
          isLoading={isLoadingStats || isLoadingDueStats}
          onRetry={refetchStats}
          stats={stats}
        />
      </Reveal>

      <Reveal delay={120}>
        <h2 className="mb-4 font-display text-lg font-semibold">
          {t("review.selectMode")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {REVIEW_RULES.map(
            ({ key, labelKey, icon, descriptionKey }, index) => (
              <Reveal delay={150 + index * 60} key={key}>
                <Surface
                  aria-label={t(labelKey)}
                  className="group cursor-pointer p-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                  interactive
                  onClick={() => onStartReview(key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onStartReview(key)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
                        <HugeiconsIcon
                          className="size-5 text-primary"
                          icon={icon}
                        />
                      </span>
                      <h3 className="font-display text-base font-semibold">
                        {t(labelKey)}
                      </h3>
                    </div>
                    <HugeiconsIcon
                      aria-hidden="true"
                      className="size-5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
                      icon={ArrowRight01Icon}
                    />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t(descriptionKey)}
                  </p>
                </Surface>
              </Reveal>
            )
          )}
        </div>
      </Reveal>
    </PageContainer>
  )
}
