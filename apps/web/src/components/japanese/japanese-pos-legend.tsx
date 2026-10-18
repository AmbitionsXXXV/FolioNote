import { useTranslation } from "react-i18next"

import type { JapanesePartOfSpeech } from "@/lib/japanese-pos"
import {
  ALL_JAPANESE_POS_CATEGORIES,
  JAPANESE_POS_SWATCH_COLOR_MAP
} from "@/lib/japanese-pos"

interface JapanesePosLegendProps {
  enabledPosCategories: Set<JapanesePartOfSpeech>
  onToggle: (category: JapanesePartOfSpeech) => void
}

/** Clickable legend; a disabled category dims its words in the text. */
export function JapanesePosLegend({
  enabledPosCategories,
  onToggle
}: JapanesePosLegendProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
      {ALL_JAPANESE_POS_CATEGORIES.map((category) => {
        const isActive = enabledPosCategories.has(category)
        return (
          <button
            aria-pressed={isActive}
            className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] transition-opacity duration-200 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none ${
              isActive ? "opacity-100" : "opacity-40"
            }`}
            key={category}
            onClick={() => onToggle(category)}
            type="button"
          >
            <span
              className={`inline-block size-2 rounded-sm ${JAPANESE_POS_SWATCH_COLOR_MAP[category]}`}
            />
            <span className="text-secondary-foreground">
              {t(`review.japaneseTyping.posCategories.${category}`)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
