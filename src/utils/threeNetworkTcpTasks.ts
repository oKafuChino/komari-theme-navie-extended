import { getSharedApi } from '@/utils/api'
import { getSharedRpc } from '@/utils/rpc'
import { THREE_NETWORK_TARGETS } from '@/utils/threeNetworkTargets'

export const THREE_NETWORK_BATCH_SIZE = 12
export const THREE_NETWORK_TASK_INTERVAL_SECONDS = 5
export const THREE_NETWORK_ROUND_WAIT_MS = 2000
export const THREE_NETWORK_ROUND_POLL_MS = 1000
export const THREE_NETWORK_ROUND_MAX_WAIT_MS = 7000
export const THREE_NETWORK_MAX_ROUNDS = 2
export const THREE_NETWORK_STALE_TASK_MS = 5 * 60 * 1000

export interface PingTaskDefinition {
  name: string
  type: 'tcp'
  target: string
  clients: string[]
  interval: number
}

export interface CreatedPingTask {
  id: number
  name: string
}

interface PingRecord {
  task_id: number
  time: string
  value: number
}

export interface ThreeNetworkTcpTaskRpc {
  addPingTask: (task: PingTaskDefinition) => Promise<void>
  getAllPingTasks: () => Promise<CreatedPingTask[]>
  getPingRecords: (taskId: number) => Promise<{ records: PingRecord[] }>
  deletePingTasks: (taskIds: number[]) => Promise<void>
}

export interface ThreeNetworkTaskRunnerOptions {
  uuid: string
  rpc: ThreeNetworkTcpTaskRpc
  signal?: AbortSignal
  now?: () => number
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>
  onProgress?: (completed: number, failures: number) => void
  onBatchResult?: (result: { start: number, values: readonly (number | null)[] }) => void
}

export function createThreeNetworkTaskRpc(): ThreeNetworkTcpTaskRpc {
  const api = getSharedApi()
  const rpc = getSharedRpc()
  return {
    addPingTask: task => api.addPingTask({ ...task, default_on: false }),
    getAllPingTasks: () => api.getAllPingTasks(),
    getPingRecords: taskId => rpc.getPingRecords(taskId, 1, 10),
    deletePingTasks: taskIds => api.deletePingTasks(taskIds),
  }
}

interface CreatedTargetTask {
  index: number
  id: number
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw new DOMException('Cancelled', 'AbortError')
}

function temporaryTaskTimestamp(name: string, uuid: string): number | null {
  const prefix = `naive-tcp-v1-${uuid}-`
  if (!name.startsWith(prefix))
    return null
  const match = name.slice(prefix.length).match(/^(\d+)-\d+(?:-r\d+)?$/)
  if (!match)
    return null
  const timestamp = Number(match[1])
  return Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : null
}

function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Cancelled', 'AbortError'))
      return
    }

    let timeoutId: number
    const abort = () => {
      window.clearTimeout(timeoutId)
      reject(new DOMException('Cancelled', 'AbortError'))
    }
    timeoutId = window.setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, milliseconds)
    signal?.addEventListener('abort', abort, { once: true })
  })
}

function readLatency(records: readonly PingRecord[], taskId: number, batchStartedAt: number): number | null {
  const matching = records
    .filter(record => record.task_id === taskId && Number.isFinite(record.value) && record.value >= 0)
    .filter((record) => {
      const timestamp = Date.parse(record.time)
      return Number.isFinite(timestamp) && timestamp >= batchStartedAt
    })
    .sort((left, right) => Date.parse(left.time) - Date.parse(right.time))[0]

  return matching ? Math.round(matching.value) : null
}

async function collectBatch(
  tasks: readonly CreatedTargetTask[],
  values: (number | null)[],
  rpc: ThreeNetworkTcpTaskRpc,
  batchStartedAt: number,
  signal: AbortSignal | undefined,
  wait: (milliseconds: number, signal?: AbortSignal) => Promise<void>,
): Promise<void> {
  let pending = [...tasks]

  const maxReads = 1 + Math.floor((THREE_NETWORK_ROUND_MAX_WAIT_MS - THREE_NETWORK_ROUND_WAIT_MS) / THREE_NETWORK_ROUND_POLL_MS)
  for (let attempt = 0; attempt < maxReads && pending.length > 0; attempt++) {
    throwIfAborted(signal)
    if (attempt > 0)
      await wait(THREE_NETWORK_ROUND_POLL_MS, signal)
    const results = await Promise.all(pending.map(async (task) => {
      try {
        const result = await rpc.getPingRecords(task.id)
        return { task, latency: readLatency(result.records, task.id, batchStartedAt) }
      }
      catch {
        return { task, latency: null }
      }
    }))

    pending = []
    for (const result of results) {
      if (result.latency === null)
        pending.push(result.task)
      else
        values[result.task.index] = result.latency
    }
  }
}

