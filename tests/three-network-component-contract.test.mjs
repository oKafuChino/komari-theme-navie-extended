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
  assert.match(component, /onBeforeUnmount/)
  assert.match(component, /controller\?\.abort\(\)/)
  assert.match(component, /管理员尚未完成测试/)
  assert.match(component, /@media \(max-width: 640px\)/)
  assert.doesNotMatch(component, /setInterval|Canvas|echarts/)
})
