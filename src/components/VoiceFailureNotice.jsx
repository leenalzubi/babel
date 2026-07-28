import { useState } from 'react'
import { AlertTriangle, Clock } from 'lucide-react'
import { isAgentTimeoutResponse } from '../lib/debateConstants.js'
import ReplaceModelPicker from './ReplaceModelPicker.jsx'

/**
 * In-card notice for a soft-failed voice (timeout, filter, rate limit, etc.).
 * @param {{
 *   agentName: string,
 *   agentKey?: 'a' | 'b' | 'c',
 *   message?: string | null,
 *   stageLabel?: string | null,
 *   onRetry?: (() => void) | null,
 *   onContinueWithout?: (() => void) | null,
 *   allowReplaceModel?: boolean,
 *   busy?: boolean,
 * }} props
 */
export default function VoiceFailureNotice({
  agentName,
  agentKey,
  message,
  stageLabel,
  onRetry,
  onContinueWithout,
  allowReplaceModel = true,
  busy = false,
}) {
  const [replacing, setReplacing] = useState(false)
  const timedOut = message == null || isAgentTimeoutResponse(message)
  const Icon = timedOut ? Clock : AlertTriangle
  const body =
    typeof message === 'string' && message.length > 0 && !timedOut
      ? message
      : `${agentName} took too long and was skipped for this stage.`

  const showActions =
    typeof onRetry === 'function' ||
    typeof onContinueWithout === 'function' ||
    (allowReplaceModel && agentKey)

  return (
    <div
      className="babel-voice voice forge-reveal-card"
      data-state="failed"
      role="region"
      aria-label={`${agentName} response failed`}
    >
      <div className="babel-voice-niche niche">
        <span className="babel-voice-name text-[var(--madder)]">{agentName}</span>
        <span className="babel-voice-stance">failed</span>
      </div>
      <div className="babel-voice-body body">
        <p className="flex items-start gap-2 font-[family-name:var(--font-mono)] text-[11px] leading-snug text-[var(--ink-soft)]">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--madder)]" strokeWidth={2} aria-hidden />
          <span>
            <span className="font-medium text-[var(--text-primary)]">
              {timedOut ? 'Timed out' : 'Could not answer'}
            </span>
            {stageLabel ? (
              <span className="text-[var(--text-muted)]">; {stageLabel}</span>
            ) : null}
            <span className="mt-1 block font-[family-name:var(--font-body)] text-[13px] not-italic leading-relaxed text-[var(--text-secondary)]">
              {body}
            </span>
          </span>
        </p>
        {showActions ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {typeof onRetry === 'function' ? (
              <button
                type="button"
                className="babel-btn babel-btn-primary min-h-11"
                disabled={busy}
                onClick={onRetry}
              >
                {busy ? 'Retrying…' : `Retry ${agentName}`}
              </button>
            ) : null}
            {typeof onContinueWithout === 'function' ? (
              <button
                type="button"
                className="babel-btn babel-btn-ghost min-h-11"
                disabled={busy}
                onClick={onContinueWithout}
              >
                Continue without it
              </button>
            ) : null}
            {allowReplaceModel && agentKey ? (
              <button
                type="button"
                className="babel-btn babel-btn-quiet min-h-11"
                disabled={busy}
                onClick={() => setReplacing((v) => !v)}
              >
                {replacing ? 'Hide catalog' : 'Replace model'}
              </button>
            ) : null}
          </div>
        ) : null}
        {replacing && agentKey ? (
          <ReplaceModelPicker
            agentKey={agentKey}
            onDone={() => setReplacing(false)}
          />
        ) : null}
      </div>
    </div>
  )
}
