# Live2D Follow Strength Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a managed `0-200%` setting that scales Live2D mouse and touch following while preserving the existing default behavior at `100%`.

**Architecture:** A pure helper clamps the setting, the existing coordinate helper applies it, and the existing component passes a normalized Pinia value. This reuses current pointer listeners and render flow without adding a loop, listener, request, or backend work.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vite, Node test runner, Komari managed theme manifest.

## Global Constraints

- `live2dFollowStrength` defaults to `100` and clamps to `0-200`.
- `100%` retains `0.35` horizontal and `0.22` vertical amplitudes; `0%` returns `{ x: 0, y: 0 }` for valid input.
- Do not change model position, model scale, Canvas dimensions, FPS limits, listener counts, network requests, model paths, or Komari backend behavior.
- Missing, invalid, non-finite, and non-number configuration normalizes to `100`.
- Keep existing security, greeting, close, reduced-motion, and cleanup behavior unchanged.

---

### Task 1: Add a Pure Follow-Strength Coordinate Contract

**Files:**
- Modify: `tests/live2d-companion-core.test.mjs`
- Modify: `src/utils/live2dCompanion.ts`

**Interfaces:**
- Produces `clampLive2DFollowStrength(value: unknown): number`.
- Extends `resolveLive2DFocusTarget(clientX, clientY, viewportWidth, viewportHeight, strength?: unknown): Live2DFocusTarget | null`.

- [ ] **Step 1: Write the failing test**

Add the following assertions to the existing focus-coordinate test:

```js
assert.deepEqual(core.resolveLive2DFocusTarget(0, 0, 1000, 500, 100), { x: -0.35, y: 0.22 })
assert.deepEqual(core.resolveLive2DFocusTarget(1000, 500, 1000, 500, 200), { x: 0.7, y: -0.44 })
assert.deepEqual(core.resolveLive2DFocusTarget(0, 0, 1000, 500, 0), { x: 0, y: 0 })
assert.equal(core.clampLive2DFollowStrength(-1), 0)
assert.equal(core.clampLive2DFollowStrength(250), 200)
assert.equal(core.clampLive2DFollowStrength('100'), 100)
assert.equal(core.clampLive2DFollowStrength(Number.POSITIVE_INFINITY), 100)
```

- [ ] **Step 2: Run test to verify it fails**

Run `node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs`.

Expected: FAIL because the fifth coordinate argument is ignored and `clampLive2DFollowStrength` does not exist.

- [ ] **Step 3: Write minimal implementation**

Add this helper to `src/utils/live2dCompanion.ts`:

```ts
export function clampLive2DFollowStrength(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return 100
  return Math.min(200, Math.max(0, value))
}
```

Extend the focus helper with `strength: unknown = 100`, then calculate its return value as:

```ts
const factor = clampLive2DFollowStrength(strength) / 100
return {
  x: normalizedX * LIVE2D_FOCUS_X_AMPLITUDE * factor,
  y: normalizedY * LIVE2D_FOCUS_Y_AMPLITUDE * factor,
}
```

Keep existing coordinate validation unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run `node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs`.

Expected: all core tests pass, including invalid-coordinate guards and `0/100/200%` amplitudes.

- [ ] **Step 5: Commit**

Run `git add src/utils/live2dCompanion.ts tests/live2d-companion-core.test.mjs && git commit -m "feat: add Live2D follow strength helper"`.

---

### Task 2: Add the Managed Setting and Component Wiring

**Files:**
- Modify: `tests/live2d-settings.test.mjs`
- Modify: `tests/live2d-component-contract.test.mjs`
- Modify: `src/stores/app.ts`
- Modify: `src/components/Live2DCompanion.vue`
- Modify: `komari-theme.json`

**Interfaces:**
- Consumes `clampLive2DFollowStrength(value: unknown): number` and the Task 1 focus helper.
- Produces `appStore.live2dFollowStrength: ComputedRef<number>` and managed key `live2dFollowStrength`.

- [ ] **Step 1: Write the failing test**

