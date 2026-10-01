import hljs from 'highlight.js/lib/core'
import python from 'highlight.js/lib/languages/python'

hljs.registerLanguage('python', python)

const DIRECTIVE = /@(?:inspect|clear|stepover|hide)\b/

/**
 * Remove edtrace directives from a source line:
 *   "x = 3  # @inspect x"         -> "x = 3"
 *   "x = 3  # Assign @inspect x"  -> "x = 3  # Assign"
 */
export function stripDirectives(line: string): string {
  const match = DIRECTIVE.exec(line)
  if (!match) return line
  const hash = line.lastIndexOf('#', match.index)
  if (hash === -1 || insideString(line, hash)) return line
  const comment = line.slice(hash + 1, match.index)
  return (comment.trim() ? line.slice(0, match.index) : line.slice(0, hash)).trimEnd()
}

/** Whether position `index` of `line` is inside a (single-line) string literal. */
function insideString(line: string, index: number): boolean {
  let quote: string | null = null
  for (let i = 0; i < index; i++) {
    const c = line[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
    } else if (c === '"' || c === "'") {
      quote = c
    }
  }
  return quote !== null
}

/**
 * Syntax-highlight Python source and split it into lines of HTML.  Spans that
 * cross a newline (e.g., docstrings) are closed and reopened so that every line
 * is well-formed on its own.
 */
export function highlightLines(source: string): string[] {
  const html = hljs.highlight(source, { language: 'python', ignoreIllegals: true }).value
  const lines: string[] = []
  const open: string[] = []
  let current = ''
  let lastIndex = 0
  const tokens = /<span[^>]*>|<\/span>|\n/g
  let match
  while ((match = tokens.exec(html))) {
    current += html.slice(lastIndex, match.index)
    lastIndex = tokens.lastIndex
    const token = match[0]
    if (token === '\n') {
      lines.push(current + '</span>'.repeat(open.length))
      current = open.join('')
    } else if (token === '</span>') {
      open.pop()
      current += token
    } else {
      open.push(token)
      current += token
    }
  }
  lines.push(current + html.slice(lastIndex))
  return lines
}

/**
 * Index of the last line of the statement starting at `lines[start]`, following
 * open brackets and (triple-quoted) strings onto later lines.
 */
export function statementEnd(lines: string[], start: number): number {
  let depth = 0
  let quote: string | null = null  // ', ", ''' or """ while inside a string
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    for (let j = 0; j < line.length; j++) {
      const c = line[j]
      if (quote) {
        if (c === '\\') j++
        else if (line.startsWith(quote, j)) { j += quote.length - 1; quote = null }
      } else if (c === '#') {
        break
      } else if (c === '"' || c === "'") {
        quote = line.startsWith(c.repeat(3), j) ? c.repeat(3) : c
        j += quote.length - 1
      } else if ('([{'.includes(c)) {
        depth++
      } else if (')]}'.includes(c)) {
        depth--
      }
    }
    if (quote?.length === 1) quote = null  // Unterminated single-line string; don't run away
    if (depth <= 0 && !quote && !line.trimEnd().endsWith('\\')) return i
  }
  return lines.length - 1
}

/** Remove up to `count` leading spaces from a line of highlighted HTML (skipping over tags). */
export function dedentHtml(html: string, count: number): string {
  let i = 0
  let removed = 0
  let out = ''
  while (i < html.length && removed < count) {
    if (html[i] === '<') {
      const end = html.indexOf('>', i)
      out += html.slice(i, end + 1)
      i = end + 1
    } else if (html[i] === ' ') {
      removed++
      i++
    } else {
      break
    }
  }
  return out + html.slice(i)
}

export function indentWidth(line: string): number {
  return line.match(/^[ \t]*/)![0].replace(/\t/g, '    ').length
}
