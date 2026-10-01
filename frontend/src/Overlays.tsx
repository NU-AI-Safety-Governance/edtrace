import { X } from 'lucide-react'

const SHORTCUTS: [string, [string[], string][]][] = [
  ['Navigate', [
    [['→', 'l'], 'Step forward (into functions)'],
    [['←', 'h'], 'Step backward'],
    [['⇧→', 'j', 'PgDn'], 'Step over (stay in this function)'],
    [['⇧←', 'k', 'PgUp'], 'Step back over'],
    [['u'], 'Step out of the current function'],
    [['Home', 'End'], 'First / last step'],
    [['g'], 'All lectures'],
  ]],
  ['Present', [
    [['P'], 'Present: fullscreen, reveal as you step (Esc to leave)'],
    [['S'], 'Speaker view in a new window (notes, next step, timer)'],
  ]],
  ['View', [
    [['A'], 'Reveal lines as you step (presenting)'],
    [['R'], 'Raw code instead of rendered text'],
    [['e'], 'Inspected values inline'],
    [['E'], 'Variables panel'],
    [['N'], 'Speaker notes'],
    [['o'], 'Outline'],
    [['+', '−', '0'], 'Zoom in / out / reset'],
    [['t'], 'Light / dark theme'],
  ]],
]

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Keyboard shortcuts</h2>
          <button type="button" className="panel-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="shortcut-groups">
          {SHORTCUTS.map(([group, rows]) => (
            <section key={group}>
              <h3>{group}</h3>
              <dl className="shortcuts">
                {rows.map(([keys, description]) => (
                  <div key={description} className="shortcut">
                    <dt>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</dt>
                    <dd>{description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <p className="dialog-footnote">Click a line number to jump to the step that runs it. Every position has its own URL.</p>
      </div>
    </div>
  )
}

export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="overlay lightbox" onClick={onClose}>
      <img src={src} alt="" />
    </div>
  )
}
