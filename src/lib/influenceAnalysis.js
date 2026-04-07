import { callGitHubModel } from '../api/githubModelsClient.js'
import { AGENT_TIMEOUT_MESSAGE } from './debateConstants.js'
import { clipInferenceText } from './clipInferenceText.js'
import {
  classifyEmbeddingDistance,
  embeddingDistanceR1R3,
  getEmbedding,
  movedTowardPairConsensus,
} from './getEmbedding.js'
import { isModelCallTimeoutError } from './modelCallErrors.js'

export const INFLUENCE_SELF_REPORT_SYSTEM = `You have just completed a three-round debate with two other AI models. Compare your Round 1 response to your Round 3 response and answer honestly.

Return ONLY valid JSON:
{
  "position_changed": true | false,
  "change_type": "genuine_update" | "social_capitulation" | "clarification" | "no_change",
  "what_changed": "one sentence or null",
  "what_caused_it": "which model and which specific argument influenced you, or null",
  "what_held_firm": "what you maintained despite challenge, or null",
  "what_would_change_mind": "what argument would have needed to be made to change your position further, or null"
}

Distinguish genuine_update from social_capitulation:
  genuine_update: references a specific argument or piece of evidence from another model
  social_capitulation: vague agreement without citing a specific argument ("they made good points")
  clarification: position unchanged but expressed more precisely
  no_change: position unchanged`

