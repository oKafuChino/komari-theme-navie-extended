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

test('accumulates batch failures and merges previews by absolute result index', async () => {
  const run = await vite.ssrLoadModule('/src/utils/threeNetworkRun.ts')
  const updates = []
  let saved

  const snapshot = await run.runThreeNetworkSnapshot({
    initialValues: [null, null, null, null],
    now: () => new Date('2026-07-15T00:00:00.000Z'),
    runTasks: async ({ onBatchResult, onProgress }) => {
      onBatchResult({ start: 0, values: [10, null] })
      onProgress(2, 1)
      onBatchResult({ start: 2, values: [20, null] })
      onProgress(4, 1)
      return [10, null, 20, null]
    },
    saveSnapshot: async (next) => { saved = next },
    onUpdate: update => updates.push(update),
  })

  assert.deepEqual(snapshot.values, [10, null, 20, null])
  assert.deepEqual(saved, snapshot)
  assert.deepEqual(updates.at(-1), {
    completed: 4,
    failures: 2,
    previewValues: [10, null, 20, null],
  })
})

test('does not persist a snapshot when the underlying task runner is cancelled', async () => {
  const run = await vite.ssrLoadModule('/src/utils/threeNetworkRun.ts')
  let saved = false

  await assert.rejects(run.runThreeNetworkSnapshot({
    initialValues: [null],
    runTasks: async () => { throw new DOMException('Cancelled', 'AbortError') },
    saveSnapshot: async () => { saved = true },
    onUpdate: () => {},
  }), { name: 'AbortError' })

  assert.equal(saved, false)
})
