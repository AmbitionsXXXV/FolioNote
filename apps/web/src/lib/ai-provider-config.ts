/**
 * AI Provider configuration types and constants.
 * This module defines the structure for managing API keys per provider.
 */

import { AI_PROVIDER_IDS } from "@folionote/constants"
import type { AiProviderId } from "@folionote/constants"

// Re-export for convenience
export type { AiProviderId } from "@folionote/constants"

export interface AiProviderInfo {
  id: AiProviderId
  name: string
  defaultBaseUrl: string
  docsUrl: string
}

/**
 * Provider metadata keyed by ID.
 * Using Record ensures all providers from AI_PROVIDER_IDS are covered.
 */
const AI_PROVIDER_INFO: Record<AiProviderId, Omit<AiProviderInfo, "id">> = {
  openai: {
    name: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    docsUrl: "https://platform.openai.com/api-keys"
  },
  deepseek: {
    name: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    docsUrl: "https://platform.deepseek.com/api_keys"
  },
  gemini: {
    name: "Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    docsUrl: "https://aistudio.google.com/apikey"
  },
  claude: {
    name: "Claude",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    docsUrl: "https://console.anthropic.com/settings/keys"
  },
  qwen: {
    name: "Qwen",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    docsUrl:
      "https://help.aliyun.com/zh/model-studio/developer-reference/get-api-key"
  },
  moonshot: {
    name: "Moonshot",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    docsUrl: "https://platform.moonshot.cn/docs/intro"
  }
}

/**
 * All supported AI providers with their metadata.
 * Derived from AI_PROVIDER_IDS to ensure consistency with the canonical list.
 */
export const AI_PROVIDERS: AiProviderInfo[] = AI_PROVIDER_IDS.map((id) => ({
  id,
  ...AI_PROVIDER_INFO[id]
}))

/**
 * Get provider info by ID.
 */
export function getProviderInfo(id: AiProviderId): AiProviderInfo | undefined {
  return AI_PROVIDERS.find((p) => p.id === id)
}

/**
 * Configuration for a single AI provider.
 */
export interface AiProviderConfig {
  apiKey: string
  baseUrl?: string
}

/**
 * All provider configurations stored together.
 */
export interface AiProvidersConfig {
  providers: Partial<Record<AiProviderId, AiProviderConfig>>
  defaultProvider: AiProviderId
  defaultModel?: string
}

/**
 * Local storage key for AI provider config.
 */
export const AI_PROVIDERS_CONFIG_KEY = "folionote-ai-providers-config"

/**
 * Default configuration.
 */
export const DEFAULT_AI_CONFIG: AiProvidersConfig = {
  providers: {},
  defaultProvider: "gemini",
  defaultModel: undefined
}
