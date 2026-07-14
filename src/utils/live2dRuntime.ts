import type { Live2DRuntimeProfile } from '@/utils/live2dCompanion'
import { validateLive2DModelDocument } from '@/utils/live2dCompanion'

const CUBISM_CORE_URL = '/live2d/runtime/live2dcubismcore.min.js'
const MAX_LIVE2D_DPR = 1.5
const IDLE_DELAY_MS = 5000

export interface Live2DDiagnostics {
  running: boolean
  targetFps: number
  frameCount: number
  destroyed: boolean
}

interface Live2DRenderer {
  setTargetFps: (fps: number) => void
  start: () => void
  stop: () => void
  renderStatic: () => void
  resize: (width: number, height: number, dpr: number, scale: number) => void
  destroy: () => void
  getFrameCount: () => number
}

interface RendererFactoryOptions {
  canvas: HTMLCanvasElement
  modelUrl: URL
  signal?: AbortSignal
  scale: number
  onFatal: (error: unknown) => void
}

export interface Live2DRuntimeDependencies {
  loadCore?: (signal?: AbortSignal) => Promise<void>
  createRenderer?: (options: RendererFactoryOptions) => Promise<Live2DRenderer>
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void
  warn?: (message: string, error?: unknown) => void
}

export interface Live2DRuntimeOptions {
  canvas: HTMLCanvasElement
  modelUrl: URL
  profile: Live2DRuntimeProfile | null
  scale: number
  signal?: AbortSignal
  dependencies?: Live2DRuntimeDependencies
}

export interface Live2DHandle {
  setActivity: (active: boolean) => void
  setVisible: (visible: boolean) => void
  resize: (width: number, height: number, dpr: number, scale: number) => void
  getDiagnostics: () => Live2DDiagnostics
  destroy: () => void
}

let corePromise: Promise<void> | null = null

function hasCubismCore(): boolean {
  return typeof window !== 'undefined' && 'Live2DCubismCore' in window
}

function loadCubismCore(signal?: AbortSignal): Promise<void> {
  if (hasCubismCore())
    return Promise.resolve()
  if (corePromise)
    return corePromise

  corePromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    let settled = false
    let onAbort = () => {}
    const cleanup = () => signal?.removeEventListener('abort', onAbort)
    const fail = (error: unknown) => {
      if (settled)
        return
      settled = true
      cleanup()
      script.remove()
      corePromise = null
      reject(error)
    }
    const succeed = () => {
      if (settled)
        return
      if (hasCubismCore()) {
        settled = true
        cleanup()
        resolve()
      }
      else {
        fail(new Error('Cubism Core loaded without exposing Live2DCubismCore'))
      }
    }
    onAbort = () => fail(new DOMException('Cubism Core loading aborted', 'AbortError'))
    if (signal?.aborted) {
      onAbort()
      return
    }
    script.src = CUBISM_CORE_URL
    script.async = true
    script.crossOrigin = 'anonymous'
    script.addEventListener('load', succeed, { once: true })
    script.addEventListener('error', () => fail(new Error(`Failed to load Cubism Core from ${CUBISM_CORE_URL}`)), { once: true })
    signal?.addEventListener('abort', onAbort, { once: true })
    document.head.append(script)
  })
  return corePromise
}

