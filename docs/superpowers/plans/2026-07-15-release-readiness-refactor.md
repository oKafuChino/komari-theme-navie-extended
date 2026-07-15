# Release Readiness Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release a Komari 1.2.6+ compatible theme with safe public settings, maintainable runtime boundaries, verified ZIP packages, correct CI artifacts, and clear user documentation.

**Architecture:** Preserve the Pinia store API, manifest settings, snapshot `version: 1`, ZIP names, and visible interaction. Move deterministic parsing and coordination into pure modules; components remain presentation adapters. Validate generated ZIP files after each production build.

**Tech Stack:** Vue 3, TypeScript, Pinia, Naive UI, Node test runner, Vite, GitHub Actions.

## Global Constraints

- Support Komari 1.2.6 and later.
- Accept Live2D models only under `/themes/komari-live2d-models/dist/model/*.model3.json`.
- Delete all legacy `/theme/` compatibility, tests, and documentation.
- Preserve configuration keys/defaults, snapshots, resource-pack identity, package names, and user-facing behavior.
- Do not add dependencies, credentials, private URLs, or model assets.

---

## Task 1: Centralize Public Setting Validation

**Files:**
- Create: `src/utils/themeSettings.ts`
- Create: `tests/theme-settings.test.mjs`
- Modify: `src/stores/app.ts`
- Modify: `src/components/Footer.vue`
- Modify: `src/components/Background.vue`

**Interfaces:**
- Consumes: `PublicSettings.theme_settings`.
- Produces: `resolveBooleanSetting`, `resolveNumberSetting`, `resolveSelectSetting`, `parseAllowedColumns`, `parseColumnStyles`, and `normalizePublicUrl`.
- Preserves: every `useAppStore()` property consumed by existing components.

- [ ] **Step 1: Write the failing tests**

```js
test('accepts HTTPS and root-relative URLs but rejects unsafe URLs', async () => {
  const settings = await vite.ssrLoadModule('/src/utils/themeSettings.ts')
  assert.equal(settings.normalizePublicUrl('https://beian.miit.gov.cn/', ''), 'https://beian.miit.gov.cn/')
  assert.equal(settings.normalizePublicUrl('/images/background.webp', ''), '/images/background.webp')
  assert.equal(settings.normalizePublicUrl('javascript:alert(1)', ''), '')
  assert.equal(settings.normalizePublicUrl('https://u:p@example.test/a', ''), '')
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test --test-concurrency=1 tests/theme-settings.test.mjs`

Expected: FAIL because `src/utils/themeSettings.ts` does not exist.

- [ ] **Step 3: Implement the pure utility**

```ts
export function normalizePublicUrl(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value !== value.trim()) return fallback
  try {
    const base = new URL('https://komari.invalid/')
    const url = new URL(value, base)
    const relative = url.origin === base.origin
    if ((!relative && url.protocol !== 'https:') || url.username || url.password || url.hash) return fallback
    return relative ? `${url.pathname}${url.search}` : url.toString()
  } catch { return fallback }
}
```

Also move current list-column JSON parsing and Boolean/number/select defaults from `app.ts` into named, immutable helper functions. Retain every current default and accepted value.

- [ ] **Step 4: Delegate store and consumers**

Use helpers in `src/stores/app.ts`. Normalize ICP, police, light-background, and dark-background URLs before returning them. Keep the ICP default and an empty police URL unchanged.

- [ ] **Step 5: Verify GREEN**

Run: `node --test --test-concurrency=1 tests/theme-settings.test.mjs tests/ambient-settings.test.mjs tests/live2d-settings.test.mjs tests/residual-value-settings.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/themeSettings.ts tests/theme-settings.test.mjs src/stores/app.ts src/components/Footer.vue src/components/Background.vue
git commit -m "refactor: centralize public theme settings"
```

## Task 2: Extract Safe Announcement Markdown

