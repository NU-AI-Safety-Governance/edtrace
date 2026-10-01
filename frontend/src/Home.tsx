import { useEffect, useState } from 'react'
import { ArrowRight, Moon, Sun } from 'lucide-react'
import { updateParams } from './url'
import { SITE_TITLE, type Theme } from './context'
import type { LectureSummary } from './types'

const open = (trace: string) => updateParams({ trace }, { push: true })

/** Lists the lectures in var/traces/index.json (written by `python -m edtrace.execute`). */
export default function Home({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  const [lectures, setLectures] = useState<LectureSummary[] | null>(null)
  const [path, setPath] = useState('')

  useEffect(() => {
    document.title = SITE_TITLE
    fetch('var/traces/index.json', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : { lectures: [] })
      .then((manifest: { lectures?: LectureSummary[] }) => setLectures(manifest.lectures ?? []))
      .catch(() => setLectures([]))
  }, [])

  return (
    <div className="home">
      <header className="home-header">
        <h1>{SITE_TITLE}</h1>
        <button type="button" className="icon-button" aria-label="Toggle theme" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
      </header>

      {lectures === null ? null : lectures.length === 0 ? (
        <p className="muted">
          No lectures yet. Run <code>python -m edtrace.execute -m lecture_01</code> to generate one.
        </p>
      ) : (
        <ol className="lecture-list">
          {lectures.map((lecture) => (
            <li key={lecture.module}>
              <a className="lecture-card" href={`?trace=${encodeURIComponent(lecture.module)}`} onClick={(e) => { e.preventDefault(); open(lecture.module) }}>
                <span className="lecture-card-module">{lecture.module}</span>
                <span className="lecture-card-title">{lecture.title || lecture.module}</span>
                <span className="lecture-card-meta">
                  {lecture.steps.toLocaleString()} steps
                  {lecture.updated && <> · updated {new Date(lecture.updated).toLocaleDateString()}</>}
                </span>
                <ArrowRight className="lecture-card-arrow" size={18} />
              </a>
            </li>
          ))}
        </ol>
      )}

      <form className="open-form" onSubmit={(e) => { e.preventDefault(); if (path.trim()) open(path.trim()) }}>
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="Open a trace by name or path, e.g. lecture_01 or var/traces/lecture_01.json"
          aria-label="Trace name or path"
        />
        <button type="submit" className="button">Open</button>
      </form>
    </div>
  )
}
