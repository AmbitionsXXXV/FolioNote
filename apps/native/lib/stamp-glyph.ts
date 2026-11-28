import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as SecureStore from "expo-secure-store"

/** Characters the reader can carve on their check-in stamp. */
export const STAMP_GLYPHS = ["学", "続", "文", "志"] as const
export type StampGlyph = (typeof STAMP_GLYPHS)[number]
export const DEFAULT_STAMP_GLYPH: StampGlyph = "学"

const STAMP_GLYPH_KEY = "folio_stamp_glyph"
const stampGlyphQueryKey = ["device-prefs", "stamp-glyph"] as const

const isStampGlyph = (value: string | null): value is StampGlyph =>
  (STAMP_GLYPHS as readonly (string | null)[]).includes(value)

/** A device preference: the glyph stays on this iPhone, like the theme. */
export async function loadStampGlyph(): Promise<StampGlyph | null> {
  const stored = await SecureStore.getItemAsync(STAMP_GLYPH_KEY)
  return isStampGlyph(stored) ? stored : null
}

/** The glyph the reader picked, or null when they never picked one. */
export function useStampGlyph(): StampGlyph | null {
  const { data } = useQuery({
    queryKey: stampGlyphQueryKey,
    queryFn: loadStampGlyph,
    staleTime: Number.POSITIVE_INFINITY
  })
  return data ?? null
}

export function useSaveStampGlyph() {
  const queryClient = useQueryClient()
  return async (glyph: StampGlyph) => {
    await SecureStore.setItemAsync(STAMP_GLYPH_KEY, glyph)
    queryClient.setQueryData(stampGlyphQueryKey, glyph)
  }
}
