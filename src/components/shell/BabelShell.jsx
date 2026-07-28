import { useCallback, useMemo, useRef, useState } from 'react'
import BabylonBackground from './BabylonBackground.jsx'
import GlobalNav from './GlobalNav.jsx'
import EnvironmentShortcuts from './EnvironmentShortcuts.jsx'
import ApplicationWindow from './ApplicationWindow.jsx'
import EnvironmentEasterEggs from '../easterEggs/EnvironmentEasterEggs.jsx'
import TrashWindow from '../easterEggs/TrashWindow.jsx'
import { TrashProvider } from '../easterEggs/TrashContext.jsx'
import BuilderNote from '../BuilderNote.jsx'
import { markEasterEggDiscovered } from '../../lib/easterEggs/discoveryStore.js'

/**
 * Persistent Babylon environment + framed application surface.
 * @param {{
 *   activeTab: 'babel' | 'findings' | 'lab' | 'about' | 'method',
 *   windowTitle: string,
 *   layout?: 'workspace' | 'data' | 'reading' | 'hybrid',
 *   titleContext?: import('react').ReactNode,
 *   onNavigate: (tab: 'babel' | 'findings' | 'lab' | 'about' | 'method') => void,
 *   onOpenSettings: () => void,
 *   onStartDebate: () => void,
 *   settingsControl?: import('react').ReactNode,
 *   hideEnvironmentShortcuts?: boolean,
 *   debateComplete?: boolean,
 *   lineageMode?: boolean,
 *   onToggleLineageMode?: () => void,
 *   suppressBuilderNote?: boolean,
 *   children: import('react').ReactNode,
 * }} props
 */
export default function BabelShell({
  activeTab,
  windowTitle,
  layout = 'workspace',
  titleContext = null,
  onNavigate,
  onOpenSettings,
  onStartDebate,
  settingsControl,
  hideEnvironmentShortcuts = false,
  debateComplete = false,
  lineageMode = false,
  onToggleLineageMode,
  suppressBuilderNote = false,
  children,
}) {
  const [trashOpen, setTrashOpen] = useState(false)
  const [appWindowOpen, setAppWindowOpen] = useState(true)
  const trashReturnFocusRef = useRef(
    /** @type {HTMLElement | null} */ (null)
  )
  const desktopTrashRef = useRef(
    /** @type {HTMLButtonElement | null} */ (null)
  )

  const openTrash = useCallback(
    (/** @type {HTMLElement | null | undefined} */ trigger) => {
      trashReturnFocusRef.current = trigger ?? desktopTrashRef.current
      markEasterEggDiscovered('trash-archive')
      setTrashOpen(true)
    },
    []
  )

  const closeTrash = useCallback(() => {
    setTrashOpen(false)
  }, [])

  const closeAppWindow = useCallback(() => {
    setAppWindowOpen(false)
  }, [])

  const handleNavigate = useCallback(
    /** @param {'babel' | 'findings' | 'lab' | 'about' | 'method'} tab */ (tab) => {
      setAppWindowOpen(true)
      onNavigate(tab)
    },
    [onNavigate]
  )

  const handleStartDebate = useCallback(() => {
    setAppWindowOpen(true)
    onStartDebate()
  }, [onStartDebate])

  const trashContextValue = useMemo(() => ({ openTrash }), [openTrash])

  return (
    <TrashProvider value={trashContextValue}>
      <div
        className="babel-shell"
        data-layout={layout}
        data-debate-complete={debateComplete ? 'true' : undefined}
        data-lineage-mode={lineageMode ? 'true' : undefined}
      >
        <BabylonBackground gateLit={debateComplete && activeTab === 'babel'} />
        <EnvironmentEasterEggs
          activeTab={activeTab}
          debateComplete={debateComplete}
        />
        <div className="babel-shell-foreground">
          <header className="babel-chrome">
            <GlobalNav
              activeTab={activeTab}
              onNavigate={handleNavigate}
              onOpenSettings={onOpenSettings}
              onStartDebate={handleStartDebate}
              settingsControl={settingsControl}
              lineageMode={lineageMode}
              onToggleLineageMode={onToggleLineageMode}
            />
          </header>
          <EnvironmentShortcuts
            activeTab={activeTab}
            onNavigate={handleNavigate}
            hidden={hideEnvironmentShortcuts}
            onOpenTrash={() => openTrash(desktopTrashRef.current)}
            trashTriggerRef={desktopTrashRef}
          />
          <div className="babel-shell-stage">
            <ApplicationWindow
              title={windowTitle}
              layout={layout}
              titleContext={titleContext}
              open={appWindowOpen}
              onClose={closeAppWindow}
            >
              {children}
            </ApplicationWindow>
          </div>
        </div>
        <TrashWindow
          open={trashOpen}
          onClose={closeTrash}
          triggerRef={trashReturnFocusRef}
        />
        <BuilderNote suppressed={suppressBuilderNote || trashOpen} />
      </div>
    </TrashProvider>
  )
}
