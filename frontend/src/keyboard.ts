import { useEffect } from 'react'

export type Actions = Record<
  | 'forward' | 'backward' | 'overForward' | 'overBackward' | 'out' | 'first' | 'last'
  | 'toggleRaw' | 'toggleAnimate' | 'toggleEnv' | 'toggleNotes' | 'toggleLineEnv' | 'toggleOutline' | 'toggleHelp'
  | 'zoomIn' | 'zoomOut' | 'zoomReset' | 'home' | 'toggleTheme' | 'togglePresent' | 'openSpeaker',
  () => void
>

type KeyInput = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey' | 'isComposing'>
type KeyAction = keyof Actions | 'escape'

const keyBindings: Readonly<Partial<Record<string, KeyAction>>> = {
  ArrowUp: 'overBackward', ArrowDown: 'overForward',
  l: 'forward', h: 'backward', j: 'overForward', k: 'overBackward',
  PageDown: 'forward', PageUp: 'backward',  // Presentation clickers advance like Space
  u: 'out', Home: 'first', End: 'last',
  a: 'toggleAnimate', A: 'toggleAnimate',
  r: 'toggleRaw', R: 'toggleRaw',
  v: 'toggleEnv', V: 'toggleEnv', E: 'toggleEnv',
  e: 'toggleLineEnv',
  n: 'toggleNotes', N: 'toggleNotes',
  o: 'toggleOutline', O: 'toggleOutline',
  t: 'toggleTheme', T: 'toggleTheme',
  g: 'home',
  '/': 'toggleHelp', '?': 'toggleHelp',
  p: 'togglePresent', P: 'togglePresent',
  s: 'openSpeaker', S: 'openSpeaker',
  '+': 'zoomIn', '=': 'zoomIn', '-': 'zoomOut', 0: 'zoomReset',
  Escape: 'escape',
}

/** Match lecture shortcuts while leaving browser commands and text composition alone. */
export function keyboardAction(event: KeyInput): KeyAction | undefined {
  if (event.isComposing || event.altKey || event.ctrlKey) return
  if (event.metaKey) {
    if (event.shiftKey) return
    if (event.key === 'ArrowUp') return 'first'
    if (event.key === 'ArrowDown') return 'last'
    return
  }
  if (event.key === ' ') return event.shiftKey ? 'backward' : 'forward'
  if (event.key === 'ArrowRight') return event.shiftKey ? 'overForward' : 'forward'
  if (event.key === 'ArrowLeft') return event.shiftKey ? 'overBackward' : 'backward'
  return Object.hasOwn(keyBindings, event.key) ? keyBindings[event.key] : undefined
}

/** Global keyboard shortcuts; any action left out is ignored. */
export function useKeyboard(actions: Partial<Actions>, onEscape: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]')) return
      const action = keyboardAction(event)
      const handler = action === 'escape' ? onEscape : action ? actions[action] : undefined
      if (!handler) return
      event.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions, onEscape])
}
