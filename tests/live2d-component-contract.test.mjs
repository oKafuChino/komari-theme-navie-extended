import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

test('mounts one Live2D companion in the global app shell', async () => {
  const app = await source('src/App.vue')
  assert.match(app, /import Live2DCompanion from '\.\/components\/Live2DCompanion\.vue'/)
  assert.equal((app.match(/<Live2DCompanion v-if="!appStore\.loading" \/>/g) || []).length, 1)
})

test('exposes accessible model, bubble, and close controls', async () => {
  const component = await source('src/components/Live2DCompanion.vue')
  assert.match(component, /role="button"/)
  assert.match(component, /tabindex="0"/)
  assert.match(component, /aria-label="与看板娘互动"/)
  assert.match(component, /role="status"/)
  assert.match(component, /aria-live="polite"/)
  assert.match(component, /aria-label="关闭看板娘"/)
  assert.match(component, /i-lucide-x/)
  assert.match(component, /@keydown\.enter\.prevent="interact"/)
  assert.match(component, /@keydown\.space\.prevent="interact"/)
})

test('uses session-only greeting and close policies', async () => {
  const component = await source('src/components/Live2DCompanion.vue')
  assert.match(component, /LIVE2D_GREETING_KEY/)
  assert.match(component, /LIVE2D_HIDDEN_KEY/)
  assert.match(component, /fetchVisitorIp/)
  assert.match(component, /buildWelcomeMessage/)
  assert.match(component, /pickLive2DMessage/)
  assert.match(component, /writeSessionFlag/)
  assert.doesNotMatch(component, /localStorage/)
})

test('owns visibility, media-query, resize, and teardown lifecycle', async () => {
  const component = await source('src/components/Live2DCompanion.vue')
  assert.match(component, /\(hover: hover\) and \(pointer: fine\)/)
  assert.match(component, /prefers-reduced-motion: reduce/)
  assert.match(component, /requestIdleCallback/)
  assert.match(component, /visibilitychange/)
  assert.match(component, /handle\?\.destroy\(\)/)
  assert.match(component, /removeEventListener/)
  assert.match(component, /function removeEnvironmentListeners\(\)/)
  assert.match(component, /function hideForSession\(\)[\s\S]*removeEnvironmentListeners\(\)/)
  assert.match(component, /supportsLive2DWebGL/)
  assert.match(component, /resolveLive2DModelPath/)
  assert.doesNotMatch(component, /resolveLive2DModelPaths/)
})

test('tracks desktop and pressed touch pointers with passive global listeners', async () => {
  const component = await source('src/components/Live2DCompanion.vue')
  assert.match(component, /resolveLive2DFocusTarget/)
  assert.match(component, /resolveLive2DFocusTarget\([\s\S]*appStore\.live2dFollowStrength/)
  assert.match(component, /\(\) => appStore\.live2dFollowStrength/)
  assert.match(component, /window\.addEventListener\('pointermove', onPointerMove, \{ passive: true \}\)/)
  assert.match(component, /window\.addEventListener\('pointerdown', onPointerDown, \{ passive: true \}\)/)
  assert.match(component, /window\.addEventListener\('pointerup', onPointerEnd, \{ passive: true \}\)/)
  assert.match(component, /window\.addEventListener\('pointercancel', onPointerEnd, \{ passive: true \}\)/)
  assert.match(component, /event\.pointerType === 'mouse'/)
  assert.match(component, /event\.pointerType !== 'touch'/)
  assert.match(component, /activeTouchPointerId/)
  assert.doesNotMatch(component, /preventDefault\(\)/)
})

test('resets and removes Live2D focus listeners on every terminal path', async () => {
  const component = await source('src/components/Live2DCompanion.vue')
  assert.match(component, /function resetPointerFocus\(\)[\s\S]*handle\?\.resetFocus\(\)/)
  assert.match(component, /function onPointerOut\([\s\S]*relatedTarget === null[\s\S]*resetPointerFocus\(\)/)
  assert.match(component, /window\.addEventListener\('blur', resetPointerFocus\)/)
  assert.match(component, /function onVisibilityChange\(\)[\s\S]*document\.hidden[\s\S]*resetPointerFocus\(\)/)
  assert.match(component, /function destroyRuntime\(\)[\s\S]*removePointerListeners\(\)[\s\S]*handle\?\.destroy\(\)/)
  assert.match(component, /window\.removeEventListener\('pointermove', onPointerMove\)/)
})

test('keeps the responsive companion bounded and non-blocking', async () => {
  const component = await source('src/components/Live2DCompanion.vue')
  assert.match(component, /z-index:\s*15/)
  assert.match(component, /const viewportStyle = computed/)
  assert.match(component, /:style="viewportStyle"/)
  assert.match(component, /--live2d-desktop-min-width/)
  assert.match(component, /--live2d-mobile-max-width/)
  assert.match(component, /width:\s*clamp\(\s*var\(--live2d-desktop-min-width\)/)
  assert.match(component, /width:\s*min\(var\(--live2d-mobile-fluid-width\)/)
  assert.match(component, /max-width:\s*min\(240px,\s*calc\(100vw - 24px\)\)/)
  assert.match(component, /pointer-events:\s*none/)
  assert.match(component, /pointer-events:\s*auto/)
})
