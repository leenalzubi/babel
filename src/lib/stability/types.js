/**
 * Conclusion stability check: types (JSDoc).
 * Sensitivity test of Babel's synthesis, not proof of truth.
 */

/**
 * @typedef {'repeat_synthesis' | 'leave_one_out' | 'alternate_arbiter' | 'panel_rerun'} StabilityCheckType
 * @typedef {'same' | 'same_with_changed_conditions' | 'meaningfully_different' | 'no_clear_recommendation' | 'comparison_unavailable'} RecommendationRelationship
 * @typedef {'pending' | 'waiting' | 'running' | 'complete' | 'failed' | 'cancelled' | 'unavailable'} StabilityRunStatus
 * @typedef {'support' | 'oppose' | 'conditional' | 'defer' | 'no_recommendation' | 'other'} VerdictKind
 * @typedef {'stable_across_tested_configurations' | 'stable_with_condition_changes' | 'sensitive_to_one_or_more_voices' | 'mixed_or_inconclusive' | 'insufficient_completed_checks'} StabilityOutcome
 */

/**
 * @typedef {{
 *   verdict: VerdictKind,
 *   recommendationText: string,
 *   requiredConditions: string[],
 *   primaryRationale: string[],
 *   keyRisks: string[],
 *   nextStep?: string,
 *   extractionMethod?: 'structured_json' | 'artifact_sections' | 'heuristic' | 'unavailable',
 * }} StructuredRecommendation
 */

/**
 * @typedef {{
 *   stabilityRunId: string,
 *   debateId: string,
 *   baseSynthesisId: string,
 *   type: StabilityCheckType,
 *   status: StabilityRunStatus,
 *   label: string,
 *   excludedAgentId?: 'a' | 'b' | 'c',
 *   excludedRoleId?: string,
 *   excludedModelId?: string,
 *   arbiterModelId: string,
 *   arbiterName?: string,
 *   synthesisPromptVersion: string,
 *   attemptId: string,
 *   startedAt?: string,
 *   completedAt?: string,
 *   rawSynthesisText?: string,
 *   structuredRecommendation?: StructuredRecommendation,
 *   error?: { message?: string, code?: string } | null,
 *   usage?: {
 *     durationMs?: number,
 *     inputTokens?: number,
 *     outputTokens?: number,
 *     estimatedCostUsd?: number,
 *   },
 * }} StabilityRun
 */

/**
 * @typedef {{
 *   comparisonId: string,
 *   baseSynthesisId: string,
 *   comparedStabilityRunId: string,
 *   relationship: RecommendationRelationship,
 *   verdictChanged: boolean,
 *   changedConditions: string[],
 *   addedConditions: string[],
 *   removedConditions: string[],
 *   changedRationales: string[],
 *   changedRisks: string[],
 *   explanation: string,
 *   comparisonMethod: 'deterministic' | 'structured' | 'llm_assisted' | 'unavailable',
 *   limitations?: string[],
 * }} StabilityComparison
 */

/**
 * @typedef {{
 *   reportId: string,
 *   debateId: string,
 *   createdAt: string,
 *   status: 'planning' | 'confirming' | 'running' | 'complete' | 'cancelled' | 'failed',
 *   baseSynthesisId: string,
 *   baseRecommendation: StructuredRecommendation,
 *   baseRawSynthesis?: string,
 *   runs: StabilityRun[],
 *   comparisons: StabilityComparison[],
 *   outcome?: StabilityOutcome,
 *   summary?: string,
 *   limitations: string[],
 *   plannedCallCount: number,
 *   featureFlags?: { panelRerun?: boolean },
 * }} StabilityReport
 */

export const STABILITY_PROMPT_VERSION = 'stability-synth-v1'
export const COMPARISON_PROMPT_VERSION = 'stability-compare-v1'

export const OUTCOME_LABELS = {
  stable_across_tested_configurations: 'Stable across tested configurations',
  stable_with_condition_changes: 'Stable, with changed conditions',
  sensitive_to_one_or_more_voices: 'Sensitive to one or more voices',
  mixed_or_inconclusive: 'Mixed or inconclusive',
  insufficient_completed_checks: 'Not enough checks completed',
}

export const RELATIONSHIP_LABELS = {
  same: 'Same recommendation',
  same_with_changed_conditions: 'Same, with changed conditions',
  meaningfully_different: 'Meaningfully different',
  no_clear_recommendation: 'No clear recommendation',
  comparison_unavailable: 'Comparison unavailable',
}

/** Future work (not exposed in production UI). */
export const STABILITY_FUTURE_FLAGS = {
  panel_rerun: false,
  role_permutation: false,
}

export {}
