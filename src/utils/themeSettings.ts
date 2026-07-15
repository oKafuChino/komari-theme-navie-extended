export const DEFAULT_LIST_VIEW_COLUMNS = Object.freeze([
  'status',
  'region',
  'name',
  'tags',
  'uptime',
  'os',
  'cpu',
  'mem',
  'disk',
  'traffic',
  'rate',
])

export type ListViewColumn = typeof DEFAULT_LIST_VIEW_COLUMNS[number]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function resolveBooleanSetting(
  settings: Record<string, unknown> | null | undefined,
  key: string,
  fallback: boolean,
): boolean {
  const value = settings?.[key]
  return typeof value === 'boolean' ? value : fallback
}

export function resolveNumberSetting(
  settings: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = settings?.[key]
  if (typeof value !== 'number' || !Number.isFinite(value))
    return fallback
  return Math.min(maximum, Math.max(minimum, value))
}

export function resolveSelectSetting<T extends string>(
  settings: Record<string, unknown> | null | undefined,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = settings?.[key]
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback
}

export function resolveStringSetting(
  settings: Record<string, unknown> | null | undefined,
  key: string,
  fallback: string,
): string {
  const value = settings?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export function parseAllowedColumns(value: unknown): ListViewColumn[] {
  if (typeof value !== 'string')
    return [...DEFAULT_LIST_VIEW_COLUMNS]
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed))
      return [...DEFAULT_LIST_VIEW_COLUMNS]
    const columns = parsed.filter((column): column is ListViewColumn => (
      typeof column === 'string' && DEFAULT_LIST_VIEW_COLUMNS.includes(column as ListViewColumn)
    ))
    return columns.length > 0 ? columns : [...DEFAULT_LIST_VIEW_COLUMNS]
  }
  catch {
    return [...DEFAULT_LIST_VIEW_COLUMNS]
  }
}

export function parseColumnStyles(value: unknown): Record<string, string> {
  if (typeof value !== 'string')
    return {}
  try {
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed))
      return {}
    const styles: Record<string, string> = {}
    for (const column of DEFAULT_LIST_VIEW_COLUMNS) {
      const candidate = parsed[column]
      if (typeof candidate === 'string' && candidate.trim())
        styles[column] = candidate.trim()
    }
    return styles
  }
  catch {
    return {}
  }
}

export function normalizePublicUrl(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value !== value.trim() || value.startsWith('//'))
    return fallback
  try {
    const base = new URL('https://komari.invalid/')
    const url = new URL(value, base)
    const isRelative = url.origin === base.origin
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:'
    if ((!isRelative && !isHttp) || url.username || url.password)
      return fallback
    return isRelative ? `${url.pathname}${url.search}${url.hash}` : url.toString()
  }
  catch {
    return fallback
  }
}
