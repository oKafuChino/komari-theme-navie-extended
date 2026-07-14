# Live2D Independent Model Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a one-time-install Komari Live2D model resource-pack template and make the main theme load models from that independent theme so future main-theme updates do not overwrite administrator models.

**Architecture:** Keep the Cubism Core runtime in the main theme, move only administrator model guidance and files into a separate `komari-live2d-models` theme template, and use Komari's native `/themes/:id/*path` static route. Centralize the fixed path policy in `live2dCompanion.ts`, then extend the existing Vite zip plugin to create the unchanged main-theme ZIP plus one fixed-name model-pack template ZIP.

**Tech Stack:** Vue 3, TypeScript, Vite plugin API, Node filesystem APIs, archiver 7, Komari managed-theme manifest, Node test runner, GitHub Actions.

## Global Constraints

- Start only after every task and verification gate in `docs/superpowers/plans/2026-07-14-live2d-pointer-follow.md` passes.
- Do not modify the Komari backend, database, static route, upload API, server process, reverse proxy, Docker configuration, or deployment layout.
- Preserve the main-theme manifest filename `komari-theme.json`, main-theme `short` value `NaiveExtended`, preview filename `preview.png`, and ZIP name `komari-theme-naive-extended-build-<sha>.zip`.
- The independent resource-pack `short` is exactly `komari-live2d-models` and its output name is exactly `komari-live2d-model-pack-template.zip`.
- The default model URL is exactly `/themes/komari-live2d-models/dist/model/model.model3.json`.
- Accept arbitrary legal nested `.model3.json` entry filenames below `/themes/komari-live2d-models/dist/model/`; `model.model3.json` is a default, not a forced rename.
- Reject external origins, credentials, query strings, fragments, backslashes, encoded or plain traversal, non-`.model3.json` entries, other theme directories, and model references outside the entry file's directory.
- The template and main-theme Release must contain no XFZN name, `.model3.json`, `.moc3`, model texture, model motion, model expression, or character sound.
- Keep `public/live2d/runtime/live2dcubismcore.min.js` and its third-party notice in the main theme.
- Keep theme version `1.0.0` unless the user separately requests a version change.
- Preserve all pointer-follow, greeting, click, session-close, scaling, frame-rate, reduced-motion, lazy-load, and teardown behavior from stage 1.

---

### Task 1: Migrate To A Centralized Fixed Model-Pack Path Policy

**Files:**
- Modify: `src/utils/live2dCompanion.ts`
- Modify: `src/stores/app.ts`
- Modify: `komari-theme.json`
- Test: `tests/live2d-companion-core.test.mjs`
- Test: `tests/live2d-settings.test.mjs`

**Interfaces:**
- Produces: `LIVE2D_MODEL_PACK_PREFIX = '/themes/komari-live2d-models/dist/model/'`.
- Produces: `DEFAULT_LIVE2D_MODEL_PATH = '/themes/komari-live2d-models/dist/model/model.model3.json'`.
- Produces: `isValidLive2DModelPath(value: unknown): value is string`.
- Produces: `normalizeLive2DModelPath(value: unknown): string`.
- Changes: `resolveLive2DModelPath(path, origin)` accepts only the fixed model-pack prefix.
- Changes: internal model references must be relative and remain inside the entry model directory.

- [ ] **Step 1: Replace old-path tests with failing model-pack path tests**

In `tests/live2d-companion-core.test.mjs`, replace the old model-path test with:

