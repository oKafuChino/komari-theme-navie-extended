# Komari Naive Extended Live2D Companion Design

## Summary

Add an optional Live2D companion to the lower-left corner of every public Komari monitor route. A theme administrator supplies one Cubism 3 or 4 model inside the release ZIP, and every visitor sees that same model. The companion welcomes a visitor once per browser session using the visitor's public IP, shows one of two messages when activated, and can be hidden for the remainder of the session.

All rendering and interaction work stays in the visitor's browser. This feature does not add or modify Komari backend code, APIs, database state, server processes, or server timers. The host only serves static runtime and model files.

The selected technical direction is a lazily loaded WebGL renderer built from a pinned, compatible PixiJS and Live2D display pair. The selected visual direction is a lower-left model with a floating translucent speech bubble above it.

## Goals

- Let an administrator package a Cubism 3 or 4 model with the theme without rebuilding the frontend.
- Keep all Live2D code and model traffic out of the initial page path when the feature is disabled.
- Welcome each visitor at most once per browser session without persisting the IP address.
- Provide the two approved click messages and a session-only close action.
- Keep the companion attractive, responsive, accessible, and subordinate to monitoring data.
- Minimize host CPU and memory use by performing no server-side work.
- Bound visitor frame rate, Canvas resolution, listeners, timers, and renderer lifetime.

## Non-Goals

- A Komari admin upload API or model-management backend.
- A model upload control inside the public theme.
- Per-visitor model selection.
- Cubism 2 `.model.json` support.
- Audio, lip sync, chat, drag-and-drop positioning, model editing, or texture conversion.
- Persisting the close state beyond the current browser session.
- Persisting, logging, or sending the visitor IP to Komari.
- Shipping the provided XFZN model or any other character artwork in the repository or release.

## Scope And Routes

The companion appears on the two Vue routes owned by this theme:

- `/`
- `/instance/:id`

It does not appear on Komari's backend-owned `/admin` or `/terminal` pages. Mounting happens in the global Vue app shell so navigating between the two public routes does not reload the model, repeat the welcome, or create another renderer.

## Architecture

### App Integration

Mount one `Live2DCompanion` component in `src/App.vue` after application loading completes. The component remains independent of `AmbientEffects`; one feature failing or being disabled must not affect the other.

The intended visual stack is:

1. Existing background.
2. Sakura Canvas at `z-index: 0`.
3. Application content at `z-index: 1`, including the sticky header at `z-index: 10`.
4. Live2D companion at `z-index: 15`.
5. Existing starlight trail at `z-index: 20` with `pointer-events: none`.
6. Naive UI dialogs, notifications, loading UI, and modals above the theme layers.

The companion is created only when all of these are true:

- Initial public settings loading has completed.
- `live2dEnabled` is `true`.
- The current session has not hidden the companion.
- The browser exposes the required Canvas and WebGL capabilities.

### Module Boundaries

`src/components/Live2DCompanion.vue` owns:

- Vue mount and unmount lifecycle.
- Media-query, visibility, pointer, keyboard, and close interactions.
- The fixed responsive wrapper, speech bubble, and close button.
- Coordinating model readiness with the welcome flow.
- Mapping app-store settings into the runtime controller.

`src/utils/live2dCompanion.ts` owns framework-independent policy:

- Runtime profile selection and frame-rate targets.
- Scale clamping.
- Same-origin model and resource-path validation.
- Session flag access with an in-memory fallback.
- IP response validation and welcome-message construction.
- Random click-message selection.

`src/utils/live2dRuntime.ts` owns the renderer adapter:

- Loading the packaged Cubism Core only when enabled.
- Dynamically importing the pinned PixiJS and Live2D display libraries.
- Fetching and validating the entry `.model3.json` before renderer creation.
- Creating, fitting, updating, pausing, resuming, and destroying the model.
- Applying active, idle, hidden, and reduced-motion frame policies.
- Publishing read-only diagnostics in development builds only.

`src/stores/app.ts` owns defensive normalization of the managed theme settings. `komari-theme.json` owns the configuration schema. `src/types/global.d.ts` is updated only if development diagnostics require a typed window property.

### Runtime Dependencies

Use a pinned, mutually compatible `pixi.js` and `pixi-live2d-display` pair. Both must be imported through the runtime adapter so Vite emits a separate lazy chunk; they must not enter the initial Vue vendor chunk.

Cubism Core is loaded from a packaged same-origin static asset, never from a runtime CDN. The implementation must obtain it from the official Cubism SDK distribution, record the source version, retain all required notices, and include the applicable third-party license terms. Cubism Core must not be represented as MIT-licensed project code. Release distribution must satisfy the official redistribution terms before the Core file is committed or published.

