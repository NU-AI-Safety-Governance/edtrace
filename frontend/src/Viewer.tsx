import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import {
  ArrowLeft, ArrowRight, Braces, ChevronsLeft, ChevronsRight, Clapperboard, Code, CornerLeftUp,
  House, Keyboard, MonitorSpeaker, Moon, PanelLeft, PanelRight, Presentation, StickyNote, Sun,
} from 'lucide-react'
import { useKeyboard, type Actions } from './keyboard'
import { useLineModels, type LineModel } from './lines'
import { Inspector, Outline } from './Panels'
import { HelpDialog, Lightbox } from './Overlays'
import { SITE_TITLE, ViewerContext, type Theme } from './context'
import { openSpeakerWindow, usePresenterSync } from './presenter'
import { LineRenderings } from './Renderings'
import SpeakerView from './Speaker'
import {
  findStepAtLine, indexTrace, lineEnvsFor, locationKey, resolvePosition, stepOutIndex, stepOverIndex, traceUrl,
  type OutlineEntry,
} from './trace'
import type { Env, Trace } from './types'
import { updateParams, usePreference } from './url'
import { Value } from './Values'

interface ViewerProps {
  tracePath: string
  params: URLSearchParams
  theme: Theme
  toggleTheme: () => void
}

export default function Viewer({ tracePath, params, theme, toggleTheme }: ViewerProps) {
  const { trace, error } = useTrace(tracePath)
  if (error) {
    return (
      <div className="screen-message">
        <h2>Couldn’t load <code>{tracePath}</code></h2>
        <p>{error}</p>
        <p className="muted">Generate it with <code>python -m edtrace.execute -m {tracePath.replace(/\.json$/, '').split('/').pop()}</code></p>
        <button type="button" className="button" onClick={() => updateParams({ trace: null, step: null, source: null, line: null }, { push: true })}>
          <House size={16} /> All lectures
        </button>
      </div>
    )
  }
  if (!trace) return <div className="screen-message muted">Loading…</div>
  if (params.has('speaker')) return <SpeakerView trace={trace} tracePath={tracePath} params={params} theme={theme} />
  return <LoadedViewer trace={trace} tracePath={tracePath} params={params} theme={theme} toggleTheme={toggleTheme} />
}

/** Fetch the trace, and refetch it whenever the dev server says it was re-executed. */
interface TraceState {
  trace: Trace | null
  error: string | null
  path?: string
}

