import { Tick02Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { PressableFeedback, Skeleton, useThemeColor } from "heroui-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Alert, ScrollView, Text, View } from "react-native"

import { DEFAULT_DECK, JLPT_LEVELS, sameDeck } from "@/lib/japanese/study-deck"
import type { JlptLevel, StudyDeck } from "@/lib/japanese/study-deck"
import { getDeviceTimeZone } from "@/lib/study-day"
import { orpc } from "@/utils/orpc"

function BookRow({
  title,
  subtitle,
  count,
  selected,
  last,
  onPress
}: {
  title: string
  subtitle: string
  count: number
  selected: boolean
  last: boolean
  onPress: () => void
}) {
  const accent = useThemeColor("accent")
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`ml-4 min-h-14 flex-row items-center gap-3 py-1.5 pr-4 ${last ? "" : "border-b-[0.5px] border-border"}`}
      onPress={onPress}
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-base text-foreground">{title}</Text>
        {subtitle ? (
          <Text className="text-[13px] text-muted">{subtitle}</Text>
        ) : null}
      </View>
      <Text className="text-[15px] text-muted tabular-nums">{count}</Text>
      <View className="w-[18px]">
        {selected ? (
          <HugeiconsIcon color={accent} icon={Tick02Icon} size={18} />
        ) : null}
      </View>
    </PressableFeedback>
  )
}

/** Sheet for choosing which word book the daily session draws from. */
export default function WordBooksSheet() {
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const timeZone = getDeviceTimeZone()
  const plan = useQuery(
    orpc.japanese.study.plan.queryOptions({ input: { timeZone } })
  )
  const decks = useQuery(orpc.japanese.study.decks.queryOptions())
  const current = plan.data?.deck ?? DEFAULT_DECK
  const [level, setLevel] = useState<JlptLevel>(
    current.kind === "level" ? current.level : "N5"
  )

  const choose = useMutation(
    orpc.japanese.study.updatePlan.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.japanese.study.key() })
        router.back()
      },
      onError: () => {
        Alert.alert(t("common.error"), t("japanese.daily.books.saveFailed"))
      }
    })
  )
  const pick = (deck: StudyDeck) => choose.mutate({ deck })

  const levelRow = decks.data?.levels.find((row) => row.level === level)
  const progress = (studied: number, due: number) =>
    due > 0
      ? `${t("japanese.daily.books.progress", { studied })} · ${t("japanese.daily.books.due", { count: due })}`
      : t("japanese.daily.books.progress", { studied })
  const levelBooks = levelRow
    ? [
        {
          deck: { kind: "level", level } as StudyDeck,
          title: t("japanese.daily.books.all", { level }),
          subtitle: progress(levelRow.studied, levelRow.due),
          count: levelRow.total
        },
        ...levelRow.books.map((book) => ({
          deck: { kind: "level", level, pos: book.pos } as StudyDeck,
          title: t(`japanese.daily.pos.${book.pos}`),
          subtitle: progress(book.studied, book.due),
          count: book.total
        }))
      ]
    : []
  const lists = [
    ...(decks.data?.lexicons ?? []).map((list) => ({
      deck: { kind: "lexicon", id: list.id } as StudyDeck,
      title:
        list.kind === "notebook" ? t("japanese.notebook.title") : list.name,
      subtitle: progress(list.studied, list.due),
      count: list.total
    })),
    ...(decks.data?.moji ?? []).map((list) => ({
      deck: { kind: "moji", collectionId: list.collectionId } as StudyDeck,
      title: list.title,
      subtitle: progress(list.studied, list.due),
      count: list.total
    }))
  ]

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, gap: 14 }}
    >
      <View
        accessibilityLabel={t("japanese.daily.books.levels")}
        accessibilityRole="tablist"
        className="flex-row gap-0.5 rounded-full bg-default p-[3px]"
      >
        {JLPT_LEVELS.map((option) => (
          <PressableFeedback
            accessibilityRole="tab"
            accessibilityState={{ selected: option === level }}
            className={`h-[34px] flex-1 items-center justify-center rounded-full ${option === level ? "bg-surface" : ""}`}
            key={option}
            onPress={() => setLevel(option)}
          >
            <Text className="text-sm font-semibold text-foreground">
              {option}
            </Text>
          </PressableFeedback>
        ))}
      </View>

      <View className="overflow-hidden rounded-3xl bg-surface">
        {decks.isPending ? (
          <Skeleton className="m-4 h-40 rounded-xl" />
        ) : (
          levelBooks.map((book, index) => (
            <BookRow
              count={book.count}
              key={book.title}
              last={index === levelBooks.length - 1}
              onPress={() => pick(book.deck)}
              selected={sameDeck(book.deck, current)}
              subtitle={book.subtitle}
              title={book.title}
            />
          ))
        )}
      </View>
      <Text className="-mt-1.5 px-1 text-xs text-muted">
        {t("japanese.daily.books.overlap")}
      </Text>

      {lists.length > 0 ? (
        <>
          <Text className="mx-1 mt-1 text-[13px] font-semibold text-muted">
            {t("japanese.daily.books.myLists")}
          </Text>
          <View className="overflow-hidden rounded-3xl bg-surface">
            {lists.map((list, index) => (
              <BookRow
                count={list.count}
                key={`${list.deck.kind}:${list.title}:${index}`}
                last={index === lists.length - 1}
                onPress={() => pick(list.deck)}
                selected={sameDeck(list.deck, current)}
                subtitle={list.subtitle}
                title={list.title}
              />
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  )
}
