import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { createServer } from 'vite'

let vite
let exchange
const fallbackRates = { CNY: 1, USD: 7.2, EUR: 7.8, GBP: 9.2 }

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  exchange = await vite.ssrLoadModule('/src/utils/exchangeRates.ts')
})

after(async () => {
  await vite?.close()
})

function memoryStorage(initialValue = null) {
  return {
    value: initialValue,
    getItem() { return this.value },
    setItem(_key, value) { this.value = value },
  }
}

test('parses and inverts a complete CNY Frankfurter response', () => {
  const parsed = exchange.parseFrankfurterRates({
    base: 'CNY',
    date: '2026-07-14',
    rates: { USD: 0.14, EUR: 0.12, GBP: 0.105 },
  })
  assert.deepEqual(parsed, {
    CNY: 1,
    USD: 1 / 0.14,
    EUR: 1 / 0.12,
    GBP: 1 / 0.105,
  })
  assert.equal(exchange.parseFrankfurterRates({ base: 'USD', rates: {} }), null)
  assert.equal(exchange.parseFrankfurterRates({ base: 'CNY', rates: { USD: 0, EUR: 1, GBP: 1 } }), null)
})

test('uses a valid cache without making a network request', async () => {
  const now = 1_000_000
  const storage = memoryStorage(JSON.stringify({
    rates: fallbackRates,
    updatedAt: now - 100,
    expiresAt: now + 100,
  }))
  const result = await exchange.loadExchangeRates({
    fallbackRates,
    storage,
    now: () => now,
    fetcher: async () => { throw new Error('must not run') },
  })
  assert.deepEqual(result, { rates: fallbackRates, source: 'cache', updatedAt: now - 100 })
})

test('fetches, validates, and caches online rates with private request options', async () => {
  const now = 2_000_000
  const storage = memoryStorage()
  let request
  const result = await exchange.loadExchangeRates({
    fallbackRates,
    storage,
    now: () => now,
    fetcher: async (url, options) => {
      request = { url, options }
      return {
        ok: true,
        json: async () => ({ base: 'CNY', rates: { USD: 0.14, EUR: 0.12, GBP: 0.1 } }),
      }
    },
  })

  assert.equal(result.source, 'online')
  assert.equal(result.updatedAt, now)
  assert.equal(request.url, exchange.EXCHANGE_RATE_URL)
  assert.equal(request.options.credentials, 'omit')
  assert.equal(request.options.referrerPolicy, 'no-referrer')
  assert.equal(request.options.cache, 'no-store')
  assert.ok(request.options.signal instanceof AbortSignal)
  const cached = JSON.parse(storage.value)
  assert.equal(cached.updatedAt, now)
  assert.equal(cached.expiresAt, now + exchange.EXCHANGE_RATE_CACHE_MS)
  assert.deepEqual(cached.rates, result.rates)
})

test('ignores expired cache and falls back after invalid responses or unavailable storage', async () => {
  const storage = memoryStorage(JSON.stringify({
    rates: fallbackRates,
    updatedAt: 1,
    expiresAt: 2,
  }))
  const result = await exchange.loadExchangeRates({
    fallbackRates,
    storage,
    now: () => 3,
    fetcher: async () => ({ ok: true, json: async () => ({ base: 'CNY', rates: {} }) }),
  })
  assert.deepEqual(result, { rates: fallbackRates, source: 'fallback', updatedAt: null })

  const throwingStorage = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
  }
  const failed = await exchange.loadExchangeRates({
    fallbackRates,
    storage: throwingStorage,
    fetcher: async () => { throw new Error('offline') },
  })
  assert.equal(failed.source, 'fallback')
})

test('returns fallback on timeout and owner abort without retrying', async () => {
  let attempts = 0
  const stalledFetcher = (_url, options) => new Promise((resolve, reject) => {
    attempts++
    options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
  })
  const timedOut = await exchange.loadExchangeRates({ fallbackRates, fetcher: stalledFetcher, timeoutMs: 5 })
  assert.equal(timedOut.source, 'fallback')
  assert.equal(attempts, 1)

  const owner = new AbortController()
  const pending = exchange.loadExchangeRates({ fallbackRates, fetcher: stalledFetcher, signal: owner.signal, timeoutMs: 100 })
  owner.abort()
  assert.equal((await pending).source, 'fallback')
  assert.equal(attempts, 2)
})
