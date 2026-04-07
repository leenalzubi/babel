import { createContext, createElement, useContext, useReducer } from 'react'
import { AGENT_TIMEOUT_MESSAGE } from '../lib/debateConstants.js'
import { loadForgeSettings } from '../lib/forgeSettings.js'

/** @typedef {'idle' | 'running' | 'complete' | 'error' | 'partial'} ForgeStatus */

/** @typedef {null | 'round1' | 'reviews' | 'rebuttals' | 'finalPositions' | 'synthesis' | 'audit' | 'validation'} DebateStageKey */

function emptyAgentTimers() {
  return {
    a: { startTime: /** @type {number | null} */ (null), endTime: null },
    b: { startTime: /** @type {number | null} */ (null), endTime: null },
    c: { startTime: /** @type {number | null} */ (null), endTime: null },
  }
}

function createInitialState() {
  return {
    prompt: '',
    /** @type {ForgeStatus} */
    status: 'idle',
    /** @type {{ roundNum: number, agentA: string, agentB: string, agentC: string }[]} */
    rounds: [],
    /** @type {{ roundNum: number, aReviews: string, bReviews: string, cReviews: string }[]} */
    reviews: [],
    /** @type {{ ab: number, ac: number, bc: number, average: number }[]} */
    divergenceScores: [],
    /** @type {{ output: string, attributions: { a: string, b: string, c: string }, rationale: string, concessions: string[], heldFirm: string[] } | null} */
    synthesis: null,
    /** @type {string | { type?: string, title?: string, detail?: string, suggestion?: string, stage?: string, round?: number } | null} */
    error: null,
    config: {
      maxRounds: 2,
      agentA: {
        name: 'GPT-4o mini',
        model: 'openai/gpt-4o-mini',
        color: '#2563EB',
      },
      agentB: {
        name: 'Phi-4 Reasoning',
        model: 'microsoft/phi-4-reasoning',
        color: '#16A34A',
      },
      agentC: {
        name: 'Mistral Small',
        model: 'mistral-ai/mistral-small-2503',
        color: '#DC2626',
      },
    },
    agentTimers: emptyAgentTimers(),
    agentResponses: {
      a: /** @type {string | null} */ (null),
      b: null,
      c: null,
    },
    reviewTimers: emptyAgentTimers(),
    reviewResponses: {
      a: /** @type {string | null} */ (null),
      b: null,
      c: null,
    },
    rebuttals: {
      a: /** @type {string | null} */ (null),
      b: null,
      c: null,
    },
    rebuttalTimers: emptyAgentTimers(),
    finalPositions: {
      a: /** @type {string | null} */ (null),
      b: null,
      c: null,
    },
    finalPositionTimers: emptyAgentTimers(),
    /** @type {{ claims: { id: string, text: string }[], positions: unknown[], traces: unknown[] } | null} */
    audit: null,
    auditLoading: false,
    auditError: /** @type {string | null} */ (null),
    /** Peer validation of synthesis (agents B & C). Null when no run or synthesis skipped. */
    validation: null,
    /** Completed model API calls in the current run (max 15). */
    progressCallsCompleted: 0,
    /** Last major stage that finished successfully before an error/partial stop. */
    /** @type {DebateStageKey} */
    lastCompletedStage: null,
    isPartial: false,
    timeoutCount: 0,
  }
}

