/**
 * Load and validate versioned evaluation cases from the data directory.
 * Malformed files are skipped with a warning. They must not crash the Lab.
 */

import { validateCase } from './schema.js'
import manifest from '../../data/evaluations/manifest.json'

const caseModules = import.meta.glob('../../data/evaluations/cases/*.json', {
  eager: true,
})

/**
 * @returns {{
 *   datasetVersion: string,
 *   cases: import('./labTypes.js').EvaluationCase[],
 *   loadErrors: { file: string, error: string }[],
 * }}
 */
export function loadEvaluationCatalog() {
  /** @type {import('./labTypes.js').EvaluationCase[]} */
  const cases = []
  /** @type {{ file: string, error: string }[]} */
  const loadErrors = []

  for (const [path, mod] of Object.entries(caseModules)) {
    const raw =
      mod && typeof mod === 'object' && 'default' in mod
        ? /** @type {{ default: unknown }} */ (mod).default
        : mod
    const result = validateCase(raw)
    if (!result.ok) {
      loadErrors.push({ file: path, error: result.error })
      console.warn('[babel:lab] skipped malformed case', path, result.error)
      continue
    }
    cases.push(result.value)
  }

  cases.sort((a, b) => a.title.localeCompare(b.title))

  return {
    datasetVersion:
      typeof manifest?.datasetVersion === 'string'
        ? manifest.datasetVersion
        : 'unknown',
    cases,
    loadErrors,
  }
}

/**
 * Public index: published cases only.
 * @param {import('./labTypes.js').EvaluationCase[]} cases
 */
export function listPublishedCases(cases) {
  return cases.filter((c) => c.status === 'published')
}

/**
 * Direct link may open archived cases; drafts stay private unless allowDrafts.
 * @param {import('./labTypes.js').EvaluationCase[]} cases
 * @param {string} slug
 * @param {{ allowDrafts?: boolean }} [opts]
 */
export function findCaseBySlug(cases, slug, opts = {}) {
  const c = cases.find((x) => x.slug === slug)
  if (!c) return null
  if (c.status === 'published' || c.status === 'archived') return c
  if (opts.allowDrafts && c.status === 'draft') return c
  return null
}

/**
 * @param {import('./labTypes.js').EvaluationCase} c
 * @param {import('./schema.js').EvaluationCondition} condition
 */
export function artifactForCondition(c, condition) {
  return c.artifacts.find((a) => a.condition === condition) ?? null
}

/**
 * Strip fields that must never appear on public pages.
 * @param {import('./labTypes.js').EvaluationCase} c
 * @returns {import('./labTypes.js').EvaluationCase}
 */
export function publicCaseView(c) {
  return {
    ...c,
    artifacts: c.artifacts.map((a) => {
      const { sourceDebateId: _drop, ...rest } = a
      void _drop
      return {
        ...rest,
        // Keep a redacted placeholder only if present; never show private IDs
        sourceDebateId: undefined,
      }
    }),
  }
}
