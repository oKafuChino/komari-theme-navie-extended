import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('documents residual-value calculation and exchange-rate privacy behavior', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
  assert.match(readme, /剩余价值计算器/)
  assert.match(readme, /jsDelivr/)
  assert.match(readme, /访客.*IP/)
  assert.match(readme, /12 小时/)
  assert.match(readme, /备用汇率/)
  assert.match(readme, /不修改 Komari 后端/)
})
