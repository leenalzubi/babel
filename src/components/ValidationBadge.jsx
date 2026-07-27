import { useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useForge } from '../store/useForgeStore.js'

/**
 * @param {{ score: number, fair_to_me: boolean, fair_to_others: boolean, bias_note: string | null, missing: string | null, verdict: string }} v
 */
function ValidatorDetail({ name, v }) {
  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)]/90 px-3 py-2.5">
      <p className="font-[family-name:var(--font-mono)] text-[10px] font-semibold text-[var(--text-primary)]">
        {name}
      </p>
      <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-muted)]">
        Score:{' '}
        <span className="font-medium text-[var(--text-primary)]">{v.score}/10</span>
      </p>
      <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-muted)]">
        fair_to_me:{' '}
        <span className="text-[var(--text-primary)]">
          {v.fair_to_me ? 'yes' : 'no'}
        </span>{' '}
       ; fair_to_others:{' '}
        <span className="text-[var(--text-primary)]">
          {v.fair_to_others ? 'yes' : 'no'}
        </span>
      </p>
      {v.bias_note ? (
        <p className="mt-2 font-[family-name:var(--font-body)] text-[13px] leading-relaxed text-[var(--text-secondary)]">
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-muted)]">
            bias_note:{' '}
          </span>
          {v.bias_note}
        </p>
      ) : null}
      {v.missing ? (
        <p className="mt-2 font-[family-name:var(--font-body)] text-[13px] leading-relaxed text-[var(--text-secondary)]">
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-muted)]">
            missing:{' '}
          </span>
          {v.missing}
        </p>
      ) : null}
    </div>
  )
}

export default function ValidationBadge() {
  const { state } = useForge()
  const { validation, config } = state
  const [open, setOpen] = useState(false)

  if (validation == null) return null

  const { agentB, agentC } = config
  const b = validation.b
  const c = validation.c
  const status = validation.status

  if (status === 'pending') {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-forge-card border border-dashed border-[var(--border)] bg-[var(--bg-base)]/50 px-3 py-2.5">
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-[var(--text-muted)]"
          aria-hidden
        />
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-muted)]">
          Peer review in progress…
        </span>
      </div>
    )
  }

  const approved = status === 'approved'
  const flagged = status === 'flagged'

  return (
    <div className="mb-4">
      <div
        className={`rounded-forge-card border px-3 py-2.5 transition ${
          approved
            ? 'border-[#4C6647] bg-[#E8EDE6] text-[#3D5439]'
            : 'border-[#D97706] bg-[#FFFBEB] text-[#92400E]'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 text-left"
        >
          <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] font-semibold">
            {approved ? '✓ Peer validated' : '⚑ Bias flagged'}
          </span>
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        <p
          className="mt-1 font-[family-name:var(--font-body)] text-[13px] leading-snug opacity-95"
          style={{ fontFamily: 'var(--font-body), Georgia, serif' }}
        >
          {approved ? (
            <>
              {agentB.name} and {agentC.name} both approved this synthesis
            </>
          ) : (
            <>One or more validators found imbalance</>
          )}
        </p>
        {b && c ? (
          <p className="mt-2 font-[family-name:var(--font-mono)] text-[10px] opacity-90">
            {agentB.name}: {b.score}/10; {agentC.name}: {c.score}/10
          </p>
        ) : null}
        {flagged ? (
          <div className="mt-2 space-y-1 font-[family-name:var(--font-body)] text-[12px] leading-relaxed opacity-95">
            {b?.bias_note ? (
              <p>
                <span className="font-medium">{agentB.name}:</span> {b.bias_note}
              </p>
            ) : null}
            {c?.bias_note ? (
              <p>
                <span className="font-medium">{agentC.name}:</span> {c.bias_note}
              </p>
            ) : null}
            {b?.missing ? (
              <p>
                <span className="font-medium">Missing ({agentB.name}):</span>{' '}
                {b.missing}
              </p>
            ) : null}
            {c?.missing ? (
              <p>
                <span className="font-medium">Missing ({agentC.name}):</span>{' '}
                {c.missing}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {open && b && c ? (
        <div
          className="mt-2 space-y-3 rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] p-3"
          role="region"
          aria-label="Validation details"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <ValidatorDetail name={agentB.name} v={b} />
            <ValidatorDetail name={agentC.name} v={c} />
          </div>
          <p className="font-[family-name:var(--font-body)] text-[12px] italic leading-relaxed text-[var(--text-muted)]">
            Validation is performed by the two non-synthesizing agents. It
            reduces but does not eliminate synthesis bias.
          </p>
        </div>
      ) : null}
    </div>
  )
}
