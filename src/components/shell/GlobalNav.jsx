import { useRef } from 'react'
import { markEasterEggDiscovered } from '../../lib/easterEggs/discoveryStore.js'

/**
 * Compact global navigation over the environment.
 * @param {{
 *   activeTab: 'babel' | 'findings' | 'method' | 'about',
 *   onNavigate: (tab: 'babel' | 'findings' | 'lab' | 'about' | 'method') => void,
 *   onOpenSettings: () => void,
 *   onStartDebate: () => void,
 *   settingsControl: import('react').ReactNode,
 *   lineageMode?: boolean,
 *   onToggleLineageMode?: () => void,
 * }} props
 */
export default function GlobalNav({
  activeTab,
  onNavigate,
  onOpenSettings,
  onStartDebate,
  settingsControl,
  lineageMode = false,
  onToggleLineageMode,
}) {
  /** @type {{ id: 'babel' | 'findings' | 'method' | 'about', label: string }[]} */
  const links = [
    { id: 'babel', label: 'Debate' },
    { id: 'findings', label: 'Findings' },
    { id: 'method', label: 'Method' },
    { id: 'about', label: 'About' },
  ]

  const clickTimes = useRef(/** @type {number[]} */ ([]))

  /** @param {import('react').MouseEvent<HTMLButtonElement>} event */
  const handleWordmarkClick = (event) => {
    if (lineageMode && onToggleLineageMode) {
      event.preventDefault()
      clickTimes.current = []
      onToggleLineageMode()
      onNavigate('babel')
      return
    }

    const now = Date.now()
    clickTimes.current = [
      ...clickTimes.current.filter((t) => now - t < 2000),
      now,
    ]

    if (clickTimes.current.length >= 3 && onToggleLineageMode) {
      event.preventDefault()
      clickTimes.current = []
      markEasterEggDiscovered('lineage-mode')
      onToggleLineageMode()
      return
    }

    onNavigate('babel')
  }

  return (
    <header className="babel-global-nav">
      <div className="babel-global-nav-inner">
        <button
          type="button"
          className={`babel-global-wordmark${lineageMode ? ' is-lineage-active' : ''}`}
          onClick={handleWordmarkClick}
          aria-label={
            lineageMode
              ? 'Babel home. Lineage view active. Activate again to exit'
              : 'Babel home'
          }
          title={lineageMode ? 'Lineage view active' : undefined}
        >
          Babel
        </button>

        <nav className="babel-global-links" aria-label="Main views">
          {links.map((link) => (
            <button
              key={link.id}
              type="button"
              className={`babel-global-link${
                activeTab === link.id ? ' is-active' : ''
              }`}
              aria-current={activeTab === link.id ? 'page' : undefined}
              onClick={() => onNavigate(link.id)}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="babel-global-actions">
          <a
            href="https://github.com/leenalzubi/babel"
            target="_blank"
            rel="noopener noreferrer"
            className="babel-global-link babel-global-link--quiet"
            aria-label="Babel on GitHub, opens in a new tab"
          >
            GitHub
          </a>
          {settingsControl ?? (
            <button
              type="button"
              className="babel-global-icon-btn"
              onClick={onOpenSettings}
              aria-label="Open settings"
            >
              Settings
            </button>
          )}
          <button
            type="button"
            className="babel-btn babel-btn-primary babel-global-cta"
            onClick={onStartDebate}
          >
            Start a debate
          </button>
        </div>
      </div>
    </header>
  )
}
