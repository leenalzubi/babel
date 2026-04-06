import { Check } from 'lucide-react'
import { getLiveAgentStripModel } from '../lib/liveAgentUi.js'

/** @param {{ state: Record<string, unknown> & { config: { agentA: { name: string, color: string }, agentB: { name: string, color: string }, agentC: { name: string, color: string } } } }} props */
export default function LiveAgentStrip({ state }) {
  const model = getLiveAgentStripModel(state)
  if (model == null) return null

  const cfg = state.config
  const list = [
    { spec: cfg.agentA, ...model.agents[0] },
    { spec: cfg.agentB, ...model.agents[1] },
    { spec: cfg.agentC, ...model.agents[2] },
  ]

  return (
    <section className="mb-10" aria-label="Agents working">
      <h2 className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
        Live agents
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {list.map(({ spec, working, line }) => (
          <div
            key={spec.name}
            role="region"
            aria-label={`${spec.name} ${working ? 'working' : 'finished'}`}
            aria-busy={working}
            className="rounded-forge-card flex min-h-[160px] flex-col overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)] shadow-forge-card"
          >
            <div
              className="flex items-center px-4 py-3"
              style={{
                backgroundColor: `color-mix(in srgb, ${spec.color} 16%, white)`,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                {spec.name}
              </span>
            </div>
            <div className="relative flex flex-1 flex-col justify-center px-4 py-5">
              {working ? (
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
                        {line}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--agree)]/12 text-[var(--agree)]">
                    <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="font-mono text-[12px] font-medium text-[var(--agree)]">
                    Done
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
