import { Marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import 'katex/dist/katex.min.css'

const marked = new Marked({ gfm: true })
marked.use(markedKatex({ throwOnError: false }))

const openInNewTab = (html: string) => html.replace(/<a href=/g, '<a target="_blank" rel="noreferrer" href=')

const inlineCache = new Map<string, string>()
const blockCache = new Map<string, string>()

export function inlineMarkdown(text: string): string {
  let html = inlineCache.get(text)
  if (html === undefined) inlineCache.set(text, (html = openInNewTab(marked.parseInline(text, { async: false }))))
  return html
}

export function blockMarkdown(text: string): string {
  let html = blockCache.get(text)
  if (html === undefined) blockCache.set(text, (html = openInNewTab(marked.parse(text, { async: false }))))
  return html
}

const CALLOUT = /^>\s*\[!(note|tip|important|warning|caution)\]\s*/i

/**
 * Each text() call is one line of a lecture, so instead of treating it as a
 * markdown document we look at its leading syntax to decide what kind of block
 * the whole line is.  `rest` is the remaining inline content.
 */
export type CalloutVariant = 'note' | 'tip' | 'important' | 'warning' | 'caution'

export type LineShape =
  | { kind: 'block' | 'quote' | 'rule' | 'paragraph'; rest: string }
  | { kind: 'heading'; level: number; rest: string }
  | { kind: 'callout'; variant: CalloutVariant; rest: string }
  | { kind: 'bullet'; depth: number; rest: string }
  | { kind: 'ordered'; depth: number; marker: string; rest: string }

export function classifyLine(text: string): LineShape {
  let match: RegExpExecArray | null
  if (text.includes('\n') || /^\s*\|/.test(text) || /^\s*```/.test(text)) {
    return { kind: 'block', rest: text }
  }
  if ((match = /^(#{1,6})\s+(.*?)\s*#*$/.exec(text))) {
    return { kind: 'heading', level: match[1].length, rest: match[2] }
  }
  if ((match = CALLOUT.exec(text))) {
    return { kind: 'callout', variant: match[1].toLowerCase() as CalloutVariant, rest: text.slice(match[0].length) }
  }
  if ((match = /^>\s?/.exec(text))) {
    return { kind: 'quote', rest: text.slice(match[0].length) }
  }
  if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(text)) {
    return { kind: 'rule', rest: '' }
  }
  if ((match = /^(\s*)[-*+]\s+/.exec(text))) {
    return { kind: 'bullet', depth: Math.floor(match[1].length / 2), rest: text.slice(match[0].length) }
  }
  if ((match = /^(\s*)(\d+)[.)]\s+/.exec(text))) {
    return { kind: 'ordered', depth: Math.floor(match[1].length / 2), marker: `${match[2]}.`, rest: text.slice(match[0].length) }
  }
  return { kind: 'paragraph', rest: text }
}
