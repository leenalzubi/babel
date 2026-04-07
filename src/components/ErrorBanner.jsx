import {
  AlertTriangle,
  Clock,
  Cpu,
  FileWarning,
  KeyRound,
  Lightbulb,
  ServerCrash,
  ShieldAlert,
} from 'lucide-react'

/**
 * @param {{
 *   error: string | {
 *     type?: string,
 *     title?: string,
 *     detail?: string,
 *     suggestion?: string,
 *     stage?: string,
 *     round?: number,
 *   } | null,
 *   onDismiss: () => void,
 *   onRetry?: () => void,
 *   onEditPrompt?: () => void,
 * }} props
 */
export default function ErrorBanner({
  error,
  onDismiss,
  onRetry,
  onEditPrompt,
}) {
  if (error == null || error === '') return null

  const isRich =
    typeof error === 'object' &&
    error !== null &&
    typeof error.title === 'string' &&
    typeof error.detail === 'string'

  const type = isRich && typeof error.type === 'string' ? error.type : 'unknown'
  const title = isRich ? error.title : 'Something went wrong'
  const detail = isRich
    ? error.detail
    : typeof error === 'string'
      ? error
      : String(error ?? '')
  const suggestion =
    isRich && typeof error.suggestion === 'string'
      ? error.suggestion
      : 'Try again or adjust your prompt.'

  const round =
    isRich && typeof error.round === 'number' && Number.isFinite(error.round)
      ? error.round
      : null

  const theme = {
    content_filter: {
      border: 'border-amber-700/35',
      bg: 'bg-[color-mix(in_srgb,var(--highlight)_22%,var(--bg-surface))]',
      icon: ShieldAlert,
      iconClass: 'text-amber-800',
    },
    rate_limit: {
      border: 'border-blue-600/35',
      bg: 'bg-[color-mix(in_srgb,#2563eb_12%,var(--bg-surface))]',
      icon: Clock,
      iconClass: 'text-blue-700',
    },
    timeout: {
      border: 'border-amber-700/35',
      bg: 'bg-[color-mix(in_srgb,var(--highlight)_22%,var(--bg-surface))]',
      icon: Clock,
      iconClass: 'text-amber-800',
    },
    auth: {
      border: 'border-red-600/45',
      bg: 'bg-[color-mix(in_srgb,var(--diverge)_10%,var(--bg-surface))]',
      icon: KeyRound,
      iconClass: 'text-red-700',
    },
    server_error: {
      border: 'border-amber-700/35',
      bg: 'bg-[color-mix(in_srgb,var(--highlight)_22%,var(--bg-surface))]',
      icon: ServerCrash,
      iconClass: 'text-amber-800',
    },
    token_limit: {
      border: 'border-amber-700/35',
      bg: 'bg-[color-mix(in_srgb,var(--highlight)_22%,var(--bg-surface))]',
      icon: FileWarning,
      iconClass: 'text-amber-800',
    },
    model_unavailable: {
      border: 'border-red-600/45',
      bg: 'bg-[color-mix(in_srgb,var(--diverge)_10%,var(--bg-surface))]',
      icon: Cpu,
      iconClass: 'text-red-700',
    },
    unknown: {
      border: 'border-red-600/45',
      bg: 'bg-[color-mix(in_srgb,var(--diverge)_10%,var(--bg-surface))]',
      icon: AlertTriangle,
      iconClass: 'text-red-700',
    },
  }

  const t = theme[type] ?? theme.unknown
  const Icon = t.icon

  return (
    <div
      className={`mb-6 rounded-forge-card border px-4 py-4 text-[var(--text-primary)] ${t.border} ${t.bg}`}
      role="alert"
    >
      <div className="flex flex-wrap items-start gap-3">
        <Icon
          className={`mt-0.5 h-5 w-5 shrink-0 ${t.iconClass}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {title}
            </h2>
            {round != null ? (
              <span className="rounded-[4px] border border-[var(--border)] bg-[var(--bg-base)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-medium text-[var(--text-muted)]">
                Failed in Round {round}
              </span>
            ) : null}
          </div>
          <p
            className="text-sm font-normal leading-relaxed text-[var(--text-secondary)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {detail}
          </p>
          <p className="flex gap-2 text-sm italic leading-relaxed text-[var(--text-muted)]">
            <Lightbulb
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]"
              aria-hidden
            />
            <span>
              <span className="font-medium not-italic text-[var(--text-secondary)]">
                Suggestion:{' '}
              </span>
              {suggestion}
            </span>
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)]/60 pt-3">
        {typeof onRetry === 'function' ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] font-semibold text-[var(--text-primary)] transition hover:border-[var(--text-muted)]"
          >
            Try again
          </button>
        ) : null}
        {typeof onEditPrompt === 'function' ? (
          <button
            type="button"
            onClick={onEditPrompt}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] font-semibold text-[var(--text-primary)] transition hover:border-[var(--text-muted)]"
          >
            Edit prompt
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-[6px] border border-[var(--border)] bg-transparent px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)]"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