```js
test('accepts only model entries inside the fixed Live2D resource pack', () => {
  assert.equal(
    core.resolveLive2DModelPath(
      '/themes/komari-live2d-models/dist/model/chino/XFZN.model3.json',
      'https://site.test',
    )?.href,
    'https://site.test/themes/komari-live2d-models/dist/model/chino/XFZN.model3.json',
  )
  assert.equal(
    core.resolveLive2DModelPath(
      '/themes/komari-live2d-models/dist/model/智乃/看板娘.model3.json',
      'https://site.test',
    )?.pathname,
    '/themes/komari-live2d-models/dist/model/%E6%99%BA%E4%B9%83/%E7%9C%8B%E6%9D%BF%E5%A8%98.model3.json',
  )
  assert.equal(core.resolveLive2DModelPath('/live2d/model/model.model3.json', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('/themes/other/dist/model/model.model3.json', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('https://evil.test/model.model3.json', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('/themes/komari-live2d-models/dist/model/../x.model3.json', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('/themes/komari-live2d-models/dist/model/%2e%2e/x.model3.json', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('/themes/komari-live2d-models/dist/model/a%5cb.model3.json', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('/themes/komari-live2d-models/dist/model/model.model3.json?x=1', 'https://site.test'), null)
  assert.equal(core.resolveLive2DModelPath('/themes/komari-live2d-models/dist/model/model.model3.json#x', 'https://site.test'), null)
})

test('normalizes invalid model-pack settings to the fixed default', () => {
  assert.equal(
    core.normalizeLive2DModelPath('/themes/komari-live2d-models/dist/model/chino/chino.model3.json'),
    '/themes/komari-live2d-models/dist/model/chino/chino.model3.json',
  )
  assert.equal(core.normalizeLive2DModelPath('/live2d/model/model.model3.json'), core.DEFAULT_LIVE2D_MODEL_PATH)
  assert.equal(core.normalizeLive2DModelPath(null), core.DEFAULT_LIVE2D_MODEL_PATH)
})
```

Change model-reference fixtures to use:

```js
const modelUrl = new URL('https://site.test/themes/komari-live2d-models/dist/model/chino/XFZN.model3.json')
```

Add explicit absolute-reference rejection:

```js
const absoluteReference = structuredClone(valid)
absoluteReference.FileReferences.Textures = [
  '/themes/komari-live2d-models/dist/model/chino/XFZN.2048/texture_00.png',
]
assert.deepEqual(core.validateLive2DModelDocument(absoluteReference, modelUrl), [
  'FileReferences.Textures[0]',
])
```

In `tests/live2d-settings.test.mjs`, change the expected manifest setting and default:

```js
assert.deepEqual(items.find(item => item.key === 'live2dModelPath'), {
  key: 'live2dModelPath',
  name: 'Live2D 模型入口',
  type: 'string',
  default: '/themes/komari-live2d-models/dist/model/model.model3.json',
  help: '独立 Live2D 资源包 dist/model/ 下的 Cubism 3/4 .model3.json 路径',
})
```

Change the invalid-setting fallback assertion to the same default and add a valid nested setting assertion.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs tests/live2d-settings.test.mjs
```

Expected: FAIL because the current policy still accepts `/live2d/` and the manifest/store still use the old default.

- [ ] **Step 3: Centralize and implement the model-pack path policy**

In `src/utils/live2dCompanion.ts`, add:

```ts
export const LIVE2D_MODEL_PACK_PREFIX = '/themes/komari-live2d-models/dist/model/'
export const DEFAULT_LIVE2D_MODEL_PATH = `${LIVE2D_MODEL_PACK_PREFIX}model.model3.json`

export function isValidLive2DModelPath(value: unknown): value is string {
  if (typeof value !== 'string' || value !== value.trim() || hasUnsafeTraversal(value))
    return false
  try {
    const base = new URL('https://komari.invalid/')
    const resolved = new URL(value, base)
    return resolved.origin === base.origin
      && !resolved.username
      && !resolved.password
      && !resolved.search
      && !resolved.hash
      && resolved.pathname.startsWith(LIVE2D_MODEL_PACK_PREFIX)
      && resolved.pathname.toLowerCase().endsWith('.model3.json')
  }
  catch {
    return false
  }
}

