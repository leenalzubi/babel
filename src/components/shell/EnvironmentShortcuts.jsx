import {
  BookOpen,
  Code2,
  Scale,
  Search,
  Swords,
} from 'lucide-react'
import TrashTrigger from '../easterEggs/TrashTrigger.jsx'

/**
 * Desktop-only environmental shortcuts flanking the wide top bar.
 * Vertical columns stay mid-screen; horizontal position tracks the chrome bar edges.
 * @param {{
 *   activeTab: 'babel' | 'findings' | 'lab' | 'about' | 'method',
 *   onNavigate: (tab: 'babel' | 'findings' | 'lab' | 'about' | 'method') => void,
 *   hidden?: boolean,
 *   onOpenTrash?: () => void,
 *   trashTriggerRef?: import('react').RefObject<HTMLButtonElement | null>,
 * }} props
 */
export default function EnvironmentShortcuts({
  activeTab,
  onNavigate,
  hidden = false,
  onOpenTrash,
  trashTriggerRef,
}) {
  if (hidden) return null

  const left = [
    { id: 'babel', label: 'Debate', Icon: Swords },
    { id: 'findings', label: 'Findings', Icon: Search },
  ]
  const right = [
    { id: 'method', label: 'Method', Icon: Scale },
    { id: 'about', label: 'About', Icon: BookOpen },
    {
      id: 'github',
      label: 'GitHub',
      Icon: Code2,
      href: 'https://github.com/leenalzubi/babel',
    },
  ]

  return (
    <div className="babel-env-shortcuts" aria-label="Environment shortcuts">
      <ul className="babel-env-shortcuts-col babel-env-shortcuts-col--left">
        {left.map(({ id, label, Icon }) => (
          <li key={id}>
            <button
              type="button"
              className={`babel-env-shortcut${
                activeTab === id ? ' is-active' : ''
              }`}
              aria-current={activeTab === id ? 'page' : undefined}
              onClick={() =>
                onNavigate(/** @type {'babel' | 'findings'} */ (id))
              }
            >
              <span className="babel-env-shortcut-icon" aria-hidden>
                <Icon strokeWidth={1.75} />
              </span>
              <span className="babel-env-shortcut-label">{label}</span>
            </button>
          </li>
        ))}
      </ul>
      <ul className="babel-env-shortcuts-col babel-env-shortcuts-col--right">
        {right.map((item) => (
          <li key={item.id}>
            {'href' in item && item.href ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="babel-env-shortcut"
                aria-label={`${item.label}, opens in a new tab`}
              >
                <span className="babel-env-shortcut-icon" aria-hidden>
                  <item.Icon strokeWidth={1.75} />
                </span>
                <span className="babel-env-shortcut-label">{item.label}</span>
              </a>
            ) : (
              <button
                type="button"
                className={`babel-env-shortcut${
                  activeTab === item.id ? ' is-active' : ''
                }`}
                aria-current={activeTab === item.id ? 'page' : undefined}
                onClick={() =>
                  onNavigate(/** @type {'method' | 'about'} */ (item.id))
                }
              >
                <span className="babel-env-shortcut-icon" aria-hidden>
                  <item.Icon strokeWidth={1.75} />
                </span>
                <span className="babel-env-shortcut-label">{item.label}</span>
              </button>
            )}
          </li>
        ))}
        {onOpenTrash ? (
          <li>
            <TrashTrigger
              variant="env"
              onOpen={onOpenTrash}
              triggerRef={trashTriggerRef}
            />
          </li>
        ) : null}
      </ul>
    </div>
  )
}
