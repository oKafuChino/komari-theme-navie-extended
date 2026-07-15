# Live2D Theme Route Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Live2D model entries under both legacy `/theme/` and current `/themes/` Komari static routes without weakening the independent model-pack security boundary.

**Architecture:** Keep the current plural route as the default and represent the two approved model-pack directories as an immutable prefix list in `live2dCompanion.ts`. Reuse the existing URL, traversal, same-origin, extension, and model-reference checks; documentation and managed-setting help text tell administrators to enter the route their deployment actually serves.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vite, Node test runner, Komari managed theme manifest.

## Global Constraints

- Do not modify the Komari backend, database, routes, or deployment configuration.
- Accept only `/theme/komari-live2d-models/dist/model/` and `/themes/komari-live2d-models/dist/model/`.
- Keep `/themes/komari-live2d-models/dist/model/model.model3.json` as the default model entry.
- Do not add route probing, retry requests, new dependencies, timers, or persistent storage.
- Continue rejecting external URLs, other themes, query strings, fragments, backslashes, traversal, and non-`.model3.json` files.
- Preserve Live2D rendering, scaling, pointer following, greeting, close behavior, and performance policy.

---

### Task 1: Accept Both Fixed Komari Model-Pack Routes

**Files:**
- Modify: `tests/live2d-companion-core.test.mjs`
- Modify: `tests/live2d-settings.test.mjs`
- Modify: `src/utils/live2dCompanion.ts`

**Interfaces:**
- Consumes: `isValidLive2DModelPath(value: unknown): value is string`, `normalizeLive2DModelPath(value: unknown): string`, and `resolveLive2DModelPath(path: string, origin: string): URL | null`.
- Produces: `LIVE2D_MODEL_PACK_PREFIXES: readonly string[]`; the existing three functions accept either approved prefix while retaining their signatures.

- [ ] **Step 1: Add failing core path tests**

Extend the existing model-entry test in `tests/live2d-companion-core.test.mjs` with the legacy route and explicit rejection boundaries:

```js
assert.equal(
  core.resolveLive2DModelPath(
    '/theme/komari-live2d-models/dist/model/XFZN.model3.json',
    'https://site.test',
  )?.href,
  'https://site.test/theme/komari-live2d-models/dist/model/XFZN.model3.json',
)
assert.equal(
  core.resolveLive2DModelPath(
    '/theme/komari-live2d-models/dist/model/智乃/看板娘.model3.json',
    'https://site.test',
  )?.pathname,
  '/theme/komari-live2d-models/dist/model/%E6%99%BA%E4%B9%83/%E7%9C%8B%E6%9D%BF%E5%A8%98.model3.json',
)
assert.equal(core.resolveLive2DModelPath('/theme/other/dist/model/model.model3.json', 'https://site.test'), null)
assert.equal(core.resolveLive2DModelPath('/theme/komari-live2d-models/dist/model/../x.model3.json', 'https://site.test'), null)
assert.equal(core.resolveLive2DModelPath('/theme/komari-live2d-models/dist/model/model.model3.json?x=1', 'https://site.test'), null)
```

- [ ] **Step 2: Add a failing settings normalization test**

Add this assertion to the valid-settings case in `tests/live2d-settings.test.mjs`:

```js
store.publicSettings = {
  theme_settings: {
    live2dEnabled: true,
    live2dModelPath: '/theme/komari-live2d-models/dist/model/XFZN.model3.json',
    live2dScale: 100,
  },
}
assert.equal(
  store.live2dModelPath,
  '/theme/komari-live2d-models/dist/model/XFZN.model3.json',
)
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs tests/live2d-settings.test.mjs
```

Expected: FAIL because the single `/theme/...` route is currently rejected or normalized to the plural default.

- [ ] **Step 4: Implement the minimal fixed-prefix list**

Replace the single-prefix declaration in `src/utils/live2dCompanion.ts` with:

```ts
export const LIVE2D_MODEL_PACK_PREFIXES = Object.freeze([
  '/themes/komari-live2d-models/dist/model/',
  '/theme/komari-live2d-models/dist/model/',
] as const)
export const DEFAULT_LIVE2D_MODEL_PATH = `${LIVE2D_MODEL_PACK_PREFIXES[0]}model.model3.json`
```

Replace the pathname prefix condition in `isValidLive2DModelPath()` with:

```ts
&& LIVE2D_MODEL_PACK_PREFIXES.some(prefix => resolved.pathname.startsWith(prefix))
```

Do not change `normalizeLive2DModelPath()`, `resolveLive2DModelPath()`, `hasUnsafeTraversal()`, or the model-document reference validator beyond using the new prefix collection.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run:

```powershell
node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs tests/live2d-settings.test.mjs
```

Expected: both test files pass, including the old plural-path security cases and the new singular-path cases.

- [ ] **Step 6: Commit the path compatibility change**

```powershell
git add src/utils/live2dCompanion.ts tests/live2d-companion-core.test.mjs tests/live2d-settings.test.mjs
git commit -m "fix: support legacy Komari Live2D route"
```

---

