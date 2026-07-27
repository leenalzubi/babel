/**
 * Known GitHub Models catalog entries used for replace-model (explicit, never silent).
 * @typedef {{ id: string, name: string }} BabelModelOption
 */

/** @type {BabelModelOption[]} */
export const BABEL_MODEL_CATALOG = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' },
  { id: 'microsoft/phi-4-reasoning', name: 'Phi-4 Reasoning' },
  { id: 'mistral-ai/mistral-small-2503', name: 'Mistral Small' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'meta/meta-llama-3.1-8b-instruct', name: 'Llama 3.1 8B' },
]

/**
 * Catalog options excluding the model already assigned to this slot
 * and optionally preferring models not used by other slots.
 * @param {string} currentModelId
 * @param {string[]} [otherModelIds]
 */
export function replaceModelOptions(currentModelId, otherModelIds = []) {
  const others = new Set(otherModelIds.filter(Boolean))
  return BABEL_MODEL_CATALOG.filter((m) => m.id !== currentModelId).sort(
    (a, b) => {
      const aUsed = others.has(a.id) ? 1 : 0
      const bUsed = others.has(b.id) ? 1 : 0
      return aUsed - bUsed || a.name.localeCompare(b.name)
    }
  )
}
