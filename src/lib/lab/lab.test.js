import { describe, expect, it } from 'vitest'
import {
  formatMetricDisplay,
  formatScoreDisplay,
  validateCase,
  validateArtifact,
} from './schema.js'
import { computeLabSummary } from './aggregates.js'
import { findCaseBySlug, listPublishedCases, publicCaseView } from './loadCases.js'
import { scrubPrivateFields } from './privacy.js'
import { debateStateToArtifact } from './importArtifact.js'

const baseCase = {
  id: 'c1',
  slug: 'sample',
  title: 'Sample',
  status: 'published',
  domain: 'product',
  prompt: 'Should we ship?',
  whyThisCase: 'Because.',
  createdAt: '2026-07-26T00:00:00.000Z',
  datasetVersion: '2026-07-26',
  limitations: ['None yet'],
  whereBabelDidNotHelp: 'Not evaluated.',
  artifacts: [
    {
      condition: 'single_model',
      modelIds: ['openai/gpt-4o-mini'],
      promptVersion: 'v1',
      metrics: {},
      scores: [],
    },
    {
      condition: 'side_by_side',
      modelIds: ['a', 'b', 'c'],
      promptVersion: 'v1',
      metrics: {},
      scores: [],
    },
    {
      condition: 'babel',
      modelIds: ['a', 'b', 'c'],
      promptVersion: 'v1',
      metrics: {},
      scores: [],
    },
  ],
}

describe('Babel Lab schema', () => {
  it('validates a published case with three conditions', () => {
    const r = validateCase(baseCase)
    expect(r.ok).toBe(true)
  })

  it('requires archiveReason for archived cases', () => {
    const r = validateCase({ ...baseCase, status: 'archived' })
    expect(r.ok).toBe(false)
  })

  it('formats missing scores and metrics honestly', () => {
    expect(formatScoreDisplay(null)).toBe('Not evaluated')
    expect(formatScoreDisplay({ criterion: 'actionability', method: 'not_evaluated' })).toBe(
      'Not evaluated'
    )
    expect(formatMetricDisplay(undefined)).toBe('Not recorded')
    expect(formatMetricDisplay(null)).toBe('Not recorded')
  })

  it('labels human and llm methods separately in score objects', () => {
    const human = validateArtifact({
      condition: 'babel',
      modelIds: ['m'],
      promptVersion: 'v1',
      metrics: {},
      scores: [
        {
          criterion: 'traceability',
          method: 'human',
          score: 4,
          scaleMin: 1,
          scaleMax: 5,
          rationale: 'Creator evaluation using rubric v1',
        },
        {
          criterion: 'actionability',
          method: 'llm_judge',
          score: 3,
          evaluatorModelIds: ['judge-model'],
        },
      ],
    })
    expect(human.ok).toBe(true)
    if (human.ok) {
      expect(human.value.scores[0].method).toBe('human')
      expect(human.value.scores[1].method).toBe('llm_judge')
      expect(formatScoreDisplay(human.value.scores[0])).toContain('4')
    }
  })
})

describe('catalog visibility', () => {
  it('hides draft cases from public list', () => {
    const cases = [
      { ...baseCase, slug: 'pub', status: 'published' },
      { ...baseCase, id: 'd', slug: 'drafty', status: 'draft' },
    ]
    const published = listPublishedCases(/** @type {any} */ (cases))
    expect(published.map((c) => c.slug)).toEqual(['pub'])
    expect(findCaseBySlug(/** @type {any} */ (cases), 'drafty')).toBeNull()
    expect(
      findCaseBySlug(/** @type {any} */ (cases), 'drafty', { allowDrafts: true })
        ?.slug
    ).toBe('drafty')
  })

  it('keeps archived cases reachable by direct slug', () => {
    const cases = [
      {
        ...baseCase,
        slug: 'old',
        status: 'archived',
        archiveReason: 'Superseded by clearer prompt',
      },
    ]
    const r = validateCase(cases[0])
    expect(r.ok).toBe(true)
    expect(findCaseBySlug(/** @type {any} */ (cases), 'old')?.slug).toBe('old')
  })

  it('strips private debate ids from public view', () => {
    const c = publicCaseView(
      /** @type {any} */ ({
        ...baseCase,
        artifacts: [
          {
            ...baseCase.artifacts[0],
            sourceDebateId: 'private-uuid',
          },
        ],
      })
    )
    expect(c.artifacts[0].sourceDebateId).toBeUndefined()
  })
})

describe('aggregates', () => {
  it('does not report misleading aggregates with fewer than 3 published cases', () => {
    const summary = computeLabSummary(/** @type {any} */ ([baseCase]))
    expect(summary.ready).toBe(false)
    expect(summary.message).toMatch(/More cases are needed/i)
  })

  it('excludes missing durations from medians', () => {
    const cases = [1, 2, 3].map((n) => ({
      ...baseCase,
      id: `c${n}`,
      slug: `c${n}`,
      artifacts: [
        {
          condition: 'babel',
          modelIds: ['m'],
          promptVersion: 'v1',
          metrics: n === 1 ? { durationMs: 1000 } : {},
          scores: [],
        },
      ],
    }))
    const summary = computeLabSummary(/** @type {any} */ (cases))
    expect(summary.ready).toBe(true)
    expect(summary.medianDurationMs.babel).toBe(1000)
  })
})

describe('malformed cases', () => {
  it('reject invalid condition without throwing', () => {
    const r = validateCase({
      ...baseCase,
      artifacts: [
        {
          condition: 'telepathy',
          modelIds: ['m'],
          promptVersion: 'v1',
          metrics: {},
          scores: [],
        },
      ],
    })
    expect(r.ok).toBe(false)
  })
})

describe('privacy scrub', () => {
  it('removes tokens and user ids', () => {
    const scrubbed = scrubPrivateFields({
      authorization: 'Bearer secret',
      userId: 'u1',
      modelIds: ['m'],
      nested: { api_key: 'x', keep: 1 },
    })
    expect(scrubbed.authorization).toBeUndefined()
    expect(scrubbed.userId).toBeUndefined()
    expect(/** @type {any} */ (scrubbed).nested.api_key).toBeUndefined()
    expect(/** @type {any} */ (scrubbed).nested.keep).toBe(1)
  })
})

describe('import adapter', () => {
  it('builds a draft babel artifact and never auto-publishes', () => {
    const result = debateStateToArtifact({
      status: 'complete',
      prompt: 'Should we ship?',
      config: {
        agentA: { name: 'GPT', model: 'openai/gpt-4o-mini' },
        agentB: { name: 'Phi', model: 'microsoft/phi-4' },
        agentC: { name: 'Mistral', model: 'mistralai/mistral-small' },
      },
      roles: { a: 'skeptic', b: 'researcher', c: 'operator' },
      rounds: [{ roundNum: 1, agentA: 'A', agentB: 'B', agentC: 'C' }],
      reviews: [],
      finalPositions: {},
      synthesis: { output: 'Synthesis text' },
    })
    expect(result.neverAutoPublish).toBe(true)
    expect(result.status).toBe('draft')
    expect(result.artifact?.condition).toBe('babel')
    expect(result.artifact?.outputText).toBe('Synthesis text')
  })
})