The provided XFZN model is an implementation test fixture outside the repository only. Its model files, icon, and texture must never be copied into Git history, `public/`, `dist/`, or a release ZIP.

## Managed Configuration

Add a `Live2D 看板娘` section to `komari-theme.json`:

| Key | Label | Type | Default | Validation |
| --- | --- | --- | --- | --- |
| `live2dEnabled` | 启用 Live2D 看板娘 | `switch` | `false` | Boolean only |
| `live2dModelPath` | Live2D 模型入口 | `string` | `/live2d/model/model.model3.json` | Same-origin path below `/live2d/`, ending in `.model3.json` |
| `live2dScale` | Live2D 显示缩放 | `number` | `100` | Finite number clamped to `50-150` |

Missing or invalid settings use these defaults. The disabled default ensures the stock release makes no model or Live2D runtime request when an administrator has not installed a model.

No greeting text, click-message editor, frame-rate control, position control, or IP storage option is added in this round.

## Model And Release Contract

### Supported Model Layout

The theme supports Cubism 3 and Cubism 4 `.model3.json` entry files. A model may reference `.moc3`, textures, physics, pose, display information, user data, expressions, and motions using relative paths declared by the model.

The release reserves this structure under the existing `dist/` tree:

```text
dist/
  live2d/
    runtime/
      live2dcubismcore.min.js
    model/
      README.txt
```

`README.txt` explains the administrator workflow and texture-memory recommendation. It is informational and does not contain a model.

### Administrator Workflow

1. Download and extract the theme release ZIP.
2. Copy the complete model directory into `dist/live2d/model/`, preserving every relative path used by `.model3.json`.
3. Recompress the original root entries: `dist/`, `komari-theme.json`, and `preview.png`. Do not introduce an extra parent directory.
4. Upload the ZIP to Komari.
5. Enable the companion in managed theme settings and set the entry path, for example `/live2d/model/XFZN.model3.json`.

The existing build artifact name, root manifest name, packaged preview name, and Komari ZIP layout remain unchanged.

### Resource Validation

Before creating the renderer, fetch the entry JSON and validate the known Cubism file-reference fields. The entry path and every referenced resource must:

- Resolve against the current page origin.
- Remain below `/live2d/`.
- Remain inside the selected model directory.
- Avoid `http:`, `https:`, protocol-relative, `data:`, `blob:`, and other external or executable schemes.
- Avoid normalized parent traversal outside the model directory.

Reject the model as a unit if required files or path rules fail. Optional missing motion or expression groups do not prevent a base model from displaying. The renderer must not start an automatic retry loop.

## Data And Interaction Flow

1. Komari returns managed theme settings through the existing `/api/public` flow.
2. The app store normalizes `live2dEnabled`, `live2dModelPath`, and `live2dScale`.
3. The global component checks the session-hidden flag and browser capabilities.
4. After the monitor UI becomes interactive, the component schedules runtime loading during browser idle time, with a bounded fallback delay so loading still occurs when `requestIdleCallback` is unavailable or never fires.
5. The runtime loads the same-origin Cubism Core, lazy renderer chunk, validated model entry, and referenced assets.
6. Only after model readiness does the component perform the one-time session welcome flow.
7. Route changes reuse the mounted component and renderer.
8. Close, unmount, or fatal renderer failure destroys all owned resources.

## Greeting And Session Privacy

### IP Lookup

Use one browser-side request to:

```text
https://api64.ipify.org?format=json
```

The request occurs only after a model has loaded successfully and only if the current session has not completed a greeting attempt. It uses:

- `credentials: 'omit'`
- `referrerPolicy: 'no-referrer'`
- `cache: 'no-store'`
- An `AbortController` timeout of 2.5 seconds

The service response is accepted only when `ip` is a string of at most 64 characters containing an IPv4- or IPv6-compatible character set. The value is rendered through Vue text interpolation, never `v-html`.

On success, display:

```text
欢迎来自 [IP地址] 的朋友
```

The brackets describe substitution and are not displayed. For example: `欢迎来自 203.0.113.8 的朋友`.

On timeout, network failure, invalid JSON, or an invalid address, display:

```text
欢迎远道而来的朋友
```

The repository README must disclose that the optional feature queries ipify and that the third-party provider necessarily receives the visitor's public IP. The theme and Komari do not persist or log it.

### Session State

Use `sessionStorage` for two Boolean sentinels:

- `komari-naive-extended:live2d:greeted`
- `komari-naive-extended:live2d:hidden`

The IP address itself is never written to `sessionStorage`, `localStorage`, cookies, IndexedDB, Pinia persistence, logs, or Komari. Set the greeted sentinel after either the success or fallback greeting attempt so route changes and reloads do not repeat the external request in that session.

