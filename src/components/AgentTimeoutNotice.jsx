import { Clock } from 'lucide-react'

/** @param {{ agentName: string }} props */
export default function AgentTimeoutNotice({ agentName }) {
  return (
    <div
      role="status"
      className="flex min-h-[100px] flex-col justify-center rounded-forge-card border border-dashed border-amber-600/45 bg-[var(--bg-surface)] px-4 py-5"
    >
      <p className="flex items-start gap-2 font-mono text-[11px] leading-snug text-amber-800/75">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <span>
          <span className="font-medium">{agentName}</span> took too long — skipped
        </span>
      </p>
    </div>
  )
}
