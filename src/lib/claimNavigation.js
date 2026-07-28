import { roleLabel } from './babelRoles.js'

/**
 * Stable DOM id for a claim block.
 * @param {string} claimId
 */
export function claimAnchorId(claimId) {
  return `babel-claim-${String(claimId).replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

/**
 * Scroll to a claim in the stage, if present.
 * @param {string} claimId
 */
export function jumpToClaim(claimId) {
  if (!claimId) return
  const el = document.getElementById(claimAnchorId(claimId))
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('claim-flash')
  window.setTimeout(() => el.classList.remove('claim-flash'), 1600)
}

/**
 * Build challenges map for one agent's round-1 claims from round-2 structures.
 * @param {{
 *   agentKey: 'a'|'b'|'c',
 *   structures?: {
 *     round1?: Partial<Record<'a'|'b'|'c', { claims?: { id: string }[] } | null>>,
 *     round2?: Partial<Record<'a'|'b'|'c', { counterpoints?: { linked?: boolean, targetClaimId?: string | null, text?: string }[] } | null>>,
 *   },
 *   roles?: Partial<Record<'a'|'b'|'c', string>>,
 * }} opts
 * @returns {Record<string, { roleLabel: string, text?: string }[]>}
 */
export function buildChallengesByClaim({ agentKey, structures, roles = {} }) {
  /** @type {Record<string, { roleLabel: string, text?: string }[]>} */
  const map = {}
  const myClaims = structures?.round1?.[agentKey]?.claims ?? []
  for (const claim of myClaims) {
    const id = claim.id
    /** @type {{ roleLabel: string, text?: string }[]} */
    const hits = []
    for (const other of /** @type {const} */ (['a', 'b', 'c'])) {
      if (other === agentKey) continue
      const cps = structures?.round2?.[other]?.counterpoints ?? []
      for (const cp of cps) {
        if (
          cp.linked &&
          cp.targetClaimId &&
          cp.targetClaimId.toUpperCase() === id.toUpperCase()
        ) {
          hits.push({
            roleLabel: roleLabel(roles[other]),
            text: cp.text,
          })
        }
      }
    }
    if (hits.length) map[id] = hits
  }
  return map
}

/** Human titles for synthesis / memo finding kinds */
export const FINDING_TITLES = {
  frame: 'Decision framed',
  agreement: 'What the voices agree on',
  disagreement: 'The central disagreement',
  support: 'Strongest support',
  weak: 'Weakest assumptions',
  minority: 'Minority report',
  change: 'What would change the answer',
  next: 'Recommended next step',
}
