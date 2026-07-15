<script setup lang="ts">
import type { ThreeNetworkSnapshot } from '@/utils/threeNetworkSnapshot'
import { NAlert, NButton, NEmpty, NProgress, NTag, NText } from 'naive-ui'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { getSharedApi } from '@/utils/api'
import { saveThreeNetworkSnapshot } from '@/utils/threeNetworkSettings'
import { THREE_NETWORK_TARGETS } from '@/utils/threeNetworkTargets'
import { createThreeNetworkTaskRpc, runThreeNetworkTcpTest } from '@/utils/threeNetworkTcpTasks'

const props = defineProps<{
  uuid: string
  online: boolean
}>()

const appStore = useAppStore()
const api = getSharedApi()
const isRunning = ref(false)
const completed = ref(0)
const failures = ref(0)
const error = ref('')
let controller: AbortController | null = null

const snapshot = computed<ThreeNetworkSnapshot | undefined>(() => (
  appStore.threeNetworkTcpSnapshots.nodes[props.uuid]
))

const provinceRows = computed(() => {
  const rows = []
  for (let index = 0; index < THREE_NETWORK_TARGETS.length; index += 3) {
    const targets = THREE_NETWORK_TARGETS.slice(index, index + 3)
    const first = targets[0]
    if (!first)
      continue
    rows.push({
      code: first.provinceCode,
      name: first.provinceName,
      cells: targets.map((target, offset) => ({
        carrier: target.carrierName,
        value: snapshot.value?.values[index + offset] ?? null,
      })),
    })
  }
  return rows
})

const testedAt = computed(() => {
  if (!snapshot.value)
    return ''
  return new Date(snapshot.value.testedAt).toLocaleString()
})

const successCount = computed(() => snapshot.value?.values.filter(value => value !== null).length ?? 0)
const failureCount = computed(() => snapshot.value ? snapshot.value.values.length - successCount.value : 0)
const progressPercentage = computed(() => Math.round(completed.value / THREE_NETWORK_TARGETS.length * 100))

function latencyClass(value: number | null): string {
  if (value === null)
    return 'latency-muted'
  if (value < 80)
    return 'latency-good'
  if (value <= 180)
    return 'latency-warn'
  return 'latency-bad'
}

function cancelTest() {
  controller?.abort()
}

async function startTest() {
  if (!appStore.isLoggedIn || !props.online || isRunning.value)
    return

  controller = new AbortController()
  isRunning.value = true
  completed.value = 0
  failures.value = 0
  error.value = ''

  try {
    const values = await runThreeNetworkTcpTest({
      uuid: props.uuid,
      rpc: createThreeNetworkTaskRpc(),
      signal: controller.signal,
      onProgress: (nextCompleted, nextFailures) => {
        completed.value = nextCompleted
        failures.value = nextFailures
      },
    })
    const nextSnapshot: ThreeNetworkSnapshot = {
      testedAt: new Date().toISOString(),
      values,
    }
    const currentSettings = appStore.publicSettings?.theme_settings
    await saveThreeNetworkSnapshot({
      uuid: props.uuid,
      snapshot: nextSnapshot,
      currentSettings,
      writeSettings: settings => api.saveThemeSettings(appStore.publicSettings?.theme || 'NaiveExtended', settings),
    })
    appStore.publicSettings = await api.getPublicSettings()
    window.$message.success('三网 TCP 延迟测试完成')
  }
  catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      window.$message.info('测试已取消，原有结果未改变')
    }
    else {
      error.value = cause instanceof Error ? cause.message : '测试失败'
    }
  }
  finally {
    controller = null
    isRunning.value = false
  }
}

onBeforeUnmount(() => {
  controller?.abort()
})
</script>

