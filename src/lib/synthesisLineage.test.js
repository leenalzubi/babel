import { describe, expect, it, vi } from 'vitest'
import {
  buildClaimRegistry,
  buildLineageBundle,
  buildVoiceRecords,
  enrichSynthesisFindings,
  evidenceLabel,
  normalizeClaimId,
  responseIdFor,
} from './synthesisLineage.js'
import { parseDecisionArtifact } from './parseDecisionArtifact.js'
import {
  parseRound1Structure,
  parseRound3Structure,
} from './parseStructuredResponse.js'

function makeState(overrides = {}) {
  return {
    debateId: 'debate-test-1',
    config: {
      agentA: { name: 'GPT', model: 'gpt-4o-mini', color: '#000' },
      agentB: { name: 'Phi', model: 'phi-4', color: '#111' },
      agentC: { name: 'Mistral', model: 'mistral-small', color: '#222' },
    },
    roles: { a: 'skeptic', b: 'researcher', c: 'operator' },
    decisionCriteria: ['reversibility'],
    rounds: [
      {
        roundNum: 1,
        agentA: 'RAW_A_R1 exact text <script>alert(1)</script>',
        agentB: 'RAW_B_R1',
        agentC: 'RAW_C_R1',
      },
    ],
    reviews: [
      {
        roundNum: 1,
        aReviews: 'Challenge on evidence.',
        bReviews: 'Counter B',
        cReviews: 'Counter C',
      },
    ],
    finalPositions: {
      a: 'A-C1 narrowed: safer scope',
      b: 'preserved A-C1',
      c: 'withdrawn',
    },
    structures: {
      round1: {
        a: {
          extraction: 'structured',
          claims: [
            {
              id: 'A-C1',
              text: 'Deploy behind a feature flag',
              evidence: ['blog post X'],
            },
          ],
        },
        b: {
          extraction: 'structured',
          claims: [{ id: 'B-C1', text: 'Need more data', evidence: [] }],
        },
        c: {
          extraction: 'structured',
          claims: [{ id: 'C-C1', text: 'Ship next week', evidence: [] }],
        },
      },
      round2: {
        b: {
          extraction: 'structured',
          counterpoints: [
            {
              text: 'Feature flag evidence is thin',
              targetClaimId: 'A-C1',
              linked: true,
            },
          ],
        },
      },
      round3: {
        a: {
          extraction: 'structured',
          changes: [
            {
              claimId: 'A-C1',
              action: 'narrowed',
              revisedId: 'A-C1′',
              text: 'Deploy behind a flag for internal users only',
              reason: 'Researcher challenged evidence breadth',
            },
          ],
        },
        c: {
          extraction: 'structured',
          changes: [
            {
              claimId: 'C-C1',
              action: 'withdrawn',
              revisedId: null,
              text: '',
              reason: 'Irreversible if wrong',
            },
          ],
        },
      },
    },
    synthesis: {
      output: '',
      attributions: { a: '', b: '', c: '' },
      rationale: '',
      decisionArtifact: {
        findings: [
          {
            id: 'agreement',
            kind: 'agreement',
            text: 'Flagged rollout is preferred (A-C1′).',
            claimIds: ['A-C1′', 'B-C1'],
            challengingClaimIds: ['B-CP1'],
          },
          {
            id: 'disagreement',
            kind: 'disagreement',
            text: 'Speed vs caution.',
            claimIds: ['FAKE-ID', 'C-C1'],
          },
        ],
        framed: '',
        agreement: '',
        disagreement: '',
        strongestSupport: '',
        weakestAssumptions: '',
        minorityReport: '',
        whatWouldChange: '',
        recommendedNextStep: '',
      },
    },
    ...overrides,
  }
}

describe('synthesis lineage IDs and raw preservation', () => {
  it('uses stable response IDs, not array indexes', () => {
    expect(responseIdFor('a', 1)).toBe('voice-r1-a')
    expect(responseIdFor('c', 3)).toBe('voice-r3-c')
  })

  it('preserves original raw response text unchanged', () => {
    const state = makeState()
    const voices = buildVoiceRecords(state)
    expect(voices['voice-r1-a'].rawText).toBe(
      'RAW_A_R1 exact text <script>alert(1)</script>'
    )
    const registry = buildClaimRegistry(state)
    expect(registry[normalizeClaimId('A-C1')].text).toBe(
      'Deploy behind a feature flag'
    )
    expect(voices['voice-r1-a'].rawText).toContain('<script>')
  })

  it('links a revised claim to its earlier claim without overwriting R1 text', () => {
    const registry = buildClaimRegistry(makeState())
    const prior = registry[normalizeClaimId('A-C1')]
    const revised = registry[normalizeClaimId('A-C1′')]
    expect(prior.text).toBe('Deploy behind a feature flag')
    expect(revised.supersedesClaimId).toBe(normalizeClaimId('A-C1'))
    expect(prior.revisedByClaimId).toBe(normalizeClaimId('A-C1′'))
    expect(revised.evolution).toBe('narrowed')
  })
})

