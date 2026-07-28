import { useMemo, useState } from 'react'
import { replaceModelOptions } from '../lib/babelModelCatalog.js'
import { useForge } from '../store/useForgeStore.js'

/**
 * Inline picker to replace one debate voice without restarting the run.
 * @param {{
 *   agentKey: 'a' | 'b' | 'c',
 *   onDone?: () => void,
 * }} props
 */
export default function ReplaceModelPicker({ agentKey, onDone }) {
  const { state, dispatch } = useForge()
  const config = state.config
  const current =
    agentKey === 'a'
      ? config.agentA
      : agentKey === 'b'
        ? config.agentB
        : config.agentC
  const otherIds = [
    config.agentA.model,
    config.agentB.model,
    config.agentC.model,
  ].filter((id) => id !== current.model)

  const options = useMemo(
    () => replaceModelOptions(current.model, otherIds),
    [current.model, otherIds.join('|')]
  )
  const [selected, setSelected] = useState(options[0]?.id ?? '')

  if (options.length === 0) {
    return (
      <p className="mt-2 font-mono text-[10px] text-[var(--text-muted)]">
        No alternate models are listed in the catalog.
      </p>
    )
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-dashed border-[var(--border)] pt-3">
      <label className="font-mono text-[10px] text-[var(--text-muted)]">
        Replace {current.name}
        <select
          className="mt-1 w-full rounded-[4px] border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1.5 font-[family-name:var(--font-body)] text-sm text-[var(--text-primary)]"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {options.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="babel-btn babel-btn-primary self-start"
        onClick={() => {
          const pick = options.find((m) => m.id === selected) || options[0]
          if (!pick) return
          const key =
            agentKey === 'a'
              ? 'agentA'
              : agentKey === 'b'
                ? 'agentB'
                : 'agentC'
          dispatch({
            type: 'PATCH_CONFIG',
            payload: {
              [key]: {
                ...current,
                model: pick.id,
                name: pick.name,
              },
            },
          })
          onDone?.()
        }}
      >
        Use this model
      </button>
      <p className="font-mono text-[9px] text-[var(--text-muted)]">
        Model identity is not swapped silently. Retry this voice after replacing.
      </p>
    </div>
  )
}
