<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { Live2DHandle } from '@/utils/live2dRuntime'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import {
  LIVE2D_GREETING_KEY,
  LIVE2D_HIDDEN_KEY,
  pickLive2DMessage,
  readSessionFlag,
  resolveLive2DFocusTarget,
  resolveLive2DModelPath,
  resolveLive2DProfile,
  resolveLive2DViewportMetrics,
  supportsLive2DWebGL,
  writeSessionFlag,
} from '@/utils/live2dCompanion'
import { buildWelcomeMessage, fetchVisitorIp } from '@/utils/live2dGreeting'
import { createLive2DRuntime } from '@/utils/live2dRuntime'

const appStore = useAppStore()
const canvas = ref<HTMLCanvasElement | null>(null)
const modelTarget = ref<HTMLElement | null>(null)
const finePointer = ref(false)
const reducedMotion = ref(false)
const hidden = ref(false)
const ready = ref(false)
const message = ref('')
const shouldMount = computed(() => appStore.live2dEnabled && !hidden.value)
const viewportStyle = computed<CSSProperties>(() => {
  const { desktop, mobile } = resolveLive2DViewportMetrics(appStore.live2dScale)
  return {
    '--live2d-desktop-min-width': `${desktop.minWidthPx}px`,
    '--live2d-desktop-fluid-width': `${desktop.fluidWidthVw}vw`,
    '--live2d-desktop-max-width': `${desktop.maxWidthPx}px`,
    '--live2d-desktop-max-height': `${desktop.maxHeightVh}vh`,
    '--live2d-desktop-height-cap': `${desktop.heightCapPx}px`,
    '--live2d-mobile-fluid-width': `${mobile.fluidWidthVw}vw`,
    '--live2d-mobile-max-width': `${mobile.maxWidthPx}px`,
    '--live2d-mobile-max-height': `${mobile.maxHeightVh}vh`,
    '--live2d-mobile-height-cap': `${mobile.heightCapPx}px`,
  }
})

let handle: Live2DHandle | null = null
let finePointerQuery: MediaQueryList | null = null
let reducedMotionQuery: MediaQueryList | null = null
let speechTimer: ReturnType<typeof setTimeout> | null = null
let fallbackLoadTimer: ReturnType<typeof setTimeout> | null = null
let idleLoadHandle: number | null = null
let ownerController: AbortController | null = null
let loadVersion = 0
let warned = false
let stopWatch: (() => void) | null = null
let renderingSupported: boolean | null = null
let pointerListening = false
let activeTouchPointerId: number | null = null

function sessionStorageOrNull(): Storage | null {
  try {
    return window.sessionStorage
  }
  catch {
    return null
  }
}

function warnOnce(messageText: string, error?: unknown) {
  if (warned)
    return
  warned = true
  console.warn(messageText, error)
}

function clearSpeechTimer() {
  if (speechTimer === null)
    return
  clearTimeout(speechTimer)
  speechTimer = null
}

function showMessage(nextMessage: string) {
  message.value = nextMessage
  clearSpeechTimer()
  speechTimer = setTimeout(() => {
    message.value = ''
    speechTimer = null
  }, 4000)
}

function cancelScheduledLoad() {
  if (idleLoadHandle !== null && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(idleLoadHandle)
    idleLoadHandle = null
  }
  if (fallbackLoadTimer !== null) {
    clearTimeout(fallbackLoadTimer)
    fallbackLoadTimer = null
  }
}

function applyPointerFocus(event: PointerEvent) {
  const target = resolveLive2DFocusTarget(
    event.clientX,
    event.clientY,
    window.innerWidth,
    window.innerHeight,
  )
  if (target)
    handle?.setFocus(target.x, target.y)
}

function resetPointerFocus() {
  activeTouchPointerId = null
  handle?.resetFocus()
}

function onPointerDown(event: PointerEvent) {
  if (finePointer.value || event.pointerType !== 'touch')
    return
  activeTouchPointerId = event.pointerId
  applyPointerFocus(event)
}

function onPointerMove(event: PointerEvent) {
  if (finePointer.value) {
    if (event.pointerType === 'mouse')
      applyPointerFocus(event)
    return
  }
  if (event.pointerType === 'touch' && event.pointerId === activeTouchPointerId)
    applyPointerFocus(event)
}

function onPointerEnd(event: PointerEvent) {
  if (event.pointerType === 'touch' && event.pointerId === activeTouchPointerId)
    resetPointerFocus()
}

function onPointerOut(event: PointerEvent) {
  if (finePointer.value && event.pointerType === 'mouse' && event.relatedTarget === null)
    resetPointerFocus()
}

