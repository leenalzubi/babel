/**
 * Eligibility and check planning for conclusion stability.
 */

import { isUnavailableAgentResponse } from '../debateConstants.js'
import { materialsFromState } from './materials.js'
import { roleLabel } from '../babelRoles.js'
import { STABILITY_FUTURE_FLAGS } from './types.js'

/**
 * @param {Record<string, unknown>} state
 * @returns {{
 *   eligible: boolean,
 *   reason?: string,
 *   successfulAgents: ('a'|'b'|'c')[],
 * }}
 */
export function getStabilityEligibility(state) {
  const status = String(state.status ?? '')
  if (
    status === 'running' ||
    status === 'degraded' ||
    status === 'idle' ||
    status === 'blocked'
  ) {
    return {
      eligible: false,
      reason: 'Available after the debate finishes.',
      successfulAgents: [],
    }
  }
  if (status === 'failed' || status === 'error') {
    return {
      eligible: false,
      reason: 'The debate failed before producing usable responses.',
      successfulAgents: [],
    }
  }

  const m = materialsFromState(state)
  const voiceErrors =
    /** @type {{ a?: unknown, b?: unknown, c?: unknown }} */ (
      state.voiceErrors ?? {}
    )

  /** @type {('a'|'b'|'c')[]} */
  const successfulAgents = []
  for (const agent of /** @type {const} */ (['a', 'b', 'c'])) {
    const texts = {
      a: [m.ra, m.aRev, m.fa],
      b: [m.rb, m.bRev, m.fb],
      c: [m.rc, m.cRev, m.fc],
    }[agent]
    const usable = texts.some(
      (t) =>
        typeof t === 'string' &&
        t.trim().length > 0 &&
        !isUnavailableAgentResponse(t)
    )
    if (usable && !voiceErrors[agent]) successfulAgents.push(agent)
    else if (
      usable &&
      voiceErrors[agent] &&
      texts.some(
        (t) =>
          typeof t === 'string' &&
          t.trim().length > 40 &&
          !isUnavailableAgentResponse(t)
      )
    ) {
      // Soft-failed later but still has usable material
      successfulAgents.push(agent)
    } else if (usable) {
      successfulAgents.push(agent)
    }
  }

  // Dedupe
  const unique = [...new Set(successfulAgents)]

  const hasSynthInput = Boolean(m.fa || m.fb || m.fc || m.ra || m.rb || m.rc)
  if (!hasSynthInput) {
    return {
      eligible: false,
      reason: 'No usable synthesis input exists for this debate.',
      successfulAgents: unique,
    }
  }
  if (unique.length < 2) {
    return {
      eligible: false,
      reason:
        'At least two successful voices are required for a stability check.',
      successfulAgents: unique,
    }
  }

  return { eligible: true, successfulAgents: unique }
}

/**
 * @param {Record<string, unknown>} state
 * @param {{ includeAlternateArbiter?: boolean }} [opts]
 */
export function planStabilityChecks(state, opts = {}) {
  const eligibility = getStabilityEligibility(state)
  const config = /** @type {any} */ (state.config ?? {})
  const roles = /** @type {any} */ (state.roles ?? {})
  const winner = /** @type {any} */ (state.synthesisWinner)?.winner
  const w = String(winner ?? 'gpt').toLowerCase()
  const primaryArbiter =
    w === 'phi'
      ? config.agentB
      : w === 'mistral'
        ? config.agentC
        : config.agentA

  /** @type {Array<{
   *   type: import('./types.js').StabilityCheckType,
   *   label: string,
   *   excludedAgentId?: 'a'|'b'|'c',
   *   excludedRoleId?: string,
   *   excludedModelId?: string,
   *   arbiterModelId: string,
   *   arbiterName: string,
   * }>} */
  const checks = []

  if (!eligibility.eligible) {
    return {
      ...eligibility,
      checks: [],
      callCount: 0,
      primaryArbiter,
      alternateArbiter: null,
      panelRerunExposed: false,
    }
  }

  checks.push({
    type: 'repeat_synthesis',
    label: 'Re-synthesize the full panel',
    arbiterModelId: String(primaryArbiter?.model ?? 'unknown'),
    arbiterName: String(primaryArbiter?.name ?? 'Arbiter'),
  })

  for (const agent of eligibility.successfulAgents) {
    const spec =
      agent === 'a'
        ? config.agentA
        : agent === 'b'
          ? config.agentB
          : config.agentC
    checks.push({
      type: 'leave_one_out',
      label: `Without ${roleLabel(roles[agent])} (${spec?.name ?? agent})`,
      excludedAgentId: agent,
      excludedRoleId: roles[agent],
      excludedModelId: String(spec?.model ?? spec?.name ?? agent),
      arbiterModelId: String(primaryArbiter?.model ?? 'unknown'),
      arbiterName: String(primaryArbiter?.name ?? 'Arbiter'),
    })
  }

  /** Alternate arbiter: another configured model with a different model id */
  const candidates = [config.agentA, config.agentB, config.agentC].filter(
    Boolean
  )
  const alternate = candidates.find(
    (a) =>
      a?.model &&
      primaryArbiter?.model &&
      a.model !== primaryArbiter.model
  )
  const includeAlt =
    opts.includeAlternateArbiter !== false && Boolean(alternate)

  if (includeAlt && alternate) {
    checks.push({
      type: 'alternate_arbiter',
      label: `Alternate arbiter (${alternate.name})`,
      arbiterModelId: String(alternate.model),
      arbiterName: String(alternate.name ?? 'Alternate'),
    })
  }

  return {
    ...eligibility,
    checks,
    callCount: checks.length,
    primaryArbiter,
    alternateArbiter: includeAlt ? alternate : null,
    panelRerunExposed: STABILITY_FUTURE_FLAGS.panel_rerun === true,
  }
}
