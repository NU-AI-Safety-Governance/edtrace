import { useCallback, useState } from 'react'
import Home from './Home'
import Viewer from './Viewer'
import type { Theme } from './context'
import { useSearchParams } from './url'

export default function App() {
  const params = useSearchParams()
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

  const toggleTheme = useCallback(() => {
    setTheme((previous) => {
      const next: Theme = previous === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      localStorage.setItem('edtrace:theme', next)
      return next
    })
  }, [])

  const tracePath = params.get('trace')
  if (!tracePath) return <Home theme={theme} toggleTheme={toggleTheme} />
  return <Viewer tracePath={tracePath} params={params} theme={theme} toggleTheme={toggleTheme} />
}
