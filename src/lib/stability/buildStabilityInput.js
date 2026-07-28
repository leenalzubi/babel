/**
 * Build synthesis user messages for stability runs (incl. leave-one-out).
 */

import {
  collectClaimIds,
  parseRound1Structure,
  parseRound2Structure,
  parseRound3Structure,
} from '../parseStructuredResponse.js'

const EXCLUDED =
  '[This voice was excluded for a leave-one-out stability check. Do not invent contributions for it.]'

/**
 * @param {string} prompt
 * @param {Record<'a'|'b'|'c', { r1: string, r2: string, r3: string }>} voices
 * @param {{ agentA: { name: string }, agentB: { name: string }, agentC: { name: string } }} config
 * @param {string[]} [criteria]
 * @param {string} [claimCatalog]
 * @param {'a'|'b'|'c'|null} [exclude]
 */
export function buildStabilitySynthesisUserMessage(
  prompt,
  voices,
  config,
  criteria = [],
  claimCatalog = '',
  exclude = null
) {
  const { agentA, agentB, agentC } = config
  const names = { a: agentA.name, b: agentB.name, c: agentC.name }
  const criteriaLine =
    criteria.length > 0
      ? `User decision criteria (do not invent others): ${criteria.join('; ')}\n\n`
      : ''
  const catalogBlock = claimCatalog
    ? `\n\nKnown claim IDs (you may only cite these in FINDINGS-JSON):\n${claimCatalog}\n`
    : ''
  const note = exclude
    ? `\n\nStability check note: contributions from ${names[exclude]} are excluded. Do not cite or reconstruct that voice.\n`
    : '\n\nStability check note: This is a repeated synthesis of the same completed debate evidence.\n'

  /** @param {'a'|'b'|'c'} agent @param {string} roundLabel @param {string} text */
  function section(agent, roundLabel, text) {
    if (exclude === agent) {
      return `=== ${names[agent]} (${roundLabel}) ===\n${EXCLUDED}`
    }
    return `=== ${names[agent]} (${roundLabel}) ===\n${text || '(empty)'}`
  }

  return [
    `${criteriaLine}Original prompt:\n${prompt}${catalogBlock}${note}`,
    section('a', 'round 1', voices.a.r1),
    section('b', 'round 1', voices.b.r1),
    section('c', 'round 1', voices.c.r1),
    section('a', 'round 2', voices.a.r2),
    section('b', 'round 2', voices.b.r2),
    section('c', 'round 2', voices.c.r2),
    section('a', 'round 3 revision', voices.a.r3),
    section('b', 'round 3 revision', voices.b.r3),
    section('c', 'round 3 revision', voices.c.r3),
  ].join('\n\n')
}

/**
 * Claim catalog excluding one agent's claims when leave-one-out.
 * @param {Record<'a'|'b'|'c', { r1: string, r2: string, r3: string }>} voices
 * @param {any} config
 * @param {'a'|'b'|'c'|null} exclude
 */
export function buildStabilityClaimCatalog(voices, config, exclude = null) {
  /** @type {Partial<Record<'a'|'b'|'c', ReturnType<typeof parseRound1Structure>>>} */
  const r1 = {}
  for (const agent of /** @type {const} */ (['a', 'b', 'c'])) {
    if (exclude === agent) continue
    r1[agent] = parseRound1Structure(voices[agent].r1, agent)
  }
  const ids = collectClaimIds(r1)
  const lines = []
  for (const agent of /** @type {const} */ (['a', 'b', 'c'])) {
    if (exclude === agent) continue
    const label =
      agent === 'a'
        ? config.agentA?.name ?? 'A'
        : agent === 'b'
          ? config.agentB?.name ?? 'B'
          : config.agentC?.name ?? 'C'
    for (const c of r1[agent]?.claims ?? []) {
      lines.push(`- ${c.id} (${label}, round 1): ${String(c.text).slice(0, 160)}`)
    }
  }
  for (const agent of /** @type {const} */ (['a', 'b', 'c'])) {
    if (exclude === agent) continue
    const cps = parseRound2Structure(voices[agent].r2, ids).counterpoints ?? []
    cps.forEach((cp, i) => {
      lines.push(
        `- ${agent.toUpperCase()}-CP${i + 1} (round 2): ${String(cp.text).slice(0, 120)}`
      )
    })
  }
  for (const agent of /** @type {const} */ (['a', 'b', 'c'])) {
    if (exclude === agent) continue
    for (const ch of parseRound3Structure(voices[agent].r3).changes ?? []) {
      if (ch.revisedId) {
        lines.push(`- ${ch.revisedId} (round 3 ${ch.action} of ${ch.claimId})`)
      }
    }
  }
  return lines.join('\n')
}

/**
 * @param {ReturnType<import('./materials.js').materialsFromState>} m
 */
export function materialsToVoiceBag(m) {
  return {
    a: { r1: m.ra, r2: m.aRev, r3: m.fa },
    b: { r1: m.rb, r2: m.bRev, r3: m.fb },
    c: { r1: m.rc, r2: m.cRev, r3: m.fc },
  }
}
