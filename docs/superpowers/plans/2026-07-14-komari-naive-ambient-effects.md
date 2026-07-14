# Komari Naive Extended Ambient Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the approved Komari Naive baseline, rebrand it as Komari Naive Extended 1.0.0, and add low-overhead sakura and cursor-starlight Canvas effects across all public monitor routes.

**Architecture:** Mount one Vue `AmbientEffects` component in the global app shell. It owns lifecycle and media-query integration while a dependency-free `src/utils/ambientEffects.ts` controller owns both Canvas layers, fixed-capacity particle pools, sizing, frame limiting, rendering, and diagnostics.

**Tech Stack:** Vue 3 Composition API, TypeScript 5.9, Vite 7, Pinia 3, Naive UI, Canvas 2D, Node's built-in test runner, Vite SSR module loading, pnpm 10.

## Global Constraints

- Freeze the upstream baseline at `lyimoexiao/komari-theme-naive` commit `57e9f66fbd90ab495864e38b9c25cb032f314443` and retain its history.
- Theme identity is exactly `Komari Naive Extended`, short identifier `NaiveExtended`, version `1.0.0`, and author metadata `lyimoexiao & oKafuChino`.
- Runtime adds no third-party animation dependency, API call, WebSocket, polling loop, server timer, or remote effect asset.
- Effects cover `/` and `/instance/:id`; they do not alter `/admin` or `/terminal`.
- Desktop uses a maximum of 60 FPS and does not downgrade from hardware heuristics.
- Touch devices use reduced-density sakura at a maximum of 30 FPS and never register the cursor trail.
- `prefers-reduced-motion: reduce` creates no active effect Canvas or scheduler.
- Each Canvas uses effective DPR `<= 1.5` and a backing store `<= 2,100,000` pixels.
- Desktop sakura count stays within 18-32, touch sakura within 8-14, and active stars never exceed 72.
- Both effects have independent Boolean settings, defaulting to `true`.
- The production gzip increase for JavaScript and CSS must be `<= 12 KiB` from the rebranded pre-feature baseline.
- The Komari package retains `dist/`, `komari-theme.json`, and `preview.png` and is named `komari-theme-naive-extended-build-<sha>.zip`.

---

## File Map

- `.gitattributes`: adopt the upstream LF policy during the history merge.
- `.gitignore`: ignore `.superpowers/` and the renamed release ZIP.
- `.github/workflows/build-ci.yml`: run unit tests and upload the renamed release artifact from `main`.
- `AGENTS.md`: keep repository commands, CI facts, and artifact names accurate after the fork changes.
- `README.md`: identify the Extended theme and retain explicit upstream attribution.
- `package.json`: set package identity and expose `pnpm test:unit`.
- `komari-theme.json`: set Komari identity and declare the two managed effect switches.
- `vite.config.ts`: emit the renamed ZIP.
- `scripts/measure-build-size.mjs`: record and compare aggregate gzip size without adding a dependency.
- `tests/theme-contract.test.mjs`: lock theme identity, packaging, CI, and ignore rules.
- `tests/ambient-settings.test.mjs`: lock Boolean fallback behavior and manifest defaults.
- `tests/ambient-effects-core.test.mjs`: lock profiles, particle counts, and Canvas sizing.
- `tests/helpers/fake-canvas.mjs`: provide deterministic Canvas and animation-frame fakes.
- `tests/ambient-effects-controller.test.mjs`: lock scheduler, pooling, visibility, and failure behavior.
- `tests/ambient-component-contract.test.mjs`: lock app-shell mounting, stacking hooks, and accessibility attributes.
- `tests/fixtures/mock-komari-server.mjs`: provide deterministic REST and RPC data for browser verification.
- `src/stores/app.ts`: normalize and expose `sakuraEnabled` and `cursorTrailEnabled`.
- `src/utils/ambientEffects.ts`: own profiles, metrics, particles, renderer, controller, and diagnostics.
- `src/components/AmbientEffects.vue`: own Vue lifecycle, media queries, pointer sampling, and Canvas elements.
- `src/App.vue`: mount the effect once and establish the content stacking layer.
- `src/types/global.d.ts`: type the development-only diagnostics hook.
- `docs/preview.png`: capture the verified Extended appearance for the release package.

### Task 1: Import The Frozen Upstream Baseline

**Files:**
- Commit: `docs/superpowers/plans/2026-07-14-komari-naive-ambient-effects.md`
- Merge: every file reachable from upstream commit `57e9f66fbd90ab495864e38b9c25cb032f314443`
- Resolve: `.gitattributes`

**Interfaces:**
- Consumes: the current `main` branch containing commit `280e1c5` and the approved design document.
- Produces: the complete upstream Vue application with upstream history present in the current branch ancestry.

- [ ] **Step 1: Commit this approved implementation plan**

Run:

```powershell
git add -- docs/superpowers/plans/2026-07-14-komari-naive-ambient-effects.md
git commit -m "docs: add ambient effects implementation plan"
```

Expected: only the plan is committed; `.superpowers/` remains untracked.

- [ ] **Step 2: Verify the starting repository state**

Run:

```powershell
git status --short --branch
git log -2 --oneline
git remote -v
```

Expected: `main` contains `280e1c5 docs: add ambient effects design`; `.superpowers/` may be untracked; no application source exists yet.

- [ ] **Step 3: Add and fetch the frozen upstream history**

Run:

```powershell
git remote add upstream https://github.com/lyimoexiao/komari-theme-naive.git
git fetch upstream master
git cat-file -e 57e9f66fbd90ab495864e38b9c25cb032f314443^{commit}
```

Expected: `git cat-file` exits `0`. If `upstream` already exists, first verify `git remote get-url upstream` returns the exact URL and skip only the `remote add` command.

- [ ] **Step 4: Start the unrelated-history merge**

Run:

```powershell
git merge --allow-unrelated-histories --no-commit 57e9f66fbd90ab495864e38b9c25cb032f314443
git status --short
```

Expected: upstream files are staged and `.gitattributes` is the only expected add/add conflict.

- [ ] **Step 5: Resolve `.gitattributes` to the upstream LF contract**

Replace the complete file with:

```gitattributes
* text=auto eol=lf
```

Run:

```powershell
git add -- .gitattributes
git diff --cached --check
git status --short
```

Expected: no unmerged paths and no whitespace errors. `.superpowers/` remains untracked.

- [ ] **Step 6: Commit the upstream merge**

Run:

```powershell
git commit -m "chore: import Komari Naive upstream"
git merge-base --is-ancestor 57e9f66fbd90ab495864e38b9c25cb032f314443 HEAD
git status --short --branch
```

Expected: the merge commit succeeds, the ancestry check exits `0`, and only `.superpowers/` remains untracked.

### Task 2: Rebrand The Theme And Establish Contract Tests

**Files:**
- Create: `tests/theme-contract.test.mjs`
- Create: `scripts/measure-build-size.mjs`
- Modify: `.gitignore`
- Modify: `.github/workflows/build-ci.yml`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `komari-theme.json`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: the imported upstream build and packaging flow.
- Produces: `pnpm test:unit`, Extended theme metadata, the renamed ZIP contract, and `.superpowers/perf/baseline.json` for Task 7.

- [ ] **Step 1: Write the failing theme contract test**

Create `tests/theme-contract.test.mjs`:

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

async function readText(path) {
  return readFile(new URL(path, root), 'utf8')
}

async function readJson(path) {
  return JSON.parse(await readText(path))
}

test('uses the independent Extended identity', async () => {
  const pkg = await readJson('package.json')
  const manifest = await readJson('komari-theme.json')

  assert.equal(pkg.name, 'komari-theme-naive-extended')
  assert.equal(pkg.version, '1.0.0')
  assert.equal(pkg.author, 'lyimoexiao & oKafuChino')
  assert.equal(pkg.homepage, 'https://github.com/oKafuChino/komari-theme-navie-extended')
  assert.equal(manifest.name, 'Komari Naive Extended')
  assert.equal(manifest.short, 'NaiveExtended')
  assert.equal(manifest.version, '1.0.0')
  assert.equal(manifest.author, 'lyimoexiao & oKafuChino')
  assert.equal(manifest.url, 'https://github.com/oKafuChino/komari-theme-navie-extended')
})

test('uses the Extended release artifact everywhere', async () => {
  const vite = await readText('vite.config.ts')
  const workflow = await readText('.github/workflows/build-ci.yml')
  const ignore = await readText('.gitignore')
  const readme = await readText('README.md')

  assert.match(vite, /komari-theme-naive-extended-build-\$\{commitHash\}\.zip/)
  assert.match(workflow, /komari-theme-naive-extended-build\*\.zip/)
  assert.match(ignore, /^\.superpowers\/$/m)
  assert.match(ignore, /^komari-theme-naive-extended-build-\*\.zip$/m)
  assert.match(readme, /Komari Naive Extended/)
  assert.match(readme, /lyimoexiao\/komari-theme-naive/)
})
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run:

