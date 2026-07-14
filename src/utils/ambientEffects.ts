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
