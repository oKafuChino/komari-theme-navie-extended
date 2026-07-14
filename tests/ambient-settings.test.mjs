import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let vite

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
})

after(async () => {
  await vite.close()
})

test('normalizes Boolean theme settings defensively', async () => {
  const { resolveBooleanThemeSetting } = await vite.ssrLoadModule('/src/stores/app.ts')

  assert.equal(resolveBooleanThemeSetting({ enabled: true }, 'enabled', false), true)
  assert.equal(resolveBooleanThemeSetting({ enabled: false }, 'enabled', true), false)
  assert.equal(resolveBooleanThemeSetting({ enabled: 'true' }, 'enabled', false), false)
  assert.equal(resolveBooleanThemeSetting(null, 'enabled', true), true)
})

test('declares both managed switches with enabled defaults', async () => {
  const manifest = JSON.parse(await readFile(new URL('../komari-theme.json', import.meta.url), 'utf8'))
  const items = manifest.configuration.data
  const sakura = items.find(item => item.key === 'sakuraEnabled')
  const trail = items.find(item => item.key === 'cursorTrailEnabled')

  assert.deepEqual(sakura, {
    key: 'sakuraEnabled',
    name: '启用樱花飘落',
    type: 'switch',
    default: true,
    help: '在公共监控页面背景显示低负载樱花飘落效果',
  })
  assert.deepEqual(trail, {
    key: 'cursorTrailEnabled',
    name: '启用鼠标星轨',
    type: 'switch',
    default: true,
    help: '在支持鼠标悬停的设备上显示星光下落轨迹',
  })
})