```powershell
node --test tests/theme-contract.test.mjs
```

Expected: FAIL because the imported source still identifies itself as `komari-theme-naive` and `Naive`.

- [ ] **Step 3: Apply the exact package and manifest identity**

Replace `package.json` with this complete content:

```json
{
  "name": "komari-theme-naive-extended",
  "type": "module",
  "version": "1.0.0",
  "author": "lyimoexiao & oKafuChino",
  "homepage": "https://github.com/oKafuChino/komari-theme-navie-extended",
  "license": "MIT",
  "engines": {
    "node": "^20.19.0 || >=22.12.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "run-p type-check \"build-only {@}\" --",
    "preview": "vite preview",
    "build-only": "vite build",
    "type-check": "vue-tsc --build",
    "test:unit": "node --test --test-concurrency=1 tests/*.test.mjs",
    "lint": "run-s lint:oxlint lint:eslint",
    "lint:oxlint": "oxlint . --fix",
    "lint:eslint": "eslint . --fix --cache"
  },
  "dependencies": {
    "dayjs": "catalog:",
    "echarts": "catalog:",
    "pinia": "catalog:",
    "vue": "catalog:",
    "vue-router": "catalog:"
  },
  "devDependencies": {
    "@antfu/eslint-config": "catalog:",
    "@iconify/json": "catalog:",
    "@tsconfig/node24": "catalog:",
    "@types/js-cookie": "catalog:",
    "@types/node": "catalog:",
    "@unocss/eslint-config": "catalog:",
    "@unocss/eslint-plugin": "catalog:",
    "@unocss/preset-icons": "catalog:",
    "@unocss/preset-web-fonts": "catalog:",
    "@unocss/preset-wind4": "catalog:",
    "@unocss/transformer-directives": "catalog:",
    "@unocss/transformer-variant-group": "catalog:",
    "@vitejs/plugin-vue": "catalog:",
    "@vue/eslint-config-typescript": "catalog:",
    "@vue/tsconfig": "catalog:",
    "@vueuse/core": "catalog:",
    "archiver": "catalog:",
    "eslint": "catalog:",
    "eslint-plugin-format": "catalog:",
    "eslint-plugin-oxlint": "catalog:",
    "eslint-plugin-vue": "catalog:",
    "jiti": "catalog:",
    "js-cookie": "catalog:",
    "naive-ui": "catalog:",
    "npm-run-all2": "catalog:",
    "oxlint": "catalog:",
    "sass": "catalog:",
    "sass-embedded": "catalog:",
    "typescript": "catalog:",
    "unocss": "catalog:",
    "unplugin-auto-import": "catalog:",
    "unplugin-vue-components": "catalog:",
    "vite": "catalog:",
    "vite-plugin-static-copy": "catalog:",
    "vite-plugin-vue-devtools": "catalog:",
    "vue-echarts": "catalog:",
    "vue-tsc": "catalog:"
  }
}
```

In `komari-theme.json`, set the top-level identity fields exactly:

```json
{
  "name": "Komari Naive Extended",
  "short": "NaiveExtended",
  "description": "Komari Naive with lightweight ambient sakura and starlight effects",
  "version": "1.0.0",
  "author": "lyimoexiao & oKafuChino",
  "url": "https://github.com/oKafuChino/komari-theme-navie-extended",
  "preview": "preview.png"
}
```

Retain the imported `configuration` object after `preview`.

- [ ] **Step 4: Rename every build and CI reference**

In `vite.config.ts`, set:

```ts
const zipFileName = `komari-theme-naive-extended-build-${commitHash}.zip`
```

In `.github/workflows/build-ci.yml`, use `main`, run tests before the build, and upload the renamed artifact:

```yaml
name: Build CI

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v6

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 10

      - name: Set up Node.js
        uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test:unit

      - name: Build project
        run: pnpm build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v7
        with:
          archive: false
          path: komari-theme-naive-extended-build*.zip
```

- [ ] **Step 5: Update ignore and human-facing repository guidance**

Replace the old theme-output ignore with:

```gitignore
# Theme build output
komari-theme-naive-extended-build-*.zip

# Local brainstorming and performance baselines
.superpowers/
```

Replace the README heading and introduction with:

```html
<h3 align="center"> Komari Naive Extended </h3>
<p align="center">基于 Vue 3 + Vite + Naive UI 构建的 Komari Monitor 扩展主题</p>
<a href="https://github.com/oKafuChino/komari-theme-navie-extended">
<img src="docs/preview.png" alt="Komari Naive Extended" />
</a>
```

Add this attribution immediately below it:

```markdown
本项目基于 [lyimoexiao/komari-theme-naive](https://github.com/lyimoexiao/komari-theme-naive) 开发，并保留原项目的 MIT 许可证与作者署名。
```

Replace both README release filename examples with `komari-theme-naive-extended-build-*.zip`.

Add `pnpm test:unit` to the `AGENTS.md` root command block:

```bash
pnpm dev
pnpm test:unit
pnpm build
pnpm preview
pnpm lint
```

Set the `AGENTS.md` repository name to `komari-theme-naive-extended`, its branch snapshot to `main`, and its app description to `Komari Naive Extended, a Vue 3 + Vite + Naive UI theme for Komari Monitor`.

Replace every artifact example in `AGENTS.md` with `komari-theme-naive-extended-build-<sha>.zip`, and replace its CI sequence with:

```markdown
CI runs:

1. `pnpm install`
2. `pnpm test:unit`
3. `pnpm build`
```

- [ ] **Step 6: Add a dependency-free bundle measurement script**

Create `scripts/measure-build-size.mjs`:

```js
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

async function collectFiles(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      result.push(...await collectFiles(path))
    }
    else if (['.js', '.css'].includes(extname(entry.name))) {
      result.push(path)
    }
  }
  return result.sort()
}

function argument(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

const dist = resolve('dist')
const files = await collectFiles(dist)
const gzipBytes = (await Promise.all(files.map(async path => gzipSync(await readFile(path)).byteLength)))
  .reduce((sum, size) => sum + size, 0)
const result = { gzipBytes, files: files.map(path => path.replace(`${dist}\\`, '').replace(`${dist}/`, '')) }
const writePath = argument('--write')
const comparePath = argument('--compare')

if (writePath) {
  await mkdir(dirname(resolve(writePath)), { recursive: true })
  await writeFile(resolve(writePath), `${JSON.stringify(result, null, 2)}\n`)
}

if (comparePath) {
  const baseline = JSON.parse(await readFile(resolve(comparePath), 'utf8'))
  const maxIncrease = Number(argument('--max-increase'))
  const increase = gzipBytes - baseline.gzipBytes
  console.log(JSON.stringify({ baseline: baseline.gzipBytes, current: gzipBytes, increase, maxIncrease }))
  if (!Number.isFinite(maxIncrease) || increase > maxIncrease)
    process.exitCode = 1
}
else {
  console.log(JSON.stringify(result))
}
```

- [ ] **Step 7: Install, pass the contract test, build, and record the baseline**

Run:

```powershell
pnpm install --frozen-lockfile
pnpm test:unit
pnpm lint
pnpm build
node scripts/measure-build-size.mjs --write .superpowers/perf/baseline.json
```

Expected: unit tests pass, the Extended ZIP is created, and `.superpowers/perf/baseline.json` contains a positive `gzipBytes` value.

- [ ] **Step 8: Commit the rebrand and test harness**

Run:

```powershell
git add -- .gitignore .github/workflows/build-ci.yml AGENTS.md README.md package.json komari-theme.json vite.config.ts scripts/measure-build-size.mjs tests/theme-contract.test.mjs
git commit -m "chore: rebrand theme as Naive Extended"
```

Expected: commit succeeds and `.superpowers/` is absent from `git status --short` because it is ignored.

### Task 3: Add The Two Managed Effect Settings

**Files:**
- Create: `tests/ambient-settings.test.mjs`
- Modify: `src/stores/app.ts`
- Modify: `komari-theme.json`

**Interfaces:**
- Consumes: `PublicSettings.theme_settings` as `Record<string, unknown> | null | undefined`.
- Produces: `resolveBooleanThemeSetting(settings, key, fallback): boolean`, `appStore.sakuraEnabled`, and `appStore.cursorTrailEnabled`.

- [ ] **Step 1: Write the failing settings test**

Create `tests/ambient-settings.test.mjs`:

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let vite

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
})

after(async () => {
  await vite.close()
})

