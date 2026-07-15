export const LIVE2D_GREETING_KEY = 'komari-naive-extended:live2d:greeted'
export const LIVE2D_HIDDEN_KEY = 'komari-naive-extended:live2d:hidden'
export const LIVE2D_MESSAGES = [
  '喵喵喵？不要随便摸我啦~',
  '请问...有什么可以帮忙的吗？',
] as const
export const LIVE2D_FOCUS_X_AMPLITUDE = 0.35
export const LIVE2D_FOCUS_Y_AMPLITUDE = 0.22
export const LIVE2D_MODEL_PACK_PREFIXES = Object.freeze([
  '/themes/komari-live2d-models/dist/model/',
  '/theme/komari-live2d-models/dist/model/',
] as const)
export const DEFAULT_LIVE2D_MODEL_PATH = `${LIVE2D_MODEL_PACK_PREFIXES[0]}model.model3.json`

export type Live2DProfileName = 'desktop' | 'touch'

export interface Live2DRuntimeProfile {
  readonly name: Live2DProfileName
  readonly activeFps: 60 | 24
  readonly idleFps: 15 | 12
}

export interface Live2DFocusTarget {
  readonly x: number
  readonly y: number
}

export interface Live2DProfileInput {
  finePointer: boolean
  reducedMotion: boolean
}

interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

const DESKTOP_PROFILE: Live2DRuntimeProfile = Object.freeze({
  name: 'desktop',
  activeFps: 60,
  idleFps: 15,
})

const TOUCH_PROFILE: Live2DRuntimeProfile = Object.freeze({
  name: 'touch',
  activeFps: 24,
  idleFps: 12,
})

const memorySessionFlags = new Set<string>()

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function resolveLive2DFocusTarget(
  clientX: number,
  clientY: number,
  viewportWidth: number,
  viewportHeight: number,
): Live2DFocusTarget | null {
  if (
    !Number.isFinite(clientX)
    || !Number.isFinite(clientY)
    || !Number.isFinite(viewportWidth)
    || !Number.isFinite(viewportHeight)
    || viewportWidth <= 0
    || viewportHeight <= 0
  ) {
    return null
  }

  const normalizedX = clamp(clientX / viewportWidth * 2 - 1, -1, 1)
  const normalizedY = clamp(1 - clientY / viewportHeight * 2, -1, 1)
  return {
    x: normalizedX * LIVE2D_FOCUS_X_AMPLITUDE,
    y: normalizedY * LIVE2D_FOCUS_Y_AMPLITUDE,
  }
}

export function resolveLive2DProfile(input: Live2DProfileInput): Live2DRuntimeProfile | null {
  if (input.reducedMotion)
    return null
  return input.finePointer ? DESKTOP_PROFILE : TOUCH_PROFILE
}

export function clampLive2DScale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return 100
  return Math.min(150, Math.max(50, value))
}

export interface Live2DViewportMetrics {
  desktop: {
    minWidthPx: number
    fluidWidthVw: number
    maxWidthPx: number
    maxHeightVh: number
    heightCapPx: number
  }
  mobile: {
    fluidWidthVw: number
    maxWidthPx: number
    maxHeightVh: number
    heightCapPx: number
  }
}

export function resolveLive2DViewportMetrics(scale: unknown): Live2DViewportMetrics {
  const factor = clampLive2DScale(scale) / 100
  return {
    desktop: {
      minWidthPx: 220 * factor,
      fluidWidthVw: 22 * factor,
      maxWidthPx: 320 * factor,
      maxHeightVh: 42 * factor,
      heightCapPx: 440 * factor,
    },
    mobile: {
      fluidWidthVw: 42 * factor,
      maxWidthPx: 190 * factor,
      maxHeightVh: 32 * factor,
      heightCapPx: 300 * factor,
    },
  }
}

export function supportsLive2DWebGL(
  createCanvas: () => Pick<HTMLCanvasElement, 'getContext'> = () => document.createElement('canvas'),
): boolean {
  try {
    const canvas = createCanvas()
    const options: WebGLContextAttributes = {
      failIfMajorPerformanceCaveat: true,
      powerPreference: 'low-power',
    }
    const context = canvas.getContext('webgl2', options) ?? canvas.getContext('webgl', options)
    if (!context)
      return false
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  }
  catch {
    return false
  }
}

function hasUnsafeTraversal(path: string): boolean {
  if (!path)
    return true
  try {
    const decoded = decodeURIComponent(path)
    return decoded.includes('\\') || decoded.split('/').includes('..')
  }
  catch {
    return true
  }
}

export function isValidLive2DModelPath(value: unknown): value is string {
  if (typeof value !== 'string' || value !== value.trim() || hasUnsafeTraversal(value))
    return false
  try {
    const base = new URL('https://komari.invalid/')
    const resolved = new URL(value, base)
    return resolved.origin === base.origin
      && !resolved.username
      && !resolved.password
      && !resolved.search
      && !resolved.hash
      && LIVE2D_MODEL_PACK_PREFIXES.some(prefix => resolved.pathname.startsWith(prefix))
      && resolved.pathname.toLowerCase().endsWith('.model3.json')
  }
  catch {
    return false
  }
}

