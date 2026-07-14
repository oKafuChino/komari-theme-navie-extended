# Komari Naive Extended Ambient Effects Design

## Summary

Build `Komari Naive Extended` from the current Komari Naive upstream theme and add two ambient effects across all public monitor routes:

1. Sakura petals falling behind the monitor content.
2. A falling starlight trail following mouse movement above the content.

The selected visual direction is **Balanced**: visible depth and soft glow without obscuring monitoring data. Runtime work stays entirely in the visitor's browser. The Komari host only serves the additional static JavaScript and performs no ongoing animation work.

## Baseline And Theme Identity

- Upstream repository: `https://github.com/lyimoexiao/komari-theme-naive`
- Baseline branch and commit: `master` at `57e9f66fbd90ab495864e38b9c25cb032f314443`
- Import strategy: retain upstream Git history and configure the repository for later upstream synchronization.
- Preserve the upstream MIT license and attribution.
- Theme name: `Komari Naive Extended`
- Theme short identifier: `NaiveExtended`
- Theme version: `1.0.0`
- Theme author metadata: `lyimoexiao & oKafuChino`
- Theme URL: `https://github.com/oKafuChino/komari-theme-navie-extended`
- Package name: `komari-theme-naive-extended`
- Build artifact: `komari-theme-naive-extended-build-<sha>.zip`

The artifact must continue to contain `dist/`, `komari-theme.json`, and `preview.png` in the layout required by Komari. The release preview should be refreshed from the verified Extended UI after implementation.

## Scope

The effects cover both existing public routes:

- `/`
- `/instance/:id`

They do not run on Komari's built-in `/admin` or `/terminal` surfaces. This round does not add color, density, frame-rate, or advanced particle controls.

## Architecture

### App Integration

Mount one `AmbientEffects` component in `App.vue`, after the existing `Background` component. It lives in the global app shell rather than either route, so route changes do not recreate the engine or duplicate event listeners.

Create the effect layer only after application loading completes and at least one effect is enabled. The intended stack is:

1. Existing custom image, video, or default background.
2. Fixed sakura Canvas.
3. A positioned application content layer containing Header, routed content, and Footer.
4. Fixed starlight Canvas with `pointer-events: none`.
5. Loading UI, Naive UI dialogs, notifications, modals, and the existing back-to-top control.

The starlight layer is visual only and must never intercept clicks, hover, selection, scrolling, or keyboard focus.

### Module Boundaries

`src/components/AmbientEffects.vue` owns:

- Vue mount and unmount lifecycle.
- Store-derived enable state.
- Pointer and visibility listeners.
- Fine-pointer and reduced-motion media queries.
- Canvas element creation and removal.
- Passing normalized runtime options to the renderer.

`src/utils/ambientEffects.ts` owns:

- Canvas sizing and backing-store limits.
- Particle state and reusable pools.
- Sakura and starlight drawing.
- Frame-rate limiting and the single animation scheduler.
- Start, pause, resume, resize, option update, and destroy operations.

`src/stores/app.ts` owns defensive parsing of the two public theme settings. `komari-theme.json` owns their managed configuration declarations.

No runtime animation dependency is added.

## Configuration

Add a `页面特效` section to the managed theme settings:

| Key | Label | Type | Default |
| --- | --- | --- | --- |
| `sakuraEnabled` | 启用樱花飘落 | `switch` | `true` |
| `cursorTrailEnabled` | 启用鼠标星轨 | `switch` | `true` |

The app store accepts only Boolean values. Missing or invalid values fall back to `true`, matching the manifest defaults. Each effect can be disabled independently.

Canvas creation follows the active settings:

- Both enabled: two Canvas elements and one scheduler.
- Only one enabled: one Canvas element and one scheduler, with no unused graphics context.
- Both disabled: no Canvas, pointer listener, scheduler, or particle state.

## Visual Design

### Sakura

- Draw petals procedurally with Canvas paths; do not load image assets.
- Use two or three low-saturation pink tones with light/dark-mode-specific alpha.
- Vary size, opacity, fall speed, rotation, and horizontal sway to create depth.
- Keep movement slow and avoid large opaque petals over text.
- Use approximately 18-32 active petals on desktop, derived from viewport area.
- Use approximately 8-14 active petals on touch devices.

### Starlight Trail

- Use small four-point stars in warm white and pale gold.
- Sample the latest pointer position from the animation loop instead of allocating particles in every `pointermove` event.
- Emit only after a minimum movement distance so a stationary pointer creates nothing.
- Let stars continue falling under light gravity and fade within approximately 450-700 ms.
- Limit glow radius and adapt opacity for light and dark modes.
- Hard-cap the reusable star pool at 72 particles.

