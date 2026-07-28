import { describe, expect, it } from 'vitest'
import {
  compareRecommendations,
  deriveStabilityOutcome,
} from './compareRecommendations.js'
import {
  extractStructuredRecommendation,
  inferVerdictFromText,
} from './extractRecommendation.js'
import { getStabilityEligibility, planStabilityChecks } from './planChecks.js'
import {
  buildStabilityClaimCatalog,
  buildStabilitySynthesisUserMessage,
  materialsToVoiceBag,
} from './buildStabilityInput.js'
import { createStabilityReportDraft } from './runStabilityCheck.js'

const baseRec = {
  verdict: /** @type {const} */ ('conditional'),
  recommendationText: 'Ship a pilot behind a feature flag',
  requiredConditions: ['Require human approval for customer-visible actions'],
  primaryRationale: ['Error cost is high'],
  keyRisks: ['Trust erosion'],
  extractionMethod: /** @type {const} */ ('artifact_sections'),
}

describe('eligibility', () => {
  it('hides entry while running and when fewer than two voices', () => {
    expect(
      getStabilityEligibility({ status: 'running', rounds: [] }).eligible
    ).toBe(false)
    expect(
      getStabilityEligibility({
        status: 'complete',
        rounds: [{ roundNum: 1, agentA: 'only A', agentB: '', agentC: '' }],
        reviews: [],
        finalPositions: { a: 'final a', b: '', c: '' },
        voiceErrors: { a: null, b: null, c: null },
      }).successfulAgents.length
    ).toBeLessThan(2)
  })

  it('allows complete_with_gaps when two voices have material', () => {
    const state = {
      status: 'complete_with_gaps',
      rounds: [
        {
          roundNum: 1,
          agentA: 'A position long enough',
          agentB: 'B position long enough',
          agentC: '',
        },
      ],
      reviews: [
        {
          roundNum: 1,
          aReviews: 'A review',
          bReviews: 'B review',
          cReviews: '',
        },
      ],
      finalPositions: { a: 'A final', b: 'B final', c: '' },
      voiceErrors: { a: null, b: null, c: { code: 'timeout' } },
      config: {
        agentA: { name: 'A', model: 'm-a' },
        agentB: { name: 'B', model: 'm-b' },
        agentC: { name: 'C', model: 'm-c' },
      },
      roles: { a: 'skeptic', b: 'researcher', c: 'operator' },
      synthesis: { output: 'Base synthesis text for extraction.' },
    }
    const el = getStabilityEligibility(state)
    expect(el.eligible).toBe(true)
    const plan = planStabilityChecks(state)
    expect(plan.callCount).toBeGreaterThanOrEqual(3) // repeat + 2 loo
    expect(plan.checks.some((c) => c.type === 'repeat_synthesis')).toBe(true)
    expect(plan.checks.filter((c) => c.type === 'leave_one_out')).toHaveLength(
      2
    )
  })
})

describe('pre-run call count', () => {
  it('counts repeat + leave-one-out + alternate when models differ', () => {
    const state = {
      status: 'complete',
      rounds: [
        {
          roundNum: 1,
          agentA: 'A',
          agentB: 'B',
          agentC: 'C',
        },
      ],
      reviews: [
        { roundNum: 1, aReviews: 'ar', bReviews: 'br', cReviews: 'cr' },
      ],
      finalPositions: { a: 'fa', b: 'fb', c: 'fc' },
      voiceErrors: { a: null, b: null, c: null },
      config: {
        agentA: { name: 'A', model: 'm-a' },
        agentB: { name: 'B', model: 'm-b' },
        agentC: { name: 'C', model: 'm-c' },
      },
      roles: { a: 'skeptic', b: 'researcher', c: 'operator' },
      synthesisWinner: { winner: 'gpt' },
      synthesis: { output: 'Proceed carefully.' },
    }
    const plan = planStabilityChecks(state)
    // repeat + 3 loo + 1 alternate = 5
    expect(plan.callCount).toBe(5)
    expect(plan.alternateArbiter?.model).toBeTruthy()
  })
})

