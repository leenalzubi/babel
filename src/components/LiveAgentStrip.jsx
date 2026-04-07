import { Check } from 'lucide-react'
import { getLiveAgentStripModel } from '../lib/liveAgentUi.js'

/** @param {{ state: Record<string, unknown> & { config: { agentA: { name: string, color: string }, agentB: { name: string, color: string }, agentC: { name: string, color: string } } } }} props */
export default function LiveAgentStrip({ state }) {
  const model = getLiveAgentStripModel(state)
  if (model == null) return null

  return (
    <section className="mb-10" aria-label="Agent roll call">
      <div className="mb-4">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Roll call
        </h2>
        <p className="mt-1 max-w-xl font-mono text-[9px] leading-relaxed text-[var(--text-muted)]">
          Sequential turns — each model answers in order, then reviews in the same order.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {model.agents.map((entry) => {
          const spec = entry.spec
          const rollIndex = entry.rollIndex
          const phase = entry.phase
          const activeLine = entry.activeLine
          const waitingNote =
            'waitingNote' in entry && typeof entry.waitingNote === 'string'
              ? entry.waitingNote
              : undefined
          const waitingCopy = waitingNote ?? 'Waiting its turn'
          const isWaiting = phase === 'waiting'
          const isActive = phase === 'active'
          const isDone = phase === 'done'

          return (
            <div
              key={spec.name}
              role="region"
              aria-label={`${rollIndex}. ${spec.name}${
                isActive ? ', current turn' : isDone ? ', finished' : ', waiting'
              }`}
              aria-busy={isActive}
              className={`rounded-forge-card flex min-h-[160px] flex-col overflow-hidden ${
                isWaiting
                  ? 'border border-dashed border-[var(--border)] bg-[var(--bg-base)]/35'
                  : 'border border-[var(--border)] bg-[var(--bg-surface)]'
              } ${isActive ? 'ring-1 ring-inset ring-[var(--border)]' : ''}`}
              style={{
                borderTopWidth: 2,
                borderTopStyle: isWaiting ? 'dashed' : 'solid',
                borderTopColor: spec.color,
              }}
            >
              <div className="flex items-center gap-2 border-b border-dashed border-[var(--border)] px-4 py-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border)] bg-[var(--bg-surface)] font-mono text-[10px] font-medium tabular-nums text-[var(--text-muted)]"
                  aria-hidden
                >
                  {rollIndex}
                </span>
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: spec.color }}
                  aria-hidden
                />
                <span
                  className="min-w-0 truncate font-mono text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: spec.color }}
                >
                  {spec.name}
                </span>
              </div>
              <div className="relative flex flex-1 flex-col justify-center px-4 py-5">
                {isActive ? (
                  <>
                    <div
                      className="pointer-events-none absolute inset-0 z-0 agent-thinking-shimmer"
                      aria-hidden
                    />
                    <div className="relative z-[1] flex flex-col items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="live-agent-dot-pulse inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: spec.color }}
                          aria-hidden
                        />
                        <span className="font-mono text-[12px] text-[var(--text-secondary)]">
                          {activeLine}
                        </span>
                      </div>
                    </div>
                  </>
                ) : null}
                {isDone ? (
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-dashed border-[var(--agree)]/35 bg-[var(--agree)]/10 text-[var(--agree)]">
                      <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                    </span>
                    <span className="font-mono text-[12px] font-medium text-[var(--agree)]">
                      Done
                    </span>
                  </div>
                ) : null}
                {isWaiting ? (
                  <p className="text-center text-sm italic text-[var(--text-muted)]">
                    {waitingCopy}
                  </p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
