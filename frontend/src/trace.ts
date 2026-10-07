/** Pure functions over a trace (see types.ts for the format). */

import { statementEnd } from './code'
import type { Env, Rendering, StackElement, Step, Trace } from './types'

export interface OutlineEntry {
  level: number
  text: string
  /** Function entries render as code */
  code?: boolean
  step: number
  path: string
  lineNumber: number
}

export interface TraceIndex {
  /** location -> renderings of the last step there that produced any */
  renderings: Map<string, Rendering[]>
  /** location -> every step there that produced renderings, in order (a line run in a loop has several) */
  frames: Map<string, Frame[]>
  /** location -> step at which the line is revealed (animate mode) */
  firstVisible: Map<string, number>
  outline: OutlineEntry[]
  title: string | null
  mainPath: string
}

/** What one line rendered at one step */
export interface Frame {
  step: number
  renderings: Rendering[]
}

export const last = <T,>(xs: T[]): T => xs[xs.length - 1]
export const locationKey = (path: string, lineNumber: number) => `${path}:${lineNumber}`
export const topOf = (step: Step): StackElement => last(step.stack)

/** Whether two stacks are in the same function call (all but the last frame agree). */
export function inSameFunction(stack1: StackElement[], stack2: StackElement[]): boolean {
  if (stack1.length !== stack2.length) return false
  for (let i = 0; i < stack1.length - 1; i++) {
    if (stack1[i].path !== stack2[i].path || stack1[i].line_number !== stack2[i].line_number) return false
  }
  return true
}

export const isStrictAncestorOf = (stack1: StackElement[], stack2: StackElement[]) => stack1.length < stack2.length

/**
 * Whether `stack` is at the start of a function call: the def line of the
 * function being run (as opposed to a nested def statement in the caller).
 */
function isFunctionCall(stack: StackElement[]): boolean {
  const item = last(stack)
  const match = (item.code || '').match(/^\s*(?:async\s+)?def\s+(\w+)/)
  return match !== null && match[1] === item.function_name
}

/** Next step (in `direction`) at this level of the stack; may be out of bounds. */
export function stepOverIndex(trace: Trace, stepIndex: number, direction: 1 | -1): number {
  const stack = trace.steps[stepIndex].stack
  let i = stepIndex + direction
  while (i >= 0 && i < trace.steps.length) {
    const other = trace.steps[i].stack
    if (inSameFunction(other, stack) || isStrictAncestorOf(other, stack)) return i
    i += direction
  }
  return i
}

const showsNothing = (step: Step) => step.renderings.length === 0 && Object.keys(step.env).length === 0

/** Whether a step only adds speaker notes (so, with notes hidden, nothing changes on screen). */
const isNoteOnly = (step: Step) =>
  step.renderings.length > 0 && step.renderings.every((r) => r.type === 'note') && Object.keys(step.env).length === 0

/**
 * Whether a step only navigates between functions, showing nothing new: the line that
 * calls a function (when the next step enters it), its def line, or a return statement.
 */
function isCallNavigation(trace: Trace, i: number): boolean {
  const step = trace.steps[i]
  if (!showsNothing(step)) return false
  if (isFunctionCall(step.stack) || /^\s*return\b/.test(last(step.stack).code ?? '')) return true
  const next = trace.steps[i + 1]
  return next !== undefined && next.stack.length === step.stack.length + 1 && isFunctionCall(next.stack)
}

/**
 * Move past steps that wouldn't change what's on screen: calling into a function (its call
 * line and def line) and, when notes are hidden, steps that only add a note.
 */
export function skipQuietSteps(
  trace: Trace, stepIndex: number, direction: 1 | -1, skip: { calls: boolean, notes: boolean },
): number {
  const quiet = (i: number) => (skip.calls && isCallNavigation(trace, i)) || (skip.notes && isNoteOnly(trace.steps[i]))
  let i = stepIndex
  while (i > 0 && i < trace.steps.length - 1 && quiet(i)) i += direction
  return i
}

/** First step after we've returned out of the current function; may be out of bounds. */
export function stepOutIndex(trace: Trace, stepIndex: number): number {
  const stack = trace.steps[stepIndex].stack
  let i = stepIndex + 1
  while (i < trace.steps.length) {
    const other = trace.steps[i].stack
    if (!inSameFunction(other, stack) && isStrictAncestorOf(other, stack)) return i
    i++
  }
  return i
}

/**
 * Step that executes `path:lineNumber`, searching forward if the line is below
 * the current one and backward otherwise.  Returns null if there is none.
 */
export function findStepAtLine(
  trace: Trace, fromStep: number, currentLine: number, path: string, lineNumber: number,
): number | null {
  const matches = (i: number) => {
    const item = topOf(trace.steps[i])
    return item.path === path && item.line_number === lineNumber
  }
  if (currentLine <= lineNumber) {
    for (let i = fromStep + 1; i < trace.steps.length; i++) if (matches(i)) return i
  } else {
    for (let i = fromStep; i >= 0; i--) if (matches(i)) return i
  }
  return null
}