**Files:**
- Create: `src/utils/markdown.ts`
- Create: `tests/markdown.test.mjs`
- Modify: `src/components/MarkdownRenderer.vue`

**Interfaces:**
- Consumes: announcement string and `normalizePublicUrl`.
- Produces: `MarkdownToken[]` containing only safe `link` and `image` destinations.
- Preserves: bold, italic, inline code, safe links/images, and line breaks.

- [ ] **Step 1: Write the failing tests**

```js
assert.deepEqual(markdown.parseMarkdown('<b>notice</b>'), [{ type: 'text', content: '<b>notice</b>' }])
assert.deepEqual(markdown.parseMarkdown('[run](javascript:alert(1))'), [{ type: 'text', content: 'run' }])
assert.deepEqual(markdown.parseMarkdown('![x](data:image/svg+xml,x)'), [])
```

- [ ] **Step 2: Verify RED**

Run: `node --test --test-concurrency=1 tests/markdown.test.mjs`

Expected: FAIL because the parser remains inside the Vue component.

- [ ] **Step 3: Implement `src/utils/markdown.ts`**

Export the existing token union and `parseMarkdown`. Keep literal text raw because Vue interpolation escapes it once. Convert unsafe links to their visible text label and omit unsafe image tokens. Use the Task 1 URL helper.

- [ ] **Step 4: Simplify `MarkdownRenderer.vue`**

