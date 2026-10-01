import { useEffect, useMemo, useRef } from 'react'
import { X } from 'lucide-react'
import { inlineMarkdown } from './markdown'
import { envAt, type OutlineEntry } from './trace'
import type { Trace } from './types'
import { describeType, isStructured } from './valueFormat'
import { Value } from './Values'

interface OutlineProps {
  entries: OutlineEntry[]
  activeIndex: number
  currentStep: number | null
  onSelect: (step: number) => void
}

export function Outline({ entries, activeIndex, currentStep, onSelect }: OutlineProps) {
  const activeRef = useRef<HTMLButtonElement>(null)
  const minLevel = Math.min(...entries.map((entry) => entry.level))

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <nav className="panel outline" aria-label="Outline">
      <div className="panel-header"><span className="panel-title">Outline</span></div>
      {entries.length === 0
        ? <p className="panel-empty">Add headings like <code>text("## Section")</code> to build an outline.</p>
        : (
          <ol className="outline-list">
            {entries.map((entry, i) => (
              <li key={entry.step}>
                <button
                  type="button"
                  ref={i === activeIndex ? activeRef : null}
                  className={[
                    'outline-item',
                    i === activeIndex && 'active',
                    currentStep !== null && entry.step > currentStep && 'upcoming',
                  ].filter(Boolean).join(' ')}
                  style={{ '--depth': entry.level - minLevel }}
                  onClick={() => onSelect(entry.step)}
                >
                  {entry.code
                    ? <code>{entry.text}</code>
                    : <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(entry.text) }} />}
                </button>
              </li>
            ))}
          </ol>
        )}
    </nav>
  )
}

export function Inspector({ trace, stepIndex, onClose }: { trace: Trace; stepIndex: number | null; onClose: () => void }) {
  const env = useMemo(() => stepIndex === null ? {} : envAt(trace, stepIndex), [trace, stepIndex])
  const stack = stepIndex === null ? [] : trace.steps[stepIndex].stack
  const entries = Object.entries(env)

  return (
    <aside className="panel inspector" aria-label="Variables">
      <div className="panel-header">
        <span className="panel-title">Variables</span>
        <button type="button" className="panel-close" aria-label="Hide variables" onClick={onClose}><X size={15} /></button>
      </div>

      {stack.length > 0 && (
        <ol className="call-stack" aria-label="Call stack">
          {stack.map((frame, i) => (
            <li key={i} className={i === stack.length - 1 ? 'current' : ''}>
              <code>{frame.function_name}</code>
              <span className="call-stack-line">:{frame.line_number}</span>
            </li>
          ))}
        </ol>
      )}

      {entries.length === 0
        ? <p className="panel-empty">Nothing inspected here. Add <code># @inspect x</code> to a line to watch <code>x</code>.</p>
        : (
          <div className="variables">
            {entries.map(([name, value]) => (
              <div key={name} className={`variable${isStructured(value) ? ' structured' : ''}`}>
                <div className="variable-head">
                  <code className="variable-name">{name}</code>
                  <span className="variable-type">{describeType(value)}</span>
                </div>
                <div className="variable-value"><Value value={value} /></div>
              </div>
            ))}
          </div>
        )}
    </aside>
  )
}
