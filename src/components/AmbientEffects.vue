<script setup lang="ts">
import type { WatchStopHandle } from 'vue'
import type { AmbientEffectsController, AmbientEffectsDiagnostics } from '@/utils/ambientEffects'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { createAmbientEffectsController, resolveAmbientProfile } from '@/utils/ambientEffects'

const appStore = useAppStore()
const petalCanvas = ref<HTMLCanvasElement | null>(null)
const trailCanvas = ref<HTMLCanvasElement | null>(null)
const finePointer = ref(false)
const reducedMotion = ref(false)

const profile = computed(() => resolveAmbientProfile({
  finePointer: finePointer.value,
  reducedMotion: reducedMotion.value,
}))
const sakuraActive = computed(() => Boolean(profile.value && appStore.sakuraEnabled))
const trailActive = computed(() => Boolean(profile.value?.cursorTrail && appStore.cursorTrailEnabled))

let controller: AmbientEffectsController | null = null
let finePointerQuery: MediaQueryList | null = null
let reducedMotionQuery: MediaQueryList | null = null
let rebuildVersion = 0
let pointerListening = false
const stopWatches: WatchStopHandle[] = []

function currentOptions() {
  if (!profile.value)
    return null
  return {
    profile: profile.value,
    dark: appStore.isDark,
    sakuraEnabled: sakuraActive.value,
    cursorTrailEnabled: trailActive.value,
  }
}

function onPointerMove(event: PointerEvent) {
  controller?.setPointer(event.clientX, event.clientY)
}

function syncPointerListener() {
  const shouldListen = trailActive.value && controller !== null
  if (shouldListen === pointerListening)
    return
  pointerListening = shouldListen
  if (shouldListen)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
  else
    window.removeEventListener('pointermove', onPointerMove)
}

function publishDiagnostics() {
  if (!import.meta.env.DEV)
    return
  window.__ambientEffectsDiagnostics = (): AmbientEffectsDiagnostics | null => controller?.getDiagnostics() ?? null
}

function destroyController() {
  if (pointerListening) {
    window.removeEventListener('pointermove', onPointerMove)
    pointerListening = false
  }
  controller?.destroy()
  controller = null
  if (import.meta.env.DEV)
    delete window.__ambientEffectsDiagnostics
}

function resizeController() {
  controller?.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1)
}

async function rebuildController() {
  const version = ++rebuildVersion
  destroyController()
  const options = currentOptions()
  if (!options || (!sakuraActive.value && !trailActive.value))
    return
  await nextTick()
  if (version !== rebuildVersion)
    return

  controller = createAmbientEffectsController({
    petalCanvas: sakuraActive.value ? petalCanvas.value : null,
    trailCanvas: trailActive.value ? trailCanvas.value : null,
    options,
    dependencies: { collectDiagnostics: import.meta.env.DEV },
  })
  resizeController()
  controller.setVisible(!document.hidden)
  controller.start()
  syncPointerListener()
  publishDiagnostics()
}

function onVisibilityChange() {
  controller?.setVisible(!document.hidden)
}

function onFinePointerChange(event: MediaQueryListEvent) {
  finePointer.value = event.matches
}

function onReducedMotionChange(event: MediaQueryListEvent) {
  reducedMotion.value = event.matches
}

onMounted(() => {
  finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  finePointer.value = finePointerQuery.matches
  reducedMotion.value = reducedMotionQuery.matches
  finePointerQuery.addEventListener('change', onFinePointerChange)
  reducedMotionQuery.addEventListener('change', onReducedMotionChange)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('resize', resizeController, { passive: true })

  stopWatches.push(
    watch([profile, sakuraActive, trailActive], rebuildController, { flush: 'post', immediate: true }),
    watch(() => appStore.isDark, () => {
      const options = currentOptions()
      if (options)
        controller?.setOptions(options)
    }),
  )
})

onUnmounted(() => {
  rebuildVersion++
  destroyController()
  stopWatches.forEach(stop => stop())
  finePointerQuery?.removeEventListener('change', onFinePointerChange)
  reducedMotionQuery?.removeEventListener('change', onReducedMotionChange)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('resize', resizeController)
})
</script>

<template>
  <canvas
    v-if="sakuraActive"
    ref="petalCanvas"
    class="ambient-effects-layer ambient-effects-layer--sakura"
    data-ambient-layer="sakura"
    aria-hidden="true"
  />
  <canvas
    v-if="trailActive"
    ref="trailCanvas"
    class="ambient-effects-layer ambient-effects-layer--trail"
    data-ambient-layer="trail"
    aria-hidden="true"
  />
</template>

<style scoped>
.ambient-effects-layer {
  position: fixed;
  inset: 0;
  display: block;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}

.ambient-effects-layer--sakura {
  z-index: 0;
}

.ambient-effects-layer--trail {
  z-index: 20;
}
</style>