async function createPixiRenderer(options: RendererFactoryOptions): Promise<Live2DRenderer> {
  const response = await fetch(options.modelUrl, {
    credentials: 'same-origin',
    signal: options.signal,
  })
  if (!response.ok)
    throw new Error(`Live2D model settings request failed with ${response.status}`)

  const modelDocument = await response.json() as Record<string, unknown>
  const invalidReferences = validateLive2DModelDocument(modelDocument, options.modelUrl)
  if (invalidReferences.length > 0)
    throw new Error(`Live2D model contains invalid references: ${invalidReferences.join(', ')}`)

  const [{ Application }, { Live2DModel }] = await Promise.all([
    import('pixi.js'),
    import('pixi-live2d-display/cubism4'),
  ])

  const modelSource = { ...modelDocument, url: options.modelUrl.href }
  let initializingApp: InstanceType<typeof Application> | null = null
  let initializingModel: InstanceType<typeof Live2DModel> | null = null
  const disposeInitializingResources = () => {
    const renderer = initializingApp?.renderer
    const loseContext = renderer ? (renderer as { gl?: WebGLRenderingContext }).gl?.getExtension('WEBGL_lose_context') : undefined
    initializingModel?.destroy({ children: true, texture: true, baseTexture: true })
    initializingApp?.destroy(false, { children: true, texture: true, baseTexture: true })
    loseContext?.loseContext()
    options.canvas.width = 0
    options.canvas.height = 0
  }
  try {
    initializingModel = await Live2DModel.from(modelSource, {
      autoInteract: false,
      autoUpdate: false,
      crossOrigin: 'anonymous',
    })
    if (options.signal?.aborted)
      throw new DOMException('Live2D model loading aborted', 'AbortError')

    const initialWidth = Math.max(1, options.canvas.clientWidth || 1)
    const initialHeight = Math.max(1, options.canvas.clientHeight || 1)
    initializingApp = new Application({
      view: options.canvas,
      width: initialWidth,
      height: initialHeight,
      backgroundAlpha: 0,
      antialias: false,
      autoDensity: true,
      autoStart: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
      resolution: Math.min(window.devicePixelRatio || 1, MAX_LIVE2D_DPR),
      sharedTicker: false,
    })
    initializingApp.stage.addChild(initializingModel)
  }
  catch (error) {
    disposeInitializingResources()
    throw error
  }

  const app = initializingApp
  const model = initializingModel
  const initialWidth = Math.max(1, options.canvas.clientWidth || 1)
  const initialHeight = Math.max(1, options.canvas.clientHeight || 1)

  let frameCount = 0
  let destroyed = false
  let fatalReported = false
  let currentScale = options.scale

  function fitModel(width: number, height: number) {
    const bounds = model.getLocalBounds()
    if (bounds.width <= 0 || bounds.height <= 0)
      return
    const fit = Math.min(width / bounds.width, height / bounds.height) * (currentScale / 100)
    model.scale.set(fit)
    model.x = width / 2 - (bounds.x + bounds.width / 2) * fit
    model.y = height - (bounds.y + bounds.height) * fit
  }

  const renderFrame = () => {
    try {
      model.update(app.ticker.deltaMS)
      frameCount++
    }
    catch (error) {
      if (fatalReported || destroyed)
        return
      fatalReported = true
      app.stop()
      queueMicrotask(() => {
        if (!destroyed)
          options.onFatal(error)
      })
    }
  }
  const reportFatal = (error: unknown) => {
    if (fatalReported || destroyed)
      return
    fatalReported = true
    app.stop()
    queueMicrotask(() => {
      if (!destroyed)
        options.onFatal(error)
    })
  }
  try {
    app.ticker.add(renderFrame)
    fitModel(initialWidth, initialHeight)
  }
  catch (error) {
    disposeInitializingResources()
    throw error
  }

  return {
    setTargetFps(fps) {
      app.ticker.maxFPS = fps
    },
    start() {
      if (!destroyed)
        app.start()
    },
    stop() {
      app.stop()
    },
    renderStatic() {
      if (destroyed)
        return
      try {
        app.stop()
        model.update(0)
        app.renderer.render(app.stage)
        frameCount++
      }
      catch (error) {
        reportFatal(error)
      }
    },
    resize(width, height, dpr, scale) {
      if (destroyed)
        return
      try {
        currentScale = scale
        app.renderer.resolution = Math.min(dpr, MAX_LIVE2D_DPR)
        app.renderer.resize(Math.max(1, width), Math.max(1, height))
        fitModel(width, height)
      }
      catch (error) {
        reportFatal(error)
      }
    },
    destroy() {
      if (destroyed)
        return
      destroyed = true
      app.stop()
      app.ticker.remove(renderFrame)
      app.stage.removeChild(model)
      const loseContext = (app.renderer as { gl?: WebGLRenderingContext }).gl?.getExtension('WEBGL_lose_context')
      model.destroy({ children: true, texture: true, baseTexture: true })
      app.destroy(false, { children: true, texture: true, baseTexture: true })
      loseContext?.loseContext()
      options.canvas.width = 0
      options.canvas.height = 0
    },
    getFrameCount: () => frameCount,
  }
}