test('normalizes Boolean theme settings defensively', async () => {
  const { resolveBooleanThemeSetting } = await vite.ssrLoadModule('/src/stores/app.ts')

  assert.equal(resolveBooleanThemeSetting({ enabled: true }, 'enabled', false), true)
  assert.equal(resolveBooleanThemeSetting({ enabled: false }, 'enabled', true), false)
  assert.equal(resolveBooleanThemeSetting({ enabled: 'true' }, 'enabled', false), false)
  assert.equal(resolveBooleanThemeSetting(null, 'enabled', true), true)
})

test('declares both managed switches with enabled defaults', async () => {
  const manifest = JSON.parse(await readFile(new URL('../komari-theme.json', import.meta.url), 'utf8'))
  const items = manifest.configuration.data
  const sakura = items.find(item => item.key === 'sakuraEnabled')
  const trail = items.find(item => item.key === 'cursorTrailEnabled')

  assert.deepEqual(sakura, {
    key: 'sakuraEnabled',
    name: '启用樱花飘落',
    type: 'switch',
    default: true,
    help: '在公共监控页面背景显示低负载樱花飘落效果',
  })
  assert.deepEqual(trail, {
    key: 'cursorTrailEnabled',
    name: '启用鼠标星轨',
    type: 'switch',
    default: true,
    help: '在支持鼠标悬停的设备上显示星光下落轨迹',
  })
})
```

- [ ] **Step 2: Run the settings test and verify it fails**

Run:

```powershell
node --test tests/ambient-settings.test.mjs
```

Expected: FAIL because the helper export and manifest switches do not exist.

- [ ] **Step 3: Add the pure Boolean normalizer and computed settings**

Add above `useAppStore` in `src/stores/app.ts`:

```ts
export function resolveBooleanThemeSetting(
  settings: Record<string, unknown> | null | undefined,
  key: string,
  fallback: boolean,
): boolean {
  const value = settings?.[key]
  return typeof value === 'boolean' ? value : fallback
}
```

Inside the store, add:

```ts
const sakuraEnabled = computed<boolean>(() => {
  return resolveBooleanThemeSetting(publicSettings.value?.theme_settings, 'sakuraEnabled', true)
})

const cursorTrailEnabled = computed<boolean>(() => {
  return resolveBooleanThemeSetting(publicSettings.value?.theme_settings, 'cursorTrailEnabled', true)
})
```

Add both computed values to the store return object:

```ts
sakuraEnabled,
cursorTrailEnabled,
```

- [ ] **Step 4: Add the managed manifest section**

Insert before the existing `自定义背景` title in `komari-theme.json`:

```json
{ "name": "页面特效", "type": "title" },
{ "key": "sakuraEnabled", "name": "启用樱花飘落", "type": "switch", "default": true, "help": "在公共监控页面背景显示低负载樱花飘落效果" },
{ "key": "cursorTrailEnabled", "name": "启用鼠标星轨", "type": "switch", "default": true, "help": "在支持鼠标悬停的设备上显示星光下落轨迹" },
```

- [ ] **Step 5: Run focused and repository verification**

Run:

```powershell
pnpm test:unit
pnpm lint
pnpm type-check
```

Expected: all tests pass and `vue-tsc` exits `0`.

- [ ] **Step 6: Commit the settings contract**

Run:

```powershell
git add -- src/stores/app.ts komari-theme.json tests/ambient-settings.test.mjs
git commit -m "feat: add ambient effect settings"
```

### Task 4: Implement Profiles, Counts, And Canvas Metrics

**Files:**
- Create: `src/utils/ambientEffects.ts`
- Create: `tests/ambient-effects-core.test.mjs`

**Interfaces:**
- Produces: `resolveAmbientProfile`, `computeCanvasMetrics`, `computePetalCount`, constants, and their exported TypeScript types.
- Consumed by: Tasks 5 and 6.

- [ ] **Step 1: Write the failing core test**

Create `tests/ambient-effects-core.test.mjs`:

```js
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let vite
let effects

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  effects = await vite.ssrLoadModule('/src/utils/ambientEffects.ts')
})

after(async () => {
  await vite.close()
})

test('selects desktop, touch, and reduced-motion profiles', () => {
  assert.deepEqual(effects.resolveAmbientProfile({ finePointer: true, reducedMotion: false }).name, 'desktop')
  assert.equal(effects.resolveAmbientProfile({ finePointer: true, reducedMotion: false }).fps, 60)
  assert.equal(effects.resolveAmbientProfile({ finePointer: false, reducedMotion: false }).fps, 30)
  assert.equal(effects.resolveAmbientProfile({ finePointer: false, reducedMotion: false }).cursorTrail, false)
  assert.equal(effects.resolveAmbientProfile({ finePointer: true, reducedMotion: true }), null)
})

test('caps DPR and total backing pixels', () => {
  const normal = effects.computeCanvasMetrics(1440, 900, 2)
  const fourK = effects.computeCanvasMetrics(3840, 2160, 2)

  assert.ok(normal.scale <= effects.MAX_CANVAS_DPR)
  assert.ok(normal.pixelWidth * normal.pixelHeight <= effects.MAX_CANVAS_PIXELS)
  assert.ok(fourK.scale < 1)
  assert.ok(fourK.pixelWidth * fourK.pixelHeight <= effects.MAX_CANVAS_PIXELS)
  assert.deepEqual(effects.computeCanvasMetrics(0, 900, 2), {
    cssWidth: 0,
    cssHeight: 900,
    pixelWidth: 0,
    pixelHeight: 0,
    scale: 0,
  })
})

test('keeps petal counts inside the approved ranges', () => {
  const desktop = effects.resolveAmbientProfile({ finePointer: true, reducedMotion: false })
  const touch = effects.resolveAmbientProfile({ finePointer: false, reducedMotion: false })

  assert.equal(effects.computePetalCount(1440, 900, desktop), 24)
  assert.equal(effects.computePetalCount(10000, 6000, desktop), 32)
  assert.equal(effects.computePetalCount(390, 844, touch), 10)
  assert.equal(effects.computePetalCount(100, 100, touch), 8)
})
```

- [ ] **Step 2: Run the core test and verify it fails**

Run:

```powershell
node --test tests/ambient-effects-core.test.mjs
```

Expected: FAIL because `src/utils/ambientEffects.ts` does not exist.

- [ ] **Step 3: Implement the complete pure core**

Create `src/utils/ambientEffects.ts` with this initial content:

```ts
export const MAX_CANVAS_DPR = 1.5
export const MAX_CANVAS_PIXELS = 2_100_000
export const MAX_STARS = 72
export const MAX_PETALS = 32

export type AmbientProfileName = 'desktop' | 'touch'

export interface AmbientRuntimeProfile {
  readonly name: AmbientProfileName
  readonly fps: 60 | 30
  readonly petalMin: number
  readonly petalMax: number
  readonly petalBase: number
  readonly referenceArea: number
  readonly cursorTrail: boolean
}

export interface AmbientProfileInput {
  finePointer: boolean
  reducedMotion: boolean
}

export interface CanvasMetrics {
  cssWidth: number
  cssHeight: number
  pixelWidth: number
  pixelHeight: number
  scale: number
}

const DESKTOP_PROFILE: AmbientRuntimeProfile = Object.freeze({
  name: 'desktop',
  fps: 60,
  petalMin: 18,
  petalMax: 32,
  petalBase: 24,
  referenceArea: 1440 * 900,
  cursorTrail: true,
})

const TOUCH_PROFILE: AmbientRuntimeProfile = Object.freeze({
  name: 'touch',
  fps: 30,
  petalMin: 8,
  petalMax: 14,
  petalBase: 10,
  referenceArea: 390 * 844,
  cursorTrail: false,
})

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function resolveAmbientProfile(input: AmbientProfileInput): AmbientRuntimeProfile | null {
  if (input.reducedMotion)
    return null
  return input.finePointer ? DESKTOP_PROFILE : TOUCH_PROFILE
}

export function computeCanvasMetrics(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): CanvasMetrics {
  if (cssWidth <= 0 || cssHeight <= 0) {
    return {
      cssWidth: Math.max(0, cssWidth),
      cssHeight: Math.max(0, cssHeight),
      pixelWidth: 0,
      pixelHeight: 0,
      scale: 0,
    }
  }

  const safeDpr = Math.max(0.1, devicePixelRatio || 1)
  const pixelBudgetScale = Math.sqrt(MAX_CANVAS_PIXELS / (cssWidth * cssHeight))
  const scale = Math.min(MAX_CANVAS_DPR, safeDpr, pixelBudgetScale)

  return {
    cssWidth,
    cssHeight,
    pixelWidth: Math.max(1, Math.floor(cssWidth * scale)),
    pixelHeight: Math.max(1, Math.floor(cssHeight * scale)),
    scale,
  }
}

