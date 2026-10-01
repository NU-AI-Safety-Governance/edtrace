/** Helpers for describing inspected values (see Values.tsx). */

import type { Value } from './types'

export const TENSOR_TYPES = new Set(['torch.Tensor', 'torch.nn.parameter.Parameter', 'numpy.ndarray'])

export function formatNumber(x: unknown): string {
  if (typeof x === 'boolean') return x ? 'True' : 'False'
  if (typeof x !== 'number') return String(x)  // inf, nan
  if (Math.abs(x) >= 1e12) return x.toExponential(3)
  if (Math.abs(x) >= 1e6 && Number.isInteger(x)) return x.toLocaleString()
  if (Number.isInteger(x * 1000)) return String(x)
  if (x !== 0 && Math.abs(x) < 1e-3) return x.toExponential(2)
  return x.toFixed(4)
}

/** Short description of a value's type, e.g. "float32 · 2×3". */
export function describeType(value: Value | null | undefined): string {
  if (!value?.type) return ''
  if (value.shape) {
    const dtype = (value.dtype || value.type).replace(/^torch\./, '')
    return value.shape.length ? `${dtype} · ${value.shape.join('×')}` : dtype
  }
  if (Array.isArray(value.contents)) return `${shortType(value.type)}[${value.contents.length}]`
  return shortType(value.type)
}

export const shortType = (type: string) => type.split('.').pop() ?? type

export function isStructured(value: Value | null | undefined): boolean {
  return value?.contents !== null && typeof value?.contents === 'object'
}
