import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

test('adds the lazy three-network tab after the existing ping chart', async () => {
  const view = await source('src/views/InstanceDetail.vue')

  assert.match(view, /defineAsyncComponent\(\(\) => import\('@\/components\/ThreeNetworkTcpLatency\.vue'\)\)/)
  assert.match(view, /ref<'load' \| 'ping' \| 'tcp-network'>\('load'\)/)
  assert.match(view, /<NTabPane name="ping"[\s\S]*?<\/NTabPane>\s*<NTabPane name="tcp-network" tab="三网 TCP 延迟">/)
  assert.match(view, /<ThreeNetworkTcpLatency :uuid="data\.uuid" :online="data\.online" \/>/)
})

test('keeps visitor display passive and administrator work bounded', async () => {
  const component = await source('src/components/ThreeNetworkTcpLatency.vue')

  assert.match(component, /defineProps<\{[\s\S]*uuid: string[\s\S]*online: boolean/)
  assert.match(component, /appStore\.threeNetworkTcpSnapshots\.nodes\[props\.uuid\]/)
  assert.match(component, /v-if="appStore\.isLoggedIn"/)
  assert.match(component, /runThreeNetworkTcpTest/)
  assert.match(component, /saveThreeNetworkSnapshot/)
  assert.match(component, /const latestSettings = await api\.getPublicSettings\(\)/)
  assert.match(component, /currentSettings: latestSettings\.theme_settings/)
  assert.match(component, /signal: controller\.signal/)
  assert.match(component, /onBeforeSave: \(\) => \{[\s\S]*isSaving\.value = true/)
  assert.match(component, /if \(!isSaving\.value\)[\s\S]*controller\?\.abort\(\)/)
  assert.match(component, /onBatchResult/)
  assert.match(component, /previewValues/)
  assert.match(component, /completedProvinces.*31|31.*completedProvinces/)
  assert.match(component, /import ThreeNetworkTcpMap from '@\/components\/ThreeNetworkTcpMap\.vue'/)
  assert.match(component, /buildThreeNetworkProvinceMap\(displaySnapshot\.value\)/)
  assert.match(component, /<ThreeNetworkTcpMap v-else :province-items="provinceItems" \/>/)
  assert.match(component, /onBeforeUnmount/)
  assert.match(component, /controller\?\.abort\(\)/)
  assert.match(component, /管理员尚未完成测试/)
  assert.match(component, /@media \(max-width: 640px\)/)
  assert.doesNotMatch(component, /latency-table|latency-row/)
  assert.doesNotMatch(component, /setInterval|Canvas|echarts/)
})
