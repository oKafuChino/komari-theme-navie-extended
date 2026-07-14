import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { createServer } from 'vite'

let greeting
let vite

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  greeting = await vite.ssrLoadModule('/src/utils/live2dGreeting.ts')
})

after(async () => {
  await vite?.close()
})

test('fetches a valid visitor IP with privacy-preserving request options', async () => {
  let request
  const fetcher = async (url, options) => {
    request = { url, options }
    return { ok: true, json: async () => ({ ip: '203.0.113.8' }) }
  }

  assert.equal(await greeting.fetchVisitorIp(fetcher, 2500), '203.0.113.8')
  assert.equal(request.url, 'https://api64.ipify.org?format=json')
  assert.equal(request.options.credentials, 'omit')
  assert.equal(request.options.referrerPolicy, 'no-referrer')
  assert.equal(request.options.cache, 'no-store')
  assert.ok(request.options.signal instanceof AbortSignal)
})

test('returns null for failed, malformed, or invalid responses', async () => {
  assert.equal(await greeting.fetchVisitorIp(async () => ({ ok: false }), 2500), null)
  assert.equal(await greeting.fetchVisitorIp(async () => ({
    ok: true,
    json: async () => {
      throw new Error('json')
    },
  }), 2500), null)
  assert.equal(await greeting.fetchVisitorIp(async () => ({ ok: true, json: async () => ({ ip: '<script>' }) }), 2500), null)
})

test('aborts a stalled IP lookup at the requested timeout', async () => {
  let aborted = false
  const fetcher = (_url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      aborted = true
      reject(new DOMException('aborted', 'AbortError'))
    }, { once: true })
  })

  assert.equal(await greeting.fetchVisitorIp(fetcher, 5), null)
  assert.equal(aborted, true)
})

test('aborts an IP lookup when the owning component is closed', async () => {
  const owner = new AbortController()
  let requestSignal
  const fetcher = (_url, options) => new Promise((resolve, reject) => {
    requestSignal = options.signal
    options.signal.addEventListener('abort', () => {
      reject(new DOMException('aborted', 'AbortError'))
    }, { once: true })
  })

  const result = greeting.fetchVisitorIp(fetcher, 50, owner.signal)
  await Promise.resolve()
  owner.abort()
  assert.equal(requestSignal.aborted, true)
  assert.equal(await result, null)
})

test('formats the approved specific and fallback greetings', () => {
  assert.equal(greeting.buildWelcomeMessage('203.0.113.8'), '欢迎来自 203.0.113.8 的朋友')
  assert.equal(greeting.buildWelcomeMessage(null), '欢迎远道而来的朋友')
})
