import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Check, Sparkles } from 'lucide-react'
import { useForge } from '../store/useForgeStore.js'

/** @param {'pending' | 'active' | 'complete'} state */
function StatusDot({ state }) {
  if (state === 'complete') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--agree)]/20 text-[var(--agree)] ring-1 ring-[var(--agree)]/40">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        <span
          className="absolute inline-flex h-4 w-4 animate-ping rounded-full bg-[var(--accent-forge)] opacity-40"
          aria-hidden
        />
        <span className="relative h-3 w-3 rounded-full bg-[var(--accent-forge)] shadow-[0_0_12px_rgba(224,92,42,0.6)]" />
      </span>
    )
  }
  return (
    <span className="h-6 w-6 shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-base)] ring-1 ring-black/[0.06]" />
  )
}

/** @param {{ pct: number, muted?: boolean }} props */
function DivergenceBar({ pct, muted }) {
  const w = Math.max(0, Math.min(100, pct))
  return (
    <div
      className={`mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--bg-base)] ${muted ? 'opacity-50' : ''}`}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[var(--agent-a)] via-[var(--agent-b)] to-[var(--agent-c)] transition-[width] duration-500"
        style={{ width: `${w}%` }}
      />
    </div>
  )
}

function useWorkflowSteps(state) {
  const { status, rounds, reviews, synthesis, config } = state

  const round1Done = rounds.some((r) => r.roundNum === 1)
  const reviewDone = reviews.some((r) => r.roundNum === 1)
  const running = status === 'running'
  const round2Applicable = config.maxRounds >= 2

  /** @type {'pending' | 'active' | 'complete'} */
  let s1 = 'pending'
  if (status !== 'idle') s1 = 'complete'

  let s2 = 'pending'
  if (round1Done) s2 = 'complete'
  else if (running) s2 = 'active'

  let s3 = 'pending'
  if (reviewDone) s3 = 'complete'
  else if (running && round1Done) s3 = 'active'

  let s4 = 'pending'
  if (reviewDone) s4 = 'complete'
  else if (running && round1Done) s4 = 'pending'

  let s5 = 'pending'
  if (synthesis) s5 = 'complete'
  else if (running && reviewDone) s5 = 'active'

  let s6 = 'pending'
  if (status === 'complete') s6 = 'complete'

  if (status === 'error') {
    if (round1Done) s2 = 'complete'
    if (reviewDone) {
      s3 = 'complete'
      s4 = 'complete'
    }
    if (synthesis) {
      s5 = 'complete'
      s6 = 'complete'
    }
  }

  return {
    steps: [
      { key: 'prompt', label: 'Prompt Received', state: s1, icon: null },
      {
        key: 'r1',
        label: 'Round 1: Independent',
        state: s2,
        icon: 'agents',
        divergenceIdx: 0,
      },
      { key: 'cross', label: 'Cross-Review', state: s3, icon: 'arrows' },
      {
        key: 'r2',
        label: 'Round 2: Debate',
        state: s4,
        icon: null,
        dim: !round2Applicable,
      },
      { key: 'synth', label: 'Synthesis', state: s5, icon: 'sparkles' },
      { key: 'done', label: 'Complete', state: s6, icon: null },
    ],
    round2Applicable,
  }
}

