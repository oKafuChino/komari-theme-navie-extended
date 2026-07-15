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

test('runs the fixed catalog in batches of 12 and rounds valid first records', async () => {
  const { runThreeNetworkTcpTest } = await vite.ssrLoadModule('/src/utils/threeNetworkTcpTasks.ts')
  const calls = []
  const deleted = []
  const values = await runThreeNetworkTcpTest({
    uuid: 'node-1',
    now: () => 1000,
    sleep: async () => {},
    rpc: {
      async addPingTask(task) {
        calls.push(task)
      },
      async getAllPingTasks() {
        return calls.map((task, index) => ({ ...task, id: index + 1 }))
      },
      async getPingRecords(id) {
        return { records: [{ task_id: id, time: '2026-07-15T00:00:00.000Z', value: 12.6 }] }
      },
      async deletePingTasks(ids) {
        deleted.push([...ids])
      },
    },
  })

  assert.equal(calls.length, 93)
  assert.ok(calls.every(task => task.type === 'tcp' && task.interval === 5))
  assert.ok(calls.every(task => task.clients.length === 1 && task.clients[0] === 'node-1'))
  assert.match(calls[0].target, /^he-cu-v4\.ip\.zstaticcdn\.com:80$/)
  assert.match(calls[24].target, /^fj-cu-v4\.ip\.zstaticcdn\.com:80$/)
  assert.equal(values.length, 93)
  assert.ok(values.every(value => value === 13))
  assert.equal(deleted.length, 8)
  assert.equal(deleted.flat().length, 93)
  assert.ok(deleted.every(ids => ids.length <= 12))
})

test('keeps tasks alive until delayed first records become visible', async () => {
  const { runThreeNetworkTcpTest } = await vite.ssrLoadModule('/src/utils/threeNetworkTcpTasks.ts')
  const readsByTask = new Map()
  let listed = 0
  const values = await runThreeNetworkTcpTest({
    uuid: 'node-1',
    now: () => 1000,
    sleep: async () => {},
    rpc: {
      async addPingTask() {},
      async getAllPingTasks() {
        listed++
        if (listed === 1)
          return []
        return Array.from({ length: 93 }, (_, index) => ({
          id: index + 1,
          name: `naive-tcp-v1-node-1-1000-${index}-r1`,
        }))
      },
      async getPingRecords(id) {
        const reads = (readsByTask.get(id) ?? 0) + 1
        readsByTask.set(id, reads)
        return reads >= 4
          ? { records: [{ task_id: id, time: '2026-07-15T00:00:00.000Z', value: 12.6 }] }
          : { records: [] }
      },
      async deletePingTasks() {},
    },
  })

  assert.ok(values.every(value => value === 13))
  assert.ok([...readsByTask.values()].every(reads => reads >= 4))
})

test('isolates failed targets and rejects cancellation after cleaning created tasks', async () => {
  const { runThreeNetworkTcpTest } = await vite.ssrLoadModule('/src/utils/threeNetworkTcpTasks.ts')
  const controller = new AbortController()
  const deleted = []
  let creates = 0
  const pending = runThreeNetworkTcpTest({
    uuid: 'node-1',
    signal: controller.signal,
    now: () => 1000,
    sleep: async () => controller.abort(),
    rpc: {
      async addPingTask() {
        creates++
        if (creates === 2)
          throw new Error('create failed')
      },
      async getAllPingTasks() {
        return Array.from({ length: creates }, (_, index) => ({
          id: index + 1,
          name: `naive-tcp-v1-node-1-1000-${index}-r1`,
        })).filter(task => task.id !== 2)
      },
      async getPingRecords() {
        return { records: [{ task_id: 999, time: '2026-07-15T00:00:00.000Z', value: -1 }] }
      },
      async deletePingTasks(ids) {
        deleted.push(...ids)
      },
    },
  })

  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(creates, 12)
  assert.deepEqual(deleted.sort((a, b) => a - b), [1, ...Array.from({ length: 10 }, (_, index) => index + 3)])
})

