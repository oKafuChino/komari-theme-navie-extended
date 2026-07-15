import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test, { after, before } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { createServer } from 'vite'

let vite

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
})

after(async () => {
  await vite.close()
})

test('declares the snapshot field so Komari managed saves preserve it', async () => {
  const manifest = JSON.parse(await readFile(new URL('../komari-theme.json', import.meta.url), 'utf8'))
  const item = manifest.configuration.data.find(entry => entry.key === 'threeNetworkTcpSnapshots')

  assert.deepEqual(item, {
    key: 'threeNetworkTcpSnapshots',
    name: '三网 TCP 延迟历史数据',
    type: 'string',
    default: '{"version":1,"nodes":{}}',
    help: '系统自动维护，请勿手动修改；用于向访客显示管理员最近一次测试结果',
  })
})

test('normalizes malformed public snapshot settings to an empty v1 object', async () => {
  const { useAppStore } = await vite.ssrLoadModule('/src/stores/app.ts')
  const values = new Map()
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    clear: () => values.clear(),
    key: index => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
  setActivePinia(createPinia())
  const store = useAppStore()

  store.publicSettings = { theme_settings: { threeNetworkTcpSnapshots: '{not json}' } }
  assert.deepEqual(store.threeNetworkTcpSnapshots, { version: 1, nodes: {} })
})

test('writes a merged snapshot without deleting unrelated settings', async () => {
  const { saveThreeNetworkSnapshot } = await vite.ssrLoadModule('/src/utils/threeNetworkSettings.ts')
  const { parseThreeNetworkSnapshots } = await vite.ssrLoadModule('/src/utils/threeNetworkSnapshot.ts')
  const settings = {
    sakuraEnabled: true,
    threeNetworkTcpSnapshots: '{"version":1,"nodes":{}}',
  }
  let written

  const candidate = await saveThreeNetworkSnapshot({
    uuid: 'node-1',
    snapshot: { testedAt: '2026-07-15T00:00:00.000Z', values: Array.from({ length: 93 }).fill(10) },
    currentSettings: settings,
    writeSettings: async (value) => { written = value },
  })

  assert.equal(written.sakuraEnabled, true)
  assert.equal(candidate, written)
  assert.equal(parseThreeNetworkSnapshots(written.threeNetworkTcpSnapshots).nodes['node-1'].values[0], 10)
  assert.deepEqual(settings, {
    sakuraEnabled: true,
    threeNetworkTcpSnapshots: '{"version":1,"nodes":{}}',
  })
})
