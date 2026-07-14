import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { createServer } from 'vite'

let vite
let value

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  value = await vite.ssrLoadModule('/src/utils/residualValue.ts')
})

after(async () => {
  await vite?.close()
})

test('normalizes the four approved currencies only', () => {
  assert.equal(value.normalizeCurrency('¥'), 'CNY')
  assert.equal(value.normalizeCurrency('CNY'), 'CNY')
  assert.equal(value.normalizeCurrency('$'), 'USD')
  assert.equal(value.normalizeCurrency(' usd '), 'USD')
  assert.equal(value.normalizeCurrency('€'), 'EUR')
  assert.equal(value.normalizeCurrency('£'), 'GBP')
  assert.equal(value.normalizeCurrency('JPY'), null)
  assert.equal(value.normalizeCurrency('￥'), null)
})

test('accepts complete positive fallback rates and rejects malformed values', () => {
  const valid = { CNY: 1, USD: 7.2, EUR: 7.8, GBP: 9.2 }
  assert.deepEqual(value.parseFallbackRates(JSON.stringify(valid)), valid)
  assert.deepEqual(value.parseFallbackRates(valid), valid)
  assert.deepEqual(value.parseFallbackRates('{"CNY":2}'), value.DEFAULT_RESIDUAL_RATES)
  assert.deepEqual(value.parseFallbackRates('{"CNY":1,"USD":0,"EUR":7.8,"GBP":9.2}'), value.DEFAULT_RESIDUAL_RATES)
  assert.deepEqual(value.parseFallbackRates('broken'), value.DEFAULT_RESIDUAL_RATES)
})

test('calculates, converts, sorts, caps, and isolates invalid nodes', () => {
  const fullDate = '2027-01-01T00:00:00Z'
  const partialDate = '2027-02-01T00:00:00Z'
  const expiredDate = '2020-01-01T00:00:00Z'
  const nodes = [
    { uuid: '1', name: 'Full', price: 20, billing_cycle: 30, currency: '$', expired_at: fullDate },
    { uuid: '2', name: 'Partial', price: 28, billing_cycle: 90, currency: 'CNY', expired_at: partialDate },
    { uuid: '3', name: 'Expired', price: 5, billing_cycle: 30, currency: '¥', expired_at: expiredDate },
    { uuid: '4', name: 'Once', price: 50, billing_cycle: -1, currency: '$', expired_at: fullDate },
    { uuid: '5', name: 'Bad date', price: 50, billing_cycle: 30, currency: '$', expired_at: 'not-a-date' },
    { uuid: '6', name: 'Unknown', price: 50, billing_cycle: 30, currency: 'JPY', expired_at: fullDate },
    { uuid: '7', name: 'Free', price: 0, billing_cycle: 30, currency: '€', expired_at: fullDate },
    { uuid: '8', name: 'Bad price', price: Number.NaN, billing_cycle: 30, currency: '£', expired_at: fullDate },
  ]
  const rates = { CNY: 1, USD: 7.2, EUR: 7.8, GBP: 9.2 }
  const remainingDays = date => ({
    [fullDate]: 45,
    [partialDate]: 45,
    [expiredDate]: -2,
  })[date] ?? 0

  const summary = value.calculateResidualValueSummary(nodes, 'CNY', rates, remainingDays)

  assert.equal(summary.total, 158)
  assert.equal(summary.includedCount, 4)
  assert.equal(summary.excludedCount, 4)
  assert.deepEqual(summary.rows.map(row => row.nodeName), [
    'Full', 'Partial', 'Expired', 'Free', 'Once', 'Bad date', 'Unknown', 'Bad price',
  ])
  assert.equal(summary.rows[0].sourceValue, 20)
  assert.equal(summary.rows[0].targetValue, 144)
  assert.equal(summary.rows[1].targetValue, 14)
  assert.equal(summary.rows[2].targetValue, 0)
  assert.equal(summary.rows[3].targetValue, 0)
  assert.equal(summary.rows[4].reason, 'once')
  assert.equal(summary.rows[5].reason, 'invalid_date')
  assert.equal(summary.rows[6].reason, 'unknown_currency')
  assert.equal(summary.rows[7].reason, 'invalid_price')
})

test('uses the existing remaining-day resolver by default and formats target currency', () => {
  const summary = value.calculateResidualValueSummary([
    { uuid: '1', name: 'Expired', price: 10, billing_cycle: 30, currency: 'GBP', expired_at: '2020-01-01T00:00:00Z' },
  ], 'GBP', value.DEFAULT_RESIDUAL_RATES)

  assert.equal(summary.rows[0].remainingDays, 0)
  assert.equal(summary.total, 0)
  assert.equal(value.formatCurrencyValue(42.5, 'CNY'), '¥42.50')
  assert.equal(value.formatCurrencyValue(42.5, 'USD'), '$42.50')
  assert.equal(value.formatCurrencyValue(42.5, 'EUR'), '€42.50')
  assert.equal(value.formatCurrencyValue(42.5, 'GBP'), '£42.50')
})