export async function createLive2DRuntime(options: Live2DRuntimeOptions): Promise<Live2DHandle> {
  const dependencies = options.dependencies ?? {}
  const loadCore = dependencies.loadCore ?? loadCubismCore
  const createRenderer = dependencies.createRenderer ?? createPixiRenderer
  const setTimer = dependencies.setTimer ?? ((callback, delay) => setTimeout(callback, delay))
  const clearTimer = dependencies.clearTimer ?? (handle => clearTimeout(handle))
  const warn = dependencies.warn ?? ((message, error) => console.warn(message, error))

  let renderer: Live2DRenderer
  let handleFatal: (error: unknown) => void = () => {}
  try {
    await loadCore(options.signal)
    renderer = await createRenderer({
      canvas: options.canvas,
      modelUrl: options.modelUrl,
      signal: options.signal,
      scale: options.scale,
      onFatal: error => handleFatal(error),
    })
  }
  catch (error) {
    warn('[Live2D] initialization failed', error)
    throw error
  }

  let destroyed = false
  let visible = true
  let running = false
  let targetFps = 0
  let finalFrameCount = 0
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  function clearIdleTimer() {
    if (idleTimer === null)
      return
    clearTimer(idleTimer)
    idleTimer = null
  }

  function setRate(fps: number) {
    targetFps = fps
    renderer.setTargetFps(fps)
  }

  function becomeIdle() {
    idleTimer = null
    if (!destroyed && visible && options.profile)
      setRate(options.profile.idleFps)
  }

  function scheduleIdle() {
    clearIdleTimer()
    idleTimer = setTimer(becomeIdle, IDLE_DELAY_MS)
  }

  function activate() {
    if (destroyed || !visible || !options.profile)
      return
    try {
      setRate(options.profile.activeFps)
      renderer.start()
      running = true
      scheduleIdle()
    }
    catch (error) {
      handleFatal(error)
    }
  }

  function destroyRuntime() {
    if (destroyed)
      return
    destroyed = true
    running = false
    targetFps = 0
    clearIdleTimer()
    finalFrameCount = renderer.getFrameCount()
    renderer.destroy()
  }

  handleFatal = (error) => {
    if (destroyed)
      return
    warn('[Live2D] renderer update failed', error)
    destroyRuntime()
  }

  try {
    if (options.profile) {
      setRate(options.profile.activeFps)
      renderer.start()
      running = true
      scheduleIdle()
    }
    else {
      renderer.renderStatic()
    }
  }
  catch (error) {
    warn('[Live2D] initial render failed', error)
    destroyRuntime()
    throw error
  }

  return {
    setActivity(active) {
      if (destroyed || !visible || !options.profile)
        return
      clearIdleTimer()
      setRate(active ? options.profile.activeFps : options.profile.idleFps)
      if (active)
        scheduleIdle()
    },
    setVisible(nextVisible) {
      if (destroyed || visible === nextVisible)
        return
      visible = nextVisible
      clearIdleTimer()
      if (!visible) {
        renderer.stop()
        running = false
        targetFps = 0
        return
      }
      if (options.profile)
        activate()
      else
        renderer.renderStatic()
    },
    resize(width, height, dpr, scale) {
      if (!destroyed) {
        renderer.resize(width, height, Math.min(dpr || 1, MAX_LIVE2D_DPR), scale)
        if (!options.profile && visible)
          renderer.renderStatic()
      }
    },
    getDiagnostics() {
      return {
        running,
        targetFps: destroyed || !running ? 0 : targetFps,
        frameCount: destroyed ? finalFrameCount : renderer.getFrameCount(),
        destroyed,
      }
    },
    destroy() {
      destroyRuntime()
    },
  }
}
