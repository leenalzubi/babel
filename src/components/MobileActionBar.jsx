/**
 * Mobile sticky primary action: hides via CSS class when scrolled down
 * if parent adds data-hidden; otherwise always shown under 600px.
 * @param {{
 *   label: string,
 *   onAction: () => void,
 *   disabled?: boolean,
 *   hidden?: boolean,
 * }} props
 */
export default function MobileActionBar({
  label,
  onAction,
  disabled = false,
  hidden = false,
}) {
  if (hidden) return null
  return (
    <div className="actionbar" role="region" aria-label="Primary debate action">
      <button
        type="button"
        className="babel-btn babel-btn-primary btn min-h-11 w-full"
        disabled={disabled}
        onClick={onAction}
      >
        {label}
      </button>
    </div>
  )
}