export function normalizeLive2DModelPath(value: unknown): string {
  if (typeof value !== 'string')
    return DEFAULT_LIVE2D_MODEL_PATH
  const path = value.trim()
  return isValidLive2DModelPath(path) ? path : DEFAULT_LIVE2D_MODEL_PATH
}
```

Also strengthen the existing traversal helper so encoded backslashes are rejected while Unicode filenames remain valid:

```ts
function hasUnsafeTraversal(path: string): boolean {
  if (!path)
    return true
  try {
    const decoded = decodeURIComponent(path)
    return decoded.includes('\\') || decoded.split('/').includes('..')
  }
  catch {
    return true
  }
}
```

Change `resolveLive2DModelPath()` to return `null` unless `isValidLive2DModelPath(path)` succeeds, then resolve it against the supplied same-origin base.

At the beginning of `isSafeModelReference()` reject absolute or protocol references:

```ts
if (
  typeof reference !== 'string'
  || reference.startsWith('/')
  || reference.startsWith('//')
  || /^[a-z][a-z\d+.-]*:/i.test(reference)
  || hasUnsafeTraversal(reference)
) {
  return false
}
```

Keep the existing final resolved-path check that requires every reference to remain in the entry file's directory or a child directory.

- [ ] **Step 4: Make the store consume the shared normalizer**

In `src/stores/app.ts`, import:

```ts
import { normalizeLive2DModelPath } from '@/utils/live2dCompanion'
```

Delete the local `DEFAULT_LIVE2D_MODEL_PATH` constant and replace the computed setting with:

```ts
const live2dModelPath = computed<string>(() => {
  return normalizeLive2DModelPath(publicSettings.value?.theme_settings?.live2dModelPath)
})
```

- [ ] **Step 5: Update the managed theme default**

In `komari-theme.json`, replace only the `live2dModelPath` item with:

```json
{ "key": "live2dModelPath", "name": "Live2D 模型入口", "type": "string", "default": "/themes/komari-live2d-models/dist/model/model.model3.json", "help": "独立 Live2D 资源包 dist/model/ 下的 Cubism 3/4 .model3.json 路径" }
```

Do not change the main-theme `short`, version, or any unrelated setting.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
node --test --test-concurrency=1 tests/live2d-companion-core.test.mjs tests/live2d-settings.test.mjs
```

Expected: all focused tests pass.

- [ ] **Step 7: Commit the path migration**

```bash
git add src/utils/live2dCompanion.ts src/stores/app.ts komari-theme.json tests/live2d-companion-core.test.mjs tests/live2d-settings.test.mjs
git commit -m "feat: load Live2D from independent model pack"
```

Expected: one focused path-policy commit with no packaging files yet.

---

### Task 2: Create The Model-Pack Template Source

**Files:**
- Create: `packaging/live2d-model-pack/komari-theme.json`
- Create: `packaging/live2d-model-pack/preview.png`
- Create: `packaging/live2d-model-pack/dist/index.html`
- Create: `packaging/live2d-model-pack/dist/model/README.txt`
- Delete: `public/live2d/model/README.txt`
- Create: `tests/live2d-model-pack-contract.test.mjs`
- Modify: `tests/live2d-release-contract.test.mjs`

**Interfaces:**
- Produces: a model-free source tree that is archived verbatim as the independent Komari theme.
- Produces: resource-pack manifest `short` exactly `komari-live2d-models`.
- Preserves: `public/live2d/runtime/` as main-theme runtime input.

- [ ] **Step 1: Write failing source-template contracts**

Create `tests/live2d-model-pack-contract.test.mjs`:

```js
import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)

async function text(path) {
  return readFile(new URL(path, root), 'utf8')
}

async function walk(url, prefix = '') {
  const entries = await readdir(url, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relative = `${prefix}${entry.name}`
    if (entry.isDirectory())
      files.push(...await walk(new URL(`${entry.name}/`, url), `${relative}/`))
    else
      files.push(relative)
  }
  return files.sort()
}

test('declares the fixed independent Live2D resource theme identity', async () => {
  const manifest = JSON.parse(await text('packaging/live2d-model-pack/komari-theme.json'))
  assert.deepEqual(manifest, {
    name: 'Live2D 模型资源包（请勿设为当前主题）',
    short: 'komari-live2d-models',
    version: '1.0.0',
    configuration: { type: 'managed', data: [] },
  })
})

test('ships only model-free template inputs and a nonempty preview', async () => {
  const packRoot = new URL('packaging/live2d-model-pack/', root)
  assert.deepEqual(await walk(packRoot), [
    'dist/index.html',
    'dist/model/README.txt',
    'komari-theme.json',
    'preview.png',
  ])
  assert.ok((await stat(new URL('preview.png', packRoot))).size > 1000)
  const files = await walk(packRoot)
  assert.equal(files.some(file => /\.(?:moc3|model3\.json|motion3\.json|exp3\.json|wav|mp3|ogg)$/i.test(file)), false)
  assert.equal(files.some(file => /XFZN/i.test(file)), false)
})

test('warns administrators not to activate or delete the resource theme', async () => {
  const page = await text('packaging/live2d-model-pack/dist/index.html')
  const guide = await text('packaging/live2d-model-pack/dist/model/README.txt')
  assert.match(page, /Live2D 模型资源包/)
  assert.match(page, /请勿.*当前主题/)
  assert.match(page, /请勿删除/)
  assert.match(page, /href="\/admin"/)
  assert.match(guide, /dist\/model\//)
  assert.match(guide, /\.model3\.json/)
  assert.match(guide, /保持.*相对.*目录/)
  assert.match(guide, /2048.*16 MiB/s)
})
```

Update `tests/live2d-release-contract.test.mjs` so the model guidance comes from the new template and the old main-theme model directory must not exist:

```js
test('keeps character models and model guidance out of the main theme', async () => {
  await assert.rejects(
    readdir(new URL('public/live2d/model/', root)),
    error => error?.code === 'ENOENT',
  )
  const guide = await text('packaging/live2d-model-pack/dist/model/README.txt')
  assert.match(guide, /Cubism 3\/4/)
  assert.match(guide, /\.model3\.json/)
})
```

Keep the existing Cubism Core and third-party-notice test unchanged.

- [ ] **Step 2: Run template contracts and verify RED**

```bash
node --test --test-concurrency=1 tests/live2d-model-pack-contract.test.mjs tests/live2d-release-contract.test.mjs
```

Expected: FAIL because the template source does not exist and the old main-theme model README is still present.

- [ ] **Step 3: Create the exact resource-pack manifest**

Create `packaging/live2d-model-pack/komari-theme.json`:

```json
{
  "name": "Live2D 模型资源包（请勿设为当前主题）",
  "short": "komari-live2d-models",
  "version": "1.0.0",
  "configuration": {
    "type": "managed",
    "data": []
  }
}
```

- [ ] **Step 4: Create the safe mistaken-activation page**

Create `packaging/live2d-model-pack/dist/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live2D 模型资源包</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { display: grid; min-height: 100vh; margin: 0; place-items: center; background: #f5f7f8; color: #202528; }
      main { width: min(520px, calc(100% - 32px)); text-align: center; }
      h1 { margin: 0 0 12px; font-size: 24px; letter-spacing: 0; }
      p { margin: 8px 0; line-height: 1.7; }
      a { display: inline-block; margin-top: 16px; color: #16794b; }
      @media (prefers-color-scheme: dark) { body { background: #151817; color: #edf2ef; } a { color: #63e2b6; } }
    </style>
  </head>
  <body>
    <main>
      <h1>Live2D 模型资源包</h1>
      <p>该资源包只用于保存看板娘模型，请勿设为当前主题，也请勿删除。</p>
      <p>请在主题管理中重新启用 Komari Naive Extended。</p>
      <a href="/admin">返回 Komari 管理页</a>
    </main>
  </body>
</html>
```

- [ ] **Step 5: Move administrator model guidance into the template**

