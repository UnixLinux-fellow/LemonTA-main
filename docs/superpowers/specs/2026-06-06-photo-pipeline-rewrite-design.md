# Photo-to-3D Pipeline Rewrite

## Summary

Extract the photo-to-3D flow from the overloaded `glbviewer.js` (1565 lines, handles GLB preview + photo space + 3D scene + cabinet layout) into a dedicated page `pages/knowledge/photo/photo` backed by two new utility modules. The pipeline uses perspective-corrected texture extraction and full room reconstruction for a more realistic 3D space.

## Motivation

The current photo-to-3D pipeline in `glbviewer.js` has these problems:
- `glbviewer.js` does too many things (GLB viewer, photo space, 3D scene, cabinet layout) — 1565 lines
- The `mode`/`spaceStage` nested state machine is confusing
- Texture extraction is axis-aligned crop, not perspective-corrected
- 3D room uses solid colors for floor/side walls
- Three Canvas lifecycles tangled in one page

## Architecture

### New files

| File | Responsibility |
|------|---------------|
| `pages/knowledge/photo/photo.js` | Page logic: 4-stage state machine, UI event handlers |
| `pages/knowledge/photo/photo.wxml` | Template: photo view, marker overlay, parameter form, 3D canvas |
| `pages/knowledge/photo/photo.wxss` | Styles |
| `utils/roomReconstructor.js` | Photo analysis engine: geometry computation, texture warping, color sampling |
| `utils/roomScene.js` | Enhanced 3D room scene: textured walls/floor, PBR materials, better lighting |

### Modified files

| File | Change |
|------|--------|
| `pages/knowledge/glbviewer/glbviewer.js` | Remove photo space / space3d mode code (~600 lines removed). "拍照解析空间" button navigates to new page |
| `pages/knowledge/glbviewer/glbviewer.wxml` | Remove space mode / space3d mode templates. Remove texture prep canvas |
| `app.json` | Register new page path in subPackages or pages array |

### Unchanged files

- `utils/perspective.js` — used as-is by roomReconstructor
- `utils/threejs-miniprogram.js` — used as-is by roomScene
- `utils/layoutCompute.js` — used as-is for module selection
- `utils/assets.js` — used as-is for cabinet images

### Data flow

```
┌──────────┐    ┌───────────────────┐    ┌──────────────┐
│  photo.js │───▶│ roomReconstructor │───▶│  roomScene   │
│  (page)   │    │  .computeGeometry │    │  .init()     │
│           │    │  .extractWall*    │    │  .animate()  │
│ 4 stages  │    │  .sampleSideColor │    │  .resetCam() │
└──────────┘    └───────────────────┘    └──────────────┘
```

---

## Module 1: `utils/roomReconstructor.js`

Pure computation module. No Canvas lifecycle management — caller provides Canvas context and loaded Image.

### Exports

```js
{
  computeGeometry: function(markers, photoW, photoH) → geo,
  extractWallTexture: function(ctx, img, wallQuad, outW, outH) → boolean,
  extractFloorTexture: function(ctx, img, floorQuad, outW, outH) → boolean,
  sampleSideColor: function(wallQuad, img) → hexColorString
}
```

### `computeGeometry(markers, photoW, photoH)`

Input: 3 markers in proportional coords `[{x, y}, ...]`, photo pixel dimensions.
Returns:

```js
{
  wallQuad: [{x, y}, {x, y}, {x, y}, {x, y}],  // pixel coords, order: BL, BR, TR, TL
  floorQuad: [{x,y},{x,y},{x,y},{x,y}] | null,   // estimated floor region in pixels
  aspectRatio: Number,   // wall height / width, derived from quad geometry
  cornerType: 'none' | 'left' | 'right'
}
```

Algorithm:
1. Sort markers by y descending → groundA, groundB (bottom), topMarker (top)
2. Sort ground by x → BL (left), BR (right)
3. Midpoint comparison → topMarker is TL or TR
4. Derive missing 4th corner via `perspective.computeFourthPoint`
5. Aspect ratio: (leftEdgeLen + rightEdgeLen) / (topEdgeLen + bottomEdgeLen) * (outH/outW), clamped to [0.5, 3.0]
6. Cross product of (BR-BL) × (top-BR) → cornerType
7. `perspective.estimateFloorQuad(wallQuad, photoW, photoH, depthRatio, wallWidth)` → floorQuad

### `extractWallTexture(ctx, img, wallQuad, 512, 512)`

Calls `perspective.warpPerspective(ctx, img, wallQuad, 512, 512)`. Returns false and fills gray on failure.

### `extractFloorTexture(ctx, img, floorQuad, 512, 256)`

Same as wall but for floor region. Width=512, height=256 (floor is typically wider than deep in the photo).

### `sampleSideColor(wallQuad, img)`