export function computePetalCount(
  width: number,
  height: number,
  profile: AmbientRuntimeProfile,
): number {
  const area = Math.max(1, width * height)
  const scaled = Math.round(profile.petalBase * Math.sqrt(area / profile.referenceArea))
  return clamp(scaled, profile.petalMin, profile.petalMax)
}
```

- [ ] **Step 4: Run tests and type checking**

Run:

```powershell
pnpm test:unit
pnpm lint
pnpm type-check
```

Expected: all tests pass.

- [ ] **Step 5: Commit the deterministic core**

Run:

```powershell
git add -- src/utils/ambientEffects.ts tests/ambient-effects-core.test.mjs
git commit -m "feat: add ambient effect runtime profiles"
```

### Task 5: Implement The Canvas Controller And Particle Pools

**Files:**
- Create: `tests/helpers/fake-canvas.mjs`
- Create: `tests/ambient-effects-controller.test.mjs`
- Modify: `src/utils/ambientEffects.ts`

**Interfaces:**
- Consumes: `AmbientRuntimeProfile`, metrics, counts, and limits from Task 4.
- Produces: `createAmbientEffectsController(input): AmbientEffectsController` and `AmbientEffectsDiagnostics` for Task 6 and browser verification.

- [ ] **Step 1: Add deterministic Canvas and frame fakes**

Create `tests/helpers/fake-canvas.mjs`:

```js
export function createFakeCanvas({ contextAvailable = true, throwOnFill = false } = {}) {
  const calls = { clearRect: 0, fill: 0, remove: 0, setTransform: 0 }
  const context = {
    beginPath() {},
    bezierCurveTo() {},
    clearRect() { calls.clearRect++ },
    closePath() {},
    fill() {
      calls.fill++
      if (throwOnFill)
        throw new Error('draw failed')
    },
    lineTo() {},
    moveTo() {},
    restore() {},
    rotate() {},
    save() {},
    scale() {},
    setTransform() { calls.setTransform++ },
    translate() {},
    fillStyle: '',
    globalAlpha: 1,
    shadowBlur: 0,
    shadowColor: '',
  }
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext: () => contextAvailable ? context : null,
    remove() { calls.remove++ },
  }
  return { calls, canvas, context }
}

export function createFrameHarness() {
  let callback = null
  let nextId = 1
  return {
    requestFrame(value) {
      callback = value
      return nextId++
    },
    cancelFrame() {
      callback = null
    },
    hasPending() {
      return callback !== null
    },
    step(time) {
      const current = callback
      callback = null
      if (!current)
        throw new Error('No animation frame is pending')
      current(time)
    },
  }
}
```

- [ ] **Step 2: Write the failing controller tests**

Create `tests/ambient-effects-controller.test.mjs`:

```js
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { createFakeCanvas, createFrameHarness } from './helpers/fake-canvas.mjs'

let vite
let effects

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  effects = await vite.ssrLoadModule('/src/utils/ambientEffects.ts')
})

after(async () => {
  await vite.close()
})

function desktopOptions() {
  return {
    profile: effects.resolveAmbientProfile({ finePointer: true, reducedMotion: false }),
    dark: false,
    sakuraEnabled: true,
    cursorTrailEnabled: true,
  }
}

test('runs both layers through one frame scheduler', () => {
  const petals = createFakeCanvas()
  const trail = createFakeCanvas()
  const frames = createFrameHarness()
  const controller = effects.createAmbientEffectsController({
    petalCanvas: petals.canvas,
    trailCanvas: trail.canvas,
    options: desktopOptions(),
    dependencies: {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      now: () => 0,
      random: () => 0.5,
    },
  })

  controller.resize(1440, 900, 2)
  controller.start()
  assert.equal(frames.hasPending(), true)
  frames.step(0)
  assert.equal(controller.getDiagnostics().frameCount, 1)
  assert.equal(frames.hasPending(), true)
  assert.ok(petals.calls.fill > 0)
  controller.destroy()
  assert.equal(frames.hasPending(), false)
})

test('caps stars and pauses while hidden', () => {
  const petals = createFakeCanvas()
  const trail = createFakeCanvas()
  const frames = createFrameHarness()
  const controller = effects.createAmbientEffectsController({
    petalCanvas: petals.canvas,
    trailCanvas: trail.canvas,
    options: desktopOptions(),
    dependencies: {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      now: () => 0,
      random: () => 0.5,
    },
  })

  controller.resize(1440, 900, 1)
  controller.start()
  frames.step(0)
  for (let index = 1; index <= 120; index++) {
    controller.setPointer(index * 42, 200)
    frames.step(index * 17)
  }
  assert.equal(controller.getDiagnostics().starCount, effects.MAX_STARS)
  controller.setVisible(false)
  assert.equal(frames.hasPending(), false)
  controller.setVisible(true)
  assert.equal(frames.hasPending(), true)
})

test('never emits a cursor trail for the touch profile', () => {
  const trail = createFakeCanvas()
  const frames = createFrameHarness()
  const controller = effects.createAmbientEffectsController({
    trailCanvas: trail.canvas,
    options: {
      profile: effects.resolveAmbientProfile({ finePointer: false, reducedMotion: false }),
      dark: false,
      sakuraEnabled: false,
      cursorTrailEnabled: true,
    },
    dependencies: {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      now: () => 0,
      random: () => 0.5,
    },
  })

  controller.resize(390, 844, 3)
  controller.start()
  assert.equal(frames.hasPending(), false)
  controller.setPointer(100, 100)
  assert.equal(controller.getDiagnostics().starCount, 0)
})

test('removes a failed layer and warns once', () => {
  const petals = createFakeCanvas({ throwOnFill: true })
  const frames = createFrameHarness()
  const warnings = []
  const controller = effects.createAmbientEffectsController({
    petalCanvas: petals.canvas,
    options: { ...desktopOptions(), cursorTrailEnabled: false },
    dependencies: {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      now: () => 0,
      random: () => 0.5,
      warn: message => warnings.push(message),
    },
  })

  controller.resize(1440, 900, 1)
  controller.start()
  frames.step(0)
  assert.equal(petals.calls.remove, 1)
  assert.equal(warnings.length, 1)
  assert.equal(controller.getDiagnostics().running, false)
})

test('skips an unavailable Canvas context without scheduling', () => {
  const petals = createFakeCanvas({ contextAvailable: false })
  const frames = createFrameHarness()
  const warnings = []
  const controller = effects.createAmbientEffectsController({
    petalCanvas: petals.canvas,
    options: { ...desktopOptions(), cursorTrailEnabled: false },
    dependencies: {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      warn: message => warnings.push(message),
    },
  })

  controller.resize(1440, 900, 1)
  controller.start()
  assert.equal(frames.hasPending(), false)
  assert.equal(petals.calls.remove, 1)
  assert.equal(warnings.length, 1)
})
```

- [ ] **Step 3: Run the controller tests and verify they fail**

Run:

```powershell
node --test tests/ambient-effects-controller.test.mjs
```

Expected: FAIL because `createAmbientEffectsController` is not exported.

- [ ] **Step 4: Add the controller contract and fixed-capacity state**

Append these public types to `src/utils/ambientEffects.ts`:

```ts
export type AmbientLayer = 'sakura' | 'trail'

export interface AmbientEngineOptions {
  profile: AmbientRuntimeProfile
  dark: boolean
  sakuraEnabled: boolean
  cursorTrailEnabled: boolean
}

export interface AmbientEffectsDiagnostics {
  running: boolean
  frameCount: number
  petalCount: number
  starCount: number
  targetFps: 60 | 30
  drawP95Ms: number
}

export interface AmbientEngineDependencies {
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (handle: number) => void
  now?: () => number
  random?: () => number
  warn?: (message: string, error?: unknown) => void
  collectDiagnostics?: boolean
}

export interface AmbientEffectsController {
  start: () => void
  setVisible: (visible: boolean) => void
  setPointer: (x: number, y: number) => void
  setOptions: (options: AmbientEngineOptions) => void
  resize: (width: number, height: number, devicePixelRatio: number) => void
  getDiagnostics: () => AmbientEffectsDiagnostics
  destroy: () => void
}
```

Use fixed arrays of `MAX_PETALS` petals, `MAX_STARS` stars, and 120 diagnostic durations. The complete implementation must follow these exact rules:

```ts
interface PetalParticle {
  x: number
  y: number
  size: number
  speed: number
  sway: number
  phase: number
  rotation: number
  spin: number
  opacity: number
  color: number
}

interface StarParticle {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  size: number
  age: number
  life: number
  rotation: number
  color: number
}

