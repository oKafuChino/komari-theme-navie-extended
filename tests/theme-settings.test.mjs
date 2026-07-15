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

test('allows public HTTP(S) and root-relative URLs while rejecting unsafe URL forms', async () => {
  const settings = await vite.ssrLoadModule('/src/utils/themeSettings.ts')

  assert.equal(settings.normalizePublicUrl('https://beian.miit.gov.cn/', ''), 'https://beian.miit.gov.cn/')
  assert.equal(settings.normalizePublicUrl('http://media.example.test/background.mp4', ''), 'http://media.example.test/background.mp4')
  assert.equal(settings.normalizePublicUrl('/images/background.webp?theme=dark#top', ''), '/images/background.webp?theme=dark#top')
  assert.equal(settings.normalizePublicUrl('javascript:alert(1)', ''), '')
  assert.equal(settings.normalizePublicUrl('data:text/html,unsafe', ''), '')
  assert.equal(settings.normalizePublicUrl('https://user:pass@example.test/background.webp', ''), '')
  assert.equal(settings.normalizePublicUrl('https://example.test:invalid/path', ''), '')
})

test('uses immutable defaults for malformed list configuration values', async () => {
  const settings = await vite.ssrLoadModule('/src/utils/themeSettings.ts')

  const defaults = settings.parseAllowedColumns('{bad json}')
  defaults.pop()

  assert.deepEqual(settings.parseAllowedColumns('{bad json}'), settings.DEFAULT_LIST_VIEW_COLUMNS)
  assert.deepEqual(settings.parseColumnStyles('{"unknown":"12px"}'), {})
  assert.deepEqual(settings.parseColumnStyles('{"cpu":12}'), {})
})
