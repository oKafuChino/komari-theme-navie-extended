# Live2D Pointer Follow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subtle full-page desktop pointer following and press-drag touch following to the existing Live2D companion without moving its Canvas, model position, scale, or bottom anchor.

**Architecture:** Keep page-event ownership in `Live2DCompanion.vue`, pure coordinate policy in `live2dCompanion.ts`, and model ownership in `live2dRuntime.ts`. Pointer events overwrite the latest normalized target; the existing Pixi ticker applies that target through Live2D's typed `internalModel.focusController`, so no second animation loop is introduced.

**Tech Stack:** Vue 3 Composition API, TypeScript, PixiJS 6.5.10, pixi-live2d-display 0.4.0 Cubism 4 runtime, Node test runner, Vite.

## Global Constraints

- Complete this plan before starting `docs/superpowers/plans/2026-07-14-live2d-model-pack.md`.
- Desktop active/idle frame rates remain exactly `60/15`; touch active/idle frame rates remain exactly `24/12`.
- Default focus amplitude is exactly `0.35` horizontally and `0.22` vertically.
- Desktop follows across the full page and keeps the last target while the pointer remains inside the browser.
- Desktop resets to center on browser exit, window blur, or page hide.
- Touch follows only one active touch pointer while it is pressed and moving; pointer up or cancel resets to center.
- `prefers-reduced-motion: reduce` registers no follow listeners and keeps the current static-frame behavior.
- Do not add a theme setting, dependency, animation library, worker, API, database field, server process, request, or Komari backend change.
- Do not write pointer-follow code to `model.x`, `model.y`, `model.scale`, renderer dimensions, Canvas CSS dimensions, or `fitModel()`.
- Do not copy the XFZN model or any character model into Git, `public/`, `dist/`, or a Release ZIP.
- Preserve Live2D greeting, click messages, session close, 50%-150% viewport scaling, lazy loading, DPR cap 1.5, and WebGL teardown.

---

### Task 1: Add The Pure Focus Coordinate Policy

**Files:**
- Modify: `src/utils/live2dCompanion.ts`
- Test: `tests/live2d-companion-core.test.mjs`

**Interfaces:**
- Produces: `Live2DFocusTarget { readonly x: number; readonly y: number }`.
- Produces: `resolveLive2DFocusTarget(clientX: number, clientY: number, viewportWidth: number, viewportHeight: number): Live2DFocusTarget | null`.
- Produces: `LIVE2D_FOCUS_X_AMPLITUDE = 0.35` and `LIVE2D_FOCUS_Y_AMPLITUDE = 0.22`.

- [ ] **Step 1: Write failing coordinate-policy tests**

Add to `tests/live2d-companion-core.test.mjs`:

```js
test('normalizes page coordinates to subtle Live2D focus targets', () => {
  assert.deepEqual(core.resolveLive2DFocusTarget(0, 0, 1000, 500), { x: -0.35, y: 0.22 })
  assert.deepEqual(core.resolveLive2DFocusTarget(500, 250, 1000, 500), { x: 0, y: 0 })
  assert.deepEqual(core.resolveLive2DFocusTarget(1000, 500, 1000, 500), { x: 0.35, y: -0.22 })
  assert.deepEqual(core.resolveLive2DFocusTarget(2000, -500, 1000, 500), { x: 0.35, y: 0.22 })
})

test('rejects unusable Live2D focus coordinates and viewports', () => {
  assert.equal(core.resolveLive2DFocusTarget(Number.NaN, 1, 100, 100), null)
  assert.equal(core.resolveLive2DFocusTarget(1, Number.POSITIVE_INFINITY, 100, 100), null)
  assert.equal(core.resolveLive2DFocusTarget(1, 1, 0, 100), null)
  assert.equal(core.resolveLive2DFocusTarget(1, 1, 100, -1), null)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs
```

Expected: FAIL because `resolveLive2DFocusTarget` is not exported.

- [ ] **Step 3: Implement the pure coordinate policy**

Add to `src/utils/live2dCompanion.ts`:

```ts
export const LIVE2D_FOCUS_X_AMPLITUDE = 0.35
export const LIVE2D_FOCUS_Y_AMPLITUDE = 0.22

export interface Live2DFocusTarget {
  readonly x: number
  readonly y: number
}

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
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs
```

Expected: all tests in the file pass.

- [ ] **Step 5: Commit the pure policy**

```bash
git add src/utils/live2dCompanion.ts tests/live2d-companion-core.test.mjs
git commit -m "feat: add Live2D focus coordinate policy"
```

Expected: one focused commit containing no component or renderer changes.

---

### Task 2: Queue Focus Targets In The Existing Live2D Runtime

**Files:**
- Modify: `src/utils/live2dRuntime.ts`
- Test: `tests/live2d-runtime-contract.test.mjs`

**Interfaces:**
- Consumes: normalized finite targets from `resolveLive2DFocusTarget`.
- Changes: `Live2DRenderer` adds `setFocus(x: number, y: number): void` and `resetFocus(): void`.
- Changes: `Live2DHandle` adds `setFocus(x: number, y: number): void` and `resetFocus(): void`.
- Changes: `RendererFactoryOptions` adds `onFocusError(error: unknown): void`.
- Changes: `Live2DRuntimeDependencies` adds optional `now(): number` for deterministic activity-throttle tests.
- Produces: at most one applied focus target per existing Pixi render frame.

- [ ] **Step 1: Extend the test renderer and write failing runtime tests**

In `createHarness()` inside `tests/live2d-runtime-contract.test.mjs`, add a controllable clock and renderer methods:

```js
let now = 0
let focusFailure
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
```

Capture the non-fatal callback and clock in the dependency object:

```js
createRenderer: async (options) => {
  calls.push(['renderer'])
  fatal = options.onFatal
  focusFailure = options.onFocusError
  return renderer
},
now: () => now,
```

Return these controls from the harness:

```js
setNow: value => { now = value },
failFocus: error => focusFailure(error),
```

Add tests:

```js
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
```

Extend the existing source-contract test:

```js
assert.match(source, /let pendingFocus:/)
assert.match(source, /focusController\.focus\(target\.x, target\.y\)/)
assert.match(source, /const renderFrame = \(\) => \{[\s\S]*applyPendingFocus\(\)[\s\S]*model\.update/)
assert.doesNotMatch(source, /setFocus[\s\S]{0,300}model\.(?:x|y|scale)\s*=/)
```

- [ ] **Step 2: Run the runtime test and verify RED**

Run:

```bash
node --test --test-concurrency=1 tests/live2d-runtime-contract.test.mjs
```

Expected: FAIL because the renderer and public handle do not expose focus methods or a non-fatal focus callback.

- [ ] **Step 3: Add focus interfaces and the renderer-side latest-target queue**

In `src/utils/live2dRuntime.ts`, add the following members to the existing interfaces:

```ts
interface Live2DRenderer {
  setFocus: (x: number, y: number) => void
  resetFocus: () => void
}

interface RendererFactoryOptions {
  onFocusError: (error: unknown) => void
}

export interface Live2DRuntimeDependencies {
  now?: () => number
}

export interface Live2DHandle {
  setFocus: (x: number, y: number) => void
  resetFocus: () => void
}
```

Inside `createPixiRenderer()`, near the existing renderer state, add:

```ts
let pendingFocus: { x: number, y: number } | null = null
let focusEnabled = true

function applyPendingFocus() {
  if (!focusEnabled || !pendingFocus)
    return
  const target = pendingFocus
  pendingFocus = null
  try {
    model.internalModel.focusController.focus(target.x, target.y)
  }
  catch (error) {
    focusEnabled = false
    options.onFocusError(error)
  }
}
```

Call `applyPendingFocus()` immediately before `model.update(app.ticker.deltaMS)` in `renderFrame`. Add these methods to the returned renderer object:

```ts
setFocus(x, y) {
  if (
    destroyed
    || !focusEnabled
    || !Number.isFinite(x)
    || !Number.isFinite(y)
  ) {
    return
  }
  pendingFocus = {
    x: Math.min(1, Math.max(-1, x)),
    y: Math.min(1, Math.max(-1, y)),
  }
},
resetFocus() {
  if (!destroyed && focusEnabled)
    pendingFocus = { x: 0, y: 0 }
},
```

