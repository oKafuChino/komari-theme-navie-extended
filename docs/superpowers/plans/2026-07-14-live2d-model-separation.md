# Live2D Model Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep administrator-supplied Live2D model files outside the replaceable theme ZIP while preserving lazy loading, validation, and privacy behavior.

**Architecture:** The theme ships only Live2D runtime assets. A managed `live2dModelPath` points to an independently hosted same-origin `.model3.json` entry, defaulting to `/live2d-model/model.model3.json`; model references stay within the model directory. Existing `/live2d/model/...` paths remain accepted for compatibility, but packaged model files and instructions move out of that directory.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vite, Node test runner, pnpm.

## Global Constraints

- Do not modify Komari backend files or APIs.
- Do not add XFZN or any model binaries to Git, `public/`, `dist/`, or release ZIP.
- Keep Live2D disabled by default and lazily loaded.
- Preserve session-only IP greeting behavior and existing ambient effects.

### Task 1: Update model URL policy and settings

**Files:**
- Modify: `src/stores/app.ts`
- Modify: `src/utils/live2dCompanion.ts`
- Modify: `komari-theme.json`
- Test: `tests/live2d-settings.test.mjs`
- Test: `tests/live2d-companion-core.test.mjs`

- [x] Add failing assertions for `/live2d-model/model.model3.json` default, same-origin `/live2d-model/` acceptance, legacy `/live2d/` acceptance, and cross-origin rejection.
- [x] Update store normalization and resolver to use the new default and allow only same-origin model URLs ending in `.model3.json`; retain legacy `/live2d/` compatibility.
- [x] Update manifest label/help to explain independent model hosting and new default.
- [x] Run the focused tests and confirm they pass.

### Task 2: Remove model payload from the theme package and document deployment

**Files:**
- Delete: `public/live2d/model/README.txt`
- Modify: `README.md`
- Modify: `tests/live2d-release-contract.test.mjs`

- [x] Change README instructions to place model files in a persistent same-origin `/live2d-model/` directory and configure the entry URL.
- [x] Replace release contract assertions so runtime notices remain required while the packaged model directory is absent.
- [x] Run the release contract test.

### Task 3: Verify integration and release behavior

**Files:**
- No source changes unless a failing contract exposes a mismatch.

- [x] Run `pnpm test:unit`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm build` and inspect the generated ZIP for runtime assets, manifest, preview, and no model binaries.
- [x] Run `pnpm exec vue-tsc --build` if not covered by build.
- [x] Review `git diff` for backend changes and confirm only theme/docs/tests are modified.
