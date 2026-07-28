/**
 * Defensible aggregates; never treat missing values as zero.
 */

import { listPublishedCases } from './loadCases.js'

/**
 * @param {import('./labTypes.js').EvaluationCase[]} cases
 */
export function computeLabSummary(cases) {
  const published = listPublishedCases(cases)
  const publishedCount = published.length

  if (publishedCount === 0) {
    return {
      ready: false,
      publishedCount: 0,
      message:
        'More cases are needed before aggregate results are reported.',
    }
  }

  // Require a minimum set before showing comparative aggregates
  const MIN_FOR_AGGREGATES = 3
  if (publishedCount < MIN_FOR_AGGREGATES) {
    return {
      ready: false,
      publishedCount,
      message:
        'More cases are needed before aggregate results are reported.',
      note: `${publishedCount} published case${publishedCount === 1 ? '' : 's'} available for inspection.`,
    }
  }

  /** @type {Record<string, number[]>} */
  const durationsByCondition = {
    single_model: [],
    side_by_side: [],
    babel: [],
  }
  let babelRuns = 0
  let babelWithGaps = 0
  let babelHighestHuman = 0
  let babelDidNotOutperform = 0

  for (const c of published) {
    for (const a of c.artifacts) {
      if (
        a.metrics?.durationMs != null &&
        Number.isFinite(a.metrics.durationMs)
      ) {
        durationsByCondition[a.condition]?.push(a.metrics.durationMs)
      }
      if (a.condition === 'babel') {
        babelRuns += 1
        if (a.metrics?.completedWithGaps === true) babelWithGaps += 1
      }
    }

    const humanTotals = /** @type {Record<string, number[]>} */ ({})
    for (const a of c.artifacts) {
      const scores = a.scores.filter(
        (s) =>
          s.method === 'human' &&
          s.score != null &&
          Number.isFinite(s.score)
      )
      if (!scores.length) continue
      const avg =
        scores.reduce((sum, s) => sum + /** @type {number} */ (s.score), 0) /
        scores.length
      if (!humanTotals[a.condition]) humanTotals[a.condition] = []
      humanTotals[a.condition].push(avg)
    }
    const means = Object.fromEntries(
      Object.entries(humanTotals).map(([k, arr]) => [
        k,
        arr.reduce((s, n) => s + n, 0) / arr.length,
      ])
    )
    if (
      means.babel != null &&
      means.single_model != null &&
      means.side_by_side != null
    ) {
      const babelBest =
        means.babel >= means.single_model &&
        means.babel >= means.side_by_side
      if (babelBest) babelHighestHuman += 1
      else babelDidNotOutperform += 1
    }
  }

  /** @param {number[]} arr */
  function median(arr) {
    if (!arr.length) return null
    const sorted = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
  }

  return {
    ready: true,
    publishedCount,
    babelHighestHuman:
      babelHighestHuman + babelDidNotOutperform > 0
        ? babelHighestHuman
        : null,
    babelDidNotOutperform:
      babelHighestHuman + babelDidNotOutperform > 0
        ? babelDidNotOutperform
        : null,
    medianDurationMs: {
      single_model: median(durationsByCondition.single_model),
      side_by_side: median(durationsByCondition.side_by_side),
      babel: median(durationsByCondition.babel),
    },
    babelCompletedWithGapsPct:
      babelRuns > 0 ? Math.round((babelWithGaps / babelRuns) * 100) : null,
  }
}
