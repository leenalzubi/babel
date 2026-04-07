const LABELS = {
  round1: 'Running Round 1...',
  crossReview: 'Round 2: cross-review and rebuttal…',
  finalPosition: 'Round 3: final positions…',
  synthesis: 'Synthesizing...',
}

/**
 * @param {{ step: 'round1' | 'crossReview' | 'finalPosition' | 'synthesis' | null }} props
 */
export default function RunStatusBanner({ step }) {
  if (step == null) return null

  return (
    <div
      key={step}
      role="status"
      aria-live="polite"
      className="run-status-banner mb-6 rounded-forge-card border border-[var(--accent-forge)]/40 bg-[color-mix(in_srgb,var(--highlight)_45%,var(--bg-surface))] px-4 py-3 font-mono text-xs text-[var(--text-primary)]"
    >
      {LABELS[step] ?? step}
    </div>
  )
}
