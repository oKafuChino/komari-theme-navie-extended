import type { NodeData } from '@/stores/nodes'
import dayjs from 'dayjs'
import { getDaysUntilExpired } from '@/utils/tagHelper'

export type CurrencyCode = 'CNY' | 'USD' | 'EUR' | 'GBP'
export type ExchangeRates = Record<CurrencyCode, number>
export type ResidualExclusionReason
  = | 'once'
    | 'invalid_cycle'
    | 'invalid_date'
    | 'invalid_price'
    | 'unknown_currency'

export type ResidualNode = Pick<
  NodeData,
  'uuid' | 'name' | 'price' | 'billing_cycle' | 'currency' | 'expired_at'
>

export const DEFAULT_RESIDUAL_RATES: ExchangeRates = Object.freeze({
  CNY: 1,
  USD: 7.2,
  EUR: 7.8,
  GBP: 9.2,
})

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = Object.freeze({
  CNY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
})

export interface ResidualValueRow {
  uuid: string
  nodeName: string
  remainingDays: number | null
  sourcePrice: number
  billingCycle: number
  sourceCurrency: CurrencyCode | null
  sourceValue: number
  targetValue: number | null
  reason: ResidualExclusionReason | null
}

export interface ResidualValueSummary {
  total: number
  includedCount: number
  excludedCount: number
  rows: ResidualValueRow[]
}

const CURRENCY_ALIASES: Readonly<Record<string, CurrencyCode>> = Object.freeze({
  '¥': 'CNY',
  'CNY': 'CNY',
  '$': 'USD',
  'USD': 'USD',
  '€': 'EUR',
  'EUR': 'EUR',
  '£': 'GBP',
  'GBP': 'GBP',
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function normalizeRates(value: unknown): ExchangeRates | null {
  if (!isRecord(value) || value.CNY !== 1)
    return null
  if (!isPositiveFinite(value.USD) || !isPositiveFinite(value.EUR) || !isPositiveFinite(value.GBP))
    return null
  return { CNY: 1, USD: value.USD, EUR: value.EUR, GBP: value.GBP }
}

export function normalizeCurrency(value: unknown): CurrencyCode | null {
  if (typeof value !== 'string')
    return null
  return CURRENCY_ALIASES[value.trim().toUpperCase()] ?? null
}

export function parseFallbackRates(value: unknown): ExchangeRates {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return normalizeRates(parsed) ?? DEFAULT_RESIDUAL_RATES
  }
  catch {
    return DEFAULT_RESIDUAL_RATES
  }
}

function excludedRow(node: ResidualNode, reason: ResidualExclusionReason): ResidualValueRow {
  return {
    uuid: node.uuid,
    nodeName: node.name,
    remainingDays: null,
    sourcePrice: node.price,
    billingCycle: node.billing_cycle,
    sourceCurrency: normalizeCurrency(node.currency),
    sourceValue: 0,
    targetValue: null,
    reason,
  }
}

export function calculateResidualValueSummary(
  nodes: readonly ResidualNode[],
  targetCurrency: CurrencyCode,
  rates: ExchangeRates,
  remainingDaysResolver: (expiredAt: string) => number = getDaysUntilExpired,
): ResidualValueSummary {
  const rows = nodes.map((node, sourceIndex) => {
    if (!Number.isFinite(node.price) || node.price < -1)
      return { row: excludedRow(node, 'invalid_price'), sourceIndex }
    if (node.billing_cycle === -1)
      return { row: excludedRow(node, 'once'), sourceIndex }
    if (!Number.isFinite(node.billing_cycle) || node.billing_cycle <= 0)
      return { row: excludedRow(node, 'invalid_cycle'), sourceIndex }
    if (!dayjs(node.expired_at).isValid())
      return { row: excludedRow(node, 'invalid_date'), sourceIndex }

    const sourceCurrency = normalizeCurrency(node.currency)
    if (!sourceCurrency)
      return { row: excludedRow(node, 'unknown_currency'), sourceIndex }

    let remainingDays: number
    try {
      remainingDays = remainingDaysResolver(node.expired_at)
    }
    catch {
      return { row: excludedRow(node, 'invalid_date'), sourceIndex }
    }
    if (!Number.isFinite(remainingDays))
      return { row: excludedRow(node, 'invalid_date'), sourceIndex }

    const sourcePrice = node.price === -1 ? 0 : node.price
    const sourceValue = Math.min(sourcePrice, sourcePrice * Math.max(remainingDays, 0) / node.billing_cycle)
    const targetValue = sourceValue * rates[sourceCurrency] / rates[targetCurrency]
    const row: ResidualValueRow = {
      uuid: node.uuid,
      nodeName: node.name,
      remainingDays: Math.max(0, Math.floor(remainingDays)),
      sourcePrice,
      billingCycle: node.billing_cycle,
      sourceCurrency,
      sourceValue,
      targetValue,
      reason: null,
    }
    return { row, sourceIndex }
  })

  rows.sort((left, right) => {
    if (left.row.reason !== null && right.row.reason === null)
      return 1
    if (left.row.reason === null && right.row.reason !== null)
      return -1
    if (left.row.targetValue !== null && right.row.targetValue !== null) {
      const difference = right.row.targetValue - left.row.targetValue
      if (difference !== 0)
        return difference
    }
    return left.sourceIndex - right.sourceIndex
  })

  const includedRows = rows.filter(entry => entry.row.reason === null)
  return {
    total: includedRows.reduce((total, entry) => total + (entry.row.targetValue ?? 0), 0),
    includedCount: includedRows.length,
    excludedCount: rows.length - includedRows.length,
    rows: rows.map(entry => entry.row),
  }
}

export function formatCurrencyValue(value: number, currency: CurrencyCode): string {
  const amount = Number.isFinite(value) ? value : 0
  return `${CURRENCY_SYMBOLS[currency]}${amount.toFixed(2)}`
}