Add this manifest expectation to `tests/live2d-settings.test.mjs`:

```js
assert.deepEqual(items.find(item => item.key === 'live2dFollowStrength'), {
  key: 'live2dFollowStrength',
  name: 'Live2D 鼠标跟随幅度',
  type: 'number',
  default: 100,
  help: '鼠标与触摸跟随强度百分比，0-200；100 为默认效果，0 为关闭跟随',
})
```

Add Store checks:

```js
store.publicSettings = { theme_settings: { live2dFollowStrength: 200 } }
assert.equal(store.live2dFollowStrength, 200)
store.publicSettings = { theme_settings: { live2dFollowStrength: -20 } }
assert.equal(store.live2dFollowStrength, 0)
store.publicSettings = { theme_settings: { live2dFollowStrength: '100' } }
assert.equal(store.live2dFollowStrength, 100)
```

Add component source assertions in `tests/live2d-component-contract.test.mjs`:

```js
assert.match(component, /appStore\.live2dFollowStrength/)
assert.match(component, /resolveLive2DFocusTarget\([\s\S]*appStore\.live2dFollowStrength/)
assert.match(component, /\(\) => appStore\.live2dFollowStrength/)
```

- [ ] **Step 2: Run test to verify it fails**

Run `node --test --test-concurrency=1 tests/live2d-settings.test.mjs tests/live2d-component-contract.test.mjs`.

Expected: FAIL because manifest key, Store value, component argument, and watcher source do not exist.

- [ ] **Step 3: Write minimal implementation**

Add this entry after `live2dScale` in `komari-theme.json`:

```json
{ "key": "live2dFollowStrength", "name": "Live2D 鼠标跟随幅度", "type": "number", "default": 100, "help": "鼠标与触摸跟随强度百分比，0-200；100 为默认效果，0 为关闭跟随" }
```

Import the Task 1 helper into `src/stores/app.ts`, then add and expose:

```ts
const live2dFollowStrength = computed<number>(() => {
  return clampLive2DFollowStrength(publicSettings.value?.theme_settings?.live2dFollowStrength)
})
```

Pass `appStore.live2dFollowStrength` as the fifth argument to `resolveLive2DFocusTarget()` in `applyPointerFocus()`. Add `() => appStore.live2dFollowStrength` to the existing Live2D `watch()` source array. Do not add another watcher or listener.

- [ ] **Step 4: Run test to verify it passes**

Run `node --test --test-concurrency=1 tests/live2d-settings.test.mjs tests/live2d-component-contract.test.mjs`.

Expected: both test files pass with existing accessibility and lifecycle contracts unchanged.

- [ ] **Step 5: Commit**

Run `git add komari-theme.json src/stores/app.ts src/components/Live2DCompanion.vue tests/live2d-settings.test.mjs tests/live2d-component-contract.test.mjs && git commit -m "feat: configure Live2D follow strength"`.

---

### Task 3: Verify and Package the Setting

**Files:**
- Verify: `src/utils/live2dCompanion.ts`, `src/stores/app.ts`, `src/components/Live2DCompanion.vue`, and `komari-theme.json`
- Generated: `komari-theme-naive-extended-build-<sha>.zip` and `komari-live2d-model-pack-template.zip`

- [ ] **Step 1: Run all tests**

Run `node --test --test-concurrency=1 tests/*.test.mjs`.

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run type and lint checks**

Run `node node_modules/vue-tsc/bin/vue-tsc.js --build`, then `& .\node_modules\.bin\oxlint.cmd . --fix`, then `node node_modules/eslint/bin/eslint.js . --fix --cache`.

Expected: type check succeeds; Oxlint and ESLint report zero errors.

- [ ] **Step 3: Build both artifacts**

Run `node node_modules/vite/bin/vite.js build`.

Expected: production build succeeds and reports the main theme ZIP and model-pack template ZIP in the repository root.

- [ ] **Step 4: Inspect final state**

Run `git diff --check` and `git status --short`.

Expected: no whitespace errors and generated ZIP files remain outside source commits.
