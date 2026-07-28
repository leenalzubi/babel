import React from 'react'

/**
 * Major content section with shared spacing / optional top rule.
 * @param {{
 *   children: import('react').ReactNode,
 *   title?: string,
 *   titleId?: string,
 *   first?: boolean,
 *   id?: string,
 *   className?: string,
 *   wide?: boolean,
 * }} props
 */
export default function PageSection({
  children,
  title,
  titleId,
  first = false,
  id,
  className = '',
  wide = false,
}) {
  return (
    <section
      id={id}
      className={`page-section ${first ? 'is-first' : ''} ${className}`.trim()}
      aria-labelledby={titleId}
    >
      {title ? (
        <h2 id={titleId} className="babel-display babel-display-section">
          {title}
        </h2>
      ) : null}
      <div className={wide ? 'wide-content' : undefined}>{children}</div>
    </section>
  )
}
