import { THREE_NETWORK_TARGET_COUNT } from '@/utils/threeNetworkTargets'

export interface ThreeNetworkSnapshot {
  readonly testedAt: string
  readonly values: readonly (number | null)[]
}

export interface ThreeNetworkSnapshots {
  readonly version: 1
  readonly nodes: Readonly<Record<string, ThreeNetworkSnapshot>>
}

export const EMPTY_THREE_NETWORK_SNAPSHOTS: ThreeNetworkSnapshots = Object.freeze({
  version: 1,
  nodes: Object.freeze({}),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== 'string')
    return false

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
}

function isValidLatency(value: unknown): value is number | null {
  return value === null || (typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= 60000)
}

function toSnapshot(value: unknown): ThreeNetworkSnapshot | null {
  if (!isRecord(value) || !isValidTimestamp(value.testedAt) || !Array.isArray(value.values))
    return null

  if (value.values.length !== THREE_NETWORK_TARGET_COUNT || !value.values.every(isValidLatency))
    return null

  return Object.freeze({
    testedAt: value.testedAt,
    values: Object.freeze([...value.values]),
  })
}

function isNodeKey(value: string): boolean {
  return value.length > 0 && value.length <= 256
}

function createSnapshots(nodes: Record<string, ThreeNetworkSnapshot>): ThreeNetworkSnapshots {
  return Object.freeze({
    version: 1,
    nodes: Object.freeze(nodes),
  })
}

export function parseThreeNetworkSnapshots(value: unknown): ThreeNetworkSnapshots {
  if (typeof value !== 'string')
    return createSnapshots({})

  try {
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.nodes))
      return createSnapshots({})

    const nodes: Record<string, ThreeNetworkSnapshot> = {}
    for (const [uuid, snapshot] of Object.entries(parsed.nodes)) {
      const normalized = isNodeKey(uuid) ? toSnapshot(snapshot) : null
      if (normalized)
        nodes[uuid] = normalized
    }
    return createSnapshots(nodes)
  }
  catch {
    return createSnapshots({})
  }
}

export function mergeThreeNetworkSnapshot(
  current: ThreeNetworkSnapshots,
  uuid: string,
  snapshot: ThreeNetworkSnapshot,
): ThreeNetworkSnapshots {
  const normalized = toSnapshot(snapshot)
  if (!isNodeKey(uuid) || !normalized)
    throw new TypeError('Invalid three-network TCP snapshot')

  const nodes = current.version === 1 ? { ...current.nodes } : {}
  nodes[uuid] = normalized
  return createSnapshots(nodes)
}

export function serializeThreeNetworkSnapshots(value: ThreeNetworkSnapshots): string {
  const nodes: Record<string, ThreeNetworkSnapshot> = {}
  for (const [uuid, snapshot] of Object.entries(value.nodes)) {
    const normalized = isNodeKey(uuid) ? toSnapshot(snapshot) : null
    if (!normalized)
      throw new TypeError('Invalid three-network TCP snapshot')
    nodes[uuid] = normalized
  }
  return JSON.stringify({ version: 1, nodes })
}
