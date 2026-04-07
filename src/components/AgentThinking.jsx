import AgentTimer from './AgentTimer.jsx'

/**
 * @param {{
 *   title: string,
 *   color: string,
 *   line: string,
 *   startTime: number | null,
 *   endTime: number | null,
 * }} props
 */
export default function AgentThinking({
  title,
  color,
  line,
  startTime,
  endTime,
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${title}: ${line}`}
      className="rounded-forge-card flex min-h-[200px] flex-col overflow-hidden border border-dashed border-[var(--border)] bg-[var(--bg-surface)]/80"
      style={{ borderTopWidth: 2, borderTopColor: color }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-[var(--border)] px-4 py-3">
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-wide"
          style={{ color }}
        >
          {title}
        </span>
        {startTime != null ? (
          <AgentTimer startTime={startTime} endTime={endTime} />
        ) : null}
      </div>
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div
          className="pointer-events-none absolute inset-0 z-0 agent-thinking-shimmer opacity-40"
          aria-hidden
        />
        <div className="relative z-[1] flex flex-col items-center gap-3">
          <div
            className="live-agent-dot-pulse h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <p className="max-w-[14rem] text-center font-sans text-sm italic leading-snug text-[var(--text-secondary)]">
            {line}
          </p>
        </div>
      </div>
    </div>
  )
}