Import the tokenizer, delete `escapeHtml` and local parsing, and retain Naive UI components plus `noopener noreferrer`.

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test --test-concurrency=1 tests/markdown.test.mjs tests/theme-settings.test.mjs`

Expected: PASS.

```bash
git add src/utils/markdown.ts tests/markdown.test.mjs src/components/MarkdownRenderer.vue
git commit -m "refactor: isolate safe announcement rendering"
```

## Task 3: Require the Official Live2D Route

**Files:**
- Modify: `src/utils/live2dCompanion.ts`
- Modify: `tests/live2d-companion-core.test.mjs`
- Modify: `tests/live2d-settings.test.mjs`
- Modify: `tests/live2d-release-contract.test.mjs`
- Modify: `packaging/live2d-model-pack/dist/model/README.txt`

**Interfaces:**
- Consumes: current `live2dModelPath` setting.
- Produces: only same-origin `/themes/komari-live2d-models/dist/model/*.model3.json` URLs.
- Preserves: nested model directories and model-reference sandboxing.

- [ ] **Step 1: Replace legacy acceptance tests with rejection tests**

```js
assert.equal(core.isValidLive2DModelPath('/themes/komari-live2d-models/dist/model/XFZN.model3.json'), true)
assert.equal(core.resolveLive2DModelPath('/theme/komari-live2d-models/dist/model/XFZN.model3.json', 'https://site.test'), null)
```

- [ ] **Step 2: Verify RED**

Run: `node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs tests/live2d-settings.test.mjs`

Expected: FAIL because the singular prefix is currently allowed.

- [ ] **Step 3: Remove the singular prefix**

```ts
export const LIVE2D_MODEL_PACK_PREFIX = '/themes/komari-live2d-models/dist/model/'
```

Remove all old-prefix constants and guide text. Retain encoded traversal, backslash, query, hash, external-origin, and out-of-directory rejections.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs tests/live2d-settings.test.mjs tests/live2d-release-contract.test.mjs`

Expected: PASS and no `/theme/komari-live2d-models` text remains.

```bash
git add src/utils/live2dCompanion.ts tests/live2d-companion-core.test.mjs tests/live2d-settings.test.mjs tests/live2d-release-contract.test.mjs packaging/live2d-model-pack/dist/model/README.txt
git commit -m "refactor: require official Live2D theme route"
```

## Task 4: Extract Three-Network Run Coordination

**Files:**
- Create: `src/utils/threeNetworkRun.ts`
- Create: `tests/three-network-run.test.mjs`
- Modify: `src/utils/threeNetworkTcpTasks.ts`
- Modify: `src/components/ThreeNetworkTcpLatency.vue`

**Interfaces:**
- Consumes: `runThreeNetworkTcpTest`, `saveThreeNetworkSnapshot`, settings, UUID, signal.
- Produces: `runThreeNetworkSnapshot` and `ThreeNetworkRunUpdate`.
- Preserves: 93 targets, 12-task batches, 2-to-7 second reads, two rounds, cleanup, and `version: 1` snapshots.

- [ ] **Step 1: Write the failing coordinator tests**

```js
test('accumulates batch failures and merges previews by absolute index', async () => {
  const updates = []
  await run.runThreeNetworkSnapshot({
    uuid: 'node-1', initialValues: [null, null, null, null], currentSettings: {},
    runTasks: async ({ onBatchResult, onProgress }) => {
      onBatchResult({ start: 0, values: [10, null] }); onProgress(2, 1)
      onBatchResult({ start: 2, values: [20, null] }); onProgress(4, 1)
      return [10, null, 20, null]
    }, saveSnapshot: async () => {}, onUpdate: update => updates.push(update),
  })
  assert.equal(updates.at(-1).failures, 2)
  assert.deepEqual(updates.at(-1).previewValues, [10, null, 20, null])
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test --test-concurrency=1 tests/three-network-run.test.mjs`

Expected: FAIL because no coordinator exists.

- [ ] **Step 3: Implement the coordinator**

```ts
export interface ThreeNetworkRunUpdate { completed: number; failures: number; previewValues: readonly (number | null)[] }
export async function runThreeNetworkSnapshot(options: ThreeNetworkRunOptions): Promise<ThreeNetworkSnapshot> {
  const previewValues = [...options.initialValues]
  let completed = 0
  let failures = 0
  const values = await options.runTasks({
    onBatchResult: ({ start, values }) => {
      previewValues.splice(start, values.length, ...values)
      options.onUpdate({ completed, failures, previewValues: [...previewValues] })
    },
    onProgress: (nextCompleted, failureDelta) => {
      completed = nextCompleted
      failures += failureDelta
      options.onUpdate({ completed, failures, previewValues: [...previewValues] })
    },
  })
  const snapshot = { testedAt: options.now().toISOString(), values }
  await options.saveSnapshot(snapshot)
  return snapshot
}
```

Change the task runner's progress callback to report a per-batch `failureDelta`, then make the coordinator own cumulative display state and snapshot persistence. Leave the Vue component with command wiring, messages, and rendering only.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test --test-concurrency=1 tests/three-network-run.test.mjs tests/three-network-tcp-tasks.test.mjs tests/three-network-settings.test.mjs tests/three-network-snapshot.test.mjs tests/three-network-component-contract.test.mjs`

Expected: PASS.

```bash
git add src/utils/threeNetworkRun.ts tests/three-network-run.test.mjs src/utils/threeNetworkTcpTasks.ts src/components/ThreeNetworkTcpLatency.vue
git commit -m "refactor: isolate three-network run coordination"
```

## Task 5: Verify ZIP Contents and Fix CI Artifacts

**Files:**
- Create: `scripts/verify-release.mjs`
- Create: `tests/release-verifier-contract.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/build-ci.yml`
- Modify: `.github/AGENTS.md`
- Modify: `tests/theme-contract.test.mjs`

**Interfaces:**
- Consumes: ZIP files generated in `release/`.
- Produces: `pnpm verify:release`, which exits nonzero for missing required entries or bundled model assets.
- Preserves: existing ZIP names and Vite packaging.

- [ ] **Step 1: Write the failing contract test**

```js
assert.match(pkg, /"verify:release": "node scripts\/verify-release\.mjs"/)
assert.match(pkg, /&& pnpm verify:release/)
assert.match(ci, /release\/komari-theme-naive-extended-build-\*\.zip/)
assert.match(ci, /release\/komari-live2d-model-pack-template\.zip/)
assert.match(verifier, /dist\/maps\/china-with-hk-macau-taiwan\.geo\.json/)
```

- [ ] **Step 2: Verify RED**

Run: `node --test --test-concurrency=1 tests/release-verifier-contract.test.mjs`

Expected: FAIL because the verifier and CI paths do not exist.

- [ ] **Step 3: Implement `scripts/verify-release.mjs`**

```js
const entries = execFileSync('tar', ['-tf', zipPath], { encoding: 'utf8' }).split(/\r?\n/)
const requiredThemeEntries = ['komari-theme.json', 'preview.png', 'dist/index.html', 'dist/maps/china-with-hk-macau-taiwan.geo.json']
const forbiddenModelAsset = /\.(?:moc3|model3\.json|motion3\.json|exp3\.json|wav|mp3|ogg)$/i
```

Select the latest main ZIP by modification time, require the fixed template ZIP, verify required entries/prefixes, and reject model-template assets matching the forbidden pattern. Add `verify:release` and make `build` run it after type check and Vite finish.

- [ ] **Step 4: Repair CI and its guide**

Upload exact files from `release/`, retain `main` triggers plus unit tests and build, and correct `.github/AGENTS.md` to the real branch and artifact contract.

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test --test-concurrency=1 tests/release-verifier-contract.test.mjs tests/theme-contract.test.mjs`

Expected: PASS.

Run: `pnpm build`

Expected: both archives are generated and verified under `release/`.

```bash
git add scripts/verify-release.mjs tests/release-verifier-contract.test.mjs package.json .github/workflows/build-ci.yml .github/AGENTS.md tests/theme-contract.test.mjs
git commit -m "build: verify release archives in CI"
```

## Task 6: Rewrite README and Complete Acceptance

**Files:**
- Modify: `README.md`
- Modify: `tests/theme-contract.test.mjs`
- Modify: `tests/three-network-release-contract.test.mjs`
- Modify: `tests/live2d-release-contract.test.mjs`

**Interfaces:**
- Consumes: verified release contract and the current runtime behavior.
- Produces: an emoji-structured Chinese release guide with no obsolete route claims.

- [ ] **Step 1: Add failing documentation assertions**

```js
assert.match(readme, /Komari 1\.2\.6/)
assert.match(readme, /\/themes\/komari-live2d-models\/dist\/model\/model\.model3\.json/)
assert.doesNotMatch(readme, /\/theme\/komari-live2d-models/)
assert.match(readme, /第一个.*附件/s)
assert.match(readme, /release\//)
```

- [ ] **Step 2: Verify RED**

Run: `node --test --test-concurrency=1 tests/theme-contract.test.mjs tests/three-network-release-contract.test.mjs tests/live2d-release-contract.test.mjs`

Expected: FAIL because README still describes the removed path and does not define attachment ordering.

- [ ] **Step 3: Replace README**

Use concise emoji headings for overview, features, requirements, package selection, installation, Live2D, calculator, TCP map, privacy, development, release, and license. State `Komari 1.2.6+`, only the plural route, main ZIP first in a GitHub Release, and the existing task/API/privacy limits.

- [ ] **Step 4: Run final evidence commands**

Run: `pnpm test:unit`

Expected: all tests pass.

Run: `pnpm type-check`

Expected: `vue-tsc --build` exits zero.

Run: `pnpm lint`

Expected: Oxlint and ESLint exit zero.

Run: `pnpm build && pnpm verify:release`

Expected: production build and archive inspection both succeed.

- [ ] **Step 5: Browser acceptance and commit**

Run: `pnpm preview -- --host 127.0.0.1`

At desktop and 390px widths, inspect home, instance detail, three-network empty/snapshot views, and Live2D-disabled state. Confirm no overflow, missing assets, or console errors.

```bash
git add README.md tests/theme-contract.test.mjs tests/three-network-release-contract.test.mjs tests/live2d-release-contract.test.mjs
git commit -m "docs: clarify release installation and compatibility"
```
