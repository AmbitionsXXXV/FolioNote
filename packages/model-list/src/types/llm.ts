import type { AiModelSettings, ModelSearchImplementType } from "./ai-model"

// ==================== Provider Source Enum ====================
export const AiProviderSourceEnum = {
  Builtin: "builtin",
  Custom: "custom"
} as const

export type AiProviderSourceType =
  (typeof AiProviderSourceEnum)[keyof typeof AiProviderSourceEnum]

// ==================== Provider SDK Type ====================
export const AiProviderSDKEnum = {
  Anthropic: "anthropic",
  Azure: "azure",
  AzureAI: "azureai",
  Bedrock: "bedrock",
  Cloudflare: "cloudflare",
  ComfyUI: "comfyui",
  Google: "google",
  Huggingface: "huggingface",
  Ollama: "ollama",
  Openai: "openai",
  Qwen: "qwen",
  Replicate: "replicate",
  Router: "router",
  Volcengine: "volcengine"
} as const

export type AiProviderSDKType =
  (typeof AiProviderSDKEnum)[keyof typeof AiProviderSDKEnum]

// ==================== Response Animation ====================
export type ResponseAnimation =
  | "smooth"
  | "fast"
  | {
      speed?: number
      text?: "smooth" | "fast"
    }

// ==================== Provider Settings ====================
export interface AiProviderSettings {
  /** Default show browser request option */
  defaultShowBrowserRequest?: boolean
  /** Disable browser request */
  disableBrowserRequest?: boolean
  /** Model can be edited */
  modelEditable?: boolean
  /** Proxy URL configuration */
  proxyUrl?:
    | {
        placeholder: string
        desc?: string
        title?: string
      }
    | false
  /** Response animation configuration */
  responseAnimation?: ResponseAnimation
  /** SDK type used by this provider */
  sdkType?: AiProviderSDKType
  /** Search mode implementation */
  searchMode?: ModelSearchImplementType
  /** Show add new model button */
  showAddNewModel?: boolean
  /** Show API key input */
  showApiKey?: boolean
  /** Show connection checker */
  showChecker?: boolean
  /** Show deployment name input */
  showDeployName?: boolean
  /** Show model fetcher */
  showModelFetcher?: boolean
  /** Support responses API */
  supportResponsesApi?: boolean
}

// ==================== Provider Config ====================
export interface AiProviderConfig {
  enableResponseApi?: boolean
}

// ==================== Provider List Item ====================
export interface AiProviderListItem {
  description?: string
  enabled: boolean
  id: string
  logo?: string
  name?: string
  sort?: number
  source: AiProviderSourceType
}

// ==================== Provider Detail Item ====================
export interface AiProviderDetailItem {
  checkModel?: string
  description?: string
  enabled: boolean
  fetchOnClient?: boolean
  homeUrl?: string
  id: string
  keyVaults?: Record<string, unknown>
  logo?: string
  modelsUrl?: string
  name: string

  settings: AiProviderSettings
  source: AiProviderSourceType
}

// ==================== Enabled Provider ====================
export interface EnabledProvider {
  id: string
  logo?: string
  name?: string
  source: AiProviderSourceType
}

// ==================== Provider Runtime Config ====================
export interface AiProviderRuntimeConfig {
  config: AiProviderConfig
  fetchOnClient?: boolean
  keyVaults: Record<string, string>
  settings: AiProviderSettings
}

// ==================== Model Provider Card ====================
export interface ModelProviderCard {
  apiKeyUrl?: string

  /** Models list (empty array, models are defined separately) */
  chatModels: never[]
  /** Model to use for connection check */
  checkModel?: string
  description?: string

  /** Whether this provider is enabled by default */
  enabled?: boolean
  id: string
  /** Logo URL for a provider the web app has no built-in brand mark for */
  logo?: string

  /** Model list configuration */
  modelList?: {
    showModelFetcher?: boolean
  }
  modelsUrl?: string
  name: string

  /** Proxy URL configuration (deprecated, use settings.proxyUrl) */
  proxyUrl?: {
    placeholder: string
  }

  /** Provider settings */
  settings: AiProviderSettings
  /** Whether to show config panel */
  showConfig?: boolean
  url: string
}

// ==================== Model List Item for Provider ====================
export interface ChatModelCard {
  abilities?: AiModelSettings
  contextWindowTokens?: number
  description?: string
  displayName?: string
  enabled?: boolean
  id: string
  legacy?: boolean
  maxOutput?: number
  organization?: string
  releasedAt?: string
}