Theme-mode changes update colors in place and do not recreate the engine.

## Runtime And Performance Rules

Use `(hover: hover) and (pointer: fine)` to identify the full desktop interaction profile.

### Desktop Profile

- Sakura and cursor trail may both run.
- Maximum render rate: 60 FPS, including on high-refresh displays.
- Do not lower the cap based on `hardwareConcurrency`, device memory, or other low-end hardware heuristics.

### Touch Profile

- Run reduced-density sakura only.
- Do not register the pointer-trail listener.
- Maximum render rate: 30 FPS.

### Universal Safeguards

- When `prefers-reduced-motion: reduce` matches, create no active animation loop or Canvas.
- Pause the scheduler while `document.hidden` is true.
- Reset timing on resume so particles do not jump after a hidden interval.
- Limit effective device pixel ratio to 1.5.
- Also cap each Canvas backing store at 2,100,000 pixels. Compute an effective scale from both limits so 4K and Retina displays cannot allocate unbounded full-resolution buffers.
- Resize only when viewport dimensions or effective scale change.
- Use one `requestAnimationFrame` scheduler with elapsed-time gates for the selected 60 or 30 FPS cap.
- Reuse particle objects in fixed-capacity pools; do not create temporary arrays or DOM nodes per frame.
- A pointer handler records only the latest coordinates. Emission and drawing happen inside the scheduler.
- Destroy all animation handles, listeners, media-query subscriptions, contexts, and particle references on teardown.

These effects add no API calls, WebSockets, polling, server timers, or remote asset requests.

## Data Flow

1. Komari exposes managed values through `/api/public.theme_settings`.
2. The app store normalizes `sakuraEnabled` and `cursorTrailEnabled`.
3. `AmbientEffects` combines settings with pointer capability, reduced-motion state, visibility, theme mode, and viewport dimensions.
4. The component creates only the required Canvas elements and updates engine options without route-level remounting.
5. The engine samples pointer state, advances reusable particles, and renders both layers through one scheduled loop.

## Failure Handling

- If `getContext('2d')` fails for one Canvas, skip only that effect.
- Initialization failures produce at most one console warning and never start a retry loop.
- Zero-sized viewports defer rendering until a valid resize.
- Invalid theme configuration uses defaults.
- If drawing throws during a frame, stop the effect scheduler, remove the affected Canvas, and emit at most one warning.
- A renderer failure must not prevent Header, routes, charts, cards, Footer, or navigation from working.
- Every active Canvas is decorative, carries `aria-hidden="true"`, and does not enter the focus order.

There are no effect-specific network resources, so no loading placeholder or network retry behavior is required.

## Verification And Acceptance

### Repository Checks

- Run `pnpm lint`.
- Run the repository type check and complete `pnpm build`.
- Confirm the renamed ZIP is produced with the required Komari structure.
- Confirm `.superpowers/` is ignored and absent from the build and commit.
- Confirm the MIT license and upstream attribution remain present.

### Browser Matrix

Validate both `/` and `/instance/:id` at minimum in these states:

- Desktop 1440x900, light theme.
- Desktop 1440x900, dark theme.
- Desktop with a custom image or video background.
- Touch/mobile 390x844.
- `prefers-reduced-motion: reduce`.
- Each effect switch disabled independently, then both disabled.
- Canvas 2D context unavailable.

Use screenshots to check that petals remain behind monitoring content, stars remain visible without obscuring it, text does not overlap, and controls remain interactive.

### Lifecycle Checks

- Repeatedly navigate between home and instance detail.
- With both effects active, confirm exactly two Canvas elements and one scheduler remain.
- With one effect active, confirm exactly one Canvas remains.
- With both disabled or reduced motion enabled, confirm no active Canvas or scheduler remains.
- Hide and restore the page, confirming pause and clean resume.
- Confirm touch mode never registers or renders a cursor trail.

### Performance Checks

- Move the pointer continuously for 30 seconds and confirm the active star count never exceeds 72.
- Confirm Canvas and DOM counts do not grow over time.
- Confirm heap usage reaches a steady range after particle pools warm up.
- On the desktop reference environment at 1440x900, target effect-render work of `p95 <= 2 ms` per rendered frame.
- Confirm the effects do not introduce a repeated task longer than 50 ms.
- Confirm the touch profile is gated to 30 FPS and the desktop profile to 60 FPS.
- Confirm the production gzip bundle increase is no more than 12 KiB.
- Confirm there are no new runtime network requests beyond serving the built static assets.

## Out Of Scope

- Admin or terminal page customization.
- User-selectable particle density, colors, shapes, or FPS.
- WebGL, OffscreenCanvas workers, or third-party particle engines.
- Click or touch-triggered starlight.
- Server-side animation processing.
