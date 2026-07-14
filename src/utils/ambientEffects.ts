export const MAX_CANVAS_DPR = 1.5
export const MAX_CANVAS_PIXELS = 2_100_000
export const MAX_STARS = 72
export const MAX_PETALS = 32

export type AmbientProfileName = 'desktop' | 'touch'

export interface AmbientRuntimeProfile {
  readonly name: AmbientProfileName
  readonly fps: 60 | 30
  readonly petalMin: number
  readonly petalMax: number
  readonly petalBase: number
  readonly referenceArea: number
  readonly cursorTrail: boolean
}

export interface AmbientProfileInput {
  finePointer: boolean
  reducedMotion: boolean
}

export interface CanvasMetrics {
  cssWidth: number
  cssHeight: number
  pixelWidth: number
  pixelHeight: number
  scale: number
}

const DESKTOP_PROFILE: AmbientRuntimeProfile = Object.freeze({
  name: 'desktop',
  fps: 60,
  petalMin: 18,
  petalMax: 32,
  petalBase: 24,
  referenceArea: 1440 * 900,
  cursorTrail: true,
})

const TOUCH_PROFILE: AmbientRuntimeProfile = Object.freeze({
  name: 'touch',
  fps: 30,
  petalMin: 8,
  petalMax: 14,
  petalBase: 10,
  referenceArea: 390 * 844,
  cursorTrail: false,
})

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function resolveAmbientProfile(input: AmbientProfileInput): AmbientRuntimeProfile | null {
  if (input.reducedMotion)
    return null
  return input.finePointer ? DESKTOP_PROFILE : TOUCH_PROFILE
}

export function computeCanvasMetrics(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): CanvasMetrics {
  if (cssWidth <= 0 || cssHeight <= 0) {
    return {
      cssWidth: Math.max(0, cssWidth),
      cssHeight: Math.max(0, cssHeight),
      pixelWidth: 0,
      pixelHeight: 0,
      scale: 0,
    }
  }

  const safeDpr = Math.max(0.1, devicePixelRatio || 1)
  const pixelBudgetScale = Math.sqrt(MAX_CANVAS_PIXELS / (cssWidth * cssHeight))
  const scale = Math.min(MAX_CANVAS_DPR, safeDpr, pixelBudgetScale)

  return {
    cssWidth,
    cssHeight,
    pixelWidth: Math.max(1, Math.floor(cssWidth * scale)),
    pixelHeight: Math.max(1, Math.floor(cssHeight * scale)),
    scale,
  }
}

export function computePetalCount(
  width: number,
  height: number,
  profile: AmbientRuntimeProfile,
): number {
  const area = Math.max(1, width * height)
  const scaled = Math.round(profile.petalBase * Math.sqrt(area / profile.referenceArea))
  return clamp(scaled, profile.petalMin, profile.petalMax)
}

export type AmbientLayer = 'sakura' | 'trail'

export interface AmbientEngineOptions {
  profile: AmbientRuntimeProfile
  dark: boolean
  sakuraEnabled: boolean
  cursorTrailEnabled: boolean
}

export interface AmbientEffectsDiagnostics {
  running: boolean
  frameCount: number
  petalCount: number
  starCount: number
  targetFps: 60 | 30
  drawP95Ms: number
}

export interface AmbientEngineDependencies {
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (handle: number) => void
  now?: () => number
  random?: () => number
  warn?: (message: string, error?: unknown) => void
  collectDiagnostics?: boolean
}

export interface AmbientEffectsController {
  start: () => void
  setVisible: (visible: boolean) => void
  setPointer: (x: number, y: number) => void
  setOptions: (options: AmbientEngineOptions) => void
  resize: (width: number, height: number, devicePixelRatio: number) => void
  getDiagnostics: () => AmbientEffectsDiagnostics
  destroy: () => void
}

interface PetalParticle {
  x: number
  y: number
  size: number
  speed: number
  sway: number
  phase: number
  rotation: number
  spin: number
  opacity: number
  color: number
}

interface StarParticle {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  size: number
  age: number
  life: number
  rotation: number
  color: number
}

const LIGHT_PETALS = ['rgba(232, 139, 164, 0.48)', 'rgba(244, 174, 190, 0.58)', 'rgba(218, 113, 145, 0.42)']
const DARK_PETALS = ['rgba(255, 166, 190, 0.62)', 'rgba(255, 194, 207, 0.68)', 'rgba(235, 132, 168, 0.56)']
const LIGHT_STARS = ['255, 248, 220', '255, 219, 151']
const DARK_STARS = ['255, 255, 238', '255, 226, 164']

function emptyPetal(): PetalParticle {
  return { x: 0, y: 0, size: 0, speed: 0, sway: 0, phase: 0, rotation: 0, spin: 0, opacity: 0, color: 0 }
}