Create `packaging/live2d-model-pack/dist/model/README.txt` with this content, then delete `public/live2d/model/README.txt`:

```text
Live2D 独立模型资源包

1. 将完整的 Cubism 3/4 模型复制到本目录 dist/model/，保持模型内部相对目录不变。
2. 找到模型入口 .model3.json；入口可以使用任意文件名或嵌套目录。
3. 重新压缩 ZIP 根目录中的 komari-theme.json、preview.png 和 dist/，不要额外包一层父目录。
4. 在 Komari 主题管理中上传该资源包，但请勿将它设为当前主题，也请勿删除。
5. 在 Komari Naive Extended 设置中填写入口，例如：
   /themes/komari-live2d-models/dist/model/model.model3.json
   /themes/komari-live2d-models/dist/model/chino/chino.model3.json

建议使用不超过 2048x2048 的纹理。单张未压缩 RGBA 纹理约占：
- 2048x2048：16 MiB
- 4096x4096：64 MiB

请移除不需要的动作和声音，并仅部署你有权公开展示的模型。
```

- [ ] **Step 6: Create and inspect the resource-pack preview**

Create `packaging/live2d-model-pack/preview.png` as a 1200x630 PNG with a restrained neutral background, a package icon, the ASCII title `LIVE2D MODEL PACK`, and the warning `DO NOT ENABLE OR DELETE`. Do not include a character, third-party artwork, gradients, or model imagery. Inspect the file visually and confirm text is legible at theme-card size.

- [ ] **Step 7: Run template contracts and verify GREEN**

```bash
node --test --test-concurrency=1 tests/live2d-model-pack-contract.test.mjs tests/live2d-release-contract.test.mjs
```

Expected: all template and runtime-release tests pass.

- [ ] **Step 8: Commit the model-free template source**

```bash
git add packaging/live2d-model-pack public/live2d/model/README.txt tests/live2d-model-pack-contract.test.mjs tests/live2d-release-contract.test.mjs
git commit -m "feat: add independent Live2D model pack template"
```

Expected: Git records the old README deletion and the new template, with no model binary.

---

### Task 3: Build And Publish Both ZIP Artifacts

**Files:**
- Modify: `vite.config.ts`
- Modify: `.gitignore`
- Modify: `.github/workflows/build-ci.yml`
- Modify: `tests/theme-contract.test.mjs`
- Modify: `tests/live2d-model-pack-contract.test.mjs`

**Interfaces:**
- Preserves: `komari-theme-naive-extended-build-<sha>.zip` with root `dist/`, `komari-theme.json`, `preview.png`.
- Produces: `komari-live2d-model-pack-template.zip` with root `dist/`, `komari-theme.json`, `preview.png`.
- Produces: CI artifact upload containing both ZIPs.

- [ ] **Step 1: Write failing dual-artifact source contracts**

Add to `tests/live2d-model-pack-contract.test.mjs`:

```js
test('builds the resource template as a second fixed-name ZIP', async () => {
  const vite = await text('vite.config.ts')
  assert.match(vite, /komari-theme-naive-extended-build-\$\{commitHash\}\.zip/)
  assert.match(vite, /komari-live2d-model-pack-template\.zip/)
  assert.match(vite, /packaging[\\/]live2d-model-pack/)
  assert.match(vite, /archive\.directory\(modelPackDistDir, 'dist'\)/)
})
```

Update the artifact contract in `tests/theme-contract.test.mjs`:

```js
assert.match(workflow, /komari-theme-naive-extended-build\*\.zip/)
assert.match(workflow, /komari-live2d-model-pack-template\.zip/)
assert.match(ignore, /^komari-live2d-model-pack-template\.zip$/m)
```

- [ ] **Step 2: Run contract tests and verify RED**

```bash
node --test --test-concurrency=1 tests/live2d-model-pack-contract.test.mjs tests/theme-contract.test.mjs
```

Expected: FAIL because Vite, CI, and `.gitignore` know only the main-theme ZIP.

