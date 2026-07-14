# Live2D Viewport Scale Fix Design

## Problem

`live2dScale` currently enlarges the Live2D model inside a fixed-size Canvas. At
150%, the model extends beyond the Canvas bitmap and only part of the character
is visible. The visible and interactive area does not follow the configured
scale.

## Approved Behavior

The scale setting controls the complete companion viewport:

- 50% produces a viewport and model footprint at half of the 100% baseline.
- 100% preserves the current baseline dimensions.
- 150% produces a viewport and model footprint at 1.5 times the baseline.
- The Canvas, visible area, and pointer/keyboard interaction area use the same
  dimensions.
- The speech bubble and close button keep their existing control sizes and stay
  anchored to the scaled companion viewport.
- Desktop and mobile continue using their existing responsive baselines, with
  each baseline multiplied by the validated `50-150` scale.

## Architecture

Scaling becomes a component layout responsibility. `Live2DCompanion.vue`
derives responsive CSS custom-property values from the normalized store scale
and applies them to the companion root. The desktop and mobile CSS rules consume
those values for width, height, and maximum height.

The renderer no longer multiplies the fitted model by the administrator scale.
It fits the model once into the measured Canvas bounds. This avoids applying the
same scale in both viewport layout and model geometry.

No Komari API, backend, persistence, model format, frame-rate policy, or release
layout changes are included.

## Responsive Dimensions

At 100%, preserve the existing values:

- Desktop width: `clamp(220px, 22vw, 320px)`
- Desktop height: `min(42vh, 440px)`
- Mobile width: `min(42vw, 190px)`
- Mobile height: `min(32vh, 300px)`

Each numeric component is multiplied by `live2dScale / 100` before it is exposed
as a CSS custom property. This avoids relying on unsupported CSS multiplication
syntax and keeps layout responsive.

## Failure And Performance Behavior

Scaling changes only when managed theme settings change. It adds no animation,
timer, observer, network request, or per-frame calculation. The existing resize
path updates the Pixi renderer from the newly measured viewport. Invalid scale
values continue to normalize to 100 and valid values remain clamped to 50-150.

## Testing

Add regression coverage that proves:

- 50%, 100%, and 150% produce proportional desktop and mobile viewport values.
- The component binds the derived viewport values to its root element.
- The renderer fit calculation no longer multiplies by the administrator scale.
- Runtime resize still updates the Canvas backing size and preserves the DPR cap.
- Existing lifecycle, lazy-loading, privacy, lint, type-check, build, and ZIP
  checks continue to pass.

## Acceptance Criteria

At 150%, the full character remains inside a viewport that is 1.5 times the 100%
baseline, without clipping caused by the old fixed Canvas. At 50% and 100%, the
viewport and model remain proportional and fully interactive.