describe('enrichSynthesisFindings', () => {
  it('renders complete lineage when cited IDs resolve', () => {
    const state = makeState()
    const registry = buildClaimRegistry(state)
    const { findings, invalidReferences } = enrichSynthesisFindings(
      state.synthesis.decisionArtifact,
      registry,
      { hasStructures: true }
    )
    const agreement = findings.find((f) => f.findingId === 'agreement')
    expect(agreement?.lineageStatus).toBe('complete')
    expect(agreement?.supportingClaimIds).toContain('A-C1′')
    expect(agreement?.supportingClaimIds).toContain('B-C1')
    expect(invalidReferences.filter((x) => x.findingId === 'agreement')).toHaveLength(
      0
    )
  })

  it('marks partial lineage and removes invalid claim IDs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const state = makeState()
    const bundle = buildLineageBundle(state)
    const disagreement = bundle.findings.find((f) => f.findingId === 'disagreement')
    expect(disagreement?.supportingClaimIds).not.toContain('FAKE-ID')
    expect(disagreement?.lineageStatus).toMatch(/partial|unavailable/)
    expect(bundle.invalidReferences.some((x) => x.claimId === 'FAKE-ID')).toBe(
      true
    )
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('does not present a withdrawn claim as supporting', () => {
    const state = makeState()
    const registry = buildClaimRegistry(state)
    const { findings } = enrichSynthesisFindings(
      {
        findings: [
          {
            id: 'agreement',
            kind: 'agreement',
            text: 'Ship now',
            claimIds: ['C-C1'],
          },
        ],
      },
      registry,
      { hasStructures: true }
    )
    const f = findings[0]
    expect(f.supportingClaimIds).not.toContain('C-C1')
    expect(f.relatedClaimIds).toContain('C-C1')
    expect(f.lineageStatus).toBe('partial')
  })

  it('shows unavailable lineage for legacy debates without structures', () => {
    const state = makeState({
      structures: { round1: {}, round2: {}, round3: {} },
      synthesis: {
        output: 'Plain legacy synthesis with no markers.',
        attributions: { a: '', b: '', c: '' },
        rationale: '',
        decisionArtifact: null,
      },
    })
    const bundle = buildLineageBundle(state)
    expect(bundle.debateLineageStatus).toBe('unavailable')
    expect(bundle.registry).toEqual({})
  })

  it('legacy artifact without registry still enriches as unavailable', () => {
    const { findings, debateLineageStatus } = enrichSynthesisFindings(
      {
        findings: [
          {
            id: 'framed',
            kind: 'frame',
            text: 'Old debate frame',
            claimIds: ['A-C1'],
          },
        ],
      },
      {},
      { hasStructures: false }
    )
    expect(debateLineageStatus).toBe('unavailable')
    expect(findings[0].lineageStatus).toBe('unavailable')
    expect(findings[0].supportingClaimIds).toEqual([])
  })
})

describe('evidence language', () => {
  it('defaults to not independently verified', () => {
    expect(evidenceLabel('not_checked')).toBe('Not independently verified')
    expect(evidenceLabel('model_supplied')).toBe('Citation supplied by model')
  })
})

describe('extraction failure fallback', () => {
  it('falls back to raw_response structure without replacing raw text', () => {
    const raw = 'This is free prose with no claim markers.'
    const parsed = parseRound1Structure(raw, 'a')
    expect(parsed.raw).toBe(raw)
    expect(['raw_response', 'structure_failed', 'partially_structured']).toContain(
      parsed.extraction
    )
  })
})

describe('FINDINGS-JSON parse', () => {
  it('parses structured findings and keeps section text', () => {
    const text = `---FRAMED---
Decide whether to ship.

---AGREEMENT---
Flags help (A-C1).

---FINDINGS-JSON---
[
  {
    "findingId": "agreement",
    "type": "agreement",
    "text": "Flags help",
    "supportingClaimIds": ["A-C1"],
    "challengingClaimIds": []
  }
]

---ATTRIBUTIONS---
AGENT_A: x
AGENT_B: y
AGENT_C: z

---RATIONALE---
Because.
`
    const artifact = parseDecisionArtifact(text)
    const agreement = artifact.findings.find((f) => f.id === 'agreement')
    expect(agreement?.claimIds).toContain('A-C1')
    expect(agreement?.text).toMatch(/Flags help/)
  })
})

describe('round 3 parse links revisions', () => {
  it('creates revisedId for narrowed claims', () => {
    const parsed = parseRound3Structure(
      JSON.stringify({
        changes: [
          {
            claimId: 'A-C1',
            action: 'narrowed',
            text: 'narrower',
            reason: 'critique',
          },
        ],
      })
    )
    expect(parsed.changes[0].revisedId).toBe('A-C1′')
  })
})
