/**
 * @typedef {import('./schema.js').EvaluationCondition} EvaluationCondition
 * @typedef {import('./schema.js').EvaluationMethod} EvaluationMethod
 * @typedef {import('./schema.js').EvaluationCriterion} EvaluationCriterion
 * @typedef {import('./schema.js').CaseStatus} CaseStatus
 * @typedef {import('./schema.js').CaseDomain} CaseDomain
 */

/**
 * @typedef {{
 *   criterion: EvaluationCriterion,
 *   method: EvaluationMethod,
 *   score?: number,
 *   scaleMin?: number,
 *   scaleMax?: number,
 *   evaluatorCount?: number,
 *   evaluatorModelIds?: string[],
 *   rationale?: string,
 *   limitations?: string,
 *   rubricVersion?: string,
 *   blinded?: boolean,
 *   judgePromptVersion?: string,
 * }} EvaluationScore
 */

/**
 * @typedef {{
 *   durationMs?: number,
 *   inputTokens?: number,
 *   outputTokens?: number,
 *   estimatedCostUsd?: number,
 *   callsAttempted?: number,
 *   callsSucceeded?: number,
 *   completedWithGaps?: boolean,
 * }} RunMetrics
 */

/**
 * @typedef {{
 *   condition: EvaluationCondition,
 *   modelIds: string[],
 *   roleAssignments?: { roleId: string, modelId: string }[],
 *   promptVersion: string,
 *   orchestrationVersion?: string,
 *   outputText?: string,
 *   outputSections?: unknown,
 *   sideBySideOutputs?: { modelId: string, text?: string }[],
 *   babelRounds?: {
 *     round1?: { modelId: string, roleId?: string, text?: string }[],
 *     round2?: { modelId: string, roleId?: string, text?: string }[],
 *     round3?: { modelId: string, roleId?: string, text?: string }[],
 *     synthesis?: string,
 *   },
 *   sourceDebateId?: string,
 *   metrics: RunMetrics,
 *   scores: EvaluationScore[],
 *   failureNotes?: string[],
 *   developmentFixture?: boolean,
 * }} EvaluationArtifact
 */

/**
 * @typedef {{
 *   id: string,
 *   slug: string,
 *   title: string,
 *   status: CaseStatus,
 *   domain: CaseDomain,
 *   prompt: string,
 *   decisionCriteria?: string[],
 *   whyThisCase: string,
 *   knownDifficulty?: string,
 *   expectedFailureModes?: string[],
 *   createdAt: string,
 *   publishedAt?: string,
 *   datasetVersion: string,
 *   artifacts: EvaluationArtifact[],
 *   caseConclusion?: string,
 *   whatBabelImproved?: string,
 *   whereBabelDidNotHelp?: string,
 *   limitations: string[],
 *   archiveReason?: string,
 *   changelog?: { at: string, note: string }[],
 *   conciseFinding?: string,
 *   developmentFixture?: boolean,
 * }} EvaluationCase
 */

export {}
