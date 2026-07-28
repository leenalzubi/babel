import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Settings } from 'lucide-react'
import AuditTrail from './components/AuditTrail.jsx'
import CompetitionResults from './components/CompetitionResults.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import FindingsPanel from './components/FindingsPanel.jsx'
import ResearchPanel from './components/ResearchPanel.jsx'
import ArchivePanel from './components/ArchivePanel.jsx'
import LabPanel from './components/lab/LabPanel.jsx'
import ModelsAnnouncementBanner from './components/ModelsAnnouncementBanner.jsx'
import PromptInput from './components/PromptInput.jsx'
import FinalPositionCard from './components/FinalPositionCard.jsx'
import ReviewCard from './components/ReviewCard.jsx'
import RoundCard from './components/RoundCard.jsx'
import SettingsDrawer from './components/SettingsDrawer.jsx'
import WorkflowTimeline from './components/WorkflowTimeline.jsx'
import MashrabiyaScreen from './components/MashrabiyaScreen.jsx'
import ProjectCreditFooter from './components/ProjectCreditFooter.jsx'
import DebateTopBar from './components/DebateTopBar.jsx'
import MobileActionBar from './components/MobileActionBar.jsx'
import DecisionMemo from './components/DecisionMemo.jsx'
import StabilityCheckPanel from './components/StabilityCheckPanel.jsx'
import VoiceAnnouncer from './components/VoiceAnnouncer.jsx'
import BabelShell from './components/shell/BabelShell.jsx'
import ArchiveUnlockedNotice from './components/easterEggs/ArchiveUnlockedNotice.jsx'
import LineageModeNotice from './components/easterEggs/LineageModeNotice.jsx'
import { useEasterEggDiscovery } from './hooks/useEasterEggDiscovery.js'
import { roleLabel } from './lib/babelRoles.js'
import { useDebateEngine } from './hooks/useDebateEngine.js'
import { useForge } from './store/useForgeStore.js'
import { useForgeUiSettings } from './context/ForgeSettingsContext.jsx'
import { VoiceActionsProvider } from './context/VoiceActionsContext.jsx'

const SynthesisPanel = lazy(() => import('./components/SynthesisPanel.jsx'))

const WORKFLOW_SIDEBAR_COLLAPSED_KEY = 'forge-workflow-sidebar-collapsed'

