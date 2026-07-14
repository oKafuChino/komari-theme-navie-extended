import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

test('places the opt-in calculator before the theme action', async () => {
  const header = await source('src/components/Header.vue')
  assert.match(header, /import ResidualValueCalculator from ['"]\.\/ResidualValueCalculator\.vue['"]/)
  assert.match(header, /<ResidualValueCalculator\s+v-if="appStore\.residualValueEnabled"\s*\/>[\s\S]*<NPopover v-for="button in actionButtons"/)
})

test('uses a lightweight accessible right-side drawer', async () => {
  const component = await source('src/components/ResidualValueCalculator.vue')
  assert.match(component, /i-lucide-calculator/)
  assert.match(component, /aria-label="查看剩余价值"/)
  assert.match(component, /<NDrawer/)
  assert.match(component, /placement="right"/)
  assert.match(component, /width="min\(420px, 94vw\)"/)
  assert.match(component, /<NDrawerContent/)
  assert.match(component, /<NScrollbar/)
  assert.doesNotMatch(component, /NCard|setInterval|canvas|echarts/i)
})

test('loads rates only when opened and aborts work on close', async () => {
  const component = await source('src/components/ResidualValueCalculator.vue')
  assert.match(component, /watch\(showDrawer/)
  assert.match(component, /loadExchangeRates/)
  assert.match(component, /controller\.abort\(\)/)
  assert.match(component, /onUnmounted/)
  assert.match(component, /showDrawer\.value\s*\?\s*calculateResidualValueSummary/)
})

test('renders summary, source state, node rows, and exclusion reasons', async () => {
  const component = await source('src/components/ResidualValueCalculator.vue')
  assert.match(component, /summary\.total/)
  assert.match(component, /summary\.includedCount/)
  assert.match(component, /summary\.excludedCount/)
  assert.match(component, /rateSourceText/)
  assert.match(component, /v-for="row in summary\.rows"/)
  assert.match(component, /reasonText\(row\.reason\)/)
  assert.match(component, /按完整剩余天数估算/)
})
