import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight, Pause, Play, TimerReset } from 'lucide-react'
import { SITE_TITLE, ViewerContext, type Theme } from './context'
import { useKeyboard } from './keyboard'
import { useLineModels, type LineModel } from './lines'
import { inlineMarkdown } from './markdown'
import { usePresenterSync } from './presenter'
import { LineRenderings } from './Renderings'
import { indexTrace, locationKey, resolvePosition, stepOverIndex, topOf } from './trace'
import type { Trace } from './types'
import { updateParams } from './url'

interface SpeakerViewProps {
  trace: Trace
  tracePath: string
  params: URLSearchParams
  theme: Theme
}

const noopContext = { openSource: () => {}, zoomImage: () => {} }

/**
 * Presenter's companion window: what's on screen now, what the next step
 * reveals, this section's speaker notes, and a timer.  Stays in sync with the
 * audience window (see presenter.ts).
 */
export default function SpeakerView({ trace, tracePath, params, theme }: SpeakerViewProps) {
  const index = useMemo(() => indexTrace(trace), [trace])
  const numSteps = trace.steps.length
  const { stepIndex, path, lineNumber } = resolvePosition(trace, index, params)
  const step = stepIndex ?? 0

  const goToStep = useCallback((i: number) => {
    if (i >= 0 && i < numSteps) updateParams({ step: i, source: null, line: null })
  }, [numSteps])
  usePresenterSync(tracePath, stepIndex, goToStep)

  const actions = {
    forward: () => goToStep(step + 1),
    backward: () => goToStep(step - 1),
    overForward: () => goToStep(stepOverIndex(trace, step, 1)),
    overBackward: () => goToStep(stepOverIndex(trace, step, -1)),
    first: () => goToStep(0),
    last: () => goToStep(numSteps - 1),
  }
  useKeyboard(actions, () => {})

  const { lines, displayLine } = useLineModels(trace, index, path, false)
  const lineAt = useMemo(() => new Map(lines.map((line) => [line.number, line])), [lines])
  const next = step + 1 < numSteps ? topOf(trace.steps[step + 1]) : null

  // Sections come from the outline; notes belong to the section in which their line is revealed
  const sectionIndex = index.outline.findLastIndex((entry) => entry.step <= step)
  const section = index.outline[sectionIndex]
  const nextSection = index.outline[sectionIndex + 1]
  const sectionStart = section?.step ?? 0
  const sectionEnd = nextSection?.step ?? numSteps
  const notes = lines
    .filter((line) => line.notes.length > 0)
    .map((line) => ({ line, revealedAt: index.firstVisible.get(locationKey(path, line.number)) ?? Infinity }))
    .filter(({ revealedAt }) => revealedAt >= sectionStart && revealedAt < sectionEnd)
    .sort((a, b) => a.revealedAt - b.revealedAt)

  const title = index.title ?? tracePath
  useEffect(() => { document.title = `Speaker · ${title} · ${SITE_TITLE}` }, [title])

  return (
    <ViewerContext.Provider value={{ ...noopContext, theme }}>
      <div className="speaker">
        <header className="speaker-header">
          <div className="speaker-title">
            <span className="speaker-eyebrow">Speaker view</span>
            <span className="speaker-lecture">{title}</span>
          </div>
          <div className="speaker-nav">
            <button type="button" className="icon-button" aria-label="Step back over" onClick={actions.overBackward}><ChevronsLeft /></button>
            <button type="button" className="icon-button" aria-label="Step back" onClick={actions.backward}><ArrowLeft /></button>
            <span className="step-counter"><span className="step-current">{step + 1}</span><span className="step-total">/ {numSteps}</span></span>
            <button type="button" className="icon-button" aria-label="Step forward" onClick={actions.forward}><ArrowRight /></button>
            <button type="button" className="icon-button" aria-label="Step over" onClick={actions.overForward}><ChevronsRight /></button>
          </div>
          <Timer />
        </header>
        <div className="speaker-progress"><div style={{ width: `${(step / Math.max(1, numSteps - 1)) * 100}%` }} /></div>

        <main className="speaker-body">
          <section className="speaker-column">
            <SpeakerPanel label="Now" detail={`${path}:${lineNumber}`} emphasis>
              <LinePreview line={lineAt.get(displayLine(lineNumber))} fallback={trace.steps[step] && topOf(trace.steps[step]).code} />
            </SpeakerPanel>
            <SpeakerPanel label="Next step" detail={next ? `${next.path}:${next.line_number}` : 'end of lecture'}>
              {next && <LinePreview line={next.path === path ? lineAt.get(displayLine(next.line_number)) : undefined} fallback={next.code} />}
            </SpeakerPanel>
          </section>

          <section className="speaker-column">
            <SpeakerPanel label="Section">
              <div className="speaker-section">
                {section ? <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(section.text) }} /> : <span className="muted">No outline</span>}
                {nextSection && <span className="speaker-next-section">Up next: <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(nextSection.text) }} /></span>}
              </div>
            </SpeakerPanel>
            <SpeakerPanel label="Notes">
              {notes.length === 0
                ? <p className="muted speaker-empty">No notes in this section. Add them with <code>note("...")</code>.</p>
                : (
                  <ol className="speaker-notes-list">
                    {notes.map(({ line, revealedAt }) => (
                      <li key={line.number} className={revealedAt <= step ? 'reached' : ''}>
                        {line.notes.map((note, i) => <p key={i}>{note}</p>)}
                      </li>
                    ))}
                  </ol>
                )}
            </SpeakerPanel>
          </section>
        </main>
      </div>
    </ViewerContext.Provider>
  )
}