describe('recommendation comparison', () => {
  it('classifies same recommendation correctly', () => {
    const cmp = compareRecommendations(baseRec, { ...baseRec }, {
      comparisonId: '1',
      baseSynthesisId: 'b',
      comparedStabilityRunId: 'r',
    })
    expect(cmp.relationship).toBe('same')
  })

  it('does not call condition changes fully stable', () => {
    const cmp = compareRecommendations(
      baseRec,
      {
        ...baseRec,
        requiredConditions: [],
      },
      {
        comparisonId: '1',
        baseSynthesisId: 'b',
        comparedStabilityRunId: 'r',
      }
    )
    expect(cmp.relationship).toBe('same_with_changed_conditions')
    expect(cmp.removedConditions.length).toBeGreaterThan(0)
  })

  it('classifies changed verdict as meaningfully different', () => {
    const cmp = compareRecommendations(
      baseRec,
      {
        ...baseRec,
        verdict: 'defer',
        recommendationText: 'Defer the launch',
      },
      {
        comparisonId: '1',
        baseSynthesisId: 'b',
        comparedStabilityRunId: 'r',
      }
    )
    expect(cmp.relationship).toBe('meaningfully_different')
    expect(cmp.verdictChanged).toBe(true)
  })

  it('returns comparison unavailable when extraction failed', () => {
    const cmp = compareRecommendations(
      baseRec,
      {
        verdict: 'no_recommendation',
        recommendationText: '',
        requiredConditions: [],
        primaryRationale: [],
        keyRisks: [],
        extractionMethod: 'unavailable',
      },
      {
        comparisonId: '1',
        baseSynthesisId: 'b',
        comparedStabilityRunId: 'r',
      }
    )
    expect(cmp.relationship).toBe('no_clear_recommendation')
  })
})

describe('leave-one-out input', () => {
  it('excludes the selected voice contributions from the prompt and catalog', () => {
    const voices = {
      a: { r1: 'A-C1: claim a', r2: 'challenge', r3: 'kept' },
      b: { r1: 'B-C1: claim b', r2: 'challenge b', r3: 'kept b' },
      c: { r1: 'C-C1: claim c', r2: 'challenge c', r3: 'kept c' },
    }
    const config = {
      agentA: { name: 'Alpha' },
      agentB: { name: 'Beta' },
      agentC: { name: 'Gamma' },
    }
    const msg = buildStabilitySynthesisUserMessage(
      'prompt',
      voices,
      config,
      ['reversibility'],
      '',
      'b'
    )
    expect(msg).toContain('excluded for a leave-one-out')
    expect(msg).toContain('Alpha (round 1)')
    expect(msg).toContain('claim a')
    expect(msg).not.toMatch(/Beta \(round 1\) ===\nB-C1/)
    const catalog = buildStabilityClaimCatalog(voices, config, 'b')
    expect(catalog).not.toMatch(/B-C1/)
  })
})

describe('report draft does not replace synthesis', () => {
  it('keeps base synthesis text on the report only', () => {
    const state = {
      status: 'complete',
      debateId: 'd1',
      synthesis: {
        output: 'ORIGINAL SYNTHESIS MUST REMAIN',
        decisionArtifact: {
          framed: 'frame',
          agreement: 'agree',
          disagreement: '',
          strongestSupport: '',
          weakestAssumptions: '',
          minorityReport: '',
          whatWouldChange: 'Need approval',
          recommendedNextStep: 'Pilot with approval',
          findings: [],
        },
      },
      rounds: [
        { roundNum: 1, agentA: 'A', agentB: 'B', agentC: 'C' },
      ],
      reviews: [
        { roundNum: 1, aReviews: 'ar', bReviews: 'br', cReviews: 'cr' },
      ],
      finalPositions: { a: 'fa', b: 'fb', c: 'fc' },
      voiceErrors: { a: null, b: null, c: null },
      config: {
        agentA: { name: 'A', model: 'm-a' },
        agentB: { name: 'B', model: 'm-b' },
        agentC: { name: 'C', model: 'm-c' },
      },
      roles: { a: 'skeptic', b: 'researcher', c: 'operator' },
    }
    const draft = createStabilityReportDraft(state)
    expect(draft?.baseRawSynthesis).toBe('ORIGINAL SYNTHESIS MUST REMAIN')
    expect(state.synthesis.output).toBe('ORIGINAL SYNTHESIS MUST REMAIN')
  })
})

