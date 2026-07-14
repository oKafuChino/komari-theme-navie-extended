import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const execFileAsync = promisify(execFile)

async function text(path) {
  return readFile(new URL(path, root), 'utf8')
}

async function walk(url, prefix = '') {
  const entries = await readdir(url, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relative = `${prefix}${entry.name}`
    if (entry.isDirectory())
      files.push(...await walk(new URL(`${entry.name}/`, url), `${relative}/`))
    else
      files.push(relative)
  }
  return files.sort()
}

test('declares the fixed independent Live2D resource theme identity', async () => {
  const manifest = JSON.parse(await text('packaging/live2d-model-pack/komari-theme.json'))
  assert.deepEqual(manifest, {
    name: 'Live2D 模型资源包（请勿设为当前主题）',
    short: 'komari-live2d-models',
    version: '1.0.0',
    configuration: { type: 'managed', data: [] },
  })
})

test('ships only model-free template inputs and a nonempty preview', async () => {
  const packRoot = new URL('packaging/live2d-model-pack/', root)
  assert.deepEqual(await walk(packRoot), [
    'dist/index.html',
    'dist/model/README.txt',
    'komari-theme.json',
    'preview.png',
  ])
  assert.ok((await stat(new URL('preview.png', packRoot))).size > 1000)
  const files = await walk(packRoot)
  assert.equal(files.some(file => /\.(?:moc3|model3\.json|motion3\.json|exp3\.json|wav|mp3|ogg)$/i.test(file)), false)
  assert.equal(files.some(file => /XFZN/i.test(file)), false)
})

test('tracks every model-pack source file for clean release builds', async () => {
  const { stdout } = await execFileAsync('git', [
    'ls-files',
    '--',
    'packaging/live2d-model-pack',
  ], { cwd: new URL('../', import.meta.url) })
  assert.deepEqual(stdout.trim().split('\n').filter(Boolean).sort(), [
    'packaging/live2d-model-pack/dist/index.html',
    'packaging/live2d-model-pack/dist/model/README.txt',
    'packaging/live2d-model-pack/komari-theme.json',
    'packaging/live2d-model-pack/preview.png',
  ])
})

test('warns administrators not to activate or delete the resource theme', async () => {
  const page = await text('packaging/live2d-model-pack/dist/index.html')
  const guide = await text('packaging/live2d-model-pack/dist/model/README.txt')
  assert.match(page, /Live2D 模型资源包/)
  assert.match(page, /请勿.*当前主题/)
  assert.match(page, /请勿删除/)
  assert.match(page, /href="\/admin"/)
  assert.match(guide, /dist\/model\//)
  assert.match(guide, /\.model3\.json/)
  assert.match(guide, /保持.*相对.*目录/)
  assert.match(guide, /2048.*16 MiB/)
})

test('builds the resource template as a second fixed-name ZIP', async () => {
  const vite = await text('vite.config.ts')
  assert.match(vite, /komari-theme-naive-extended-build-\$\{commitHash\}\.zip/)
  assert.match(vite, /komari-live2d-model-pack-template\.zip/)
  assert.match(vite, /packaging[\\/]live2d-model-pack/)
  assert.match(vite, /archive\.directory\(modelPackDistDir, 'dist'\)/)
})
