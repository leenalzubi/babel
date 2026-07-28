/**
 * Deterministic comparison of structured recommendations.
 * Does not use string equality as the primary stability test.
 */

import { normalizeCondition } from './extractRecommendation.js'

/**
 * @param {string[]} a
 * @param {string[]} b
 */
function setDiff(a, b) {
  const nb = new Set(b.map(normalizeCondition).filter(Boolean))
  const na = new Set(a.map(normalizeCondition).filter(Boolean))
  /** @type {string[]} */
  const added = []
  /** @type {string[]} */
  const removed = []
  for (const orig of b) {
    const k = normalizeCondition(orig)
    if (k && !na.has(k)) added.push(orig)
  }
  for (const orig of a) {
    const k = normalizeCondition(orig)
    if (k && !nb.has(k)) removed.push(orig)
  }
  return { added, removed }
}

/**
 * @param {import('./types.js').StructuredRecommendation} base
 * @param {import('./types.js').StructuredRecommendation} variant
 * @param {{ comparisonId: string, baseSynthesisId: string, comparedStabilityRunId: string }} ids
 * @returns {import('./types.js').StabilityComparison}
 */
export function compareRecommendations(base, variant, ids) {
  if (
    !base ||
    base.extractionMethod === 'unavailable' ||
    !variant ||
    variant.extractionMethod === 'unavailable' ||
    (!variant.recommendationText && variant.verdict === 'no_recommendation')
  ) {
    const noRec =
      variant &&
      !variant.recommendationText &&
      (variant.verdict === 'no_recommendation' ||
        variant.extractionMethod === 'unavailable')
    if (
      noRec &&
      base?.recommendationText &&
      base.extractionMethod !== 'unavailable'
    ) {
      return {
        ...ids,
        relationship: 'no_clear_recommendation',
        verdictChanged: true,
        changedConditions: [],
        addedConditions: [],
        removedConditions: [],
        changedRationales: [],
        changedRisks: [],
        explanation:
          'The stability run did not produce an actionable recommendation that could be compared.',
        comparisonMethod: 'deterministic',
        limitations: ['Variant recommendation was empty or unparsable.'],
      }
    }
    return {
      ...ids,
      relationship: 'comparison_unavailable',
      verdictChanged: false,
      changedConditions: [],
      addedConditions: [],
      removedConditions: [],
      changedRationales: [],
      changedRisks: [],
      explanation:
        'The system could not parse or compare the recommendations reliably.',
      comparisonMethod: 'unavailable',
      limitations: [
        'Structured recommendation extraction failed for one or both outputs.',
      ],
    }
  }

  const verdictChanged = base.verdict !== variant.verdict
  const cond = setDiff(base.requiredConditions, variant.requiredConditions)
  const rat = setDiff(base.primaryRationale, variant.primaryRationale)
  const risk = setDiff(base.keyRisks, variant.keyRisks)

  const materialConditionChange =
    cond.added.length > 0 || cond.removed.length > 0

  /** Material decision change: verdict category or empty↔nonempty recommendation */
  const baseHas = Boolean(base.recommendationText?.trim())
  const varHas = Boolean(variant.recommendationText?.trim())
  const decisionFlip =
    verdictChanged ||
    (baseHas && !varHas) ||
    (!baseHas && varHas) ||
    (base.verdict === 'support' && variant.verdict === 'oppose') ||
    (base.verdict === 'oppose' && variant.verdict === 'support') ||
    (base.verdict === 'support' && variant.verdict === 'defer') ||
    (base.verdict === 'oppose' && variant.verdict === 'defer')

  /** @type {import('./types.js').RecommendationRelationship} */
  let relationship = 'same'
  /** @type {string} */
  let explanation = 'The recommended action and material conditions are unchanged (wording may differ).'

  if (!varHas && baseHas) {
    relationship = 'no_clear_recommendation'
    explanation =
      'The variant run did not produce a clear actionable recommendation.'
  } else if (decisionFlip && verdictChanged) {
    relationship = 'meaningfully_different'
    explanation = `The verdict changed from “${base.verdict}” to “${variant.verdict}”.`
  } else if (decisionFlip && !verdictChanged) {
    relationship = 'meaningfully_different'
    explanation =
      'The presence or actionability of the recommendation changed between base and variant.'
  } else if (materialConditionChange) {
    relationship = 'same_with_changed_conditions'
    const parts = []
    if (cond.removed.length) {
      parts.push(`conditions removed: ${cond.removed.slice(0, 2).join('; ')}`)
    }
    if (cond.added.length) {
      parts.push(`conditions added: ${cond.added.slice(0, 2).join('; ')}`)
    }
    explanation = `The high-level action remained “${base.verdict}”, but material conditions changed (${parts.join('; ')}).`
  } else {
    relationship = 'same'
  }

  return {
    ...ids,
    relationship,
    verdictChanged,
    changedConditions: [...cond.added, ...cond.removed],
    addedConditions: cond.added,
    removedConditions: cond.removed,
    changedRationales: [...rat.added, ...rat.removed],
    changedRisks: [...risk.added, ...risk.removed],
    explanation,
    comparisonMethod: 'deterministic',
    limitations:
      base.extractionMethod === 'heuristic' ||
      variant.extractionMethod === 'heuristic'
        ? [
            'One or both recommendations were extracted heuristically from prose; treat comparison as approximate.',
          ]
        : undefined,
  }
}