Samples a thin column (2px wide) from each vertical edge of the wall quad in the photo. Averages the pixels, returns a hex string like `'#d4c8b8'`. Left edge → left side wall color, right edge → right side wall color. Returns `{ left: '#...', right: '#...' }`.

---

## Module 2: `utils/roomScene.js`

Enhanced 3D room scene manager. Based on `threeScene.js` patterns but rewritten with:

### Constructor / init

```js
var mgr = createSceneManager(canvas, THREE);
mgr.init({
  wallWidth: Number,     // meters
  wallHeight: Number,    // meters
  roomDepth: Number,     // meters
  cornerType: String,    // 'none' | 'left' | 'right' | 'both'
  wallTexture: Canvas,   // 512x512 canvas with perspective-corrected wall
  floorTexture: Canvas || null,  // optional floor texture
  sideColors: { left: '#...', right: '#...' },
  modules: Array         // initial cabinet modules
});
```

### Scene construction

| Element | Material |
|---------|----------|
| Back wall | CanvasTexture from wallTexture |
| Left wall | MeshStandardMaterial with sideColors.left |
| Right wall | MeshStandardMaterial with sideColors.right |
| Floor | CanvasTexture from floorTexture, or solid `#3a3530` |
| Ceiling | MeshStandardMaterial `#f0ece6` |
| Corner walls | Same as adjacent side wall color |

### Lighting (improved over threeScene.js)

```js
// Ambient — base illumination
new THREE.AmbientLight(0xffffff, 0.4)

// Hemisphere — sky/ground gradient for natural feel
new THREE.HemisphereLight(0xffffff, 0x444444, 0.3)

// Key light — main directional
new THREE.DirectionalLight(0xffffff, 0.6)
// positioned front-top-right

// Fill light — softens shadows
new THREE.DirectionalLight(0xffffff, 0.2)
// positioned front-left
```

### Cabinet materials (PBR)

```js
// White cabinet
new THREE.MeshStandardMaterial({
  color: 0xf5f5f5,
  roughness: 0.45,
  metalness: 0.05
})

// Cream cabinet
new THREE.MeshStandardMaterial({
  color: 0xfff5d7,
  roughness: 0.45,
  metalness: 0.05
})
```

### Camera

- Default: theta=0, phi=0.01 (front-facing wall view)
- `resetCamera()` resets to front-facing
- Orbit controls: single-finger rotate, two-finger pinch zoom (same as threeScene.js)
- `updateRoomDepth(newDepthMeters)` — adjusts room geometry and repositions camera target

### Public methods

```
init(config), dispose()
refreshCabinets(modules), highlightCabinet(idx), clearHighlight()
hitTest(x, y) → { hitType, moduleIndex, posCm } | null
resetCamera(), updateRoomDepth(meters), updateWallSize(wMeters, hMeters)
handleTouchStart(t), handleTouchMove(t), handleTouchEnd(t) → wasTap
animate()
```

---

## Module 3: `pages/knowledge/photo/photo.js`

### 4-stage state machine

```
capture → marking → estimate → scene
                                ↺ estimate (返回调整)
```

### Stage 1: `capture`

- `onLoad`: init nav bar height
- "拍照" button → `wx.chooseMedia({ count:1, mediaType:['image'], sourceType:['album','camera'] })`
- Photo displayed via `<image mode="aspectFit">`
- `onPhotoLoad`: record photoWidth/photoHeight
- "确认照片" → enter `marking` stage
- "重选" → re-trigger chooseMedia

### Stage 2: `marking`

- 3-point marking overlay on photo (reuse marker UI pattern from glbviewer)
- Markers stored as `[{x, y}]` proportional coords (0-1)
- Tap to add (max 3), long-press+drag to move, tap existing to delete
- After 3 markers placed: "确认空间" button enabled
- `confirmMarkers()`:
  1. Call `roomReconstructor.computeGeometry(markers, photoW, photoH)`
  2. Store `geo.wallQuad`, `geo.floorQuad`, `geo.aspectRatio`, `geo.cornerType`
  3. Estimate wall dimensions from aspectRatio + user-friendly defaults
  4. Enter `estimate` stage
- "重新选图" → back to capture

### Stage 3: `estimate`

- Display estimated values in `<input>` fields + `<slider>`s:
  - Wall width (cm): default 300, range 44-1000
  - Wall height (cm): default width/aspectRatio, range 232-400
  - Room depth (cm): autoEstimated from floor quad depth, range 40-150
  - Corner type: shown as 4 tags (无/左/右/双侧), auto-selected, tappable to override
- Top-view outline preview (reuse `_drawTopView` pattern)
- "进入3D场景" button:
  1. Call `roomReconstructor.extractWallTexture()` and `extractFloorTexture()`
  2. Call `roomReconstructor.sampleSideColor()`
  3. Navigate to `scene` stage
- "返回标记" → back to marking

