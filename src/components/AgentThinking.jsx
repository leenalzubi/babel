import RunStatusBanner from './RunStatusBanner.jsx'

/**
 * Run-step status line (delegates to {@link RunStatusBanner}).
 * @param {{ step: 'round1' | 'crossReview' | 'synthesis' | null }} props
 */
export function StatusBanner(props) {
  return <RunStatusBanner {...props} />
}

/**
 * @param {{
 *   agentName: string
 *   borderColor?: string
 *   message?: string
 *   variant?: 'round' | 'review' | 'wide'
 *   headerBadge?: string
 *   dotClass?: string
 * }} props
 */
export default function AgentThinking({
  agentName,
  borderColor = 'var(--border)',
  message,
  variant = 'round',
  headerBadge,
  dotClass,
}) {
  const label = message ?? `${agentName} is thinking...`

  const bodyMin =
    variant === 'review'
      ? 'min-h-[220px]'
      : variant === 'wide'
        ? 'min-h-[140px]'
        : 'min-h-[280px]'

  const headerPad = variant === 'review' ? 'px-4 py-3' : 'px-3 py-2'
  const bodyPad = variant === 'review' ? 'px-4 py-3' : 'px-3 py-6'

  const titleText = headerBadge ?? agentName

  const regionLabel =
    variant === 'review'
      ? `${agentName} cross-review`
      : variant === 'wide'
        ? 'Synthesis facilitator'
        : `${agentName} response`

  return (
    <div
      role="region"
      aria-label={regionLabel}
      aria-busy="true"
      className="relative flex flex-col overflow-hidden rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)]"
      style={{
        borderTopWidth: 2,
        borderTopStyle: 'solid',
        borderTopColor: borderColor,
      }}
    >
      <div
        className={`relative z-[1] flex items-center gap-2 border-b border-dashed border-[var(--border)] bg-transparent ${headerPad}`}
      >
        {dotClass && (
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`}
            aria-hidden
          />
        )}
        <span
          className={`font-mono font-bold uppercase tracking-wide text-[var(--text-primary)] ${variant === 'review' ? 'text-[11px]' : 'text-[10px]'}`}
        >
          {titleText}
        </span>
      </div>
      <div
        className={`relative flex flex-1 flex-col ${bodyMin} max-h-[320px] overflow-hidden ${bodyPad}`}
      >
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-90 agent-thinking-shimmer"
          aria-hidden
        />
        <div className="relative z-[1] flex flex-1 flex-col items-center justify-center gap-3">
          <div className="relative flex items-center gap-2" aria-hidden>
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span className="thinking-dot" />
          </div>
          <p className="text-center font-mono text-[11px] text-[var(--text-muted)]">
            {label}
          </p>
        </div>
      </div>
    </div>
  )
}
