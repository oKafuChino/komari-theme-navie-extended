# Live2D Viewport Scale Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `live2dScale` resize the complete Live2D viewport so a 150% model remains fully visible instead of being clipped by a 100% Canvas.

**Architecture:** Add a framework-independent viewport-metrics resolver that converts the validated `50-150` scale into desktop and mobile CSS dimensions. Bind those dimensions to the companion root and make the renderer fit the model exactly once into the measured Canvas, removing scale from the internal renderer API.

**Tech Stack:** Vue 3 Composition API, TypeScript, SCSS, PixiJS 6, Node test runner, Vite.

## Global Constraints

- Preserve the 100% desktop baseline `clamp(220px, 22vw, 320px)` and `min(42vh, 440px)`.
- Preserve the 100% mobile baseline `min(42vw, 190px)` and `min(32vh, 300px)`.
- Clamp scale to `50-150`; invalid values normalize to 100.
- Add no animation, timer, observer, network request, or per-frame scale calculation.
- Do not modify the Komari backend, release layout, model format, privacy behavior, or frame-rate policy.
- Do not copy the XFZN model into Git, `public/`, or the Release ZIP.

---

### Task 1: Scale The Companion Viewport Without Double-Scaling The Model

**Files:**
- Modify: `src/utils/live2dCompanion.ts`
- Modify: `src/components/Live2DCompanion.vue`
- Modify: `src/utils/live2dRuntime.ts`
- Test: `tests/live2d-companion-core.test.mjs`
- Test: `tests/live2d-component-contract.test.mjs`
- Test: `tests/live2d-runtime-contract.test.mjs`

**Interfaces:**
- Produces: `resolveLive2DViewportMetrics(scale: unknown): Live2DViewportMetrics`
- Produces: `Live2DViewportMetrics` with `desktop` and `mobile` numeric dimension groups.
- Changes: `Live2DHandle.resize(width, height, dpr)` no longer accepts scale.
- Changes: `Live2DRuntimeOptions` and internal renderer options no longer accept scale.

- [x] **Step 1: Write failing viewport and renderer regression tests**

Add to `tests/live2d-companion-core.test.mjs`:

```js
test('scales desktop and mobile Live2D viewports proportionally', () => {
  assert.deepEqual(core.resolveLive2DViewportMetrics(50), {
    desktop: { minWidthPx: 110, fluidWidthVw: 11, maxWidthPx: 160, maxHeightVh: 21, heightCapPx: 220 },
    mobile: { fluidWidthVw: 21, maxWidthPx: 95, maxHeightVh: 16, heightCapPx: 150 },
  })
  assert.deepEqual(core.resolveLive2DViewportMetrics(100), {
    desktop: { minWidthPx: 220, fluidWidthVw: 22, maxWidthPx: 320, maxHeightVh: 42, heightCapPx: 440 },
    mobile: { fluidWidthVw: 42, maxWidthPx: 190, maxHeightVh: 32, heightCapPx: 300 },
  })
  assert.deepEqual(core.resolveLive2DViewportMetrics(150), {
    desktop: { minWidthPx: 330, fluidWidthVw: 33, maxWidthPx: 480, maxHeightVh: 63, heightCapPx: 660 },
    mobile: { fluidWidthVw: 63, maxWidthPx: 285, maxHeightVh: 48, heightCapPx: 450 },
  })
})
```

Extend `tests/live2d-component-contract.test.mjs` to require the computed root style and responsive CSS variables:

```js
assert.match(component, /const viewportStyle = computed/)
assert.match(component, /:style="viewportStyle"/)
assert.match(component, /--live2d-desktop-min-width/)
assert.match(component, /--live2d-mobile-max-width/)
assert.match(component, /width:\s*clamp\(var\(--live2d-desktop-min-width\)/)
assert.match(component, /width:\s*min\(var\(--live2d-mobile-fluid-width\)/)
```

Update the resize expectation in `tests/live2d-runtime-contract.test.mjs`:

```js
handle.resize(300, 420, 3)
assert.deepEqual(harness.calls.at(-1), ['resize', 300, 420, 1.5])
```

