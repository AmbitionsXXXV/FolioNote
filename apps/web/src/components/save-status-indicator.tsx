import {
  Alert01Icon,
  CheckmarkCircle02Icon,
  Loading02Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTranslation } from "react-i18next"

import type { SaveStatus } from "@/hooks/use-auto-save"

interface SaveStatusIndicatorProps {
  status: SaveStatus
  className?: string
}

/**
 * 保存状态指示器组件
 *
 * 显示当前的保存状态：
 * - idle: 不显示
 * - saving: 显示 "保存中..."
 * - saved: 显示 "已保存"
 * - error: 显示 "保存失败"
 */
export function SaveStatusIndicator({
  status,
  className = ""
}: SaveStatusIndicatorProps) {
  const { t } = useTranslation()

  if (status === "idle") {
    return null
  }

  const statusConfig = {
    saving: {
      icon: Loading02Icon,
      text: t("editor.saving"),
      className: "text-muted-foreground",
      iconClassName: "animate-spin"
    },
    saved: {
      icon: CheckmarkCircle02Icon,
      text: t("editor.saved"),
      className: "text-green-600 dark:text-green-500",
      iconClassName: ""
    },
    error: {
      icon: Alert01Icon,
      text: t("editor.saveFailed"),
      className: "text-destructive",
      iconClassName: ""
    }
  }

  const config = statusConfig[status]

  return (
    <span
      className={`flex items-center gap-1 text-xs ${config.className} ${className}`}
    >
      <HugeiconsIcon
        className={`size-3 ${config.iconClassName}`}
        icon={config.icon}
      />
      {config.text}
    </span>
  )
}