function addPointerListeners() {
  if (pointerListening || !ready.value || reducedMotion.value)
    return
  pointerListening = true
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerdown', onPointerDown, { passive: true })
  window.addEventListener('pointerup', onPointerEnd, { passive: true })
  window.addEventListener('pointercancel', onPointerEnd, { passive: true })
  window.addEventListener('pointerout', onPointerOut, { passive: true })
  window.addEventListener('blur', resetPointerFocus)
}

function removePointerListeners() {
  if (!pointerListening)
    return
  pointerListening = false
  activeTouchPointerId = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointerup', onPointerEnd)
  window.removeEventListener('pointercancel', onPointerEnd)
  window.removeEventListener('pointerout', onPointerOut)
  window.removeEventListener('blur', resetPointerFocus)
}

function destroyRuntime() {
  removePointerListeners()
  loadVersion++
  cancelScheduledLoad()
  ownerController?.abort()
  ownerController = null
  handle?.destroy()
  handle = null
  ready.value = false
}

function resizeRuntime() {
  if (!handle || !modelTarget.value)
    return
  const bounds = modelTarget.value.getBoundingClientRect()
  handle.resize(bounds.width, bounds.height, window.devicePixelRatio || 1)
}

async function greetOnce(version: number, signal: AbortSignal) {
  const storage = sessionStorageOrNull()
  if (readSessionFlag(storage, LIVE2D_GREETING_KEY))
    return
  const ip = await fetchVisitorIp(window.fetch.bind(window), 2500, signal)
  if (signal.aborted || version !== loadVersion)
    return
  showMessage(buildWelcomeMessage(ip))
  writeSessionFlag(storage, LIVE2D_GREETING_KEY)
}

async function initializeRuntime(version: number, controller: AbortController) {
  const targetCanvas = canvas.value
  if (!targetCanvas || controller.signal.aborted || version !== loadVersion)
    return

  const modelUrl = resolveLive2DModelPath(appStore.live2dModelPath, window.location.origin)
  if (!modelUrl) {
    warnOnce('[Live2D] invalid model path')
    return
  }

  const profile = resolveLive2DProfile({
    finePointer: finePointer.value,
    reducedMotion: reducedMotion.value,
  })

  try {
    const nextHandle = await createLive2DRuntime({
      canvas: targetCanvas,
      modelUrl,
      profile,
      signal: controller.signal,
      dependencies: { warn: warnOnce },
    })
    if (controller.signal.aborted || version !== loadVersion) {
      nextHandle.destroy()
      return
    }
    handle = nextHandle
    resizeRuntime()
    handle.setVisible(!document.hidden)
    ready.value = true
    addPointerListeners()
    await greetOnce(version, controller.signal)
  }
  catch {
    if (version === loadVersion)
      ready.value = false
  }
}

async function scheduleRuntime() {
  destroyRuntime()
  warned = false
  message.value = ''
  if (!shouldMount.value)
    return

  await nextTick()
  if (!shouldMount.value || !canvas.value)
    return
  renderingSupported ??= supportsLive2DWebGL()
  if (!renderingSupported) {
    warnOnce('[Live2D] WebGL is unavailable')
    return
  }

  const version = loadVersion
  const controller = new AbortController()
  ownerController = controller
  const load = () => {
    idleLoadHandle = null
    fallbackLoadTimer = null
    void initializeRuntime(version, controller)
  }

  if ('requestIdleCallback' in window)
    idleLoadHandle = window.requestIdleCallback(load, { timeout: 1000 })
  else
    fallbackLoadTimer = setTimeout(load, 0)
}

function interact() {
  if (!ready.value)
    return
  handle?.setActivity(true)
  showMessage(pickLive2DMessage())
}

function activate() {
  handle?.setActivity(true)
}

function hideForSession() {
  writeSessionFlag(sessionStorageOrNull(), LIVE2D_HIDDEN_KEY)
  hidden.value = true
  message.value = ''
  clearSpeechTimer()
  destroyRuntime()
  removeEnvironmentListeners()
}

function onVisibilityChange() {
  if (document.hidden)
    resetPointerFocus()
  handle?.setVisible(!document.hidden)
}

function onFinePointerChange(event: MediaQueryListEvent) {
  finePointer.value = event.matches
}

function onReducedMotionChange(event: MediaQueryListEvent) {
  reducedMotion.value = event.matches
}

function removeEnvironmentListeners() {
  removePointerListeners()
  stopWatch?.()
  stopWatch = null
  finePointerQuery?.removeEventListener('change', onFinePointerChange)
  reducedMotionQuery?.removeEventListener('change', onReducedMotionChange)
  finePointerQuery = null
  reducedMotionQuery = null
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('resize', resizeRuntime)
}

