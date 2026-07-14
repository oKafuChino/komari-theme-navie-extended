import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

test('mounts one ambient component in the global app shell', async () => {
  const app = await source('src/App.vue')
  assert.match(app, /import AmbientEffects from '\.\/components\/AmbientEffects\.vue'/)
  assert.match(app, /<AmbientEffects v-if="!appStore\.loading" \/>/)
  assert.match(app, /class="app-content-layer"/)
})

test('declares inaccessible, non-interactive Canvas layers', async () => {
  const component = await source('src/components/AmbientEffects.vue')
  assert.match(component, /data-ambient-layer="sakura"/)
  assert.match(component, /data-ambient-layer="trail"/)
  assert.equal((component.match(/aria-hidden="true"/g) || []).length, 2)
  assert.match(component, /pointer-events: none/)
  assert.match(component, /prefers-reduced-motion: reduce/)
  assert.match(component, /\(hover: hover\) and \(pointer: fine\)/)
})
