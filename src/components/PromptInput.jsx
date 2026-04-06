import { Flame } from 'lucide-react'
import { useForge } from '../store/useForgeStore.js'

/**
 * @param {{
 *   value: string,
 *   onChange: (v: string) => void,
 *   onRun: () => void,
 *   onReset: () => void,
 *   disabled?: boolean,
 *   placeholder?: string,
 * }} props
 */
export default function PromptInput({
  value,
  onChange,
  onRun,
  onReset,
  disabled = false,
  placeholder = 'What should the team debate? Be specific — the richer the prompt, the sharper the forge.',
}) {
  const { state } = useForge()
  const { agentA, agentB, agentC } = state.config
  const modelBadges = [agentA, agentB, agentC]

  const hasToken = Boolean(
    import.meta.env.VITE_GITHUB_TOKEN &&
      String(import.meta.env.VITE_GITHUB_TOKEN).trim()
  )

  return (
    <section className="rounded-forge-card flex flex-col gap-5 border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-forge-card sm:p-8">
      <div className="flex flex-col gap-2">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Your prompt
        </h2>
        <p className="font-sans text-sm text-[var(--text-secondary)]">
          Three models answer independently, cross-review, then (optionally) synthesize.
        </p>
        <div
          className="flex flex-wrap gap-2"
          aria-label="Model IDs for this forge run"
        >
          {modelBadges.map((agent) => (
            <span
              key={agent.model}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-notebook)] py-1 pl-2 pr-2.5 font-mono text-[10px] text-[var(--text-secondary)]"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: agent.color }}
                aria-hidden
              />
              <span className="min-w-0 truncate">{agent.model}</span>
            </span>
          ))}
        </div>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            if (!disabled) onRun()
          }
        }}
        disabled={disabled}
        rows={7}
        placeholder={placeholder}
        className="min-h-[180px] w-full min-w-0 max-w-full resize-y rounded-forge-card border border-[var(--border)] bg-[var(--bg-notebook)] px-4 py-4 font-sans text-[15px] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/80 focus:border-[var(--accent-forge)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--accent-forge)]/20 disabled:opacity-50"
        aria-label="Debate prompt"
      />

      <div
        className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5"
      >
        <div
          className="flex items-center gap-2 font-mono text-[10px] text-[var(--text-secondary)]"
          role="status"
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${hasToken ? 'bg-[var(--agree)]' : 'bg-[var(--diverge)]'}`}
            aria-hidden
          />
          {hasToken ? 'GitHub Models connected' : 'Add VITE_GITHUB_TOKEN to .env.local'}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={onRun}
            disabled={disabled}
            title="Run the full debate pipeline via GitHub Models"
            aria-label="Run the Forge (⌘ or Ctrl + Enter from prompt)"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent-forge)] px-6 py-3 font-mono text-sm font-semibold text-white shadow-forge-card transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
          >
            <Flame className="h-4 w-4 shrink-0" aria-hidden />
            Run the Forge
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            aria-label="Reset debate and clear prompt"
            className="w-full rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-5 py-3 font-mono text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-45 sm:w-auto"
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  )
}