onMounted(() => {
  hidden.value = readSessionFlag(sessionStorageOrNull(), LIVE2D_HIDDEN_KEY)
  if (hidden.value)
    return
  finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  finePointer.value = finePointerQuery.matches
  reducedMotion.value = reducedMotionQuery.matches
  finePointerQuery.addEventListener('change', onFinePointerChange)
  reducedMotionQuery.addEventListener('change', onReducedMotionChange)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('resize', resizeRuntime, { passive: true })

  stopWatch = watch(
    [
      () => appStore.live2dEnabled,
      () => appStore.live2dModelPath,
      () => appStore.live2dScale,
      finePointer,
      reducedMotion,
    ],
    scheduleRuntime,
    { immediate: true, flush: 'post' },
  )
})

onUnmounted(() => {
  clearSpeechTimer()
  destroyRuntime()
  removeEnvironmentListeners()
})
</script>

<template>
  <div v-if="shouldMount" class="live2d-companion" :class="{ 'is-ready': ready }" :style="viewportStyle">
    <div
      ref="modelTarget"
      class="live2d-companion__model"
      role="button"
      tabindex="0"
      aria-label="与看板娘互动"
      @click="interact"
      @pointerenter="activate"
      @keydown.enter.prevent="interact"
      @keydown.space.prevent="interact"
    >
      <canvas ref="canvas" aria-hidden="true" />
    </div>

    <Transition name="live2d-bubble">
      <div v-if="message" class="live2d-companion__bubble" role="status" aria-live="polite">
        {{ message }}
      </div>
    </Transition>

    <button
      class="live2d-companion__close"
      type="button"
      aria-label="关闭看板娘"
      @click.stop="hideForSession"
    >
      <span class="i-lucide-x" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.live2d-companion {
  position: fixed;
  z-index: 15;
  left: max(12px, env(safe-area-inset-left));
  bottom: max(10px, env(safe-area-inset-bottom));
  pointer-events: none;
  opacity: 0;
  transition: opacity 180ms ease;

  &.is-ready {
    opacity: 1;
  }
}

.live2d-companion__model {
  width: clamp(var(--live2d-desktop-min-width), var(--live2d-desktop-fluid-width), var(--live2d-desktop-max-width));
  height: min(var(--live2d-desktop-max-height), var(--live2d-desktop-height-cap));
  max-height: var(--live2d-desktop-max-height);
  pointer-events: auto;
  cursor: pointer;
  outline: none;

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  &:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 3px;
  }
}

.live2d-companion:not(.is-ready) .live2d-companion__model {
  pointer-events: none;
}

.live2d-companion__bubble {
  position: absolute;
  bottom: calc(100% - 18px);
  left: 12px;
  max-width: min(240px, calc(100vw - 24px));
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--n-color) 90%, transparent);
  box-shadow: 0 8px 20px rgba(24, 45, 35, 0.12);
  color: var(--n-text-color);
  font-size: 13px;
  line-height: 1.55;
  pointer-events: none;
}

.live2d-companion__close {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  width: 28px;
  height: 28px;
  padding: 0;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--n-text-color) 16%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--n-color) 90%, transparent);
  color: var(--n-text-color);
  cursor: pointer;
  opacity: 0;
  pointer-events: auto;
  transform: translateY(-3px);
  transition:
    opacity 150ms ease,
    transform 150ms ease,
    background-color 150ms ease;

  &:hover,
  &:focus-visible {
    background: color-mix(in srgb, var(--primary-color) 14%, var(--n-color));
  }
}

.live2d-companion:hover .live2d-companion__close,
.live2d-companion:focus-within .live2d-companion__close {
  opacity: 0.82;
  transform: translateY(0);
}

.live2d-bubble-enter-active,
.live2d-bubble-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.live2d-bubble-enter-from,
.live2d-bubble-leave-to {
  opacity: 0;
  transform: translateY(5px);
}

@media (hover: none), (pointer: coarse) {
  .live2d-companion__close {
    opacity: 0.72;
    transform: translateY(0);
  }
}

@media (max-width: 600px) {
  .live2d-companion__model {
    width: min(var(--live2d-mobile-fluid-width), var(--live2d-mobile-max-width));
    height: min(var(--live2d-mobile-max-height), var(--live2d-mobile-height-cap));
    max-height: var(--live2d-mobile-max-height);
  }

  .live2d-companion__bubble {
    left: 4px;
    font-size: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .live2d-companion,
  .live2d-companion * {
    transition: none !important;
  }
}
</style>
