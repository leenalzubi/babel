import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import {
  fetchGithubModelsProxyConfigured,
  hasGithubModelsClientToken,
} from '../api/githubModelsClient.js'
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
  placeholder = 'What should the team debate? Be specific — the richer the prompt, the sharper the debate.',
}) {
  const { state } = useForge()
  const { agentA, agentB, agentC } = state.config
  const modelBadges = [agentA, agentB, agentC]

  const clientToken = hasGithubModelsClientToken()
  const needsProxyProbe = import.meta.env.PROD && !clientToken
  const [probe, setProbe] = useState(
    () =>
      needsProxyProbe ? { done: false, ok: false } : { done: true, ok: false }
  )

  useEffect(() => {
    if (!needsProxyProbe) return
    let cancelled = false
    fetchGithubModelsProxyConfigured().then((ok) => {
      if (!cancelled) setProbe({ done: true, ok })
    })
    return () => {
      cancelled = true
    }
  }, [needsProxyProbe])

  const hasToken =
    clientToken ||
    (needsProxyProbe && probe.done && probe.ok)

  const tokenHint = clientToken
    ? null
    : import.meta.env.PROD
      ? !probe.done
        ? 'Checking GitHub Models (server)…'
        : !probe.ok
          ? 'Add GITHUB_MODELS_PAT in Vercel → Environment Variables, then redeploy (do not rely on linking GitHub to the project)'
          : null
      : 'Add VITE_GITHUB_TOKEN to .env.local'

  const statusMessage = hasToken
    ? 'GitHub Models connected'
    : tokenHint ?? 'GitHub Models unavailable'

  return (
    <section className="flex flex-col gap-5 rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] p-6 sm:p-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Three models answer independently, cross-review, then (optionally) synthesize.
        </p>
        <div
          className="flex flex-wrap gap-4"
          aria-label="Models in this Babel run"
        >
          {modelBadges.map((agent) => (
            <span
              key={agent.model}
              title={agent.model}
              className="inline-flex max-w-full items-center gap-2 font-mono text-[10px] text-[var(--text-primary)]"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: agent.color }}
                aria-hidden
              />
              <span className="min-w-0 truncate font-medium">{agent.name}</span>
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
        className="min-h-[180px] w-full min-w-0 max-w-full resize-y rounded-forge-card border border-[var(--border)] bg-[var(--bg-notebook)] px-4 py-4 text-[17px] leading-[1.85] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-forge)]/55 focus:outline-none focus:ring-1 focus:ring-[var(--accent-forge)]/25 disabled:opacity-50"
        aria-label="Debate prompt"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[var(--border)] pt-5">
        <div
          className="flex items-center gap-2 font-mono text-[10px] text-[var(--text-secondary)]"
          role="status"
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${hasToken ? 'bg-[var(--agree)]' : 'bg-[var(--diverge)]'}`}
            aria-hidden
          />
          {statusMessage}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={onRun}
            disabled={disabled}
            title="Run Babel's full debate pipeline via GitHub Models"
            aria-label="Run Babel (⌘ or Ctrl + Enter from prompt)"
            className="inline-flex w-full items-center justify-center gap-2 rounded-[6px] bg-[var(--accent-forge)] px-6 py-3 font-mono text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
          >
            <Flame className="h-4 w-4 shrink-0" aria-hidden />
            Run Babel
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            aria-label="Reset debate and clear prompt"
            className="w-full rounded-[6px] border border-[var(--border)] bg-transparent px-5 py-3 font-mono text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-45 sm:w-auto"
          >
            Reset
          </button>
        </div>
      </div>

      <p
        className="mt-1 max-w-xl text-pretty text-center font-mono text-[9px] leading-relaxed text-[var(--text-muted)]/80 sm:mx-auto"
        role="note"
      >
        By running a debate you consent to contributing anonymously to this
        dataset.
      </p>
    </section>
  )
}
