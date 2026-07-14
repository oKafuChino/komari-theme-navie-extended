# Live2D Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task with a review checkpoint after each task.

**Goal:** Add an optional, low-overhead Live2D companion to both public Komari theme routes, with session-only IP greeting, click messages, and close behavior, without changing Komari backend code.

**Architecture:** Mount one `Live2DCompanion` in the global Vue shell. A policy module handles settings, model-path validation, frame profiles, session flags, and greeting text; a runtime adapter lazy-loads Cubism Core, PixiJS, and `pixi-live2d-display`; the component owns browser lifecycle and presentation. Runtime and model files are same-origin static assets under `/live2d/`.

**Tech Stack:** Vue 3 Composition API, Pinia, Vite 7, PixiJS `6.5.10`, `pixi-live2d-display` `0.4.0`, Live2D Cubism 3/4 Core, Node's built-in test runner, Vite SSR module tests, Naive UI/UnoCSS conventions already in the repository.

## Global Constraints

- Do not modify Komari backend files, APIs, database schema, middleware, or server processes.
- Support Cubism 3/4 `.model3.json`; do not add Cubism 2 support.
- `live2dEnabled` defaults to `false`; disabled pages must request no runtime, model, texture, or IP resource.
- `live2dModelPath` defaults to `/live2d/model/model.model3.json` and must remain same-origin below `/live2d/`.
- `live2dScale` defaults to `100` and is clamped to `50-150`.
- Desktop frame policy is 60 FPS active and 15 FPS idle; touch/mobile is 24 FPS active and 12 FPS idle; idle begins five seconds after the latest activation.
- Hidden pages pause at 0 FPS; reduced-motion pages render one static frame and do not animate.
- Desktop model width is approximately `220-320px` and at most `42vh`; touch/mobile width is approximately `150-190px` and at most `32vh`.
- The IP address is never persisted by the theme or Komari. Only session greeted/hidden sentinels may be stored.
- The IP request uses ipify with `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `cache: 'no-store'`, and a 2.5 second timeout.
- The model close action destroys the renderer, textures, WebGL context, timers, frames, requests, listeners, and Canvas node.
- Preserve `komari-theme-naive-extended-build-<sha>.zip`, `komari-theme.json`, `preview.png`, and the existing ZIP root layout.
- Preserve the existing ambient sakura/starlight behavior and its 60 FPS desktop/30 FPS touch profile.
- Do not copy the supplied XFZN model or character artwork into tracked files, `public/`, `dist/`, or the release artifact.
- Include the official Cubism Core license and third-party notices; do not label Cubism Core as project MIT code.

## File Map

### Runtime and policy

- Create `src/utils/live2dCompanion.ts`: pure settings, profile, scale, path/reference validation, session flags, IP-value validation, and click-message selection.
- Create `src/utils/live2dGreeting.ts`: injected-fetch one-time greeting flow with timeout, fallback text, and no IP persistence.
- Create `src/utils/live2dRuntime.ts`: lazy Core/script loading, Pixi/Live2D model creation, fit/resize, active/idle ticker control, pause/resume, and idempotent destruction.
- Create `src/components/Live2DCompanion.vue`: global component lifecycle, media/visibility listeners, accessible model interaction, bubble, close action, and responsive styles.
- Modify `src/stores/app.ts`: defensively expose the three Live2D settings.
- Modify `src/App.vue`: mount exactly one component after loading completes.
- Modify `src/types/global.d.ts` only if development-only diagnostics need a typed global.

### Configuration and assets

- Modify `package.json`: add `pixi.js` and `pixi-live2d-display` as runtime dependencies using the workspace catalog.
- Modify `pnpm-workspace.yaml`: add catalog versions `pixi.js: 6.5.10` and `pixi-live2d-display: 0.4.0` so the direct Pixi runtime matches the display package's `@pixi/*@^6` peers.
- Modify `pnpm-lock.yaml` through `corepack pnpm install --lockfile-only` after dependency edits.
- Modify `komari-theme.json`: add the three managed settings under `Live2D 看板娘`.
- Modify `vite.config.ts`: add a `live2d-vendor` manual chunk for the two lazy runtime dependencies while preserving all existing chunks and ZIP packaging.
- Create `public/live2d/model/README.txt`: administrator installation, same-origin path, supported formats, and 2048-texture memory recommendation.
- Create `public/live2d/runtime/THIRD-PARTY-NOTICES.txt`: exact Cubism Core source/version/license notice.
- Add `public/live2d/runtime/live2dcubismcore.min.js` only after the official redistribution terms and source hash are recorded.

### Tests and documentation

- Create `tests/live2d-settings.test.mjs`.
- Create `tests/live2d-companion-core.test.mjs`.
- Create `tests/live2d-greeting.test.mjs`.
- Create `tests/live2d-runtime-contract.test.mjs`.
- Create `tests/live2d-component-contract.test.mjs`.
- Modify `README.md` with the administrator model workflow and ipify disclosure.

---

### Task 1: Add dependency and managed-setting contracts

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `komari-theme.json`
- Modify: `src/stores/app.ts`
- Create: `tests/live2d-settings.test.mjs`

**Interfaces:**
- Produces `appStore.live2dEnabled: ComputedRef<boolean>`, `appStore.live2dModelPath: ComputedRef<string>`, and `appStore.live2dScale: ComputedRef<number>`.
- Uses the existing `resolveBooleanThemeSetting` pattern and existing `publicSettings.theme_settings` source of truth.

- [ ] **Step 1: Write the failing settings and dependency tests**

Add tests that read the manifest and load the app store through Vite SSR:

```js
test('declares the three Live2D settings', async () => {
  const manifest = JSON.parse(await readFile(new URL('../komari-theme.json', import.meta.url), 'utf8'))
  const items = manifest.configuration.data
  assert.deepEqual(items.find(item => item.key === 'live2dEnabled'), {
    key: 'live2dEnabled', name: '启用 Live2D 看板娘', type: 'switch', default: false,
    help: '在公共探针页面显示管理员提供的 Live2D 看板娘',
  })
  assert.deepEqual(items.find(item => item.key === 'live2dModelPath'), {
    key: 'live2dModelPath', name: 'Live2D 模型入口', type: 'string',
    default: '/live2d/model/model.model3.json',
    help: '同源 /live2d/ 目录下的 Cubism 3/4 .model3.json 路径',
  })
  assert.deepEqual(items.find(item => item.key === 'live2dScale'), {
    key: 'live2dScale', name: 'Live2D 显示缩放', type: 'number', default: 100,
    help: '看板娘显示缩放百分比，运行时限制为 50-150',
  })
})

test('normalizes invalid Live2D settings to safe defaults', async () => {
  const { useAppStore } = await vite.ssrLoadModule('/src/stores/app.ts')
  const store = useAppStore()
  store.publicSettings = { theme_settings: {
    live2dEnabled: 'true', live2dModelPath: 'https://evil.test/model.model3.json', live2dScale: 999,
  } }
  assert.equal(store.live2dEnabled, false)
  assert.equal(store.live2dModelPath, '/live2d/model/model.model3.json')
  assert.equal(store.live2dScale, 150)
})

test('declares the pinned runtime dependencies', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.dependencies.pixijs, undefined)
  assert.equal(pkg.dependencies['pixi.js'], 'catalog:')
  assert.equal(pkg.dependencies['pixi-live2d-display'], 'catalog:')
  const workspace = await readFile(new URL('../pnpm-workspace.yaml', import.meta.url), 'utf8')
  assert.match(workspace, /pixi\.js:\s*7\.4\.3/)
  assert.match(workspace, /pixi-live2d-display:\s*0\.4\.0/)
})
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `node --test --test-concurrency=1 tests/live2d-settings.test.mjs`

Expected: FAIL because the manifest, store properties, and dependencies do not exist yet.

- [ ] **Step 3: Add catalog dependencies and lockfile entries**

Add these catalog entries:

```yaml
pixi.js: 6.5.10
pixi-live2d-display: 0.4.0
```

Add both packages to `package.json` dependencies with the existing `"catalog:"` convention, then run:

```bash
corepack pnpm install --lockfile-only
```

Confirm the lockfile records the two exact versions and their resolved peer dependencies.

- [ ] **Step 4: Add manifest schema and store normalization**

Insert the managed section in `komari-theme.json`:

```json
{ "name": "Live2D 看板娘", "type": "title" },
{ "key": "live2dEnabled", "name": "启用 Live2D 看板娘", "type": "switch", "default": false, "help": "在公共探针页面显示管理员提供的 Live2D 看板娘" },
{ "key": "live2dModelPath", "name": "Live2D 模型入口", "type": "string", "default": "/live2d/model/model.model3.json", "help": "同源 /live2d/ 目录下的 Cubism 3/4 .model3.json 路径" },
{ "key": "live2dScale", "name": "Live2D 显示缩放", "type": "number", "default": 100, "help": "看板娘显示缩放百分比，运行时限制为 50-150" }
```

In `src/stores/app.ts`, add defensive computed values. `live2dModelPath` accepts only a trimmed string that starts with `/live2d/` and ends with `.model3.json`; invalid values use the default. `live2dScale` accepts finite numbers and returns `Math.min(150, Math.max(50, value))`; non-numbers use `100`.

- [ ] **Step 5: Run the focused tests and verify they pass**

Run: `node --test --test-concurrency=1 tests/live2d-settings.test.mjs`

Expected: all settings and dependency contract tests pass.

- [ ] **Step 6: Commit the task**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml komari-theme.json src/stores/app.ts tests/live2d-settings.test.mjs
git commit -m "feat: add Live2D theme settings"
```

### Task 2: Implement policy and session/greeting utilities

**Files:**
- Create: `src/utils/live2dCompanion.ts`
- Create: `src/utils/live2dGreeting.ts`
- Create: `tests/live2d-companion-core.test.mjs`
- Create: `tests/live2d-greeting.test.mjs`

**Interfaces:**
- Produces `resolveLive2DProfile(input)`, `clampLive2DScale(value)`, `resolveLive2DModelPath(path, origin)`, `validateLive2DModelDocument(document, modelUrl)`, `readSessionFlag(storage, key)`, `writeSessionFlag(storage, key)`, `pickLive2DMessage(random)`, and `validateVisitorIp(value)`.
- Produces `fetchVisitorIp(fetcher, timeoutMs)`, returning `Promise<string | null>`; it never writes storage.
- Uses no Vue, Pixi, DOM, or network globals except injected `fetcher` and storage arguments.

- [ ] **Step 1: Write failing pure-policy tests**

Cover the approved profile and validation values:

```js
test('resolves desktop and touch active/idle profiles', async () => {
  assert.deepEqual(core.resolveLive2DProfile({ finePointer: true, reducedMotion: false }), {
    name: 'desktop', activeFps: 60, idleFps: 15,
  })
  assert.deepEqual(core.resolveLive2DProfile({ finePointer: false, reducedMotion: false }), {
    name: 'touch', activeFps: 24, idleFps: 12,
  })
  assert.equal(core.resolveLive2DProfile({ finePointer: true, reducedMotion: true }), null)
})

test('validates same-origin model paths and rejects traversal', () => {
  assert.equal(core.resolveLive2DModelPath('/live2d/model/XFZN.model3.json', 'https://site.test')?.pathname,
    '/live2d/model/XFZN.model3.json')
  assert.equal(core.resolveLive2DModelPath('https://evil.test/model.model3.json', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('/live2d/model/../runtime/model.model3.json', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('/assets/model.json', 'https://site.test'), null)
})

test('clamps scale and selects both click messages deterministically', () => {
  assert.equal(core.clampLive2DScale(20), 50)
  assert.equal(core.clampLive2DScale(175), 150)
  assert.equal(core.clampLive2DScale('100'), 100)
  assert.match(core.pickLive2DMessage(() => 0), /喵喵喵/)
  assert.match(core.pickLive2DMessage(() => 0.99), /有什么可以帮忙/)
})
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs`

Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement the policy module**

Use a frozen profile table, explicit defaults, and URL normalization. `resolveLive2DModelPath` must compare the normalized URL origin to `origin`, require pathname `/live2d/`, require `.model3.json`, reject any encoded or normalized parent traversal, and return a URL only for an allowed path.

`validateLive2DModelDocument` must inspect `FileReferences.Moc`, `Textures`, `Physics`, `Pose`, `DisplayInfo`, `UserData`, `Expressions[*].File`, and every `Motions[*][*].File`/`Sound` value that is present. Return a list of exact invalid reference labels; an empty list means valid. Ignore absent optional groups.

Use these exact constants:

```ts
export const LIVE2D_GREETING_KEY = 'komari-naive-extended:live2d:greeted'
export const LIVE2D_HIDDEN_KEY = 'komari-naive-extended:live2d:hidden'
export const LIVE2D_MESSAGES = [
  '喵喵喵？不要随便摸我啦~',
  '请问...有什么可以帮忙的吗？',
] as const
```

- [ ] **Step 4: Implement and test the injected IP lookup**

`fetchVisitorIp` must create an `AbortController`, abort after `timeoutMs` (the component passes `2500`), call the injected fetcher with the exact options below, parse JSON, validate `json.ip`, and return `null` for every failure:

```ts
fetch(url, {
  credentials: 'omit',
  referrerPolicy: 'no-referrer',
  cache: 'no-store',
  signal: controller.signal,
})
```

Do not write the returned value to storage. Test success, timeout/abort, non-OK response, malformed JSON, invalid characters, and an overlong value.

- [ ] **Step 5: Run both focused suites and commit**

Run: `node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs tests/live2d-greeting.test.mjs`

Expected: all policy and greeting tests pass.

```bash
git add src/utils/live2dCompanion.ts src/utils/live2dGreeting.ts tests/live2d-companion-core.test.mjs tests/live2d-greeting.test.mjs
git commit -m "feat: add Live2D companion policies"
```

### Task 3: Build the lazy Live2D runtime adapter

**Files:**
- Create: `src/utils/live2dRuntime.ts`
- Create: `tests/live2d-runtime-contract.test.mjs`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces `createLive2DRuntime(options): Promise<Live2DHandle>`.
- `Live2DHandle` exposes `setActivity(active: boolean)`, `setVisible(visible: boolean)`, `resize(width, height, dpr, scale)`, `getDiagnostics()`, and `destroy()`.
- `Live2DRuntimeOptions` consumes a target model URL, Canvas element, nullable profile, reduced-motion flag, warning callback, and injectable `loadCore`/renderer factory for tests. A `null` profile means render one static frame rather than skip model loading.

- [ ] **Step 1: Write failing adapter-contract tests**

Assert source-level contracts for one lazy runtime path, low-power renderer options, active/idle limits, visibility pause, and idempotent destruction. Add fake-loader tests that verify a failed Core/model load resolves to a single warning and no scheduled frame.

```js
test('runtime adapter keeps renderer dependencies lazy', async () => {
  const source = await readFile(new URL('../src/utils/live2dRuntime.ts', import.meta.url), 'utf8')
  assert.match(source, /import\(['"]pixi\.js['"]\)/)
  assert.match(source, /import\(['"]pixi-live2d-display['"]\)/)
  assert.match(source, /powerPreference\s*:\s*['"]low-power['"]|powerPreference\s*:\s*['"]low-power['"]?/)
  assert.match(source, /live2dcubismcore\.min\.js/)
})
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `node --test --test-concurrency=1 tests/live2d-runtime-contract.test.mjs`

Expected: FAIL because the adapter file does not exist.

- [ ] **Step 3: Implement Core loading and the renderer factory**

Add a module-level `corePromise` so concurrent initialization loads `/live2d/runtime/live2dcubismcore.min.js` once. Resolve only after `window.Live2DCubismCore` exists; reject with one typed error otherwise. Use a DOM script element with `async = true`, `crossOrigin = 'anonymous'`, and no retry loop.

Inside the injected renderer factory, create one Pixi `Application` with transparent background, `antialias: false`, `preserveDrawingBuffer: false`, `powerPreference: 'low-power'`, and resolution `Math.min(window.devicePixelRatio || 1, 1.5)`. Create one `Live2DModel.from(modelUrl, { autoInteract: false, autoUpdate: false })`, add it to the stage, fit its measured local bounds to the constrained Canvas, and anchor it at the bottom center.

Use the Pixi ticker as the only runtime scheduler. Set `ticker.maxFPS` to `activeFps` while active and `idleFps` while idle, call `app.stop()` for hidden/static states, and update the model through the pinned library's public manual-update API from the ticker callback. Do not use the shared global ticker. `resize` must update the renderer backing store and recompute model scale without allocating another Canvas.

- [ ] **Step 4: Implement pause, diagnostics, and idempotent destruction**

`setVisible(false)` stops the app and resets elapsed timing. `setVisible(true)` resumes at the current profile. `setActivity` changes only the ticker cap and starts a five-second idle timer owned by the adapter. `destroy` clears that timer, removes the ticker callback, destroys the model and Pixi app with texture cleanup, clears the Canvas dimensions, and is safe to call twice.

Expose development-only diagnostics `{ running, targetFps, frameCount, destroyed }`; return `null` or remove the global in production. On any model/ticker exception, warn once, stop, destroy, and reject/resolve the owning initialization without throwing into Vue rendering.

- [ ] **Step 5: Isolate the vendor chunk and run the adapter tests**

Add this entry to the existing Vite `manualChunks` object without removing current entries:

```ts
'live2d-vendor': ['pixi.js', 'pixi-live2d-display'],
```

Run: `node --test --test-concurrency=1 tests/live2d-runtime-contract.test.mjs`

Expected: all lazy-load, profile, failure, and destroy tests pass.

- [ ] **Step 6: Commit the task**

```bash
git add src/utils/live2dRuntime.ts vite.config.ts tests/live2d-runtime-contract.test.mjs
git commit -m "feat: add lazy Live2D runtime"
```

### Task 4: Mount the accessible companion component

**Files:**
- Create: `src/components/Live2DCompanion.vue`
- Modify: `src/App.vue`
- Create: `tests/live2d-component-contract.test.mjs`

**Interfaces:**
- Consumes the app-store computed settings, `resolveLive2DProfile`, `createLive2DRuntime`, `fetchVisitorIp`, and session constants from Tasks 1-3.
- Produces one fixed responsive DOM subtree and one runtime handle for the entire App shell.

- [ ] **Step 1: Write failing component contract tests**

Read the Vue source and assert exactly one global mount, the approved labels, the two message strings, `aria-live`, the Lucide close icon, `pointer-events: none` only on the Canvas, and the mobile/desktop responsive rules.

```js
test('mounts one accessible companion in the app shell', async () => {
  const app = await source('src/App.vue')
  const component = await source('src/components/Live2DCompanion.vue')
  assert.match(app, /import Live2DCompanion from '\.\/components\/Live2DCompanion\.vue'/)
  assert.match(app, /<Live2DCompanion v-if="!appStore\.loading" \/>/)
  assert.match(component, /aria-live="polite"/)
  assert.match(component, /i-lucide-x/)
  assert.match(component, /与看板娘互动/)
  assert.match(component, /关闭看板娘/)
  assert.match(component, /喵喵喵/)
  assert.match(component, /有什么可以帮忙/) 
})
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `node --test --test-concurrency=1 tests/live2d-component-contract.test.mjs`

Expected: FAIL because the component is not mounted or present.

- [ ] **Step 3: Implement the component lifecycle**

On mount, read `matchMedia('(hover: hover) and (pointer: fine)')`, `matchMedia('(prefers-reduced-motion: reduce)')`, and `document.visibilityState`; load the runtime whenever the feature is enabled and unhidden. Pass a `null` runtime profile when reduced motion is active so the adapter draws one static frame without starting its ticker. Use `requestIdleCallback` with `{ timeout: 1000 }` when available and `setTimeout(..., 0)` fallback. Keep one `loadVersion` counter so a late model load cannot attach after close or unmount.

After a successful model handle is ready, read the greeted sentinel. When it is absent, call `fetchVisitorIp`, set the bubble to the IP-specific string or generic fallback, and then write only the greeted sentinel. On model click or `Enter`/`Space`, call the injected random selector and reset the four-second bubble timer. Stop event propagation from the close button.

Use these semantic elements:

```vue
<div v-if="visible" class="live2d-companion">
  <div ref="interactionTarget" class="live2d-companion__model" role="button" tabindex="0" aria-label="与看板娘互动">
    <canvas ref="canvas" aria-hidden="true" />
  </div>
  <div v-if="message" class="live2d-companion__bubble" role="status" aria-live="polite">{{ message }}</div>
  <button class="live2d-companion__close" type="button" aria-label="关闭看板娘" @click.stop="hideForSession">
    <span class="i-lucide-x" aria-hidden="true" />
  </button>
</div>
```

`hideForSession` writes the hidden sentinel, aborts in-flight work, calls handle destruction, clears message timers, and sets `visible = false`. On unmount, run the same cleanup idempotently and remove every media, visibility, pointer, resize, and keyboard listener.

- [ ] **Step 4: Implement visual and responsive styles**

Use a fixed lower-left wrapper with `z-index: 15`, safe-area-aware `left`/`bottom`, no page-layout dimensions, and `pointer-events: none` on the wrapper, Canvas, and bubble. Set `pointer-events: auto` only on the model interaction target and close button. Use CSS variables for light/dark colors, a semi-opaque bubble, thin border, restrained shadow, and short opacity/transform transitions.

Apply these constraints:

```scss
.live2d-companion__model { width: clamp(220px, 22vw, 320px); max-height: 42vh; }
.live2d-companion__bubble { max-width: min(240px, calc(100vw - 24px)); }
@media (max-width: 600px) {
  .live2d-companion__model { width: min(42vw, 190px); max-height: 32vh; }
}
@media (prefers-reduced-motion: reduce) {
  .live2d-companion *, .live2d-companion *::before { transition: none !important; }
}
```

Show the close button only on model hover/focus for fine pointers and keep it subtly visible on touch. Do not apply a Canvas blur/filter. Use the `i-lucide-x` icon through the existing UnoCSS icon preset.

- [ ] **Step 5: Run component tests and type-check**

Run:

```bash
node --test --test-concurrency=1 tests/live2d-component-contract.test.mjs
corepack pnpm run type-check
```

Expected: all component contract tests pass and `vue-tsc` reports no new errors.

- [ ] **Step 6: Commit the task**

```bash
git add src/components/Live2DCompanion.vue src/App.vue tests/live2d-component-contract.test.mjs
git commit -m "feat: mount Live2D companion"
```

### Task 5: Add release assets, documentation, and privacy copy

**Files:**
- Create: `public/live2d/model/README.txt`
- Create: `public/live2d/runtime/THIRD-PARTY-NOTICES.txt`
- Add: `public/live2d/runtime/live2dcubismcore.min.js` from the official SDK only after license verification
- Modify: `README.md`
- Create: `tests/live2d-release-contract.test.mjs`

**Interfaces:**
- Consumes the runtime path and administrator settings from Tasks 1-4.
- Produces a self-contained release layout that requires the administrator to add only their model files.

- [ ] **Step 1: Write failing release-contract tests**

Assert that the model instructions mention `dist/live2d/model/`, `.model3.json`, same-origin paths, 2048 textures, the ipify disclosure, and the no-backend requirement. Assert the runtime notice path exists and the supplied `XFZN` name is absent from tracked source.

- [ ] **Step 2: Run the release-contract test and verify it fails**

Run: `node --test --test-concurrency=1 tests/live2d-release-contract.test.mjs`

Expected: FAIL because the public Live2D directories and documentation do not exist.

- [ ] **Step 3: Add the model instructions and notice**

`README.txt` must state the four administrator steps from the spec, supported Cubism 3/4 format, exact example path `/live2d/model/XFZN.model3.json`, same-origin restriction, preservation of relative references, and the decoded-memory impact of 4096 versus 2048 textures.

`THIRD-PARTY-NOTICES.txt` must name the Cubism Core source URL, exact SDK/Core version, copyright owner, applicable license text location, and the fact that the file is distributed as part of this theme's static runtime. Do not write a fabricated license or call it MIT.

- [ ] **Step 4: Add the official Core runtime and README disclosure**

Obtain the Core file from the official SDK distribution, verify its checksum against the recorded source file, and place it at `public/live2d/runtime/live2dcubismcore.min.js`. Add a README subsection explaining that the optional feature sends one browser-side request to ipify, that ipify sees the public IP, and that the theme/Komari do not retain it. Explain how to enable the feature and replace the model after extracting a release ZIP.

- [ ] **Step 5: Run the release tests and commit**

Run: `node --test --test-concurrency=1 tests/live2d-release-contract.test.mjs`

Expected: all release and privacy copy tests pass.

```bash
git add public/live2d README.md tests/live2d-release-contract.test.mjs
git commit -m "docs: document Live2D release workflow"
```

### Task 6: Verify the complete feature and release artifact

**Files:**
- Test: all `tests/*.test.mjs`
- Build output: `dist/` and `komari-theme-naive-extended-build-<sha>.zip`

**Interfaces:**
- Consumes all implementation tasks.
- Produces verification evidence and a release-ready ZIP without adding the supplied model.

- [ ] **Step 1: Run the full automated checks**

Run:

```bash
corepack pnpm test:unit
corepack pnpm lint
corepack pnpm build
```

Expected: all Node tests pass, lint exits successfully, type-check/build complete, and the ZIP is created with the existing Extended naming.

- [ ] **Step 2: Inspect the built ZIP**

List the archive contents and assert these entries exist:

```text
dist/
dist/live2d/runtime/live2dcubismcore.min.js
dist/live2d/runtime/THIRD-PARTY-NOTICES.txt
dist/live2d/model/README.txt
komari-theme.json
preview.png
```

Assert no `XFZN`, `icon.jpg`, `texture_00.png`, or other supplied model file is present.

- [ ] **Step 3: Run the manual browser matrix**

With an untracked local copy of the supplied XFZN model, verify both `/` and `/instance/:id` at 1440x900 light/dark and 390x844 light/dark. Check successful and failed IP greeting, both click messages, desktop hover/focus close, touch close, route reuse, reload/session behavior, missing model, malformed JSON, missing texture, WebGL failure, unavailable storage, custom background, and reduced motion.

- [ ] **Step 4: Verify runtime budgets**

Use development diagnostics and browser Performance tools to confirm no Live2D request exists while disabled, model loading waits until after the first interactive paint, active/idle rates are exactly 60/15 desktop and 24/12 touch, hidden/reduced-motion behavior is correct, close removes the Canvas and pending work, and repeated route changes retain one runtime instance.

- [ ] **Step 5: Record final status and commit verification changes**

```bash
git status --short
git log -5 --oneline
```

Confirm `.superpowers/` and the generated ZIP remain ignored/uncommitted, supplied model files remain outside the repository, and the working tree contains only intentional source, asset, test, documentation, and lockfile changes.

## Plan Self-Review

- Spec coverage: architecture, settings, model packaging, privacy, interaction, visual behavior, frame budgets, failure handling, testing, and ZIP acceptance are covered by Tasks 1-6.
- Placeholder scan: no `TBD`, `TODO`, `FIXME`, or unresolved choice is used in this plan.
- Type consistency: the store properties, policy exports, greeting return type, runtime handle methods, and component consumers are named consistently across tasks.
- Scope: no backend change, admin upload UI, unrelated refactor, or second independent subsystem is introduced.
- Risk gate: official Cubism Core redistribution terms and exact source checksum are verified in Task 5 before the file enters `public/` or a release ZIP.
