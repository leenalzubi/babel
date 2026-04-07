import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
} from 'lucide-react'
import AgentTimer from './AgentTimer.jsx'
import { isAgentTimeoutResponse } from '../lib/debateConstants.js'
import { computeProgressUi } from '../lib/progressEstimate.js'
import {
  BABEL_SYNTHESIS_TOGGLE_EVENT,
  readBabelSynthesisEnabled,
} from '../lib/babelSynthesisPref.js'
import { useForge } from '../store/useForgeStore.js'

/** @param {'pending' | 'active' | 'complete' | 'partial'} state */
function StatusDot({ state }) {
  if (state === 'complete') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--agree)]/20 text-[var(--agree)] ring-1 ring-[var(--agree)]/40">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </span>
    )
  }
  if (state === 'partial') {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-amber-600/50 bg-amber-500/10 text-amber-700/90 ring-1 ring-amber-600/30"
        title="Partial — at least one model timed out in this stage"
      >
        <Clock className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        <span
          className="absolute inline-flex h-4 w-4 animate-ping rounded-full bg-[var(--accent-forge)] opacity-35"
          aria-hidden
        />
        <span className="relative h-3 w-3 rounded-full bg-[var(--accent-forge)]" />
      </span>
    )
  }
  return (
    <span className="h-6 w-6 shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-base)]" />
  )
}

/** @param {{ pct: number, muted?: boolean }} props */
function DivergenceBar({ pct, muted }) {
  const w = Math.max(0, Math.min(100, pct))
  return (
    <div
      className={`mt-1.5 h-1 w-full overflow-hidden rounded-[2px] bg-[var(--bg-base)] ${muted ? 'opacity-50' : ''}`}
    >
      <div
        className="h-full rounded-[2px] bg-[var(--accent-forge)]/70 transition-[width] duration-500"
        style={{ width: `${w}%` }}
      />
    </div>
  )
}

/**
 * @param {Record<string, unknown>} state
 * @param {boolean} synthesisEnabled
 */
function useWorkflowSteps(state, synthesisEnabled) {
  const {
    status,
    rounds,
    reviews,
    synthesis,
    agentResponses,
    reviewResponses,
    finalPositions,
    timeoutCount,
  } = state

  const round1Done =
    (agentResponses?.a &&
      agentResponses?.b &&
      agentResponses?.c) ||
    rounds.some(
      (r) =>
        r.roundNum === 1 &&
        String(r.agentA ?? '').length > 0 &&
        String(r.agentB ?? '').length > 0 &&
        String(r.agentC ?? '').length > 0
    )

  const reviewDone =
    (reviewResponses?.a &&
      reviewResponses?.b &&
      reviewResponses?.c) ||
    reviews.some(
      (r) =>
        r.roundNum === 1 &&
        String(r.aReviews ?? '').length > 0 &&
        String(r.bReviews ?? '').length > 0 &&
        String(r.cReviews ?? '').length > 0
    )

  const fp = finalPositions ?? {}
  const finalDone =
    String(fp.a ?? '').length > 0 &&
    String(fp.b ?? '').length > 0 &&
    String(fp.c ?? '').length > 0

  const running = status === 'running'

  const r1 = rounds.find((r) => r.roundNum === 1)
  const round1Timeout =
    r1 &&
    [r1.agentA, r1.agentB, r1.agentC].some((t) => isAgentTimeoutResponse(t))
  const rev = reviews.find((r) => r.roundNum === 1)
  const reviewTimeout =
    rev &&
    [rev.aReviews, rev.bReviews, rev.cReviews].some((t) =>
      isAgentTimeoutResponse(t)
    )
  const finalTimeout = [fp.a, fp.b, fp.c].some((t) =>
    isAgentTimeoutResponse(t)
  )
  const synthesisTimeout =
    synthesis &&
    typeof synthesis.output === 'string' &&
    isAgentTimeoutResponse(synthesis.output)

  /** @type {'pending' | 'active' | 'complete' | 'partial'} */
  let s1 = 'pending'
  if (status !== 'idle') s1 = 'complete'

  let s2 = 'pending'
  if (round1Done) s2 = 'complete'
  else if (running) s2 = 'active'

  let s3 = 'pending'
  if (reviewDone) s3 = 'complete'
  else if (running && round1Done) s3 = 'active'

  let s4 = 'pending'
  if (finalDone) s4 = 'complete'
  else if (running && reviewDone) s4 = 'active'

  let s5 = 'pending'
  if (synthesisEnabled) {
    if (synthesis) s5 = 'complete'
    else if (running && finalDone) s5 = 'active'
  } else {
    s5 = 'pending'
  }

  let s6 = 'pending'
  if (status === 'complete') s6 = 'complete'
  else if (!synthesisEnabled && running && finalDone) s6 = 'active'

  if (status === 'error' || status === 'partial') {
    if (round1Done) s2 = 'complete'
    if (reviewDone) s3 = 'complete'
    if (finalDone) s4 = 'complete'
    if (synthesisEnabled && synthesis) {
      s5 = 'complete'
      s6 = 'complete'
    }
    if (!synthesisEnabled && finalDone) s6 = 'complete'
  }

  const markPartial = (
    /** @type {'pending' | 'active' | 'complete' | 'partial'} */ step,
    timeout
  ) => {
    if (step === 'complete' && timeout) return 'partial'
    return step
  }

  s2 = markPartial(s2, Boolean(round1Timeout))
  s3 = markPartial(s3, Boolean(reviewTimeout))
  s4 = markPartial(s4, Boolean(finalTimeout))
  if (synthesisEnabled) {
    s5 = markPartial(s5, Boolean(synthesisTimeout))
  }
  const tc = timeoutCount ?? 0
  s6 = markPartial(s6, status === 'complete' && tc > 0)

  const baseSteps = [
    { key: 'prompt', label: 'Prompt received', state: s1, icon: null },
    {
      key: 'r1',
      label: 'Round 1: independent',
      state: s2,
      icon: 'agents',
      divergenceIdx: 0,
    },
    {
      key: 'cross',
      label: 'Round 2: cross-review and rebuttal',
      state: s3,
      icon: 'arrows',
    },
    {
      key: 'finalp',
      label: 'Round 3: final positions',
      state: s4,
      icon: 'agents',
    },
  ]
  const tailSteps = synthesisEnabled
    ? [
        {
          key: 'synth',
          label: 'Synthesizing',
          state: s5,
          icon: 'sparkles',
        },
        { key: 'done', label: 'Complete', state: s6, icon: null },
      ]
    : [{ key: 'done', label: 'Complete', state: s6, icon: null }]

  return { steps: [...baseSteps, ...tailSteps] }
}

