import type { ModelSpec } from './types'

/**
 * Target-model presets: which encoding to count with, the context window we
 * default the budget to, and a rough input price for cost estimates.
 *
 * Notes:
 *  - Anthropic (Claude) and Google (Gemini) don't ship a public local
 *    tokenizer, so we approximate with OpenAI's o200k_base and flag it.
 *  - Prices/context windows drift over time — they're deliberately easy to
 *    edit here, and PRs to keep them current are welcome.
 */
export const MODELS: Record<string, ModelSpec> = {
  'gpt-4o': { id: 'gpt-4o', label: 'GPT-4o', encoding: 'o200k_base', context: 128_000, inputCostPerM: 2.5 },
  'gpt-4o-mini': { id: 'gpt-4o-mini', label: 'GPT-4o mini', encoding: 'o200k_base', context: 128_000, inputCostPerM: 0.15 },
  o1: { id: 'o1', label: 'OpenAI o1', encoding: 'o200k_base', context: 200_000, inputCostPerM: 15 },
  'o3-mini': { id: 'o3-mini', label: 'OpenAI o3-mini', encoding: 'o200k_base', context: 200_000, inputCostPerM: 1.1 },
  'gpt-4-turbo': { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', encoding: 'cl100k_base', context: 128_000, inputCostPerM: 10 },
  'gpt-4': { id: 'gpt-4', label: 'GPT-4', encoding: 'cl100k_base', context: 8_192, inputCostPerM: 30 },
  'gpt-3.5-turbo': { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', encoding: 'cl100k_base', context: 16_385, inputCostPerM: 0.5 },
  claude: { id: 'claude', label: 'Claude', encoding: 'o200k_base', context: 200_000, inputCostPerM: 3, approximate: true },
  'claude-opus': { id: 'claude-opus', label: 'Claude Opus', encoding: 'o200k_base', context: 200_000, inputCostPerM: 15, approximate: true },
  'claude-sonnet': { id: 'claude-sonnet', label: 'Claude Sonnet', encoding: 'o200k_base', context: 200_000, inputCostPerM: 3, approximate: true },
  'claude-haiku': { id: 'claude-haiku', label: 'Claude Haiku', encoding: 'o200k_base', context: 200_000, inputCostPerM: 0.8, approximate: true },
  'gemini-1.5-pro': { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', encoding: 'o200k_base', context: 2_000_000, inputCostPerM: 1.25, approximate: true },
  'gemini-1.5-flash': { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', encoding: 'o200k_base', context: 1_000_000, inputCostPerM: 0.075, approximate: true },
}

const ALIASES: Record<string, string> = {
  '4o': 'gpt-4o',
  gpt4o: 'gpt-4o',
  gpt4: 'gpt-4',
  'gpt-4o-turbo': 'gpt-4-turbo',
  o3: 'o3-mini',
  sonnet: 'claude-sonnet',
  opus: 'claude-opus',
  haiku: 'claude-haiku',
  'claude-3-opus': 'claude-opus',
  'claude-3-sonnet': 'claude-sonnet',
  'claude-3-haiku': 'claude-haiku',
  gemini: 'gemini-1.5-pro',
  'gemini-pro': 'gemini-1.5-pro',
  'gemini-flash': 'gemini-1.5-flash',
}

/** The model used when the user doesn't pass one. */
export const DEFAULT_MODEL = 'gpt-4o'

/** Resolve a user-supplied model id (case-insensitive, alias-aware). Throws if unknown. */
export function resolveModel(id: string): ModelSpec {
  const key = id.trim().toLowerCase()
  const canonical = ALIASES[key] ?? key
  const spec = MODELS[canonical]
  if (!spec) {
    throw new Error(`Unknown model "${id}". Available: ${Object.keys(MODELS).join(', ')}`)
  }
  return spec
}

/** Estimated USD cost for `tokens` input tokens, or undefined if price unknown. */
export function estimateCost(tokens: number, model: ModelSpec): number | undefined {
  if (model.inputCostPerM === undefined) return undefined
  return (tokens / 1_000_000) * model.inputCostPerM
}
