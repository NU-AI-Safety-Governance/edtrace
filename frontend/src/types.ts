/*
 * The trace format written by `python -m edtrace.execute`
 * (see backend/src/edtrace/execute.py and execute_util.py).
 */

import type { CSSProperties } from 'react'

export interface StackElement {
  path: string
  line_number: number
  function_name: string
  code: string | null
}

/** A serialized Python value. */
export interface Value {
  type: string
  contents: unknown
  /** For tensors/arrays (e.g., "torch.float32") */
  dtype?: string | null
  /** For tensors/arrays (e.g., [2, 3]) */
  shape?: number[] | null
}

/** Inspected variables; null means the variable was cleared (@clear). */
export type Env = Record<string, Value | null>

export interface Reference {
  title?: string | null
  authors?: string[] | null
  organization?: string | null
  date?: string | null
  url?: string | null
  description?: string | null
  notes?: string | null
}

export interface CodeLocation {
  path: string
  line_number: number
}

/** data of a card() rendering */
export interface CardData {
  title: string
  body?: string | null
  eyebrow?: string | null
  tags?: string[]
  sources?: Reference[]
  caveat?: string | null
}

export interface Rendering {
  /** markdown, image, video, link, plot, card, note (or text) */
  type: string
  data: unknown
  style?: CSSProperties | null
  external_link?: Reference | null
  internal_link?: CodeLocation | null
}

export interface Step {
  stack: StackElement[]
  env: Env
  renderings: Rendering[]
}

export interface Trace {
  files: Record<string, string>
  hidden_line_numbers: Record<string, number[]>
  steps: Step[]
}

/** An entry of var/traces/index.json. */
export interface LectureSummary {
  module: string
  title: string | null
  steps: number
  updated?: string
}
