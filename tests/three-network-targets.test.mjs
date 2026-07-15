import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { createServer } from 'vite'

let vite

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
})

after(async () => {
  await vite.close()
})

test('creates exactly 93 fixed IPv4 TCP targets in province and carrier order', async () => {
  const catalog = await vite.ssrLoadModule('/src/utils/threeNetworkTargets.ts')

  assert.equal(catalog.THREE_NETWORK_TARGET_COUNT, 93)
  assert.equal(catalog.THREE_NETWORK_TARGETS.length, 93)
  assert.deepEqual(catalog.THREE_NETWORK_TARGETS.slice(0, 3).map(item => item.host), [
    'he-cu-v4.ip.zstaticcdn.com',
    'he-cm-v4.ip.zstaticcdn.com',
    'he-ct-v4.ip.zstaticcdn.com',
  ])
  assert.deepEqual(catalog.THREE_NETWORK_TARGETS.slice(-3).map(item => item.host), [
    'cq-cu-v4.ip.zstaticcdn.com',
    'cq-cm-v4.ip.zstaticcdn.com',
    'cq-ct-v4.ip.zstaticcdn.com',
  ])
  assert.ok(catalog.THREE_NETWORK_TARGETS.every(item => item.port === 80))
  assert.ok(Object.isFrozen(catalog.THREE_NETWORK_TARGETS))
  assert.ok(catalog.THREE_NETWORK_TARGETS.every(Object.isFrozen))
})
