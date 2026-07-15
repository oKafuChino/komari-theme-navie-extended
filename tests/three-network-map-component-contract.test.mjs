import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('loads a local China GeoJSON only from the map component and renders a passive map', async () => {
  const component = await readFile(new URL('../src/components/ThreeNetworkTcpMap.vue', import.meta.url), 'utf8')
  const geojson = await readFile(new URL('../public/maps/china-with-hk-macau-taiwan.geo.json', import.meta.url), 'utf8')

  assert.match(component, /fetch\('\/maps\/china-with-hk-macau-taiwan\.geo\.json'\)/)
  assert.match(component, /registerMap\('china-with-hk-macau-taiwan'/)
  assert.match(component, /onBeforeUnmount/)
  assert.match(component, /chart\.dispose\(\)/)
  assert.match(component, /item\.carriers/)
  assert.doesNotMatch(component, /getSharedApi|createThreeNetworkTaskRpc|runThreeNetworkTcpTest/)
  assert.match(geojson, /香港/)
  assert.match(geojson, /澳门/)
  assert.match(geojson, /台湾/)
})
