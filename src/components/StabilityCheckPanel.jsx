import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useForge } from '../store/useForgeStore.js'
import { getStabilityEligibility, planStabilityChecks } from '../lib/stability/planChecks.js'
import {
  createStabilityReportDraft,
  executeStabilityReport,
  retryStabilityRun,
} from '../lib/stability/runStabilityCheck.js'
import {
  OUTCOME_LABELS,
  RELATIONSHIP_LABELS,
} from '../lib/stability/types.js'
import { roleLabel } from '../lib/babelRoles.js'

function track(event, payload = {}) {
  try {
    console.info('[babel:analytics]', { event, surface: 'stability', ...payload })
  } catch {
    /* ignore */
  }
}

/**
 * Entry + confirmation + report for conclusion stability checks.
 * Does not mutate the canonical synthesis.
 */
export default function StabilityCheckPanel() {
  const { state, dispatch } = useForge()
  const eligibility = getStabilityEligibility(state)
  const plan = planStabilityChecks(state)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [variantId, setVariantId] = useState(/** @type {string | null} */ (null))
  const cancelRef = useRef(false)
  const triggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const titleId = useId()

  const reports = state.stabilityReports ?? []
  const activeId = state.activeStabilityReportId
  const report =
    reports.find((r) => r.reportId === activeId) ??
    reports[reports.length - 1] ??
    null

  const settled =
    state.status === 'complete' ||
    state.status === 'complete_with_gaps' ||
    state.status === 'partial'

  useEffect(() => {
    if (!confirmOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault()
        setConfirmOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmOpen, busy])

  const openConfirm = useCallback(() => {
    if (!eligibility.eligible || busy) return
    track('stability_check_opened', { callCount: plan.callCount })
    setConfirmOpen(true)
  }, [eligibility.eligible, busy, plan.callCount])

  const startCheck = useCallback(async () => {
    const draft = createStabilityReportDraft(state)
    if (!draft) return
    cancelRef.current = false
    setConfirmOpen(false)
    setBusy(true)
    track('stability_check_started', {
      callCount: draft.plannedCallCount,
      types: draft.runs.map((r) => r.type),
    })
    dispatch({ type: 'SET_STABILITY_REPORT', payload: draft })
    try {
      const final = await executeStabilityReport({
        state,
        report: draft,
        isActive: () => !cancelRef.current,
        onUpdate: (next) => {
          dispatch({ type: 'SET_STABILITY_REPORT', payload: next })
        },
      })
      track('stability_check_finished', {
        outcome: final.outcome,
        reportId: final.reportId,
      })
    } finally {
      setBusy(false)
    }
  }, [state, dispatch])

  const cancelCheck = useCallback(() => {
    cancelRef.current = true
    track('stability_check_cancelled')
  }, [])

  const retryRun = useCallback(
    async (stabilityRunId) => {
      if (!report || busy) return
      setBusy(true)
      track('stability_retry', { stabilityRunId })
      cancelRef.current = false
      try {
        await retryStabilityRun({
          state,
          report,
          stabilityRunId,
          isActive: () => !cancelRef.current,
          onUpdate: (next) => {
            dispatch({ type: 'SET_STABILITY_REPORT', payload: next })
          },
        })
      } finally {
        setBusy(false)
      }
    },
    [report, busy, state, dispatch]
  )

  if (!settled || !state.synthesis) return null

  const variantRun = report?.runs.find((r) => r.stabilityRunId === variantId)

  return (
    <section
      className="mt-8 border-t border-[var(--line)] pt-8"
      aria-labelledby="stability-heading"
    >
      <h2
        id="stability-heading"
        className="babel-display text-[1.2rem] text-[var(--ink)]"
      >
        Conclusion stability
      </h2>
      <p className="mt-2 max-w-[68ch] text-[0.95rem] leading-relaxed text-[var(--ink-soft)]">
        Test whether the recommendation changes when Babel re-synthesizes the
        same arguments or removes one voice at a time.
      </p>
      <p className="mt-2 text-[0.85rem] text-[var(--ink-soft)]">
        Stability measures sensitivity to the tested configurations. It does not
        establish that the recommendation is correct.
      </p>

      {!eligibility.eligible ? (
        <p className="mt-4 font-mono text-[0.8rem] text-[var(--ink-soft)]">
          {eligibility.reason ?? 'Stability check unavailable.'}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            ref={triggerRef}
            type="button"
            className="babel-btn babel-btn-ghost min-h-11 text-[var(--blue)]"
            disabled={busy}
            onClick={openConfirm}
          >
            Check conclusion stability
          </button>
          {busy ? (
            <button
              type="button"
              className="babel-btn babel-btn-quiet min-h-11"
              onClick={cancelCheck}
            >
              Cancel check
            </button>
          ) : null}
        </div>
      )}

      {confirmOpen ? (
        <ConfirmDialog
          titleId={titleId}
          plan={plan}
          onCancel={() => {
            setConfirmOpen(false)
            window.requestAnimationFrame(() => triggerRef.current?.focus())
          }}
          onRun={startCheck}
        />
      ) : null}

      {report ? (
        <StabilityReportView
          report={report}
          busy={busy}
          onRetry={retryRun}
          onOpenVariant={(id) => {
            setVariantId(id)
            track('variant_synthesis_opened', { stabilityRunId: id })
          }}
        />
      ) : null}

      {variantRun ? (
        <VariantDrawer
          run={variantRun}
          comparison={report?.comparisons.find(
            (c) => c.comparedStabilityRunId === variantRun.stabilityRunId
          )}
          onClose={() => {
            setVariantId(null)
            window.requestAnimationFrame(() => triggerRef.current?.focus())
          }}
        />
      ) : null}
    </section>
  )
}

/**
 * @param {{
 *   titleId: string,
 *   plan: ReturnType<typeof planStabilityChecks>,
 *   onCancel: () => void,
 *   onRun: () => void,
 * }} props
 */
function ConfirmDialog({ titleId, plan, onCancel, onRun }) {
  const closeRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-[color-mix(in_srgb,var(--ink)_28%,transparent)]"
        aria-label="Close confirmation"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-[var(--radius)] border border-[var(--line)] bg-[var(--plaster)] p-5 shadow-forge-card md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2"
      >
        <h3 id={titleId} className="babel-display text-[1.15rem]">
          Run stability check?
        </h3>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--ink-soft)]">
          Babel will re-synthesize the completed debate and repeat the synthesis
          with each successful voice removed in turn. This tests whether the
          recommendation depends strongly on one panel member. It does not verify
          that the recommendation is correct.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-[0.9rem] text-[var(--ink)]">
          {plan.checks.map((c) => (
            <li key={`${c.type}-${c.label}`}>{c.label}</li>
          ))}
        </ul>
        <p className="mt-4 font-mono text-[0.8rem] text-[var(--ink-soft)]">
          Additional model calls: {plan.callCount}
          <br />
          Primary arbiter:{' '}
          {plan.primaryArbiter?.name ?? '-'} (
          <span className="font-mono">{plan.primaryArbiter?.model ?? '-'}</span>)
          {plan.alternateArbiter ? (
            <>
              <br />
              Alternate arbiter: {plan.alternateArbiter.name} (
              <span className="font-mono">{plan.alternateArbiter.model}</span>)
            </>
          ) : (
            <>
              <br />
              Alternate arbiter: Not configured
            </>
          )}
          <br />
          Estimated cost: Additional model usage applies
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            ref={closeRef}
            type="button"
            className="babel-btn babel-btn-quiet min-h-11"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="babel-btn babel-btn-primary min-h-11"
            onClick={onRun}
          >
            Run check
          </button>
        </div>
      </div>
    </>
  )
}