function emptyStar(): StarParticle {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, size: 0, age: 0, life: 0, rotation: 0, color: 0 }
}

export interface CreateAmbientEffectsControllerInput {
  petalCanvas?: HTMLCanvasElement | null
  trailCanvas?: HTMLCanvasElement | null
  options: AmbientEngineOptions
  dependencies?: AmbientEngineDependencies
}

export function createAmbientEffectsController(
  input: CreateAmbientEffectsControllerInput,
): AmbientEffectsController {
  let options = { ...input.options }
  const dependencies = input.dependencies ?? {}
  const requestFrame = dependencies.requestFrame ?? (callback => window.requestAnimationFrame(callback))
  const cancelFrame = dependencies.cancelFrame ?? (handle => window.cancelAnimationFrame(handle))
  const now = dependencies.now ?? (() => performance.now())
  const random = dependencies.random ?? Math.random
  const warn = dependencies.warn ?? ((message: string, error?: unknown) => console.warn(message, error))
  const collectDiagnostics = dependencies.collectDiagnostics ?? false

  let petalCanvas = input.petalCanvas ?? null
  let trailCanvas = input.trailCanvas ?? null
  let petalContext: CanvasRenderingContext2D | null = null
  let trailContext: CanvasRenderingContext2D | null = null
  let metrics: CanvasMetrics = { cssWidth: 0, cssHeight: 0, pixelWidth: 0, pixelHeight: 0, scale: 0 }
  let petalCount = 0
  let frameHandle: number | null = null
  let lastRenderedAt: number | null = null
  let running = false
  let visible = true
  let destroyed = false
  let frameCount = 0
  let pointerSeen = false
  let pointerDirty = false
  let pointerX = 0
  let pointerY = 0
  let lastEmitX = 0
  let lastEmitY = 0
  let starCursor = 0
  let durationIndex = 0
  let durationCount = 0

  const warnedLayers = new Set<AmbientLayer>()
  const petals = Array.from({ length: MAX_PETALS }, emptyPetal)
  const stars = Array.from({ length: MAX_STARS }, emptyStar)
  const drawDurations = new Float32Array(120)

  function hasSakuraLayer(): boolean {
    return Boolean(options.sakuraEnabled && petalContext)
  }

  function hasTrailLayer(): boolean {
    return Boolean(options.cursorTrailEnabled && options.profile.cursorTrail && trailContext)
  }

  function hasActiveLayer(): boolean {
    return hasSakuraLayer() || hasTrailLayer()
  }

  function cancelScheduledFrame() {
    if (frameHandle !== null) {
      cancelFrame(frameHandle)
      frameHandle = null
    }
  }

  function deactivateStars() {
    for (let index = 0; index < stars.length; index++)
      stars[index]!.active = false
  }

  function failLayer(layer: AmbientLayer, error: unknown) {
    if (!warnedLayers.has(layer)) {
      warnedLayers.add(layer)
      warn(`[AmbientEffects] ${layer} layer disabled`, error)
    }

    if (layer === 'sakura') {
      petalCanvas?.remove()
      petalCanvas = null
      petalContext = null
      petalCount = 0
    }
    else {
      trailCanvas?.remove()
      trailCanvas = null
      trailContext = null
      deactivateStars()
    }

    if (!hasActiveLayer()) {
      cancelScheduledFrame()
      running = false
    }
  }

  function acquireContext(layer: AmbientLayer): CanvasRenderingContext2D | null {
    const canvas = layer === 'sakura' ? petalCanvas : trailCanvas
    if (!canvas)
      return null
    const context = canvas.getContext('2d')
    if (!context)
      failLayer(layer, new Error('Canvas 2D context unavailable'))
    return context
  }

  petalContext = acquireContext('sakura')
  trailContext = acquireContext('trail')

  function resetPetal(petal: PetalParticle, initial: boolean) {
    petal.x = random() * metrics.cssWidth
    petal.y = initial ? random() * metrics.cssHeight : -(10 + random() * 40)
    petal.size = 5 + random() * 7
    petal.speed = 12 + random() * 18
    petal.sway = 8 + random() * 14
    petal.phase = random() * Math.PI * 2
    petal.rotation = random() * Math.PI * 2
    petal.spin = -1.2 + random() * 2.4
    petal.opacity = 0.42 + random() * 0.34
    petal.color = Math.floor(random() * LIGHT_PETALS.length)
  }

  function resizeLayer(canvas: HTMLCanvasElement | null, context: CanvasRenderingContext2D | null) {
    if (!canvas || !context)
      return
    canvas.width = metrics.pixelWidth
    canvas.height = metrics.pixelHeight
    canvas.style.width = `${metrics.cssWidth}px`
    canvas.style.height = `${metrics.cssHeight}px`
    if (metrics.scale > 0)
      context.setTransform(metrics.scale, 0, 0, metrics.scale, 0, 0)
  }

  function resize(width: number, height: number, devicePixelRatio: number) {
    const nextMetrics = computeCanvasMetrics(width, height, devicePixelRatio)
    if (
      nextMetrics.pixelWidth === metrics.pixelWidth
      && nextMetrics.pixelHeight === metrics.pixelHeight
      && nextMetrics.cssWidth === metrics.cssWidth
      && nextMetrics.cssHeight === metrics.cssHeight
      && nextMetrics.scale === metrics.scale
    ) {
      return
    }

    metrics = nextMetrics
    resizeLayer(petalCanvas, petalContext)
    resizeLayer(trailCanvas, trailContext)
    petalCount = metrics.scale > 0 ? computePetalCount(width, height, options.profile) : 0
    for (let index = 0; index < petalCount; index++)
      resetPetal(petals[index]!, true)
    deactivateStars()
    pointerSeen = false
    pointerDirty = false
  }

  function drawPetal(context: CanvasRenderingContext2D, petal: PetalParticle) {
    const palette = options.dark ? DARK_PETALS : LIGHT_PETALS
    context.save()
    context.translate(petal.x, petal.y)
    context.rotate(petal.rotation)
    context.scale(1, 0.72)
    context.globalAlpha = petal.opacity
    context.fillStyle = palette[petal.color % palette.length]!
    context.beginPath()
    context.moveTo(0, 0)
    context.bezierCurveTo(petal.size * 0.8, -petal.size * 0.8, petal.size * 1.25, petal.size * 0.25, 0, petal.size * 1.45)
    context.bezierCurveTo(-petal.size * 1.25, petal.size * 0.25, -petal.size * 0.8, -petal.size * 0.8, 0, 0)
    context.fill()
    context.restore()
  }

  function renderPetals(deltaSeconds: number) {
    if (!petalContext)
      return
    petalContext.clearRect(0, 0, metrics.cssWidth, metrics.cssHeight)
    for (let index = 0; index < petalCount; index++) {
      const petal = petals[index]!
      petal.phase += deltaSeconds
      petal.y += petal.speed * deltaSeconds
      petal.x += Math.sin(petal.phase) * petal.sway * deltaSeconds
      petal.rotation += petal.spin * deltaSeconds
      if (petal.y > metrics.cssHeight + 20 || petal.x < -50 || petal.x > metrics.cssWidth + 50)
        resetPetal(petal, false)
      drawPetal(petalContext, petal)
    }
    petalContext.globalAlpha = 1
  }

  function activateStar(x: number, y: number, directionX: number, directionY: number) {
    const star = stars[starCursor]!
    starCursor = (starCursor + 1) % stars.length
    star.active = true
    star.x = x + (random() - 0.5) * 8
    star.y = y + (random() - 0.5) * 8
    star.vx = (random() - 0.5) * 18 - directionX * 0.04
    star.vy = 6 + random() * 12 - directionY * 0.02
    star.size = 1.1 + random() * 1.5
    star.age = 0
    star.life = 450 + random() * 250
    star.rotation = random() * Math.PI * 2
    star.color = random() > 0.68 ? 1 : 0
  }

  function emitStars() {
    if (!pointerDirty)
      return
    pointerDirty = false
    if (!pointerSeen) {
      pointerSeen = true
      lastEmitX = pointerX
      lastEmitY = pointerY
      return
    }

    const directionX = pointerX - lastEmitX
    const directionY = pointerY - lastEmitY
    const distance = Math.hypot(directionX, directionY)
    if (distance < 6)
      return

    const emittedStars = Math.min(3, Math.max(1, Math.floor(distance / 14)))
    for (let index = 0; index < emittedStars; index++)
      activateStar(pointerX, pointerY, directionX, directionY)
    lastEmitX = pointerX
    lastEmitY = pointerY
  }

  function drawStar(context: CanvasRenderingContext2D, star: StarParticle, alpha: number) {
    const palette = options.dark ? DARK_STARS : LIGHT_STARS
    context.save()
    context.translate(star.x, star.y)
    context.rotate(star.rotation)
    context.shadowBlur = 6
    context.shadowColor = `rgba(${palette[star.color]!}, ${alpha})`
    context.fillStyle = `rgba(${palette[star.color]!}, ${alpha})`
    context.beginPath()
    for (let point = 0; point < 8; point++) {
      const radius = point % 2 === 0 ? star.size * 2.2 : star.size * 0.55
      const angle = -Math.PI / 2 + point * Math.PI / 4
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (point === 0)
        context.moveTo(x, y)
      else
        context.lineTo(x, y)
    }
    context.closePath()
    context.fill()
    context.restore()
  }

  function renderStars(deltaMilliseconds: number, deltaSeconds: number) {
    if (!trailContext)
      return
    trailContext.clearRect(0, 0, metrics.cssWidth, metrics.cssHeight)
    emitStars()
    for (let index = 0; index < stars.length; index++) {
      const star = stars[index]!
      if (!star.active)
        continue
      star.age += deltaMilliseconds
      if (star.age >= star.life) {
        star.active = false
        continue
      }
      star.vy += 34 * deltaSeconds
      star.x += star.vx * deltaSeconds
      star.y += star.vy * deltaSeconds
      star.rotation += 1.4 * deltaSeconds
      drawStar(trailContext, star, (1 - star.age / star.life) * 0.92)
    }
  }

  function recordDrawDuration(duration: number) {
    if (!collectDiagnostics)
      return
    drawDurations[durationIndex] = duration
    durationIndex = (durationIndex + 1) % drawDurations.length
    durationCount = Math.min(durationCount + 1, drawDurations.length)
  }

  function scheduleFrame() {
    if (destroyed || !visible || !hasActiveLayer() || frameHandle !== null) {
      if (!hasActiveLayer())
        running = false
      return
    }
    running = true
    frameHandle = requestFrame(renderFrame)
  }

  function renderFrame(timestamp: number) {
    frameHandle = null
    if (destroyed || !visible || !hasActiveLayer()) {
      running = false
      return
    }

    const frameInterval = 1000 / options.profile.fps
    if (lastRenderedAt !== null && timestamp - lastRenderedAt < frameInterval - 0.5) {
      scheduleFrame()
      return
    }

    const deltaMilliseconds = Math.min(lastRenderedAt === null ? frameInterval : timestamp - lastRenderedAt, 50)
    lastRenderedAt = timestamp
    const deltaSeconds = deltaMilliseconds / 1000
    const drawStartedAt = collectDiagnostics ? now() : 0

    if (hasSakuraLayer()) {
      try {
        renderPetals(deltaSeconds)
      }
      catch (error) {
        failLayer('sakura', error)
      }
    }
    if (hasTrailLayer()) {
      try {
        renderStars(deltaMilliseconds, deltaSeconds)
      }
      catch (error) {
        failLayer('trail', error)
      }
    }

    if (collectDiagnostics)
      recordDrawDuration(Math.max(0, now() - drawStartedAt))
    frameCount++
    scheduleFrame()
  }

  function start() {
    if (destroyed || !visible || !hasActiveLayer()) {
      running = false
      return
    }
    scheduleFrame()
  }

  function setVisible(nextVisible: boolean) {
    visible = nextVisible
    lastRenderedAt = null
    if (!visible) {
      cancelScheduledFrame()
      running = false
      return
    }
    start()
  }

  function setPointer(x: number, y: number) {
    pointerX = x
    pointerY = y
    pointerDirty = true
  }

  function setOptions(nextOptions: AmbientEngineOptions) {
    options = { ...nextOptions }
    petalCount = metrics.scale > 0
      ? computePetalCount(metrics.cssWidth, metrics.cssHeight, options.profile)
      : 0
    if (!hasSakuraLayer() && petalContext)
      petalContext.clearRect(0, 0, metrics.cssWidth, metrics.cssHeight)
    if (!hasTrailLayer()) {
      trailContext?.clearRect(0, 0, metrics.cssWidth, metrics.cssHeight)
      deactivateStars()
    }
    lastRenderedAt = null
    start()
  }

  function percentile95(): number {
    if (durationCount === 0)
      return 0
    const values = Array.from({ length: durationCount }, () => 0)
    for (let index = 0; index < durationCount; index++)
      values[index] = drawDurations[index]!
    values.sort((left, right) => left - right)
    return values[Math.max(0, Math.ceil(values.length * 0.95) - 1)] ?? 0
  }

  function getDiagnostics(): AmbientEffectsDiagnostics {
    let starCount = 0
    for (let index = 0; index < stars.length; index++) {
      if (stars[index]!.active)
        starCount++
    }
    return {
      running,
      frameCount,
      petalCount: hasSakuraLayer() ? petalCount : 0,
      starCount,
      targetFps: options.profile.fps,
      drawP95Ms: percentile95(),
    }
  }

  function destroy() {
    destroyed = true
    running = false
    cancelScheduledFrame()
    petalContext?.clearRect(0, 0, metrics.cssWidth, metrics.cssHeight)
    trailContext?.clearRect(0, 0, metrics.cssWidth, metrics.cssHeight)
    if (petalCanvas) {
      petalCanvas.width = 0
      petalCanvas.height = 0
    }
    if (trailCanvas) {
      trailCanvas.width = 0
      trailCanvas.height = 0
    }
    deactivateStars()
    petalContext = null
    trailContext = null
    petalCanvas = null
    trailCanvas = null
  }

  return {
    start,
    setVisible,
    setPointer,
    setOptions,
    resize,
    getDiagnostics,
    destroy,
  }
}
