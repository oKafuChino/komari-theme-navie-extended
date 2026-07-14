# Release Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write both generated Komari ZIP artifacts into an ignored repository-root `release/` directory and make CI consume that same directory.

**Architecture:** The existing Vite close-bundle plugin owns output path creation, so it will create `release/` before constructing either archive output path. The release-directory contract is enforced by the current Node tests, while `.gitignore` and the CI workflow use the same explicit location.

**Tech Stack:** TypeScript, Vite plugin API, Node filesystem APIs, archiver 7, Node test runner, GitHub Actions.

## Global Constraints

- Preserve `komari-theme-naive-extended-build-<sha>.zip` and `komari-live2d-model-pack-template.zip` filenames and ZIP contents.
- Generate both artifacts directly under `release/`; do not copy them from the repository root.
- Create `release/` recursively when absent and keep it ignored by Git.
- Preserve existing hash-named main-theme ZIPs in `release/`; overwrite only the fixed-name model-pack template ZIP.
- Move, never copy, existing root-level ZIP artifacts into `release/`.
- Keep CI triggers, Node version, pnpm version, tests, build command, and artifact upload action unchanged except for the artifact path.
- Do not modify Komari runtime behavior, manifests, model-pack source files, or release ZIP contents.

---

### Task 1: Move The Release Contract To `release/`

**Files:**
- Modify: `vite.config.ts`
- Modify: `.gitignore`
- Modify: `.github/workflows/build-ci.yml`
- Modify: `tests/theme-contract.test.mjs`
- Modify: `tests/live2d-model-pack-contract.test.mjs`

**Interfaces:**
- Produces: `release/komari-theme-naive-extended-build-<sha>.zip`.
- Produces: `release/komari-live2d-model-pack-template.zip`.
- Consumes: existing main-theme `dist/`, `komari-theme.json`, `docs/preview.png`, and model-pack template inputs unchanged.

- [ ] **Step 1: Write failing output-path contracts**

Add to `tests/live2d-model-pack-contract.test.mjs`:

```js
test('writes both release artifacts directly under the ignored release directory', async () => {
  const vite = await text('vite.config.ts')
  const ignore = await text('.gitignore')
  assert.match(vite, /const releaseDir = resolve\(__dirname, 'release'\)/)
  assert.match(vite, /fs\.mkdirSync\(releaseDir, \{ recursive: true \}\)/)
  assert.match(vite, /resolve\(releaseDir, zipFileName\)/)
  assert.match(vite, /resolve\(releaseDir, 'komari-live2d-model-pack-template\.zip'\)/)
  assert.match(ignore, /^release\/$/m)
})
```

In `tests/theme-contract.test.mjs`, replace the old root-output assertions with:

```js
assert.match(workflow, /release\/komari-theme-naive-extended-build\*\.zip/)
assert.match(workflow, /release\/komari-live2d-model-pack-template\.zip/)
assert.match(ignore, /^release\/$/m)
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
node --test --test-concurrency=1 tests/live2d-model-pack-contract.test.mjs tests/theme-contract.test.mjs
```

Expected: FAIL because the plugin currently resolves ZIP outputs at the repository root and CI uploads root-level files.

- [ ] **Step 3: Create the directory and redirect both Vite outputs**

In `vite.config.ts`, change the Node filesystem import and add output setup in `closeBundle`:

```ts
import { existsSync, mkdirSync } from 'node:fs'
```

```ts
const releaseDir = resolve(__dirname, 'release')
fs.mkdirSync(releaseDir, { recursive: true })
const outputPath = resolve(releaseDir, zipFileName)
const modelPackOutput = resolve(releaseDir, 'komari-live2d-model-pack-template.zip')
```

Remove the old root-level `outputPath` and `modelPackOutput` declarations. Do not change `createZip()` or either archive's entries.

- [ ] **Step 4: Align ignore and CI paths**

In `.gitignore`, replace both root ZIP ignore lines with:

```gitignore
# Theme build output
release/
```

In `.github/workflows/build-ci.yml`, change only the artifact paths to:

```yaml
path: |
  release/komari-theme-naive-extended-build*.zip
  release/komari-live2d-model-pack-template.zip
```

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
node --test --test-concurrency=1 tests/live2d-model-pack-contract.test.mjs tests/theme-contract.test.mjs
node_modules\.bin\vue-tsc.CMD --build
```

Expected: both test files pass and type checking exits 0.

- [ ] **Step 6: Move existing local artifacts without copying**

Run from the repository root after confirming every candidate is a regular file:

```powershell
New-Item -ItemType Directory -Path release -Force | Out-Null
Get-ChildItem -File -Filter 'komari-theme-naive-extended-build-*.zip' | Move-Item -Destination release
if (Test-Path 'komari-live2d-model-pack-template.zip') {
  Move-Item -LiteralPath 'komari-live2d-model-pack-template.zip' -Destination release
}
```

Expected: the repository root has no matching ZIPs and `release/` contains all historic main-theme ZIPs plus one model-pack template ZIP.

- [ ] **Step 7: Build and inspect actual artifacts**

```bash
node_modules\.bin\vite.CMD build
tar -tf release\komari-live2d-model-pack-template.zip
```

Expected: Vite logs both `release/...` output paths. The template ZIP lists only `komari-theme.json`, `preview.png`, `dist/index.html`, and `dist/model/README.txt` (plus the directory entry). The repository root remains free of new ZIPs.

- [ ] **Step 8: Run full verification**

```bash
node --test --test-concurrency=1 tests/*.test.mjs
node_modules\.bin\oxlint.CMD . --fix
node_modules\.bin\eslint.CMD . --fix --cache
node_modules\.bin\vue-tsc.CMD --build
```

Expected: all tests pass, both linters report no errors, and type checking exits 0. If lint changes a source file, rerun the full unit suite before committing.

- [ ] **Step 9: Commit the release-directory migration**

```bash
git add vite.config.ts .gitignore .github/workflows/build-ci.yml tests/theme-contract.test.mjs tests/live2d-model-pack-contract.test.mjs
git commit -m "build: write releases to dedicated directory"
```

Expected: source and contract changes are committed; `release/` and its ZIPs remain ignored and untracked.
