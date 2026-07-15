import type { ThreeNetworkSnapshot } from '@/utils/threeNetworkSnapshot'

export interface ThreeNetworkBatchResult {
  start: number
  values: readonly (number | null)[]
}

export interface ThreeNetworkRunUpdate {
  completed: number
  failures: number
  previewValues: readonly (number | null)[]
}

export interface ThreeNetworkRunOptions {
  initialValues: readonly (number | null)[]
  now?: () => Date
  runTasks: (callbacks: {
    onBatchResult: (result: ThreeNetworkBatchResult) => void
    onProgress: (completed: number, failureDelta: number) => void
  }) => Promise<(number | null)[]>
  saveSnapshot: (snapshot: ThreeNetworkSnapshot) => Promise<void>
  onUpdate: (update: ThreeNetworkRunUpdate) => void
}

export async function runThreeNetworkSnapshot(options: ThreeNetworkRunOptions): Promise<ThreeNetworkSnapshot> {
  const previewValues = [...options.initialValues]
  let completed = 0
  let failures = 0
  const emit = () => options.onUpdate({ completed, failures, previewValues: [...previewValues] })

  const values = await options.runTasks({
    onBatchResult: ({ start, values }) => {
      previewValues.splice(start, values.length, ...values)
      emit()
    },
    onProgress: (nextCompleted, failureDelta) => {
      completed = nextCompleted
      failures += failureDelta
      emit()
    },
  })

  const snapshot: ThreeNetworkSnapshot = {
    testedAt: (options.now ?? (() => new Date()))().toISOString(),
    values,
  }
  await options.saveSnapshot(snapshot)
  return snapshot
}
