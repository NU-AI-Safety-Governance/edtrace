import { useMemo, useSyncExternalStore, useState, useCallback } from 'react'

/*
 * All viewer state that's worth sharing (trace, step, toggles) lives in the URL
 * query string, so any position in a lecture can be linked to.
 */

const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  window.addEventListener('popstate', callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('popstate', callback)
  }
}

export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, () => window.location.search)
  return useMemo(() => new URLSearchParams(search), [search])
}

/**
 * Apply `delta` to the query string (null/false deletes a key, true sets "1").
 * Stepping replaces the history entry; pass `push` for real navigation.
 */
export type ParamValue = string | number | boolean | null | undefined

export function updateParams(delta: Record<string, ParamValue>, { push = false } = {}) {
  const params = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(delta)) {
    if (value === null || value === undefined || value === false) {
      params.delete(key)
    } else {
      params.set(key, value === true ? '1' : String(value))
    }
  }
  const search = params.toString()
  const url = window.location.pathname + (search ? `?${search}` : '')
  window.history[push ? 'pushState' : 'replaceState'](null, '', url)
  listeners.forEach((callback) => callback())
}

/** A per-browser preference persisted in localStorage. */
export function usePreference<T>(key: string, defaultValue: T) {
  const storageKey = `edtrace:${key}`
  const [value, setValue] = useState<T>(() => {
    const saved = localStorage.getItem(storageKey)
    return saved === null ? defaultValue : (JSON.parse(saved) as T)
  })
  const update = useCallback((next: T | ((previous: T) => T)) => {
    setValue((previous) => {
      const resolved = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next
      localStorage.setItem(storageKey, JSON.stringify(resolved))
      return resolved
    })
  }, [storageKey])
  return [value, update] as const
}
