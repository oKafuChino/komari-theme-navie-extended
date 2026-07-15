# Release Readiness Refactor Design

## Goal

Prepare Komari Naive Extended for release by fixing verified release defects,
hardening public configuration rendering, clarifying internal ownership, and
rewriting the user documentation without breaking installed themes.

## Compatibility Contract

- Minimum supported server version is Komari 1.2.6.
- Live2D model entries accept only
  `/themes/komari-live2d-models/dist/model/*.model3.json`.
- The legacy `/theme/` route is not supported or documented.
- Existing managed configuration keys, their defaults, and public
  `theme_settings` values remain compatible.
- Three-network snapshots remain `version: 1` with the existing 93-value
  ordering.
- The two package names and ZIP structures remain unchanged:
  `komari-theme-naive-extended-build-<sha>.zip` and
  `komari-live2d-model-pack-template.zip`.
- The independent Live2D resource theme remains
  `komari-live2d-models`; existing user models are never included in the main
  theme package.

## Architecture

### Theme Settings

Move pure parsing, validation, defaulting, and CSS-safe value normalization
out of `src/stores/app.ts` into focused utilities. The Pinia store retains its
current public computed properties so components and stored settings do not
need a migration.

The settings utilities own these responsibilities:

- Validate managed Boolean, number, select, JSON, URL, and CSS value inputs.
- Apply the manifest-compatible defaults for absent, malformed, or unsafe
  public settings.
- Reject URLs with unsafe schemes, embedded credentials, invalid syntax, or
  unsupported protocols before they reach anchors, image sources, or video
  sources.

### Public Rich Text

Extract the Markdown tokenizer and URL policy from `MarkdownRenderer.vue`.
The renderer remains a small presentation component that consumes typed tokens.
Text is rendered through Vue interpolation exactly once. Links and images use
the shared safe URL policy so `javascript:`, credential-bearing, and malformed
URLs cannot become public-page targets.

### Three-Network TCP Test

Keep the current externally observable contract: 93 fixed targets, a maximum
of 12 temporary tasks per batch, a first read after two seconds, one-second
polling through seven seconds, at most two rounds, immediate cleanup, and
public read-only snapshots.

Extract run coordination from `ThreeNetworkTcpLatency.vue` into a testable
unit. It owns cancellation, progressive batch state, failure accumulation,
snapshot persistence sequencing, and restoration of the last public snapshot
after errors. The component owns commands, progress text, and map input. The
map component remains render-only.

### Live2D Routing

Simplify Live2D model validation to the official `/themes/` route. The model
document reference validator continues to require all model assets to remain
inside the selected resource-pack model directory.

## Error Handling

- Malformed public settings fall back to their existing safe defaults.
- Unsafe announcement links and media are rendered as non-navigable content
  instead of being emitted as usable URLs.
- A failed three-network test cancels and cleans temporary tasks, retains the
  last persisted visitor snapshot, and presents an administrator-facing error.
- A failed map or Live2D asset remains isolated to its own feature and cannot
  block the monitor page.
- Release verification fails the build when a required ZIP entry is absent or
  the model template contains model assets.

## Build and Release

`vite.config.ts` continues to create both ZIP files directly in `release/`.
GitHub Actions uploads those exact files from `release/`, after unit tests and
the production build.

Komari's remote updater selects the first asset in a GitHub Release when a
theme manifest points to a repository URL. Because this repository publishes
two ZIP files, the release procedure must upload the primary theme ZIP first.
This is documented rather than automated because selecting a named release
asset requires a Komari server change outside this repository's scope.

## Documentation

Rewrite `README.md` for users rather than implementation history. It will
cover:

- Feature overview and supported Komari version.
- Main-theme and Live2D-model-template package roles and installation order.
- Standard `/themes/` Live2D model URL.
- Three-network TCP behavior, task bounds, and visitor privacy boundary.
- Residual-value currency source, cache, and external-request behavior.
- Build, test, lint, package verification, and release-asset ordering.

## Verification

The implementation must provide or update tests for:

- Official Live2D route acceptance and legacy route rejection.
- Theme-setting defaults and invalid-value fallbacks.
- Markdown and filing URL rejection plus normal HTTPS behavior.
- Three-network state coordination, cumulative failure progress, cancellation,
  and public snapshot preservation.
- CI artifact paths and actual ZIP package contents.
- README claims required for installation, compatibility, package roles, and
  release ordering.

Final release verification runs `pnpm test:unit`, `pnpm type-check`,
`pnpm lint`, `pnpm build`, the release-package verifier, and browser checks at
desktop and mobile viewports for the public monitor, instance detail, map,
and optional Live2D states.
