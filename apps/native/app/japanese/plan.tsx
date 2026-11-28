import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PressableFeedback, Switch, useThemeColor } from "heroui-native"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Alert, ScrollView, Text, View } from "react-native"

import { hasOnlyBasicJapaneseVoice } from "@/lib/japanese-speech"
import { loadSpeechPrefs, saveSpeechPrefs } from "@/lib/japanese/pronounce"
import type { SpeechPrefs } from "@/lib/japanese/pronounce"
import { getDeviceTimeZone } from "@/lib/study-day"
import { orpc } from "@/utils/orpc"

const NEW_WORD_OPTIONS = [5, 10, 15, 20, 30] as const
const REVIEW_LIMIT_OPTIONS = [null, 100, 200] as const

function Choices<T extends number | null>({
  label,
  options,
  value,
  format,
  onChange
}: {
  label: string
  options: readonly T[]
  value: T | undefined
  format: (option: T) => string
  onChange: (option: T) => void
}) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="radiogroup"
      className="flex-row gap-1.5"
    >
      {options.map((option) => {
        const selected = option === value
        return (
          <PressableFeedback
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            className={`h-10 flex-1 items-center justify-center rounded-xl ${selected ? "bg-accent/15" : "bg-default"}`}
            key={String(option)}
            onPress={() => onChange(option)}
          >
            <Text
              className={`text-[15px] font-semibold ${selected ? "text-accent" : "text-foreground"}`}
            >
              {format(option)}
            </Text>
          </PressableFeedback>
        )
      })}
    </View>
  )
}

function ToggleRow({
  title,
  hint,
  value,
  last,
  onChange
}: {
  title: string
  hint: string
  value: boolean
  last?: boolean
  onChange: (value: boolean) => void
}) {
  const muted = useThemeColor("muted")
  const success = useThemeColor("success")
  return (
    <View
      className={`ml-4 min-h-14 flex-row items-center gap-3 py-1.5 pr-4 ${last ? "" : "border-b-[0.5px] border-border"}`}
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-base text-foreground">{title}</Text>
        <Text className="text-[13px] text-muted">{hint}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        animation={{ backgroundColor: { value: [muted, success] } }}
        isSelected={value}
        onSelectedChange={onChange}
      />
    </View>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mx-1 -mb-1.5 mt-1 text-[13px] font-semibold text-muted">
      {children}
    </Text>
  )
}

/** Sheet for the daily plan (shared with the web) and this phone's speech settings. */
export default function DailyPlanSheet() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const timeZone = getDeviceTimeZone()
  const plan = useQuery(
    orpc.japanese.study.plan.queryOptions({ input: { timeZone } })
  )
  const [prefs, setPrefs] = useState<SpeechPrefs>(loadSpeechPrefs)
  const [basicVoiceOnly, setBasicVoiceOnly] = useState(false)

  useEffect(() => {
    hasOnlyBasicJapaneseVoice()
      .then(setBasicVoiceOnly)
      .catch(() => undefined)
  }, [])

  const update = useMutation(
    orpc.japanese.study.updatePlan.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: orpc.japanese.study.key() }),
      onError: () => {
        Alert.alert(t("common.error"), t("japanese.daily.plan.saveFailed"))
      }
    })
  )

  const changePrefs = (change: Partial<SpeechPrefs>) => {
    const next = { ...prefs, ...change }
    setPrefs(next)
    saveSpeechPrefs(next)
  }

  // Show the choice right away; the server confirms in the background.
  const dailyNewWords =
    update.variables?.dailyNewWords ?? plan.data?.dailyNewWords
  const dailyReviewLimit =
    update.variables?.dailyReviewLimit === undefined
      ? plan.data?.dailyReviewLimit
      : update.variables.dailyReviewLimit

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, gap: 14 }}
    >
      <SectionLabel>{t("japanese.daily.plan.newWords")}</SectionLabel>
      <Choices
        format={String}
        label={t("japanese.daily.plan.newWords")}
        onChange={(option) => update.mutate({ dailyNewWords: option })}
        options={NEW_WORD_OPTIONS}
        value={dailyNewWords as (typeof NEW_WORD_OPTIONS)[number] | undefined}
      />
      <SectionLabel>{t("japanese.daily.plan.reviewLimit")}</SectionLabel>
      <Choices
        format={(option) =>
          option === null ? t("japanese.daily.plan.unlimited") : String(option)
        }
        label={t("japanese.daily.plan.reviewLimit")}
        onChange={(option) => update.mutate({ dailyReviewLimit: option })}
        options={REVIEW_LIMIT_OPTIONS}
        value={
          dailyReviewLimit as (typeof REVIEW_LIMIT_OPTIONS)[number] | undefined
        }
      />
      <Text className="-mt-1.5 px-1 text-xs leading-[18px] text-muted">
        {t("japanese.daily.plan.order")}
      </Text>

      <View className="overflow-hidden rounded-3xl bg-surface">
        <ToggleRow
          hint={t("japanese.daily.plan.autoSpeakHint")}
          onChange={(value) => changePrefs({ autoSpeak: value })}
          title={t("japanese.daily.plan.autoSpeak")}
          value={prefs.autoSpeak}
        />
        <ToggleRow
          hint={t("japanese.daily.plan.slowHint")}
          onChange={(value) => changePrefs({ slow: value })}
          title={t("japanese.daily.plan.slow")}
          value={prefs.slow}
        />
        <ToggleRow
          hint={t("japanese.daily.plan.exampleHint")}
          last
          onChange={(value) => changePrefs({ speakExample: value })}
          title={t("japanese.daily.plan.example")}
          value={prefs.speakExample}
        />
      </View>

      {basicVoiceOnly ? (
        <View className="gap-1 rounded-3xl bg-surface p-4">
          <Text className="text-base font-semibold text-foreground">
            {t("japanese.daily.plan.betterVoice")}
          </Text>
          <Text className="text-[13px] leading-5 text-muted">
            {t("japanese.daily.plan.betterVoiceHint")}
          </Text>
        </View>
      ) : null}

      <Text className="px-1 text-xs text-muted">
        {t("japanese.daily.plan.shared")}
      </Text>
    </ScrollView>
  )
}