Wrap storage access because browsers may reject storage in privacy modes. When storage is unavailable, use module-level in-memory sentinels so the current page lifetime still behaves correctly without breaking the monitor UI.

### Model Activation

Activating the model with a pointer click, `Enter`, or `Space` randomly selects one message:

- `喵喵喵？不要随便摸我啦~`
- `请问...有什么可以帮忙的吗？`

Selection uses an injectable random source so unit tests are deterministic. A new message replaces the current message and resets one dismissal timer. The speech bubble fades after approximately four seconds; messages never stack and timers never accumulate.

### Closing

On a fine-pointer device, the close button fades in while the companion is hovered or keyboard focus is within it. On a touch device, the close button remains subtly visible because hover is unavailable.

Closing performs all of these operations synchronously where possible:

- Set the session-hidden sentinel.
- Cancel the speech timer, idle-load callback, active-window timer, and scheduled frames.
- Abort an in-flight IP or model-entry request.
- Stop and destroy the model, Pixi application, textures, ticker, and WebGL context.
- Remove owned listeners and Canvas nodes.
- Unmount the visible companion without affecting the page.

A new browser session may show the companion again.

## Visual And Responsive Design

Use the approved floating translucent bubble layout:

- Fix the companion to the lower-left corner with safe-area-aware inline and bottom offsets.
- Keep the model width between approximately `220px` and `320px` on desktop, with a maximum height of `42vh`.
- Keep the model width between approximately `150px` and `190px` on touch/mobile layouts, with a maximum height of `32vh`.
- Continue shrinking on exceptionally narrow or short viewports so neither model nor bubble leaves the viewport.
- Fit the model from its measured local bounds, align it to the bottom, and apply the validated administrator scale percentage.
- Place one bubble above the model, with a maximum width near `240px` and a viewport-width constraint.
- Use theme-aware semi-opaque color, a thin border, and a restrained shadow. Do not use a Canvas blur or filter.
- Keep text compact and readable; do not obscure the node page with explanatory UI.
- Use short opacity and transform transitions, disabled under reduced-motion preferences.

Use a circular icon button containing `i-lucide-x` for close. The model interaction region has an accessible name of `与看板娘互动`; the close button has `关闭看板娘`. The Canvas is hidden from assistive technology. The bubble uses `role="status"` and `aria-live="polite"` without moving focus.

## Runtime And Performance Rules

### Host Budget

The implementation adds no Komari endpoint, middleware, database field, upload handler, worker, process, timer, polling loop, or WebSocket. Host cost is limited to serving static files through the existing theme path.

The IP request goes directly from the visitor browser to ipify and never traverses Komari.

### Lazy Loading

- Disabled: do not fetch Cubism Core, the renderer chunk, model JSON, textures, or the IP service.
- Session hidden: do not load or initialize the renderer.
- Enabled: wait until the monitor first becomes interactive, then load during browser idle time.
- Do not preload the model from `index.html`.
- Let normal same-origin HTTP caching handle immutable model resources; add no service worker or custom cache.

### Frame Profiles

Use `(hover: hover) and (pointer: fine)` for the desktop profile.

Desktop:

- Maximum active rate: 60 FPS.
- Idle rate: 15 FPS.
- Enter idle five seconds after the latest initialization, model activation, pointer interaction, or declared model motion activity.

Touch/mobile:

- Maximum active rate: 24 FPS.
- Idle rate: 12 FPS.
- Enter idle five seconds after the latest initialization or touch activation.

Universal:

- While `document.hidden` is true, pause at 0 FPS and reset timing before resume.
- Under `prefers-reduced-motion: reduce`, render a static first frame only. Speech and close interactions still work without animated transitions.
- Existing ambient effects retain their separately approved 60 FPS desktop and 30 FPS touch profiles.

### Renderer Limits

- Use one transparent WebGL Canvas owned by the companion.
- Cap effective device pixel ratio at 1.5.
- Size the backing store from the bounded companion viewport, not the full screen.
- Disable antialiasing, preserve-drawing-buffer, and unnecessary Pixi filters.
- Request a low-power WebGL preference where supported.
- Avoid per-frame DOM writes and object allocation in theme-owned code.
- Use one renderer ticker with elapsed-time gates for active and idle caps.
- Do not add a worker or OffscreenCanvas path in this round.

The provided XFZN texture is 4096 by 4096 and approximately 6.47 MiB compressed, but its decoded RGBA texture is approximately 64 MiB. The model preparation guide recommends 2048 textures for this display size, reducing decoded texture memory to approximately 16 MiB with little visible loss at 200-320 CSS pixels. The theme does not modify administrator model files automatically.

## Failure Handling

Failures are isolated and silent in the visible interface:

- Invalid configuration falls back to documented defaults.
- Unsupported WebGL, a missing Core runtime, invalid model paths, malformed JSON, missing required assets, or renderer creation errors hide the companion.
- IP errors use the generic welcome and do not affect the model.
- Optional missing motions or expressions leave the available base model running.
- Emit at most one concise console warning per failed initialization category.
- Start no automatic retry loop.
- Never display a broken Canvas, loading card, stack trace, modal, notification, or repeated toast.
- A companion failure must not prevent Header, routes, cards, lists, charts, Footer, ambient effects, login, or navigation from working.

Teardown must be idempotent so close, route-shell destruction, hot reload, and partial initialization can safely call it more than once.

## Testing Strategy

### Unit Tests

Use the repository's Node test runner and Vite SSR module loading, matching the ambient-effects tests. Keep policy logic independent from the real renderer and inject fetch, timers, random values, frame scheduling, storage, and runtime adapters.

Cover at minimum:

- Desktop active 60 FPS and idle 15 FPS.
- Touch active 24 FPS and idle 12 FPS.
- Five-second active-to-idle transition.
- Hidden-page pause, clean resume, and reduced-motion static mode.
- Scale defaulting and `50-150` clamping.
- Entry and nested model-reference path validation, including encoded traversal and remote schemes.
- Both deterministic click-message branches.
- One replaceable speech timeout rather than accumulating timers.
- Valid IP, timeout, abort, network failure, invalid JSON, invalid characters, and overlong response handling.
- Session greeting once, session close, storage failure fallback, and proof that no IP value is persisted.
- Disabled and hidden states performing no runtime or network load.
- Partial initialization failure and idempotent complete destruction.

### Contract Tests

Add source and manifest contract tests that verify:

- Exactly one global companion mount in `App.vue`.
- The three managed settings and their defaults.
- Lazy runtime imports rather than eager bootstrap imports.
- `aria-live`, interaction labeling, keyboard activation, and the Lucide close icon.
- The public model README and packaged runtime path exist in the production build.
- No XFZN filename or supplied character asset enters tracked or packaged files.
- Existing release ZIP naming and root layout remain unchanged.

### Browser Verification

Use the supplied XFZN directory only as a local, untracked model during manual verification. Validate:

- `/` and `/instance/:id` without renderer duplication.
- Desktop 1440x900 in light and dark themes.
- Touch/mobile 390x844 in light and dark themes.
- Custom background enabled.
- `prefers-reduced-motion: reduce`.
- Successful IP greeting and forced IP failure fallback.
- Both click messages.
- Hover/focus close behavior on desktop and visible close behavior on touch.
- Reload and route navigation after greeting.
- Reload after session close, followed by a new browser-session recovery.
- Missing model, malformed entry JSON, missing texture, unavailable WebGL, and unavailable storage.
- No incoherent overlap with header, footer, cards, charts, ambient effects, or modals.

### Performance And Lifecycle Acceptance

- With `live2dEnabled: false`, the browser requests no Live2D runtime, model, or IP resource.
- Development diagnostics report the approved target profile and paused state without existing in production.
- The desktop controller never exceeds 60 active or 15 idle updates per second.
- The touch controller never exceeds 24 active or 12 idle updates per second.
- Background and reduced-motion states follow their specified zero/static behavior.
- Repeated route changes retain one Canvas and one runtime instance.
- Close removes the Canvas and leaves no pending frame, timer, fetch, media-query callback, visibility listener, or WebGL context.
- Repeated mount/destroy cycles do not grow Canvas count or retain runtime instances.
- Model load is deferred until after the monitor is interactive.
- Large model textures are documented as administrator-controlled memory, not hidden by compressed file size.

### Repository Verification

Run from the repository root:

```bash
pnpm test:unit
pnpm lint
pnpm build
```

Inspect the generated `komari-theme-naive-extended-build-<sha>.zip` and confirm it contains `dist/`, `komari-theme.json`, and `preview.png` at the established locations, plus the expected `dist/live2d/` runtime and model instructions. Existing ambient-effects tests and behavior must continue to pass unchanged.

## Acceptance Criteria

The feature is complete when:

- An administrator can add a supported model to the extracted release, rezip it, configure its entry path, and display it without rebuilding or changing Komari backend files.
- A visitor receives the approved IP-specific or generic welcome once per session.
- Pointer and keyboard activation select only the two approved messages.
- The close affordance follows desktop and touch rules and hides the fully destroyed companion for the current session.
- Disabled, failed, background, reduced-motion, active, and idle states follow the approved load and frame budgets.
- The model, greeting, and bubble remain visually subordinate to monitor data across the verification matrix.
- IP addresses are never persisted by the theme or Komari.
- All repository checks pass and the release ZIP contract remains intact.