/**
 * @param {{
 *   collapsed?: boolean,
 *   onCollapsedChange?: (collapsed: boolean) => void,
 * }} props
 */
export default function WorkflowTimeline({
  collapsed = false,
  onCollapsedChange = () => {},
}) {
  const { state } = useForge()
  const [synthesisUiEnabled, setSynthesisUiEnabled] = useState(
    readBabelSynthesisEnabled
  )
  useEffect(() => {
    const onToggle = () => setSynthesisUiEnabled(readBabelSynthesisEnabled())
    window.addEventListener(BABEL_SYNTHESIS_TOGGLE_EVENT, onToggle)
    return () =>
      window.removeEventListener(BABEL_SYNTHESIS_TOGGLE_EVENT, onToggle)
  }, [])
  const { steps } = useWorkflowSteps(state, synthesisUiEnabled)
  const { config, divergenceScores } = state
  const progress = computeProgressUi(state)
  const [progressFadeOut, setProgressFadeOut] = useState(false)
  const [mobileStepHint, setMobileStepHint] = useState('')
  const hintClearRef = useRef(0)

  useEffect(() => {
    if (state.status !== 'complete' || (state.timeoutCount ?? 0) > 0) {
      setProgressFadeOut(false)
      return
    }
    const id = window.setTimeout(() => setProgressFadeOut(true), 2000)
    return () => window.clearTimeout(id)
  }, [state.status, state.timeoutCount])

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

  const renderDesktopStepRow = (step, timelineState) => {
    const score =
      step.divergenceIdx != null
        ? divergenceScores[step.divergenceIdx]
        : null
    const pct = score ? Math.round(Number(score.average) * 100) : 0
    const showBar =
      (step.state === 'complete' || step.state === 'partial') &&
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
        className="relative flex min-w-0 flex-1 flex-col gap-1 pb-6 last:pb-0"
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
            {step.state === 'partial' ? (
              <p className="mt-0.5 font-mono text-[9px] text-amber-800/75">Partial</p>
            ) : null}
            {step.key === 'r1' && (
              <div className="mt-1.5 space-y-1">
                {(['a', 'b', 'c']).map((k) => {
                  const spec =
                    k === 'a'
                      ? config.agentA
                      : k === 'b'
                        ? config.agentB
                        : config.agentC
                  const tm = timelineState.agentTimers?.[k] ?? {
                    startTime: null,
                    endTime: null,
                  }
                  return (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-2 pr-1 font-mono"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-1 text-[9px] text-[var(--text-muted)]">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: spec.color }}
                        />
                        <span className="truncate">{spec.name}</span>
                      </span>
                      {tm.startTime != null ? (
                        <AgentTimer
                          startTime={tm.startTime}
                          endTime={tm.endTime}
                        />
                      ) : (
                        <span className="shrink-0 text-[9px] text-[var(--text-muted)]/50">
                          —
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {step.key === 'cross' && (
              <div className="mt-1.5 space-y-1">
                {(['a', 'b', 'c']).map((k) => {
                  const spec =
                    k === 'a'
                      ? config.agentA
                      : k === 'b'
                        ? config.agentB
                        : config.agentC
                  const tm = timelineState.reviewTimers?.[k] ?? {
                    startTime: null,
                    endTime: null,
                  }
                  return (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-2 pr-1 font-mono"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-1 text-[9px] text-[var(--text-muted)]">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: spec.color }}
                        />
                        <span className="truncate">{spec.name}</span>
                      </span>
                      {tm.startTime != null ? (
                        <AgentTimer
                          startTime={tm.startTime}
                          endTime={tm.endTime}
                        />
                      ) : (
                        <span className="shrink-0 text-[9px] text-[var(--text-muted)]/50">
                          —
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {step.key === 'finalp' && (
              <div className="mt-1.5 space-y-1">
                {(['a', 'b', 'c']).map((k) => {
                  const spec =
                    k === 'a'
                      ? config.agentA
                      : k === 'b'
                        ? config.agentB
                        : config.agentC
                  const tm = timelineState.finalPositionTimers?.[k] ?? {
                    startTime: null,
                    endTime: null,
                  }
                  return (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-2 pr-1 font-mono"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-1 text-[9px] text-[var(--text-muted)]">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: spec.color }}
                        />
                        <span className="truncate">{spec.name}</span>
                      </span>
                      {tm.startTime != null ? (
                        <AgentTimer
                          startTime={tm.startTime}
                          endTime={tm.endTime}
                        />
                      ) : (
                        <span className="shrink-0 text-[9px] text-[var(--text-muted)]/50">
                          —
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {showBar && (
              <div className="pr-1 pt-1">
                <p className="font-mono text-[9px] text-[var(--text-muted)]">
                  Semantic divergence (avg.)
                </p>
                <p className="mt-0.5 font-mono text-[8px] leading-snug text-[var(--text-muted)]/90">
                  Meaning distance, not wording
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
      className={`fixed left-0 right-0 top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-sidebar)] md:bottom-0 md:left-auto md:right-0 md:top-0 md:h-screen md:border-b-0 md:border-l ${
        collapsed
          ? 'md:w-[40px] md:min-w-[40px] md:px-1.5 md:py-3'
          : 'md:w-[240px] md:min-w-[240px] md:px-4 md:py-5'
      }`}
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
                className="flex shrink-0 touch-manipulation rounded-full p-1 outline-none ring-offset-2 ring-offset-[var(--bg-surface)] focus-visible:ring-2 focus-visible:ring-[var(--accent-forge)]"
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

      {/* Desktop: full vertical timeline (max-md:hidden avoids hidden/md:* cascade bugs) */}
      <div
        className={`px-3 py-0 md:px-0 md:py-0 ${collapsed ? 'hidden' : 'max-md:hidden md:block'}`}
      >
        <div className="mb-4 flex items-center justify-between gap-2 pr-0">
          <h2 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
            Workflow
          </h2>
          <button
            type="button"
            onClick={() => onCollapsedChange(true)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="Collapse workflow sidebar"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="relative">
          {line}
          <div className="relative space-y-0">
            {steps.map((step) => renderDesktopStepRow(step, state))}
          </div>
        </div>
        {state.status === 'running' || state.status === 'complete' ? (
          <div
            className={`mt-4 px-3 transition-opacity duration-700 ease-out ${
              progressFadeOut ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          >
            <p className="min-h-[1rem] font-mono text-[11px] text-[var(--text-muted)]">
              {progress.label || '\u00a0'}
            </p>
            <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-[var(--bg-base)]">
              <div
                className="h-full rounded-full bg-[#8B1A1A]/22 transition-[width] duration-500"
                style={{ width: `${Math.min(100, progress.percent)}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Desktop: collapsed rail — icons only */}
      <div
        className={`w-full flex-col items-center ${collapsed ? 'max-md:hidden md:flex' : 'hidden'}`}
      >
        <button
          type="button"
          onClick={() => onCollapsedChange(false)}
          className="mb-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] transition hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
          aria-label="Expand workflow sidebar"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="relative flex flex-1 flex-col items-center gap-5 py-1">
          <div
            className="absolute bottom-2 left-1/2 top-2 w-px -translate-x-1/2 bg-[var(--border)]"
            aria-hidden
          />
          {steps.map((step) => (
            <div
              key={step.key}
              className="relative z-[1]"
            >
              <StatusDot state={step.state} />
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