### Stage 4: `scene`

- Full-screen WebGL canvas via `roomScene.init({...})`
- Bottom panel: cabinet width + type + color selectors (reuse glbviewer pattern)
- Touch: tap wall to add cabinet, tap cabinet to select, long-press to delete
- "重置视角" → `roomScene.resetCamera()`
- "保存并算价" → app.saveDesign() → navigate to cost page
- "返回调整" → dispose roomScene → back to estimate
- "重新标记" → back to marking

### Data

```js
data: {
  stage: 'capture',        // capture | marking | estimate | scene
  statusBarHeight: 20,
  navBarHeight: 44,
  photoPath: '',
  photoWidth: 0,
  photoHeight: 0,
  markers: [],             // [{x, y}, ...]
  wallWidth: 300,          // cm
  wallHeight: 250,         // cm
  roomDepth: 60,           // cm
  cornerType: 'none',      // none | left | right | both
  // Cabinet layout (same as glbviewer)
  layoutModules: [],
  selectedWidth: 50,
  selectedType: 'a',
  selectedColor: 'white',
  isCustomModule: false,
  selectedModuleIndex: -1,
  availableModules: [],
  availableModulesCustom: [],
  customWidth: 0,
  standardWidth: 50
}
```

### Lifecycle

- `onUnload`: dispose roomScene if active
- Canvas initialization: type='webgl' with retry (up to 5, 300ms backoff)
- Hidden texture prep canvas: positioned offscreen, always in DOM

---

## Module 4: Cleanup of `glbviewer.js`

### Remove from glbviewer.js

- `startSpaceMode()` method
- `confirmSpace()` method
- `_initPhotoLayoutCanvas()`, `_loadPhotoImage()`, `_renderPhotoLayout()`
- `_calcWallRegion()`, `_drawCabinetsOnWall()`, `_drawOneCabinet()`
- `onPhotoLayoutTap()`, `onPhotoLayoutLongPress()`
- `_initSpace3d()`, `_prepareWallTexture()`
- `onSpace3dTouch()`, `_handleSpace3dTap()`
- `_updateCornerType()`, `_drawTopView()`, `_doDrawTopView()`
- `onPhotoTap()`, `onMarkerLongPress()`, `onMarkerDrag()`, `onMarkerDragEnd()`
- `onNextModule()` (space mode version if different)
- All space mode data fields: `mode`, `photoPath`, `photoWidth`, `photoHeight`, `markers`, `wallWidth`, `wallHeight`, `roomDepth`, `cornerType`, `draggingIndex`, `spaceStage`, `wallWidthNum`, `wallHeightNum`, `customWidth`, `layoutModules`, `availableModules`, `availableModulesCustom`, `selectedWidth`, `selectedType`, `selectedColor`, `isCustomModule`, `selectedModuleIndex`
- `goCost()` space mode logic
- `goDesign()`
- `goBackToMarking()`
- `reselectPhoto()`, `resetMarkers()`
- `onPhotoLoad()`, `onSpaceWidthInput()`, `onSpaceHeightInput()`, `onSpaceDepthInput()`
- `resetCamera3d()`
- `updateAvailableModules()`, `onSelectWidth()`, `onSelectType()`, `onSelectColor()`, `_updateSelectedModule()`

### Remove from glbviewer.wxml

- Space mode template (lines ~190-275: marking UI)
- Layout mode template (lines ~277-343: photo + cabinet overlay)
- Space3d mode template (lines ~345-414: 3D webgl canvas + cabinet panel)
- Texture prep canvas (lines ~417-419)

### Change in glbviewer

- "拍照解析空间" button → `wx.navigateTo({ url: '/pages/knowledge/photo/photo' })`
- Keep GLB viewer mode intact (idle, resolving, downloading, parsing, done states)
- Remove `mode` state variable (always 'glb' mode)
- Remove `require('../../../utils/layoutCompute.js')` if no longer needed for GLB mode

### app.json

Register new page:
```json
{
  "root": "pages/knowledge",
  "pages": ["detail/detail", "budget/budget", "needs/needs", "inspect/inspect", "move/move", "checklist/checklist", "glbviewer/glbviewer", "photo/photo"]
}
```

---

## Edge Cases

- **Degenerate markers**: all 3 points nearly collinear → computeHomography returns null → fallback to solid gray texture
- **Floor estimation failure**: estimateFloorQuad returns invalid quad → floorTexture = null, roomScene uses solid floor color
- **Image load error**: fill texture canvas with gray, continue to 3D scene with solid colors
- **Canvas init timeout**: retry up to 5 times (300ms backoff), then show toast
- **Very oblique photo**: warpPerspective may produce severely stretched output → acceptable degradation, aspectRatio clamping prevents extreme values
- **Memory**: dispose Three.js resources onUnload (geometries, materials, textures, renderer)
