import ClayRefuseJarIcon from './TrashIcons.jsx'

/**
 * Shared Trash shortcut control.
 * @param {{
 *   onOpen: () => void,
 *   triggerRef?: import('react').RefObject<HTMLButtonElement | null>,
 *   variant?: 'env' | 'nav' | 'inline',
 *   className?: string,
 * }} props
 */
export default function TrashTrigger({
  onOpen,
  triggerRef,
  variant = 'env',
  className = '',
}) {
  const base =
    variant === 'env'
      ? 'babel-env-shortcut'
      : variant === 'nav'
        ? 'babel-global-icon-btn babel-trash-nav-trigger'
        : 'easter-archive-link babel-trash-inline-trigger'

  return (
    <button
      ref={triggerRef}
      type="button"
      className={`${base} ${className}`.trim()}
      aria-label="Trash"
      onClick={onOpen}
    >
      {variant === 'inline' ? (
        'Trash'
      ) : (
        <>
          <span className="babel-env-shortcut-icon" aria-hidden>
            <ClayRefuseJarIcon />
          </span>
          {variant === 'env' ? (
            <span className="babel-env-shortcut-label">Trash</span>
          ) : (
            <span className="babel-trash-nav-label">Trash</span>
          )}
        </>
      )}
    </button>
  )
}
