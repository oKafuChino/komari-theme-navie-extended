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

test('maps each province in mobile-unicom-telecom order and averages valid values', async () => {
  const { buildThreeNetworkProvinceMap } = await vite.ssrLoadModule('/src/utils/threeNetworkMap.ts')
  const values = Array.from({ length: 93 }).fill(null)
  values[0] = 60
  values[1] = 30
  values[2] = 90

  const [hebei] = buildThreeNetworkProvinceMap({
    testedAt: '2026-07-15T00:00:00.000Z',
    values,
  })

  assert.deepEqual(hebei.carriers, [
    { name: '移动', value: 30 },
    { name: '联通', value: 60 },
    { name: '电信', value: 90 },
  ])
  assert.equal(hebei.average, 60)
  assert.equal(hebei.band, 'teal')
})

test('uses only valid values and keeps Hong Kong, Macau and Taiwan untested', async () => {
  const { buildThreeNetworkProvinceMap, latencyBand } = await vite.ssrLoadModule('/src/utils/threeNetworkMap.ts')
  const values = Array.from({ length: 93 }).fill(null)
  values[0] = 100
  const [hebei] = buildThreeNetworkProvinceMap({
    testedAt: '2026-07-15T00:00:00.000Z',
    values,
  })

  assert.equal(hebei.average, 100)
  assert.equal(hebei.band, 'teal')
  assert.equal(buildThreeNetworkProvinceMap().find(item => item.code === 'hk')?.isTested, false)
  assert.deepEqual(
    [null, 50, 51, 100, 101, 180, 181, 300, 301].map(latencyBand),
    ['empty', 'good', 'teal', 'teal', 'warn', 'warn', 'slow', 'slow', 'bad'],
  )
})
