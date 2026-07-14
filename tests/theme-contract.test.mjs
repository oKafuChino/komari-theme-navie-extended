import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

async function readText(path) {
  return readFile(new URL(path, root), 'utf8')
}

async function readJson(path) {
  return JSON.parse(await readText(path))
}

test('uses the independent Extended identity', async () => {
  const pkg = await readJson('package.json')
  const manifest = await readJson('komari-theme.json')

  assert.equal(pkg.name, 'komari-theme-naive-extended')
  assert.equal(pkg.version, '1.0.0')
  assert.equal(pkg.author, 'lyimoexiao & oKafuChino')
  assert.equal(pkg.homepage, 'https://github.com/oKafuChino/komari-theme-navie-extended')
  assert.equal(manifest.name, 'Komari Naive Extended')
  assert.equal(manifest.short, 'NaiveExtended')
  assert.equal(manifest.version, '1.0.0')
  assert.equal(manifest.author, 'lyimoexiao & oKafuChino')
  assert.equal(manifest.url, 'https://github.com/oKafuChino/komari-theme-navie-extended')
})

test('uses the Extended release artifact everywhere', async () => {
  const vite = await readText('vite.config.ts')
  const workflow = await readText('.github/workflows/build-ci.yml')
  const ignore = await readText('.gitignore')
  const readme = await readText('README.md')

  assert.match(vite, /komari-theme-naive-extended-build-\$\{commitHash\}\.zip/)
  assert.match(workflow, /komari-theme-naive-extended-build\*\.zip/)
  assert.match(workflow, /komari-live2d-model-pack-template\.zip/)
  assert.match(ignore, /^\.superpowers\/$/m)
  assert.match(ignore, /^komari-theme-naive-extended-build-\*\.zip$/m)
  assert.match(ignore, /^komari-live2d-model-pack-template\.zip$/m)
  assert.match(readme, /Komari Naive Extended/)
  assert.match(readme, /lyimoexiao\/komari-theme-naive/)
})

test('keeps implementation documents outside runtime lint processing', async () => {
  const eslint = await readText('eslint.config.mjs')

  assert.match(eslint, /ignores:\s*\[\s*'docs\/superpowers\/\*\*'/)
})