Set `pendingFocus = null` during `destroy()` before destroying the model.

- [ ] **Step 4: Add the public focus handle with rate-limited activity refresh**

At module scope add:

```ts
const FOCUS_ACTIVITY_REFRESH_MS = 1000
```

Inside `createLive2DRuntime()`, immediately after resolving `warn` and before declaring or creating `renderer`, move the existing lifecycle variables to this location and add the focus state. Remove their old duplicate declarations below renderer creation:

```ts
const now = dependencies.now ?? (() => performance.now())
let destroyed = false
let visible = true
let running = false
let targetFps = 0
let finalFrameCount = 0
let idleTimer: ReturnType<typeof setTimeout> | null = null
let focusAvailable = options.profile !== null
let focusWarned = false
let lastFocusActivityAt = now()

const handleFocusError = (error: unknown) => {
  if (destroyed || focusWarned)
    return
  focusAvailable = false
  focusWarned = true
  warn('[Live2D] focus controller failed; pointer following disabled', error)
}
```

Pass the callback to `createRenderer()`:

```ts
onFocusError: error => handleFocusError(error),
```

Add an internal wake helper:

```ts
function refreshFocusActivity() {
  if (!options.profile)
    return
  const currentTime = now()
  if (
    targetFps === options.profile.activeFps
    && currentTime - lastFocusActivityAt < FOCUS_ACTIVITY_REFRESH_MS
  ) {
    return
  }
  lastFocusActivityAt = currentTime
  setRate(options.profile.activeFps)
  renderer.start()
  running = true
  scheduleIdle()
}
```

Add methods to the returned `Live2DHandle`:

```ts
setFocus(x, y) {
  if (destroyed || !visible || !focusAvailable || !options.profile)
    return
  renderer.setFocus(x, y)
  refreshFocusActivity()
},
resetFocus() {
  if (destroyed || !focusAvailable || !options.profile)
    return
  renderer.resetFocus()
  if (visible)
    refreshFocusActivity()
},
```

Do not change the existing fatal-renderer destruction path.

- [ ] **Step 5: Run the runtime test and verify GREEN**

Run:

```bash
node --test --test-concurrency=1 tests/live2d-runtime-contract.test.mjs
```

Expected: all runtime tests pass, focus failure logs once, and the renderer is not destroyed by the focus-only failure.

- [ ] **Step 6: Commit the runtime focus queue**

```bash
git add src/utils/live2dRuntime.ts tests/live2d-runtime-contract.test.mjs
git commit -m "feat: queue Live2D focus targets"
```

Expected: one focused commit containing no component events or resource-pack work.

---

### Task 3: Wire Desktop And Touch Pointer Lifecycles

**Files:**
- Modify: `src/components/Live2DCompanion.vue`
- Test: `tests/live2d-component-contract.test.mjs`

**Interfaces:**
- Consumes: `resolveLive2DFocusTarget(...)` from Task 1.
- Consumes: `Live2DHandle.setFocus(x, y)` and `Live2DHandle.resetFocus()` from Task 2.
- Produces: one idempotently managed set of passive global pointer listeners while an animated model is ready.

- [ ] **Step 1: Write failing component lifecycle contracts**

Add to `tests/live2d-component-contract.test.mjs`:

```js
test('tracks desktop and pressed touch pointers with passive global listeners', async () => {
  const component = await source('src/components/Live2DCompanion.vue')
  assert.match(component, /resolveLive2DFocusTarget/)
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
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
node --test --test-concurrency=1 tests/live2d-component-contract.test.mjs
```

Expected: FAIL because global follow listeners and reset paths do not exist.

- [ ] **Step 3: Add pointer state and target application**

Import `resolveLive2DFocusTarget` in `src/components/Live2DCompanion.vue`. Add component state:

```ts
let pointerListening = false
let activeTouchPointerId: number | null = null

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
```

- [ ] **Step 4: Add idempotent listener ownership**

Add:

```ts
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
```