/**
 * @param {import('./types.js').StabilityComparison[]} comparisons
 * @param {import('./types.js').StabilityRun[]} runs
 * @returns {{
 *   outcome: import('./types.js').StabilityOutcome,
 *   summary: string,
 *   limitations: string[],
 * }}
 */
export function deriveStabilityOutcome(comparisons, runs) {
  const completed = runs.filter((r) => r.status === 'complete')
  const failed = runs.filter((r) => r.status === 'failed')
  const usable = comparisons.filter(
    (c) => c.relationship !== 'comparison_unavailable'
  )

  /** @type {string[]} */
  const limitations = [
    'Stability measures sensitivity to the tested configurations. It does not establish that the recommendation is correct.',
  ]

  if (completed.length === 0) {
    return {
      outcome: 'insufficient_completed_checks',
      summary: 'No stability checks completed successfully.',
      limitations: [
        ...limitations,
        failed.length
          ? `${failed.length} check(s) failed before producing a comparable result.`
          : 'Checks were cancelled or never started.',
      ],
    }
  }

  if (usable.length === 0) {
    return {
      outcome: 'insufficient_completed_checks',
      summary:
        'Checks completed but comparisons were unavailable for all variants.',
      limitations,
    }
  }

  const different = usable.filter(
    (c) => c.relationship === 'meaningfully_different'
  )
  const condChanged = usable.filter(
    (c) => c.relationship === 'same_with_changed_conditions'
  )
  const same = usable.filter((c) => c.relationship === 'same')
  const noRec = usable.filter(
    (c) => c.relationship === 'no_clear_recommendation'
  )

  const looSensitive = different.filter((c) => {
    const run = runs.find((r) => r.stabilityRunId === c.comparedStabilityRunId)
    return run?.type === 'leave_one_out'
  })

  let outcome
  /** @type {string} */
  let summary

  if (different.length === 0 && condChanged.length === 0 && noRec.length === 0) {
    outcome = 'stable_across_tested_configurations'
    summary = `${same.length} of ${usable.length} completed comparison(s) kept the same recommendation and material conditions.`
  } else if (different.length === 0 && condChanged.length > 0) {
    outcome = 'stable_with_condition_changes'
    summary = `The action remained the same across completed checks, but material conditions changed in ${condChanged.length} variant(s).`
  } else if (looSensitive.length > 0) {
    outcome = 'sensitive_to_one_or_more_voices'
    const run = runs.find(
      (r) => r.stabilityRunId === looSensitive[0].comparedStabilityRunId
    )
    const who =
      run?.excludedRoleId ||
      run?.excludedModelId ||
      run?.excludedAgentId ||
      'one voice'
    summary = `${different.length} of ${usable.length} completed comparison(s) changed the recommendation. Sensitive to ${who}: ${looSensitive[0].explanation}`
  } else if (different.length > 0 && same.length > 0) {
    outcome = 'mixed_or_inconclusive'
    summary = `${same.length} check(s) matched the base recommendation; ${different.length} differed. Results are mixed across tested configurations.`
  } else if (different.length > 0) {
    outcome = 'mixed_or_inconclusive'
    summary = `Completed checks produced meaningfully different recommendations (${different[0].explanation}).`
  } else {
    outcome = 'mixed_or_inconclusive'
    summary = 'Completed checks did not yield a single clear stability pattern.'
  }

  if (failed.length) {
    limitations.push(
      `${failed.length} check(s) failed; the report is based on completed checks only.`
    )
  }
  if (completed.length < 2) {
    limitations.push(
      'Fewer than two successful stability runs completed; do not treat the outcome as strong evidence of robustness.'
    )
  }

  return { outcome, summary, limitations }
}