function readWorkflowSidebarCollapsed() {
  try {
    return window.localStorage.getItem(WORKFLOW_SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

const DEFAULT_SCORES = {
  ab: 0,
  ac: 0,
  bc: 0,
  average: 0,
  totalClaims: 0,
  contestedClaims: 0,
  unanimousClaims: 0,
}

/** GitHub Pages (etc.): set VITE_DEPLOY_PATH=babel so routes match /babel/about */
const DEPLOY_PATH =
  typeof import.meta.env.VITE_DEPLOY_PATH === 'string'
    ? import.meta.env.VITE_DEPLOY_PATH.replace(/^\/+|\/+$/g, '')
    : ''

function pathPrefix() {
  return DEPLOY_PATH ? `/${DEPLOY_PATH}` : ''
}

/** @param {string} pathname */
function normalizePathname(pathname) {
  const p = pathPrefix()
  if (p && (pathname === p || pathname.startsWith(`${p}/`))) {
    const rest = pathname.slice(p.length) || '/'
    return rest.startsWith('/') ? rest : `/${rest}`
  }
  return pathname
}

/** Browser path including optional deploy prefix (for history API). */
function hrefForAppRoute(route) {
  const inner = pathnameForAppRoute(route)
  const p = pathPrefix()
  if (!p) return inner
  if (inner === '/') return `${p}/`
  return `${p}${inner}`
}

/**
 * @param {string} pathname
 * @returns {{
 *   tab: 'babel' | 'findings' | 'about' | 'lab' | 'archive',
 *   labView?: 'index' | 'methodology' | 'case',
 *   caseSlug?: string | null,
 * }}
 */
function parseAppRoute(pathname) {
  const path = normalizePathname(pathname)
  if (path === '/findings') return { tab: 'findings' }
  if (path === '/about') return { tab: 'about' }
  if (path === '/archive') return { tab: 'archive' }
  if (path === '/lab' || path.startsWith('/lab/')) {
    const rest = path === '/lab' ? '' : path.slice('/lab'.length)
    if (!rest || rest === '/') {
      return { tab: 'lab', labView: 'index', caseSlug: null }
    }
    if (rest === '/methodology') {
      return { tab: 'lab', labView: 'methodology', caseSlug: null }
    }
    const slug = rest.replace(/^\//, '').split('/').filter(Boolean)[0] ?? null
    return { tab: 'lab', labView: 'case', caseSlug: slug }
  }
  return { tab: 'babel' }
}

/** @deprecated Prefer parseAppRoute. Kept for simple tab mapping. */
function mainTabFromPathname(pathname) {
  return parseAppRoute(pathname).tab
}

/**
 * @param {{
 *   tab: 'babel' | 'findings' | 'about' | 'lab' | 'archive',
 *   labView?: 'index' | 'methodology' | 'case',
 *   caseSlug?: string | null,
 * }} route
 */
function pathnameForAppRoute(route) {
  if (route.tab === 'findings') return '/findings'
  if (route.tab === 'about') return '/about'
  if (route.tab === 'archive') return '/archive'
  if (route.tab === 'lab') {
    if (route.labView === 'methodology') return '/lab/methodology'
    if (route.labView === 'case' && route.caseSlug) {
      return `/lab/${route.caseSlug}`
    }
    return '/lab'
  }
  return '/'
}

const DOC_TITLE_DEFAULT = 'Babel: Multi-Model Debate Engine'
const DOC_TITLE_RUNNING = '⟳ Babel: Debate running...'
const DOC_TITLE_COMPLETE = '✓ Babel: Debate complete'
const DOC_TITLE_ERROR = '✗ Babel: Something went wrong'
const DOC_TITLE_PARTIAL = '◐ Babel: Debate complete with gaps'
const DOC_TITLE_BLOCKED = '⏸ Babel: Debate paused'
const DOC_TITLE_DEGRADED = '⟳ Babel: Debate continuing…'

/** @param {string} status */
function isDebateInProgress(status) {
  return status === 'running' || status === 'degraded'
}

/** @param {string} status */
function isDebateSettled(status) {
  return (
    status === 'complete' ||
    status === 'complete_with_gaps' ||
    status === 'partial' ||
    status === 'failed' ||
    status === 'error' ||
    status === 'blocked'
  )
}

/** Show global ErrorBanner only for debate-level / infrastructure blocks. */
function shouldShowGlobalError(status, error) {
  if (error == null || error === '') return false
  return (
    status === 'blocked' ||
    status === 'failed' ||
    status === 'error'
  )
}

/** @param {React.RefObject<HTMLElement | null>} ref */
function scrollSectionIntoView(ref) {
  window.setTimeout(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 300)
}

function HeaderAgentPill({ role, model, color }) {
  return (
    <div className="babel-model-identity inline-flex max-w-[220px] items-center gap-2 sm:max-w-none">
      <span
        className="babel-model-identity-dot shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="babel-model-identity-role block truncate">{role}</span>
        <span className="babel-model-identity-model block truncate">{model}</span>
      </span>
    </div>
  )
}

export default function App() {
  const { state, dispatch } = useForge()
  const { settings } = useForgeUiSettings()
  const { archiveUnlocked } = useEasterEggDiscovery()
  const {
    runDebate,
    resetAndRetry,
    resetForEditPrompt,
    retrySynthesis,
    finishWithoutSynthesis,
    retryAudit,
    retryInfluence,
    retryVoice,
    continueWithout,
    copyPartialTranscript,
    resumeAfterReconnect,
    stageRetrying,
  } = useDebateEngine()
  const [promptDraft, setPromptDraft] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mainTab, setMainTab] = useState(
    /** @type {'babel' | 'findings' | 'about' | 'lab' | 'archive'} */ () =>
      typeof window !== 'undefined'
        ? mainTabFromPathname(window.location.pathname)
        : 'babel'
  )
  const [labRoute, setLabRoute] = useState(
    /** @type {{ view: 'index' | 'methodology' | 'case', caseSlug?: string | null }} */ () => {
      if (typeof window === 'undefined') return { view: 'index', caseSlug: null }
      const r = parseAppRoute(window.location.pathname)
      return {
        view: r.labView ?? 'index',
        caseSlug: r.caseSlug ?? null,
      }
    }
  )
  const [workflowSidebarCollapsed, setWorkflowSidebarCollapsed] = useState(
    () => readWorkflowSidebarCollapsed()
  )
  const [lineageMode, setLineageMode] = useState(false)

  const voiceActionsValue = useMemo(
    () => ({
      retryVoice,
      continueWithout,
      voiceBusy: stageRetrying === 'voice',
    }),
    [retryVoice, continueWithout, stageRetrying]
  )

  const running = isDebateInProgress(state.status)

  const activeRound = useMemo(() => {
    if (state.synthesis) return 'synthesis'
    if (state.finalPositions?.a || state.finalPositionTimers?.a?.startTime)
      return 'r3'
    if (state.reviews?.length || state.reviewTimers?.a?.startTime) return 'r2'
    if (state.rounds?.length || state.agentTimers?.a?.startTime) return 'r1'
    return null
  }, [
    state.synthesis,
    state.finalPositions,
    state.finalPositionTimers,
    state.reviews,
    state.reviewTimers,
    state.rounds,
    state.agentTimers,
  ])

  const navigateMainTab = useCallback(
    /** @param {'babel' | 'findings' | 'about' | 'lab' | 'archive'} tab */ (tab) => {
      const route =
        tab === 'lab'
          ? { tab: 'lab', labView: /** @type {const} */ ('index'), caseSlug: null }
          : { tab }
      setMainTab(tab)
      if (tab === 'lab') {
        setLabRoute({ view: 'index', caseSlug: null })
      }
      window.history.pushState(route, '', hrefForAppRoute(route))
    },
    []
  )

  const navigateLab = useCallback((next) => {
    const route = {
      tab: /** @type {const} */ ('lab'),
      labView: next.view,
      caseSlug: next.caseSlug ?? null,
    }
    setMainTab('lab')
    setLabRoute({
      view: next.view,
      caseSlug: next.caseSlug ?? null,
    })
    window.history.pushState(route, '', hrefForAppRoute(route))
  }, [])

  const navigateShell = useCallback(
    /** @param {'babel' | 'findings' | 'lab' | 'about' | 'method'} tab */ (tab) => {
      if (tab === 'method') {
        navigateLab({ view: 'methodology', caseSlug: null })
        return
      }
      navigateMainTab(tab)
    },
    [navigateLab, navigateMainTab]
  )

  useEffect(() => {
    const path = window.location.pathname
    const parsed = parseAppRoute(path)
    if (window.history.state?.tab !== parsed.tab) {
      window.history.replaceState(parsed, '', hrefForAppRoute(parsed))
    }
  }, [])

  useEffect(() => {
    const onPopState = (/** @type {PopStateEvent} */ event) => {
      const parsed =
        event.state &&
        typeof event.state === 'object' &&
        'tab' in event.state
          ? /** @type {{ tab: string, labView?: string, caseSlug?: string | null }} */ (
              event.state
            )
          : null
      const route =
        parsed &&
        (parsed.tab === 'babel' ||
          parsed.tab === 'findings' ||
          parsed.tab === 'about' ||
          parsed.tab === 'archive' ||
          parsed.tab === 'lab')
          ? {
              tab: /** @type {'babel' | 'findings' | 'about' | 'lab' | 'archive'} */ (
                parsed.tab
              ),
              labView:
                parsed.labView === 'methodology' || parsed.labView === 'case'
                  ? parsed.labView
                  : 'index',
              caseSlug: parsed.caseSlug ?? null,
            }
          : parseAppRoute(window.location.pathname)
      setMainTab(route.tab)
      if (route.tab === 'lab') {
        setLabRoute({
          view: route.labView ?? 'index',
          caseSlug: route.caseSlug ?? null,
        })
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const showWorkflowSidebar =
    mainTab === 'babel' &&
    (state.status !== 'idle' ||
      state.status === 'complete_with_gaps' ||
      state.status === 'partial' ||
      state.rounds.length > 0 ||
      state.rebuttals?.a != null ||
      state.finalPositions?.a != null ||
      state.synthesis != null ||
      state.synthesisWinner != null ||
      state.stageErrors?.synthesis != null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        WORKFLOW_SIDEBAR_COLLAPSED_KEY,
        workflowSidebarCollapsed ? '1' : '0'
      )
    } catch {
      /* ignore */
    }
  }, [workflowSidebarCollapsed])

  useEffect(() => {
    if (isDebateInProgress(state.status)) {
      document.title =
        state.status === 'degraded' ? DOC_TITLE_DEGRADED : DOC_TITLE_RUNNING
    } else if (state.status === 'complete') {
      document.title = DOC_TITLE_COMPLETE
    } else if (state.status === 'failed' || state.status === 'error') {
      document.title = DOC_TITLE_ERROR
    } else if (state.status === 'blocked') {
      document.title = DOC_TITLE_BLOCKED
    } else if (
      state.status === 'complete_with_gaps' ||
      state.status === 'partial'
    ) {
      document.title = DOC_TITLE_PARTIAL
    } else {
      document.title = DOC_TITLE_DEFAULT
    }
  }, [state.status])

  useEffect(() => {
    if (!shouldShowGlobalError(state.status, state.error)) return
    requestAnimationFrame(() => {
      errorBannerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }, [state.status, state.error])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (isDebateInProgress(state.status)) {
        document.title =
          state.status === 'degraded' ? DOC_TITLE_DEGRADED : DOC_TITLE_RUNNING
      } else {
        document.title = DOC_TITLE_DEFAULT
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [state.status])

  const cfg = state.config

  const sortedRounds = useMemo(
    () => [...state.rounds].sort((a, b) => a.roundNum - b.roundNum),
    [state.rounds]
  )

  const showEmptyState =
    state.status === 'idle' &&
    state.rounds.length === 0 &&
    state.rebuttals?.a == null &&
    state.finalPositions?.a == null &&
    state.synthesis == null

  useEffect(() => {
    if (state.status !== 'blocked') return
    const err = state.error
    if (
      !err ||
      typeof err !== 'object' ||
      err.type !== 'rate_limit' ||
      typeof err.retryAfterMs !== 'number'
    ) {
      return
    }
    const started = err.occurredAt ? Date.parse(err.occurredAt) : Date.now()
    const ms = Math.max(0, started + err.retryAfterMs - Date.now())
    const id = window.setTimeout(() => {
      resetAndRetry()
    }, ms + 100)
    return () => window.clearTimeout(id)
  }, [state.status, state.error, resetAndRetry])

  const handleRun = useCallback(() => {
    const p = promptDraft.trim()
    if (p.length < 20) return
    runDebate(p, cfg)
  }, [promptDraft, cfg, runDebate])

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' })
    setPromptDraft('')
  }, [dispatch])

  const promptInputRef = useRef(
    /** @type {{ focusPrompt: () => void } | null} */ (null)
  )
  const errorBannerRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  const startDebateFromShell = useCallback(() => {
    navigateMainTab('babel')
    requestAnimationFrame(() => promptInputRef.current?.focusPrompt())
  }, [navigateMainTab])

  const round1Ref = useRef(/** @type {HTMLDivElement | null} */ (null))
  const round2Ref = useRef(/** @type {HTMLDivElement | null} */ (null))
  const round3Ref = useRef(/** @type {HTMLDivElement | null} */ (null))
  const finalPositionsRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const synthesisRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const memoRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const [topBarVisible, setTopBarVisible] = useState(false)
  const [actionBarHidden, setActionBarHidden] = useState(false)
  const lastScrollY = useRef(0)
  const auditRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  const bindRound3AndFinalsRef = useCallback(
    /** @param {HTMLDivElement | null} el */ (el) => {
      round3Ref.current = el
      finalPositionsRef.current = el
    },
    []
  )

  const jumpToSection = useCallback((target) => {
    const map = {
      r1: round1Ref,
      r2: round2Ref,
      r3: finalPositionsRef,
      synthesis: synthesisRef,
      memo: memoRef,
    }
    const el = map[target]?.current
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const mobileAction = useMemo(() => {
    if (running) {
      return { label: 'Convening…', action: handleRun, disabled: true }
    }
    if (showEmptyState || !state.prompt) {
      return {
        label: 'Convene',
        action: handleRun,
        disabled: promptDraft.trim().length < 20,
      }
    }
    if (state.stageErrors?.synthesis) {
      return {
        label: 'Retry synthesis',
        action: () => void retrySynthesis(),
        disabled: stageRetrying === 'synthesis',
      }
    }
    if (state.synthesis) {
      return {
        label: 'Open memo',
        action: () => jumpToSection('memo'),
        disabled: false,
      }
    }
    return {
      label: 'Jump to latest',
      action: () =>
        jumpToSection(
          activeRound === 'r3' ? 'r3' : activeRound === 'r2' ? 'r2' : 'r1'
        ),
      disabled: false,
    }
  }, [
    running,
    showEmptyState,
    state.prompt,
    state.stageErrors,
    state.synthesis,
    promptDraft,
    handleRun,
    retrySynthesis,
    stageRetrying,
    jumpToSection,
    activeRound,
  ])

  useEffect(() => {
    const main = document.querySelector('.main-content')
    if (!main) return
    const onScroll = () => {
      const y = main.scrollTop
      setTopBarVisible(y > 220 && Boolean(state.prompt || promptDraft))
      if (y > lastScrollY.current + 8) setActionBarHidden(true)
      else if (y < lastScrollY.current - 8) setActionBarHidden(false)
      lastScrollY.current = y
    }
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [state.prompt, promptDraft])

  const prevStatusRef = useRef(state.status)
  const lastCompletedStagePrevRef = useRef(
    /** @type {typeof state.lastCompletedStage} */ (null)
  )
  const r2ScrollDoneRef = useRef(false)
  const r3ScrollDoneRef = useRef(false)
  const synthesisSeenRef = useRef(false)
  const auditStageSeenRef = useRef(false)

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = state.status
    if (
      prev !== 'running' &&
      prev !== 'degraded' &&
      (state.status === 'running' || state.status === 'degraded')
    ) {
      lastCompletedStagePrevRef.current = null
      r2ScrollDoneRef.current = false
      r3ScrollDoneRef.current = false
      synthesisSeenRef.current = false
      auditStageSeenRef.current = false
    }
  }, [state.status])

  /** After round 1, cross-review thinking begins → scroll to round 2. */
  useEffect(() => {
    if (!isDebateInProgress(state.status) || r2ScrollDoneRef.current) return
    if (state.reviewTimers?.a?.startTime == null) return
    r2ScrollDoneRef.current = true
    scrollSectionIntoView(round2Ref)
  }, [state.status, state.reviewTimers?.a?.startTime])

  /** Stage milestones: round 3 block, finals, synthesis, audit. */
  useEffect(() => {
    const lcs = state.lastCompletedStage
    const prev = lastCompletedStagePrevRef.current
    lastCompletedStagePrevRef.current = lcs
    if (lcs === 'reviews' && prev !== 'reviews') {
      r3ScrollDoneRef.current = false
      scrollSectionIntoView(round3Ref)
    }
    if (lcs === 'finalPositions' && prev !== 'finalPositions') {
      scrollSectionIntoView(finalPositionsRef)
    }
    if (lcs === 'synthesis' && prev !== 'synthesis') {
      scrollSectionIntoView(synthesisRef)
    }
  }, [state.lastCompletedStage])

  /** Round 3 final thinking started: scroll finals section if needed. */
  useEffect(() => {
    if (!isDebateInProgress(state.status) || r3ScrollDoneRef.current) return
    if (state.finalPositionTimers?.a?.startTime == null) return
    r3ScrollDoneRef.current = true
    scrollSectionIntoView(finalPositionsRef)
  }, [state.status, state.finalPositionTimers?.a?.startTime])

  useEffect(() => {
    if (!state.synthesis) {
      synthesisSeenRef.current = false
      return
    }
    if (synthesisSeenRef.current) return
    synthesisSeenRef.current = true
    scrollSectionIntoView(synthesisRef)
  }, [state.synthesis])

  useEffect(() => {
    if (state.lastCompletedStage !== 'audit') return
    if (auditStageSeenRef.current) return
    auditStageSeenRef.current = true
    scrollSectionIntoView(auditRef)
  }, [state.lastCompletedStage])

  const mainMdPr =
    showWorkflowSidebar && !workflowSidebarCollapsed
      ? 'md:pr-[272px]'
      : ''
  const roundScrollMt = showWorkflowSidebar
    ? 'scroll-mt-[calc(5.25rem+env(safe-area-inset-top,0px))]'
    : 'scroll-mt-[calc(4rem+env(safe-area-inset-top,0px))]'

  /** @type {'babel' | 'findings' | 'lab' | 'about' | 'method'} */
  const shellNavTab =
    mainTab === 'lab' && labRoute.view === 'methodology'
      ? 'method'
      : mainTab === 'findings'
        ? 'findings'
        : mainTab === 'about' || mainTab === 'archive'
          ? 'about'
          : mainTab === 'lab'
            ? 'lab'
            : 'babel'

  /** @type {'workspace' | 'data' | 'reading' | 'hybrid'} */
  const shellLayout =
    shellNavTab === 'method' || mainTab === 'about' || mainTab === 'archive'
      ? 'reading'
      : mainTab === 'findings'
        ? 'data'
        : mainTab === 'lab'
          ? 'hybrid'
          : 'workspace'

  const shellWindowTitle =
    shellNavTab === 'method'
      ? 'How Babel Works'
      : mainTab === 'findings'
        ? 'Babel - Findings'
        : mainTab === 'about'
          ? 'About Babel'
          : mainTab === 'archive'
            ? 'The Babel Archive'
            : mainTab === 'lab'
              ? 'Babel Lab'
              : ''

  const debateComplete =
    state.status === 'complete' || state.status === 'complete_with_gaps'

  const toggleLineageMode = useCallback(() => {
    setLineageMode((v) => !v)
  }, [])

  useEffect(() => {
    if (mainTab === 'archive' && !archiveUnlocked) {
      navigateMainTab('about')
    }
  }, [mainTab, archiveUnlocked, navigateMainTab])

  useEffect(() => {
    if (!lineageMode) return
    /** @param {KeyboardEvent} event */
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      // Defer to open dialogs / egg cards / trash
      if (
        document.querySelector(
          '[role="dialog"][aria-modal="true"], [role="alertdialog"], .easter-egg.is-open, .builder-note'
        )
      ) {
        return
      }
      event.preventDefault()
      setLineageMode(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [lineageMode])

  useEffect(() => {
    document.documentElement.toggleAttribute('data-lineage-mode', lineageMode)
    return () => {
      document.documentElement.removeAttribute('data-lineage-mode')
    }
  }, [lineageMode])

  const shellTitleContext =
    mainTab === 'babel' ? (
      <div className="flex max-w-full flex-wrap items-center justify-end gap-2 sm:gap-3">
        <HeaderAgentPill
          role={roleLabel(state.roles?.a)}
          model={cfg.agentA.name}
          color={cfg.agentA.color}
        />
        <HeaderAgentPill
          role={roleLabel(state.roles?.b)}
          model={cfg.agentB.name}
          color={cfg.agentB.color}
        />
        <HeaderAgentPill
          role={roleLabel(state.roles?.c)}
          model={cfg.agentC.name}
          color={cfg.agentC.color}
        />
      </div>
    ) : null

  return (
    <div className="relative min-h-dvh w-full text-[var(--text-primary)]">
      <BabelShell
        activeTab={shellNavTab}
        windowTitle={shellWindowTitle}
        layout={shellLayout}
        titleContext={shellTitleContext}
        onNavigate={navigateShell}
        onOpenSettings={() => setSettingsOpen(true)}
        onStartDebate={startDebateFromShell}
        debateComplete={debateComplete}
        lineageMode={lineageMode}
        onToggleLineageMode={toggleLineageMode}
        hideEnvironmentShortcuts={
          showWorkflowSidebar && !workflowSidebarCollapsed
        }
        settingsControl={
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="babel-global-icon-btn inline-flex items-center justify-center"
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" aria-hidden />
          </button>
        }
      >
        <div className={`stage flex min-h-0 flex-1 flex-col px-0 ${mainMdPr}`}>
        {mainTab === 'findings' ? (
          <FindingsPanel />
        ) : mainTab === 'about' ? (
          <ResearchPanel onOpenArchive={() => navigateMainTab('archive')} />
        ) : mainTab === 'archive' ? (
          <ArchivePanel />
        ) : mainTab === 'lab' ? (
          <LabPanel
            route={labRoute}
            onNavigate={navigateLab}
            onOpenArchive={() => navigateMainTab('archive')}
          />
        ) : (
          <div className="workspace-page">
          <VoiceActionsProvider value={voiceActionsValue}>
            <VoiceAnnouncer />
            <ModelsAnnouncementBanner />
            <div className="mb-10 shrink-0">
              <PromptInput
                ref={promptInputRef}
                value={promptDraft}
                onChange={setPromptDraft}
                onRun={handleRun}
                onReset={handleReset}
                disabled={running}
              />
            </div>

            <DebateTopBar
              prompt={state.prompt || promptDraft}
              visible={topBarVisible && !showEmptyState}
              activeRound={activeRound}
              onJump={jumpToSection}
            />

            <div ref={errorBannerRef} className="scroll-mt-4">
              {shouldShowGlobalError(state.status, state.error) ? (
                <ErrorBanner
                  error={state.error}
                  status={state.status}
                  onDismiss={() =>
                    dispatch({ type: 'SET_ERROR', payload: null })
                  }
                  onRetry={
                    state.error &&
                    typeof state.error === 'object' &&
                    state.error.type === 'network'
                      ? () => void resumeAfterReconnect()
                      : resetAndRetry
                  }
                  onEditPrompt={() => {
                    resetForEditPrompt()
                    requestAnimationFrame(() =>
                      promptInputRef.current?.focusPrompt()
                    )
                  }}
                  onCopyTranscript={() => void copyPartialTranscript()}
                />
              ) : null}
              {state.status === 'complete_with_gaps' &&
              !shouldShowGlobalError(state.status, state.error) ? (
                <div
                  className="mb-6 rounded-forge-card border border-[var(--border)] bg-[color-mix(in_srgb,var(--blue)_8%,var(--bg-surface))] px-4 py-3 babel-meta text-[var(--text-secondary)]"
                  role="status"
                >
                  <p className="font-medium text-[var(--text-primary)]">
                    Debate complete with limited evaluation.
                  </p>
                  <p className="mt-1 leading-relaxed">
                    Some voices or optional stages were unavailable, but the
                    usable model responses remain above.
                  </p>
                  <button
                    type="button"
                    className="babel-btn babel-btn-ghost mt-3"
                    onClick={() => void copyPartialTranscript()}
                  >
                    Copy partial transcript
                  </button>
                </div>
              ) : null}
              {state.historySaveError ? (
                <div
                  className="mb-6 rounded-forge-card border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 babel-meta text-[var(--text-secondary)]"
                  role="status"
                >
                  <p className="font-medium text-[var(--text-primary)]">
                    The debate completed, but it could not be added to your
                    history.
                  </p>
                  <p className="mt-1 babel-meta text-[var(--text-muted)]">
                    This does not mean the debate failed.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="babel-btn babel-btn-ghost"
                      onClick={() => void copyPartialTranscript()}
                    >
                      Download transcript
                    </button>
                    <button
                      type="button"
                      className="babel-btn babel-btn-quiet"
                      onClick={() =>
                        dispatch({
                          type: 'SET_HISTORY_SAVE_ERROR',
                          payload: null,
                        })
                      }
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-2 flex flex-col gap-12 md:gap-14">
              {!showEmptyState && sortedRounds.length > 0 ? (
                <MashrabiyaScreen tight />
              ) : null}

              {sortedRounds.map((round, roundIdx) => {
                const scores = state.divergenceScores[roundIdx] ?? DEFAULT_SCORES
                const divergenceReady =
                  state.divergenceScores[roundIdx] != null
                const review = state.reviews.find(
                  (r) => r.roundNum === round.roundNum
                )
                const crossReviewComplete =
                  review &&
                  String(review.aReviews ?? '').length > 0 &&
                  String(review.bReviews ?? '').length > 0 &&
                  String(review.cReviews ?? '').length > 0
                return (
                  <div
                    key={round.roundNum}
                    id={`forge-round-${round.roundNum}`}
                    className={`flex ${roundScrollMt} flex-col gap-12 md:scroll-mt-8`}
                  >
                    {roundIdx > 0 ? <MashrabiyaScreen tight /> : null}
                    <div
                      ref={
                        round.roundNum === 1 ? round1Ref : undefined
                      }
                    >
                      <RoundCard
                        roundNum={round.roundNum}
                        scores={scores}
                        divergenceReady={divergenceReady}
                        round={round}
                        config={cfg}
                        agentTimers={state.agentTimers}
                      />
                    </div>
                    {review ? (
                      <>
                        <MashrabiyaScreen tight />
                        <div ref={round2Ref}>
                          <ReviewCard
                            key={`review-${review.roundNum}`}
                            roundNum={review.roundNum}
                            aReviews={review.aReviews}
                            bReviews={review.bReviews}
                            cReviews={review.cReviews}
                            config={cfg}
                            reviewTimers={state.reviewTimers}
                          />
                        </div>
                      </>
                    ) : null}
                    {state.synthesisWinner ? (
                      <>
                        <MashrabiyaScreen tight />
                        <CompetitionResults
                          synthesisWinner={state.synthesisWinner}
                          config={cfg}
                        />
                      </>
                    ) : null}
                    {crossReviewComplete ? (
                      <>
                        <MashrabiyaScreen tight />
                        <div ref={bindRound3AndFinalsRef}>
                          <FinalPositionCard
                            config={cfg}
                            scores={scores}
                            divergenceReady={divergenceReady}
                            finalPositions={state.finalPositions}
                            finalPositionTimers={state.finalPositionTimers}
                            agentTimers={state.agentTimers}
                            reviewTimers={state.reviewTimers}
                            rebuttalTimers={state.rebuttalTimers}
                            influenceReport={state.influenceReport}
                            influenceLoading={
                              state.influenceLoading ||
                              stageRetrying === 'influence'
                            }
                            influenceError={state.stageErrors?.influence ?? null}
                            onRetryInfluence={() => void retryInfluence()}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                )
              })}

              {state.synthesis != null ? (
                <>
                  <MashrabiyaScreen />
                  <div
                    ref={synthesisRef}
                    id="forge-synthesis"
                    className={`${roundScrollMt} md:scroll-mt-8`}
                  >
                    <Suspense
                      fallback={
                        <div
                          className="rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-12 text-center babel-meta text-[var(--text-muted)]"
                          role="status"
                          aria-live="polite"
                        >
                          Loading synthesis…
                        </div>
                      }
                    >
                      <SynthesisPanel synthesis={state.synthesis} />
                    </Suspense>
                  </div>
                  {state.synthesis ? (
                    <StabilityCheckPanel />
                  ) : null}
                  {state.synthesis?.decisionArtifact || state.synthesis?.output ? (
                    <div
                      ref={memoRef}
                      className={`mt-8 ${roundScrollMt}`}
                      id="babel-decision-memo"
                    >
                      <DecisionMemo
                        prompt={state.prompt}
                        criteria={state.decisionCriteria ?? []}
                        artifact={
                          state.synthesis.decisionArtifact ?? {
                            framed: state.synthesis.output,
                            agreement: '',
                            disagreement: '',
                            strongestSupport: '',
                            weakestAssumptions: '',
                            minorityReport: '',
                            whatWouldChange: '',
                            recommendedNextStep: state.synthesis.rationale ?? '',
                            findings: [
                              {
                                id: 'framed',
                                text: state.synthesis.output,
                                claimIds: [],
                                kind: 'frame',
                              },
                            ],
                          }
                        }
                        roles={state.roles}
                      />
                    </div>
                  ) : null}
                </>
              ) : state.stageErrors?.synthesis != null &&
                isDebateSettled(state.status) ? (
                <>
                  <MashrabiyaScreen />
                  <div
                    ref={synthesisRef}
                    id="forge-synthesis"
                    className={`${roundScrollMt} md:scroll-mt-8`}
                  >
                    <div
                      className="rounded-forge-card border border-amber-700/35 bg-[color-mix(in_srgb,var(--highlight)_18%,var(--bg-surface))] px-5 py-5"
                      role="status"
                    >
                      <h2 className="babel-display babel-display-card m-0 text-[var(--text-primary)]">
                        The synthesis could not be completed.
                      </h2>
                      <p className="mt-2 babel-meta leading-relaxed text-[var(--text-secondary)]">
                        {state.stageErrors.synthesis.userMessage ||
                          state.stageErrors.synthesis.detail ||
                          'All model responses remain available above.'}
                      </p>
                      <p className="mt-3 babel-meta text-[var(--text-muted)]">
                        Individual voice responses are preserved.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="babel-btn babel-btn-primary"
                          disabled={stageRetrying === 'synthesis'}
                          onClick={() => void retrySynthesis()}
                        >
                          {stageRetrying === 'synthesis'
                            ? 'Retrying synthesis…'
                            : 'Retry synthesis'}
                        </button>
                        <button
                          type="button"
                          className="babel-btn babel-btn-ghost"
                          disabled={stageRetrying === 'synthesis'}
                          onClick={finishWithoutSynthesis}
                        >
                          Finish without synthesis
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
              {settings.showResearchSurfaces &&
              isDebateSettled(state.status) &&
              state.status !== 'blocked' ? (
                <>
                  <MashrabiyaScreen tight />
                  {state.synthesis != null &&
                  state.divergenceScores.length > 0 ? (
                    <p className="mx-auto mb-6 max-w-xl px-6 text-center babel-meta italic leading-relaxed text-[var(--text-muted)] md:px-10">
                      Note: claim disagreement scores reflect how agents aligned
                      on each audited claim (agree / disagree / partial /
                      silent), not embedding similarity.
                    </p>
                  ) : null}
                  <div ref={auditRef} className={roundScrollMt}>
                    <AuditTrail
                      onRetryAudit={retryAudit}
                      auditRetrying={stageRetrying === 'audit'}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </VoiceActionsProvider>
          </div>
        )}

        <ProjectCreditFooter />
        <MobileActionBar
          label={mobileAction.label}
          onAction={mobileAction.action}
          disabled={mobileAction.disabled}
          hidden={mainTab !== 'babel' || actionBarHidden}
        />
        </div>
      </BabelShell>

      <ArchiveUnlockedNotice
        onOpenArchive={() => navigateMainTab('archive')}
      />
      <LineageModeNotice
        active={lineageMode}
        onExit={() => setLineageMode(false)}
      />

      {showWorkflowSidebar ? (
        <WorkflowTimeline
          collapsed={workflowSidebarCollapsed}
          onCollapsedChange={setWorkflowSidebarCollapsed}
        />
      ) : null}

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
