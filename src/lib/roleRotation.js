import { BABEL_ROLES, DEFAULT_ROLE_ASSIGNMENT } from './babelRoles.js'

/** @typedef {import('./babelRoles.js').BabelRoleId} BabelRoleId */

const ROLE_CYCLE = /** @type {BabelRoleId[]} */ ([
  'skeptic',
  'researcher',
  'operator',
])

/**
 * Rotate role→model assignments to detect role confounding (Phase B §11.3).
 * Rotation 0 is the default A=Skeptic, B=Researcher, C=Operator.
 * @param {number} rotationIndex
 * @returns {{ a: BabelRoleId, b: BabelRoleId, c: BabelRoleId }}
 */
export function rotateRoleAssignment(rotationIndex = 0) {
  const n = ((rotationIndex % 3) + 3) % 3
  if (n === 0) return { ...DEFAULT_ROLE_ASSIGNMENT }
  if (n === 1) {
    return { a: 'researcher', b: 'operator', c: 'skeptic' }
  }
  return { a: 'operator', b: 'skeptic', c: 'researcher' }
}

/**
 * All three Phase B rotations with labels.
 */
export function allRoleRotations() {
  return [0, 1, 2].map((i) => {
    const roles = rotateRoleAssignment(i)
    return {
      rotation: i,
      roles,
      label: `A=${BABEL_ROLES[roles.a].label}, B=${BABEL_ROLES[roles.b].label}, C=${BABEL_ROLES[roles.c].label}`,
    }
  })
}
