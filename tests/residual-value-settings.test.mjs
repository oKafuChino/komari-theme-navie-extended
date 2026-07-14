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
  await vite?.close()
})

test('declares opt-in residual value settings', async () => {
  const manifest = JSON.parse(await readFile(new URL('../komari-theme.json', import.meta.url), 'utf8'))
  const item = key => manifest.configuration.data.find(entry => entry.key === key)

  assert.deepEqual(item('residualValueEnabled'), {
    key: 'residualValueEnabled',
    name: '启用剩余价值计算器',
    type: 'switch',
    default: false,
    help: '在公共探针页面向访客显示所有 VPS 的剩余价值',
  })
  assert.deepEqual(item('residualValueCurrency'), {
    key: 'residualValueCurrency',
    name: '剩余价值目标币种',
    type: 'select',
    default: 'CNY',
    options: 'CNY,USD,EUR,GBP',
    help: '将剩余价值统一换算为指定币种',
  })
  assert.deepEqual(item('residualValueFallbackRates'), {
    key: 'residualValueFallbackRates',
    name: '剩余价值备用汇率',
    type: 'string',
    default: '{"CNY":1,"USD":7.2,"EUR":7.8,"GBP":9.2}',
    help: '网络汇率不可用时使用；数值表示 1 单位币种等于多少人民币',
  })
})

test('normalizes residual value settings defensively', async () => {
  const values = new Map()
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    clear: () => values.clear(),
    key: index => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
  const { useAppStore } = await vite.ssrLoadModule('/src/stores/app.ts')
  setActivePinia(createPinia())
  const store = useAppStore()
  store.publicSettings = { theme_settings: {
    residualValueEnabled: 'true',
    residualValueCurrency: 'JPY',
    residualValueFallbackRates: '{"CNY":2}',
  } }

  assert.equal(store.residualValueEnabled, false)
  assert.equal(store.residualValueCurrency, 'CNY')
  assert.deepEqual(store.residualValueFallbackRates, { CNY: 1, USD: 7.2, EUR: 7.8, GBP: 9.2 })

  store.publicSettings = { theme_settings: {
    residualValueEnabled: true,
    residualValueCurrency: 'GBP',
    residualValueFallbackRates: '{"CNY":1,"USD":7.1,"EUR":7.7,"GBP":9.1}',
  } }
  assert.equal(store.residualValueEnabled, true)
  assert.equal(store.residualValueCurrency, 'GBP')
  assert.deepEqual(store.residualValueFallbackRates, { CNY: 1, USD: 7.1, EUR: 7.7, GBP: 9.1 })
})
