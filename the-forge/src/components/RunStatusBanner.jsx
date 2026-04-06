const LABELS = {
  round1: 'Running Round 1...',
  crossReview: 'Computing cross-reviews...',
  synthesis: 'Synthesizing...',
}

/**
 * @param {{ step: 'round1' | 'crossReview' | 'synthesis' | null }} props
 */
export default function RunStatusBanner({ step }) {
  if (step == null) return null

  return (
    <div
      key={step}
      role="status"
      aria-live="polite"
      className="run-status-banner mb-6 rounded-forge-card border border-[var(--accent-forge)]/35 bg-[color-mix(in_srgb,var(--accent-forge)_10%,white)] px-4 py-3 font-mono text-xs text-[var(--text-primary)] shadow-forge-card"
    >
      {LABELS[step] ?? step}
    </div>
  )
}
