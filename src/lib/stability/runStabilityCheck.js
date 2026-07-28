/**
 * Orchestrate conclusion stability checks (session-scoped).
 * Does not mutate the canonical synthesis.
 */

import { callGitHubModel } from '../../api/githubModelsClient.js'
import { SYNTHESIS_SYSTEM } from '../../api/systemPrompts.js'
import { toBabelError, isInfrastructureBlocker } from '../babelErrors.js'
import { clipInferenceText } from '../clipInferenceText.js'
import { parseDecisionArtifact } from '../parseDecisionArtifact.js'
import {
  buildStabilityClaimCatalog,
  buildStabilitySynthesisUserMessage,
  materialsToVoiceBag,
} from './buildStabilityInput.js'
import {
  compareRecommendations,
  deriveStabilityOutcome,
} from './compareRecommendations.js'
import { extractStructuredRecommendation } from './extractRecommendation.js'
import { materialsFromState } from './materials.js'
import { planStabilityChecks } from './planChecks.js'
import { STABILITY_PROMPT_VERSION } from './types.js'

/**
 * @returns {string}
 */
function nid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * @param {Record<string, unknown>} state
 * @returns {import('./types.js').StabilityReport | null}
 */
export function createStabilityReportDraft(state) {
  const plan = planStabilityChecks(state)
  if (!plan.eligible) return null

  const debateId =
    typeof state.debateId === 'string' && state.debateId
      ? state.debateId
      : `session-${Date.now().toString(36)}`
  const baseSynthesisId = `base-synth-${debateId}`
  const synthesis = /** @type {any} */ (state.synthesis)
  const raw = String(synthesis?.output ?? '')
  const baseRecommendation = extractStructuredRecommendation(
    raw,
    synthesis?.decisionArtifact ?? null
  )

  const reportId = nid('stab-report')
  /** @type {import('./types.js').StabilityRun[]} */
  const runs = plan.checks.map((c) => ({
    stabilityRunId: nid('stab-run'),
    debateId,
    baseSynthesisId,
    type: c.type,
    status: /** @type {const} */ ('waiting'),
    label: c.label,
    excludedAgentId: c.excludedAgentId,
    excludedRoleId: c.excludedRoleId,
    excludedModelId: c.excludedModelId,
    arbiterModelId: c.arbiterModelId,
    arbiterName: c.arbiterName,
    synthesisPromptVersion: STABILITY_PROMPT_VERSION,
    attemptId: nid('attempt'),
  }))

  return {
    reportId,
    debateId,
    createdAt: new Date().toISOString(),
    status: 'confirming',
    baseSynthesisId,
    baseRecommendation,
    baseRawSynthesis: raw,
    runs,
    comparisons: [],
    limitations: [
      'Stability measures sensitivity to the tested configurations. It does not establish that the recommendation is correct.',
    ],
    plannedCallCount: plan.callCount,
    featureFlags: { panelRerun: false },
  }
}

/**
 * @param {{
 *   state: Record<string, unknown>,
 *   report: import('./types.js').StabilityReport,
 *   onUpdate: (report: import('./types.js').StabilityReport) => void,
 *   isActive?: () => boolean,
 *   pauseMs?: number,
 * }} opts
 */
