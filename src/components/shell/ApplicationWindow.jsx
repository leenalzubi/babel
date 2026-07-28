import WindowTitleBar from './WindowTitleBar.jsx'

/**
 * Framed product surface over the Babylon environment.
 * @param {{
 *   title: string,
 *   layout?: 'workspace' | 'data' | 'reading' | 'hybrid',
 *   titleContext?: import('react').ReactNode,
 *   children: import('react').ReactNode,
 * }} props
 */
export default function ApplicationWindow({
  title,
  layout = 'workspace',
  titleContext = null,
  children,
}) {
  return (
    <div
      className={`babel-app-window babel-app-window--${layout}`}
      data-layout={layout}
    >
      <WindowTitleBar title={title} context={titleContext} />
      <div className="babel-app-window-body">{children}</div>
    </div>
  )
}
