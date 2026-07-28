import AgentTimer from './AgentTimer.jsx'

/**
 * @param {{
 *   title: string,
 *   subtitle?: string | null,
 *   color: string,
 *   line: string,
 *   startTime: number | null,
 *   endTime: number | null,
 * }} props
 */
export default function AgentThinking({
  title,
  subtitle = null,
  color,
  line,
  startTime,
  endTime,
}) {
  return (
    <div
      role="status"
      aria-label={`${title}${subtitle ? ` (${subtitle})` : ''}: ${line}`}
      data-state="streaming"
      className="babel-voice voice forge-reveal-card min-h-[200px] border-dashed"
    >
      <div
        className="babel-voice-niche niche niche-pulse"
        style={{
          background: `color-mix(in srgb, ${color} 18%, var(--plaster-hi))`,
        }}
      >
        <div className="min-w-0">
          <span className="babel-voice-name block" style={{ color }}>
            {title}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block model-name">
              {subtitle}
            </span>
          ) : null}
        </div>
        <span className="babel-voice-stance">Speaking</span>
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
          <p className="max-w-[14rem] text-center text-sm italic leading-snug text-[var(--text-secondary)]">
            {line}
          </p>
          {startTime != null ? (
            <AgentTimer startTime={startTime} endTime={endTime} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
