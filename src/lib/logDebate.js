import { supabase } from './supabaseClient.js'

/**
 * @param {{ a?: string, b?: string, c?: string }} attributions
 * @returns {'a' | 'b' | 'c' | null}
 */
function topContributorKey(attributions) {
  if (!attributions || typeof attributions !== 'object') return null
  const la = String(attributions.a ?? '').length
  const lb = String(attributions.b ?? '').length
  const lc = String(attributions.c ?? '').length
  if (la === 0 && lb === 0 && lc === 0) return null
  const max = Math.max(la, lb, lc)
  if (la === max) return 'a'
  if (lb === max) return 'b'
  return 'c'
}

/**
 * Best-effort analytics row for Supabase `debates` table. Never throws.
 *
 * @param {Record<string, unknown>} state Forge-like snapshot (prompt, rounds, divergenceScores, synthesis, config).
 */
export async function logDebate(state) {
  console.log('logDebate called with:', Object.keys(state ?? {}))
  try {
    const url = import.meta.env.VITE_SUPABASE_URL
    if (typeof url !== 'string' || !url.trim()) {
      return
    }

    const prompt = typeof state.prompt === 'string' ? state.prompt : ''
    const prompt_length = prompt.length
    const prompt_preview = prompt.slice(0, 120)

    const div = Array.isArray(state.divergenceScores)
      ? state.divergenceScores[0]
      : null
    const divergence_ab = div && typeof div.ab === 'number' ? div.ab : null
    const divergence_ac = div && typeof div.ac === 'number' ? div.ac : null
    const divergence_bc = div && typeof div.bc === 'number' ? div.bc : null
    const divergence_avg =
      div && typeof div.average === 'number' ? div.average : null

    const synth = state.synthesis
    const attributions =
      synth &&
      typeof synth === 'object' &&
      synth.attributions &&
      typeof synth.attributions === 'object'
        ? synth.attributions
        : { a: '', b: '', c: '' }
    const top_contributor = topContributorKey(attributions)

    const rounds = Array.isArray(state.rounds) ? state.rounds.length : 0

    const cfg = state.config && typeof state.config === 'object' ? state.config : {}
    const agentA = cfg.agentA && typeof cfg.agentA === 'object' ? cfg.agentA : {}
    const agentB = cfg.agentB && typeof cfg.agentB === 'object' ? cfg.agentB : {}
    const agentC = cfg.agentC && typeof cfg.agentC === 'object' ? cfg.agentC : {}
    const model_a = typeof agentA.model === 'string' ? agentA.model : null
    const model_b = typeof agentB.model === 'string' ? agentB.model : null
    const model_c = typeof agentC.model === 'string' ? agentC.model : null

    const insertData = {
      prompt_length,
      prompt_preview,
      divergence_ab,
      divergence_ac,
      divergence_bc,
      divergence_avg,
      top_contributor,
      rounds,
      model_a,
      model_b,
      model_c,
    }

    console.log('Attempting Supabase insert:', insertData)
    const { data, error } = await supabase.from('debates').insert(insertData)
    console.log('Supabase result:', data, error)
    if (error) {
      console.error('Supabase insert error:', error)
      console.warn('[logDebate] Supabase insert failed:', error.message)
    }
  } catch (err) {
    console.warn('[logDebate]', err instanceof Error ? err.message : err)
  }
}
