import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { createFakeCanvas, createFrameHarness } from './helpers/fake-canvas.mjs'

let vite
let effects

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  effects = await vite.ssrLoadModule('/src/utils/ambientEffects.ts')
})

after(async () => {
  await vite.close()
})

function desktopOptions() {
  return {
    profile: effects.resolveAmbientProfile({ finePointer: true, reducedMotion: false }),
    dark: false,
    sakuraEnabled: true,
    cursorTrailEnabled: true,
  }
}

test('runs both layers through one frame scheduler', () => {
  const petals = createFakeCanvas()
  const trail = createFakeCanvas()
  const frames = createFrameHarness()
  const controller = effects.createAmbientEffectsController({
    petalCanvas: petals.canvas,
    trailCanvas: trail.canvas,
    options: desktopOptions(),
    dependencies: {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      now: () => 0,
      random: () => 0.5,
    },
  })

  controller.resize(1440, 900, 2)
  controller.start()
  assert.equal(frames.hasPending(), true)
  frames.step(0)
  assert.equal(controller.getDiagnostics().frameCount, 1)
  assert.equal(frames.hasPending(), true)
  assert.ok(petals.calls.fill > 0)
  controller.destroy()
  assert.equal(frames.hasPending(), false)
})

test('caps stars and pauses while hidden', () => {
  const petals = createFakeCanvas()
  const trail = createFakeCanvas()
  const frames = createFrameHarness()
  const controller = effects.createAmbientEffectsController({
    petalCanvas: petals.canvas,
    trailCanvas: trail.canvas,
    options: desktopOptions(),
    dependencies: {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      now: () => 0,
      random: () => 0.5,
    },
  })

  controller.resize(1440, 900, 1)
  controller.start()
  frames.step(0)
  for (let index = 1; index <= 120; index++) {
    controller.setPointer(index * 42, 200)
    frames.step(index * 17)
  }
  assert.equal(controller.getDiagnostics().starCount, effects.MAX_STARS)
  controller.setVisible(false)
  assert.equal(frames.hasPending(), false)
  controller.setVisible(true)
  assert.equal(frames.hasPending(), true)
})

test('never emits a cursor trail for the touch profile', () => {
  const trail = createFakeCanvas()
  const frames = createFrameHarness()
  const controller = effects.createAmbientEffectsController({
    trailCanvas: trail.canvas,
    options: {
      profile: effects.resolveAmbientProfile({ finePointer: false, reducedMotion: false }),
      dark: false,
      sakuraEnabled: false,
      cursorTrailEnabled: true,
    },
    dependencies: {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      now: () => 0,
      random: () => 0.5,
    },
  })

  controller.resize(390, 844, 3)
  controller.start()
  assert.equal(frames.hasPending(), false)
  controller.setPointer(100, 100)
  assert.equal(controller.getDiagnostics().starCount, 0)
})

test('removes a failed layer and warns once', () => {
  const petals = createFakeCanvas({ throwOnFill: true })
  const frames = createFrameHarness()
  const warnings = []
  const controller = effects.createAmbientEffectsController({
    petalCanvas: petals.canvas,
    options: { ...desktopOptions(), cursorTrailEnabled: false },
    dependencies: {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      now: () => 0,
      random: () => 0.5,
      warn: message => warnings.push(message),
    },
  })

  controller.resize(1440, 900, 1)
  controller.start()
  frames.step(0)
  assert.equal(petals.calls.remove, 1)
  assert.equal(warnings.length, 1)
  assert.equal(controller.getDiagnostics().running, false)
})

test('skips an unavailable Canvas context without scheduling', () => {
  const petals = createFakeCanvas({ contextAvailable: false })
  const frames = createFrameHarness()
  const warnings = []
  const controller = effects.createAmbientEffectsController({
    petalCanvas: petals.canvas,
    options: { ...desktopOptions(), cursorTrailEnabled: false },
    dependencies: {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      warn: message => warnings.push(message),
    },
  })

  controller.resize(1440, 900, 1)
  controller.start()
  assert.equal(frames.hasPending(), false)
  assert.equal(petals.calls.remove, 1)
  assert.equal(warnings.length, 1)
})

test('skips a Canvas context that throws during acquisition', () => {
  const frames = createFrameHarness()
  const warnings = []
  const canvas = {
    getContext: () => {
      throw new Error('context blocked')
    },
    remove: () => {},
  }
  const controller = effects.createAmbientEffectsController({
    petalCanvas: canvas,
    options: { ...desktopOptions(), cursorTrailEnabled: false },
    dependencies: {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      warn: message => warnings.push(message),
    },
  })

  controller.resize(1440, 900, 1)
  controller.start()
  assert.equal(frames.hasPending(), false)
  assert.equal(warnings.length, 1)
})
