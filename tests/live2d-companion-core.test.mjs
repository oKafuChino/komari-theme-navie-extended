import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { createServer } from 'vite'

let core
let vite

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  core = await vite.ssrLoadModule('/src/utils/live2dCompanion.ts')
})

after(async () => {
  await vite?.close()
})

test('resolves desktop, touch, and reduced-motion profiles', () => {
  assert.deepEqual(core.resolveLive2DProfile({ finePointer: true, reducedMotion: false }), {
    name: 'desktop',
    activeFps: 60,
    idleFps: 15,
  })
  assert.deepEqual(core.resolveLive2DProfile({ finePointer: false, reducedMotion: false }), {
    name: 'touch',
    activeFps: 24,
    idleFps: 12,
  })
  assert.equal(core.resolveLive2DProfile({ finePointer: true, reducedMotion: true }), null)
})

test('clamps scale and selects both messages deterministically', () => {
  assert.equal(core.clampLive2DScale(20), 50)
  assert.equal(core.clampLive2DScale(175), 150)
  assert.equal(core.clampLive2DScale('100'), 100)
  assert.equal(core.pickLive2DMessage(() => 0), '喵喵喵？不要随便摸我啦~')
  assert.equal(core.pickLive2DMessage(() => 0.99), '请问...有什么可以帮忙的吗？')
})

test('normalizes page coordinates to subtle Live2D focus targets', () => {
  assert.deepEqual(core.resolveLive2DFocusTarget(0, 0, 1000, 500), { x: -0.35, y: 0.22 })
  assert.deepEqual(core.resolveLive2DFocusTarget(500, 250, 1000, 500), { x: 0, y: 0 })
  assert.deepEqual(core.resolveLive2DFocusTarget(1000, 500, 1000, 500), { x: 0.35, y: -0.22 })
  assert.deepEqual(core.resolveLive2DFocusTarget(2000, -500, 1000, 500), { x: 0.35, y: 0.22 })
})

test('rejects unusable Live2D focus coordinates and viewports', () => {
  assert.equal(core.resolveLive2DFocusTarget(Number.NaN, 1, 100, 100), null)
  assert.equal(core.resolveLive2DFocusTarget(1, Number.POSITIVE_INFINITY, 100, 100), null)
  assert.equal(core.resolveLive2DFocusTarget(1, 1, 0, 100), null)
  assert.equal(core.resolveLive2DFocusTarget(1, 1, 100, -1), null)
})

test('scales desktop and mobile Live2D viewports proportionally', () => {
  assert.deepEqual(core.resolveLive2DViewportMetrics(50), {
    desktop: { minWidthPx: 110, fluidWidthVw: 11, maxWidthPx: 160, maxHeightVh: 21, heightCapPx: 220 },
    mobile: { fluidWidthVw: 21, maxWidthPx: 95, maxHeightVh: 16, heightCapPx: 150 },
  })
  assert.deepEqual(core.resolveLive2DViewportMetrics(100), {
    desktop: { minWidthPx: 220, fluidWidthVw: 22, maxWidthPx: 320, maxHeightVh: 42, heightCapPx: 440 },
    mobile: { fluidWidthVw: 42, maxWidthPx: 190, maxHeightVh: 32, heightCapPx: 300 },
  })
  assert.deepEqual(core.resolveLive2DViewportMetrics(150), {
    desktop: { minWidthPx: 330, fluidWidthVw: 33, maxWidthPx: 480, maxHeightVh: 63, heightCapPx: 660 },
    mobile: { fluidWidthVw: 63, maxWidthPx: 285, maxHeightVh: 48, heightCapPx: 450 },
  })
})

test('probes WebGL without retaining the temporary context', () => {
  let lost = 0
  const context = {
    getExtension: name => name === 'WEBGL_lose_context'
      ? { loseContext: () => { lost++ } }
      : null,
  }
  assert.equal(core.supportsLive2DWebGL(() => ({ getContext: type => type === 'webgl2' ? context : null })), true)
  assert.equal(lost, 1)
  assert.equal(core.supportsLive2DWebGL(() => ({ getContext: () => null })), false)
  assert.equal(core.supportsLive2DWebGL(() => ({
    getContext: () => {
      throw new Error('blocked')
    },
  })), false)
})