const LIGHT_PETALS = ['rgba(232, 139, 164, 0.48)', 'rgba(244, 174, 190, 0.58)', 'rgba(218, 113, 145, 0.42)']
const DARK_PETALS = ['rgba(255, 166, 190, 0.62)', 'rgba(255, 194, 207, 0.68)', 'rgba(235, 132, 168, 0.56)']
const LIGHT_STARS = ['255, 248, 220', '255, 219, 151']
const DARK_STARS = ['255, 255, 238', '255, 226, 164']

function emptyPetal(): PetalParticle {
  return { x: 0, y: 0, size: 0, speed: 0, sway: 0, phase: 0, rotation: 0, spin: 0, opacity: 0, color: 0 }
}

function emptyStar(): StarParticle {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, size: 0, age: 0, life: 0, rotation: 0, color: 0 }
}
```

Append this complete controller implementation to `src/utils/ambientEffects.ts`:

```ts
export interface CreateAmbientEffectsControllerInput {
  petalCanvas?: HTMLCanvasElement | null
  trailCanvas?: HTMLCanvasElement | null
  options: AmbientEngineOptions
  dependencies?: AmbientEngineDependencies
}

export function createAmbientEffectsController(
  input: CreateAmbientEffectsControllerInput,
): AmbientEffectsController {
  let options = { ...input.options }
  const dependencies = input.dependencies ?? {}
  const requestFrame = dependencies.requestFrame ?? (callback => window.requestAnimationFrame(callback))
  const cancelFrame = dependencies.cancelFrame ?? (handle => window.cancelAnimationFrame(handle))
  const now = dependencies.now ?? (() => performance.now())
  const random = dependencies.random ?? Math.random
  const warn = dependencies.warn ?? ((message: string, error?: unknown) => console.warn(message, error))
  const collectDiagnostics = dependencies.collectDiagnostics ?? false

  let petalCanvas = input.petalCanvas ?? null
  let trailCanvas = input.trailCanvas ?? null
  let petalContext: CanvasRenderingContext2D | null = null
  let trailContext: CanvasRenderingContext2D | null = null
  let metrics: CanvasMetrics = { cssWidth: 0, cssHeight: 0, pixelWidth: 0, pixelHeight: 0, scale: 0 }
  let petalCount = 0
  let frameHandle: number | null = null
  let lastRenderedAt: number | null = null
  let running = false
  let visible = true
  let destroyed = false
  let frameCount = 0
  let pointerSeen = false
  let pointerDirty = false
  let pointerX = 0
  let pointerY = 0
  let lastEmitX = 0
  let lastEmitY = 0
  let starCursor = 0
  let durationIndex = 0
  let durationCount = 0

  const warnedLayers = new Set<AmbientLayer>()
  const petals = Array.from({ length: MAX_PETALS }, emptyPetal)
  const stars = Array.from({ length: MAX_STARS }, emptyStar)
  const drawDurations = new Float32Array(120)

  function hasSakuraLayer(): boolean {
    return Boolean(options.sakuraEnabled && petalContext)
  }

  function hasTrailLayer(): boolean {
    return Boolean(options.cursorTrailEnabled && options.profile.cursorTrail && trailContext)
  }

  function hasActiveLayer(): boolean {
    return hasSakuraLayer() || hasTrailLayer()
  }

  function cancelScheduledFrame() {
    if (frameHandle !== null) {
      cancelFrame(frameHandle)
      frameHandle = null
    }
  }

  function deactivateStars() {
    for (let index = 0; index < stars.length; index++)
      stars[index].active = false
  }

  function failLayer(layer: AmbientLayer, error: unknown) {
    if (!warnedLayers.has(layer)) {
      warnedLayers.add(layer)
      warn(`[AmbientEffects] ${layer} layer disabled`, error)
    }

    if (layer === 'sakura') {
      petalCanvas?.remove()
      petalCanvas = null
      petalContext = null
      petalCount = 0
    }
    else {
      trailCanvas?.remove()
      trailCanvas = null
      trailContext = null
      deactivateStars()
    }

    if (!hasActiveLayer()) {
      cancelScheduledFrame()
      running = false
    }
  }

  function acquireContext(layer: AmbientLayer): CanvasRenderingContext2D | null {
    const canvas = layer === 'sakura' ? petalCanvas : trailCanvas
    if (!canvas)
      return null
    const context = canvas.getContext('2d')
    if (!context)
      failLayer(layer, new Error('Canvas 2D context unavailable'))
    return context
  }

  petalContext = acquireContext('sakura')
  trailContext = acquireContext('trail')

  function resetPetal(petal: PetalParticle, initial: boolean) {
    petal.x = random() * metrics.cssWidth
    petal.y = initial ? random() * metrics.cssHeight : -(10 + random() * 40)
    petal.size = 5 + random() * 7
    petal.speed = 12 + random() * 18
    petal.sway = 8 + random() * 14
    petal.phase = random() * Math.PI * 2
    petal.rotation = random() * Math.PI * 2
    petal.spin = -1.2 + random() * 2.4
    petal.opacity = 0.42 + random() * 0.34
    petal.color = Math.floor(random() * LIGHT_PETALS.length)
  }

  function resizeLayer(canvas: HTMLCanvasElement | null, context: CanvasRenderingContext2D | null) {
    if (!canvas || !context)
      return
    canvas.width = metrics.pixelWidth
    canvas.height = metrics.pixelHeight
    canvas.style.width = `${metrics.cssWidth}px`
    canvas.style.height = `${metrics.cssHeight}px`
    if (metrics.scale > 0)
      context.setTransform(metrics.scale, 0, 0, metrics.scale, 0, 0)
  }

  function resize(width: number, height: number, devicePixelRatio: number) {
    const nextMetrics = computeCanvasMetrics(width, height, devicePixelRatio)
    if (
      nextMetrics.pixelWidth === metrics.pixelWidth
      && nextMetrics.pixelHeight === metrics.pixelHeight
      && nextMetrics.cssWidth === metrics.cssWidth
      && nextMetrics.cssHeight === metrics.cssHeight
      && nextMetrics.scale === metrics.scale
    ) {
      return
    }

    metrics = nextMetrics
    resizeLayer(petalCanvas, petalContext)
    resizeLayer(trailCanvas, trailContext)
    petalCount = metrics.scale > 0 ? computePetalCount(width, height, options.profile) : 0
    for (let index = 0; index < petalCount; index++)
      resetPetal(petals[index], true)
    deactivateStars()
    pointerSeen = false
    pointerDirty = false
  }

  function drawPetal(context: CanvasRenderingContext2D, petal: PetalParticle) {
    const palette = options.dark ? DARK_PETALS : LIGHT_PETALS
    context.save()
    context.translate(petal.x, petal.y)
    context.rotate(petal.rotation)
    context.scale(1, 0.72)
    context.globalAlpha = petal.opacity
    context.fillStyle = palette[petal.color % palette.length]
    context.beginPath()
    context.moveTo(0, 0)
    context.bezierCurveTo(petal.size * 0.8, -petal.size * 0.8, petal.size * 1.25, petal.size * 0.25, 0, petal.size * 1.45)
    context.bezierCurveTo(-petal.size * 1.25, petal.size * 0.25, -petal.size * 0.8, -petal.size * 0.8, 0, 0)
    context.fill()
    context.restore()
  }

  function renderPetals(deltaSeconds: number) {
    if (!petalContext)
      return
    petalContext.clearRect(0, 0, metrics.cssWidth, metrics.cssHeight)
    for (let index = 0; index < petalCount; index++) {
      const petal = petals[index]
      petal.phase += deltaSeconds
      petal.y += petal.speed * deltaSeconds
      petal.x += Math.sin(petal.phase) * petal.sway * deltaSeconds
      petal.rotation += petal.spin * deltaSeconds
      if (petal.y > metrics.cssHeight + 20 || petal.x < -50 || petal.x > metrics.cssWidth + 50)
        resetPetal(petal, false)
      drawPetal(petalContext, petal)
    }
    petalContext.globalAlpha = 1
  }

  function activateStar(x: number, y: number, directionX: number, directionY: number) {
    const star = stars[starCursor]
    starCursor = (starCursor + 1) % stars.length
    star.active = true
    star.x = x + (random() - 0.5) * 8
    star.y = y + (random() - 0.5) * 8
    star.vx = (random() - 0.5) * 18 - directionX * 0.04
    star.vy = 6 + random() * 12 - directionY * 0.02
    star.size = 1.1 + random() * 1.5
    star.age = 0
    star.life = 450 + random() * 250
    star.rotation = random() * Math.PI * 2
    star.color = random() > 0.68 ? 1 : 0
  }

  function emitStars() {
    if (!pointerDirty)
      return
    pointerDirty = false
    if (!pointerSeen) {
      pointerSeen = true
      lastEmitX = pointerX
      lastEmitY = pointerY
      return
    }

    const directionX = pointerX - lastEmitX
    const directionY = pointerY - lastEmitY
    const distance = Math.hypot(directionX, directionY)
    if (distance < 6)
      return

    const emittedStars = Math.min(3, Math.max(1, Math.floor(distance / 14)))
    for (let index = 0; index < emittedStars; index++)
      activateStar(pointerX, pointerY, directionX, directionY)
    lastEmitX = pointerX
    lastEmitY = pointerY
  }

  function drawStar(context: CanvasRenderingContext2D, star: StarParticle, alpha: number) {
    const palette = options.dark ? DARK_STARS : LIGHT_STARS
    context.save()
    context.translate(star.x, star.y)
    context.rotate(star.rotation)
    context.shadowBlur = 6
    context.shadowColor = `rgba(${palette[star.color]}, ${alpha})`
    context.fillStyle = `rgba(${palette[star.color]}, ${alpha})`
    context.beginPath()
    for (let point = 0; point < 8; point++) {
      const radius = point % 2 === 0 ? star.size * 2.2 : star.size * 0.55
      const angle = -Math.PI / 2 + point * Math.PI / 4
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (point === 0)
        context.moveTo(x, y)
      else
        context.lineTo(x, y)
    }
    context.closePath()
    context.fill()
    context.restore()
  }

  function renderStars(deltaMilliseconds: number, deltaSeconds: number) {
    if (!trailContext)
      return
    trailContext.clearRect(0, 0, metrics.cssWidth, metrics.cssHeight)
    emitStars()
    for (let index = 0; index < stars.length; index++) {
      const star = stars[index]
      if (!star.active)
        continue
      star.age += deltaMilliseconds
      if (star.age >= star.life) {
        star.active = false
        continue
      }
      star.vy += 34 * deltaSeconds
      star.x += star.vx * deltaSeconds
      star.y += star.vy * deltaSeconds
      star.rotation += 1.4 * deltaSeconds
      drawStar(trailContext, star, (1 - star.age / star.life) * 0.92)
    }
  }

  function recordDrawDuration(duration: number) {
    if (!collectDiagnostics)
      return
    drawDurations[durationIndex] = duration
    durationIndex = (durationIndex + 1) % drawDurations.length
    durationCount = Math.min(durationCount + 1, drawDurations.length)
  }

  function scheduleFrame() {
    if (destroyed || !visible || !hasActiveLayer() || frameHandle !== null) {
      if (!hasActiveLayer())
        running = false
      return
    }
    running = true
    frameHandle = requestFrame(renderFrame)
  }

  function renderFrame(timestamp: number) {
    frameHandle = null
    if (destroyed || !visible || !hasActiveLayer()) {
      running = false
      return
    }

    const frameInterval = 1000 / options.profile.fps
    if (lastRenderedAt !== null && timestamp - lastRenderedAt < frameInterval - 0.5) {
      scheduleFrame()
      return
    }

    const deltaMilliseconds = Math.min(lastRenderedAt === null ? frameInterval : timestamp - lastRenderedAt, 50)
    lastRenderedAt = timestamp
    const deltaSeconds = deltaMilliseconds / 1000
    const drawStartedAt = collectDiagnostics ? now() : 0

    if (hasSakuraLayer()) {
      try {
        renderPetals(deltaSeconds)
      }
      catch (error) {
        failLayer('sakura', error)
      }
    }
    if (hasTrailLayer()) {
      try {
        renderStars(deltaMilliseconds, deltaSeconds)
      }
      catch (error) {
        failLayer('trail', error)
      }
    }

    if (collectDiagnostics)
      recordDrawDuration(Math.max(0, now() - drawStartedAt))
    frameCount++
    scheduleFrame()
  }

  function start() {
    if (destroyed || !visible || !hasActiveLayer()) {
      running = false
      return
    }
    scheduleFrame()
  }

  function setVisible(nextVisible: boolean) {
    visible = nextVisible
    lastRenderedAt = null
    if (!visible) {
      cancelScheduledFrame()
      running = false
      return
    }
    start()
  }

  function setPointer(x: number, y: number) {
    pointerX = x
    pointerY = y
    pointerDirty = true
  }

  function setOptions(nextOptions: AmbientEngineOptions) {
    options = { ...nextOptions }
    petalCount = metrics.scale > 0
      ? computePetalCount(metrics.cssWidth, metrics.cssHeight, options.profile)
      : 0
    if (!hasSakuraLayer() && petalContext)
      petalContext.clearRect(0, 0, metrics.cssWidth, metrics.cssHeight)
    if (!hasTrailLayer()) {
      trailContext?.clearRect(0, 0, metrics.cssWidth, metrics.cssHeight)
      deactivateStars()
    }
    lastRenderedAt = null
    start()
  }

  function percentile95(): number {
    if (durationCount === 0)
      return 0
    const values = new Array<number>(durationCount)
    for (let index = 0; index < durationCount; index++)
      values[index] = drawDurations[index]
    values.sort((left, right) => left - right)
    return values[Math.max(0, Math.ceil(values.length * 0.95) - 1)]
  }

  function getDiagnostics(): AmbientEffectsDiagnostics {
    let starCount = 0
    for (let index = 0; index < stars.length; index++) {
      if (stars[index].active)
        starCount++
    }
    return {
      running,
      frameCount,
      petalCount: hasSakuraLayer() ? petalCount : 0,
      starCount,
      targetFps: options.profile.fps,
      drawP95Ms: percentile95(),
    }
  }

  function destroy() {
    destroyed = true
    running = false
    cancelScheduledFrame()
    petalContext?.clearRect(0, 0, metrics.cssWidth, metrics.cssHeight)
    trailContext?.clearRect(0, 0, metrics.cssWidth, metrics.cssHeight)
    if (petalCanvas) {
      petalCanvas.width = 0
      petalCanvas.height = 0
    }
    if (trailCanvas) {
      trailCanvas.width = 0
      trailCanvas.height = 0
    }
    deactivateStars()
    petalContext = null
    trailContext = null
    petalCanvas = null
    trailCanvas = null
  }

  return {
    start,
    setVisible,
    setPointer,
    setOptions,
    resize,
    getDiagnostics,
    destroy,
  }
}
```

- [ ] **Step 5: Run controller, core, and type verification**

Run:

```powershell
pnpm test:unit
pnpm lint
pnpm type-check
```

Expected: all tests pass; the controller tests demonstrate one scheduler, the 72-star cap, touch suppression, and one-time failure handling.

- [ ] **Step 6: Commit the Canvas controller**

Run:

```powershell
git add -- src/utils/ambientEffects.ts tests/helpers/fake-canvas.mjs tests/ambient-effects-controller.test.mjs
git commit -m "feat: add ambient Canvas particle engine"
```

### Task 6: Integrate The Effect Once In The Vue App Shell

**Files:**
- Create: `src/components/AmbientEffects.vue`
- Create: `tests/ambient-component-contract.test.mjs`
- Modify: `src/App.vue`
- Modify: `src/types/global.d.ts`

**Interfaces:**
- Consumes: `appStore.sakuraEnabled`, `appStore.cursorTrailEnabled`, `appStore.isDark`, `resolveAmbientProfile`, and `createAmbientEffectsController`.
- Produces: one global component, `window.__ambientEffectsDiagnostics` in development only, and stable layer hooks `data-ambient-layer="sakura|trail"`.

- [ ] **Step 1: Write the failing app-shell contract test**

Create `tests/ambient-component-contract.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the component contract test and verify it fails**