### Task 2: Explain Legacy and Current Routes in Managed Settings and Model Pack

**Files:**
- Modify: `tests/live2d-settings.test.mjs`
- Modify: `tests/live2d-release-contract.test.mjs`
- Modify: `komari-theme.json`
- Modify: `README.md`
- Modify: `packaging/live2d-model-pack/dist/model/README.txt`

**Interfaces:**
- Consumes: the two fixed route prefixes implemented in Task 1.
- Produces: administrator-facing help that preserves the plural default but documents the singular legacy route.

- [ ] **Step 1: Add failing manifest and documentation assertions**

Change the expected `live2dModelPath.help` in `tests/live2d-settings.test.mjs` to:

```js
help: '填写当前 Komari 可访问的 /themes/ 或旧版 /theme/ 模型入口路径',
```

Add these assertions to `tests/live2d-release-contract.test.mjs`:

```js
assert.match(readme, /\/theme\/komari-live2d-models\/dist\/model\/XFZN\.model3\.json/)
assert.match(guide, /\/theme\/komari-live2d-models\/dist\/model\/XFZN\.model3\.json/)
assert.match(readme, /\/themes\/komari-live2d-models\/dist\/model\/model\.model3\.json/)
assert.match(guide, /\/themes\/komari-live2d-models\/dist\/model\/model\.model3\.json/)
```

- [ ] **Step 2: Run documentation contract tests and verify RED**

Run:

```powershell
node --test --test-concurrency=1 tests/live2d-settings.test.mjs tests/live2d-release-contract.test.mjs
```

Expected: FAIL because the manifest and guides only describe the plural route.

- [ ] **Step 3: Update the managed-setting help**

In `komari-theme.json`, keep the key, type, and default unchanged and set:

```json
{
  "key": "live2dModelPath",
  "name": "Live2D 模型入口",
  "type": "string",
  "default": "/themes/komari-live2d-models/dist/model/model.model3.json",
  "help": "填写当前 Komari 可访问的 /themes/ 或旧版 /theme/ 模型入口路径"
}
```

- [ ] **Step 4: Update both administrator guides**

Add the following explanation near the existing model-path examples in `README.md` and `packaging/live2d-model-pack/dist/model/README.txt`:

```text
当前 Komari 通常使用：
/themes/komari-live2d-models/dist/model/model.model3.json

部分旧版 Komari 使用单数路由，例如：
/theme/komari-live2d-models/dist/model/XFZN.model3.json

请填写浏览器中实际能够访问模型 JSON 的路径；主题同时支持以上两种固定路由。
```

- [ ] **Step 5: Run documentation contract tests and verify GREEN**

Run:

```powershell
node --test --test-concurrency=1 tests/live2d-settings.test.mjs tests/live2d-release-contract.test.mjs
```

Expected: both test files pass.

- [ ] **Step 6: Commit the administrator guidance change**

```powershell
git add komari-theme.json README.md packaging/live2d-model-pack/dist/model/README.txt tests/live2d-settings.test.mjs tests/live2d-release-contract.test.mjs
git commit -m "docs: explain legacy Live2D model route"
```

---

### Task 3: Verify and Package the Compatibility Fix

**Files:**
- Verify only: `src/utils/live2dCompanion.ts`
- Verify only: `komari-theme.json`
- Verify only: `README.md`
- Verify only: `packaging/live2d-model-pack/dist/model/README.txt`
- Generated: `komari-theme-naive-extended-build-<sha>.zip`
- Generated: `komari-live2d-model-pack-template.zip`

**Interfaces:**
- Consumes: the completed path validator and administrator documentation.
- Produces: verified theme and model-pack release ZIP files.

- [ ] **Step 1: Run all unit and contract tests**

```powershell
node --test --test-concurrency=1 tests/*.test.mjs
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run TypeScript and lint verification**

```powershell
node node_modules/vue-tsc/bin/vue-tsc.js --build
& .\node_modules\.bin\oxlint.cmd . --fix
node node_modules/eslint/bin/eslint.js . --fix --cache
```

Expected: type check exits successfully; Oxlint and ESLint report zero errors. Inspect `git diff` after fix-capable linters and retain only intentional formatting changes.

- [ ] **Step 3: Build both release artifacts**

```powershell
node node_modules/vite/bin/vite.js build
```

Expected: Vite production build succeeds and reports creation of the main theme ZIP and `komari-live2d-model-pack-template.zip` in the repository root, matching the current `main` build contract. The previously planned `release/` migration remains outside this bug fix.

- [ ] **Step 4: Inspect the final diff and repository state**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only intentional source, tests, manifest, documentation, and generated root ZIP changes remain. Generated ZIP files stay outside the source commits.

- [ ] **Step 5: Commit any verification-only formatting changes**

Only if the linters changed an already planned file:

```powershell
git add src/utils/live2dCompanion.ts tests/live2d-companion-core.test.mjs tests/live2d-settings.test.mjs tests/live2d-release-contract.test.mjs komari-theme.json README.md packaging/live2d-model-pack/dist/model/README.txt
git commit -m "style: normalize Live2D compatibility changes"
```