<template>
  <section class="three-network" aria-label="三网 TCP 延迟">
    <div class="three-network__header">
      <div class="three-network__summary">
        <NText strong>
          全国各省份三网 TCP-Ping
        </NText>
        <NText v-if="snapshot" :depth="3" class="three-network__meta">
          上次测试：{{ testedAt }} · 成功 {{ successCount }} · 失败 {{ failureCount }}
        </NText>
      </div>

      <div v-if="appStore.isLoggedIn" class="three-network__actions">
        <NButton v-if="!isRunning" type="primary" :disabled="!online" @click="startTest">
          {{ online ? '开始三网 TCP 测试' : '节点离线，无法测试' }}
        </NButton>
        <NButton v-else secondary type="error" @click="cancelTest">
          取消测试
        </NButton>
      </div>
    </div>

    <div v-if="isRunning" class="three-network__progress">
      <NProgress type="line" :percentage="progressPercentage" :show-indicator="false" />
      <NText :depth="3" class="text-xs">
        已完成 {{ completed }} / {{ THREE_NETWORK_TARGETS.length }}，失败 {{ failures }}
      </NText>
    </div>

    <NAlert v-if="error" type="error" :title="error" class="mb-3" />

    <NEmpty v-if="!snapshot" description="管理员尚未完成测试" class="py-12" />

    <div v-else class="latency-table" role="table" aria-label="三网 TCP 延迟结果">
      <div class="latency-row latency-row--head" role="row">
        <div role="columnheader">
          省份
        </div>
        <div role="columnheader">
          联通
        </div>
        <div role="columnheader">
          移动
        </div>
        <div role="columnheader">
          电信
        </div>
      </div>
      <div v-for="row in provinceRows" :key="row.code" class="latency-row" role="row">
        <div class="latency-province" role="rowheader">
          {{ row.name }}
        </div>
        <div v-for="cell in row.cells" :key="cell.carrier" class="latency-cell" role="cell">
          <span class="latency-carrier">{{ cell.carrier }}</span>
          <NTag :type="cell.value === null ? 'default' : undefined" size="small" :class="latencyClass(cell.value)" round>
            {{ cell.value === null ? '失败' : `${cell.value} ms` }}
          </NTag>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.three-network {
  min-height: 220px;
}

.three-network__header {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.three-network__summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.three-network__meta {
  font-size: 12px;
}

.three-network__actions {
  flex: none;
}

.three-network__progress {
  display: grid;
  gap: 5px;
  margin-bottom: 12px;
}

.latency-table {
  overflow: hidden;
  border: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.2));
  border-radius: var(--border-radius, 8px);
}

.latency-row {
  display: grid;
  grid-template-columns: minmax(90px, 0.65fr) repeat(3, minmax(120px, 1fr));
  min-height: 44px;
  border-top: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.16));
}

.latency-row:first-child {
  border-top: 0;
}

.latency-row > div {
  display: flex;
  align-items: center;
  padding: 8px 14px;
  border-left: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.12));
}

.latency-row > div:first-child {
  border-left: 0;
}

.latency-row--head {
  color: var(--n-text-color-2);
  font-size: 12px;
  font-weight: 600;
  background: rgba(128, 128, 128, 0.08);
}

.latency-province {
  font-weight: 600;
}

.latency-cell {
  justify-content: center;
}

.latency-carrier {
  display: none;
}

.latency-good {
  color: #18a058;
}

.latency-warn {
  color: #d89614;
}

.latency-bad {
  color: #d03050;
}

.latency-muted {
  opacity: 0.65;
}

@media (max-width: 640px) {
  .three-network__header {
    align-items: stretch;
    flex-direction: column;
  }

  .three-network__actions :deep(.n-button) {
    width: 100%;
  }

  .latency-table {
    display: grid;
    gap: 10px;
    overflow: visible;
    border: 0;
  }

  .latency-row--head {
    display: none;
  }

  .latency-row {
    display: grid;
    grid-template-columns: 1fr;
    overflow: hidden;
    border: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.18));
    border-radius: var(--border-radius, 8px);
  }

  .latency-row > div,
  .latency-row > div:first-child {
    border: 0;
    border-top: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.12));
  }

  .latency-province {
    border-top: 0 !important;
    background: rgba(128, 128, 128, 0.08);
  }

  .latency-cell {
    justify-content: space-between;
  }

  .latency-carrier {
    display: inline;
    color: var(--n-text-color-2);
    font-size: 12px;
  }
}
</style>