Run:

```powershell
node --test tests/ambient-component-contract.test.mjs
```

Expected: FAIL because `AmbientEffects.vue` does not exist and `App.vue` does not mount it.

- [ ] **Step 3: Create the Vue lifecycle component**

Create `src/components/AmbientEffects.vue` with this structure and behavior:

```vue
<script setup lang="ts">
import type { AmbientEffectsController, AmbientEffectsDiagnostics } from '@/utils/ambientEffects'
import type { WatchStopHandle } from 'vue'
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
```

- [ ] **Step 4: Mount the component once and establish stacking**

Replace `src/App.vue` with:

```vue
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import AmbientEffects from './components/AmbientEffects.vue'
import Background from './components/Background.vue'
import Footer from './components/Footer.vue'
import Header from './components/Header.vue'
import LoadingCover from './components/LoadingCover.vue'
import Provider from './components/Provider.vue'
import { useAppStore } from './stores/app'
import { destroyInitManager, initApp } from './utils/init'

const appStore = useAppStore()
const isReady = ref(false)

const pageContainerStyle = computed(() => {
  if (appStore.fullWidth)
    return {}
  return {
    maxWidth: appStore.maxPageWidth,
    marginInline: 'auto',
  }
})

onMounted(async () => {
  try {
    await initApp()
    await nextTick()
    isReady.value = true
  }
  catch (error) {
    console.error('[App] Initialization failed:', error)
    isReady.value = true
  }
})

onUnmounted(() => {
  destroyInitManager()
})
</script>

<template>
  <Provider>
    <Background />
    <AmbientEffects v-if="!appStore.loading" />
    <Transition
      enter-active-class="transition-all duration-100 ease-out"
      enter-from-class="opacity-0 backdrop-blur-0"
      enter-to-class="opacity-100 backdrop-blur-sm"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 backdrop-blur-sm"
      leave-to-class="opacity-0 backdrop-blur-0"
    >
      <LoadingCover v-if="appStore.loading" />
    </Transition>

    <div class="app-content-layer">
      <Header />
      <main v-if="!appStore.loading" class="min-h-screen overflow-hidden">
        <div :style="pageContainerStyle">
          <RouterView v-slot="{ Component }">
            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              enter-from-class="opacity-0 translate-x-4 blur-sm"
              enter-to-class="opacity-100 translate-x-0 blur-0"
              leave-active-class="transition-all duration-200 ease-in"
              leave-from-class="opacity-100 translate-x-0 blur-0"
              leave-to-class="opacity-0 -translate-x-4 blur-sm"
              mode="out-in"
            >
              <KeepAlive :include="['HomeView']">
                <component :is="Component" />
              </KeepAlive>
            </Transition>
          </RouterView>
        </div>
      </main>
      <Footer v-if="!appStore.loading" />
    </div>
  </Provider>
</template>

<style scoped>
.app-content-layer {
  position: relative;
  z-index: 1;
}
</style>
```

