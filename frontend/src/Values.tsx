/*
 * Renders inspected values (see to_serializable_value in backend/src/edtrace/execute.py).
 */

import type { Value as ValueData } from './types'
import { formatNumber, isStructured, shortType, TENSOR_TYPES } from './valueFormat'

const MAX_CELLS = 16  // Per tensor dimension, before eliding the middle

type Cell = number | boolean | string
type Matrix = Cell[][]

export function Value({ value }: { value: ValueData | null | undefined }) {
  if (!value?.type) return <span className="v-unknown">{JSON.stringify(value)}</span>
  const { type, contents } = value

  if (type === 'NoneType') return <span className="v-keyword">None</span>
  if (type === 'bool') return <span className="v-keyword">{contents ? 'True' : 'False'}</span>
  if (type === 'int' || type === 'float') return <span className="v-number">{formatNumber(contents)}</span>
  if (type === 'str') return <span className="v-string">{JSON.stringify(contents)}</span>
  if (TENSOR_TYPES.has(type)) return <Tensor shape={value.shape ?? []} contents={contents} />
  if (type.startsWith('sympy.core.')) return <span className="v-number">{String(contents)}</span>
  if (Array.isArray(contents)) return <Sequence type={type} items={contents as ValueData[]} />
  if (contents !== null && typeof contents === 'object') {
    return <Mapping type={type} entries={Object.entries(contents as Record<string, ValueData>)} />
  }
  return <span className="v-other">{String(contents)}</span>
}

function Sequence({ type, items }: { type: string; items: ValueData[] }) {
  const [open, close] = type === 'tuple' ? ['(', ')'] : type === 'set' ? ['{', '}'] : ['[', ']']
  if (items.length === 0) return <span className="v-punct">{open}{close}</span>
  if (!items.some(isStructured) && items.length <= 64) {
    return (
      <span className="v-seq">
        <span className="v-punct">{open}</span>
        {items.map((item, i) => (
          <span key={i}>{i > 0 && <span className="v-punct">, </span>}<Value value={item} /></span>
        ))}
        <span className="v-punct">{close}</span>
      </span>
    )
  }
  return (
    <div className="v-list">
      {items.map((item, i) => (
        <div className="v-list-item" key={i}>
          <span className="v-index">{i}</span>
          <Value value={item} />
        </div>
      ))}
    </div>
  )
}

function Mapping({ type, entries }: { type: string; entries: [string, ValueData][] }) {
  if (entries.length === 0) return <span className="v-punct">{'{}'}</span>
  return (
    <div className="v-map">
      {type !== 'dict' && <div className="v-map-type">{shortType(type)}</div>}
      {entries.map(([key, item]) => (
        <div className="v-map-row" key={key}>
          <span className="v-key">{key}</span>
          <span className="v-map-value"><Value value={item} /></span>
        </div>
      ))}
    </div>
  )
}

/** Indices to show along a dimension of size n (null marks an elided range). */
function visibleIndices(n: number): (number | null)[] {
  if (n <= MAX_CELLS) return [...Array(n).keys()]
  const half = MAX_CELLS / 2
  return [...Array(half).keys(), null, ...Array.from({ length: half }, (_, i) => n - half + i)]
}

function Tensor({ shape, contents }: { shape: number[]; contents: unknown }) {
  if (shape.length === 0) return <span className="v-number">{formatNumber(contents)}</span>
  if (shape.length > 3) return <pre className="v-other">{JSON.stringify(contents).slice(0, 2000)}</pre>

  // Treat everything as a stack of matrices
  const slices: Matrix[] = shape.length === 3
    ? contents as Matrix[]
    : [shape.length === 2 ? contents as Matrix : [contents as Cell[]]]
  const sliceIndices = visibleIndices(slices.length)
  let scale = 0
  for (const s of sliceIndices) {
    if (s === null) continue
    for (const row of slices[s]) {
      for (const x of row) if (typeof x === 'number' && Math.abs(x) > scale) scale = Math.abs(x)
    }
  }
  scale = scale || 1

  const cell = (x: Cell, key: number) => {
    const heat = typeof x === 'number' ? Math.round((Math.abs(x) / scale) * 42) : 0
    const tone = typeof x === 'number' && x < 0 ? 'neg' : 'pos'
    const background = heat ? `color-mix(in oklab, var(--heat-${tone}) ${heat}%, transparent)` : undefined
    return <td key={key} style={{ background }}>{formatNumber(x)}</td>
  }

  return (
    <div className="v-tensor">
      {sliceIndices.map((s, si) => s === null
        ? <div key={`gap-${si}`} className="v-tensor-gap">⋮</div>
        : (
          <table key={s} className="v-matrix">
            <tbody>
              {visibleIndices(slices[s].length).map((r, ri) => (
                <tr key={ri}>
                  {r === null
                    ? <td className="v-elided" colSpan={MAX_CELLS + 1}>⋮</td>
                    : visibleIndices(slices[s][r].length).map((c, ci) => c === null
                      ? <td key={`gap-${ci}`} className="v-elided">…</td>
                      : cell(slices[s][r][c], ci))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </div>
  )
}
