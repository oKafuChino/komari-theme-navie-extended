import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { createServer } from 'vite'

let vite

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
})

after(async () => {
  await vite.close()
})

test('keeps literal HTML as one raw text token for Vue to escape once', async () => {
  const markdown = await vite.ssrLoadModule('/src/utils/markdown.ts')

  assert.deepEqual(markdown.parseMarkdown('<b>maintenance</b>'), [
    { type: 'text', content: '<b>maintenance</b>' },
  ])
})

test('preserves safe links and drops unsafe URL destinations', async () => {
  const markdown = await vite.ssrLoadModule('/src/utils/markdown.ts')

  assert.deepEqual(markdown.parseMarkdown('[Komari](https://komari-monitor.com/)'), [
    { type: 'link', content: 'Komari', url: 'https://komari-monitor.com/' },
  ])
  assert.deepEqual(markdown.parseMarkdown('[run](javascript:alert)'), [
    { type: 'text', content: 'run' },
  ])
  assert.deepEqual(markdown.parseMarkdown('![tracking](data:image/svg+xml,unsafe)'), [])
})