/**
 * @param {{
 *   report: import('../lib/stability/types.js').StabilityReport,
 *   busy: boolean,
 *   onRetry: (id: string) => void,
 *   onOpenVariant: (id: string) => void,
 * }} props
 */
function StabilityReportView({ report, busy, onRetry, onOpenVariant }) {
  const outcomeLabel = report.outcome
    ? OUTCOME_LABELS[report.outcome]
    : report.status === 'running'
      ? 'Running…'
      : 'Report in progress'

  return (
    <div className="mt-6 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--plaster-hi)] p-4 md:p-5">
      <p className="babel-eyebrow m-0">Stability report</p>
      <p
        className={`mt-2 font-[family-name:var(--font-display)] text-[1.05rem] font-[560] ${
          report.outcome === 'sensitive_to_one_or_more_voices'
            ? 'text-[var(--ink-soft)]'
            : report.outcome === 'stable_across_tested_configurations'
              ? 'text-[var(--oasis)]'
              : 'text-[var(--ink)]'
        }`}
      >
        {outcomeLabel}
      </p>
      <p className="mt-2 text-[0.85rem] text-[var(--ink-soft)]">
        Stability measures sensitivity to the tested configurations. It does not
        establish that the recommendation is correct.
      </p>
      {report.summary ? (
        <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--ink)]">
          {report.summary}
        </p>
      ) : null}

      <h3 className="mt-5 font-mono text-[0.72rem] text-[var(--ink-soft)]">
        Progress
      </h3>
      <ul className="mt-2 list-none space-y-2 p-0" aria-live="polite">
        {report.runs.map((r) => (
          <li
            key={r.stabilityRunId}
            className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] py-2 last:border-b-0"
          >
            <span className="text-[0.9rem] text-[var(--ink)]">{r.label}</span>
            <span
              className={`font-mono text-[0.75rem] ${
                r.status === 'failed'
                  ? 'text-[var(--madder)]'
                  : r.status === 'running'
                    ? 'text-[var(--blue)]'
                    : 'text-[var(--ink-soft)]'
              }`}
            >
              {statusLabel(r.status)}
            </span>
          </li>
        ))}
      </ul>

      <h3 className="mt-5 font-mono text-[0.72rem] text-[var(--ink-soft)]">
        Configuration results
      </h3>
      <ul className="mt-2 list-none space-y-4 p-0">
        {report.runs.map((r) => {
          const cmp = report.comparisons.find(
            (c) => c.comparedStabilityRunId === r.stabilityRunId
          )
          return (
            <li
              key={`res-${r.stabilityRunId}`}
              className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--plaster)] p-3"
            >
              <p className="m-0 font-mono text-[0.72rem] text-[var(--ink-soft)]">
                {r.type.replace(/_/g, ' ')}; {r.arbiterName || r.arbiterModelId}
                {r.excludedAgentId
                  ? `; excluded ${roleLabel(r.excludedRoleId)} / ${r.excludedModelId}`
                  : ''}
              </p>
              <p className="mt-2 text-[0.9rem] text-[var(--ink)]">
                {cmp
                  ? RELATIONSHIP_LABELS[cmp.relationship]
                  : statusLabel(r.status)}
              </p>
              {cmp?.explanation ? (
                <p className="mt-1 text-[0.85rem] text-[var(--ink-soft)]">
                  {cmp.explanation}
                </p>
              ) : null}
              {r.error?.message ? (
                <p className="mt-1 text-[0.85rem] text-[var(--madder)]">
                  {r.error.message}
                </p>
              ) : null}
              <p className="mt-2 babel-meta">
                Duration:{' '}
                {r.usage?.durationMs != null
                  ? `${(r.usage.durationMs / 1000).toFixed(1)} s`
                  : 'Not recorded'}
                ; Cost: Not recorded
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {r.status === 'complete' ? (
                  <button
                    type="button"
                    className="babel-btn babel-btn-ghost min-h-11 text-[var(--blue)]"
                    onClick={() => onOpenVariant(r.stabilityRunId)}
                  >
                    View variant synthesis
                  </button>
                ) : null}
                {r.status === 'failed' ? (
                  <button
                    type="button"
                    className="babel-btn babel-btn-quiet min-h-11"
                    disabled={busy}
                    onClick={() => onRetry(r.stabilityRunId)}
                  >
                    Retry this check
                  </button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      {report.limitations?.length ? (
        <div className="mt-5">
          <h3 className="font-mono text-[0.72rem] text-[var(--ink-soft)]">
            Limitations
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.85rem] text-[var(--ink-soft)]">
            {report.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/** @param {string} s */
function statusLabel(s) {
  switch (s) {
    case 'complete':
      return 'Complete'
    case 'running':
      return 'Running'
    case 'waiting':
    case 'pending':
      return 'Waiting'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    case 'unavailable':
      return 'Not configured'
    default:
      return s
  }
}

/**
 * @param {{
 *   run: import('../lib/stability/types.js').StabilityRun,
 *   comparison?: import('../lib/stability/types.js').StabilityComparison,
 *   onClose: () => void,
 * }} props
 */
function VariantDrawer({ run, comparison, onClose }) {
  const titleId = useId()
  const closeRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-[color-mix(in_srgb,var(--ink)_28%,transparent)]"
        aria-label="Close variant synthesis"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[92dvh] w-full max-w-[100vw] flex-col overflow-hidden rounded-t-[var(--radius)] border border-[var(--line)] bg-[var(--plaster)] shadow-forge-card md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[min(100vw,28rem)] md:rounded-none md:border-l md:border-t-0"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-4">
          <div>
            <p className="babel-eyebrow m-0">Variant synthesis</p>
            <h2 id={titleId} className="mt-1 text-[1.05rem] font-[560] text-[var(--ink)]">
              {run.label}
            </h2>
            <p className="mt-1 font-mono text-[0.72rem] text-[var(--ink-soft)]">
              {run.arbiterModelId}
              {run.excludedModelId ? `; without ${run.excludedModelId}` : ''}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="babel-btn babel-btn-quiet min-h-11 min-w-11"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {comparison ? (
            <p className="mb-4 text-[0.9rem] text-[var(--ink-soft)]">
              {RELATIONSHIP_LABELS[comparison.relationship]}.{' '}
              {comparison.explanation}
            </p>
          ) : null}
          {run.structuredRecommendation ? (
            <div className="mb-4 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--plaster-hi)] p-3">
              <p className="font-mono text-[0.72rem] text-[var(--ink-soft)]">
                Structured recommendation ({run.structuredRecommendation.extractionMethod})
              </p>
              <p className="mt-2 text-[0.95rem] text-[var(--ink)]">
                Verdict: {run.structuredRecommendation.verdict}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-[var(--ink)]">
                {run.structuredRecommendation.recommendationText || '-'}
              </p>
            </div>
          ) : null}
          <h3 className="babel-voice-name">Raw synthesis</h3>
          <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-words font-[family-name:var(--font-body)] text-[0.9rem] leading-relaxed text-[var(--ink)]">
            {run.rawSynthesisText || 'Not recorded.'}
          </pre>
        </div>
      </div>
    </>
  )
}
