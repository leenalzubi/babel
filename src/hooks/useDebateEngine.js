import { useCallback } from 'react'
import { callGitHubModel } from '../api/githubModelsClient.js'
import {
  AGENT_A_ROUND1_SYSTEM,
  AGENT_B_ROUND1_SYSTEM,
  AGENT_C_ROUND1_SYSTEM,
  CROSS_REVIEW_SYSTEM,
  FINAL_POSITION_SYSTEM,
  REBUTTAL_SYSTEM,
  SYNTHESIS_SYSTEM,
} from '../api/systemPrompts.js'
import { useForgeUiSettings } from '../context/ForgeSettingsContext.jsx'
import { runAudit } from '../lib/auditDebate.js'
import { semanticDivergence } from '../lib/cosineSimilarity.js'
import { clipInferenceText } from '../lib/clipInferenceText.js'
import { extractReviewSectionAboutPeer } from '../lib/extractCrossReviewSection.js'
import { getEmbedding } from '../lib/getEmbedding.js'
import { logDebate } from '../lib/logDebate.js'
import { parseSynthesisOutput } from '../lib/parseSynthesisOutput.js'
import { useForge } from '../store/useForgeStore.js'

/**
 * @param {import('react').Dispatch<unknown>} dispatch
 * @param {Parameters<typeof runAudit>[0]} snapshot
 */
function scheduleDebateAudit(dispatch, snapshot) {
  dispatch({ type: 'SET_AUDIT_LOADING', payload: true })
  dispatch({ type: 'SET_AUDIT_ERROR', payload: null })
  void (async () => {
    try {
      const result = await runAudit(snapshot)
      dispatch({ type: 'SET_AUDIT', payload: result })
    } catch (err) {
      dispatch({
        type: 'SET_AUDIT_ERROR',
        payload:
          err instanceof Error ? err.message : `Audit failed: ${String(err)}`,
      })
    } finally {
      dispatch({ type: 'SET_AUDIT_LOADING', payload: false })
    }
  })()
}

