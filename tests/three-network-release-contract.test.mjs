import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('documents the administrator-only bounded TCP test', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')

  assert.match(readme, /三网 TCP 延迟/)
  assert.match(readme, /管理员/)
  assert.match(readme, /93/)
  assert.match(readme, /24/)
  assert.match(readme, /不修改 Komari 后端或 Agent/)
  assert.match(readme, /zstaticcdn\.com/)
})
