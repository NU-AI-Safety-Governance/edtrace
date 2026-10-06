import { lazy, Suspense, useContext, useState, type CSSProperties, type ReactNode } from 'react'
import { CornerDownRight, Info, Lightbulb, MessageSquareWarning, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { ViewerContext } from './context'
import { blockMarkdown, classifyLine, inlineMarkdown, type CalloutVariant } from './markdown'
import type { CardData, CodeLocation, Reference, Rendering as RenderingData } from './types'

// Vega is big, so only load it for lectures that actually have plots
const VegaEmbed = lazy(() => import('react-vega').then((module) => ({ default: module.VegaEmbed })))

const MEDIA_TYPES = new Set(['image', 'video', 'plot'])

const CALLOUTS: Record<CalloutVariant, { icon: LucideIcon; label: string }> = {
  note: { icon: Info, label: 'Note' },
  tip: { icon: Lightbulb, label: 'Tip' },
  important: { icon: MessageSquareWarning, label: 'Important' },
  warning: { icon: TriangleAlert, label: 'Warning' },
  caution: { icon: OctagonAlert, label: 'Caution' },
}

type Style = CSSProperties | undefined

const isVerbatim = (rendering: RenderingData) => rendering.style?.whiteSpace === 'pre'

/**
 * Renders everything produced by one line of a lecture (text, links, images, ...)
 * as a single block whose shape (heading, bullet, callout, ...) is decided by
 * the leading markdown of the first rendering.
 */
export function LineRenderings({ renderings }: { renderings: RenderingData[] }) {
  if (renderings.every((r) => r.type === 'card')) {
    return <div className="card-stack">{renderings.map((r, i) => <Card key={i} card={r.data as CardData} style={r.style ?? undefined} />)}</div>
  }
  if (renderings.every((r) => MEDIA_TYPES.has(r.type))) {
    return <div className="media-row">{renderings.map((r, i) => <Rendering key={i} rendering={r} />)}</div>
  }

  const [first, ...rest] = renderings
  if (first.type !== 'markdown' || isVerbatim(first)) {
    return <div className="prose-p">{renderings.map((r, i) => <Rendering key={i} rendering={r} />)}</div>
  }

  const shape = classifyLine(String(first.data))
  if (shape.kind === 'block') {
    return (
      <div className="prose-block">
        <div className="markdown-block" style={first.style ?? undefined} dangerouslySetInnerHTML={{ __html: blockMarkdown(shape.rest) }} />
        {rest.map((r, i) => <Rendering key={i} rendering={r} />)}
      </div>
    )
  }

  const content: ReactNode[] = [
    shape.rest && <Rendering key="first" rendering={{ ...first, data: shape.rest }} />,
    ...rest.map((r, i) => <Rendering key={i} rendering={r} />),
  ]

  switch (shape.kind) {
    case 'heading': {
      const Heading = `h${shape.level}` as 'h1'
      return <Heading className={`prose-heading prose-h${shape.level}`}>{content}</Heading>
    }
    case 'bullet':
    case 'ordered':
      return (
        <div className={`prose-item prose-${shape.kind}`} style={{ '--depth': shape.depth }}>
          <span className="prose-marker" aria-hidden="true">{shape.kind === 'ordered' ? shape.marker : ''}</span>
          <div className="prose-item-body">{content}</div>
        </div>
      )
    case 'callout': {
      const { icon: Icon, label } = CALLOUTS[shape.variant]
      return (
        <div className={`callout callout-${shape.variant}`}>
          <div className="callout-title"><Icon size={15} strokeWidth={2.25} />{label}</div>
          {shape.rest || rest.length ? <div className="callout-body">{content}</div> : null}
        </div>
      )
    }
    case 'quote':
      return <blockquote className="prose-quote">{content}</blockquote>
    case 'rule':
      return <hr className="prose-rule" />
    default:
      return <div className="prose-p">{content}</div>
  }
}

function Rendering({ rendering }: { rendering: RenderingData }) {
  const { type, data } = rendering
  const style = rendering.style ?? undefined
  switch (type) {
    case 'markdown':
      if (isVerbatim(rendering)) return <span className="verbatim" style={style}>{String(data)}</span>
      return <span className="markdown" style={style} dangerouslySetInnerHTML={{ __html: inlineMarkdown(String(data)) }} />
    case 'image':
      return <Figure src={String(data)} style={style} />
    case 'video':
      return <video className="figure-media" controls style={style}><source src={String(data)} /></video>
    case 'card':
      return <Card card={data as CardData} style={style} />
    case 'plot':
      return <Plot spec={data as object} style={style} />
    case 'link':
      if (rendering.internal_link) return <SourceLink location={rendering.internal_link} label={data as string | null} style={style} />
      if (rendering.external_link) return <Citation reference={rendering.external_link} label={data as string | null} style={style} />
      return null
    default:
      return <span style={style}>{String(data ?? '')}</span>
  }
}

function Card({ card, style }: { card: CardData; style: Style }) {
  return (
    <section className="card" style={style}>
      {card.eyebrow && <div className="card-eyebrow">{card.eyebrow}</div>}
      <h4 className="card-title" dangerouslySetInnerHTML={{ __html: inlineMarkdown(card.title) }} />
      {card.body && <div className="card-body markdown-block" dangerouslySetInnerHTML={{ __html: blockMarkdown(card.body) }} />}
      {(card.tags?.length || card.sources?.length) ? (
        <div className="card-footer">
          {card.tags?.map((tag) => <span key={tag} className="card-tag">{tag}</span>)}
          {card.sources?.map((source, i) => <Citation key={i} reference={source} label={source.title ?? null} style={undefined} />)}
        </div>
      ) : null}
      {card.caveat && (
        <div className="card-caveat"><TriangleAlert size={14} strokeWidth={2.25} /><span dangerouslySetInnerHTML={{ __html: inlineMarkdown(card.caveat) }} /></div>
      )}
    </section>
  )
}

function Figure({ src, style }: { src: string; style: Style }) {
  const { zoomImage } = useContext(ViewerContext)
  return (
    <button type="button" className="figure" onClick={() => zoomImage(src)} title="Click to enlarge">
      <img className="figure-media" src={src} style={style} alt="" />
    </button>
  )
}

function Plot({ spec, style }: { spec: object; style: Style }) {
  const { theme } = useContext(ViewerContext)
  return (
    <div className="plot" style={style}>
      <Suspense fallback={<div className="plot-loading">Loading plot…</div>}>
        <VegaEmbed spec={spec as never} options={{ actions: false, renderer: 'svg', theme: theme === 'dark' ? 'dark' : undefined, config: { font: 'Poppins, system-ui, sans-serif' } }} />
      </Suspense>
    </div>
  )
}

function SourceLink({ location, label, style }: { location: CodeLocation; label: string | null; style: Style }) {
  const { openSource } = useContext(ViewerContext)
  return (
    <button
      type="button"
      className="source-link"
      style={style}
      onClick={() => openSource(location.path, location.line_number)}
      title={`${location.path}:${location.line_number}`}
    >
      <CornerDownRight size={13} strokeWidth={2.25} />
      {label || `${location.path}:${location.line_number}`}
    </button>
  )
}

function Citation({ reference, label, style }: { reference: Reference; label: string | null; style: Style }) {
  const [alignRight, setAlignRight] = useState(false)
  const text = (label || reference.title || reference.url || '?').replace(/^\[(.*)\]$/, '$1')
  const hasDetails = reference.title || reference.authors || reference.description || reference.notes

  return (
    <span
      className="cite"
      onMouseEnter={(e) => {
        const bounds = (e.currentTarget.closest('.lecture') ?? document.body).getBoundingClientRect()
        setAlignRight(e.currentTarget.getBoundingClientRect().left > bounds.right - 500)
      }}
    >
      <a className="cite-chip" href={reference.url ?? undefined} target="_blank" rel="noreferrer" style={style}>{text}</a>
      {hasDetails && (
        <span className={`cite-card${alignRight ? ' align-right' : ''}`} role="tooltip">
          {reference.title && <span className="cite-title">{reference.title}</span>}
          {(reference.organization || reference.authors) && (
            <span className="cite-meta">
              {reference.organization && <span className="cite-org">{reference.organization}</span>}
              {reference.authors && formatAuthors(reference.authors)}
            </span>
          )}
          {reference.date && <span className="cite-meta">{reference.date.split('T')[0]}</span>}
          {reference.description && <span className="cite-description">{reference.description}</span>}
          {reference.notes && <span className="cite-notes">{reference.notes}</span>}
          {reference.url && <span className="cite-url">{reference.url.replace(/^https?:\/\//, '')}</span>}
        </span>
      )}
    </span>
  )
}

function formatAuthors(authors: string[]): string {
  const max = 10
  if (authors.length <= max) return authors.join(', ')
  return `${authors.slice(0, max / 2).join(', ')}, … (${authors.length - max} more) …, ${authors.slice(-max / 2).join(', ')}`
}
