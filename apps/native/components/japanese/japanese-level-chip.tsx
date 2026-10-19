import { Chip } from "heroui-native"
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
  const label = approximate ? `${level} · ${t("japanese.level.approx")}` : level

  return (
    <Chip
      accessibilityRole="text"
      className={className}
      color="accent"
      size="sm"
      variant="soft"
    >
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  )
}
