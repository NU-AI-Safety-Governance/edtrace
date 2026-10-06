import { useMemo } from 'react'
import { dedentHtml, highlightLines, indentWidth, statementEnd, stripDirectives } from './code'
import { locationKey, type Frame, type TraceIndex } from './trace'
import type { Rendering, Trace } from './types'

/**
 * Everything about the lines of `path` that doesn't depend on the current step:
 * what to show (code or renderings) and how lines group into code blocks.
 */
export interface LineModel {
  number: number
  /** note: a line that only has speaker notes */
  kind: 'prose' | 'code' | 'blank' | 'note'
  html: string
  indent: number
  renderings: Rendering[]
  /** Renderings over time, when the line ran (and rendered) at more than one step, e.g., a plot in a loop */
  frames?: Frame[]
  notes: string[]
  /** Part of a code block (code, or a blank line between code) */
  inCode?: boolean
  blockStart?: boolean
  blockEnd?: boolean
  blockIndent?: number
}

export interface LineModels {
  lines: LineModel[]
  /** Line number -> the line it is shown as (continuation lines of a multi-line call map to its first line) */
  displayLine: (lineNumber: number, showNotes?: boolean) => number
}

export function useLineModels(trace: Trace, index: TraceIndex, path: string, rawMode: boolean): LineModels {
  return useMemo(() => {
    const source = (trace.files[path] ?? '').replace(/\n$/, '').split('\n')
    const cleaned = rawMode ? source : source.map(stripDirectives)
    const html = highlightLines(cleaned.join('\n'))
    const hidden = new Set(trace.hidden_line_numbers?.[path] ?? [])

    const lines: LineModel[] = []
    const statementStart = new Map<number, number>()
    let continuationUntil = -1  // Rest of a multi-line text(...) or plot(...) call
    cleaned.forEach((text, i) => {
      const number = i + 1
      if (i <= continuationUntil) {
        statementStart.set(number, lines[lines.length - 1].number)
        return
      }
      if (hidden.has(number)) return
      const renderings = rawMode ? [] : [...index.renderings.get(locationKey(path, number)) ?? []]
      if (renderings.length > 0) {
        // A multi-line statement (e.g., text("...", ...), link(...)) shows as one line with all of its renderings
        continuationUntil = statementEnd(source, i)
        for (let n = number + 1; n <= continuationUntil + 1; n++) renderings.push(...index.renderings.get(locationKey(path, n)) ?? [])
      }
      const shown = renderings.filter((r) => r.type !== 'note')
      const lineFrames = rawMode ? undefined : index.frames.get(locationKey(path, number))
      const kind = shown.length > 0 ? 'prose' : renderings.length > 0 ? 'note' : text.trim() === '' ? 'blank' : 'code'
      lines.push({
        number,
        kind,
        html: html[i],
        indent: indentWidth(source[i]),
        renderings: shown,
        frames: lineFrames && lineFrames.length > 1
          ? lineFrames.map((f) => ({ step: f.step, renderings: f.renderings.filter((r) => r.type !== 'note') }))
          : undefined,
        notes: renderings.filter((r) => r.type === 'note').map((r) => String(r.data)),
      })
    })

    // Blank lines between two code lines belong to the same code block
    const isCode = (line: LineModel | undefined) => line?.kind === 'code'
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].kind !== 'blank') continue
      let j = i
      while (lines[j]?.kind === 'blank') j++
      const inBlock = isCode(lines[i - 1]) && isCode(lines[j])
      for (let k = i; k < j; k++) lines[k].inCode = inBlock
      i = j - 1
    }
    for (const line of lines) line.inCode ||= line.kind === 'code'
    lines.forEach((line, i) => {
      if (!line.inCode) return
      line.blockStart = !lines[i - 1]?.inCode
      line.blockEnd = !lines[i + 1]?.inCode
    })

    // Each code block sits at the indentation of its least indented line
    for (let start = 0; start < lines.length; start++) {
      if (!lines[start].blockStart) continue
      let end = start
      while (!lines[end].blockEnd) end++
      const block = lines.slice(start, end + 1)
      const blockIndent = Math.min(...block.filter((l) => l.kind === 'code').map((l) => l.indent))
      for (const line of block) {
        line.blockIndent = blockIndent
        line.html = dedentHtml(line.html, blockIndent)
      }
      start = end
    }
    return {
      lines,
      displayLine: (lineNumber: number, showNotes = true) => {
        const number = statementStart.get(lineNumber) ?? lineNumber
        if (!showNotes && lines.some((line) => line.number === number && line.kind === 'note')) {
          // Keep a visible anchor while stepping through hidden speaker notes.
          return lines.findLast((line) => line.number < number && line.kind !== 'note' && line.kind !== 'blank')?.number ?? number
        }
        return number
      },
    }
  }, [trace, index, path, rawMode])
}

/**
 * What a line shows at `step`: its latest frame so far, so a plot redrawn in a loop
 * animates as you step. Before the line has run, it shows its final renderings.
 */
export function renderingsAt(line: LineModel, step: number | null): Rendering[] {
  if (!line.frames || step === null) return line.renderings
  return line.frames.findLast((frame) => frame.step <= step)?.renderings ?? line.renderings
}