export async function runThreeNetworkTcpTest(options: ThreeNetworkTaskRunnerOptions): Promise<(number | null)[]> {
  const uuid = options.uuid.trim()
  if (!uuid)
    throw new TypeError('A node UUID is required')

  const values = Array.from<(number | null)>({ length: THREE_NETWORK_TARGETS.length }).fill(null)
  const createdTaskIds: number[] = []
  const createdTaskNames = new Set<string>()
  const deletedTaskNames = new Set<string>()
  const taskNamesById = new Map<number, string>()
  const wait = options.sleep ?? sleep
  const now = options.now ?? Date.now
  let completed = 0

  try {
    const existingTasks = await options.rpc.getAllPingTasks()
    const temporaryTasks = existingTasks.flatMap((task) => {
      const timestamp = temporaryTaskTimestamp(task.name, uuid)
      return timestamp === null || !Number.isInteger(task.id) || task.id <= 0
        ? []
        : [{ id: task.id, timestamp }]
    })
    const currentTime = now()
    if (temporaryTasks.some(task => currentTime - task.timestamp < THREE_NETWORK_STALE_TASK_MS))
      throw new Error('已有三网 TCP 延迟测试正在进行，请稍后再试')

    const staleIds = temporaryTasks.map(task => task.id)
    if (staleIds.length > 0)
      await options.rpc.deletePingTasks(staleIds)

    for (let start = 0; start < THREE_NETWORK_TARGETS.length; start += THREE_NETWORK_BATCH_SIZE) {
      throwIfAborted(options.signal)
      const batchStartedAt = now()
      const batch = THREE_NETWORK_TARGETS.slice(start, start + THREE_NETWORK_BATCH_SIZE)
      let pendingDefinitions = batch.map((target, offset) => ({
        index: start + offset,
        task: {
          name: `naive-tcp-v1-${uuid}-${batchStartedAt}-${start + offset}-r1`,
          type: 'tcp' as const,
          target: `${target.host}:${target.port}`,
          clients: [uuid],
          interval: THREE_NETWORK_TASK_INTERVAL_SECONDS,
        },
      }))
      const batchValues = Array.from<(number | null)>({ length: batch.length }).fill(null)
      for (let round = 1; round <= THREE_NETWORK_MAX_ROUNDS && pendingDefinitions.length > 0; round++) {
        const definitions = pendingDefinitions.map(definition => ({
          ...definition,
          task: { ...definition.task, name: definition.task.name.replace(/-r\d+$/, `-r${round}`) },
        }))
        const additions = await Promise.all(definitions.map(async (definition) => {
          createdTaskNames.add(definition.task.name)
          try {
            await options.rpc.addPingTask(definition.task)
            return definition
          }
          catch {
            return null
          }
        }))
        let created: CreatedTargetTask[] = []
        try {
          const allTasks = await options.rpc.getAllPingTasks()
          const taskIdsByName = new Map(allTasks
            .filter(task => Number.isInteger(task.id) && task.id > 0 && typeof task.name === 'string')
            .map(task => [task.name, task.id]))
          created = additions.flatMap((definition): CreatedTargetTask[] => {
            if (!definition)
              return []
            const id = taskIdsByName.get(definition.task.name)
            if (!id)
              return []
            createdTaskIds.push(id)
            taskNamesById.set(id, definition.task.name)
            return [{ index: definition.index, id }]
          })
          throwIfAborted(options.signal)
          await wait(THREE_NETWORK_ROUND_WAIT_MS, options.signal)
          throwIfAborted(options.signal)
          await collectBatch(created, values, options.rpc, batchStartedAt, options.signal, wait)
          for (const task of created) {
            const offset = task.index - start
            batchValues[offset] = values[task.index] ?? null
          }
        }
        finally {
          const ids = created.map(task => task.id)
          if (ids.length > 0) {
            try {
              await options.rpc.deletePingTasks(ids)
              for (const id of ids) {
                const position = createdTaskIds.indexOf(id)
                if (position >= 0)
                  createdTaskIds.splice(position, 1)
                const name = taskNamesById.get(id)
                if (name)
                  deletedTaskNames.add(name)
              }
            }
            catch {
              // The outer finalizer retries task cleanup by unique name.
            }
          }
        }
        pendingDefinitions = definitions.filter((definition, index) => batchValues[index] === null)
      }
      options.onBatchResult?.({ start, values: batchValues })

      completed += batch.length
      options.onProgress?.(completed, batchValues.filter(value => value === null).length)
    }

    return values
  }
  finally {
    const cleanupIds = new Set(createdTaskIds)
    if (createdTaskNames.size > 0) {
      try {
        const remainingTasks = await options.rpc.getAllPingTasks()
        for (const task of remainingTasks) {
          if (createdTaskNames.has(task.name) && !deletedTaskNames.has(task.name) && Number.isInteger(task.id) && task.id > 0)
            cleanupIds.add(task.id)
        }
      }
      catch {
        // Fall back to IDs resolved during the run. Unresolved tasks are retried as stale tasks next run.
      }
    }
    if (cleanupIds.size > 0) {
      try {
        await options.rpc.deletePingTasks([...cleanupIds])
      }
      catch {
        // Stale task cleanup retries on the next administrator run.
      }
    }
  }
}
