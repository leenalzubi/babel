/**
 * Cognitive roles for the flagship prototype.
 * Roles are prompt configurations, not model capabilities.
 */

/** @typedef {'skeptic' | 'researcher' | 'operator'} BabelRoleId */

/** @type {Record<BabelRoleId, { id: BabelRoleId, label: string, brief: string, instructions: string }>} */
export const BABEL_ROLES = {
  skeptic: {
    id: 'skeptic',
    label: 'Skeptic',
    brief: 'Searches for hidden failure modes and unsupported assumptions.',
    instructions:
      'You are the Skeptic. Prioritize hidden failure modes, unsupported assumptions, and conditions under which the proposal fails. Challenge weak evidence. Do not invent facts; mark speculation clearly.',
  },
  researcher: {
    id: 'researcher',
    label: 'Researcher',
    brief: 'Prioritizes evidence, source quality, and what remains unverified.',
    instructions:
      'You are the Researcher. Prioritize evidence quality, citations when you can supply them, and what remains unverified. Prefer precise claims over rhetoric. Distinguish sourced facts from inference.',
  },
  operator: {
    id: 'operator',
    label: 'Operator',
    brief: 'Focuses on feasibility, constraints, reversibility, and execution.',
    instructions:
      'You are the Operator. Prioritize feasibility, operational constraints, reversibility, error cost, and execution risk. Prefer actionable conditions over abstract principle.',
  },
}

/** Default assignment: A Skeptic, B Researcher, C Operator */
export const DEFAULT_ROLE_ASSIGNMENT = /** @type {const} */ ({
  a: 'skeptic',
  b: 'researcher',
  c: 'operator',
})

/**
 * @param {BabelRoleId | string | null | undefined} id
 */
export function roleLabel(id) {
  const key = /** @type {BabelRoleId} */ (String(id || '').toLowerCase())
  return BABEL_ROLES[key]?.label ?? 'Voice'
}

/**
 * @param {BabelRoleId | string | null | undefined} id
 */
export function roleBrief(id) {
  const key = /** @type {BabelRoleId} */ (String(id || '').toLowerCase())
  return BABEL_ROLES[key]?.brief ?? ''
}

/**
 * @param {BabelRoleId | string | null | undefined} id
 */
export function roleInstructions(id) {
  const key = /** @type {BabelRoleId} */ (String(id || '').toLowerCase())
  return BABEL_ROLES[key]?.instructions ?? ''
}

/**
 * Wrap a stage system prompt with role instructions.
 * @param {string} stageSystem
 * @param {BabelRoleId | string | null | undefined} roleId
 * @param {string[]} [criteria]
 */
export function withRoleSystem(stageSystem, roleId, criteria = []) {
  const role = roleInstructions(roleId)
  const criteriaBlock =
    Array.isArray(criteria) && criteria.length > 0
      ? `\n\nThe human's decision criteria (instructions, not weights): ${criteria.join('; ')}.`
      : ''
  return `${role}${criteriaBlock}\n\n${stageSystem}`.trim()
}
