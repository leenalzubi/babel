import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  fetchGithubModelsProxyConfigured,
  hasGithubModelsClientToken,
} from '../api/githubModelsClient.js'
import { BABEL_ROLES, roleBrief } from '../lib/babelRoles.js'
import { allRoleRotations } from '../lib/roleRotation.js'
import { SUGGESTED_CRITERIA } from '../lib/decisionCriteria.js'
import { useForge } from '../store/useForgeStore.js'
import { DecisionCriterion } from './reasoning/Primitives.jsx'

/**
 * @typedef {{ focusPrompt: () => void }} PromptInputHandle
 */

/**
 * @param {{
 *   value: string,
 *   onChange: (v: string) => void,
 *   onRun: () => void,
 *   disabled?: boolean,
 *   placeholder?: string,
 * }} props
 * @param {import('react').Ref<PromptInputHandle | null>} ref
 */
function PromptInputInner(
  {
    value,
    onChange,
    onRun,
    disabled = false,
    placeholder = 'Should an AI meeting assistant send action items automatically without human approval?',
  },
  ref
) {
  const textareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))
  const [inspectRole, setInspectRole] = useState(
    /** @type {import('../lib/babelRoles.js').BabelRoleId | null} */ (null)
  )

  useImperativeHandle(ref, () => ({
    focusPrompt() {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
  }))

  const { state, dispatch } = useForge()
  const { agentA, agentB, agentC } = state.config
  const criteria = state.decisionCriteria ?? []
  const roles = state.roles
  const roleSlots = [
    { key: 'a', agent: agentA, roleId: roles.a },
    { key: 'b', agent: agentB, roleId: roles.b },
    { key: 'c', agent: agentC, roleId: roles.c },
  ]

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
    ? null
    : tokenHint ?? 'GitHub Models unavailable'

  const MIN_PROMPT_CHARS = 20
  const MAX_PROMPT_CHARS = 48_000
  const trimmedLen = value.trim().length
  const tooShort = trimmedLen > 0 && trimmedLen < MIN_PROMPT_CHARS
  const tooLong = value.length > MAX_PROMPT_CHARS
  const canRun = !disabled && trimmedLen >= MIN_PROMPT_CHARS && !tooLong && hasToken
  const estTokens = Math.max(1, Math.round(value.length / 4))
  const fieldError = statusMessage
    ? statusMessage
    : tooShort
      ? `Add a bit more detail (${MIN_PROMPT_CHARS - trimmedLen} more characters) so the models have enough to debate.`
      : tooLong
        ? `Shorten the prompt. Over ${MAX_PROMPT_CHARS.toLocaleString()} characters will be truncated before the debate starts.`
        : null

  const toggleCriterion = (label) => {
    const next = criteria.includes(label)
      ? criteria.filter((c) => c !== label)
      : [...criteria, label]
    dispatch({ type: 'SET_CRITERIA', payload: next })
  }

  return (
    <section className="convene-field babel-card flex flex-col gap-6 shadow-forge-card sm:gap-8 sm:p-7">
      <div className="babel-intro">
        <h1 className="babel-display babel-display-section m-0">
          Start a debate
        </h1>
        <p className="babel-lede reading-column m-0">
          Stress-test a decision across three different agent cognitive roles.
          You can select criteria below the text box; they are your instructions.
        </p>
        <div
          className={`babel-field ${disabled ? 'opacity-50' : ''}${
            fieldError ? ' is-invalid' : ''
          }`}
        >
          <textarea
            id="babel-decision"
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                if (canRun) onRun()
              }
            }}
            disabled={disabled}
            rows={6}
            placeholder={placeholder}
            className="min-h-[140px]"
            aria-label="Decision to stress-test"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? 'babel-decision-error' : undefined}
            maxLength={MAX_PROMPT_CHARS + 2_000}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 babel-meta">
            <span>
              {trimmedLen.toLocaleString()} characters
              <span className="mx-2 text-[var(--ink-faint)]" aria-hidden>
                |
              </span>
              ~{estTokens.toLocaleString()} tokens (est.)
            </span>
            <span>
              {MIN_PROMPT_CHARS}-{MAX_PROMPT_CHARS.toLocaleString()} chars
              <span className="mx-2 text-[var(--ink-faint)]" aria-hidden>
                |
              </span>
              ⌘/Ctrl+Enter to start
            </span>
          </div>
          {fieldError ? (
            <p
              id="babel-decision-error"
              className="babel-field-error"
              role="alert"
            >
              {fieldError}
            </p>
          ) : null}
        </div>

        <div>
          <p className="babel-eyebrow mb-4">Decision criteria</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Decision criteria">
            {SUGGESTED_CRITERIA.map((label) => (
              <DecisionCriterion
                key={label}
                label={label}
                selected={criteria.includes(label)}
                disabled={disabled}
                onToggle={() => toggleCriterion(label)}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="babel-display babel-display-card m-0">AI agent roles</h2>
          <label className="flex items-center gap-2 babel-meta">
            Rotation
            <select
              className="min-h-12 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--plaster-hi)] px-3 text-[var(--text-control)] text-[var(--ink)]"
              aria-label="Role to model rotation"
              value={JSON.stringify(roles)}
              disabled={disabled}
              onChange={(e) => {
                try {
                  const next = JSON.parse(e.target.value)
                  dispatch({ type: 'SET_ROLES', payload: next })
                } catch {
                  /* ignore */
                }
              }}
            >
              {allRoleRotations().map((r) => (
                <option key={r.rotation} value={JSON.stringify(r.roles)}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div
          className="majlis"
          aria-label="Cognitive roles and assigned models"
        >
          {roleSlots.map(({ key, agent, roleId }) => {
            const role = BABEL_ROLES[roleId]
            return (
                <div
                  key={key}
                  className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--plaster-hi)] p-5"
                >
                <p className="babel-voice-name m-0" style={{ color: agent.color }}>
                  {role?.label ?? 'Voice'}
                </p>
                <p className="babel-meta-tech mt-1 mb-0">{agent.name}</p>
                <p className="babel-prose mt-3 mb-0">
                  {roleBrief(roleId)}
                </p>
                <button
                  type="button"
                  className="babel-btn babel-btn-quiet mt-3 px-2"
                  aria-expanded={inspectRole === roleId}
                  onClick={() =>
                    setInspectRole((cur) => (cur === roleId ? null : roleId))
                  }
                >
                  {inspectRole === roleId ? 'Hide instructions' : 'Inspect role prompt'}
                </button>
                {inspectRole === roleId ? (
                  <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-[var(--radius-sm)] bg-[var(--limewash)] p-3 font-mono text-[0.8125rem] text-[var(--ink-soft)]">
                    {role?.instructions}
                  </pre>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <p className="babel-meta mt-1 max-w-xl text-pretty text-center sm:mx-auto" role="note">
        By running a debate you consent to contributing anonymously to this
        dataset. Roles are prompt configurations; model identity stays visible.
      </p>
    </section>
  )
}

const PromptInput = forwardRef(PromptInputInner)
PromptInput.displayName = 'PromptInput'

export default PromptInput
