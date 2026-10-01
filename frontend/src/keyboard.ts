import { useEffect } from 'react'

export type Actions = Record<
  | 'forward' | 'backward' | 'overForward' | 'overBackward' | 'out' | 'first' | 'last'
  | 'toggleRaw' | 'toggleAnimate' | 'toggleEnv' | 'toggleNotes' | 'toggleLineEnv' | 'toggleOutline' | 'toggleHelp'
  | 'zoomIn' | 'zoomOut' | 'zoomReset' | 'home' | 'toggleTheme' | 'togglePresent' | 'openSpeaker',
  () => void
>

/** Global keyboard shortcuts; any action left out is ignored. */
export function useKeyboard(actions: Partial<Actions>, onEscape: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if ((event.target as Element | null)?.closest?.('input, textarea, select, [contenteditable]')) return
      const { key, shiftKey } = event
      const handler = ({
        ArrowRight: shiftKey ? actions.overForward : actions.forward,
        ArrowLeft: shiftKey ? actions.overBackward : actions.backward,
        l: actions.forward,
        h: actions.backward,
        j: actions.overForward,
        k: actions.overBackward,
        PageDown: actions.overForward,  // Presentation clickers
        PageUp: actions.overBackward,
        u: actions.out,
        Home: actions.first,
        End: actions.last,
        A: actions.toggleAnimate,
        R: actions.toggleRaw,
        E: actions.toggleEnv,
        e: actions.toggleLineEnv,
        N: actions.toggleNotes,
        O: actions.toggleOutline,
        o: actions.toggleOutline,
        T: actions.toggleTheme,
        t: actions.toggleTheme,
        g: actions.home,
        '?': actions.toggleHelp,
        p: actions.togglePresent,
        P: actions.togglePresent,
        s: actions.openSpeaker,
        S: actions.openSpeaker,
        '+': actions.zoomIn,
        '=': actions.zoomIn,
        '-': actions.zoomOut,
        0: actions.zoomReset,
        Escape: onEscape,
      } as Record<string, (() => void) | undefined>)[key]
      if (!handler) return
      event.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions, onEscape])
}
