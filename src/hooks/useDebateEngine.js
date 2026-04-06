import { useCallback } from 'react'
import { callGitHubModel } from '../api/githubModelsClient.js'
import {
  AGENT_A_ROUND1_SYSTEM,
  AGENT_B_ROUND1_SYSTEM,
  AGENT_C_ROUND1_SYSTEM,
  CROSS_REVIEW_SYSTEM,
  SYNTHESIS_SYSTEM,
} from '../api/systemPrompts.js'
import { useForgeUiSettings } from '../context/ForgeSettingsContext.jsx'
import { useForge } from '../store/useForgeStore.js'

/** @param {string} text */
function tokenize(text) {
  if (typeof text !== 'string' || !text) return []
  return text
    .toLowerCase()
    .split(/[^a-z0-9']+/u)
    .filter(Boolean)
}

/**
 * Inverted Jaccard distance on word sets: 0 = identical vocab overlap pattern, 1 = no overlap.
 * @param {string} x
 * @param {string} y
 */
function diverge(x, y) {
  const ax = new Set(tokenize(x))
  const ay = new Set(tokenize(y))
  let inter = 0
  for (const w of ax) {
    if (ay.has(w)) inter += 1
  }
  const union = ax.size + ay.size - inter
  if (union === 0) return 0
  const jaccard = inter / union
  return 1 - jaccard
}

/**
 * @param {string} raw
 * @returns {{ output: string, attributions: { a: string, b: string, c: string }, rationale: string }}
 */
function parseSynthesisOutput(raw) {
  const attrMarker = '---ATTRIBUTIONS---'
  const ratMarker = '---RATIONALE---'

  let output = typeof raw === 'string' ? raw.trim() : ''
  let attrBlock = ''
  let rationale = ''

  const iAttr = output.indexOf(attrMarker)
  const iRat = output.indexOf(ratMarker)

  if (iAttr !== -1) {
    const before = output.slice(0, iAttr).trim()
    let afterAttr = output.slice(iAttr + attrMarker.length).trim()
    const relRat = afterAttr.indexOf(ratMarker)

    if (relRat !== -1) {
      attrBlock = afterAttr.slice(0, relRat).trim()
      rationale = afterAttr.slice(relRat + ratMarker.length).trim()
    } else {
      attrBlock = afterAttr
    }
    output = before
  } else if (iRat !== -1) {
    rationale = output.slice(iRat + ratMarker.length).trim()
    output = output.slice(0, iRat).trim()
  }

  output = output
    .replace(/^\[(?:Synthesized answer|Your synthesized answer[^\]]*)\]\s*\n?/i, '')
    .trim()

  const attributions = { a: '', b: '', c: '' }
  if (attrBlock) {
    for (const line of attrBlock.split('\n')) {
      const t = line.trim()
      let m = t.match(/^AGENT_A:\s*(.*)$/i)
      if (m) attributions.a = m[1].trim()
      m = t.match(/^AGENT_B:\s*(.*)$/i)
      if (m) attributions.b = m[1].trim()
      m = t.match(/^AGENT_C:\s*(.*)$/i)
      if (m) attributions.c = m[1].trim()
    }
  }

  return { output, attributions, rationale }
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

/**
 * @param {string} prompt
 * @param {{ agentA: { name: string, model: string }, agentB: { name: string, model: string }, agentC: { name: string, model: string } }} config
 */
function buildSynthesisUserMessage(prompt, a, b, c, aRev, bRev, cRev, config) {
  const { agentA, agentB, agentC } = config
  return [
    `Original prompt:\n${prompt}`,
    `=== ${agentA.name} (round 1) ===\n${a}`,
    `=== ${agentB.name} (round 1) ===\n${b}`,
    `=== ${agentC.name} (round 1) ===\n${c}`,
    `=== ${agentA.name} (cross-review) ===\n${aRev}`,
    `=== ${agentB.name} (cross-review) ===\n${bRev}`,
    `=== ${agentC.name} (cross-review) ===\n${cRev}`,
  ].join('\n\n')
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

        /* Sequential calls reduce parallel load on GitHub Models (parallel bursts often return 5xx). */
        const ra = await callGitHubModel(
          config.agentA.model,
          [{ role: 'user', content: userPrompt }],
          AGENT_A_ROUND1_SYSTEM
        )
        const rb = await callGitHubModel(
          config.agentB.model,
          [{ role: 'user', content: userPrompt }],
          AGENT_B_ROUND1_SYSTEM
        )
        const rc = await callGitHubModel(
          config.agentC.model,
          [{ role: 'user', content: userPrompt }],
          AGENT_C_ROUND1_SYSTEM
        )

        dispatch({
          type: 'ADD_ROUND',
          payload: { roundNum: 1, agentA: ra, agentB: rb, agentC: rc },
        })

        const ab = diverge(ra, rb)
        const ac = diverge(ra, rc)
        const bc = diverge(rb, rc)
        const average = (ab + ac + bc) / 3

        dispatch({
          type: 'SET_DIVERGENCE',
          payload: { ab, ac, bc, average },
        })

        const aReviewMsg = buildCrossReviewUserMessage(
          'A',
          { agentA: ra, agentB: rb, agentC: rc },
          config
        )
        const bReviewMsg = buildCrossReviewUserMessage(
          'B',
          { agentA: ra, agentB: rb, agentC: rc },
          config
        )
        const cReviewMsg = buildCrossReviewUserMessage(
          'C',
          { agentA: ra, agentB: rb, agentC: rc },
          config
        )

        const aRev = await callGitHubModel(
          config.agentA.model,
          [{ role: 'user', content: aReviewMsg }],
          CROSS_REVIEW_SYSTEM
        )
        const bRev = await callGitHubModel(
          config.agentB.model,
          [{ role: 'user', content: bReviewMsg }],
          CROSS_REVIEW_SYSTEM
        )
        const cRev = await callGitHubModel(
          config.agentC.model,
          [{ role: 'user', content: cReviewMsg }],
          CROSS_REVIEW_SYSTEM
        )

        dispatch({
          type: 'ADD_REVIEW',
          payload: { roundNum: 1, aReviews: aRev, bReviews: bRev, cReviews: cRev },
        })

        const shouldSynthesize =
          uiSettings.synthesisMode === 'always' || average > 0.4

        if (!shouldSynthesize) {
          dispatch({
            type: 'SET_SYNTHESIS',
            payload: {
              output:
                '*Synthesis skipped:* your setting only runs synthesis when **average pairwise divergence** is above **40%**. This run was below that threshold — use the round responses and cross-reviews as the final output.',
              attributions: { a: '', b: '', c: '' },
              rationale: '',
            },
          })
          dispatch({ type: 'SET_STATUS', payload: 'complete' })
          return
        }

        const synthesisUser = buildSynthesisUserMessage(
          userPrompt,
          ra,
          rb,
          rc,
          aRev,
          bRev,
          cRev,
          config
        )

        const synthesisRaw = await callGitHubModel(
          config.agentA.model,
          [{ role: 'user', content: synthesisUser }],
          SYNTHESIS_SYSTEM
        )

        const parsed = parseSynthesisOutput(synthesisRaw)

        dispatch({
          type: 'SET_SYNTHESIS',
          payload: {
            output: parsed.output,
            attributions: parsed.attributions,
            rationale: parsed.rationale,
          },
        })

        dispatch({ type: 'SET_STATUS', payload: 'complete' })
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