- [ ] **Step 5: Type the development diagnostics hook**

Add this import to `src/types/global.d.ts`:

```ts
import type { AmbientEffectsDiagnostics } from '@/utils/ambientEffects'
```

Add this optional property to `Window`:

```ts
__ambientEffectsDiagnostics?: () => AmbientEffectsDiagnostics | null
```

- [ ] **Step 6: Run component contracts, all unit tests, and build checks**

Run:

```powershell
pnpm test:unit
pnpm lint
pnpm build
```

Expected: all checks pass, the app builds, and the Extended ZIP is produced.

- [ ] **Step 7: Commit the app-shell integration**

Run:

```powershell
git add -- src/components/AmbientEffects.vue src/App.vue src/types/global.d.ts tests/ambient-component-contract.test.mjs
git commit -m "feat: integrate ambient effects across public pages"
```

### Task 7: Verify Browser Behavior, Performance, Packaging, And Preview

**Files:**
- Create: `tests/fixtures/mock-komari-server.mjs`
- Modify: `docs/preview.png`

**Interfaces:**
- Consumes: the completed theme, development diagnostics hook, and `.superpowers/perf/baseline.json`.
- Produces: reproducible browser fixtures, verified screenshots, an updated packaged preview, and final evidence for every acceptance criterion.

- [ ] **Step 1: Create the deterministic Komari fixture server**

Create `tests/fixtures/mock-komari-server.mjs`:

```js
import { createServer } from 'node:http'

const port = 4174
const settings = {
  sakuraEnabled: true,
  cursorTrailEnabled: true,
  rpcTransportMode: 'http',
  dataUpdateInterval: 60,
  backgroundEnabled: false,
  backgroundType: 'image',
  lightBackgroundUrl: '',
  darkBackgroundUrl: '',
  backgroundBlur: 0,
  backgroundOverlay: 0,
}

const client = {
  uuid: 'node-1',
  name: 'Tokyo Edge',
  cpu_name: 'AMD EPYC 7B13',
  virtualization: 'KVM',
  arch: 'x86_64',
  cpu_cores: 4,
  os: 'Debian 12',
  kernel_version: '6.1.0',
  gpu_name: '',
  region: 'JP',
  public_remark: 'Ambient effects preview node',
  mem_total: 4294967296,
  swap_total: 1073741824,
  disk_total: 85899345920,
  weight: 1,
  price: 5,
  billing_cycle: 30,
  auto_renewal: true,
  currency: 'USD',
  expired_at: '2027-07-14T00:00:00Z',
  group: 'Asia',
  tags: 'preview',
  hidden: false,
  traffic_limit: 1099511627776,
  traffic_limit_type: 'sum',
  created_at: '2026-07-14T00:00:00Z',
  updated_at: '2026-07-14T00:00:00Z',
}

const status = {
  client: 'node-1',
  time: '2026-07-14T03:00:00Z',
  cpu: 36,
  gpu: 0,
  ram: 2147483648,
  ram_total: 4294967296,
  swap: 0,
  swap_total: 1073741824,
  load: 0.42,
  load5: 0.35,
  load15: 0.28,
  temp: 46,
  disk: 32212254720,
  disk_total: 85899345920,
  net_in: 1310720,
  net_out: 524288,
  net_total_up: 21474836480,
  net_total_down: 53687091200,
  process: 112,
  connections: 84,
  connections_udp: 12,
  online: true,
  uptime: 864000,
}

function send(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(body))
}

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`)
  if (request.method === 'OPTIONS') {
    send(response, 204, {})
    return
  }
  if (request.method === 'GET' && url.pathname === '/public') {
    send(response, 200, {
      status: 'success',
      message: '',
      data: {
        allow_cors: true,
        custom_body: '',
        custom_head: '',
        description: 'Ambient effects preview',
        disable_password_login: false,
        oauth_enable: false,
        oauth_provider: null,
        ping_record_preserve_time: 24,
        private_site: false,
        record_enabled: true,
        record_preserve_time: 24,
        sitename: 'Komari Naive Extended',
        theme: 'NaiveExtended',
        theme_settings: settings,
      },
    })
    return
  }
  if (request.method === 'GET' && url.pathname === '/me') {
    send(response, 200, { logged_in: false, username: '' })
    return
  }
  if (request.method === 'POST' && url.pathname === '/__settings') {
    for (const [key, value] of url.searchParams) {
      if (value === 'true' || value === 'false')
        settings[key] = value === 'true'
      else
        settings[key] = value
    }
    send(response, 200, settings)
    return
  }
  if (request.method === 'POST' && url.pathname === '/rpc2') {
    let body = ''
    request.on('data', chunk => body += chunk)
    request.on('end', () => {
      const rpc = JSON.parse(body)
      const results = {
        'rpc.ping': 'pong',
        'common:getNodes': { 'node-1': client },
        'common:getNodesLatestStatus': { 'node-1': status },
        'common:getRecords': { records: [] },
      }
      send(response, 200, { jsonrpc: '2.0', result: results[rpc.method], id: rpc.id })
    })
    return
  }
  send(response, 404, { error: 'not found' })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`mock-komari-server http://127.0.0.1:${port}`)
})
```

- [ ] **Step 2: Start the fixture and Vite servers**

Run the fixture in one persistent terminal:

```powershell
node tests/fixtures/mock-komari-server.mjs
```

Run Vite in a second persistent terminal:

```powershell
$env:VITE_API_BASE='http://127.0.0.1:4174'
pnpm dev --host 127.0.0.1 --port 5173
```

Expected: both servers remain running and `http://127.0.0.1:5173` loads the monitor without initialization errors.

- [ ] **Step 3: Verify desktop light and dark behavior with browser automation**

Use the in-app browser control skill and a 1440x900 viewport. Navigate to `http://127.0.0.1:5173/`, wait for loading to finish, and run these page assertions:

```js
const layers = await page.locator('canvas[data-ambient-layer]').count()
if (layers !== 2) throw new Error(`Expected 2 ambient layers, received ${layers}`)
const pointerEvents = await page.locator('canvas[data-ambient-layer="trail"]').evaluate(element => getComputedStyle(element).pointerEvents)
if (pointerEvents !== 'none') throw new Error(`Trail pointer-events is ${pointerEvents}`)
await page.evaluate(() => {
  window.__ambientLongTasks = []
  window.__ambientLongTaskObserver = new PerformanceObserver((list) => {
    window.__ambientLongTasks.push(...list.getEntries().map(entry => entry.duration))
  })
  window.__ambientLongTaskObserver.observe({ entryTypes: ['longtask'] })
})
```

Record the DOM size, move the pointer continuously for 30 seconds, and verify the diagnostics:

```js
const domBefore = await page.locator('*').count()
for (let step = 0; step < 600; step++) {
  await page.mouse.move(40 + (step * 19) % 1320, 90 + (step * 13) % 720)
  await page.waitForTimeout(50)
}
const diagnostics = await page.evaluate(() => window.__ambientEffectsDiagnostics?.())
if (!diagnostics) throw new Error('Diagnostics are unavailable')
if (diagnostics.targetFps !== 60) throw new Error(`Expected 60 FPS target, received ${diagnostics.targetFps}`)
if (diagnostics.starCount > 72) throw new Error(`Star cap exceeded: ${diagnostics.starCount}`)
if (diagnostics.drawP95Ms > 2) throw new Error(`Draw p95 exceeded: ${diagnostics.drawP95Ms} ms`)
const domAfter = await page.locator('*').count()
if (domAfter !== domBefore) throw new Error(`DOM grew from ${domBefore} to ${domAfter}`)
const longTasks = await page.evaluate(() => window.__ambientLongTasks)
if (longTasks.some(duration => duration > 50)) throw new Error(`Long tasks detected: ${longTasks.join(', ')}`)
const frameBefore = diagnostics.frameCount
await page.waitForTimeout(1000)
const frameAfter = await page.evaluate(() => window.__ambientEffectsDiagnostics?.().frameCount)
const observedFrames = frameAfter - frameBefore
if (observedFrames < 50 || observedFrames > 65) throw new Error(`Observed desktop FPS outside range: ${observedFrames}`)
```

Run this heap, request, and theme-continuity check:

```js
const cdp = await page.context().newCDPSession(page)
await cdp.send('HeapProfiler.enable')
await cdp.send('HeapProfiler.collectGarbage')
const heapBefore = await page.evaluate(() => performance.memory.usedJSHeapSize)
for (let step = 0; step < 600; step++) {
  await page.mouse.move(40 + (step * 23) % 1320, 90 + (step * 17) % 720)
  await page.waitForTimeout(50)
}
await cdp.send('HeapProfiler.collectGarbage')
const heapAfter = await page.evaluate(() => performance.memory.usedJSHeapSize)
if (heapAfter > heapBefore * 1.1 && heapAfter - heapBefore > 1_048_576)
  throw new Error(`Heap grew from ${heapBefore} to ${heapAfter}`)

const unexpectedEffectResources = await page.evaluate(() => performance.getEntriesByType('resource')
  .map(entry => entry.name)
  .filter(name => /sakura|star|particle|ambient/i.test(name) && !/assets\/index-/.test(name)))
if (unexpectedEffectResources.length)
  throw new Error(`Unexpected effect resources: ${unexpectedEffectResources.join(', ')}`)

await page.locator('canvas[data-ambient-layer]').evaluateAll((elements) => {
  elements.forEach((element, index) => element.dataset.browserIdentity = `layer-${index}`)
})
const frameBeforeThemeChange = await page.evaluate(() => window.__ambientEffectsDiagnostics?.().frameCount)
await page.locator('.position-sticky button').first().click()
await page.waitForTimeout(500)
const identitiesAfterThemeChange = await page.locator('canvas[data-ambient-layer]').evaluateAll(elements => elements.map(element => element.dataset.browserIdentity))
if (identitiesAfterThemeChange.join(',') !== 'layer-0,layer-1')
  throw new Error(`Canvas recreated during theme change: ${identitiesAfterThemeChange.join(',')}`)
const frameAfterThemeChange = await page.evaluate(() => window.__ambientEffectsDiagnostics?.().frameCount)
if (frameAfterThemeChange <= frameBeforeThemeChange)
  throw new Error('Animation stopped during theme change')
```

Capture light and dark screenshots. Confirm Header buttons, node cards, scrolling, and node-detail navigation remain interactive while the trail passes over them.

- [ ] **Step 4: Verify route lifetime, touch, reduced motion, switches, and failure fallback**

Use this helper for fixture changes:

```js
async function setFixtureSettings(values) {
  const params = new URLSearchParams(values)
  const url = `http://127.0.0.1:4174/__settings?${params}`
  const status = await page.evaluate(async (requestUrl) => {
    const response = await fetch(requestUrl, { method: 'POST' })
    return response.status
  }, url)
  if (status !== 200)
    throw new Error(`Fixture settings returned ${status}`)
}
```

Perform these isolated browser contexts and assertions:

1. Navigate repeatedly between `/` and `/instance/node-1`; assert the Canvas count remains 2, the temporary Canvas identity values remain unchanged, and diagnostics `frameCount` continues rather than resetting.
2. Use a 390x844 touch/mobile context; assert only `canvas[data-ambient-layer="sakura"]` exists, `targetFps` is 30, and `starCount` remains 0. Measure a one-second `frameCount` delta and require 24-35 rendered frames.
3. Emulate `prefers-reduced-motion: reduce`; assert no ambient Canvas exists and `window.__ambientEffectsDiagnostics?.() == null`.
4. Override `document.hidden` to `true`, dispatch `visibilitychange`, record `frameCount`, wait one second, and assert the count is unchanged. Restore `document.hidden` to `false`, dispatch the event, wait one second, and require a `frameCount` increase of 50-65 on desktop.
5. Run `await setFixtureSettings({ sakuraEnabled: 'false', cursorTrailEnabled: 'true' })`, reload, and assert exactly the trail Canvas exists.
6. Run `await setFixtureSettings({ sakuraEnabled: 'true', cursorTrailEnabled: 'false' })`, reload, and assert exactly the sakura Canvas exists.
7. Run `await setFixtureSettings({ sakuraEnabled: 'false', cursorTrailEnabled: 'false' })`, reload, and assert no ambient Canvas exists.
8. In a fresh context, install an init script that makes `HTMLCanvasElement.prototype.getContext` return `null`; assert the page, Header controls, cards, and route navigation still work and no repeated warning loop appears.

Restore both settings with `await setFixtureSettings({ sakuraEnabled: 'true', cursorTrailEnabled: 'true' })` after the switch checks.

Use this exact visibility sequence for item 4:

```js
const pausedAt = await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  document.dispatchEvent(new Event('visibilitychange'))
  return window.__ambientEffectsDiagnostics?.().frameCount
})
await page.waitForTimeout(1000)
const stillPausedAt = await page.evaluate(() => window.__ambientEffectsDiagnostics?.().frameCount)
if (stillPausedAt !== pausedAt)
  throw new Error(`Frame count advanced while hidden: ${pausedAt} -> ${stillPausedAt}`)
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  document.dispatchEvent(new Event('visibilitychange'))
})
await page.waitForTimeout(1000)
const resumedAt = await page.evaluate(() => window.__ambientEffectsDiagnostics?.().frameCount)
const resumedFrames = resumedAt - stillPausedAt
if (resumedFrames < 50 || resumedFrames > 65)
  throw new Error(`Unexpected resumed frame count: ${resumedFrames}`)
```

- [ ] **Step 5: Verify background compatibility and update the packaged preview**

Use the page's `fetch` function with method `POST` and `URLSearchParams` to set `backgroundEnabled=true`, `backgroundType=image`, and both background URLs to this value:

```text
data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'%3E%3Crect width='1600' height='900' fill='%23dcebe5'/%3E%3Cpath d='M0 640 Q400 480 800 650 T1600 620 V900 H0Z' fill='%2398b8aa'/%3E%3C/svg%3E
```

The request URL must be built as:

```js
const background = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'%3E%3Crect width='1600' height='900' fill='%23dcebe5'/%3E%3Cpath d='M0 640 Q400 480 800 650 T1600 620 V900 H0Z' fill='%2398b8aa'/%3E%3C/svg%3E"
const params = new URLSearchParams({
  backgroundEnabled: 'true',
  backgroundType: 'image',
  lightBackgroundUrl: background,
  darkBackgroundUrl: background,
})
await page.evaluate(url => fetch(url, { method: 'POST' }), `http://127.0.0.1:4174/__settings?${params}`)
```

Reload the desktop page, verify petals remain between the custom background and cards, then capture the final 1440x900 screenshot directly to `docs/preview.png`. Inspect the saved image before continuing.

- [ ] **Step 6: Run complete repository, package, and size verification**

Stop both development servers, then run:

```powershell
pnpm test:unit
pnpm lint
pnpm build
node scripts/measure-build-size.mjs --compare .superpowers/perf/baseline.json --max-increase 12288
$zip = Get-ChildItem 'komari-theme-naive-extended-build-*.zip' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
tar -tf $zip.FullName
git diff --check
git status --short
```

Expected:

- All unit tests, lint, type checking, and build pass.
- Bundle comparison exits `0` and reports an increase no greater than 12,288 bytes.
- ZIP listing contains `komari-theme.json`, `preview.png`, and `dist/index.html`.
- No generated `dist`, ZIP, `.superpowers`, cache, or server file is staged.
- Only intentional source, test, fixture, and preview changes remain.

- [ ] **Step 7: Commit verification fixtures and the release preview**

Run:

```powershell
git add -- tests/fixtures/mock-komari-server.mjs docs/preview.png
git commit -m "test: verify ambient effects release"
git status --short --branch
```

Expected: the working tree is clean and the branch contains the plan commit plus seven implementation commits after the approved design commit.
