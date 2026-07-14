# Release Directory Design

## Goal

Store all locally generated theme release ZIP files under a repository-root `release/` directory, keep that directory out of Git, and make CI upload the same location.

## Output Contract

Every production build creates `release/` when it is absent and writes these artifacts directly into it:

```text
release/komari-theme-naive-extended-build-<sha>.zip
release/komari-live2d-model-pack-template.zip
```

The ZIP contents and filenames remain unchanged. Only the on-disk output directory changes.

## Lifecycle

- `release/` is a local build-output directory and is ignored by Git.
- Main-theme ZIPs are hash-named and accumulate so previous local builds remain available.
- The fixed-name model-pack template ZIP is replaced on every successful build.
- The build plugin creates `release/` recursively before opening either output file.
- Existing root-level ZIP artifacts are moved into `release/`; they are not copied.

## CI And Tests

- GitHub Actions uploads the two ZIP patterns from `release/`.
- Contract tests require `vite.config.ts` to resolve outputs through `release/` and require CI to upload from that directory.
- Production build verification confirms both files exist under `release/` and no newly generated ZIP is left at the repository root.

## Non-Goals

- Do not version release ZIPs in Git.
- Do not alter ZIP contents, Komari manifests, release filenames, the model-pack template source, or runtime behavior.
- Do not add release automation, remote publishing, or deletion of previous hash-named artifacts.