describe('outcome derivation', () => {
  it('marks sensitive when leave-one-out changes verdict', () => {
    const runs = [
      {
        stabilityRunId: 'r1',
        type: 'leave_one_out',
        status: 'complete',
        excludedRoleId: 'researcher',
        arbiterModelId: 'm',
        debateId: 'd',
        baseSynthesisId: 'b',
        synthesisPromptVersion: 'v',
        attemptId: 'a',
        label: 'Without Researcher',
      },
      {
        stabilityRunId: 'r2',
        type: 'repeat_synthesis',
        status: 'complete',
        arbiterModelId: 'm',
        debateId: 'd',
        baseSynthesisId: 'b',
        synthesisPromptVersion: 'v',
        attemptId: 'a',
        label: 'Repeat',
      },
    ]
    const comparisons = [
      {
        comparisonId: 'c1',
        baseSynthesisId: 'b',
        comparedStabilityRunId: 'r1',
        relationship: /** @type {const} */ ('meaningfully_different'),
        verdictChanged: true,
        changedConditions: [],
        addedConditions: [],
        removedConditions: [],
        changedRationales: [],
        changedRisks: [],
        explanation: 'Verdict changed from conditional to defer.',
        comparisonMethod: /** @type {const} */ ('deterministic'),
      },
      {
        comparisonId: 'c2',
        baseSynthesisId: 'b',
        comparedStabilityRunId: 'r2',
        relationship: /** @type {const} */ ('same'),
        verdictChanged: false,
        changedConditions: [],
        addedConditions: [],
        removedConditions: [],
        changedRationales: [],
        changedRisks: [],
        explanation: 'Same',
        comparisonMethod: /** @type {const} */ ('deterministic'),
      },
    ]
    const out = deriveStabilityOutcome(
      /** @type {any} */ (comparisons),
      /** @type {any} */ (runs)
    )
    expect(out.outcome).toBe('sensitive_to_one_or_more_voices')
    expect(out.summary).toMatch(/researcher/i)
  })

  it('keeps completed runs when one failed', () => {
    const out = deriveStabilityOutcome(
      [
        {
          comparisonId: 'c1',
          baseSynthesisId: 'b',
          comparedStabilityRunId: 'ok',
          relationship: 'same',
          verdictChanged: false,
          changedConditions: [],
          addedConditions: [],
          removedConditions: [],
          changedRationales: [],
          changedRisks: [],
          explanation: 'Same',
          comparisonMethod: 'deterministic',
        },
      ],
      [
        {
          stabilityRunId: 'ok',
          status: 'complete',
          type: 'repeat_synthesis',
          label: 'x',
          arbiterModelId: 'm',
          debateId: 'd',
          baseSynthesisId: 'b',
          synthesisPromptVersion: 'v',
          attemptId: 'a',
        },
        {
          stabilityRunId: 'bad',
          status: 'failed',
          type: 'leave_one_out',
          label: 'y',
          arbiterModelId: 'm',
          debateId: 'd',
          baseSynthesisId: 'b',
          synthesisPromptVersion: 'v',
          attemptId: 'a',
        },
      ]
    )
    expect(out.outcome).toBe('stable_across_tested_configurations')
    expect(out.limitations.some((l) => /failed/i.test(l))).toBe(true)
  })
})

describe('extraction and cost honesty', () => {
  it('extracts from artifact sections for legacy debates', () => {
    const rec = extractStructuredRecommendation('legacy prose', {
      framed: 'Decide on pilot',
      agreement: 'Flags help',
      disagreement: 'Trust vs speed',
      strongestSupport: '',
      weakestAssumptions: 'Assumes users will notice',
      minorityReport: '',
      whatWouldChange: 'Independent audit of error rates',
      recommendedNextStep: 'Run a two-week pilot',
      findings: [],
    })
    expect(rec.recommendationText).toMatch(/pilot/i)
    expect(rec.extractionMethod).toBe('artifact_sections')
  })

  it('infers defer verdict', () => {
    expect(inferVerdictFromText('We should defer until evidence arrives')).toBe(
      'defer'
    )
  })
})

describe('materials helper', () => {
  it('maps materials to voice bag', () => {
    const bag = materialsToVoiceBag({
      ra: '1',
      rb: '2',
      rc: '3',
      aRev: '4',
      bRev: '5',
      cRev: '6',
      fa: '7',
      fb: '8',
      fc: '9',
    })
    expect(bag.a.r3).toBe('7')
  })
})
