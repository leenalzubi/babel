/**
 * Compact title bar for the framed application window.
 * @param {{
 *   title: string,
 *   context?: import('react').ReactNode,
 * }} props
 */
export default function WindowTitleBar({ title, context = null }) {
  if (!title && !context) return null

  return (
    <div className="babel-window-titlebar">
      {title ? <p className="babel-window-title">{title}</p> : <span />}
      {context ? (
        <div className="babel-window-context">{context}</div>
      ) : null}
    </div>
  )
}
