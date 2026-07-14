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

test('declares the three Live2D settings', async () => {
  const manifest = JSON.parse(await readFile(new URL('../komari-theme.json', import.meta.url), 'utf8'))
  const items = manifest.configuration.data

  assert.deepEqual(items.find(item => item.key === 'live2dEnabled'), {
    key: 'live2dEnabled',
    name: '启用 Live2D 看板娘',
    type: 'switch',
    default: false,
    help: '在公共探针页面显示管理员提供的 Live2D 看板娘',
  })
  assert.deepEqual(items.find(item => item.key === 'live2dModelPath'), {
    key: 'live2dModelPath',
    name: 'Live2D 模型入口',
    type: 'string',
    default: '/live2d/model/model.model3.json',
    help: '同源 /live2d/ 目录下的 Cubism 3/4 .model3.json 路径',
  })
  assert.deepEqual(items.find(item => item.key === 'live2dScale'), {
    key: 'live2dScale',
    name: 'Live2D 显示缩放',
    type: 'number',
    default: 100,
    help: '看板娘显示缩放百分比，运行时限制为 50-150',
  })
})

test('normalizes invalid Live2D settings to safe defaults', async () => {
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
  store.publicSettings = { theme_settings: {
    live2dEnabled: 'true',
    live2dModelPath: 'https://evil.test/model.model3.json',
    live2dScale: 999,
  } }

  assert.equal(store.live2dEnabled, false)
  assert.equal(store.live2dModelPath, '/live2d/model/model.model3.json')
  assert.equal(store.live2dScale, 150)
})

test('declares the pinned runtime dependencies', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.dependencies.pixijs, undefined)
  assert.equal(pkg.dependencies['pixi.js'], 'catalog:')
  assert.equal(pkg.dependencies['pixi-live2d-display'], 'catalog:')

  const workspace = await readFile(new URL('../pnpm-workspace.yaml', import.meta.url), 'utf8')
  assert.match(workspace, /pixi\.js:\s*6\.5\.10/)
  assert.match(workspace, /pixi-live2d-display:\s*0\.4\.0/)
})

test('keeps supply-chain policy strict with a version-scoped semver exception', async () => {
  const workspace = await readFile(new URL('../pnpm-workspace.yaml', import.meta.url), 'utf8')
  assert.match(workspace, /^trustPolicy: no-downgrade$/m)
  assert.match(workspace, /^ {2}- semver@6\.3\.1$/m)
  assert.doesNotMatch(workspace, /^ {2}- semver(?:@\*)?$/m)
})

test('declares explicit dependency build permissions', async () => {
  const workspace = await readFile(new URL('../pnpm-workspace.yaml', import.meta.url), 'utf8')
  assert.match(workspace, /^ {2}'@parcel\/watcher': false$/m)
  assert.match(workspace, /^ {2}esbuild: true$/m)
  assert.doesNotMatch(workspace, /set this to true or false/)
})
