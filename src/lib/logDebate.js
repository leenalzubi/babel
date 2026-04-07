import { analyseDebate } from './analyseDebate.js'
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
 * @param {Record<string, unknown>} state Debate snapshot (prompt, rounds, divergenceScores, synthesis, config).
 */
export async function logDebate(state) {
  console.log('logDebate called with:', Object.keys(state ?? {}))
  try {
    if (!supabase) {
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

    const concession_count =
      synth &&
      typeof synth === 'object' &&
      Array.isArray(synth.concessions)
        ? synth.concessions.length
        : 0
    const held_firm_count =
      synth &&
      typeof synth === 'object' &&
      Array.isArray(synth.heldFirm)
        ? synth.heldFirm.length
        : 0

    const rounds = Array.isArray(state.rounds) ? state.rounds.length : 0

    const cfg = state.config && typeof state.config === 'object' ? state.config : {}
    const r0 =
      Array.isArray(state.rounds) && state.rounds.length > 0
        ? state.rounds[0]
        : null
    const isPartial = Boolean(state.is_partial)
    const ar = state.agentResponses?.a ?? r0?.agentA
    const br = state.agentResponses?.b ?? r0?.agentB
    const cr = state.agentResponses?.c ?? r0?.agentC
    if (
      !isPartial &&
      (ar == null || br == null || cr == null)
    ) {
      console.warn(
        '[logDebate] Skipping Supabase insert: missing round 1 agent response(s)'
      )
      return
    }

    const agentA = cfg.agentA && typeof cfg.agentA === 'object' ? cfg.agentA : {}
    const agentB = cfg.agentB && typeof cfg.agentB === 'object' ? cfg.agentB : {}
    const agentC = cfg.agentC && typeof cfg.agentC === 'object' ? cfg.agentC : {}
    const model_a = typeof agentA.model === 'string' ? agentA.model : null
    const model_b = typeof agentB.model === 'string' ? agentB.model : null
    const model_c = typeof agentC.model === 'string' ? agentC.model : null

    /** @param {unknown} emb */
    function vecForInsert(emb) {
      return Array.isArray(emb) &&
        emb.length > 0 &&
        emb.every((x) => typeof x === 'number')
        ? emb
        : null
    }
    const embedding_a = vecForInsert(state.embedding_a)
    const embedding_b = vecForInsert(state.embedding_b)
    const embedding_c = vecForInsert(state.embedding_c)

    const analysis = analyseDebate(state)

    const val = state.validation
    const validation_score_b =
      val &&
      val.b &&
      typeof val.b === 'object' &&
      typeof val.b.score === 'number'
        ? Math.round(val.b.score)
        : null
    const validation_score_c =
      val &&
      val.c &&
      typeof val.c === 'object' &&
      typeof val.c.score === 'number'
        ? Math.round(val.c.score)
        : null
    const validation_status =
      val && typeof val.status === 'string' ? val.status : null
    const bias_flagged = validation_status === 'flagged'

    const lastCompletedStage =
      typeof state.last_completed_stage === 'string'
        ? state.last_completed_stage
        : null
    const timeoutCount =
      typeof state.timeout_count === 'number' && Number.isFinite(state.timeout_count)
        ? Math.max(0, Math.round(state.timeout_count))
        : null

    const insertData = {
      is_partial: isPartial,
      last_completed_stage: lastCompletedStage,
      timeout_count: timeoutCount,
      prompt_length,
      prompt_preview,
      divergence_ab,
      divergence_ac,
      divergence_bc,
      divergence_avg,
      top_contributor,
      concession_count,
      held_firm_count,
      rounds,
      model_a,
      model_b,
      model_c,
      embedding_a,
      embedding_b,
      embedding_c,
      validation_score_b,
      validation_score_c,
      validation_status,
      bias_flagged,
      ...analysis,
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
