<script setup lang="ts">
import type { ThreeNetworkSnapshot } from '@/utils/threeNetworkSnapshot'
import { NAlert, NButton, NEmpty, NProgress, NText } from 'naive-ui'
import { computed, onBeforeUnmount, ref } from 'vue'
import ThreeNetworkTcpMap from '@/components/ThreeNetworkTcpMap.vue'
import { useAppStore } from '@/stores/app'
import { getSharedApi } from '@/utils/api'
import { buildThreeNetworkProvinceMap } from '@/utils/threeNetworkMap'
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

const provinceItems = computed(() => buildThreeNetworkProvinceMap(snapshot.value))

const testedAt = computed(() => {
  if (!snapshot.value)
    return ''
  return new Date(snapshot.value.testedAt).toLocaleString()
})

const successCount = computed(() => snapshot.value?.values.filter(value => value !== null).length ?? 0)
const failureCount = computed(() => snapshot.value ? snapshot.value.values.length - successCount.value : 0)
const progressPercentage = computed(() => Math.round(completed.value / THREE_NETWORK_TARGETS.length * 100))

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

    <ThreeNetworkTcpMap v-else :province-items="provinceItems" />
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

@media (max-width: 640px) {
  .three-network__header {
    align-items: stretch;
    flex-direction: column;
  }

  .three-network__actions :deep(.n-button) {
    width: 100%;
  }
}
</style>
