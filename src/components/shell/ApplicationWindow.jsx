import WindowTitleBar from './WindowTitleBar.jsx'

/**
 * Framed product surface over the Babylon environment.
 * @param {{
 *   title: string,
 *   layout?: 'workspace' | 'data' | 'reading' | 'hybrid',
 *   titleContext?: import('react').ReactNode,
 *   open?: boolean,
 *   onClose?: () => void,
 *   children: import('react').ReactNode,
 * }} props
 */
export default function ApplicationWindow({
  title,
  layout = 'workspace',
  titleContext = null,
  open = true,
  onClose,
  children,
}) {
  return (
    <div
      className={`babel-app-window babel-app-window--${layout}`}
      data-layout={layout}
      data-open={open ? 'true' : 'false'}
    >
      <WindowTitleBar title={title} context={titleContext} onClose={onClose} />
      <div className="babel-app-window-body">{children}</div>
    </div>
  )
}