function forgeReducer(state, action) {
  switch (action.type) {
    case 'SET_PROMPT':
      return { ...state, prompt: action.payload ?? '' }

    case 'SET_STATUS': {
      const next = action.payload
      if (next === 'running') {
        return {
          ...state,
          status: 'running',
          rounds: [],
          reviews: [],
          divergenceScores: [],
          synthesis: null,
          error: null,
          agentTimers: emptyAgentTimers(),
          agentResponses: { a: null, b: null, c: null },
          reviewTimers: emptyAgentTimers(),
          reviewResponses: { a: null, b: null, c: null },
          rebuttals: { a: null, b: null, c: null },
          rebuttalTimers: emptyAgentTimers(),
          finalPositions: { a: null, b: null, c: null },
          finalPositionTimers: emptyAgentTimers(),
          audit: null,
          auditLoading: false,
          auditError: null,
          validation: null,
          progressCallsCompleted: 0,
          lastCompletedStage: null,
          isPartial: false,
          timeoutCount: 0,
        }
      }
      return { ...state, status: next }
    }

    case 'RESUME_DEBATE':
      return {
        ...state,
        status: 'running',
        error: null,
        isPartial: false,
      }

    case 'SET_LAST_COMPLETED_STAGE':
      return {
        ...state,
        lastCompletedStage:
          action.payload && typeof action.payload === 'object' && 'stage' in action.payload
            ? /** @type {DebateStageKey} */ (action.payload.stage)
            : null,
      }

    case 'SET_PARTIAL':
      return { ...state, isPartial: Boolean(action.payload) }

    case 'INCREMENT_PROGRESS_CALLS': {
      const add =
        typeof action.payload === 'number' && Number.isFinite(action.payload)
          ? Math.max(0, Math.round(action.payload))
          : 1
      return {
        ...state,
        progressCallsCompleted: Math.min(15, (state.progressCallsCompleted ?? 0) + add),
      }
    }

    case 'INCREMENT_TIMEOUT_COUNT':
      return {
        ...state,
        timeoutCount: (state.timeoutCount ?? 0) + 1,
      }

    case 'SET_AUDIT':
      return {
        ...state,
        audit: action.payload ?? null,
        auditError: null,
      }

    case 'SET_AUDIT_LOADING':
      return { ...state, auditLoading: Boolean(action.payload) }

    case 'SET_AUDIT_ERROR':
      return {
        ...state,
        auditError:
          typeof action.payload === 'string' ? action.payload : null,
      }

    case 'SET_AGENT_THINKING': {
      const { agent, startTime } = action.payload
      const k = /** @type {'a' | 'b' | 'c'} */ (agent)
      let rounds = state.rounds
      if (k === 'a' && !rounds.some((r) => r.roundNum === 1)) {
        rounds = [
          ...rounds,
          { roundNum: 1, agentA: '', agentB: '', agentC: '' },
        ]
      }
      return {
        ...state,
        rounds,
        agentTimers: {
          ...state.agentTimers,
          [k]: { startTime, endTime: null },
        },
      }
    }

    case 'SET_AGENT_DONE': {
      const { agent, response, endTime } = action.payload
      const k = /** @type {'a' | 'b' | 'c'} */ (agent)
      const field =
        k === 'a' ? 'agentA' : k === 'b' ? 'agentB' : 'agentC'
      const idx = state.rounds.findIndex((r) => r.roundNum === 1)
      const rounds = [...state.rounds]
      if (idx >= 0) {
        rounds[idx] = { ...rounds[idx], [field]: response ?? '' }
      }
      return {
        ...state,
        agentResponses: { ...state.agentResponses, [k]: response ?? '' },
        agentTimers: {
          ...state.agentTimers,
          [k]: { ...state.agentTimers[k], endTime },
        },
        rounds,
      }
    }

    case 'SET_AGENT_TIMEOUT': {
      const { agent, endTime } = action.payload
      const t = endTime ?? Date.now()
      const next = forgeReducer(state, {
        type: 'SET_AGENT_DONE',
        payload: {
          agent,
          response: AGENT_TIMEOUT_MESSAGE,
          endTime: t,
        },
      })
      return { ...next, timeoutCount: (next.timeoutCount ?? 0) + 1 }
    }

    case 'SET_REVIEW_THINKING': {
      const { agent, startTime } = action.payload
      const k = /** @type {'a' | 'b' | 'c'} */ (agent)
      let reviews = state.reviews
      const rIdx = reviews.findIndex((r) => r.roundNum === 1)
      if (rIdx === -1) {
        reviews = [
          ...reviews,
          { roundNum: 1, aReviews: '', bReviews: '', cReviews: '' },
        ]
      }
      return {
        ...state,
        reviews,
        reviewTimers: {
          ...state.reviewTimers,
          [k]: { startTime, endTime: null },
        },
      }
    }

    case 'SET_REVIEW_DONE': {
      const { agent, review, endTime } = action.payload
      const k = /** @type {'a' | 'b' | 'c'} */ (agent)
      const field =
        k === 'a' ? 'aReviews' : k === 'b' ? 'bReviews' : 'cReviews'
      const rIdx = state.reviews.findIndex((r) => r.roundNum === 1)
      const reviews = [...state.reviews]
      const text = review ?? ''
      if (rIdx >= 0) {
        reviews[rIdx] = { ...reviews[rIdx], [field]: text }
      } else {
        reviews.push({
          roundNum: 1,
          aReviews: k === 'a' ? text : '',
          bReviews: k === 'b' ? text : '',
          cReviews: k === 'c' ? text : '',
        })
      }
      return {
        ...state,
        reviews,
        reviewResponses: { ...state.reviewResponses, [k]: text },
        reviewTimers: {
          ...state.reviewTimers,
          [k]: { ...state.reviewTimers[k], endTime },
        },
      }
    }

    case 'ADD_ROUND': {
      const { roundNum, agentA, agentB, agentC } = action.payload
      const entry = {
        roundNum,
        agentA: agentA ?? '',
        agentB: agentB ?? '',
        agentC: agentC ?? '',
      }
      const idx = state.rounds.findIndex((r) => r.roundNum === roundNum)
      if (idx === -1) {
        return { ...state, rounds: [...state.rounds, entry] }
      }
      const rounds = [...state.rounds]
      rounds[idx] = entry
      return { ...state, rounds }
    }

    case 'ADD_REVIEW': {
      const { roundNum, aReviews, bReviews, cReviews } = action.payload
      const entry = {
        roundNum,
        aReviews: aReviews ?? '',
        bReviews: bReviews ?? '',
        cReviews: cReviews ?? '',
      }
      const idx = state.reviews.findIndex((r) => r.roundNum === roundNum)
      if (idx === -1) {
        return { ...state, reviews: [...state.reviews, entry] }
      }
      const reviews = [...state.reviews]
      reviews[idx] = entry
      return { ...state, reviews }
    }

    case 'SET_DIVERGENCE': {
      const { ab, ac, bc, average } = action.payload
      return {
        ...state,
        divergenceScores: [
          ...state.divergenceScores,
          {
            ab: Number(ab),
            ac: Number(ac),
            bc: Number(bc),
            average: Number(average),
          },
        ],
      }
    }

    case 'SET_SYNTHESIS':
      return {
        ...state,
        synthesis: {
          output: action.payload.output ?? '',
          attributions: {
            a: action.payload.attributions?.a ?? '',
            b: action.payload.attributions?.b ?? '',
            c: action.payload.attributions?.c ?? '',
          },
          rationale: action.payload.rationale ?? '',
          concessions: Array.isArray(action.payload.concessions)
            ? action.payload.concessions
            : [],
          heldFirm: Array.isArray(action.payload.heldFirm)
            ? action.payload.heldFirm
            : [],
        },
      }

    case 'SET_VALIDATION':
      return {
        ...state,
        validation:
          action.payload &&
          typeof action.payload === 'object' &&
          'status' in action.payload
            ? {
                b: action.payload.b ?? null,
                c: action.payload.c ?? null,
                status: /** @type {'pending' | 'approved' | 'flagged'} */ (
                  action.payload.status
                ),
              }
            : null,
      }

    case 'SET_REBUTTAL_THINKING': {
      const { agent, startTime } = action.payload
      const k = /** @type {'a' | 'b' | 'c'} */ (agent)
      return {
        ...state,
        rebuttalTimers: {
          ...state.rebuttalTimers,
          [k]: { startTime, endTime: null },
        },
      }
    }

    case 'SET_REBUTTAL_DONE': {
      const { agent, rebuttal, endTime } = action.payload
      const k = /** @type {'a' | 'b' | 'c'} */ (agent)
      const text = rebuttal ?? ''
      return {
        ...state,
        rebuttals: { ...state.rebuttals, [k]: text },
        rebuttalTimers: {
          ...state.rebuttalTimers,
          [k]: { ...state.rebuttalTimers[k], endTime },
        },
      }
    }

    case 'SET_FINAL_THINKING': {
      const { agent, startTime } = action.payload
      const k = /** @type {'a' | 'b' | 'c'} */ (agent)
      return {
        ...state,
        finalPositionTimers: {
          ...state.finalPositionTimers,
          [k]: { startTime, endTime: null },
        },
      }
    }

    case 'SET_FINAL_DONE': {
      const { agent, position, endTime } = action.payload
      const k = /** @type {'a' | 'b' | 'c'} */ (agent)
      const text = position ?? ''
      return {
        ...state,
        finalPositions: { ...state.finalPositions, [k]: text },
        finalPositionTimers: {
          ...state.finalPositionTimers,
          [k]: { ...state.finalPositionTimers[k], endTime },
        },
      }
    }

    case 'SET_ERROR':
      return { ...state, error: action.payload ?? null }

    case 'PATCH_CONFIG':
      return {
        ...state,
        config: { ...state.config, ...action.payload },
      }

    case 'RESET': {
      const fresh = createInitialState()
      const saved = loadForgeSettings()
      return {
        ...fresh,
        config: { ...fresh.config, maxRounds: saved.maxRounds },
      }
    }

    default:
      return state
  }
}

const ForgeContext = createContext(null)

function initForgeState() {
  const base = createInitialState()
  const saved = loadForgeSettings()
  return {
    ...base,
    config: { ...base.config, maxRounds: saved.maxRounds },
  }
}

export function ForgeProvider({ children }) {
  const [state, dispatch] = useReducer(forgeReducer, undefined, initForgeState)
  const value = { state, dispatch }
  return createElement(ForgeContext.Provider, { value }, children)
}

export function useForge() {
  const ctx = useContext(ForgeContext)
  if (ctx == null) {
    throw new Error('useForge must be used within a ForgeProvider')
  }
  return ctx
}

export { createInitialState }
