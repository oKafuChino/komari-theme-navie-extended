import type { ThreeNetworkSnapshot } from '@/utils/threeNetworkSnapshot'
import {
  mergeThreeNetworkSnapshot,
  parseThreeNetworkSnapshots,
  serializeThreeNetworkSnapshots,
} from '@/utils/threeNetworkSnapshot'

export interface SaveThreeNetworkSnapshotOptions {
  uuid: string
  snapshot: ThreeNetworkSnapshot
  currentSettings: Record<string, unknown> | null | undefined
  writeSettings: (settings: Record<string, unknown>) => Promise<void>
}

export async function saveThreeNetworkSnapshot(
  options: SaveThreeNetworkSnapshotOptions,
): Promise<Record<string, unknown>> {
  const currentSettings = { ...options.currentSettings }
  const currentSnapshots = parseThreeNetworkSnapshots(currentSettings.threeNetworkTcpSnapshots)
  const merged = mergeThreeNetworkSnapshot(currentSnapshots, options.uuid, options.snapshot)
  const candidate = {
    ...currentSettings,
    threeNetworkTcpSnapshots: serializeThreeNetworkSnapshots(merged),
  }

  await options.writeSettings(candidate)
  return candidate
}