export async function executeStabilityReport({
  state,
  report,
  onUpdate,
  isActive = () => true,
  pauseMs = 700,
}) {
  const config = /** @type {any} */ (state.config)
  const prompt = String(state.prompt ?? '')
  const criteria = /** @type {string[]} */ (
    /** @type {any} */ (state).decisionCriteria ?? []
  )
  const m = materialsFromState(state)
  const voices = materialsToVoiceBag(m)

  /** @type {import('./types.js').StabilityReport} */
  let current = {
    ...report,
    status: 'running',
    runs: report.runs.map((r) => ({ ...r })),
    comparisons: [...report.comparisons],
  }
  onUpdate(current)

  const pause = () =>
    new Promise((resolve) => window.setTimeout(resolve, pauseMs))

  for (let i = 0; i < current.runs.length; i++) {
    if (!isActive()) {
      current = {
        ...current,
        status: 'cancelled',
        runs: current.runs.map((r) =>
          r.status === 'waiting' || r.status === 'pending' || r.status === 'running'
            ? { ...r, status: 'cancelled' }
            : r
        ),
      }
      const derived = deriveStabilityOutcome(
        current.comparisons,
        current.runs
      )
      current = {
        ...current,
        outcome: derived.outcome,
        summary: derived.summary,
        limitations: derived.limitations,
      }
      onUpdate(current)
      return current
    }

    const run = current.runs[i]
    current = {
      ...current,
      runs: current.runs.map((r, idx) =>
        idx === i
          ? {
              ...r,
              status: 'running',
              startedAt: new Date().toISOString(),
              attemptId: nid('attempt'),
            }
          : r
      ),
    }
    onUpdate(current)

    const exclude =
      run.type === 'leave_one_out' ? run.excludedAgentId ?? null : null
    const catalog = buildStabilityClaimCatalog(voices, config, exclude)
    const userMsg = clipInferenceText(
      buildStabilitySynthesisUserMessage(
        prompt,
        voices,
        config,
        criteria,
        catalog,
        exclude
      )
    )

    const t0 = Date.now()
    try {
      const raw = await callGitHubModel(
        run.arbiterModelId,
        [{ role: 'user', content: userMsg }],
        SYNTHESIS_SYSTEM,
        {
          agentName: run.arbiterName || 'Stability arbiter',
          errorContext: { stage: 'synthesis', round: 3 },
        }
      )

      if (!isActive()) {
        // Stale; do not apply
        continue
      }

      const artifact = parseDecisionArtifact(raw)
      const structured = extractStructuredRecommendation(raw, artifact)
      const comparison = compareRecommendations(
        current.baseRecommendation,
        structured,
        {
          comparisonId: nid('stab-cmp'),
          baseSynthesisId: current.baseSynthesisId,
          comparedStabilityRunId: run.stabilityRunId,
        }
      )

      current = {
        ...current,
        runs: current.runs.map((r) =>
          r.stabilityRunId === run.stabilityRunId
            ? {
                ...r,
                status: 'complete',
                completedAt: new Date().toISOString(),
                rawSynthesisText: raw,
                structuredRecommendation: structured,
                usage: { durationMs: Date.now() - t0 },
                error: null,
              }
            : r
        ),
        comparisons: [
          ...current.comparisons.filter(
            (c) => c.comparedStabilityRunId !== run.stabilityRunId
          ),
          comparison,
        ],
      }
      onUpdate(current)
    } catch (e) {
      if (!isActive()) continue
      const babelErr = toBabelError(e, {
        scope: 'synthesis',
        stage: 'synthesis',
        agent: run.arbiterName,
        round: 3,
      })
      current = {
        ...current,
        runs: current.runs.map((r) =>
          r.stabilityRunId === run.stabilityRunId
            ? {
                ...r,
                status: 'failed',
                completedAt: new Date().toISOString(),
                error: {
                  message: babelErr.userMessage || babelErr.message || String(e),
                  code: babelErr.type,
                },
                usage: { durationMs: Date.now() - t0 },
              }
            : r
        ),
      }
      onUpdate(current)

      if (isInfrastructureBlocker(babelErr) && babelErr.type === 'rate_limit') {
        // Block remaining waiting runs, keep completed
        current = {
          ...current,
          runs: current.runs.map((r) =>
            r.status === 'waiting' || r.status === 'pending'
              ? {
                  ...r,
                  status: 'failed',
                  error: {
                    message:
                      'Stability check blocked by rate limiting. The debate itself is unchanged.',
                    code: 'rate_limit',
                  },
                }
              : r
          ),
        }
        break
      }
    }

    if (i < current.runs.length - 1) await pause()
  }

  const derived = deriveStabilityOutcome(current.comparisons, current.runs)
  current = {
    ...current,
    status: current.runs.every((r) => r.status === 'cancelled')
      ? 'cancelled'
      : current.runs.some((r) => r.status === 'complete')
        ? 'complete'
        : 'failed',
    outcome: derived.outcome,
    summary: derived.summary,
    limitations: derived.limitations,
  }
  onUpdate(current)
  return current
}

/**
 * Retry a single failed run inside an existing report.
 * @param {{
 *   state: Record<string, unknown>,
 *   report: import('./types.js').StabilityReport,
 *   stabilityRunId: string,
 *   onUpdate: (report: import('./types.js').StabilityReport) => void,
 *   isActive?: () => boolean,
 * }} opts
 */
export async function retryStabilityRun({
  state,
  report,
  stabilityRunId,
  onUpdate,
  isActive = () => true,
}) {
  const idx = report.runs.findIndex((r) => r.stabilityRunId === stabilityRunId)
  if (idx < 0) return report

  /** @type {import('./types.js').StabilityReport} */
  let current = {
    ...report,
    status: 'running',
    runs: report.runs.map((r) =>
      r.stabilityRunId === stabilityRunId
        ? {
            ...r,
            status: 'waiting',
            error: null,
            attemptId: nid('attempt'),
          }
        : r
    ),
  }

  // Run only the target by temporarily filtering
  const only = {
    ...current,
    runs: [current.runs[idx]],
  }
  const result = await executeStabilityReport({
    state,
    report: only,
    isActive,
    onUpdate: (partial) => {
      const updatedRun = partial.runs[0]
      const comparisons = [
        ...current.comparisons.filter(
          (c) => c.comparedStabilityRunId !== stabilityRunId
        ),
        ...partial.comparisons,
      ]
      current = {
        ...current,
        runs: current.runs.map((r) =>
          r.stabilityRunId === stabilityRunId ? updatedRun : r
        ),
        comparisons,
        status: 'running',
      }
      onUpdate(current)
    },
  })

  const mergedRuns = report.runs.map((r) =>
    r.stabilityRunId === stabilityRunId
      ? result.runs[0] ?? r
      : current.runs.find((x) => x.stabilityRunId === r.stabilityRunId) ?? r
  )
  const comparisons = [
    ...report.comparisons.filter(
      (c) => c.comparedStabilityRunId !== stabilityRunId
    ),
    ...result.comparisons,
  ]
  const derived = deriveStabilityOutcome(comparisons, mergedRuns)
  const finalReport = {
    ...report,
    status: 'complete',
    runs: mergedRuns,
    comparisons,
    outcome: derived.outcome,
    summary: derived.summary,
    limitations: derived.limitations,
  }
  onUpdate(finalReport)
  return finalReport
}
