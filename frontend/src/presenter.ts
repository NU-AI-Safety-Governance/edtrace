import { useEffect, useRef } from 'react'

type PresenterMessage = { type: 'step'; step: number } | { type: 'hello' }

/**
 * Keeps every window showing `tracePath` (e.g., the audience view and the
 * speaker view) on the same step: whichever moves broadcasts, the rest follow.
 */
export function usePresenterSync(tracePath: string, stepIndex: number | null, goToStep: (step: number) => void) {
  const channelRef = useRef<BroadcastChannel | null>(null)
  const stepRef = useRef(stepIndex)
  const followingRef = useRef<number | null>(null)  // A step we moved to because another window did

  useEffect(() => {
    const channel = new BroadcastChannel(`edtrace:${tracePath}`)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<PresenterMessage>) => {
      const message = event.data
      if (message.type === 'step' && message.step !== stepRef.current) {
        followingRef.current = message.step
        goToStep(message.step)
      } else if (message.type === 'hello' && stepRef.current !== null) {
        channel.postMessage({ type: 'step', step: stepRef.current } satisfies PresenterMessage)
      }
    }
    // A newly opened window catches up with the others
    channel.postMessage({ type: 'hello' } satisfies PresenterMessage)
    return () => channel.close()
  }, [tracePath, goToStep])

  useEffect(() => {
    stepRef.current = stepIndex
    if (stepIndex === null) return
    if (followingRef.current === stepIndex) {
      followingRef.current = null
      return
    }
    channelRef.current?.postMessage({ type: 'step', step: stepIndex } satisfies PresenterMessage)
  }, [stepIndex])
}

/** Open (or focus) the speaker view for the current lecture in its own window. */
export function openSpeakerWindow(tracePath: string) {
  const params = new URLSearchParams(window.location.search)
  params.set('speaker', '1')
  params.delete('present')
  window.open(`${window.location.pathname}?${params}`, `edtrace-speaker:${tracePath}`, 'popup,width=1200,height=800')
}
