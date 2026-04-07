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
import AuditTrail from './components/AuditTrail.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import FindingsPanel from './components/FindingsPanel.jsx'
import ResearchPanel from './components/ResearchPanel.jsx'
import ForgeEmptyState from './components/ForgeEmptyState.jsx'
import LiveAgentStrip from './components/LiveAgentStrip.jsx'
import PromptInput from './components/PromptInput.jsx'
import ReviewCard from './components/ReviewCard.jsx'
import RoundCard from './components/RoundCard.jsx'
import SettingsDrawer from './components/SettingsDrawer.jsx'
import WorkflowTimeline from './components/WorkflowTimeline.jsx'
import { useDebateEngine } from './hooks/useDebateEngine.js'
import { useForge } from './store/useForgeStore.js'

const SynthesisPanel = lazy(() => import('./components/SynthesisPanel.jsx'))

const WORKFLOW_SIDEBAR_COLLAPSED_KEY = 'forge-workflow-sidebar-collapsed'

function readWorkflowSidebarCollapsed() {
  try {
    return window.localStorage.getItem(WORKFLOW_SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

const DEFAULT_SCORES = { ab: 0, ac: 0, bc: 0, average: 0 }

function HeaderAgentPill({ name, color }) {
  return (
    <div className="inline-flex max-w-[160px] items-center gap-2 truncate sm:max-w-none">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="truncate font-mono text-[10px] font-medium text-[var(--text-primary)]">
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
  const [mainTab, setMainTab] = useState(
    /** @type {'forge' | 'findings' | 'about'} */ ('forge')
  )
  const [workflowSidebarCollapsed, setWorkflowSidebarCollapsed] = useState(
    () => readWorkflowSidebarCollapsed()
  )

  const running = state.status === 'running'

  const showWorkflowSidebar =
    mainTab === 'forge' &&
    (state.status !== 'idle' ||
      state.rounds.length > 0 ||
      state.synthesis != null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        WORKFLOW_SIDEBAR_COLLAPSED_KEY,
        workflowSidebarCollapsed ? '1' : '0'
      )
    } catch {
      /* ignore */
    }
  }, [workflowSidebarCollapsed])

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

  const promptInputRef = useRef(
    /** @type {{ focusPrompt: () => void } | null} */ (null)
  )

  const focusPromptAfterExample = useCallback(() => {
    promptInputRef.current?.focusPrompt()
  }, [])

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

  const mainMobilePt = showWorkflowSidebar
    ? 'pt-[calc(5.25rem+env(safe-area-inset-top,0px))]'
    : 'pt-0'
  const headerStickyTopMobile = showWorkflowSidebar
    ? 'top-[calc(5.25rem+env(safe-area-inset-top,0px))]'
    : 'top-0'
  const headerPaddingY = showWorkflowSidebar
    ? 'py-4 md:pt-10 md:pb-5'
    : 'pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 md:pt-10 md:pb-5'
  const mainMdPr =
    showWorkflowSidebar && !workflowSidebarCollapsed
      ? 'md:pr-[272px]'
      : 'md:pr-10'
  const roundScrollMt = showWorkflowSidebar
    ? 'scroll-mt-[calc(5.25rem+env(safe-area-inset-top,0px))]'
    : 'scroll-mt-[calc(4rem+env(safe-area-inset-top,0px))]'

  return (
    <div className="app-shell relative flex min-h-dvh w-full flex-row bg-[var(--bg-base)] text-[var(--text-primary)]">
      <main
        className={`main-content relative z-[2] flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 pb-16 sm:px-6 md:min-h-0 md:pb-20 md:pl-10 md:pt-0 ${mainMobilePt} ${mainMdPr}`}
      >
        <header
          className={`sticky z-20 -mx-4 mb-8 border-b border-[var(--border)] bg-[var(--bg-base)] px-4 sm:-mx-6 sm:px-6 md:top-0 md:-mx-10 md:mb-10 md:px-10 ${headerPaddingY} ${headerStickyTopMobile}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-display text-2xl font-normal tracking-[0.12em] text-[var(--text-primary)]">
              BABEL
            </span>
            <div className="order-3 flex w-full flex-wrap items-center justify-center gap-2 md:order-none md:flex-1 md:justify-end md:pr-4">
              <HeaderAgentPill name={cfg.agentA.name} color={cfg.agentA.color} />
              <HeaderAgentPill name={cfg.agentB.name} color={cfg.agentB.color} />
              <HeaderAgentPill name={cfg.agentC.name} color={cfg.agentC.color} />
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="order-2 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-[var(--text-secondary)] transition hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] md:order-none"
              aria-label="Open settings"
            >
              <Settings className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        <nav
          className="-mx-4 mb-8 flex justify-center border-b border-[var(--border)] bg-[var(--bg-base)] px-4 pb-4 sm:-mx-6 sm:px-6 md:-mx-10 md:justify-start md:px-10"
          aria-label="Main views"
        >
          <div className="inline-flex max-w-full flex-wrap justify-center gap-0.5 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] p-0.5">
            <button
              type="button"
              onClick={() => setMainTab('forge')}
              aria-pressed={mainTab === 'forge'}
              className={`rounded-[4px] px-3 py-2 font-mono text-xs font-semibold transition sm:px-4 ${
                mainTab === 'forge'
                  ? 'bg-[var(--accent-forge)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Babel
            </button>
            <button
              type="button"
              onClick={() => setMainTab('findings')}
              aria-pressed={mainTab === 'findings'}
              className={`rounded-[4px] px-3 py-2 font-mono text-xs font-semibold transition sm:px-4 ${
                mainTab === 'findings'
                  ? 'bg-[var(--accent-forge)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Findings
            </button>
            <button
              type="button"
              onClick={() => setMainTab('about')}
              aria-pressed={mainTab === 'about'}
              className={`rounded-[4px] px-3 py-2 font-mono text-xs font-semibold transition sm:px-4 ${
                mainTab === 'about'
                  ? 'bg-[var(--accent-forge)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              About
            </button>
          </div>
        </nav>

        {mainTab === 'findings' ? (
          <FindingsPanel />
        ) : mainTab === 'about' ? (
          <ResearchPanel />
        ) : (
          <>
            <div className="mb-10 shrink-0">
              <PromptInput
                ref={promptInputRef}
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
                <ForgeEmptyState
                  onPickExample={setPromptDraft}
                  onAfterExamplePick={focusPromptAfterExample}
                />
              ) : null}

              {sortedRounds.map((round, roundIdx) => {
                const scores = state.divergenceScores[roundIdx] ?? DEFAULT_SCORES
                const review = state.reviews.find(
                  (r) => r.roundNum === round.roundNum
                )
                return (
                  <div
                    key={round.roundNum}
                    id={`forge-round-${round.roundNum}`}
                    className={`flex ${roundScrollMt} flex-col gap-12 md:scroll-mt-8`}
                  >
                    <RoundCard
                      roundNum={round.roundNum}
                      scores={scores}
                      round={round}
                      config={cfg}
                      agentTimers={state.agentTimers}
                    />
                    {review ? (
                      <ReviewCard
                        key={`review-${review.roundNum}`}
                        roundNum={review.roundNum}
                        aReviews={review.aReviews}
                        bReviews={review.bReviews}
                        cReviews={review.cReviews}
                        config={cfg}
                        reviewTimers={state.reviewTimers}
                      />
                    ) : null}
                  </div>
                )
              })}

              {state.synthesis ? (
                <>
                  <div
                    id="forge-synthesis"
                    className={`${roundScrollMt} md:scroll-mt-8`}
                  >
                    <Suspense
                      fallback={
                        <div
                          className="rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-12 text-center font-mono text-xs text-[var(--text-muted)]"
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
                  <div
                    className="my-8 w-full border-t border-dashed border-[#D4C9B0]"
                    role="presentation"
                  />
                  <AuditTrail />
                </>
              ) : null}
            </div>
          </>
        )}
      </main>

      {showWorkflowSidebar ? (
        <WorkflowTimeline
          collapsed={workflowSidebarCollapsed}
          onCollapsedChange={setWorkflowSidebarCollapsed}
        />
      ) : null}

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