export function normalizeLive2DModelPath(value: unknown): string {
  if (typeof value !== 'string')
    return DEFAULT_LIVE2D_MODEL_PATH
  const path = value.trim()
  return isValidLive2DModelPath(path) ? path : DEFAULT_LIVE2D_MODEL_PATH
}

export function resolveLive2DModelPath(path: string, origin: string): URL | null {
  if (!isValidLive2DModelPath(path))
    return null

  try {
    const base = new URL(origin)
    const resolved = new URL(path, base)
    if (
      resolved.origin !== base.origin
      || resolved.username
      || resolved.password
    ) {
      return null
    }
    return resolved
  }
  catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeModelReference(reference: unknown, modelUrl: URL): boolean {
  if (
    typeof reference !== 'string'
    || reference.startsWith('/')
    || reference.startsWith('//')
    || /^[a-z][a-z\d+.-]*:/i.test(reference)
    || hasUnsafeTraversal(reference)
  ) {
    return false
  }
  try {
    const modelDirectory = new URL('.', modelUrl)
    const resolved = new URL(reference, modelUrl)
    return resolved.origin === modelUrl.origin
      && !resolved.username
      && !resolved.password
      && !resolved.search
      && !resolved.hash
      && resolved.pathname.startsWith(modelDirectory.pathname)
  }
  catch {
    return false
  }
}

export function validateLive2DModelDocument(document: unknown, modelUrl: URL): string[] {
  const invalid: string[] = []
  const references = isRecord(document) && isRecord(document.FileReferences)
    ? document.FileReferences
    : {}

  if (!isSafeModelReference(references.Moc, modelUrl))
    invalid.push('FileReferences.Moc')

  if (!Array.isArray(references.Textures) || references.Textures.length === 0) {
    invalid.push('FileReferences.Textures')
  }
  else {
    references.Textures.forEach((reference, index) => {
      if (!isSafeModelReference(reference, modelUrl))
        invalid.push(`FileReferences.Textures[${index}]`)
    })
  }

  for (const key of ['Physics', 'Pose', 'DisplayInfo', 'UserData'] as const) {
    if (references[key] !== undefined && !isSafeModelReference(references[key], modelUrl))
      invalid.push(`FileReferences.${key}`)
  }

  if (references.Expressions !== undefined) {
    if (!Array.isArray(references.Expressions)) {
      invalid.push('FileReferences.Expressions')
    }
    else {
      references.Expressions.forEach((expression, index) => {
        const file = isRecord(expression) ? expression.File : undefined
        if (!isSafeModelReference(file, modelUrl))
          invalid.push(`FileReferences.Expressions[${index}].File`)
      })
    }
  }

  if (references.Motions !== undefined) {
    if (!isRecord(references.Motions)) {
      invalid.push('FileReferences.Motions')
    }
    else {
      for (const [group, motions] of Object.entries(references.Motions)) {
        if (!Array.isArray(motions)) {
          invalid.push(`FileReferences.Motions.${group}`)
          continue
        }
        motions.forEach((motion, index) => {
          const entry = isRecord(motion) ? motion : {}
          if (!isSafeModelReference(entry.File, modelUrl))
            invalid.push(`FileReferences.Motions.${group}[${index}].File`)
          if (entry.Sound !== undefined && !isSafeModelReference(entry.Sound, modelUrl))
            invalid.push(`FileReferences.Motions.${group}[${index}].Sound`)
        })
      }
    }
  }

  return invalid
}

export function readSessionFlag(storage: StorageLike | null | undefined, key: string): boolean {
  if (memorySessionFlags.has(key))
    return true
  try {
    if (storage?.getItem(key) === '1') {
      memorySessionFlags.add(key)
      return true
    }
  }
  catch {
    // The in-memory fallback remains available when storage is blocked.
  }
  return false
}

export function writeSessionFlag(storage: StorageLike | null | undefined, key: string): void {
  memorySessionFlags.add(key)
  try {
    storage?.setItem(key, '1')
  }
  catch {
    // Session behavior still works for the current page lifetime.
  }
}

export function pickLive2DMessage(random: () => number = Math.random): typeof LIVE2D_MESSAGES[number] {
  return LIVE2D_MESSAGES[random() < 0.5 ? 0 : 1]
}

export function validateVisitorIp(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64 || value !== value.trim())
    return null

  if (value.includes(':')) {
    if (!/^[0-9a-f:.]+$/i.test(value))
      return null
    try {
      const parsed = new URL(`http://[${value}]/`)
      if (!parsed.hostname)
        return null
      return value
    }
    catch {
      return null
    }
  }

  const parts = value.split('.')
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255))
    return null
  return value
}
