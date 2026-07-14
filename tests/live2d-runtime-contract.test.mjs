import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test, { after, before } from 'node:test'
import { createServer } from 'vite'

let runtime
let vite

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  runtime = await vite.ssrLoadModule('/src/utils/live2dRuntime.ts')
})

after(async () => {
  await vite?.close()
})

function createHarness(profile = { name: 'desktop', activeFps: 60, idleFps: 15 }) {
  const calls = []
  const timers = new Map()
  let timerId = 0
  let frameCount = 0
  let fatal
  let focusFailure
  let now = 0
  const renderer = {
    setTargetFps: fps => calls.push(['fps', fps]),
    start: () => calls.push(['start']),
    stop: () => calls.push(['stop']),
    renderStatic: () => calls.push(['static']),
    resize: (...args) => calls.push(['resize', ...args]),
    setFocus: (x, y) => calls.push(['focus', x, y]),
    resetFocus: () => calls.push(['focus', 0, 0]),
    destroy: () => calls.push(['destroy']),
    getFrameCount: () => frameCount,
  }
  const dependencies = {
    loadCore: async () => calls.push(['core']),
    createRenderer: async (options) => {
      calls.push(['renderer'])
      fatal = options.onFatal
      focusFailure = options.onFocusError
      return renderer
    },
    setTimer: (callback, delay) => {
      const id = ++timerId
      timers.set(id, { callback, delay })
      return id
    },
    clearTimer: (id) => {
      timers.delete(id)
    },
    warn: message => calls.push(['warn', message]),
    now: () => now,
  }
  return {
    calls,
    dependencies,
    profile,
    renderer,
    timers,
    setFrameCount: (value) => { frameCount = value },
    setNow: (value) => { now = value },
    failRenderer: error => fatal(error),
    failFocus: error => focusFailure(error),
    fireTimer: () => {
      const entry = [...timers.entries()][0]
      assert.ok(entry)
      timers.delete(entry[0])
      entry[1].callback()
    },
  }
}

test('forwards focus and reset targets while preserving the runtime', async () => {
  const harness = createHarness()
  const handle = await runtime.createLive2DRuntime({
    canvas: {},
    modelUrl: new URL('https://site.test/live2d/model/model.model3.json'),
    profile: harness.profile,
    dependencies: harness.dependencies,
  })

  handle.setFocus(0.35, -0.22)
  handle.resetFocus()
  assert.deepEqual(harness.calls.filter(call => call[0] === 'focus'), [
    ['focus', 0.35, -0.22],
    ['focus', 0, 0],
  ])
  assert.equal(handle.getDiagnostics().destroyed, false)
})

test('rate-limits focus activity refresh and ignores focus after destroy', async () => {
  const harness = createHarness()
  const handle = await runtime.createLive2DRuntime({
    canvas: {},
    modelUrl: new URL('https://site.test/live2d/model/model.model3.json'),
    profile: harness.profile,
    dependencies: harness.dependencies,
  })

  const initialTimerId = [...harness.timers.keys()][0]
  harness.setNow(100)
  handle.setFocus(0.1, 0.1)
  assert.equal([...harness.timers.keys()][0], initialTimerId)

  harness.setNow(1100)
  handle.setFocus(0.2, 0.2)
  assert.notEqual([...harness.timers.keys()][0], initialTimerId)

  handle.destroy()
  const focusCallCount = harness.calls.filter(call => call[0] === 'focus').length
  handle.setFocus(0.3, 0.3)
  handle.resetFocus()
  assert.equal(harness.calls.filter(call => call[0] === 'focus').length, focusCallCount)
})

test('disables only focus after a focus-controller failure', async () => {
  const harness = createHarness()
  const handle = await runtime.createLive2DRuntime({
    canvas: {},
    modelUrl: new URL('https://site.test/live2d/model/model.model3.json'),
    profile: harness.profile,
    dependencies: harness.dependencies,
  })

  harness.failFocus(new Error('focus failed'))
  harness.failFocus(new Error('duplicate focus failure'))
  handle.setFocus(0.1, 0.1)

  assert.equal(harness.calls.filter(call => call[0] === 'warn').length, 1)
  assert.equal(harness.calls.filter(call => call[0] === 'destroy').length, 0)
  assert.equal(handle.getDiagnostics().destroyed, false)
})