function SpeakerPanel({ label, detail, emphasis, children }: { label: string; detail?: string; emphasis?: boolean; children: ReactNode }) {
  return (
    <div className={`speaker-panel${emphasis ? ' emphasis' : ''}`}>
      <div className="speaker-panel-label">{label}{detail && <span>{detail}</span>}</div>
      <div className="speaker-panel-body">{children}</div>
    </div>
  )
}

/** A single line as the audience sees it (renderings), or its code. */
function LinePreview({ line, fallback }: { line: LineModel | undefined; fallback?: string | null }) {
  if (line?.kind === 'prose') return <div className="prose speaker-prose"><LineRenderings renderings={line.renderings} /></div>
  if (line && line.kind !== 'blank') return <code className="code-text speaker-code" dangerouslySetInnerHTML={{ __html: line.html }} />
  return fallback ? <code className="code-text speaker-code">{fallback.trim()}</code> : <span className="muted">—</span>
}

function Timer() {
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = Math.max(0, (pausedAt ?? now) - startedAt)
  const format = (ms: number) => {
    const total = Math.floor(ms / 1000)
    const h = Math.floor(total / 3600)
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
    const s = String(total % 60).padStart(2, '0')
    return h ? `${h}:${m}:${s}` : `${m}:${s}`
  }
  const togglePause = () => {
    if (pausedAt === null) {
      setPausedAt(Date.now())
    } else {
      setStartedAt((start) => start + (Date.now() - pausedAt))
      setPausedAt(null)
    }
  }

  return (
    <div className="speaker-timer">
      <span className={`speaker-elapsed${pausedAt !== null ? ' paused' : ''}`}>{format(elapsed)}</span>
      <button type="button" className="icon-button" aria-label={pausedAt === null ? 'Pause timer' : 'Resume timer'} onClick={togglePause}>
        {pausedAt === null ? <Pause /> : <Play />}
      </button>
      <button type="button" className="icon-button" aria-label="Reset timer" onClick={() => { setStartedAt(Date.now()); setPausedAt(null) }}>
        <TimerReset />
      </button>
      <span className="speaker-clock">{new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
    </div>
  )
}
