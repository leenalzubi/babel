/**
 * Compact title bar for the framed application window.
 * @param {{
 *   title: string,
 *   context?: import('react').ReactNode,
 *   onClose?: () => void,
 * }} props
 */
export default function WindowTitleBar({ title, context = null, onClose }) {
  if (!title && !context && !onClose) return null

  return (
    <div className="babel-window-titlebar">
      <div className="babel-window-titlebar-main">
        {title ? <p className="babel-window-title">{title}</p> : <span />}
        {context ? (
          <div className="babel-window-context">{context}</div>
        ) : null}
      </div>
      {onClose ? (
        <button
          type="button"
          className="babel-window-close"
          onClick={onClose}
          aria-label="Close window"
          title="Close window"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
