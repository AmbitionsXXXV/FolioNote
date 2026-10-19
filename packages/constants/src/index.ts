import type { SupportedLanguage } from "@folionote/locales"

export * from "./ai-providers"
export * from "./auth"
export * from "./avatar"
export * from "./file-upload"
export * from "./japanese"
export * from "./knowledge"
export * from "./storage"
export * from "./time"
export * from "./user"

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  "en-US": "English",
  "zh-CN": "简体中文",
  "ja-JP": "日本語"
}
