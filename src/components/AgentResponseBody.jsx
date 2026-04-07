import { useId, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { splitRedactedThinking } from '../lib/redactedThinking.js'

/**
 * Renders markdown for the visible answer; optional collapsible DeepSeek R1
 * &lt;redacted_thinking&gt; block below when present.
 *
 * @param {{ rawText: string, markdownClassName: string }} props
 */
export default function AgentResponseBody({ rawText, markdownClassName }) {
  const panelId = useId()
  const { answer, thinking } = splitRedactedThinking(rawText ?? '')
  const [open, setOpen] = useState(false)

  const displayAnswer =
    answer.length > 0
      ? answer
      : thinking
        ? '_The model returned reasoning only; expand **DeepSeek reasoning** below._'
        : '_No visible answer text._'

  return (
    <div className="flex flex-col">
      <ReactMarkdown className={markdownClassName}>{displayAnswer}</ReactMarkdown>

      {thinking ? (
        <div className="mt-3 border-t border-[var(--border)]/60 pt-3">
          <button
            type="button"
            id={`${panelId}-trigger`}
            aria-expanded={open}
            aria-controls={`${panelId}-thinking`}
            onClick={() => setOpen((v) => !v)}
            className="rounded-[4px] px-0 py-0.5 font-mono text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-raised)] hover:text-[var(--text-secondary)]"
          >
            {open ? 'DeepSeek reasoning ▴' : 'DeepSeek reasoning ▾'}
          </button>

          {open ? (
            <div
              id={`${panelId}-thinking`}
              role="region"
              aria-labelledby={`${panelId}-trigger`}
              className="mt-2 border-l-2 border-[var(--border)] bg-[var(--bg-notebook)] py-2 pl-4 pr-3 text-[15px] leading-relaxed text-[var(--text-secondary)]"
            >
              <div className="whitespace-pre-wrap break-words">{thinking}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
