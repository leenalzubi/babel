import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Clock,
  Cpu,
  FileWarning,
  KeyRound,
  Lightbulb,
  ServerCrash,
  ShieldAlert,
  WifiOff,
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
 *     id?: string,
 *     userMessage?: string,
 *     retryAfterMs?: number,
 *     occurredAt?: string,
 *   } | null,
 *   status?: string,
 *   onDismiss: () => void,
 *   onRetry?: () => void,
 *   onEditPrompt?: () => void,
 *   onCopyTranscript?: () => void,
 * }} props
 */
export default function ErrorBanner({
  error,
  status,
  onDismiss,
  onRetry,
  onEditPrompt,
  onCopyTranscript,
}) {
  const isRich =
    error != null &&
    error !== '' &&
    typeof error === 'object' &&
    (typeof error.title === 'string' || typeof error.detail === 'string')

  const type =
    isRich && typeof error.type === 'string' ? error.type : 'unknown'
  const retryAfterMs =
    isRich && typeof error.retryAfterMs === 'number' ? error.retryAfterMs : null
  const occurredAt =
    isRich && typeof error.occurredAt === 'string' ? error.occurredAt : null

  const deadline =
    error != null &&
    error !== '' &&
    type === 'rate_limit' &&
    retryAfterMs != null
      ? (occurredAt ? Date.parse(occurredAt) : Date.now()) + retryAfterMs
      : null

  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (deadline == null) {
      setSecondsLeft(0)
      return
    }
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [deadline])

  if (error == null || error === '') return null

  const title = isRich && error.title ? error.title : 'Something went wrong'
  const detail = isRich
    ? error.detail || error.userMessage || ''
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

  const errorId =
    isRich && typeof error.id === 'string' && error.id ? error.id : null

  const theme = {
    content_filter: {
      border: 'border-amber-700/35',
      bg: 'bg-[color-mix(in_srgb,var(--highlight)_22%,var(--bg-surface))]',
      icon: ShieldAlert,
      iconClass: 'text-amber-800',
    },
    rate_limit: {
      border: 'border-blue-600/35',
      bg: 'bg-[color-mix(in_srgb,#1E4E5E_12%,var(--bg-surface))]',
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
    network: {
      border: 'border-blue-600/35',
      bg: 'bg-[color-mix(in_srgb,#1E4E5E_12%,var(--bg-surface))]',
      icon: WifiOff,
      iconClass: 'text-blue-700',
    },
    proxy_configuration: {
      border: 'border-red-600/45',
      bg: 'bg-[color-mix(in_srgb,var(--diverge)_10%,var(--bg-surface))]',
      icon: ServerCrash,
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

  const waitingOnRateLimit = type === 'rate_limit' && secondsLeft > 0

  const primaryRetryLabel =
    type === 'auth' || type === 'network' || type === 'proxy_configuration'
      ? 'Retry connection'
      : type === 'content_filter'
        ? null
        : type === 'rate_limit'
          ? waitingOnRateLimit
            ? `Retry in ${secondsLeft}s`
            : 'Retry now'
          : status === 'blocked'
            ? 'Retry stage'
            : 'Retry debate'

  const showEditPrompt =
    typeof onEditPrompt === 'function' &&
    (type === 'content_filter' || type === 'token_limit' || type === 'unknown')

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
            {errorId ? (
              <span className="rounded-[4px] border border-[var(--border)] bg-[var(--bg-base)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-medium text-[var(--text-muted)]">
                {errorId}
              </span>
            ) : null}
          </div>
          <p
            className="text-sm font-normal leading-relaxed text-[var(--text-secondary)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {detail}
          </p>
          {waitingOnRateLimit ? (
            <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--text-muted)]">
              GitHub Models is limiting requests. This debate will resume in{' '}
              {secondsLeft} second{secondsLeft === 1 ? '' : 's'}.
            </p>
          ) : null}
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            Completed responses are preserved.
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
        {typeof onRetry === 'function' && primaryRetryLabel ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={waitingOnRateLimit}
            className="babel-btn babel-btn-primary disabled:opacity-50"
          >
            {primaryRetryLabel}
          </button>
        ) : null}
        {showEditPrompt ? (
          <button
            type="button"
            onClick={onEditPrompt}
            className="babel-btn babel-btn-ghost"
          >
            Edit prompt
          </button>
        ) : null}
        {typeof onCopyTranscript === 'function' ? (
          <button
            type="button"
            onClick={onCopyTranscript}
            className="babel-btn babel-btn-ghost"
          >
            Copy partial transcript
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          className="babel-btn babel-btn-quiet"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
