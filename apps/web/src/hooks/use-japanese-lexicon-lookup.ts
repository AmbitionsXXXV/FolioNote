import { useQueries, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { orpc } from "@/utils/orpc"

/** japanese.lexicons.lookup accepts at most this many base forms per call. */
const LOOKUP_BATCH = 500
const LOOKUP_STALE_MS = 60 * 1000

export interface LexiconMatch {
  baseForm: string
  lexiconId: string
  lexiconName: string
  level: string | null
  unit: string | null
  meanings: string[]
}

export interface LexiconLookup {
  /** Every list entry whose dictionary form matches, in list order. */
  matches: ReadonlyMap<string, LexiconMatch[]>
  /** Short label per dictionary form, e.g. "红宝书 N2 · 3" (+1 when in several lists). */
  tags: ReadonlyMap<string, string>
}

const EMPTY_LOOKUP: LexiconLookup = { matches: new Map(), tags: new Map() }

export function formatLexiconTag(match: LexiconMatch): string {
  let label = match.lexiconName
  if (match.level) label += ` ${match.level}`
  if (match.unit) label += ` · ${match.unit}`
  return label
}

/**
 * Which of the visible words are in the reader's own word lists. Pass a
 * memoised, de-duplicated array so the query keys stay stable across renders.
 */
export function useJapaneseLexiconLookup(
  baseForms: readonly string[]
): LexiconLookup {
  const batches = useMemo(() => {
    const result: string[][] = []
    for (let start = 0; start < baseForms.length; start += LOOKUP_BATCH) {
      result.push(baseForms.slice(start, start + LOOKUP_BATCH))
    }
    return result
  }, [baseForms])

  const lexicons = useQuery({
    ...orpc.japanese.lexicons.list.queryOptions(),
    staleTime: LOOKUP_STALE_MS,
    meta: { silentError: true }
  })

  const found = useQueries({
    queries: batches.map((batch) => ({
      ...orpc.japanese.lexicons.lookup.queryOptions({
        input: { baseForms: batch }
      }),
      staleTime: LOOKUP_STALE_MS,
      retry: 1,
      meta: { silentError: true }
    })),
    combine: (results) => results.flatMap((result) => result.data ?? [])
  })

  return useMemo(() => {
    if (found.length === 0) return EMPTY_LOOKUP
    const levelByLexicon = new Map(
      (lexicons.data ?? []).map((lexicon) => [lexicon.id, lexicon.level])
    )
    const matches = new Map<string, LexiconMatch[]>()
    for (const entry of found) {
      const list = matches.get(entry.baseForm) ?? []
      list.push({
        ...entry,
        level: levelByLexicon.get(entry.lexiconId) ?? null
      })
      matches.set(entry.baseForm, list)
    }
    const tags = new Map<string, string>()
    for (const [baseForm, list] of matches) {
      const [first] = list
      if (!first) continue
      const extra = list.length - 1
      tags.set(
        baseForm,
        extra > 0
          ? `${formatLexiconTag(first)} +${extra}`
          : formatLexiconTag(first)
      )
    }
    return { matches, tags }
  }, [found, lexicons.data])
}
