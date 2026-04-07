import { callGitHubModel } from '../api/githubModelsClient.js'
import { clipInferenceText } from './clipInferenceText.js'

const CLAIMS_SYSTEM = `You are a precise analytical assistant. Extract the 3-5 most specific, falsifiable claims from each of these three AI responses to the same prompt. A claim is a concrete assertion that can be agreed with, disagreed with, or partially agreed with.

Return ONLY valid JSON in exactly this format, no preamble:
{
  "claims": [
    { "id": "c1", "text": "brief claim statement under 15 words" },
    { "id": "c2", "text": "..." }
  ]
}`

const POSITIONS_SYSTEM = `You are a precise analytical assistant. For each claim, determine each agent's position based on their response.

Return ONLY valid JSON:
{
  "positions": [
    {
      "claimId": "c1",
      "gpt": "agree" | "disagree" | "partial" | "silent",
      "phi": "agree" | "disagree" | "partial" | "silent",
      "mistral": "agree" | "disagree" | "partial" | "silent",
      "verdict": "unanimous" | "majority" | "contested" | "minority",
      "minorityIncluded": true | false
    }
  ]
}`

const TRACE_SYSTEM = `You are auditing an AI debate. For this specific claim, trace its full journey through the debate.

Return ONLY valid JSON:
{
  "claimId": "c1",
  "origin": {
    "agent": "mistral",
    "quote": "exact short quote from their response, max 25 words"
  },
  "challenge": {
    "occurred": true | false,
    "by": ["gpt"] | ["phi"] | ["gpt", "phi"] | [],
    "quote": "exact short quote of the challenge, max 25 words",
    "type": "direct" | "implicit" | "reframe" | "none"
  },
  "defense": {
    "occurred": true | false,
    "by": "agent name or null",
    "quote": "quote or null"
  },
  "synthesisTreatment": {
    "included": true | false,
    "framing": "original" | "modified" | "merged" | "dropped",
    "quote": "how it appears in synthesis, max 25 words",
    "drift": true | false,
    "driftNote": "one sentence explaining the framing shift or null"
  },
  "flag": true | false,
  "flagReason": "why this is notable or null"
}`

/** @param {string} text */
function extractJsonObject(text) {
  let t = typeof text === 'string' ? text.trim() : ''
  const fence = /```(?:json)?\s*([\s\S]*?)```/im
  const fm = t.match(fence)
  if (fm) t = fm[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end <= start) {
    throw new Error('Audit: model response contained no JSON object.')
  }
  return JSON.parse(t.slice(start, end + 1))
}

/**
 * @param {{
 *   config: {
 *     agentA: { name: string, model: string },
 *     agentB: { name: string },
 *     agentC: { name: string },
 *   },
 *   prompt: string,
 *   round1: { agentA: string, agentB: string, agentC: string },
 *   reviews: { aReviews: string, bReviews: string, cReviews: string },
 *   synthesis: { output: string },
 * }} snapshot
 */
function buildRound1Bundle(snapshot) {
  const { config, round1 } = snapshot
  return [
    `Original prompt:\n${snapshot.prompt}`,
    `=== ${config.agentA.name} (key: gpt) ===\n${round1.agentA}`,
    `=== ${config.agentB.name} (key: phi) ===\n${round1.agentB}`,
    `=== ${config.agentC.name} (key: mistral) ===\n${round1.agentC}`,
  ].join('\n\n')
}

/**
 * @param {{
 *   config: {
 *     agentA: { name: string, model: string },
 *     agentB: { name: string },
 *     agentC: { name: string },
 *   },
 *   prompt: string,
 *   round1: { agentA: string, agentB: string, agentC: string },
 *   reviews: { aReviews: string, bReviews: string, cReviews: string },
 *   synthesis: { output: string },
 * }} snapshot
 * @param {{ id: string, text: string }} claim
 * @param {Record<string, unknown>} positionRow
 */
function buildTraceUserMessage(snapshot, claim, positionRow) {
  const { config, reviews, synthesis } = snapshot
  const bundle = buildRound1Bundle(snapshot)
  const reviewsBlock = [
    `=== ${config.agentA.name} cross-review ===\n${reviews.aReviews}`,
    `=== ${config.agentB.name} cross-review ===\n${reviews.bReviews}`,
    `=== ${config.agentC.name} cross-review ===\n${reviews.cReviews}`,
  ].join('\n\n')
  return clipInferenceText(
    [
      `Claim to audit (id: ${claim.id}): ${claim.text}`,
      `Position summary (JSON): ${JSON.stringify(positionRow)}`,
      '',
      '--- Round 1 responses ---',
      bundle,
      '',
      '--- Cross-reviews ---',
      reviewsBlock,
      '',
      '--- Synthesis output ---',
      synthesis.output,
      '',
      'Keys: origin.agent must be one of: gpt, phi, mistral (matching Agent A/B/C slots above).',
    ].join('\n'),
    56_000
  )
}

/**
 * @param {{
 *   config: { agentA: { name: string, model: string }, agentB: { name: string }, agentC: { name: string } },
 *   prompt: string,
 *   round1: { agentA: string, agentB: string, agentC: string },
 *   reviews: { aReviews: string, bReviews: string, cReviews: string },
 *   synthesis: { output: string },
 * }} snapshot
 * @returns {Promise<{ claims: { id: string, text: string }[], positions: Record<string, unknown>[], traces: Record<string, unknown>[] }>}
 */
export async function runAudit(snapshot) {
  const model = snapshot.config.agentA.model
  const round1User = clipInferenceText(buildRound1Bundle(snapshot), 56_000)

  const rawClaims = await callGitHubModel(
    model,
    [{ role: 'user', content: round1User }],
    CLAIMS_SYSTEM,
    { maxTokens: 4096 }
  )

  const claimsParsed = extractJsonObject(rawClaims)
  const claims = Array.isArray(claimsParsed.claims) ? claimsParsed.claims : []

  const positionsUser = clipInferenceText(
    [
      'Extracted claims JSON:',
      JSON.stringify({ claims }),
      '',
      'Use these round-1 responses to map each agent position (gpt = Agent A, phi = Agent B, mistral = Agent C):',
      round1User,
    ].join('\n'),
    56_000
  )

  const rawPositions = await callGitHubModel(
    model,
    [{ role: 'user', content: positionsUser }],
    POSITIONS_SYSTEM,
    { maxTokens: 4096 }
  )

  const positionsParsed = extractJsonObject(rawPositions)
  const positions = Array.isArray(positionsParsed.positions)
    ? positionsParsed.positions
    : []

  const claimById = new Map(claims.map((c) => [c.id, c]))

  const needsTrace = (/** @type {Record<string, unknown>} */ p) =>
    p.verdict === 'contested' || p.minorityIncluded === true

  const traceTargets = positions.filter(needsTrace)

  const traceResults = await Promise.all(
    traceTargets.map(async (pos) => {
      const claimId = String(pos.claimId ?? '')
      const claim = claimById.get(claimId)
      if (!claim) {
        return {
          claimId,
          error: 'Claim id not found',
        }
      }
      try {
        const userMsg = buildTraceUserMessage(snapshot, claim, pos)
        const raw = await callGitHubModel(
          model,
          [{ role: 'user', content: userMsg }],
          TRACE_SYSTEM,
          { maxTokens: 4096 }
        )
        return extractJsonObject(raw)
      } catch (e) {
        return {
          claimId,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    })
  )

  return {
    claims,
    positions,
    traces: traceResults,
  }
}