function useTrace(tracePath: string): TraceState {
  const [state, setState] = useState<TraceState>({ trace: null, error: null })
  const [version, setVersion] = useState(0)
  const url = traceUrl(tracePath)

  useEffect(() => {
    let cancelled = false
    fetch(url, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText} (${url})`)
        return response.json()
      })
      .then((trace: Trace) => { if (!cancelled) setState({ trace, error: null, path: url }) })
      .catch((error: Error) => { if (!cancelled) setState({ trace: null, error: error.message, path: url }) })
    return () => { cancelled = true }
  }, [url, version])

  useEffect(() => {
    const hot = import.meta.hot
    if (!hot) return
    const onChange = (data: { path: string }) => { if (data.path === url) setVersion((v) => v + 1) }
    hot.on('edtrace:trace-changed', onChange)
    return () => hot.off('edtrace:trace-changed', onChange)
  }, [url])

  // Don't show a stale trace while switching lectures
  return state.path === url ? state : { trace: null, error: null }
}

function LoadedViewer({ trace, tracePath, params, theme, toggleTheme }: ViewerProps & { trace: Trace }) {
  const presenting = params.has('present')
  const rawMode = params.has('raw')
  const animateMode = params.has('animate')
  const reveal = animateMode || presenting
  const showEnv = !params.has('hideEnv')
  const showNotes = params.has('showNotes')
  const showLineEnv = params.has('showLineEnv')

  const [outlineOpen, setOutlineOpen] = usePreference('outline', window.innerWidth >= 1200)
  const [readingZoom, setReadingZoom] = usePreference('zoom', 1)
  const [presentingZoom, setPresentingZoom] = usePreference('presentZoom', 1.3)
  const [zoom, setZoom] = presenting ? [presentingZoom, setPresentingZoom] : [readingZoom, setReadingZoom]
  const chromeVisible = usePresentingChrome(presenting)
  const [helpOpen, setHelpOpen] = useState(false)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  const scrollRef = useRef<HTMLElement>(null)

  const index = useMemo(() => indexTrace(trace), [trace])
  const numSteps = trace.steps.length

  const { stepIndex, path, lineNumber } = resolvePosition(trace, index, params)
  const baseStep = stepIndex ?? 0

  const goToStep = useCallback((i: number) => {
    if (i >= 0 && i < numSteps) updateParams({ step: i, source: null, line: null })
  }, [numSteps])
  usePresenterSync(tracePath, stepIndex, goToStep)

  const actions: Actions = useMemo(() => ({
    forward: () => goToStep(baseStep + 1),
    backward: () => goToStep(baseStep - 1),
    overForward: () => goToStep(stepOverIndex(trace, baseStep, 1)),
    overBackward: () => goToStep(stepOverIndex(trace, baseStep, -1)),
    out: () => goToStep(stepOutIndex(trace, baseStep)),
    first: () => goToStep(0),
    last: () => goToStep(numSteps - 1),
    toggleRaw: () => updateParams({ raw: !rawMode }),
    toggleAnimate: () => updateParams({ animate: !animateMode }),
    toggleEnv: () => updateParams({ hideEnv: showEnv }),
    toggleNotes: () => updateParams({ showNotes: !showNotes }),
    toggleLineEnv: () => updateParams({ showLineEnv: !showLineEnv }),
    toggleOutline: () => setOutlineOpen((open) => !open),
    toggleHelp: () => setHelpOpen((open) => !open),
    zoomIn: () => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2))),
    zoomOut: () => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(2))),
    zoomReset: () => setZoom(1),
    home: () => updateParams({ trace: null, step: null, source: null, line: null }, { push: true }),
    toggleTheme,
    togglePresent: () => setPresenting(!presenting),
    openSpeaker: () => openSpeakerWindow(tracePath),
  }), [trace, tracePath, baseStep, numSteps, goToStep, rawMode, animateMode, presenting, showEnv, showNotes, showLineEnv, setOutlineOpen, setZoom, toggleTheme])

  useKeyboard(actions, () => {
    if (zoomedImage) setZoomedImage(null)
    else if (helpOpen) setHelpOpen(false)
    else if (presenting) setPresenting(false)
  })

  // Leaving fullscreen (e.g., with Esc) also leaves presenting
  useEffect(() => {
    const onFullscreenChange = () => { if (!document.fullscreenElement) updateParams({ present: null }) }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const context = useMemo(() => ({
    openSource: (sourcePath: string, line: number) => updateParams({ source: sourcePath, line, step: null }),
    zoomImage: setZoomedImage,
    theme,
  }), [theme])

  const onGutterClick = useCallback((line: number) => {
    const found = findStepAtLine(trace, baseStep, lineNumber, path, line)
    if (found !== null) goToStep(found)
    else updateParams({ source: path, line, step: null })
  }, [trace, baseStep, lineNumber, path, goToStep])

  const title = index.title || (tracePath.split('/').pop() ?? tracePath).replace(/\.json$/, '')
  useEffect(() => { document.title = `${title} · ${SITE_TITLE}` }, [title])

  const { lines, displayLine } = useLineModels(trace, index, path, rawMode)
  const currentLine = displayLine(lineNumber, showNotes)
  const lineEnvs = useMemo(
    () => showLineEnv ? lineEnvsFor(trace, path, reveal ? baseStep : numSteps - 1) : null,
    [showLineEnv, trace, path, reveal, baseStep, numSteps],
  )

  // Keep the current line in view
  useLayoutEffect(() => {
    if (scrollRef.current) scrollToCurrent(scrollRef.current)
  }, [path, currentLine, stepIndex])

  // Presenting and zooming reflow the page (and hide unreached lines), so find the current line again
  useLayoutEffect(() => {
    if (scrollRef.current) scrollToCurrent(scrollRef.current, 'instant')
  }, [presenting, zoom])

  // While presenting, also follow layout changes: going fullscreen, plots finishing loading
  useEffect(() => {
    const container = scrollRef.current
    if (!presenting || !container) return
    const observer = new ResizeObserver(() => scrollToCurrent(container, 'instant'))
    observer.observe(container)
    if (container.firstElementChild) observer.observe(container.firstElementChild)
    return () => observer.disconnect()
  }, [presenting])

  const activeOutline = stepIndex === null ? -1 : index.outline.findLastIndex((entry) => entry.step <= stepIndex)

  return (
    <ViewerContext.Provider value={context}>
      <div className={`viewer${presenting ? ' presenting' : ''}${chromeVisible ? ' chrome-visible' : ''}`}>
        {presenting && (
          <div className="present-progress"><div style={{ width: `${(baseStep / Math.max(1, numSteps - 1)) * 100}%` }} /></div>
        )}
        <TopBar
          title={title}
          path={path}
          stepIndex={stepIndex}
          numSteps={numSteps}
          outline={index.outline}
          actions={actions}
          goToStep={goToStep}
          flags={{ rawMode, animateMode, showEnv, showNotes, showLineEnv, outlineOpen, helpOpen, presenting }}
          theme={theme}
        />

        {outlineOpen && !presenting && (
          <Outline entries={index.outline} activeIndex={activeOutline} currentStep={stepIndex} onSelect={goToStep} />
        )}

        <main className="lecture" ref={scrollRef} style={{ '--zoom': zoom }}>
          <article className="lecture-body">
            {lines.map((line) => (
              <Line
                key={line.number}
                line={line}
                isCurrent={line.number === currentLine}
                cloaked={reveal && stepIndex !== null && (index.firstVisible.get(locationKey(path, line.number)) ?? Infinity) > stepIndex}
                env={lineEnvs?.get(line.number)}
                showNotes={showNotes}
                onGutterClick={onGutterClick}
              />
            ))}
          </article>
        </main>

        {showEnv && !presenting && <Inspector trace={trace} stepIndex={stepIndex} onClose={actions.toggleEnv} />}
      </div>

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {zoomedImage && <Lightbox src={zoomedImage} onClose={() => setZoomedImage(null)} />}
    </ViewerContext.Provider>
  )
}

interface LineProps {
  line: LineModel
  isCurrent: boolean
  cloaked: boolean
  env: Env | undefined
  showNotes: boolean
  onGutterClick: (lineNumber: number) => void
}

const Line = memo(function Line({ line, isCurrent, cloaked, env, showNotes, onGutterClick }: LineProps) {
  const classes = ['line', `line-${line.kind}`]
  if (line.inCode) classes.push('in-code')
  if (line.blockStart) classes.push('block-start')
  if (line.blockEnd) classes.push('block-end')
  if (isCurrent) classes.push('current')
  if (cloaked) classes.push('cloaked')
  const entries = env ? Object.entries(env).filter(([, value]) => value !== null) : []
  if (line.kind === 'note' && !showNotes) return null

  return (
    <div
      className={classes.join(' ')}
      data-current={isCurrent || undefined}
      style={{ '--indent': line.indent, '--block-indent': line.blockIndent ?? 0 }}
    >
      <button type="button" className="gutter" tabIndex={-1} onClick={() => onGutterClick(line.number)}>
        {line.number}
      </button>
      <div className="line-main">
        {line.kind === 'prose' && (
          <div className="prose"><LineRenderings renderings={line.renderings} /></div>
        )}
        {(line.kind === 'code' || line.kind === 'blank') && (
          <code className="code-text" dangerouslySetInnerHTML={{ __html: line.html || '​' }} />
        )}
        {entries.length > 0 && (
          <span className="line-env">
            {entries.map(([key, value]) => (
              <span className="line-env-item" key={key}>
                <span className="v-key">{key}</span><span className="v-punct">=</span><Value value={value} />
              </span>
            ))}
          </span>
        )}
        {showNotes && line.notes.length > 0 && (
          <div className="speaker-notes">
            {line.notes.map((note, i) => <div key={i}>{note}</div>)}
          </div>
        )}
      </div>
    </div>
  )
})

interface TopBarProps {
  title: string
  path: string
  stepIndex: number | null
  numSteps: number
  outline: OutlineEntry[]
  actions: Actions
  goToStep: (step: number) => void
  flags: Record<'rawMode' | 'animateMode' | 'showEnv' | 'showNotes' | 'showLineEnv' | 'outlineOpen' | 'helpOpen' | 'presenting', boolean>
  theme: Theme
}

function TopBar({ title, path, stepIndex, numSteps, outline, actions, goToStep, flags, theme }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-row">
        <div className="topbar-group topbar-left">
          <IconButton label="Outline" shortcut="o" pressed={flags.outlineOpen} onClick={actions.toggleOutline}><PanelLeft /></IconButton>
          <IconButton label="All lectures" shortcut="g" onClick={actions.home}><House /></IconButton>
          <div className="topbar-title">
            <span className="topbar-title-text">{title}</span>
            <span className="topbar-subtitle">{path}</span>
          </div>
        </div>

        <div className="topbar-group topbar-nav">
          <IconButton label="Step back over" shortcut="↑" onClick={actions.overBackward}><ChevronsLeft /></IconButton>
          <IconButton label="Step back" shortcut="⇧ Space / ←" onClick={actions.backward}><ArrowLeft /></IconButton>
          <span className="step-counter" title="Current step / total steps">
            <span className="step-current">{stepIndex === null ? '—' : stepIndex + 1}</span>
            <span className="step-total">/ {numSteps}</span>
          </span>
          <IconButton label="Step forward" shortcut="Space / →" onClick={actions.forward}><ArrowRight /></IconButton>
          <IconButton label="Step over" shortcut="↓" onClick={actions.overForward}><ChevronsRight /></IconButton>
          <IconButton label="Step out of function" shortcut="u" onClick={actions.out}><CornerLeftUp /></IconButton>
        </div>

        <div className="topbar-group topbar-right">
          <IconButton label="Reveal lines as you step" shortcut="a" pressed={flags.animateMode} onClick={actions.toggleAnimate}><Clapperboard /></IconButton>
          <IconButton label="Raw code" shortcut="r" pressed={flags.rawMode} onClick={actions.toggleRaw}><Code /></IconButton>
          <IconButton label="Inline values" shortcut="e" pressed={flags.showLineEnv} onClick={actions.toggleLineEnv}><Braces /></IconButton>
          <IconButton label="Speaker notes" shortcut="n" pressed={flags.showNotes} onClick={actions.toggleNotes}><StickyNote /></IconButton>
          <IconButton label="Variables panel" shortcut="v" pressed={flags.showEnv} onClick={actions.toggleEnv}><PanelRight /></IconButton>
          <span className="topbar-divider" />
          <IconButton label="Present" shortcut="p" pressed={flags.presenting} onClick={actions.togglePresent}><Presentation /></IconButton>
          <IconButton label="Speaker view (new window)" shortcut="s" onClick={actions.openSpeaker}><MonitorSpeaker /></IconButton>
          <IconButton label={theme === 'dark' ? 'Light mode' : 'Dark mode'} shortcut="t" onClick={actions.toggleTheme}>{theme === 'dark' ? <Sun /> : <Moon />}</IconButton>
          <IconButton label="Keyboard shortcuts" shortcut="/" pressed={flags.helpOpen} onClick={actions.toggleHelp}><Keyboard /></IconButton>
        </div>
      </div>
      <Scrubber stepIndex={stepIndex} numSteps={numSteps} outline={outline} goToStep={goToStep} />
    </header>
  )
}

interface IconButtonProps {
  label: string
  shortcut?: string
  pressed?: boolean
  onClick: () => void
  children: ReactNode
}

function IconButton({ label, shortcut, pressed, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      aria-pressed={pressed}
      data-tip={shortcut ? `${label}  ${shortcut}` : label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Progress bar that can be clicked or dragged to jump around; ticks mark sections. */
interface ScrubberProps {
  stepIndex: number | null
  numSteps: number
  outline: OutlineEntry[]
  goToStep: (step: number) => void
}

function Scrubber({ stepIndex, numSteps, outline, goToStep }: ScrubberProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const fraction = (i: number) => numSteps > 1 ? i / (numSteps - 1) : 1
  const stepAt = (event: PointerEvent) => {
    const box = ref.current!.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
    return Math.round(x * (numSteps - 1))
  }
  const hoverSection = hover === null ? undefined : outline.findLast((entry) => entry.step <= hover)

  return (
    <div
      ref={ref}
      className="scrubber"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        goToStep(stepAt(event))
      }}
      onPointerMove={(event) => {
        setHover(stepAt(event))
        if (event.buttons === 1) goToStep(stepAt(event))
      }}
      onPointerLeave={() => setHover(null)}
    >
      <div className="scrubber-track">
        <div className="scrubber-fill" style={{ width: `${fraction(stepIndex ?? 0) * 100}%` }} />
        {outline.filter((entry) => entry.level <= 2 || entry.code).map((entry) => (
          <span key={entry.step} className="scrubber-tick" style={{ left: `${fraction(entry.step) * 100}%` }} />
        ))}
      </div>
      {hover !== null && (
        <div className="scrubber-tip" style={{ left: `${fraction(hover) * 100}%` }}>
          <span className="scrubber-tip-step">{hover + 1}</span>
          {hoverSection && <span className="scrubber-tip-section">{hoverSection.text}</span>}
        </div>
      )}
    </div>
  )
}

/** Scroll the current line to the middle of the view, unless it's already comfortably visible. */
function scrollToCurrent(container: HTMLElement, behavior?: ScrollBehavior) {
  const element = container.querySelector('[data-current]')
  if (!element) return
  const box = element.getBoundingClientRect()
  const view = container.getBoundingClientRect()
  const margin = Math.min(120, view.height / 4)
  if (box.top >= view.top + margin && box.bottom <= view.bottom - margin) return
  const distance = Math.min(Math.abs(box.top - view.top), Math.abs(box.bottom - view.bottom))
  element.scrollIntoView({ block: 'center', behavior: behavior ?? (distance < view.height ? 'smooth' : 'instant') })
}

/** Enter presenting (fullscreen, reveal as you step, no side panels) or leave it. */
function setPresenting(on: boolean) {
  updateParams({ present: on })
  if (on) document.documentElement.requestFullscreen?.().catch(() => {})
  else if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
}

/** While presenting, the top bar hides until the mouse moves near the top of the screen. */
function usePresentingChrome(presenting: boolean): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!presenting) return
    const onMove = (event: MouseEvent) => setVisible(event.clientY < 72)
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      setVisible(false)
    }
  }, [presenting])
  return presenting && visible
}