test('cleans stale temporary tasks before creating a new run', async () => {
  const { runThreeNetworkTcpTest } = await vite.ssrLoadModule('/src/utils/threeNetworkTcpTasks.ts')
  const deleted = []
  let listed = 0

  await runThreeNetworkTcpTest({
    uuid: 'node-1',
    now: () => 1_000_000,
    sleep: async () => {},
    rpc: {
      async addPingTask() {},
      async getAllPingTasks() {
        listed++
        if (listed === 1) {
          return [
            { id: 90, name: 'naive-tcp-v1-node-1-1000-0-r1' },
            { id: 91, name: 'unrelated-task' },
          ]
        }
        return Array.from({ length: 93 }, (_, index) => ({
          id: index + 1,
          name: `naive-tcp-v1-node-1-1000000-${index}-r1`,
        }))
      },
      async getPingRecords(id) {
        return { records: [{ task_id: id, time: '2026-07-15T00:00:00.000Z', value: 20 }] }
      },
      async deletePingTasks(ids) {
        deleted.push([...ids])
      },
    },
  })

  assert.deepEqual(deleted[0], [90])
  assert.equal(deleted[0].includes(91), false)
})

test('refuses a second run while a recent temporary task is active', async () => {
  const { runThreeNetworkTcpTest } = await vite.ssrLoadModule('/src/utils/threeNetworkTcpTasks.ts')
  let creates = 0
  let deletes = 0

  await assert.rejects(runThreeNetworkTcpTest({
    uuid: 'node-1',
    now: () => 1_000_000,
    sleep: async () => {},
    rpc: {
      async addPingTask() { creates++ },
      async getAllPingTasks() {
        return [{ id: 90, name: 'naive-tcp-v1-node-1-900000-0' }]
      },
      async getPingRecords() { return { records: [] } },
      async deletePingTasks() { deletes++ },
    },
  }), /已有三网 TCP 延迟测试正在进行/)

  assert.equal(creates, 0)
  assert.equal(deletes, 0)
})

test('reconciles and deletes tasks when listing fails after creation', async () => {
  const { runThreeNetworkTcpTest } = await vite.ssrLoadModule('/src/utils/threeNetworkTcpTasks.ts')
  const created = []
  const deleted = []
  let listed = 0

  await assert.rejects(runThreeNetworkTcpTest({
    uuid: 'node-1',
    now: () => 1_000_000,
    sleep: async () => {},
    rpc: {
      async addPingTask(task) { created.push(task) },
      async getAllPingTasks() {
        listed++
        if (listed === 1)
          return []
        if (listed === 2)
          throw new Error('list failed after creation')
        return created.map((task, index) => ({ id: index + 1, name: task.name }))
      },
      async getPingRecords() { return { records: [] } },
      async deletePingTasks(ids) { deleted.push(...ids) },
    },
  }), /list failed after creation/)

  assert.equal(created.length, 12)
  assert.deepEqual(deleted, Array.from({ length: 12 }, (_, index) => index + 1))
})

test('reconciles tasks created server-side when the add response is lost', async () => {
  const { runThreeNetworkTcpTest } = await vite.ssrLoadModule('/src/utils/threeNetworkTcpTasks.ts')
  const created = []
  const deleted = []
  let listed = 0

  const values = await runThreeNetworkTcpTest({
    uuid: 'node-1',
    now: () => 1_000_000,
    sleep: async () => {},
    rpc: {
      async addPingTask(task) {
        created.push(task)
        throw new Error('response lost')
      },
      async getAllPingTasks() {
        listed++
        if (listed <= 5)
          return []
        return created.map((task, index) => ({ id: index + 1, name: task.name }))
      },
      async getPingRecords() { return { records: [] } },
      async deletePingTasks(ids) { deleted.push(...ids) },
    },
  })

  assert.equal(values.every(value => value === null), true)
  assert.equal(created.length, 186)
  assert.deepEqual(deleted, Array.from({ length: 186 }, (_, index) => index + 1))
})