test('accepts only model entries inside the fixed Live2D resource pack', () => {
  assert.equal(
    core.resolveLive2DModelPath(
      '/themes/komari-live2d-models/dist/model/chino/XFZN.model3.json',
      'https://site.test',
    )?.href,
    'https://site.test/themes/komari-live2d-models/dist/model/chino/XFZN.model3.json',
  )
  assert.equal(
    core.resolveLive2DModelPath(
      '/themes/komari-live2d-models/dist/model/智乃/看板娘.model3.json',
      'https://site.test',
    )?.pathname,
    '/themes/komari-live2d-models/dist/model/%E6%99%BA%E4%B9%83/%E7%9C%8B%E6%9D%BF%E5%A8%98.model3.json',
  )
  assert.equal(core.resolveLive2DModelPath('/live2d/model/model.model3.json', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('/themes/other/dist/model/model.model3.json', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('https://evil.test/model.model3.json', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('/themes/komari-live2d-models/dist/model/../x.model3.json', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('/themes/komari-live2d-models/dist/model/%2e%2e/x.model3.json', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('/themes/komari-live2d-models/dist/model/a%5cb.model3.json', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('/themes/komari-live2d-models/dist/model/model.model3.json?x=1', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('/themes/komari-live2d-models/dist/model/model.model3.json#x', 'https://site.test'), null)
})

test('normalizes invalid model-pack settings to the fixed default', () => {
  assert.equal(
    core.normalizeLive2DModelPath('/themes/komari-live2d-models/dist/model/chino/chino.model3.json'),
    '/themes/komari-live2d-models/dist/model/chino/chino.model3.json',
  )
  assert.equal(core.normalizeLive2DModelPath('/live2d/model/model.model3.json'), core.DEFAULT_LIVE2D_MODEL_PATH)
  assert.equal(core.normalizeLive2DModelPath(null), core.DEFAULT_LIVE2D_MODEL_PATH)
})

test('validates every supported model reference inside the model directory', () => {
  const modelUrl = new URL('https://site.test/themes/komari-live2d-models/dist/model/chino/XFZN.model3.json')
  const valid = {
    FileReferences: {
      Moc: 'XFZN.moc3',
      Textures: ['XFZN.2048/texture_00.png'],
      Physics: 'XFZN.physics3.json',
      DisplayInfo: 'XFZN.cdi3.json',
      Expressions: [{ Name: 'smile', File: 'expressions/smile.exp3.json' }],
      Motions: { Idle: [{ File: 'motions/idle.motion3.json', Sound: 'motions/idle.wav' }] },
    },
  }
  assert.deepEqual(core.validateLive2DModelDocument(valid, modelUrl), [])

  const invalid = structuredClone(valid)
  invalid.FileReferences.Textures.push('../runtime/texture.png')
  invalid.FileReferences.Expressions[0].File = 'https://evil.test/smile.exp3.json'
  invalid.FileReferences.Motions.Idle[0].Sound = '/outside.wav'
  assert.deepEqual(core.validateLive2DModelDocument(invalid, modelUrl), [
    'FileReferences.Textures[1]',
    'FileReferences.Expressions[0].File',
    'FileReferences.Motions.Idle[0].Sound',
  ])

  const absoluteReference = structuredClone(valid)
  absoluteReference.FileReferences.Textures = [
    '/themes/komari-live2d-models/dist/model/chino/XFZN.2048/texture_00.png',
  ]
  assert.deepEqual(core.validateLive2DModelDocument(absoluteReference, modelUrl), [
    'FileReferences.Textures[0]',
  ])
})

test('requires a moc and at least one texture', () => {
  const modelUrl = new URL('https://site.test/themes/komari-live2d-models/dist/model/model.model3.json')
  assert.deepEqual(core.validateLive2DModelDocument({ FileReferences: { Textures: [] } }, modelUrl), [
    'FileReferences.Moc',
    'FileReferences.Textures',
  ])
})

test('stores only Boolean session sentinels and survives unavailable storage', () => {
  const values = new Map()
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  assert.equal(core.readSessionFlag(storage, core.LIVE2D_GREETING_KEY), false)
  core.writeSessionFlag(storage, core.LIVE2D_GREETING_KEY)
  assert.equal(core.readSessionFlag(storage, core.LIVE2D_GREETING_KEY), true)
  assert.deepEqual([...values.entries()], [[core.LIVE2D_GREETING_KEY, '1']])

  const blockedStorage = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
  }
  core.writeSessionFlag(blockedStorage, 'blocked-storage-key')
  assert.equal(core.readSessionFlag(blockedStorage, 'blocked-storage-key'), true)
})

test('accepts valid IPv4 and IPv6 values only', () => {
  assert.equal(core.validateVisitorIp('203.0.113.8'), '203.0.113.8')
  assert.equal(core.validateVisitorIp('2001:db8::1'), '2001:db8::1')
  assert.equal(core.validateVisitorIp('999.0.0.1'), null)
  assert.equal(core.validateVisitorIp('<script>'), null)
  assert.equal(core.validateVisitorIp('a'.repeat(65)), null)
})