export default function WorkflowTimeline() {
  const { state } = useForge()
  const { steps, round2Applicable } = useWorkflowSteps(state)
  const { config, divergenceScores } = state
  const [mobileStepHint, setMobileStepHint] = useState('')
  const hintClearRef = useRef(0)

  const showMobileHint = useCallback((label) => {
    window.clearTimeout(hintClearRef.current)
    setMobileStepHint(label)
    hintClearRef.current = window.setTimeout(() => setMobileStepHint(''), 2500)
  }, [])

  useEffect(
    () => () => window.clearTimeout(hintClearRef.current),
    []
  )

  const line = (
    <div
      className="absolute left-[11px] top-8 bottom-8 w-px bg-[var(--border)] md:left-[11px]"
      aria-hidden
    />
  )

  const renderDesktopStepRow = (step) => {
    const score =
      step.divergenceIdx != null
        ? divergenceScores[step.divergenceIdx]
        : null
    const pct = score ? Math.round(Number(score.average) * 100) : 0
    const showBar =
      step.state === 'complete' &&
      score != null &&
      !Number.isNaN(pct)

    const icon =
      step.icon === 'arrows' ? (
        <ArrowLeftRight
          className="h-3.5 w-3.5 text-[var(--text-muted)]"
          aria-hidden
        />
      ) : step.icon === 'sparkles' ? (
        <Sparkles
          className="h-3.5 w-3.5 text-[var(--accent-forge)]"
          aria-hidden
        />
      ) : null

    return (
      <div
        key={step.key}
        className={`relative flex min-w-0 flex-1 flex-col gap-1 pb-6 last:pb-0 ${step.dim ? 'opacity-70' : ''}`}
      >
        <div className="flex items-start gap-3">
          <div className="relative z-[1] flex flex-col items-center">
            <StatusDot state={step.state} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-1.5">
              {icon}
              <span
                className={`font-mono text-[11px] font-medium leading-tight text-[var(--text-primary)] ${step.state === 'pending' ? 'text-[var(--text-muted)]' : ''}`}
              >
                {step.label}
              </span>
            </div>
            {step.key === 'r1' && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                <span className="flex items-center gap-1 font-mono text-[9px] text-[var(--text-muted)]">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: config.agentA.color }}
                  />
                  {config.agentA.name}
                </span>
                <span className="flex items-center gap-1 font-mono text-[9px] text-[var(--text-muted)]">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: config.agentB.color }}
                  />
                  {config.agentB.name}
                </span>
                <span className="flex items-center gap-1 font-mono text-[9px] text-[var(--text-muted)]">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: config.agentC.color }}
                  />
                  {config.agentC.name}
                </span>
              </div>
            )}
            {step.key === 'r2' && !round2Applicable && step.state === 'complete' && (
              <p className="mt-1 font-mono text-[9px] text-[var(--text-muted)]">
                Not used (single-round mode)
              </p>
            )}
            {showBar && (
              <div className="pr-1 pt-1">
                <p className="font-mono text-[9px] text-[var(--text-muted)]">
                  Divergence (avg.)
                </p>
                <DivergenceBar pct={pct} />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <aside
      className="fixed left-0 right-0 top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-surface)] shadow-forge-card md:bottom-0 md:left-auto md:right-0 md:top-0 md:h-screen md:w-[240px] md:border-b-0 md:border-l md:px-4 md:py-5 md:shadow-none"
      aria-label="Debate workflow"
    >
      {/* Mobile: horizontal scroll, dots only; title uses native tooltip via title */}
      <div className="px-2 py-2 md:hidden">
        <h2 className="sr-only">Workflow</h2>
        <div
          className="flex w-full items-center gap-1 overflow-x-auto overflow-y-hidden py-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="list"
        >
          {steps.map((step, i) => (
            <div key={step.key} className="flex shrink-0 items-center" role="listitem">
              {i > 0 ? (
                <span
                  className="mx-1.5 h-px w-6 shrink-0 bg-[var(--border)]"
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                title={step.label}
                aria-label={step.label}
                aria-current={step.state === 'active' ? 'step' : undefined}
                onClick={() => showMobileHint(step.label)}
                className={`flex shrink-0 touch-manipulation rounded-full p-1 outline-none ring-offset-2 ring-offset-[var(--bg-surface)] focus-visible:ring-2 focus-visible:ring-[var(--accent-forge)] ${step.dim ? 'opacity-70' : ''}`}
              >
                <StatusDot state={step.state} />
              </button>
            </div>
          ))}
        </div>
        {mobileStepHint ? (
          <p
            className="truncate px-1 pt-1 text-center font-mono text-[10px] text-[var(--text-muted)]"
            role="status"
          >
            {mobileStepHint}
          </p>
        ) : null}
      </div>

      {/* Desktop: vertical timeline */}
      <div className="hidden px-3 py-0 md:block md:px-0 md:py-0">
        <h2 className="mb-4 font-mono text-[11px] font-semibold tracking-widest text-[var(--text-muted)]">
          WORKFLOW
        </h2>
        <div className="relative">
          {line}
          <div className="relative space-y-0">
            {steps.map((step) => renderDesktopStepRow(step))}
          </div>
        </div>
      </div>
    </aside>
  )
}
