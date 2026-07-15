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

test('parses complete version-one snapshots and preserves valid nodes', async () => {
  const snapshots = await vite.ssrLoadModule('/src/utils/threeNetworkSnapshot.ts')
  const values = Array.from({ length: 93 }, (_, index) => index === 1 ? null : index)
  const parsed = snapshots.parseThreeNetworkSnapshots(JSON.stringify({
    version: 1,
    nodes: {
      first: { testedAt: '2026-07-15T00:00:00.000Z', values },
      broken: { testedAt: 'invalid', values: [1] },
    },
  }))

  assert.deepEqual(Object.keys(parsed.nodes), ['first'])
  assert.equal(parsed.nodes.first.values.length, 93)
  assert.equal(parsed.nodes.first.values[1], null)
})

test('merges a node snapshot without mutating existing snapshots', async () => {
  const snapshots = await vite.ssrLoadModule('/src/utils/threeNetworkSnapshot.ts')
  const first = snapshots.parseThreeNetworkSnapshots(JSON.stringify({
    version: 1,
    nodes: {
      first: { testedAt: '2026-07-15T00:00:00.000Z', values: Array.from({ length: 93 }).fill(10) },
    },
  }))
  const merged = snapshots.mergeThreeNetworkSnapshot(first, 'second', {
    testedAt: '2026-07-15T00:01:00.000Z',
    values: Array.from({ length: 93 }).fill(25),
  })

  assert.deepEqual(Object.keys(first.nodes), ['first'])
  assert.deepEqual(Object.keys(merged.nodes).sort(), ['first', 'second'])
  assert.equal(merged.nodes.second.values[0], 25)
  assert.equal(JSON.parse(snapshots.serializeThreeNetworkSnapshots(merged)).nodes.second.values[0], 25)
})

test('rejects malformed roots and unsafe latency values', async () => {
  const snapshots = await vite.ssrLoadModule('/src/utils/threeNetworkSnapshot.ts')

  assert.deepEqual(snapshots.parseThreeNetworkSnapshots('{bad json}'), { version: 1, nodes: {} })
  assert.deepEqual(snapshots.parseThreeNetworkSnapshots(JSON.stringify({
    version: 1,
    nodes: {
      invalid: { testedAt: '2026-07-15T00:00:00.000Z', values: Array.from({ length: 93 }).fill(60001) },
    },
  })), { version: 1, nodes: {} })
})