- [ ] **Step 3: Extract a reusable zip writer inside the existing Vite config**

In `vite.config.ts`, add this local helper above `komariThemeZip()`:

```ts
interface ZipArchive {
  pointer: () => number
  on: (event: 'error', listener: (error: Error) => void) => ZipArchive
  pipe: (output: NodeJS.WritableStream) => void
  file: (source: string, data: { name: string }) => ZipArchive
  directory: (source: string, destination: string) => ZipArchive
  finalize: () => Promise<void>
}

function createZip(
  outputPath: string,
  displayName: string,
  addEntries: (archive: ZipArchive) => void,
): Promise<void> {
  const output = fs.createWriteStream(outputPath)
  const archive = archiver('zip', { zlib: { level: 9 } }) as ZipArchive
  return new Promise((resolvePromise, reject) => {
    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2)
      console.log(`[komari-theme-zip] Created ${displayName} (${sizeMB} MB)`)
      resolvePromise()
    })
    output.on('error', reject)
    archive.on('error', (error: Error) => reject(error))
    archive.pipe(output)
    addEntries(archive)
    void archive.finalize()
  })
}
```

- [ ] **Step 4: Replace `closeBundle` with sequential main-theme and model-pack archives**

Keep the existing main-theme paths and add:

```ts
const modelPackRoot = resolve(__dirname, 'packaging/live2d-model-pack')
const modelPackManifest = resolve(modelPackRoot, 'komari-theme.json')
const modelPackPreview = resolve(modelPackRoot, 'preview.png')
const modelPackDistDir = resolve(modelPackRoot, 'dist')
const modelPackOutput = resolve(__dirname, 'komari-live2d-model-pack-template.zip')
```

Fail the build if any required main-theme or model-pack input is missing:

```ts
const requiredInputs = [
  distDir,
  themeJsonPath,
  previewPath,
  modelPackManifest,
  modelPackPreview,
  modelPackDistDir,
]
const missingInputs = requiredInputs.filter(path => !existsSync(path))
if (missingInputs.length > 0)
  throw new Error(`[komari-theme-zip] Missing release input: ${missingInputs.join(', ')}`)
```

Then create archives sequentially:

```ts
await createZip(outputPath, zipFileName, (archive) => {
  archive.file(themeJsonPath, { name: 'komari-theme.json' })
  archive.file(previewPath, { name: 'preview.png' })
  archive.directory(distDir, 'dist')
})

await createZip(modelPackOutput, 'komari-live2d-model-pack-template.zip', (archive) => {
  archive.file(modelPackManifest, { name: 'komari-theme.json' })
  archive.file(modelPackPreview, { name: 'preview.png' })
  archive.directory(modelPackDistDir, 'dist')
})
```

Do not rename the plugin, main-theme output, `dist`, manifest, or preview entries.

- [ ] **Step 5: Ignore and upload the second artifact**

Add to `.gitignore`:

```gitignore
komari-live2d-model-pack-template.zip
```

Change only the artifact path in `.github/workflows/build-ci.yml`:

```yaml
path: |
  komari-theme-naive-extended-build*.zip
  komari-live2d-model-pack-template.zip
```

Preserve triggers, Node 24, pnpm 10, unit tests, build order, runner, and `archive: false`.

- [ ] **Step 6: Run source contracts and type checking**

```bash
node --test --test-concurrency=1 tests/live2d-model-pack-contract.test.mjs tests/theme-contract.test.mjs
pnpm type-check
```

Expected: both test files pass and TypeScript exits 0.

- [ ] **Step 7: Build both artifacts**

```bash
pnpm build
```

Expected: build succeeds and logs creation of both `komari-theme-naive-extended-build-<sha>.zip` and `komari-live2d-model-pack-template.zip`.

- [ ] **Step 8: Inspect exact ZIP entries**

List each ZIP using the platform's ZIP reader. Confirm the model-pack ZIP contains exactly:

```text
komari-theme.json
preview.png
dist/index.html
dist/model/README.txt
```

Confirm the main-theme ZIP still contains `komari-theme.json`, `preview.png`, and `dist/`, including `dist/live2d/runtime/live2dcubismcore.min.js`, but contains no `dist/live2d/model/` directory or character model files.

- [ ] **Step 9: Commit dual-artifact packaging**

```bash
git add vite.config.ts .gitignore .github/workflows/build-ci.yml tests/theme-contract.test.mjs tests/live2d-model-pack-contract.test.mjs
git commit -m "build: package independent Live2D resources"
```

Expected: generated ZIPs remain ignored and are not committed.

---

### Task 4: Replace The Old Installation Workflow In Documentation

**Files:**
- Modify: `README.md`
- Modify: `tests/live2d-release-contract.test.mjs`

**Interfaces:**
- Consumes: the two artifact names and fixed resource URL from Tasks 1-3.
- Produces: one deployment-independent administrator workflow that does not mention editing the main-theme ZIP.

- [ ] **Step 1: Write failing documentation contracts**

Replace the old README assertions in `tests/live2d-release-contract.test.mjs` with:

```js
test('documents one-time model-pack installation and the no-backend boundary', async () => {
  const readme = await text('README.md')
  assert.match(readme, /komari-live2d-model-pack-template\.zip/)
  assert.match(readme, /komari-live2d-models/)
  assert.match(readme, /\/themes\/komari-live2d-models\/dist\/model\/model\.model3\.json/)
  assert.match(readme, /更新主主题.*不会.*模型/s)
  assert.match(readme, /请勿.*当前主题/)
  assert.match(readme, /请勿删除/)
  assert.match(readme, /不修改 Komari 后端/)
  assert.match(readme, /\/themes\/:id\/\*path/)
  assert.match(readme, /瞬时内存/)
  assert.match(readme, /api64\.ipify\.org/)
  assert.doesNotMatch(readme, /dist\/live2d\/model/)
})
```

- [ ] **Step 2: Run the release contract and verify RED**

```bash
node --test --test-concurrency=1 tests/live2d-release-contract.test.mjs
```

Expected: FAIL because README still instructs users to unpack and edit the main-theme ZIP.

- [ ] **Step 3: Replace the README Live2D installation section**

Keep the existing privacy paragraph, but replace the old installation steps with text that states:

```markdown
安装模型：

1. 下载 `komari-live2d-model-pack-template.zip` 并解压。
2. 将完整 Cubism 3/4 模型复制到资源包的 `dist/model/`，保持模型内部相对目录不变。
3. 重新压缩根目录中的 `dist/`、`komari-theme.json` 和 `preview.png`，不要额外包一层父目录。
4. 在 Komari 主题管理中上传资源包。该包的标识为 `komari-live2d-models`，请勿将它设为当前主题，也请勿删除。
5. 安装并启用正常的 Komari Naive Extended 主主题。
6. 在主主题设置中启用看板娘并填写入口，例如 `/themes/komari-live2d-models/dist/model/model.model3.json`。嵌套入口同样受支持。

模型资源包只需首次安装。之后更新主主题只会替换 `NaiveExtended` 主题目录，不会删除独立的 `komari-live2d-models` 模型资源；重新上传或删除资源包才会替换或移除模型。
```

Also state that the template contains no character model, recommend textures no larger than 2048, and point users to `dist/model/README.txt` inside the resource pack.

Add this deployment and memory boundary explicitly:

