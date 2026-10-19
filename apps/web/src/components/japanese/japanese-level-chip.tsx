import { Chip } from "@heroui/react"
import { useTranslation } from "react-i18next"

interface JapaneseLevelChipProps {
  level: string
  /** Append the "approx." qualifier: levels come from community lists. */
  approximate?: boolean
  className?: string
}

export function JapaneseLevelChip({
  level,
  approximate = false,
  className
}: JapaneseLevelChipProps) {
  const { t } = useTranslation()

  return (
    <Chip className={className} color="accent" size="sm" variant="soft">
      {approximate ? `${level} · ${t("japanese.level.approx")}` : level}
    </Chip>
  )
}
