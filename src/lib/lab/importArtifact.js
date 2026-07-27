/**
 * Convert a forge debate state (or export-like object) into a draft Lab artifact.
 * Never auto-publishes. Strips private fields.
 */

import { scrubPrivateFields, reportMissingArtifactFields, flagPersonalDataRisks } from './privacy.js'
import { validateArtifact } from './schema.js'
import { DATASET_VERSION } from './schema.js'

/**
 * @param {Record<string, unknown>} state
 * @param {{
 *   condition?: import('./schema.js').EvaluationCondition,
 *   promptVersion?: string,
 *   orchestrationVersion?: string,
 * }} [opts]
 */
export function debateStateToArtifact(state, opts = {}) {
  const condition = opts.condition ?? 'babel'
  const config = /** @type {any} */ (state.config ?? {})
  const modelIds = [
    config.agentA?.model || config.agentA?.name,
    config.agentB?.model || config.agentB?.name,
    config.agentC?.model || config.agentC?.name,
  ].filter(Boolean)

  const roles = /** @type {any} */ (state.roles ?? {})
  const roleAssignments = ['a', 'b', 'c']
    .filter((k) => roles[k] && modelIds.length)
    .map((k, i) => ({
      roleId: String(roles[k]),
      modelId: String(
        (k === 'a'
          ? config.agentA?.model || config.agentA?.name
          : k === 'b'
            ? config.agentB?.model || config.agentB?.name
            : config.agentC?.model || config.agentC?.name) ?? modelIds[i] ?? 'unknown'
      ),
    }))

  /** @type {number[]} */
  const durations = []
  for (const bag of [
    state.agentTimers,
    state.reviewTimers,
    state.finalPositionTimers,
  ]) {
    if (!bag || typeof bag !== 'object') continue
    for (const v of ['a', 'b', 'c']) {
      const t = /** @type {any} */ (bag)[v]
      if (t?.startTime != null && t?.endTime != null) {
        durations.push(Math.max(0, t.endTime - t.startTime))
      }
    }
  }

  const r1 = Array.isArray(state.rounds)
    ? state.rounds.find((r) => r.roundNum === 1) ?? state.rounds[0]
    : null
  const rev = Array.isArray(state.reviews) ? state.reviews[0] : null
  const finals = /** @type {any} */ (state.finalPositions ?? {})
  const synthesis = /** @type {any} */ (state.synthesis)

  /** @type {Record<string, unknown>} */
  const artifact = {
    condition,
    modelIds: modelIds.length ? modelIds.map(String) : ['unknown'],
    roleAssignments: condition === 'babel' ? roleAssignments : undefined,
    promptVersion:
      opts.promptVersion ||
      `imported:${DATASET_VERSION}`,
    orchestrationVersion: opts.orchestrationVersion || 'forge-import',
    metrics: {
      durationMs: durations.length
        ? durations.reduce((a, b) => a + b, 0)
        : undefined,
      callsAttempted: undefined,
      callsSucceeded: undefined,
      completedWithGaps: state.status === 'complete_with_gaps',
    },
    scores: [],
    outputText:
      condition === 'babel'
        ? typeof synthesis?.output === 'string'
          ? synthesis.output
          : undefined
        : undefined,
    babelRounds:
      condition === 'babel'
        ? {
            round1: [
              {
                modelId: String(config.agentA?.model || config.agentA?.name || 'a'),
                roleId: roles.a,
                text: r1?.agentA,
              },
              {
                modelId: String(config.agentB?.model || config.agentB?.name || 'b'),
                roleId: roles.b,
                text: r1?.agentB,
              },
              {
                modelId: String(config.agentC?.model || config.agentC?.name || 'c'),
                roleId: roles.c,
                text: r1?.agentC,
              },
            ],
            round2: [
              {
                modelId: String(config.agentA?.model || config.agentA?.name || 'a'),
                roleId: roles.a,
                text: rev?.aReviews,
              },
              {
                modelId: String(config.agentB?.model || config.agentB?.name || 'b'),
                roleId: roles.b,
                text: rev?.bReviews,
              },
              {
                modelId: String(config.agentC?.model || config.agentC?.name || 'c'),
                roleId: roles.c,
                text: rev?.cReviews,
              },
            ],
            round3: [
              {
                modelId: String(config.agentA?.model || config.agentA?.name || 'a'),
                roleId: roles.a,
                text: finals.a,
              },
              {
                modelId: String(config.agentB?.model || config.agentB?.name || 'b'),
                roleId: roles.b,
                text: finals.b,
              },
              {
                modelId: String(config.agentC?.model || config.agentC?.name || 'c'),
                roleId: roles.c,
                text: finals.c,
              },
            ],
            synthesis:
              typeof synthesis?.output === 'string' ? synthesis.output : undefined,
          }
        : undefined,
    failureNotes: [],
  }

  if (state.status === 'failed' || state.status === 'blocked') {
    artifact.failureNotes = [
      `Source debate status was ${String(state.status)}`,
    ]
  }

  const scrubbed = /** @type {Record<string, unknown>} */ (
    scrubPrivateFields(artifact)
  )
  const validation = validateArtifact(scrubbed)
  const fieldReport = reportMissingArtifactFields(scrubbed)
  const promptFlags = flagPersonalDataRisks(String(state.prompt ?? ''))

  return {
    status: 'draft',
    artifact: validation.ok ? validation.value : null,
    validationError: validation.ok ? null : validation.error,
    missing: fieldReport.missing,
    warnings: [...fieldReport.warnings, ...promptFlags],
    neverAutoPublish: true,
  }
}

/**
 * Merge an artifact into a case object as draft (in memory). Caller writes JSON.
 * @param {import('./labTypes.js').EvaluationCase} evaluationCase
 * @param {import('./labTypes.js').EvaluationArtifact} artifact
 */
export function addArtifactToDraftCase(evaluationCase, artifact) {
  const others = evaluationCase.artifacts.filter(
    (a) => a.condition !== artifact.condition
  )
  return {
    ...evaluationCase,
    status: /** @type {const} */ ('draft'),
    artifacts: [...others, artifact],
    changelog: [
      ...(evaluationCase.changelog ?? []),
      {
        at: new Date().toISOString(),
        note: `Imported ${artifact.condition} artifact (draft; not published).`,
      },
    ],
  }
}