```markdown
资源包由 Komari 原生 `/themes/:id/*path` 静态路由提供，因此 Docker、1Panel、宝塔、systemd、二进制运行和反向代理部署均不需要额外路径配置。Komari 返回静态模型文件时会产生与文件大小相关的单次瞬时内存占用；压缩包体积不代表浏览器解码后的纹理内存，建议纹理不超过 2048x2048 并移除不需要的动作和声音。
```

- [ ] **Step 4: Run release contracts and verify GREEN**

```bash
node --test --test-concurrency=1 tests/live2d-release-contract.test.mjs tests/live2d-model-pack-contract.test.mjs
```

Expected: both files pass.

- [ ] **Step 5: Commit the administrator workflow**

```bash
git add README.md tests/live2d-release-contract.test.mjs
git commit -m "docs: explain persistent Live2D model packs"
```

Expected: README no longer tells administrators to modify every main-theme Release.

---

### Task 5: Run Joint Regression And Update-Persistence Acceptance

**Files:**
- Modify only if verification exposes a defect: files and tests already listed in Tasks 1-4 or the completed pointer-follow plan.

**Interfaces:**
- Consumes: completed pointer-follow implementation and independent model-pack implementation.
- Produces: two verified Release artifacts and evidence that a main-theme update preserves the independent model URL and interaction behavior.

- [ ] **Step 1: Run the complete repository test suite**

```bash
pnpm test:unit
```

Expected: all tests pass, including every pointer-follow, model-path, template, release, and theme contract.

- [ ] **Step 2: Run lint and re-test any formatting changes**

```bash
pnpm lint
```

Expected: exit code 0. Inspect `git diff`; lint changes only intentional touched files. If lint changes source, rerun `pnpm test:unit`.

- [ ] **Step 3: Remove stale build output and create final artifacts**

Remove only the ignored local `dist/`, main-theme build ZIPs, and `komari-live2d-model-pack-template.zip` after verifying their resolved paths remain inside the repository. Then run:

```bash
pnpm build
```

Expected: a clean production build generates exactly one current main-theme ZIP and one model-pack template ZIP.

- [ ] **Step 4: Perform binary and path exclusion checks**

Inspect both ZIP entry lists and extracted temporary copies. Confirm:

- Neither ZIP contains `XFZN` or any model binary/texture/motion/expression/sound.
- The model-pack template has exactly the four expected files.
- The main theme retains Cubism Core and its notice.
- Built JavaScript contains the fixed `/themes/komari-live2d-models/dist/model/` prefix and no accepted old `/live2d/model/` default.
- The main-theme manifest still has `short: NaiveExtended` and version `1.0.0`.

- [ ] **Step 5: Verify the administrator packaging workflow**

In a temporary extracted model-pack copy outside Git, place a licensed local model under `dist/model/`, keep its internal relative paths, rezip the four root entries, and upload it through Komari theme management. Confirm the model is reachable at its `/themes/komari-live2d-models/dist/model/...model3.json` URL without server-path or reverse-proxy configuration.

- [ ] **Step 6: Verify main-theme update persistence**

Install and enable the generated main-theme ZIP, configure the independent model URL, then upload a newly built main-theme ZIP with the same `NaiveExtended` short. Confirm:

- The resource theme remains listed under `komari-live2d-models`.
- The model URL still returns the model after the main-theme update.
- The stored model path remains unchanged.
- The companion still greets, speaks on click, closes for the session, scales to 150% without clipping, and follows desktop/touch pointers according to stage 1.

- [ ] **Step 7: Verify failure degradation**

Temporarily test a missing resource pack, invalid nested entry, missing texture, and unavailable WebGL. Each case must hide or disable only the companion, emit at most one concise warning per failure category, and leave monitoring cards, charts, theme switching, and residual-value UI functional.

- [ ] **Step 8: Inspect repository state**

```bash
git status --short
git log --oneline -8
```

Expected: source changes are committed in focused stage-2 commits, generated ZIPs remain ignored, and no local model appears in Git status or recent commits.

- [ ] **Step 9: Commit only regression fixes if required**

For any defect found in Steps 1-8, first add a focused failing test, apply the smallest fix, rerun the complete verification, then commit only the affected files:

```bash
git commit -m "fix: harden independent Live2D model packs"
```

Expected: skip this commit when no defect is found. Never commit a locally supplied model or extracted resource pack.
