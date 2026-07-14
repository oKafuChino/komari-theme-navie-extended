import type { ExchangeRates } from '@/utils/residualValue'

export type ExchangeRateSource = 'online' | 'cache' | 'fallback'

export interface ExchangeRateResult {
  rates: ExchangeRates
  source: ExchangeRateSource
  updatedAt: number | null
}

interface CachedExchangeRates {
  rates: ExchangeRates
  updatedAt: number
  expiresAt: number
}

export interface LoadExchangeRatesOptions {
  fallbackRates: ExchangeRates
  fetcher?: typeof fetch
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  signal?: AbortSignal
  now?: () => number
  timeoutMs?: number
}

export const EXCHANGE_RATE_URL = 'https://api.frankfurter.app/latest?from=CNY&to=USD,EUR,GBP'
export const EXCHANGE_RATE_CACHE_KEY = 'komari-naive-extended:residual-value:rates:v1'
export const EXCHANGE_RATE_CACHE_MS = 12 * 60 * 60 * 1000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isExchangeRates(value: unknown): value is ExchangeRates {
  return isRecord(value)
    && value.CNY === 1
    && isPositiveFinite(value.USD)
    && isPositiveFinite(value.EUR)
    && isPositiveFinite(value.GBP)
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  }
  catch {
    return null
  }
}

export function parseFrankfurterRates(value: unknown): ExchangeRates | null {
  if (!isRecord(value) || value.base !== 'CNY' || !isRecord(value.rates))
    return null
  const { USD, EUR, GBP } = value.rates
  if (!isPositiveFinite(USD) || !isPositiveFinite(EUR) || !isPositiveFinite(GBP))
    return null
  return {
    CNY: 1,
    USD: 1 / USD,
    EUR: 1 / EUR,
    GBP: 1 / GBP,
  }
}

export function readCachedExchangeRates(
  storage: LoadExchangeRatesOptions['storage'],
  now: number,
): ExchangeRateResult | null {
  if (!storage)
    return null
  try {
    const raw = storage.getItem(EXCHANGE_RATE_CACHE_KEY)
    if (!raw)
      return null
    const cached = JSON.parse(raw) as Partial<CachedExchangeRates>
    if (
      !isExchangeRates(cached.rates)
      || !Number.isFinite(cached.updatedAt)
      || !Number.isFinite(cached.expiresAt)
      || (cached.expiresAt ?? 0) <= now
    ) {
      return null
    }
    return {
      rates: cached.rates,
      source: 'cache',
      updatedAt: cached.updatedAt ?? null,
    }
  }
  catch {
    return null
  }
}

function writeCachedExchangeRates(
  storage: LoadExchangeRatesOptions['storage'],
  cached: CachedExchangeRates,
): void {
  try {
    storage?.setItem(EXCHANGE_RATE_CACHE_KEY, JSON.stringify(cached))
  }
  catch {
    // The online result remains usable when storage is blocked or full.
  }
}

export async function loadExchangeRates(options: LoadExchangeRatesOptions): Promise<ExchangeRateResult> {
  const now = options.now ?? Date.now
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const fallback: ExchangeRateResult = {
    rates: options.fallbackRates,
    source: 'fallback',
    updatedAt: null,
  }
  const cached = readCachedExchangeRates(storage, now())
  if (cached)
    return cached

  const controller = new AbortController()
  const abortFromOwner = () => controller.abort()
  options.signal?.addEventListener('abort', abortFromOwner, { once: true })
  if (options.signal?.aborted)
    controller.abort()
  const timeout = setTimeout(() => controller.abort(), Math.max(0, options.timeoutMs ?? 2500))

  try {
    const response = await (options.fetcher ?? fetch)(EXCHANGE_RATE_URL, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok)
      return fallback
    const rates = parseFrankfurterRates(await response.json())
    if (!rates)
      return fallback
    const updatedAt = now()
    writeCachedExchangeRates(storage, {
      rates,
      updatedAt,
      expiresAt: updatedAt + EXCHANGE_RATE_CACHE_MS,
    })
    return { rates, source: 'online', updatedAt }
  }
  catch {
    return fallback
  }
  finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abortFromOwner)
  }
}
