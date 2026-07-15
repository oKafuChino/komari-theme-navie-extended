import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

async function source(path) {
  return readFile(new URL(path, root), 'utf8')
}

test('verifies generated ZIP files after build and uploads artifacts from release', async () => {
  const pkg = await source('package.json')
  const workflow = await source('.github/workflows/build-ci.yml')
  const verifier = await source('scripts/verify-release.mjs')

  assert.match(pkg, /"verify:release": "node scripts\/verify-release\.mjs"/)
  assert.match(pkg, /&& pnpm verify:release/)
  assert.match(workflow, /release\/komari-theme-naive-extended-build-\*\.zip/)
  assert.match(workflow, /release\/komari-live2d-model-pack-template\.zip/)
  assert.match(verifier, /dist\/maps\/china-with-hk-macau-taiwan\.geo\.json/)
  assert.match(verifier, /live2dcubismcore\.min\.js/)
  assert.match(verifier, /forbiddenModelAsset/)
})
