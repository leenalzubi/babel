import React from 'react'

/**
 * Labeled metadata fields without middot separators.
 * @param {{
 *   fields: { label?: string, value: import('react').ReactNode, unavailable?: boolean }[],
 *   className?: string,
 * }} props
 */
export default function MetadataRow({ fields, className = '' }) {
  const visible = fields.filter(
    (f) => f != null && f.value != null && f.value !== ''
  )
  if (visible.length === 0) return null

  return (
    <div className={`metadata-row ${className}`.trim()}>
      {visible.map((f, i) => (
        <span
          key={`${f.label ?? 'meta'}-${i}`}
          className="meta-field"
        >
          {f.label ? <span className="meta-label">{f.label}:</span> : null}
          <span
            className={`meta-value ${f.unavailable ? 'is-unavailable' : ''}`.trim()}
          >
            {f.value}
          </span>
        </span>
      ))}
    </div>
  )
}
