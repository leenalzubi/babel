import { computeAuditPositionMetrics } from './auditJourney.js'
import { analyseDebate } from './analyseDebate.js'
import { supabase } from './supabaseClient.js'

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
    const claim_divergence_ab =
      div && typeof div.ab === 'number' ? div.ab : null
    const claim_divergence_ac =
      div && typeof div.ac === 'number' ? div.ac : null
    const claim_divergence_bc =
      div && typeof div.bc === 'number' ? div.bc : null
    const claim_divergence_avg =
      div && typeof div.average === 'number' ? div.average : null
    const total_claims =
      div && typeof div.totalClaims === 'number'
        ? Math.max(0, Math.round(div.totalClaims))
        : null
    const contested_claims =
      div && typeof div.contestedClaims === 'number'
        ? Math.max(0, Math.round(div.contestedClaims))
        : null
    const unanimous_claims =
      div && typeof div.unanimousClaims === 'number'
        ? Math.max(0, Math.round(div.unanimousClaims))
        : null
    const hard_disagreements =
      div && typeof div.hardDisagreements === 'number'
        ? Math.max(0, Math.round(div.hardDisagreements))
        : null

    const synth = state.synthesis

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

    const fpLog = state.finalPositions && typeof state.finalPositions === 'object'
      ? state.finalPositions
      : {}
    const final_position_a = String(fpLog.a ?? '').slice(0, 200) || null
    const final_position_b = String(fpLog.b ?? '').slice(0, 200) || null
    const final_position_c = String(fpLog.c ?? '').slice(0, 200) || null

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

    const analysis = analyseDebate(state)
    const audit = state.audit && typeof state.audit === 'object' ? state.audit : null
    const apm = computeAuditPositionMetrics(audit)
    const sw =
      state.synthesisWinner && typeof state.synthesisWinner === 'object'
        ? state.synthesisWinner
        : null
    const sc =
      sw && typeof sw.scores === 'object' ? sw.scores : null

    const inf =
      state.influenceReport && typeof state.influenceReport === 'object'
        ? state.influenceReport
        : null
    /** @param {string} k */
    const infSlot = (k) =>
      inf &&
      typeof inf[k] === 'object' &&
      inf[k] !== null
        ? /** @type {Record<string, unknown>} */ (inf[k])
        : null
    const ia = infSlot('a')
    const ib = infSlot('b')
    const ic = infSlot('c')
    /** @param {Record<string, unknown> | null} row */
    const typeFrom = (row) => {
      const s = row?.selfReport
      return s && typeof s === 'object' && 'change_type' in s
        ? String(/** @type {Record<string, unknown>} */ (s).change_type ?? '')
        : null
    }

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
      claim_divergence_ab,
      claim_divergence_ac,
      claim_divergence_bc,
      claim_divergence_avg,
      total_claims,
      contested_claims,
      unanimous_claims,
      hard_disagreements,
      final_position_a,
      final_position_b,
      final_position_c,
      concession_count,
      held_firm_count,
      rounds,
      model_a,
      model_b,
      model_c,
      validation_score_b,
      validation_score_c,
      validation_status,
      bias_flagged,
      ...analysis,
      positions_shifted: apm?.positions_shifted ?? null,
      positions_flipped: apm?.positions_flipped ?? null,
      most_changed_model: apm?.most_changed_model ?? null,
      synthesis_winner:
        typeof sw?.winner === 'string' ? sw.winner : null,
      gpt_competition_score:
        sc && typeof sc.gpt === 'number' ? sc.gpt : null,
      phi_competition_score:
        sc && typeof sc.phi === 'number' ? sc.phi : null,
      mistral_competition_score:
        sc && typeof sc.mistral === 'number' ? sc.mistral : null,
      change_a: ia?.classification != null ? String(ia.classification) : null,
      change_b: ib?.classification != null ? String(ib.classification) : null,
      change_c: ic?.classification != null ? String(ic.classification) : null,
      change_type_a: typeFrom(ia) || null,
      change_type_b: typeFrom(ib) || null,
      change_type_c: typeFrom(ic) || null,
      most_influenced:
        typeof inf?.mostInfluenced === 'string'
          ? inf.mostInfluenced
          : null,
      most_resistant:
        typeof inf?.mostResistant === 'string' ? inf.mostResistant : null,
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
