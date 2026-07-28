import React from 'react'

/**
 * Narrow reading measure aligned to the left edge of the shared stage.
 * @param {{
 *   children: import('react').ReactNode,
 *   as?: 'div' | 'article' | 'section',
 *   className?: string,
 *   labelledBy?: string,
 *   label?: string,
 * }} props
 */
export default function ReadingColumn({
  children,
  as: Tag = 'div',
  className = '',
  labelledBy,
  label,
}) {
  return (
    <Tag
      className={`reading-column ${className}`.trim()}
      aria-labelledby={labelledBy}
      aria-label={label}
    >
      {children}
    </Tag>
  )
}
