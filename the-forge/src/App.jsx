import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Settings } from 'lucide-react'
import ErrorBanner from './components/ErrorBanner.jsx'
import ForgeEmptyState from './components/ForgeEmptyState.jsx'
import LiveAgentStrip from './components/LiveAgentStrip.jsx'
import PromptInput from './components/PromptInput.jsx'
import ReviewCard from './components/ReviewCard.jsx'
import RoundCard from './components/RoundCard.jsx'
const SynthesisPanel = lazy(() => import('./components/SynthesisPanel.jsx'))
import SettingsDrawer from './components/SettingsDrawer.jsx'
import WorkflowTimeline from './components/WorkflowTimeline.jsx'
import { useDebateEngine } from './hooks/useDebateEngine.js'
import { useForge } from './store/useForgeStore.js'

const DEFAULT_SCORES = { ab: 0, ac: 0, bc: 0, average: 0 }

function HeaderAgentPill({ name, color }) {
  return (
    <div className="inline-flex max-w-[140px] items-center gap-2 truncate rounded-full border border-[var(--border)] bg-[var(--bg-surface)] py-1.5 pl-2.5 pr-3 shadow-forge-card sm:max-w-none">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="truncate font-mono text-[10px] font-semibold text-[var(--text-primary)]">
        {name}
      </span>
    </div>
  )
}

export default function App() {
  const { state, dispatch } = useForge()
  const { runDebate } = useDebateEngine()
  const [promptDraft, setPromptDraft] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const running = state.status === 'running'

  const cfg = state.config

  const sortedRounds = useMemo(
    () => [...state.rounds].sort((a, b) => a.roundNum - b.roundNum),
    [state.rounds]
  )

  const showEmptyState =
    state.status === 'idle' &&
    state.rounds.length === 0 &&
    state.synthesis == null

  const handleRun = useCallback(() => {
    const p = promptDraft.trim()
    if (p.length < 20) return
    runDebate(p, cfg)
  }, [promptDraft, cfg, runDebate])

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' })
    setPromptDraft('')
  }, [dispatch])

  const roundsLenRef = useRef(0)
  useEffect(() => {
    const n = state.rounds.length
    if (n > roundsLenRef.current && n > 0) {
      const last = state.rounds.reduce((best, r) =>
        r.roundNum > best.roundNum ? r : best
      )
      requestAnimationFrame(() => {
        document
          .getElementById(`forge-round-${last.roundNum}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
    roundsLenRef.current = n
  }, [state.rounds])

  const synthesisSeenRef = useRef(false)
  useEffect(() => {
    if (state.synthesis) {
      if (!synthesisSeenRef.current) {
        synthesisSeenRef.current = true
        requestAnimationFrame(() => {
          document
            .getElementById('forge-synthesis')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    } else {
      synthesisSeenRef.current = false
    }
  }, [state.synthesis])

  return (
    <div className="app-shell relative flex min-h-dvh w-full flex-row bg-[var(--bg-base)] text-[var(--text-primary)]">
      <main className="main-content relative z-[2] flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 pb-16 pt-[calc(5.25rem+env(safe-area-inset-top,0px))] sm:px-6 md:min-h-0 md:px-10 md:pb-20 md:pr-[272px] md:pt-10">
        <header
          className="sticky top-[calc(5.25rem+env(safe-area-inset-top,0px))] z-20 -mx-4 mb-8 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-4 shadow-forge-card sm:-mx-6 sm:px-6 md:top-0 md:-mx-10 md:mb-10 md:px-10 md:py-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono text-[11px] font-semibold tracking-[0.28em] text-[var(--text-primary)]">
              THE FORGE
            </span>
            <div className="order-3 flex w-full flex-wrap items-center justify-center gap-2 md:order-none md:flex-1 md:justify-end md:pr-4">
              <HeaderAgentPill name={cfg.agentA.name} color={cfg.agentA.color} />
              <HeaderAgentPill name={cfg.agentB.name} color={cfg.agentB.color} />
              <HeaderAgentPill name={cfg.agentC.name} color={cfg.agentC.color} />
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-forge-card order-2 border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-[var(--text-secondary)] shadow-forge-card transition hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] md:order-none"
              aria-label="Open settings"
            >
              <Settings className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        <div className="mb-10 shrink-0">
          <PromptInput
            value={promptDraft}
            onChange={setPromptDraft}
            onRun={handleRun}
            onReset={handleReset}
            disabled={running}
          />
        </div>

        {running ? <LiveAgentStrip state={state} /> : null}

        <ErrorBanner
          message={state.error}
          onDismiss={() => dispatch({ type: 'SET_ERROR', payload: null })}
        />

        <div className="mt-2 flex flex-col gap-12 md:gap-14">
          {showEmptyState ? (
            <ForgeEmptyState onPickExample={setPromptDraft} />
          ) : null}

          {sortedRounds.map((round, roundIdx) => {
            const scores = state.divergenceScores[roundIdx] ?? DEFAULT_SCORES
            const review = state.reviews.find((r) => r.roundNum === round.roundNum)
            return (
              <div
                key={round.roundNum}
                id={`forge-round-${round.roundNum}`}
                className="flex scroll-mt-[calc(5.25rem+env(safe-area-inset-top,0px))] flex-col gap-12 md:scroll-mt-8"
              >
                <RoundCard
                  roundNum={round.roundNum}
                  scores={scores}
                  round={round}
                  config={cfg}
                />
                {review ? (
                  <ReviewCard
                    key={`review-${review.roundNum}`}
                    roundNum={review.roundNum}
                    aReviews={review.aReviews}
                    bReviews={review.bReviews}
                    cReviews={review.cReviews}
                  />
                ) : null}
              </div>
            )
          })}

          {state.synthesis ? (
            <div
              id="forge-synthesis"
              className="scroll-mt-[calc(5.25rem+env(safe-area-inset-top,0px))] md:scroll-mt-8"
            >
              <Suspense
                fallback={
                  <div
                    className="rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-12 text-center font-mono text-xs text-[var(--text-muted)] shadow-forge-card"
                    role="status"
                    aria-live="polite"
                  >
                    Loading synthesis…
                  </div>
                }
              >
                <SynthesisPanel synthesis={state.synthesis} />
              </Suspense>
            </div>
          ) : null}
        </div>
      </main>

      <WorkflowTimeline />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
