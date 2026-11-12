import { getTokenCosts } from "tokenlens"

/** Our provider ids that tokenlens knows under a different name. */
const TOKENLENS_PROVIDER_ALIASES: Record<string, string> = {
  claude: "anthropic",
  gemini: "google",
  moonshot: "moonshotai"
}

/**
 * Calculate cost using tokenlens from usage data
 */
export function calculateCostFromUsage(
  provider: string,
  modelId: string,
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
): number | undefined {
  try {
    const tokenlensModelId = `${TOKENLENS_PROVIDER_ALIASES[provider] ?? provider}/${modelId}`
    const costs = getTokenCosts({
      modelId: tokenlensModelId,
      usage: {
        input: usage.inputTokens ?? 0,
        output: usage.outputTokens ?? 0
      }
    })
    return costs.totalUSD
  } catch {
    return undefined
  }
}
