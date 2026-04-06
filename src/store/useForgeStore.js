import { createContext, createElement, useContext, useReducer } from 'react'
import { loadForgeSettings } from '../lib/forgeSettings.js'

/** @typedef {'idle' | 'running' | 'complete' | 'error'} ForgeStatus */

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
    /** @type {{ output: string, attributions: { a: string, b: string, c: string }, rationale: string } | null} */
    synthesis: null,
    error: null,
    config: {
      maxRounds: 2,
      agentA: {
        name: 'GPT-4o mini',
        model: 'openai/gpt-4o-mini',
        color: '#10A37F',
      },
      agentB: {
        name: 'Phi-4 Reasoning',
        model: 'microsoft/phi-4-reasoning',
        color: '#0078D4',
      },
      agentC: {
        name: 'Mistral Small',
        model: 'mistral-ai/mistral-small-2503',
        color: '#FF7000',
      },
    },
  }
}

function forgeReducer(state, action) {
  switch (action.type) {
    case 'SET_PROMPT':
      return { ...state, prompt: action.payload ?? '' }

    case 'SET_STATUS':
      return { ...state, status: action.payload }

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
        },
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
