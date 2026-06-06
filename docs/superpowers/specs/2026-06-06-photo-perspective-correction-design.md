# Photo Perspective Correction + Front-Facing 3D View

## Summary

Enhance the existing photo-to-3D flow in `glbviewer.js`: after selecting exactly 3 wall-corner points on a photo, apply perspective correction to extract a distortion-free wall texture, and render the 3D space from a front-facing camera angle.

## Motivation

Currently `_prepareWallTexture()` does a simple axis-aligned crop of the photo region between markers. When the photo is taken at an angle, the wall texture appears skewed in the 3D scene. The `utils/perspective.js` module (DLT homography + warpPerspective) already exists but is unused. Additionally, the default 3D camera starts at a side angle (theta=0.3, phi=PI/4), but users want a straight-on view.

## Design

### 1. Marker flow: 3 points only (glbviewer.js)

- `onPhotoTap`: limit to exactly 3 markers (change `>= 4` to `>= 3`)
- `confirmSpace`: validate `markers.length === 3` instead of `>= 3`
- Marker order is enforced by hints: BL (ground-left) → BR (ground-right) → TL (top-left)
- The 4th corner TR is derived via `perspective.computeFourthPoint(BL, BR, TL)` using the parallelogram approximation
- Corner type auto-detection (`_updateCornerType`) keeps the existing cross-product logic
- Hint text in WXML updated to reflect 3-point requirement

### 2. Perspective-corrected texture (glbviewer.js `_prepareWallTexture`)

Replace the simple axis-aligned crop with `perspective.warpPerspective()`:

- Convert 4 marker points (BL, BR, derived-TR, TL) from proportional coordinates [0-1] to pixel coordinates
- Call `warpPerspective(ctx, img, srcQuad, 512, 512)` which:
  - Computes DLT homography from output rect → source quad
  - Inverts the homography
  - Subdivides the 512×512 output into 32px cells
  - Draws each source cell region to the corresponding output cell (affine approximation per cell)
- Fallback: if warpPerspective fails (degenerate quad), fill with solid gray and continue

### 3. Front-facing camera (threeScene.js)

Change initial camera parameters and `resetCamera()`:

| Parameter | Before | After |
|-----------|--------|-------|
| theta | 0.3 | 0 |
| phi | PI/4 (0.785) | 0.01 |
| radius | max(w,h) * 1.6 | max(w,h) * 1.2 |

- theta=0, phi≈0 places the camera directly in front of the back wall
- phi=0.01 avoids degenerate lookAt (phi=0 would put the camera exactly at target.y)
- Radius reduced slightly since front-facing doesn't need the distance
- Orbit controls still work — user can rotate after initial view

### 4. Files changed

| File | Changes |
|------|---------|
| `pages/knowledge/glbviewer/glbviewer.js` | ~40 lines: marker limit, perspective warp in `_prepareWallTexture`, import perspective module |
| `pages/knowledge/glbviewer/glbviewer.wxml` | ~2 lines: hint text |
| `utils/threeScene.js` | ~4 lines: camera initial parameters |

`utils/perspective.js` — no changes, used as-is.

## Edge cases

- **Degenerate quad** (3 collinear points): `computeHomography` returns null, fallback to solid gray texture
- **Texture prep canvas not ready**: existing fallback already passes `null` to `init()`, which uses solid gray material
- **Very wide wall, narrow photo**: markers within 0-1 proportional space always produce valid pixel coords after clamping
