import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let vite
let effects

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  effects = await vite.ssrLoadModule('/src/utils/ambientEffects.ts')
})

after(async () => {
  await vite.close()
})

test('selects desktop, touch, and reduced-motion profiles', () => {
  assert.deepEqual(effects.resolveAmbientProfile({ finePointer: true, reducedMotion: false }).name, 'desktop')
  assert.equal(effects.resolveAmbientProfile({ finePointer: true, reducedMotion: false }).fps, 60)
  assert.equal(effects.resolveAmbientProfile({ finePointer: false, reducedMotion: false }).fps, 30)
  assert.equal(effects.resolveAmbientProfile({ finePointer: false, reducedMotion: false }).cursorTrail, false)
  assert.equal(effects.resolveAmbientProfile({ finePointer: true, reducedMotion: true }), null)
})

test('caps DPR and total backing pixels', () => {
  const normal = effects.computeCanvasMetrics(1440, 900, 2)
  const fourK = effects.computeCanvasMetrics(3840, 2160, 2)

  assert.ok(normal.scale <= effects.MAX_CANVAS_DPR)
  assert.ok(normal.pixelWidth * normal.pixelHeight <= effects.MAX_CANVAS_PIXELS)
  assert.ok(fourK.scale < 1)
  assert.ok(fourK.pixelWidth * fourK.pixelHeight <= effects.MAX_CANVAS_PIXELS)
  assert.deepEqual(effects.computeCanvasMetrics(0, 900, 2), {
    cssWidth: 0,
    cssHeight: 900,
    pixelWidth: 0,
    pixelHeight: 0,
    scale: 0,
  })
})

test('keeps petal counts inside the approved ranges', () => {
  const desktop = effects.resolveAmbientProfile({ finePointer: true, reducedMotion: false })
  const touch = effects.resolveAmbientProfile({ finePointer: false, reducedMotion: false })

  assert.equal(effects.computePetalCount(1440, 900, desktop), 24)
  assert.equal(effects.computePetalCount(10000, 6000, desktop), 32)
  assert.equal(effects.computePetalCount(390, 844, touch), 10)
  assert.equal(effects.computePetalCount(100, 100, touch), 8)
})
