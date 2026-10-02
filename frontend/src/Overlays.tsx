import { X } from 'lucide-react'

const SHORTCUTS: [string, [string[], string][]][] = [
  ['Navigate', [
    [['Space', '→'], 'Step forward (into functions)'],
    [['⇧ Space', '←'], 'Step backward'],
    [['↓'], 'Step over (stay in this function)'],
    [['↑'], 'Step back over'],
    [['u'], 'Step out of the current function'],
    [['⌘↑', 'Home'], 'First step'],
    [['⌘↓', 'End'], 'Last step'],
    [['g'], 'All lectures'],
  ]],
  ['Present', [
    [['p'], 'Present: fullscreen, reveal as you step (Esc to leave)'],
    [['s'], 'Speaker view in a new window (notes, next step, timer)'],
  ]],
  ['View', [
    [['a'], 'Reveal lines as you step (presenting)'],
    [['r'], 'Raw code instead of rendered text'],
    [['e'], 'Inspected values inline'],
    [['v'], 'Variables panel'],
    [['n'], 'Speaker notes'],
    [['o'], 'Outline'],
    [['+', '−', '0'], 'Zoom in / out / reset'],
    [['t'], 'Light / dark theme'],
    [['/', '?'], 'Keyboard shortcuts'],
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
        <p className="dialog-footnote">Letter shortcuts work without Shift. On a Mac, ⌘ is Command and ⇧ is Shift. Shift+arrows, h/j/k/l, and presentation clickers still work. Shortcuts pause while typing in a field.</p>
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