const HEADING = /^(#{1,6})\s+(.+?)\s*#*$/

const headingOf = (rendering: Rendering) =>
  rendering.type === 'markdown' && typeof rendering.data === 'string' ? HEADING.exec(rendering.data.trim()) : null

/** One-time pass over the trace computing everything that doesn't depend on the current step. */
export function indexTrace(trace: Trace): TraceIndex {
  const renderings = new Map<string, Rendering[]>()
  const frames = new Map<string, Frame[]>()
  const firstVisible = new Map<string, number>()
  const headings: OutlineEntry[] = []
  const functions: OutlineEntry[] = []
  const seen = new Set<string>()
  const sourceLines: Record<string, string[]> = {}
  const linesOf = (path: string) => (sourceLines[path] ??= (trace.files[path] ?? '').split('\n'))

  trace.steps.forEach((step, stepIndex) => {
    const { path, line_number: lineNumber, function_name: functionName } = topOf(step)
    const key = locationKey(path, lineNumber)

    if (step.renderings.length > 0) {
      renderings.set(key, step.renderings)
      let list = frames.get(key)
      if (!list) frames.set(key, list = [])
      list.push({ step: stepIndex, renderings: step.renderings })
      const heading = step.renderings.map(headingOf).find((match) => match !== null)
      if (heading && !seen.has(key)) {
        seen.add(key)
        headings.push({ level: heading[1].length, text: heading[2], step: stepIndex, path, lineNumber })
      }
    }

    if (isFunctionCall(step.stack) && functionName !== 'main' && !seen.has(key)) {
      seen.add(key)
      functions.push({ level: 3, text: `${functionName}()`, code: true, step: stepIndex, path, lineNumber })
    }

    // Reveal this line's statement (all of its lines) and the lines above it, up to an unindented one (e.g., the def)
    const lines = linesOf(path)
    for (let n = statementEnd(lines, lineNumber - 1) + 1; n > lineNumber; n--) {
      const k = locationKey(path, n)
      if (!firstVisible.has(k)) firstVisible.set(k, stepIndex)
    }
    for (let n = lineNumber; n >= 1; n--) {
      const k = locationKey(path, n)
      if (firstVisible.has(k)) break
      firstVisible.set(k, stepIndex)
      if (/^\w/.test(lines[n - 1] ?? '')) break
    }
  })

  // Lectures structured with headings get a heading outline; otherwise fall back to functions
  const outline = headings.length > 1
    ? headings
    : [...headings, ...functions].sort((a, b) => a.step - b.step)
  const titleHeading = headings.find((h) => h.level <= 2)
  const mainPath = trace.steps.length > 0 ? topOf(trace.steps[0]).path : Object.keys(trace.files)[0]

  return { renderings, frames, firstVisible, outline, title: titleHeading?.text ?? null, mainPath }
}

/** Variables (of the current function call) at `stepIndex`. */
export function envAt(trace: Trace, stepIndex: number): Env {
  const stack = trace.steps[stepIndex].stack
  const envs: Env[] = []
  for (let i = stepIndex; i >= 0; i--) {
    const step = trace.steps[i]
    if (inSameFunction(step.stack, stack)) {
      if (Object.keys(step.env).length > 0) envs.push(step.env)
    } else if (isStrictAncestorOf(step.stack, stack)) {
      break
    }
  }
  const env: Env = Object.assign({}, ...envs.reverse())
  for (const key in env) if (env[key] === null) delete env[key]
  return env
}

/**
 * For each line of `path`, the values inspected on its most recent execution up
 * to `uptoStep`.  Values are cleared when the enclosing function is called again.
 */
export function lineEnvsFor(trace: Trace, path: string, uptoStep: number): Map<number, Env> {
  const lineToEnv = new Map<number, Env>()
  const lineToFunction = new Map<number, string>()
  const functionAtDepth: string[] = []
  for (let i = 0; i <= uptoStep; i++) {
    const stack = trace.steps[i].stack
    const item = last(stack)
    const depth = stack.length - 1
    if (isFunctionCall(stack)) {
      const fn = locationKey(item.path, item.line_number)
      functionAtDepth[depth] = fn
      for (const [line, owner] of lineToFunction) {
        if (owner === fn) {
          lineToEnv.delete(line)
          lineToFunction.delete(line)
        }
      }
    }
    if (item.path === path && Object.keys(trace.steps[i].env).length > 0) {
      lineToEnv.set(item.line_number, trace.steps[i].env)
      lineToFunction.set(item.line_number, functionAtDepth[depth])
    }
  }
  return lineToEnv
}

/** Where to fetch a trace: `lecture_01` is shorthand for `var/traces/lecture_01.json`. */
export function traceUrl(tracePath: string): string {
  return tracePath.endsWith('.json') ? tracePath : `var/traces/${tracePath}.json`
}

export interface Position {
  /** null when showing a line (from a link) that never executes */
  stepIndex: number | null
  path: string
  lineNumber: number
}

/** Where the URL says we are: a step, or (after following a link) a source line. */
export function resolvePosition(trace: Trace, index: TraceIndex, params: URLSearchParams): Position {
  const targetStep = parseInt(params.get('step') ?? '')
  const targetLine = parseInt(params.get('line') ?? '')
  if (!Number.isNaN(targetStep) || Number.isNaN(targetLine)) {
    const stepIndex = Math.max(0, Math.min(Number.isNaN(targetStep) ? 0 : targetStep, trace.steps.length - 1))
    const { path, line_number: lineNumber } = topOf(trace.steps[stepIndex])
    return { stepIndex, path, lineNumber }
  }
  const path = params.get('source') || index.mainPath
  const found = trace.steps.findIndex((step) => topOf(step).path === path && topOf(step).line_number === targetLine)
  return { stepIndex: found === -1 ? null : found, path, lineNumber: targetLine }
}
