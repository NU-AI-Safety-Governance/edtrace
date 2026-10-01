import { createContext } from 'react'

export const SITE_TITLE: string = import.meta.env.VITE_EDTRACE_SITE_TITLE || 'Lectures'

export type Theme = 'light' | 'dark'

/** Actions that renderings can trigger in the viewer. */
export interface ViewerActions {
  openSource: (path: string, lineNumber: number) => void
  zoomImage: (src: string) => void
  theme: Theme
}

export const ViewerContext = createContext<ViewerActions>({
  openSource: () => {},
  zoomImage: () => {},
  theme: 'light',
})