/** @param {string} text */
function extractJsonObject(text) {
  let t = typeof text === 'string' ? text.trim() : ''
  const fence = /```(?:json)?\s*([\s\S]*?)```/im
  const fm = t.match(fence)
  if (fm) t = fm[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('no json')
  return JSON.parse(t.slice(start, end + 1))
}

/** @param {unknown} raw */
function parseSelfReport(raw) {
  try {
    const o = extractJsonObject(
      typeof raw === 'string' ? raw : String(raw ?? '')
    )
    const change_type = String(o.change_type ?? 'no_change')
    const allowed = new Set([
      'genuine_update',
      'social_capitulation',
      'clarification',
      'no_change',
    ])
    return {
      position_changed: Boolean(o.position_changed),
      change_type: allowed.has(change_type)
        ? change_type
        : 'no_change',
      what_changed:
        typeof o.what_changed === 'string' && o.what_changed.trim()
          ? o.what_changed.trim()
          : null,
      what_caused_it:
        typeof o.what_caused_it === 'string' && o.what_caused_it.trim()
          ? o.what_caused_it.trim()
          : null,
      what_held_firm:
        typeof o.what_held_firm === 'string' && o.what_held_firm.trim()
          ? o.what_held_firm.trim()
          : null,
      what_would_change_mind:
        typeof o.what_would_change_mind === 'string' &&
        o.what_would_change_mind.trim()
          ? o.what_would_change_mind.trim()
          : null,
    }
  } catch {
    return {
      position_changed: false,
      change_type: 'no_change',
      what_changed: null,
      what_caused_it: null,
      what_held_firm: null,
      what_would_change_mind: null,
    }
  }
}

/**
 * @param {{
 *   config: {
 *     agentA: { name: string },
 *     agentB: { name: string },
 *     agentC: { name: string },
 *   },
 *   slot: 'a' | 'b' | 'c',
 *   r1: string,
 *   r3: string,
 *   otherNames: string,
 *   crossReviewsAtYou: string,
 * }} ctx
 */
function buildSelfReportUserMessage(ctx) {
  const label =
    ctx.slot === 'a'
      ? 'agent A (GPT slot)'
      : ctx.slot === 'b'
        ? 'agent B (Phi slot)'
        : 'agent C (Mistral slot)'
  return clipInferenceText(
    [
      `You are responding as ${label}.`,
      '',
      'Your Round 1 response:',
      ctx.r1,
      '',
      'Your Round 3 final position:',
      ctx.r3,
      '',
      'The other models you debated with:',
      ctx.otherNames,
      '',
      'Their Round 2 cross-review texts (full debate round — consider what is directed at your earlier position in context):',
      ctx.crossReviewsAtYou,
    ].join('\n'),
    56_000
  )
}

async function tryModel(fn) {
  try {
    const value = await fn()
    return { ok: true, value }
  } catch (e) {
    if (isModelCallTimeoutError(e)) return { ok: false, timeout: true }
    throw e
  }
}

/**
 * @param {import('react').Dispatch<unknown>} dispatch
 * @param {{
 *   config: {
 *     agentA: { name: string, model: string },
 *     agentB: { name: string, model: string },
 *     agentC: { name: string, model: string },
 *   },
 *   ra: string, rb: string, rc: string,
 *   fa: string, fb: string, fc: string,
 *   aRev: string, bRev: string, cRev: string,
 * }} args
 */
export async function runInfluenceAnalysis(dispatch, args) {
  const { config, ra, rb, rc, fa, fb, fc, aRev, bRev, cRev } = args
  const { agentA, agentB, agentC } = config

  const sysWithNames = `${INFLUENCE_SELF_REPORT_SYSTEM}

You know their identities: the other models are ${agentB.name} and ${agentC.name} when you are ${agentA.name}; the other models are ${agentA.name} and ${agentC.name} when you are ${agentB.name}; the other models are ${agentA.name} and ${agentB.name} when you are ${agentC.name}.`

  const [
    embA_r1,
    embB_r1,
    embC_r1,
    embA_r3,
    embB_r3,
    embC_r3,
  ] = await Promise.all([
    getEmbedding(ra),
    getEmbedding(rb),
    getEmbedding(rc),
    getEmbedding(fa),
    getEmbedding(fb),
    getEmbedding(fc),
  ])

  for (let i = 0; i < 6; i++) {
    dispatch({ type: 'INCREMENT_PROGRESS_CALLS', payload: 1 })
  }

  const distA =
    embA_r1 && embA_r3 ? embeddingDistanceR1R3(embA_r1, embA_r3) : null
  const distB =
    embB_r1 && embB_r3 ? embeddingDistanceR1R3(embB_r1, embB_r3) : null
  const distC =
    embC_r1 && embC_r3 ? embeddingDistanceR1R3(embC_r1, embC_r3) : null

  const towardA = movedTowardPairConsensus(
    embA_r1,
    embA_r3,
    embB_r1,
    embB_r3,
    embC_r1,
    embC_r3
  )
  const towardB = movedTowardPairConsensus(
    embB_r1,
    embB_r3,
    embA_r1,
    embA_r3,
    embC_r1,
    embC_r3
  )
  const towardC = movedTowardPairConsensus(
    embC_r1,
    embC_r3,
    embA_r1,
    embA_r3,
    embB_r1,
    embB_r3
  )

  const crossForA = [
    `=== ${agentB.name} (cross-review) ===\n${bRev}`,
    `=== ${agentC.name} (cross-review) ===\n${cRev}`,
  ].join('\n\n')
  const crossForB = [
    `=== ${agentA.name} (cross-review) ===\n${aRev}`,
    `=== ${agentC.name} (cross-review) ===\n${cRev}`,
  ].join('\n\n')
  const crossForC = [
    `=== ${agentA.name} (cross-review) ===\n${aRev}`,
    `=== ${agentB.name} (cross-review) ===\n${bRev}`,
  ].join('\n\n')

  const [repA, repB, repC] = await Promise.all([
    tryModel(() =>
      callGitHubModel(
        config.agentA.model,
        [
          {
            role: 'user',
            content: buildSelfReportUserMessage({
              config,
              slot: 'a',
              r1: ra,
              r3: fa,
              otherNames: `${agentB.name}, ${agentC.name}`,
              crossReviewsAtYou: crossForA,
            }),
          },
        ],
        sysWithNames,
        {
          agentName: agentA.name,
          maxTokens: 2048,
          errorContext: { stage: 'influence-self-report', round: 3 },
        }
      )
    ),
    tryModel(() =>
      callGitHubModel(
        config.agentB.model,
        [
          {
            role: 'user',
            content: buildSelfReportUserMessage({
              config,
              slot: 'b',
              r1: rb,
              r3: fb,
              otherNames: `${agentA.name}, ${agentC.name}`,
              crossReviewsAtYou: crossForB,
            }),
          },
        ],
        sysWithNames,
        {
          agentName: agentB.name,
          maxTokens: 2048,
          errorContext: { stage: 'influence-self-report', round: 3 },
        }
      )
    ),
    tryModel(() =>
      callGitHubModel(
        config.agentC.model,
        [
          {
            role: 'user',
            content: buildSelfReportUserMessage({
              config,
              slot: 'c',
              r1: rc,
              r3: fc,
              otherNames: `${agentA.name}, ${agentB.name}`,
              crossReviewsAtYou: crossForC,
            }),
          },
        ],
        sysWithNames,
        {
          agentName: agentC.name,
          maxTokens: 2048,
          errorContext: { stage: 'influence-self-report', round: 3 },
        }
      )
    ),
  ])

  for (const r of [repA, repB, repC]) {
    if (!r.ok) dispatch({ type: 'INCREMENT_TIMEOUT_COUNT' })
    dispatch({ type: 'INCREMENT_PROGRESS_CALLS', payload: 1 })
  }

  const rawA = repA.ok && 'value' in repA ? repA.value : AGENT_TIMEOUT_MESSAGE
  const rawB = repB.ok && 'value' in repB ? repB.value : AGENT_TIMEOUT_MESSAGE
  const rawC = repC.ok && 'value' in repC ? repC.value : AGENT_TIMEOUT_MESSAGE

  const selfA = parseSelfReport(rawA)
  const selfB = parseSelfReport(rawB)
  const selfC = parseSelfReport(rawC)

  const classifyA =
    distA != null && Number.isFinite(distA)
      ? classifyEmbeddingDistance(distA)
      : selfReportFallbackClass(selfA)
  const classifyB =
    distB != null && Number.isFinite(distB)
      ? classifyEmbeddingDistance(distB)
      : selfReportFallbackClass(selfB)
  const classifyC =
    distC != null && Number.isFinite(distC)
      ? classifyEmbeddingDistance(distC)
      : selfReportFallbackClass(selfC)

  /** @param {ReturnType<typeof parseSelfReport>} s */
  function selfReportFallbackClass(s) {
    if (s.change_type === 'no_change') return 'held firm'
    if (s.change_type === 'clarification') return 'minor shift'
    if (s.change_type === 'genuine_update') return 'shifted'
    if (s.change_type === 'social_capitulation') return 'shifted'
    return 'minor shift'
  }

  const distVals = /** @type {[string, number][]} */ ([
    ['a', distA ?? 0],
    ['b', distB ?? 0],
    ['c', distC ?? 0],
  ])
  distVals.sort((u, v) => v[1] - u[1])
  const mostInfluenced = String(distVals[0][0])
  const mostResistant = String(distVals[2][0])

  /** @type {{ a: unknown, b: unknown, c: unknown, mostInfluenced: string, mostResistant: string }} */
  const report = {
    a: {
      distance: distA,
      classification: classifyA,
      towardConsensus: towardA,
      selfReport: selfA,
      cosineSimilarity:
        embA_r1 && embA_r3 ? 1 - (distA ?? 0) : null,
    },
    b: {
      distance: distB,
      classification: classifyB,
      towardConsensus: towardB,
      selfReport: selfB,
      cosineSimilarity:
        embB_r1 && embB_r3 ? 1 - (distB ?? 0) : null,
    },
    c: {
      distance: distC,
      classification: classifyC,
      towardConsensus: towardC,
      selfReport: selfC,
      cosineSimilarity:
        embC_r1 && embC_r3 ? 1 - (distC ?? 0) : null,
    },
    mostInfluenced,
    mostResistant,
  }

  return report
}