After successful initialization sets `ready.value = true`, call `addPointerListeners()`. At the beginning of `destroyRuntime()`, call `removePointerListeners()` before destroying the handle. Also call `removePointerListeners()` from `removeEnvironmentListeners()` as a final idempotent guard.

Change visibility handling to:

```ts
function onVisibilityChange() {
  if (document.hidden)
    resetPointerFocus()
  handle?.setVisible(!document.hidden)
}
```

Keep the existing model-area `@pointerenter="activate"` and click behavior unchanged.

- [ ] **Step 5: Run all Live2D focused tests and verify GREEN**

Run:

```bash
node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs tests/live2d-runtime-contract.test.mjs tests/live2d-component-contract.test.mjs
```

Expected: all focused tests pass.

- [ ] **Step 6: Run type checking before committing component integration**

Run:

```bash
pnpm type-check
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 7: Commit the pointer lifecycle**

```bash
git add src/components/Live2DCompanion.vue tests/live2d-component-contract.test.mjs
git commit -m "feat: follow page pointers with Live2D"
```

Expected: one focused component commit containing no model-path or packaging changes.

---

### Task 4: Verify And Gate Pointer Following Before Resource-Pack Work

**Files:**
- Modify only if verification exposes a pointer-follow defect: files already listed in Tasks 1-3 and their tests.
- Do not modify: `komari-theme.json`, `vite.config.ts`, `.github/workflows/build-ci.yml`, `README.md`, or model-path defaults.

**Interfaces:**
- Consumes: the complete stage-1 implementation.
- Produces: a verified stage-1 commit series that is safe to build on in the separate model-pack plan.

- [ ] **Step 1: Run the full unit suite**

```bash
pnpm test:unit
```

Expected: all repository unit tests pass with zero failures.

- [ ] **Step 2: Run lint and allow only its intended formatting fixes**

```bash
pnpm lint
```

Expected: exit code 0. Inspect `git diff`; any formatting changes must be limited to files touched by Tasks 1-3. Re-run `pnpm test:unit` if lint changed source.

- [ ] **Step 3: Run the production build**

```bash
pnpm build
```

Expected: type checking and Vite build pass, `dist/` is generated, and the unchanged `komari-theme-naive-extended-build-<sha>.zip` is created.

- [ ] **Step 4: Perform desktop manual verification with a repository-external model**

Start `pnpm dev`, load a locally configured Cubism 3/4 model without copying it into tracked paths, and verify:

- Left, center, right, top, and bottom pointer positions produce subtle bounded tracking.
- Stopping the mouse inside the window holds the last direction.
- Leaving the browser or switching window focus returns the model smoothly to center.
- The companion root, Canvas bounds, bottom edge, and left offset do not move at 50%, 100%, and 150% scale.
- Pointer movement wakes the desktop profile to at most 60 FPS and inactivity returns it to 15 FPS.

- [ ] **Step 5: Perform touch and lifecycle verification**

Using browser mobile emulation or a touch device, verify:

- Touch down and drag follows one finger at at most 24 FPS.
- Touch release, cancel, scrolling cancellation, page hide, session close, and component teardown reset or remove tracking.
- A normal page scroll is not prevented.
- Reduced-motion mode registers no follow behavior and remains a static frame.

- [ ] **Step 6: Inspect release exclusions and worktree state**

Confirm the generated main-theme ZIP contains no `.moc3`, `.model3.json`, XFZN texture, action, expression, or character sound. Run:

```bash
git status --short
```

Expected: only intentional source/test changes from any verification fix remain; generated `dist/` and ZIP outputs are ignored.

- [ ] **Step 7: Commit only verification fixes if needed**

If Steps 1-6 exposed a real defect, add a regression test first, make the smallest fix, rerun all verification, then commit only those files:

```bash
git add src/utils/live2dCompanion.ts src/utils/live2dRuntime.ts src/components/Live2DCompanion.vue tests/live2d-companion-core.test.mjs tests/live2d-runtime-contract.test.mjs tests/live2d-component-contract.test.mjs
git commit -m "fix: harden Live2D pointer following"
```

Expected: skip this commit when no verification fix is needed. Do not start the model-pack plan until this gate passes.
