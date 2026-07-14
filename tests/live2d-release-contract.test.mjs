import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

async function text(path) {
  return readFile(new URL(path, root), 'utf8')
}

test('keeps character models and model guidance out of the main theme', async () => {
  const mainThemeModelFiles = await readdir(new URL('public/live2d/model/', root)).catch((error) => {
    if (error?.code === 'ENOENT')
      return []
    throw error
  })
  assert.deepEqual(mainThemeModelFiles, [])
  const guide = await text('packaging/live2d-model-pack/dist/model/README.txt')
  assert.match(guide, /Cubism 3\/4/)
  assert.match(guide, /\.model3\.json/)
  assert.match(guide, /保持.*相对.*目录/)
  assert.match(guide, /2048.*16 MiB/s)
})

test('documents the browser-side IP disclosure and no-backend boundary', async () => {
  const readme = await text('README.md')
  assert.match(readme, /api64\.ipify\.org/)
  assert.match(readme, /不会.*保存.*IP/)
  assert.match(readme, /不修改 Komari 后端/)
  assert.match(readme, /dist\/live2d\/model\//)
})

test('ships an official Cubism Core runtime with third-party notice', async () => {
  const corePath = new URL('public/live2d/runtime/live2dcubismcore.min.js', root)
  const core = await text('public/live2d/runtime/live2dcubismcore.min.js')
  const coreStat = await stat(corePath)
  const notice = await text('public/live2d/runtime/THIRD-PARTY-NOTICES.txt')

  assert.ok(coreStat.size > 50_000)
  assert.match(core, /Live2DCubismCore/)
  assert.match(notice, /Live2D Cubism Core/)
  assert.match(notice, /cubism\.live2d\.com\/sdk-web\/cubismcore\/live2dcubismcore\.min\.js/)
  assert.match(notice, /Live2D Proprietary Software License Agreement/)
  assert.doesNotMatch(notice, /MIT-licensed|MIT License applies to Live2D Cubism Core/)
})