Add a source contract that rejects the old double-scale multiplier:

```js
assert.doesNotMatch(source, /currentScale/)
assert.doesNotMatch(source, /\*\s*\(\s*scale\s*\/\s*100\s*\)/)
```

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs tests/live2d-component-contract.test.mjs tests/live2d-runtime-contract.test.mjs
```

Expected: FAIL because `resolveLive2DViewportMetrics` and the CSS variables do not exist, and the runtime resize API still applies a separate scale.

- [x] **Step 3: Add the viewport metrics policy**

Add to `src/utils/live2dCompanion.ts`:

```ts
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
```

- [x] **Step 4: Bind scaled dimensions to the companion viewport**

In `src/components/Live2DCompanion.vue`, import `CSSProperties` and `resolveLive2DViewportMetrics`, then add:

```ts
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
```

Bind it to the root:

```vue
<div v-if="shouldMount" class="live2d-companion" :class="{ 'is-ready': ready }" :style="viewportStyle">
```

Replace the fixed dimensions with:

```scss
width: clamp(
  var(--live2d-desktop-min-width),
  var(--live2d-desktop-fluid-width),
  var(--live2d-desktop-max-width)
);
height: min(var(--live2d-desktop-max-height), var(--live2d-desktop-height-cap));
max-height: var(--live2d-desktop-max-height);
```

Inside the mobile media query use:

```scss
width: min(var(--live2d-mobile-fluid-width), var(--live2d-mobile-max-width));
height: min(var(--live2d-mobile-max-height), var(--live2d-mobile-height-cap));
max-height: var(--live2d-mobile-max-height);
```

- [x] **Step 5: Remove scale from the renderer fit API**

In `src/utils/live2dRuntime.ts`, remove `scale` from `RendererFactoryOptions` and `Live2DRuntimeOptions`, and change both resize signatures to:

```ts
resize: (width: number, height: number, dpr: number) => void
```

Replace the fit calculation with:

```ts
const fit = Math.min(width / bounds.width, height / bounds.height)
```

Remove `currentScale`, remove all scale assignments, and pass only width, height, and capped DPR through `Live2DHandle.resize`.

In `Live2DCompanion.vue`, remove `scale` from `createLive2DRuntime` and call:

```ts
handle.resize(bounds.width, bounds.height, window.devicePixelRatio || 1)
```

- [x] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs tests/live2d-component-contract.test.mjs tests/live2d-runtime-contract.test.mjs
```

Expected: all focused tests pass.

- [x] **Step 7: Run complete repository verification**

Run serially from the repository root:

```bash
node --test --test-concurrency=1 tests/*.test.mjs
node_modules\.bin\vue-tsc.CMD --build
node_modules\.bin\oxlint.CMD .
node_modules\.bin\eslint.CMD . --cache
node_modules\.bin\vite.CMD build
```

Expected: all tests pass, both linters report zero errors, type-check exits 0, and Vite creates `komari-theme-naive-extended-build-<sha>.zip`.

- [x] **Step 8: Verify the Release and clipping contract**

Inspect the generated ZIP and production dependency map. Confirm:

- `dist/live2d/runtime/live2dcubismcore.min.js` remains present.
- No `.moc3`, `.model3.json`, XFZN texture, or character image is packaged.
- `dist/index.html`, the home route, and the instance route do not preload Pixi or Cubism chunks.
- The built component contains the scaled viewport CSS variables and no old `currentScale` renderer multiplier.

- [ ] **Step 9: Commit the focused fix**

```bash
git add src/utils/live2dCompanion.ts src/components/Live2DCompanion.vue src/utils/live2dRuntime.ts tests/live2d-companion-core.test.mjs tests/live2d-component-contract.test.mjs tests/live2d-runtime-contract.test.mjs docs/superpowers/specs/2026-07-14-live2d-scale-viewport-fix-design.md docs/superpowers/plans/2026-07-14-live2d-scale-viewport-fix.md
git commit -m "fix: scale Live2D viewport with model"
```

Expected: commit succeeds when `.git/index.lock` is writable. If the environment still denies Git index writes, leave the verified changes uncommitted and report the exact failure.