function pause(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * @param {'a' | 'b' | 'c'} target
 * @param {string} ra
 * @param {string} rb
 * @param {string} rc
 * @param {string} aRev
 * @param {string} bRev
 * @param {string} cRev
 * @param {{ agentA: { name: string }, agentB: { name: string }, agentC: { name: string } }} config
 */
function buildRebuttalUserMessage(target, ra, rb, rc, aRev, bRev, cRev, config) {
  const { agentA, agentB, agentC } = config
  if (target === 'a') {
    const sB = extractReviewSectionAboutPeer(bRev, agentA.name)
    const sC = extractReviewSectionAboutPeer(cRev, agentA.name)
    return `Your original response was:\n${ra}\n\n${agentB.name} reviewed your response and said:\n${sB}\n\n${agentC.name} reviewed your response and said:\n${sC}\n\nDo you maintain, modify, or concede your position?`
  }
  if (target === 'b') {
    const sA = extractReviewSectionAboutPeer(aRev, agentB.name)
    const sC = extractReviewSectionAboutPeer(cRev, agentB.name)
    return `Your original response was:\n${rb}\n\n${agentA.name} reviewed your response and said:\n${sA}\n\n${agentC.name} reviewed your response and said:\n${sC}\n\nDo you maintain, modify, or concede your position?`
  }
  const sA = extractReviewSectionAboutPeer(aRev, agentC.name)
  const sB = extractReviewSectionAboutPeer(bRev, agentC.name)
  return `Your original response was:\n${rc}\n\n${agentA.name} reviewed your response and said:\n${sA}\n\n${agentB.name} reviewed your response and said:\n${sB}\n\nDo you maintain, modify, or concede your position?`
}

/**
 * @param {string} prompt
 * @param {string} ra
 * @param {string} rb
 * @param {string} rc
 * @param {string} aRev
 * @param {string} bRev
 * @param {string} cRev
 * @param {string} rebA
 * @param {string} rebB
 * @param {string} rebC
 * @param {string} fa
 * @param {string} fb
 * @param {string} fc
 * @param {{ agentA: { name: string }, agentB: { name: string }, agentC: { name: string } }} config
 */
/**
 * Context for round 4 — everything except final positions (those are produced in this round).
 * @param {string} prompt
 * @param {string} ra
 * @param {string} rb
 * @param {string} rc
 * @param {string} aRev
 * @param {string} bRev
 * @param {string} cRev
 * @param {string} rebA
 * @param {string} rebB
 * @param {string} rebC
 * @param {{ agentA: { name: string }, agentB: { name: string }, agentC: { name: string } }} config
 */
function buildFinalPositionUserMessage(
  prompt,
  ra,
  rb,
  rc,
  aRev,
  bRev,
  cRev,
  rebA,
  rebB,
  rebC,
  config
) {
  const { agentA, agentB, agentC } = config
  return [
    `Original prompt:\n${prompt}`,
    `=== ${agentA.name} (round 1) ===\n${ra}`,
    `=== ${agentB.name} (round 1) ===\n${rb}`,
    `=== ${agentC.name} (round 1) ===\n${rc}`,
    `=== ${agentA.name} (cross-review) ===\n${aRev}`,
    `=== ${agentB.name} (cross-review) ===\n${bRev}`,
    `=== ${agentC.name} (cross-review) ===\n${cRev}`,
    `=== ${agentA.name} (rebuttal) ===\n${rebA}`,
    `=== ${agentB.name} (rebuttal) ===\n${rebB}`,
    `=== ${agentC.name} (rebuttal) ===\n${rebC}`,
  ].join('\n\n')
}

function buildFullSynthesisUserMessage(
  prompt,
  ra,
  rb,
  rc,
  aRev,
  bRev,
  cRev,
  rebA,
  rebB,
  rebC,
  fa,
  fb,
  fc,
  config
) {
  const { agentA, agentB, agentC } = config
  return [
    `Original prompt:\n${prompt}`,
    `=== ${agentA.name} (round 1) ===\n${ra}`,
    `=== ${agentB.name} (round 1) ===\n${rb}`,
    `=== ${agentC.name} (round 1) ===\n${rc}`,
    `=== ${agentA.name} (cross-review) ===\n${aRev}`,
    `=== ${agentB.name} (cross-review) ===\n${bRev}`,
    `=== ${agentC.name} (cross-review) ===\n${cRev}`,
    `=== ${agentA.name} (rebuttal) ===\n${rebA}`,
    `=== ${agentB.name} (rebuttal) ===\n${rebB}`,
    `=== ${agentC.name} (rebuttal) ===\n${rebC}`,
    `=== ${agentA.name} (final position) ===\n${fa}`,
    `=== ${agentB.name} (final position) ===\n${fb}`,
    `=== ${agentC.name} (final position) ===\n${fc}`,
  ].join('\n\n')
}

/**
 * @param {'A' | 'B' | 'C'} forKey
 * @param {{ agentA: string,  agentB: string, agentC: string }} responses
 * @param {{ agentA: { name: string }, agentB: { name: string }, agentC: { name: string } }} config
 */
function buildCrossReviewUserMessage(forKey, { agentA: a, agentB: b, agentC: c }, config) {
  const { agentA, agentB, agentC } = config
  const tail =
    'Review both responses. For each: what did they get right, what would you challenge, what did they miss?'

  if (forKey === 'A') {
    return `Here are the two other responses to the prompt you just answered:\n\n=== ${agentB.name} responded: ===\n${b}\n\n=== ${agentC.name} responded: ===\n${c}\n\n${tail}`
  }
  if (forKey === 'B') {
    return `Here are the two other responses to the prompt you just answered:\n\n=== ${agentA.name} responded: ===\n${a}\n\n=== ${agentC.name} responded: ===\n${c}\n\n${tail}`
  }
  return `Here are the two other responses to the prompt you just answered:\n\n=== ${agentA.name} responded: ===\n${a}\n\n=== ${agentB.name} responded: ===\n${b}\n\n${tail}`
}

export function useDebateEngine() {
  const { dispatch } = useForge()
  const { settings: uiSettings } = useForgeUiSettings()

  const runDebate = useCallback(
    async (prompt, config) => {
      try {
        dispatch({ type: 'SET_ERROR', payload: null })
        const userPrompt = typeof prompt === 'string' ? prompt : String(prompt ?? '')
        dispatch({ type: 'SET_PROMPT', payload: userPrompt.trim() })
        dispatch({ type: 'SET_STATUS', payload: 'running' })

        const promptClipped = clipInferenceText(userPrompt.trim(), 48_000)

        const tA0 = Date.now()
        dispatch({
          type: 'SET_AGENT_THINKING',
          payload: { agent: 'a', startTime: tA0 },
        })
        const ra = await callGitHubModel(
          config.agentA.model,
          [{ role: 'user', content: promptClipped }],
          AGENT_A_ROUND1_SYSTEM
        )
        dispatch({
          type: 'SET_AGENT_DONE',
          payload: { agent: 'a', response: ra, endTime: Date.now() },
        })

        await pause(700)
        const tB0 = Date.now()
        dispatch({
          type: 'SET_AGENT_THINKING',
          payload: { agent: 'b', startTime: tB0 },
        })
        const rb = await callGitHubModel(
          config.agentB.model,
          [{ role: 'user', content: promptClipped }],
          AGENT_B_ROUND1_SYSTEM
        )
        dispatch({
          type: 'SET_AGENT_DONE',
          payload: { agent: 'b', response: rb, endTime: Date.now() },
        })

        await pause(700)
        const tC0 = Date.now()
        dispatch({
          type: 'SET_AGENT_THINKING',
          payload: { agent: 'c', startTime: tC0 },
        })
        const rc = await callGitHubModel(
          config.agentC.model,
          [{ role: 'user', content: promptClipped }],
          AGENT_C_ROUND1_SYSTEM
        )
        dispatch({
          type: 'SET_AGENT_DONE',
          payload: { agent: 'c', response: rc, endTime: Date.now() },
        })

        const [embA, embB, embC] = await Promise.all([
          getEmbedding(ra),
          getEmbedding(rb),
          getEmbedding(rc),
        ])

        const div_ab =
          embA && embB ? semanticDivergence(embA, embB) : null
        const div_ac =
          embA && embC ? semanticDivergence(embA, embC) : null
        const div_bc =
          embB && embC ? semanticDivergence(embB, embC) : null

        const divList = [div_ab, div_ac, div_bc].filter(
          (v) => v != null && typeof v === 'number'
        )
        const average =
          divList.length > 0
            ? Math.round(
                (divList.reduce((a, b) => a + b, 0) / divList.length) * 10000
              ) / 10000
            : 0
        const ab = div_ab ?? 0
        const ac = div_ac ?? 0
        const bc = div_bc ?? 0

        dispatch({
          type: 'SET_DIVERGENCE',
          payload: { ab, ac, bc, average },
        })

        const aReviewMsg = clipInferenceText(
          buildCrossReviewUserMessage(
            'A',
            { agentA: ra, agentB: rb, agentC: rc },
            config
          )
        )
        const bReviewMsg = clipInferenceText(
          buildCrossReviewUserMessage(
            'B',
            { agentA: ra, agentB: rb, agentC: rc },
            config
          )
        )
        const cReviewMsg = clipInferenceText(
          buildCrossReviewUserMessage(
            'C',
            { agentA: ra, agentB: rb, agentC: rc },
            config
          )
        )

        dispatch({
          type: 'SET_REVIEW_THINKING',
          payload: { agent: 'a', startTime: Date.now() },
        })
        const aRev = await callGitHubModel(
          config.agentA.model,
          [{ role: 'user', content: aReviewMsg }],
          CROSS_REVIEW_SYSTEM
        )
        dispatch({
          type: 'SET_REVIEW_DONE',
          payload: { agent: 'a', review: aRev, endTime: Date.now() },
        })

        await pause(700)
        dispatch({
          type: 'SET_REVIEW_THINKING',
          payload: { agent: 'b', startTime: Date.now() },
        })
        const bRev = await callGitHubModel(
          config.agentB.model,
          [{ role: 'user', content: bReviewMsg }],
          CROSS_REVIEW_SYSTEM
        )
        dispatch({
          type: 'SET_REVIEW_DONE',
          payload: { agent: 'b', review: bRev, endTime: Date.now() },
        })

        await pause(700)
        dispatch({
          type: 'SET_REVIEW_THINKING',
          payload: { agent: 'c', startTime: Date.now() },
        })
        const cRev = await callGitHubModel(
          config.agentC.model,
          [{ role: 'user', content: cReviewMsg }],
          CROSS_REVIEW_SYSTEM
        )
        dispatch({
          type: 'SET_REVIEW_DONE',
          payload: { agent: 'c', review: cRev, endTime: Date.now() },
        })

        await pause(700)
        dispatch({
          type: 'SET_REBUTTAL_THINKING',
          payload: { agent: 'a', startTime: Date.now() },
        })
        const rebA = await callGitHubModel(
          config.agentA.model,
          [
            {
              role: 'user',
              content: clipInferenceText(
                buildRebuttalUserMessage(
                  'a',
                  ra,
                  rb,
                  rc,
                  aRev,
                  bRev,
                  cRev,
                  config
                )
              ),
            },
          ],
          REBUTTAL_SYSTEM
        )
        dispatch({
          type: 'SET_REBUTTAL_DONE',
          payload: { agent: 'a', rebuttal: rebA, endTime: Date.now() },
        })

        await pause(700)
        dispatch({
          type: 'SET_REBUTTAL_THINKING',
          payload: { agent: 'b', startTime: Date.now() },
        })
        const rebB = await callGitHubModel(
          config.agentB.model,
          [
            {
              role: 'user',
              content: clipInferenceText(
                buildRebuttalUserMessage(
                  'b',
                  ra,
                  rb,
                  rc,
                  aRev,
                  bRev,
                  cRev,
                  config
                )
              ),
            },
          ],
          REBUTTAL_SYSTEM
        )
        dispatch({
          type: 'SET_REBUTTAL_DONE',
          payload: { agent: 'b', rebuttal: rebB, endTime: Date.now() },
        })

        await pause(700)
        dispatch({
          type: 'SET_REBUTTAL_THINKING',
          payload: { agent: 'c', startTime: Date.now() },
        })
        const rebC = await callGitHubModel(
          config.agentC.model,
          [
            {
              role: 'user',
              content: clipInferenceText(
                buildRebuttalUserMessage(
                  'c',
                  ra,
                  rb,
                  rc,
                  aRev,
                  bRev,
                  cRev,
                  config
                )
              ),
            },
          ],
          REBUTTAL_SYSTEM
        )
        dispatch({
          type: 'SET_REBUTTAL_DONE',
          payload: { agent: 'c', rebuttal: rebC, endTime: Date.now() },
        })

        const finalUserBase = clipInferenceText(
          buildFinalPositionUserMessage(
            userPrompt,
            ra,
            rb,
            rc,
            aRev,
            bRev,
            cRev,
            rebA,
            rebB,
            rebC,
            config
          )
        )

        await pause(700)
        dispatch({
          type: 'SET_FINAL_THINKING',
          payload: { agent: 'a', startTime: Date.now() },
        })
        const fa = await callGitHubModel(
          config.agentA.model,
          [{ role: 'user', content: finalUserBase }],
          FINAL_POSITION_SYSTEM
        )
        dispatch({
          type: 'SET_FINAL_DONE',
          payload: { agent: 'a', position: fa, endTime: Date.now() },
        })

        await pause(700)
        dispatch({
          type: 'SET_FINAL_THINKING',
          payload: { agent: 'b', startTime: Date.now() },
        })
        const fb = await callGitHubModel(
          config.agentB.model,
          [{ role: 'user', content: finalUserBase }],
          FINAL_POSITION_SYSTEM
        )
        dispatch({
          type: 'SET_FINAL_DONE',
          payload: { agent: 'b', position: fb, endTime: Date.now() },
        })

        await pause(700)
        dispatch({
          type: 'SET_FINAL_THINKING',
          payload: { agent: 'c', startTime: Date.now() },
        })
        const fc = await callGitHubModel(
          config.agentC.model,
          [{ role: 'user', content: finalUserBase }],
          FINAL_POSITION_SYSTEM
        )
        dispatch({
          type: 'SET_FINAL_DONE',
          payload: { agent: 'c', position: fc, endTime: Date.now() },
        })

        const shouldSynthesize =
          uiSettings.synthesisMode === 'always' || average > 0.4

        const debateBase = {
          prompt: userPrompt.trim(),
          rounds: [{ roundNum: 1, agentA: ra, agentB: rb, agentC: rc }],
          reviews: [{ aReviews: aRev, bReviews: bRev, cReviews: cRev }],
          rebuttals: { a: rebA, b: rebB, c: rebC },
          finalPositions: { a: fa, b: fb, c: fc },
          divergenceScores: [{ ab, ac, bc, average }],
          config,
          embedding_a: embA,
          embedding_b: embB,
          embedding_c: embC,
        }

        if (!shouldSynthesize) {
          dispatch({
            type: 'SET_SYNTHESIS',
            payload: {
              output:
                '*Synthesis skipped:* your setting only runs synthesis when **average semantic divergence** (embedding distance) is above **40%**. This run was below that threshold — use the full debate transcript (rounds 1–4) as the final output.',
              attributions: { a: '', b: '', c: '' },
              rationale: '',
              concessions: [],
              heldFirm: [],
            },
          })
          dispatch({ type: 'SET_STATUS', payload: 'complete' })
          void logDebate({
            ...debateBase,
            synthesis: {
              output:
                '*Synthesis skipped:* your setting only runs synthesis when **average semantic divergence** (embedding distance) is above **40%**. This run was below that threshold — use the full debate transcript (rounds 1–4) as the final output.',
              attributions: { a: '', b: '', c: '' },
              concessions: [],
              heldFirm: [],
            },
          })
          scheduleDebateAudit(dispatch, {
            config,
            prompt: userPrompt.trim(),
            round1: { agentA: ra, agentB: rb, agentC: rc },
            reviews: { aReviews: aRev, bReviews: bRev, cReviews: cRev },
            synthesis: {
              output:
                '*Synthesis skipped:* your setting only runs synthesis when **average semantic divergence** (embedding distance) is above **40%**. This run was below that threshold — use the full debate transcript (rounds 1–4) as the final output.',
            },
          })
          return
        }

        const synthesisUser = clipInferenceText(
          buildFullSynthesisUserMessage(
            userPrompt,
            ra,
            rb,
            rc,
            aRev,
            bRev,
            cRev,
            rebA,
            rebB,
            rebC,
            fa,
            fb,
            fc,
            config
          )
        )

        await pause(700)
        const synthesisRaw = await callGitHubModel(
          config.agentA.model,
          [{ role: 'user', content: synthesisUser }],
          SYNTHESIS_SYSTEM
        )

        const parsed = parseSynthesisOutput(synthesisRaw, config)

        dispatch({
          type: 'SET_SYNTHESIS',
          payload: {
            output: parsed.output,
            attributions: parsed.attributions,
            rationale: parsed.rationale,
            concessions: parsed.concessions,
            heldFirm: parsed.heldFirm,
          },
        })

        dispatch({ type: 'SET_STATUS', payload: 'complete' })
        void logDebate({
          ...debateBase,
          synthesis: {
            output: parsed.output,
            attributions: parsed.attributions,
            rationale: parsed.rationale,
            concessions: parsed.concessions,
            heldFirm: parsed.heldFirm,
          },
        })
        scheduleDebateAudit(dispatch, {
          config,
          prompt: userPrompt.trim(),
          round1: { agentA: ra, agentB: rb, agentC: rc },
          reviews: { aReviews: aRev, bReviews: bRev, cReviews: cRev },
          synthesis: { output: parsed.output },
        })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : `Debate failed: ${String(err)}`
        dispatch({ type: 'SET_ERROR', payload: message })
        dispatch({ type: 'SET_STATUS', payload: 'error' })
      }
    },
    [dispatch, uiSettings.synthesisMode]
  )

  return { runDebate }
}
