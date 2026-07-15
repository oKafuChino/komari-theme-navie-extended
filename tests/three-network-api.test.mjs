import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('wraps the verified Komari 1.2.6 administrator endpoints', async () => {
  const source = await readFile(new URL('../src/utils/api.ts', import.meta.url), 'utf8')

  assert.match(source, /async addPingTask\(/)
  assert.match(source, /this\.postAdmin\('\/admin\/ping\/add'/)
  assert.match(source, /async getAllPingTasks\(/)
  assert.match(source, /this\.get<[^>]*>\('\/admin\/ping'\)/)
  assert.match(source, /async deletePingTasks\(/)
  assert.match(source, /this\.postAdmin\('\/admin\/ping\/delete', \{ id: taskIds \}\)/)
  assert.match(source, /async saveThemeSettings\(/)
  assert.match(source, /`\/admin\/theme\/settings\?theme=\$\{encodeURIComponent\(theme\)\}`/)
  assert.match(source, /private async postAdmin\([\s\S]*if \(!response\.ok\)/)
  assert.doesNotMatch(source, /private async postAdmin\([\s\S]*await response\.json\(\)/)
})