test('keeps Pixi and Cubism 4 renderer imports lazy', async () => {
  const source = await readFile(new URL('../src/utils/live2dRuntime.ts', import.meta.url), 'utf8')
  const viteConfig = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8')
  assert.match(source, /import\(['"]pixi\.js['"]\)/)
  assert.match(source, /import\(['"]pixi-live2d-display\/cubism4['"]\)/)
  assert.match(source, /live2dcubismcore\.min\.js/)
  assert.match(source, /powerPreference:\s*['"]low-power['"]/)
  assert.doesNotMatch(source, /Ticker\.shared/)
  assert.doesNotMatch(viteConfig, /['"]live2d-vendor['"]\s*:/)
})

test('starts active, becomes idle after five seconds, and resumes active on interaction', async () => {
  const harness = createHarness()
  const handle = await runtime.createLive2DRuntime({
    canvas: {},
    modelUrl: new URL('https://site.test/live2d/model/model.model3.json'),
    profile: harness.profile,
    dependencies: harness.dependencies,
  })

  assert.deepEqual(harness.calls.slice(0, 4), [['core'], ['renderer'], ['fps', 60], ['start']])
  assert.equal([...harness.timers.values()][0].delay, 5000)
  harness.fireTimer()
  assert.deepEqual(harness.calls.at(-1), ['fps', 15])
  handle.setActivity(true)
  assert.deepEqual(harness.calls.at(-1), ['fps', 60])
})

test('pauses while hidden, caps resize DPR, and destroys once', async () => {
  const harness = createHarness()
  const handle = await runtime.createLive2DRuntime({
    canvas: {},
    modelUrl: new URL('https://site.test/live2d/model/model.model3.json'),
    profile: harness.profile,
    dependencies: harness.dependencies,
  })

  handle.setVisible(false)
  assert.deepEqual(harness.calls.at(-1), ['stop'])
  handle.setVisible(true)
  assert.deepEqual(harness.calls.slice(-2), [['fps', 60], ['start']])
  handle.resize(300, 420, 3)
  assert.deepEqual(harness.calls.at(-1), ['resize', 300, 420, 1.5])
  harness.setFrameCount(12)
  assert.deepEqual(handle.getDiagnostics(), { running: true, targetFps: 60, frameCount: 12, destroyed: false })
  handle.destroy()
  handle.destroy()
  assert.equal(harness.calls.filter(call => call[0] === 'destroy').length, 1)
  assert.deepEqual(handle.getDiagnostics(), { running: false, targetFps: 0, frameCount: 12, destroyed: true })
})

test('renders one static frame for reduced motion without starting a timer', async () => {
  const harness = createHarness(null)
  const handle = await runtime.createLive2DRuntime({
    canvas: {},
    modelUrl: new URL('https://site.test/live2d/model/model.model3.json'),
    profile: null,
    dependencies: harness.dependencies,
  })

  assert.equal(harness.calls.some(call => call[0] === 'start'), false)
  assert.equal(harness.calls.some(call => call[0] === 'static'), true)
  assert.equal(harness.timers.size, 0)
  assert.deepEqual(handle.getDiagnostics(), { running: false, targetFps: 0, frameCount: 0, destroyed: false })
  handle.resize(180, 260, 2)
  assert.deepEqual(harness.calls.slice(-2), [
    ['resize', 180, 260, 1.5],
    ['static'],
  ])
})

test('warns once and rejects when initialization fails', async () => {
  const warnings = []
  await assert.rejects(() => runtime.createLive2DRuntime({
    canvas: {},
    modelUrl: new URL('https://site.test/live2d/model/model.model3.json'),
    profile: { name: 'touch', activeFps: 24, idleFps: 12 },
    dependencies: {
      loadCore: async () => { throw new Error('core failed') },
      createRenderer: async () => { throw new Error('must not run') },
      warn: message => warnings.push(message),
    },
  }), /core failed/)
  assert.equal(warnings.length, 1)
})

test('destroys the runtime after a fatal renderer update', async () => {
  const harness = createHarness()
  const handle = await runtime.createLive2DRuntime({
    canvas: {},
    modelUrl: new URL('https://site.test/live2d/model/model.model3.json'),
    profile: harness.profile,
    dependencies: harness.dependencies,
  })

  harness.failRenderer(new Error('update failed'))
  harness.failRenderer(new Error('duplicate failure'))

  assert.equal(harness.calls.filter(call => call[0] === 'warn').length, 1)
  assert.equal(harness.calls.filter(call => call[0] === 'destroy').length, 1)
  assert.equal(handle.getDiagnostics().destroyed, true)
})

test('passes the owner signal to Core loading', async () => {
  const harness = createHarness()
  const controller = new AbortController()
  let receivedSignal
  harness.dependencies.loadCore = async (signal) => {
    receivedSignal = signal
  }

  const handle = await runtime.createLive2DRuntime({
    canvas: {},
    modelUrl: new URL('https://site.test/live2d/model/model.model3.json'),
    profile: harness.profile,
    signal: controller.signal,
    dependencies: harness.dependencies,
  })

  assert.equal(receivedSignal, controller.signal)
  handle.destroy()
})

test('does not cancel a shared Cubism Core load for a replacement caller', async () => {
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  const scripts = []
  const createScript = () => {
    const listeners = new Map()
    return {
      async: false,
      crossOrigin: '',
      src: '',
      addEventListener: (type, listener) => listeners.set(type, listener),
      remove: () => {},
      dispatch: type => listeners.get(type)?.(),
    }
  }
  globalThis.window = {}
  globalThis.document = {
    createElement: () => createScript(),
    head: { append: script => scripts.push(script) },
  }

  try {
    const isolatedRuntime = await vite.ssrLoadModule('/src/utils/live2dRuntime.ts?core-race-test')
    const firstOwner = new AbortController()
    const replacementOwner = new AbortController()
    const firstLoad = isolatedRuntime.loadLive2DCubismCore(firstOwner.signal)
    const replacementLoad = isolatedRuntime.loadLive2DCubismCore(replacementOwner.signal)
    firstOwner.abort()
    globalThis.window.Live2DCubismCore = {}
    scripts[0].dispatch('load')

    await assert.rejects(firstLoad, /aborted/)
    await replacementLoad
  }
  finally {
    globalThis.window = previousWindow
    globalThis.document = previousDocument
  }
})

test('destroys a renderer when its initial frame fails', async () => {
  for (const profile of [{ name: 'desktop', activeFps: 60, idleFps: 15 }, null]) {
    const harness = createHarness(profile)
    if (profile) {
      harness.renderer.start = () => {
        throw new Error('start failed')
      }
    }
    else {
      harness.renderer.renderStatic = () => {
        throw new Error('static failed')
      }
    }

    await assert.rejects(() => runtime.createLive2DRuntime({
      canvas: {},
      modelUrl: new URL('https://site.test/live2d/model/model.model3.json'),
      profile,
      dependencies: harness.dependencies,
    }), /failed/)
    assert.equal(harness.calls.filter(call => call[0] === 'destroy').length, 1)
    assert.equal(harness.calls.filter(call => call[0] === 'warn').length, 1)
  }
})

test('guards Pixi initialization and frame updates with cleanup paths', async () => {
  const source = await readFile(new URL('../src/utils/live2dRuntime.ts', import.meta.url), 'utf8')
  assert.match(source, /const disposeInitializingResources = \(\) => \{[\s\S]*initializingApp\?\.destroy\(false,/)
  assert.match(source, /catch \(error\) \{[\s\S]*disposeInitializingResources\(\)/)
  assert.match(source, /try \{[\s\S]*app\.ticker\.add\(renderFrame\)[\s\S]*fitModel\(initialWidth, initialHeight\)[\s\S]*catch \(error\)/)
  assert.match(source, /const renderFrame = \(\) => \{[\s\S]*try \{[\s\S]*model\.update/)
  assert.match(source, /catch \(error\) \{[\s\S]*options\.onFatal\(error\)/)
  assert.match(source, /WEBGL_lose_context/)
  assert.match(source, /signal\.addEventListener\('abort'/)
  assert.match(source, /script\.remove\(\)/)
  assert.match(source, /let pendingFocus:/)
  assert.match(source, /focusController\.focus\(target\.x, target\.y\)/)
  assert.match(source, /const renderFrame = \(\) => \{[\s\S]*applyPendingFocus\(\)[\s\S]*model\.update/)
  assert.doesNotMatch(source, /setFocus[\s\S]{0,300}model\.(?:x|y|scale)\s*=/)
  assert.doesNotMatch(source, /currentScale/)
  assert.doesNotMatch(source, /\*\s*\(\s*scale\s*\/\s*100\s*\)/)
})
