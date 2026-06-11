# PD2D 3D Cabinet Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render placed cabinets as true 3D GLB models on the photo, aligned to the user-defined perspective; fix the broken 50/100cm preview switch as a prerequisite.

**Architecture:** Add a transparent WebGL overlay canvas above the existing 2D photo canvas. New `utils/cabinetSceneOverlay.js` owns the three.js scene, GLB cache, and procedural trim cuboids. New `utils/homographyToCamera.js` (pure, no three.js) recovers a `PerspectiveCamera` pose from the 4 user-dragged corner points. `pd2d.js` becomes a thin coordinator. The 2D path stops drawing cabinets; it only draws the photo, the dashed quad, the corner dots, and the grid.

**Tech Stack:** WeChat Mini Program, `threejs-miniprogram` (already a dep), Jest 29 (`testEnvironment: node`), existing `utils/perspective.js`, `utils/cabinetCatalog.js`, and `utils/GLTFLoader.js`.

**Spec:** `docs/superpowers/specs/2026-06-10-pd2d-3d-cabinet-overlay-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `utils/cabinetModelPreview.js` | modify | Add `setModels(ids, onReady)` to swap models without rebuilding renderer |
| `utils/homographyToCamera.js` | create | Pure: 4 cm pts + 4 px pts + canvas size → `{position,lookAt,up,fov,aspect,near,far}` |
| `utils/cabinetSceneNodes.js` | create | Pure: `(wallW, wallH, modules) → [{type,modelId?,x,y,z,w,h,d}]` (y-up scene descriptors) |
| `utils/cabinetSceneOverlay.js` | create | three.js owner: scene, renderer, GLB cache, trim cuboids, camera, public `init/update/setDoorVisible/resize/dispose` |
| `pages/knowledge/pd2d/pd2d.wxml` | modify | Add stacked `pd2dOverlay` webgl canvas above `pd2dCanvas` |
| `pages/knowledge/pd2d/pd2d.wxss` | modify | Position overlay absolutely on top of 2D canvas |
| `pages/knowledge/pd2d/pd2d.js` | modify | Use `setModels` for width switch; init overlay; call `overlay.update` from change paths; remove 2D cabinet draw path |
| `__tests__/cabinetSceneNodes.test.js` | create | Unit tests for the pure node-list builder |
| `__tests__/homographyToCamera.test.js` | create | Round-trip unit tests |

---

## Task 1: Add `setModels()` to cabinetModelPreview.js (width-switch fix)

**Files:**
- Modify: `utils/cabinetModelPreview.js` (currently `dispose` at lines 324-351, `init` at 135-203)

**Why:** WeChat webgl canvases can't be re-bound after `renderer.dispose()`. The current `pd2d.js _initModelPreview` recreates the preview every width change, which silently fails on the second call. Solution: keep the renderer; only swap the model groups.

- [ ] **Step 1.1: Read the current file end-to-end**

Run: read `utils/cabinetModelPreview.js`. Confirm `init()` reads modelIds, builds a `models[]` array of THREE.Group, and that `dispose()` traverses each group disposing geometry/material before removing from scene.

- [ ] **Step 1.2: Extract a private `_clearModels()` helper**

Inside `createPreview()`, just before the `dispose` definition, add:

```js
function _clearModels() {
  if (!scene) return;
  for (var i = 0; i < models.length; i++) {
    if (models[i]) {
      models[i].traverse(function(node) {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach(function(m) { m.dispose(); });
          } else {
            node.material.dispose();
          }
        }
      });
      scene.remove(models[i]);
    }
  }
  models = [];
}
```

Then refactor `dispose()` to call `_clearModels()` instead of inlining the same loop:

```js
function dispose() {
  _clearModels();
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  scene = null;
  THREE = null;
  cellCount = 0;
  selectedIndex = -1;
}
```

- [ ] **Step 1.3: Add `setModels(modelIds, onReady)`**

Add this function inside `createPreview()` next to `init`:

```js
function setModels(modelIds, onReady) {
  if (!scene || !renderer) {
    if (onReady) onReady(new Error('preview not initialized'));
    return;
  }
  _clearModels();
  cellCount = modelIds.length;
  selectedIndex = -1;
  if (cellCount === 0) {
    renderAll();
    if (onReady) onReady(null, []);
    return;
  }
  var loaded = 0;
  var total = cellCount;
  var catalog = require('./cabinetCatalog.js');
  for (var i = 0; i < cellCount; i++) {
    (function(idx) {
      var id = modelIds[idx];
      var path = catalog.getModelPath(id);
      if (!path) {
        loaded++; models[idx] = null;
        if (loaded >= total) { renderAll(); if (onReady) onReady(null, models); }
        return;
      }
      var data = _readGLB(path);
      if (!data) {
        loaded++; models[idx] = null;
        if (loaded >= total) { renderAll(); if (onReady) onReady(null, models); }
        return;
      }
      _parseGLB(data).then(function(gltfScene) {
        var group = _fitModelToCell(gltfScene);
        group.userData.modelId = id;
        group.userData.cellIndex = idx;
        group.visible = false;
        scene.add(group);
        models[idx] = group;
        loaded++;
        if (loaded >= total) { renderAll(); if (onReady) onReady(null, models); }
      }).catch(function() {
        models[idx] = null;
        loaded++;
        if (loaded >= total) { renderAll(); if (onReady) onReady(null, models); }
      });
    })(i);
  }
}
```

- [ ] **Step 1.4: Export `setModels`**

In the `return { ... }` block at the bottom of `createPreview`, add `setModels: setModels,` next to `init: init,`.

- [ ] **Step 1.5: Commit**

```bash
git add utils/cabinetModelPreview.js
git commit -m "feat(cabinetModelPreview): add setModels() to swap models without rebuilding renderer"
```

---

## Task 2: Wire `setModels()` into pd2d.js

**Files:**
- Modify: `pages/knowledge/pd2d/pd2d.js` (`selectWidth` at lines 227-231, `_initModelPreview` at 324-377)

- [ ] **Step 2.1: Make `_initModelPreview` reuse an existing preview**

Replace the entire `_initModelPreview` function with this version. The change: if `self._modelPreview` already exists, call `setModels` instead of creating a fresh preview.

```js
_initModelPreview: function() {
  var self = this;
  var widthCm = self.data.selectedWidth;
  var modelIds = self._getModelIdsForWidth(widthCm);
  if (modelIds.length === 0) return;

  // Already initialized: just swap models.
  if (self._modelPreview) {
    self._modelPreview.setModels(modelIds, function(err) {
      if (err) { console.error('[pd2d] setModels error:', err); return; }
      try { self._modelPreview.setDoorVisible(self.data.doorVisible); } catch (e) {}
      self._modelPreview.selectModel(0);
      self._modelPreview.renderAll();
      self._syncSelectedFromPreview(0);
    });
    return;
  }

  // First-time init: create preview on the canvas.
  setTimeout(function() {
    var query = wx.createSelectorQuery().in(self);
    query.select('#modelPreviewCanvas')
      .fields({ node: true, size: true })
      .exec(function(res) {
        if (!res || !res[0] || !res[0].node) return;
        var canvas = res[0].node;
        canvas.width = res[0].width;
        canvas.height = res[0].height;
        var preview = cabinetModelPreview.createPreview(canvas);
        preview.init(modelIds, function(err) {
          if (err) { console.error('[pd2d] model preview init error:', err); return; }
          self._modelPreview = preview;
          try { preview.setDoorVisible(false); } catch (e) {}
          self.setData({
            modelPreviewReady: true,
            hasDoor: preview.hasDoorMeshes(),
            doorVisible: false
          });
          preview.selectModel(0);
          preview.renderAll();
          self._syncSelectedFromPreview(0);
        });
      });
  }, 200);
},
```

- [ ] **Step 2.2: Add `_syncSelectedFromPreview` helper**

Just below `_initModelPreview`, add:

```js
_syncSelectedFromPreview: function(idx) {
  if (!this._modelPreview) return;
  var modelId = this._modelPreview.getModelIdAt(idx);
  if (!modelId) return;
  var models = require('../../../utils/cabinetCatalog.js').listModels();
  for (var j = 0; j < models.length; j++) {
    if (models[j].id === modelId) {
      this.setData({
        selectedModelId: modelId,
        selectedType: models[j].type.toLowerCase(),
        selectedWidth: models[j].width
      });
      return;
    }
  }
},
```

Then simplify `onModelPreviewTouch` to use it. Replace the existing function with:

```js
onModelPreviewTouch: function(e) {
  var preview = this._modelPreview;
  if (!preview) return;
  if (e.type !== 'touchstart') return;
  var touch = e.touches[0];
  if (!touch) return;
  var idx = preview.hitTest(touch.x, touch.y);
  if (idx < 0) return;
  preview.selectModel(idx);
  this._syncSelectedFromPreview(idx);
},
```

- [ ] **Step 2.3: Manual verification (only avenue — Mini Program)**

Per `CLAUDE.md`, run the project in WeChat Developer Tools. Open PD2D, confirm space, observe 6 50cm models. Tap "100cm" chip. Expected: preview now shows 6 100cm models. Tap "50cm" again — expected: 6 50cm models. No flicker, no console errors. If still showing 50cm: re-check `setModels` is exported and `_modelPreview` is the same instance.

- [ ] **Step 2.4: Commit**

```bash
git add pages/knowledge/pd2d/pd2d.js
git commit -m "fix(pd2d): use setModels() to switch 50/100cm preview without rebuilding renderer"
```

---

## Task 3: `homographyToCamera.js` — pure math (TDD)

**Files:**
- Create: `utils/homographyToCamera.js`
- Test: `__tests__/homographyToCamera.test.js`

**Why isolate:** the trickiest math in the project; pure-function form is testable in plain Node (no `wx.*`, no three.js).

### Public API

```js
// returns { position:[x,y,z], lookAt:[x,y,z], up:[x,y,z], fov:number, aspect:number, near:number, far:number }
// or null on degenerate input.
homographyToCamera({
  cmCorners: [{x,y}, {x,y}, {x,y}, {x,y}],   // TL, TR, BR, BL in y-up cm coords (TL.y = wallH)
  pxCorners: [{x,y}, {x,y}, {x,y}, {x,y}],   // matching pixel points
  canvasWidth: number,                        // CSS pixels
  canvasHeight: number,
  fovDegrees: 60                              // optional, default 60 vertical FOV
})
```

- [ ] **Step 3.1: Write failing test — identity case**

Create `__tests__/homographyToCamera.test.js`:

```js
var h2c = require('../utils/homographyToCamera.js');

function makeCmCorners(W, H) {
  return [{x:0,y:H},{x:W,y:H},{x:W,y:0},{x:0,y:0}];
}

describe('homographyToCamera', function() {
  it('returns null when pxCorners is not convex', function() {
    var W = 300, Hh = 260;
    var px = [{x:10,y:10},{x:200,y:50},{x:50,y:200},{x:200,y:200}]; // self-intersecting
    var out = h2c.homographyToCamera({
      cmCorners: makeCmCorners(W, Hh),
      pxCorners: px,
      canvasWidth: 360,
      canvasHeight: 300
    });
    expect(out).toBeNull();
  });

  it('returns finite numeric fields for a valid frontal projection', function() {
    var W = 300, Hh = 260;
    var px = [{x:60,y:40},{x:300,y:40},{x:300,y:260},{x:60,y:260}];
    var out = h2c.homographyToCamera({
      cmCorners: makeCmCorners(W, Hh),
      pxCorners: px,
      canvasWidth: 360,
      canvasHeight: 300
    });
    expect(out).not.toBeNull();
    expect(Number.isFinite(out.position[0])).toBe(true);
    expect(Number.isFinite(out.position[1])).toBe(true);
    expect(Number.isFinite(out.position[2])).toBe(true);
    expect(Number.isFinite(out.lookAt[0])).toBe(true);
    expect(out.fov).toBe(60);
    expect(out.aspect).toBeCloseTo(360/300, 5);
  });
});
```

- [ ] **Step 3.2: Run test — expect failure (module missing)**

Run: `npx jest __tests__/homographyToCamera.test.js`
Expected: FAIL with `Cannot find module '../utils/homographyToCamera.js'`.

- [ ] **Step 3.3: Implement minimal stub to satisfy convexity check**

Create `utils/homographyToCamera.js`:

```js
var perspective = require('./perspective.js');

function _mat3MulVec(M, v) {
  return [
    M[0][0]*v[0] + M[0][1]*v[1] + M[0][2]*v[2],
    M[1][0]*v[0] + M[1][1]*v[1] + M[1][2]*v[2],
    M[2][0]*v[0] + M[2][1]*v[1] + M[2][2]*v[2]
  ];
}
function _norm3(v) { return Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]); }
function _scale3(v, s) { return [v[0]*s, v[1]*s, v[2]*s]; }
function _cross(a, b) {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function _det3(M) {
  return M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])
       - M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])
       + M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);
}
function _allFinite(arr) {
  for (var i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) return false;
  return true;
}

function homographyToCamera(opts) {
  var cmCorners = opts.cmCorners;
  var pxCorners = opts.pxCorners;
  var cw = opts.canvasWidth;
  var ch = opts.canvasHeight;
  var fovDeg = opts.fovDegrees != null ? opts.fovDegrees : 60;

  if (!perspective.isConvexQuad(pxCorners)) return null;

  var H = perspective.computeHomography(cmCorners, pxCorners);
  if (!H) return null;

  // Intrinsics: focal length from vertical FOV; principal point at canvas center.
  var fovRad = fovDeg * Math.PI / 180;
  var f = ch / (2 * Math.tan(fovRad / 2));
  var cx = cw / 2;
  var cy = ch / 2;
  // K^{-1} for the standard pinhole [[f,0,cx],[0,f,cy],[0,0,1]]
  var Kinv = [
    [1/f, 0,   -cx/f],
    [0,   1/f, -cy/f],
    [0,   0,   1]
  ];

  // H columns
  var h1 = [H[0][0], H[1][0], H[2][0]];
  var h2 = [H[0][1], H[1][1], H[2][1]];
  var h3 = [H[0][2], H[1][2], H[2][2]];

  var Kh1 = _mat3MulVec(Kinv, h1);
  var Kh2 = _mat3MulVec(Kinv, h2);
  var Kh3 = _mat3MulVec(Kinv, h3);

  var lambda = _norm3(Kh1);
  if (!Number.isFinite(lambda) || lambda < 1e-12) return null;
  var inv = 1 / lambda;
  var r1 = _scale3(Kh1, inv);
  var r2 = _scale3(Kh2, inv);
  var t  = _scale3(Kh3, inv);
  var r3 = _cross(r1, r2);

  var R = [
    [r1[0], r2[0], r3[0]],
    [r1[1], r2[1], r3[1]],
    [r1[2], r2[2], r3[2]]
  ];

  // Mirror fix: if det(R) < 0, flip r3.
  if (_det3(R) < 0) {
    r3 = [-r3[0], -r3[1], -r3[2]];
    R[0][2] = r3[0]; R[1][2] = r3[1]; R[2][2] = r3[2];
  }

  // World position: cameraPos = -R^T * t
  var camPos = [
    -(R[0][0]*t[0] + R[1][0]*t[1] + R[2][0]*t[2]),
    -(R[0][1]*t[0] + R[1][1]*t[1] + R[2][1]*t[2]),
    -(R[0][2]*t[0] + R[1][2]*t[1] + R[2][2]*t[2])
  ];
  // Forward in world: R^T * (0,0,1) = R's third row
  var fwd = [R[2][0], R[2][1], R[2][2]];
  // Up in world: R^T * (0,-1,0) = -R's second row
  var up  = [-R[1][0], -R[1][1], -R[1][2]];

  var lookAt = [camPos[0]+fwd[0], camPos[1]+fwd[1], camPos[2]+fwd[2]];

  if (!_allFinite(camPos.concat(lookAt).concat(up))) return null;

  var tNorm = _norm3(t);
  return {
    position: camPos,
    lookAt: lookAt,
    up: up,
    fov: fovDeg,
    aspect: cw / ch,
    near: Math.max(1, tNorm * 0.05),
    far:  Math.max(2000, tNorm * 10)
  };
}

module.exports = { homographyToCamera: homographyToCamera };
```

- [ ] **Step 3.4: Run tests — expect pass**

Run: `npx jest __tests__/homographyToCamera.test.js`
Expected: 2 passing.

- [ ] **Step 3.5: Add round-trip test for a tilted camera**

Append to `__tests__/homographyToCamera.test.js`:

```js
it('round-trips: project corners through recovered camera within 2px', function() {
  var W = 300, Hh = 260;
  // Synthesize a camera looking slightly down at the wall from in front,
  // then project the wall's 4 corners to pixels manually.
  var fovDeg = 60, cw = 360, ch = 300;
  var f = ch / (2 * Math.tan(fovDeg*Math.PI/180/2));
  var cx = cw/2, cy = ch/2;
  // Camera 400cm in front of wall center, 50cm above floor, looking at wall center
  var camWorld = [W/2, 130, 400];
  var target   = [W/2, Hh/2, 0];
  function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
  function nrm(v){var n=Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);return [v[0]/n,v[1]/n,v[2]/n];}
  function crs(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  // Camera basis: forward = target-cam (we use +z toward scene), so camera looks -z in its own frame
  var fwd = nrm(sub(target, camWorld));        // camera forward in world
  var worldUp = [0,1,0];
  var right = nrm(crs(fwd, worldUp));
  var up = crs(right, fwd);
  // World->camera: project a world point P into camera coords:
  //   x_cam =  right · (P - cam)
  //   y_cam = -up    · (P - cam)   (image y down)
  //   z_cam = -fwd   · (P - cam)   (camera looks -z, so distance is positive)
  function projectToPx(P) {
    var d = sub(P, camWorld);
    var xc =  right[0]*d[0] + right[1]*d[1] + right[2]*d[2];
    var yc = -(up[0]*d[0] + up[1]*d[1] + up[2]*d[2]);
    var zc = -(fwd[0]*d[0] + fwd[1]*d[1] + fwd[2]*d[2]);
    return { x: cx + f*xc/zc, y: cy + f*yc/zc };
  }
  var cmCorners = [{x:0,y:Hh},{x:W,y:Hh},{x:W,y:0},{x:0,y:0}];
  var pxCorners = [
    projectToPx([0, Hh, 0]),
    projectToPx([W, Hh, 0]),
    projectToPx([W, 0,  0]),
    projectToPx([0, 0,  0])
  ];
  var out = h2c.homographyToCamera({
    cmCorners: cmCorners, pxCorners: pxCorners,
    canvasWidth: cw, canvasHeight: ch, fovDegrees: fovDeg
  });
  expect(out).not.toBeNull();
  // Now re-project each cm corner using the recovered camera and check error <2px.
  // Build basis from out.{position, lookAt, up} the same way:
  var fwd2 = nrm(sub(out.lookAt, out.position));
  var right2 = nrm(crs(fwd2, out.up));
  var up2 = crs(right2, fwd2);
  function reproj(P) {
    var d = sub(P, out.position);
    var xc =  right2[0]*d[0] + right2[1]*d[1] + right2[2]*d[2];
    var yc = -(up2[0]*d[0] + up2[1]*d[1] + up2[2]*d[2]);
    var zc = -(fwd2[0]*d[0] + fwd2[1]*d[1] + fwd2[2]*d[2]);
    return { x: cx + f*xc/zc, y: cy + f*yc/zc };
  }
  var cm3d = [[0,Hh,0],[W,Hh,0],[W,0,0],[0,0,0]];
  for (var i = 0; i < 4; i++) {
    var rp = reproj(cm3d[i]);
    expect(Math.abs(rp.x - pxCorners[i].x)).toBeLessThan(2);
    expect(Math.abs(rp.y - pxCorners[i].y)).toBeLessThan(2);
  }
});
```

- [ ] **Step 3.6: Run tests — expect pass**

Run: `npx jest __tests__/homographyToCamera.test.js`
Expected: 3 passing.

- [ ] **Step 3.7: Commit**

```bash
git add utils/homographyToCamera.js __tests__/homographyToCamera.test.js
git commit -m "feat(homographyToCamera): pure-function camera recovery from 4 corner correspondences"
```

---

## Task 4: `cabinetSceneNodes.js` — pure scene-descriptor builder (TDD)

**Files:**
- Create: `utils/cabinetSceneNodes.js`
- Test: `__tests__/cabinetSceneNodes.test.js`

**Why isolate:** the geometry list (cabinets + 6 trim cuboids per layout) is the part that can drift from the legacy 2D path. A pure function with snapshot tests pins it down.

### Public API

```js
// returns Array<{ type: 'cabinet'|'trim', modelId?: string, x, y, z, w, h, d }>
buildSceneNodes({ wallWidth, wallHeight, modules, depth })
// y-up cm coordinate system, origin at bottom-left of wall, +z toward viewer
```

- [ ] **Step 4.1: Write failing test — empty wall produces only trim**

Create `__tests__/cabinetSceneNodes.test.js`:

```js
var nodes = require('../utils/cabinetSceneNodes.js');

describe('buildSceneNodes', function() {
  var DEPTH = 60;

  it('empty wall: 5 trim nodes (2 main SK + 2 upper SK + top bar) when gap>0', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 260, modules: [], depth: DEPTH
    });
    var trims = out.filter(function(n) { return n.type === 'trim'; });
    var cabinets = out.filter(function(n) { return n.type === 'cabinet'; });
    expect(cabinets.length).toBe(0);
    // gap = 260 - 230 - 2 = 28 > 0; expect 5 trims (2 main side, 2 upper side, 1 top)
    expect(trims.length).toBe(5);
  });

  it('empty wall, gap==0: only 3 trim nodes (2 main side + top bar)', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 232, modules: [], depth: DEPTH
    });
    // gap = 232 - 230 - 2 = 0
    var trims = out.filter(function(n) { return n.type === 'trim'; });
    expect(trims.length).toBe(3);
  });

  it('one cabinet: cabinet at (wallX, 0, 0) with width × 230 × depth', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 260,
      modules: [{ type: 'a', width: 100, wallX: 50 }],
      depth: DEPTH
    });
    var cab = out.filter(function(n) { return n.type === 'cabinet'; });
    expect(cab.length).toBe(1);
    expect(cab[0].modelId).toBe('100A');
    expect(cab[0].x).toBe(50);
    expect(cab[0].y).toBe(0);
    expect(cab[0].z).toBe(0);
    expect(cab[0].w).toBe(100);
    expect(cab[0].h).toBe(230);
    expect(cab[0].d).toBe(DEPTH);
  });

  it('one cabinet with gap>0: emits a g-* filler at (wallX, 230, 0) sized (width, gap, depth)', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 280,
      modules: [{ type: 'b', width: 50, wallX: 100 }],
      depth: DEPTH
    });
    // gap = 280 - 230 - 2 = 48
    var fillers = out.filter(function(n) {
      return n.type === 'trim' && n.y === 230 && n.x === 100;
    });
    expect(fillers.length).toBe(1);
    expect(fillers[0].w).toBe(50);
    expect(fillers[0].h).toBe(48);
    expect(fillers[0].d).toBe(DEPTH);
  });

  it('top bar spans full inner width', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 260, modules: [], depth: DEPTH
    });
    var top = out.filter(function(n) {
      return n.type === 'trim' && n.h === 2 && n.y === 258;
    });
    expect(top.length).toBe(1);
    expect(top[0].x).toBe(2);
    expect(top[0].w).toBe(296);
  });

  it('side SK columns at x=0 and x=wallWidth-2', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 260, modules: [], depth: DEPTH
    });
    var leftMain  = out.filter(function(n) { return n.type==='trim' && n.x===0   && n.y===0   && n.h===230; });
    var rightMain = out.filter(function(n) { return n.type==='trim' && n.x===298 && n.y===0   && n.h===230; });
    var leftUpper = out.filter(function(n) { return n.type==='trim' && n.x===0   && n.y===230 && n.h===28; });
    expect(leftMain.length).toBe(1);
    expect(rightMain.length).toBe(1);
    expect(leftUpper.length).toBe(1);
  });

  it('cabinet modelId derived from type+width: type uppercased', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 200, wallHeight: 260,
      modules: [{ type: 'g1', width: 50, wallX: 0 }],
      depth: DEPTH
    });
    var cab = out.filter(function(n) { return n.type === 'cabinet'; });
    expect(cab[0].modelId).toBe('50G1');
  });
});
```

- [ ] **Step 4.2: Run test — expect failure (module missing)**

Run: `npx jest __tests__/cabinetSceneNodes.test.js`
Expected: FAIL with `Cannot find module '../utils/cabinetSceneNodes.js'`.

- [ ] **Step 4.3: Implement `cabinetSceneNodes.js`**

Create `utils/cabinetSceneNodes.js`:

```js
var SK = 2;
var CABINET_HEIGHT = 230;
var TOP_BAR_THICKNESS = 2;

function _modelId(type, width) {
  return String(width) + String(type).toUpperCase();
}

function buildSceneNodes(opts) {
  var W = opts.wallWidth;
  var Hh = opts.wallHeight;
  var modules = opts.modules || [];
  var d = opts.depth;
  var gap = Math.max(Hh - CABINET_HEIGHT - TOP_BAR_THICKNESS, 0);
  var nodes = [];

  // Cabinets
  for (var i = 0; i < modules.length; i++) {
    var m = modules[i];
    nodes.push({
      type: 'cabinet',
      modelId: _modelId(m.type, m.width),
      x: m.wallX, y: 0, z: 0,
      w: m.width, h: CABINET_HEIGHT, d: d
    });
    // g-* gap filler above each cabinet
    if (gap > 0) {
      nodes.push({
        type: 'trim',
        x: m.wallX, y: CABINET_HEIGHT, z: 0,
        w: m.width, h: gap, d: d
      });
    }
  }

  // Left main SK
  nodes.push({ type:'trim', x:0, y:0, z:0, w:SK, h:CABINET_HEIGHT, d:d });
  // Right main SK
  nodes.push({ type:'trim', x:W-SK, y:0, z:0, w:SK, h:CABINET_HEIGHT, d:d });

  if (gap > 0) {
    nodes.push({ type:'trim', x:0, y:CABINET_HEIGHT, z:0, w:SK, h:gap, d:d });
    nodes.push({ type:'trim', x:W-SK, y:CABINET_HEIGHT, z:0, w:SK, h:gap, d:d });
  }

  // Top bar — spans interior between SK columns, sits at top of wall
  if (W > 2*SK) {
    nodes.push({
      type:'trim',
      x:SK, y:Hh-TOP_BAR_THICKNESS, z:0,
      w:W-2*SK, h:TOP_BAR_THICKNESS, d:d
    });
  }

  return nodes;
}

module.exports = { buildSceneNodes: buildSceneNodes };
```

- [ ] **Step 4.4: Run tests — expect pass**

Run: `npx jest __tests__/cabinetSceneNodes.test.js`
Expected: 7 passing.

- [ ] **Step 4.5: Commit**

```bash
git add utils/cabinetSceneNodes.js __tests__/cabinetSceneNodes.test.js
git commit -m "feat(cabinetSceneNodes): pure scene-descriptor builder for 3D overlay"
```

---

## Task 5: `cabinetSceneOverlay.js` — three.js scene scaffold

**Files:**
- Create: `utils/cabinetSceneOverlay.js`

**Note:** This task only sets up the renderer/scene/lights. GLB loading and rendering come in Task 6. No automated tests possible (requires WebGL + WeChat runtime).

- [ ] **Step 5.1: Create the file with init/dispose/resize**

Create `utils/cabinetSceneOverlay.js`:

```js
/**
 * 3D 柜体透视叠加层。
 * 在 PD2D 页面的 webgl canvas 上渲染：
 *  - 已放置柜体的 GLB（按宽度归一化、按 wallX 平移）
 *  - 程序化 SK 修边 + g-* 间隙填充 cuboid
 *  - 从 4 个像素角点反推的 PerspectiveCamera
 * 透明背景，叠加在 2D 照片之上。
 */
var sceneNodes = require('./cabinetSceneNodes.js');
var h2c = require('./homographyToCamera.js');
var perspective = require('./perspective.js');
var catalog = require('./cabinetCatalog.js');

var DEFAULT_DEPTH = 60;
var TRIM_COLOR = 0xF5F1E8;

function createOverlay(canvas) {
  var THREE = null;
  var renderer = null;
  var scene = null;
  var camera = null;
  var lights = null;
  var trimMaterial = null;

  // GLB template cache: modelId -> { templateGroup, doorMeshes:[Mesh names] }
  var templates = {};
  // Live nodes in scene: array of { kind:'cabinet'|'trim', mesh|group, descriptor }
  var liveNodes = [];

  var doorVisible = false;
  var canvasWidth = 0;
  var canvasHeight = 0;
  var dpr = 2;

  // Stable pose key: detects whether corners changed enough to recompute camera
  var lastCornersKey = null;
  var lastWallW = 0;
  var lastWallH = 0;
  // 节点签名: 防止同一帧重复重建场景
  var lastNodesKey = null;

  function _initThree() {
    THREE = require('./threejs-miniprogram.js').createScopedThreejs(canvas);
    if (!THREE || !THREE.WebGLRenderer) {
      throw new Error('THREE init failed');
    }
    require('./GLTFLoader.js')(THREE);
  }

  function _setupRenderer(w, h, ratio) {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
  }

  function _setupScene() {
    scene = new THREE.Scene();
    var amb = new THREE.AmbientLight(0xffffff, 2.5);
    var key = new THREE.DirectionalLight(0xffffff, 3.0);
    key.position.set(2, 4, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    var fill = new THREE.DirectionalLight(0xffffff, 1.2);
    fill.position.set(-2, 1, -2);
    scene.add(amb); scene.add(key); scene.add(fill);
    lights = { amb: amb, key: key, fill: fill };
    trimMaterial = new THREE.MeshStandardMaterial({
      color: TRIM_COLOR, roughness: 0.7, metalness: 0.0
    });
  }

  function init(opts) {
    canvasWidth = opts.canvasWidth;
    canvasHeight = opts.canvasHeight;
    dpr = opts.dpr || 2;
    try {
      _initThree();
      _setupRenderer(canvasWidth, canvasHeight, dpr);
      _setupScene();
      camera = new THREE.PerspectiveCamera(60, canvasWidth/canvasHeight, 1, 5000);
      return true;
    } catch (e) {
      console.error('[cabinetSceneOverlay] init failed:', e);
      renderer = null;
      scene = null;
      return false;
    }
  }

  function resize(w, h, ratio) {
    if (!renderer) return;
    canvasWidth = w; canvasHeight = h; dpr = ratio || dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    if (camera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function dispose() {
    _clearLive();
    if (trimMaterial) { trimMaterial.dispose(); trimMaterial = null; }
    var keys = Object.keys(templates);
    for (var i = 0; i < keys.length; i++) {
      var t = templates[keys[i]];
      if (t && t.templateGroup) {
        t.templateGroup.traverse(_disposeNode);
      }
    }
    templates = {};
    if (renderer) { renderer.dispose(); renderer = null; }
    scene = null; camera = null; lights = null; THREE = null;
    lastCornersKey = null; lastNodesKey = null;
  }

  function _disposeNode(node) {
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      if (Array.isArray(node.material)) {
        node.material.forEach(function(m){ m.dispose(); });
      } else {
        node.material.dispose();
      }
    }
  }

  function _clearLive() {
    if (!scene) return;
    for (var i = 0; i < liveNodes.length; i++) {
      var ln = liveNodes[i];
      var obj = ln.mesh || ln.group;
      if (!obj) continue;
      scene.remove(obj);
      // Cabinet groups are clones — their geometry/material are shared with template, do NOT dispose.
      // Trim meshes own their geometry — dispose.
      if (ln.kind === 'trim' && ln.mesh && ln.mesh.geometry) {
        ln.mesh.geometry.dispose();
      }
    }
    liveNodes = [];
  }

  // Stubs for Task 6 — implemented there
  function update(state) { /* see Task 6 */ }
  function setDoorVisible(v) { doorVisible = !!v; /* see Task 6 */ }

  return {
    init: init,
    update: update,
    setDoorVisible: setDoorVisible,
    resize: resize,
    dispose: dispose
  };
}

module.exports = { createOverlay: createOverlay };
```

- [ ] **Step 5.2: Commit**

```bash
git add utils/cabinetSceneOverlay.js
git commit -m "feat(cabinetSceneOverlay): renderer/scene/lights scaffold for 3D overlay"
```

---

## Task 6: Overlay GLB cache + scene update + camera + render

**Files:**
- Modify: `utils/cabinetSceneOverlay.js` — replace the `update` and `setDoorVisible` stubs from Task 5

- [ ] **Step 6.1: Add GLB read/parse helpers**

Inside `createOverlay()`, between `_clearLive` and `update`, add:

```js
function _readGLB(path) {
  var fs = wx.getFileSystemManager();
  var paths = [path];
  if (path.indexOf('/') !== 0) paths.push('/' + path);
  for (var i = 0; i < paths.length; i++) {
    try {
      var data = fs.readFileSync(paths[i]);
      if (data && data.byteLength > 0) return data;
    } catch (e) {}
  }
  return null;
}

function _parseGLB(data) {
  return new Promise(function(resolve, reject) {
    new THREE.GLTFLoader().parse(data, '', function(gltf) {
      if (!gltf || !gltf.scene) { reject(new Error('empty gltf')); return; }
      resolve(gltf.scene);
    }, function(err) { reject(err || new Error('parse failed')); });
  });
}

function _isDoorMesh(name) {
  if (!name) return false;
  var lower = name.toLowerCase();
  return lower === 'door' || lower.indexOf('_door') >= 0 || lower.indexOf('door_') >= 0;
}

// Normalize a parsed GLB into a 0-aligned bounding box of (width × 230 × depth) cm.
function _buildTemplate(gltfScene, modelId, targetW, targetH, targetD) {
  var box = new THREE.Box3().setFromObject(gltfScene);
  var size = new THREE.Vector3(); box.getSize(size);
  var min = box.min;
  if (size.x < 0.001) size.x = 1;
  if (size.y < 0.001) size.y = 1;
  if (size.z < 0.001) size.z = 1;
  var sx = targetW / size.x;
  var sy = targetH / size.y;
  var sz = targetD / size.z;
  var template = new THREE.Group();
  // Translate so min is at origin, then scale to target size.
  var inner = new THREE.Group();
  inner.add(gltfScene);
  inner.position.set(-min.x, -min.y, -min.z);
  template.add(inner);
  template.scale.set(sx, sy, sz);
  template.userData.modelId = modelId;
  return template;
}

function _loadTemplateAsync(modelId, w, h, d, cb) {
  if (templates[modelId]) { cb(null, templates[modelId]); return; }
  var path = catalog.getModelPath(modelId);
  if (!path) { console.warn('[overlay] unknown modelId:', modelId); cb(new Error('unknown')); return; }
  var data = _readGLB(path);
  if (!data) { console.warn('[overlay] GLB read failed:', path); cb(new Error('read failed')); return; }
  _parseGLB(data).then(function(gltfScene) {
    var template = _buildTemplate(gltfScene, modelId, w, h, d);
    templates[modelId] = { templateGroup: template };
    cb(null, templates[modelId]);
  }).catch(function(err) {
    console.warn('[overlay] GLB parse failed:', path, err);
    cb(err);
  });
}

function _collectDoors(group) {
  var doors = [];
  group.traverse(function(node) { if (_isDoorMesh(node.name)) doors.push(node); });
  return doors;
}

function _addCabinetNode(desc) {
  var template = templates[desc.modelId];
  if (!template) return;  // not loaded yet — caller should re-trigger update after load
  var clone = template.templateGroup.clone(true);
  clone.position.set(desc.x, desc.y, desc.z);
  // Apply shadow flags + door visibility on the clone (clone() copies userData but not flags).
  var doors = _collectDoors(clone);
  for (var i = 0; i < doors.length; i++) doors[i].visible = doorVisible;
  clone.traverse(function(n) {
    if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
  });
  scene.add(clone);
  liveNodes.push({ kind:'cabinet', group: clone, descriptor: desc, doors: doors });
}

function _addTrimNode(desc) {
  var geom = new THREE.BoxGeometry(desc.w, desc.h, desc.d);
  var mesh = new THREE.Mesh(geom, trimMaterial);
  // BoxGeometry is centered at origin; offset so min is at desc.{x,y,z}.
  mesh.position.set(desc.x + desc.w/2, desc.y + desc.h/2, desc.z + desc.d/2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  liveNodes.push({ kind:'trim', mesh: mesh, descriptor: desc });
}
```

- [ ] **Step 6.2: Implement `update(state)`**

Replace the `update` stub from Task 5 with:

```js
function update(state) {
  if (!renderer || !scene) return;

  var corners = state.corners;
  var W = state.wallWidth;
  var Hh = state.wallHeight;
  var modules = state.modules || [];

  // Convexity / homography check first — if photo perspective is invalid, just clear the overlay.
  if (!perspective.isConvexQuad(corners)) {
    _clearLive();
    renderer.clear();
    return;
  }

  // 1. Build target descriptors from pure helper.
  var nodes = sceneNodes.buildSceneNodes({
    wallWidth: W, wallHeight: Hh, modules: modules, depth: DEFAULT_DEPTH
  });

  // 2. Trigger async load for any missing cabinet templates; re-call update when each finishes.
  var missing = {};
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    if (n.type === 'cabinet' && !templates[n.modelId]) missing[n.modelId] = true;
  }
  var missingIds = Object.keys(missing);
  if (missingIds.length > 0) {
    var pending = missingIds.length;
    for (var k = 0; k < missingIds.length; k++) {
      _loadTemplateAsync(missingIds[k], 0, 0, 0, function() {
        // Note: w/h/d passed as 0 here are placeholders — the *actual* size comes from the
        // descriptor at scene-add time. Templates are normalized to width × 230 × depth at load,
        // but since each cabinet's catalog width is fixed (50 or 100) we re-read the descriptor's
        // w/h/d when building the template. See Step 6.3 for the corrected helper invocation.
        pending--;
        if (pending <= 0) update(state); // re-run with templates ready
      });
    }
    // For now still continue — trim cuboids and already-loaded cabinets render immediately.
  }

  // 3. Diff: clear and rebuild. (Cabinet count is small; rebuild is cheaper than tracking deltas.)
  // Only rebuild if node signature changed.
  var nodesKey = JSON.stringify(nodes);
  if (nodesKey !== lastNodesKey) {
    _clearLive();
    for (var j = 0; j < nodes.length; j++) {
      var nd = nodes[j];
      if (nd.type === 'cabinet') _addCabinetNode(nd);
      else _addTrimNode(nd);
    }
    lastNodesKey = nodesKey;
  }

  // 4. Camera: recompute when corners or wall size changed.
  var cornersKey = corners.map(function(c){return c.x+','+c.y;}).join('|') + ':' + W + 'x' + Hh;
  if (cornersKey !== lastCornersKey) {
    var cm = [
      {x:0,  y:Hh}, {x:W, y:Hh}, {x:W, y:0}, {x:0, y:0}
    ];
    var camParams = h2c.homographyToCamera({
      cmCorners: cm, pxCorners: corners,
      canvasWidth: canvasWidth, canvasHeight: canvasHeight, fovDegrees: 60
    });
    if (!camParams) {
      console.warn('[overlay] camera recovery failed; skipping render');
      lastCornersKey = null;
      renderer.clear();
      return;
    }
    camera.position.set(camParams.position[0], camParams.position[1], camParams.position[2]);
    camera.up.set(camParams.up[0], camParams.up[1], camParams.up[2]);
    camera.lookAt(camParams.lookAt[0], camParams.lookAt[1], camParams.lookAt[2]);
    camera.fov = camParams.fov;
    camera.aspect = camParams.aspect;
    camera.near = camParams.near;
    camera.far = camParams.far;
    camera.updateProjectionMatrix();
    lastCornersKey = cornersKey;
  }

  // 5. Render.
  renderer.render(scene, camera);
}
```

- [ ] **Step 6.3: Fix `_loadTemplateAsync` to use catalog width**

The placeholder in Step 6.2's update path passes 0/0/0 for size, which is wrong. Replace `_loadTemplateAsync` with a version that derives target size from the catalog:

```js
function _loadTemplateAsync(modelId, _ignoreW, _ignoreH, _ignoreD, cb) {
  if (templates[modelId]) { cb(null, templates[modelId]); return; }
  var path = catalog.getModelPath(modelId);
  if (!path) { console.warn('[overlay] unknown modelId:', modelId); cb(new Error('unknown')); return; }
  var meta = null;
  var all = catalog.listModels();
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === modelId) { meta = all[i]; break; }
  }
  if (!meta) { cb(new Error('no meta')); return; }
  var data = _readGLB(path);
  if (!data) { console.warn('[overlay] GLB read failed:', path); cb(new Error('read failed')); return; }
  _parseGLB(data).then(function(gltfScene) {
    var template = _buildTemplate(gltfScene, modelId, meta.width, 230, DEFAULT_DEPTH);
    templates[modelId] = { templateGroup: template };
    cb(null, templates[modelId]);
  }).catch(function(err) {
    console.warn('[overlay] GLB parse failed:', path, err);
    cb(err);
  });
}
```

- [ ] **Step 6.4: Implement `setDoorVisible`**

Replace the `setDoorVisible` stub:

```js
function setDoorVisible(v) {
  doorVisible = !!v;
  for (var i = 0; i < liveNodes.length; i++) {
    var ln = liveNodes[i];
    if (ln.kind !== 'cabinet') continue;
    var doors = ln.doors || [];
    for (var j = 0; j < doors.length; j++) doors[j].visible = doorVisible;
  }
  if (renderer && scene && camera) renderer.render(scene, camera);
}
```

- [ ] **Step 6.5: Commit**

```bash
git add utils/cabinetSceneOverlay.js
git commit -m "feat(cabinetSceneOverlay): GLB cache, scene diff, camera recovery, render loop"
```

---

## Task 7: Add overlay canvas to PD2D markup + styles

**Files:**
- Modify: `pages/knowledge/pd2d/pd2d.wxml` (the `wx:if="{{spaceConfirmed}}"` block, around lines 48-58)
- Modify: `pages/knowledge/pd2d/pd2d.wxss`

- [ ] **Step 7.1: Add overlay canvas inside `.photo-area`**

In `pages/knowledge/pd2d/pd2d.wxml`, inside the `<view class="photo-area" ...>` block in the `wx:if="{{spaceConfirmed}}"` branch, **after** the existing `<canvas id="pd2dCanvas" ...>`, add a sibling overlay canvas. Replace this:

```xml
<view class="photo-area" style="padding-top: {{statusBarHeight + navBarHeight}}px;">
  <canvas
    type="2d"
    id="pd2dCanvas"
    class="pd2d-canvas"
    bindtouchstart="onCanvasTouchStart"
    bindtouchmove="onCanvasTouchMove"
    bindtouchend="onCanvasTouchEnd"
  ></canvas>
</view>
```

with:

```xml
<view class="photo-area" style="padding-top: {{statusBarHeight + navBarHeight}}px;">
  <view class="canvas-stack">
    <canvas
      type="2d"
      id="pd2dCanvas"
      class="pd2d-canvas"
      bindtouchstart="onCanvasTouchStart"
      bindtouchmove="onCanvasTouchMove"
      bindtouchend="onCanvasTouchEnd"
    ></canvas>
    <canvas
      type="webgl"
      id="pd2dOverlay"
      class="pd2d-overlay"
      disable-scroll="true"
    ></canvas>
  </view>
</view>
```

The overlay canvas does NOT bind touch handlers — pointer events pass through to the 2D canvas below. (WeChat native canvas doesn't support pointer-events: none, so we get this behavior by binding the touch handlers only to the 2D canvas. The overlay will sit in front but the touch events won't be captured by it because it has no handlers.)

If the user can't drag corners through the overlay, that means the overlay is intercepting events. Fallback: add `bindtouchstart="onCanvasTouchStart" bindtouchmove="onCanvasTouchMove" bindtouchend="onCanvasTouchEnd"` to the overlay too — they delegate to the same handlers and the touch coordinates work for both canvases since they're same-sized.

- [ ] **Step 7.2: Add stacking styles**

Append to `pages/knowledge/pd2d/pd2d.wxss`:

```css
/* ===== 2D 照片 + 3D overlay 叠加 ===== */
.canvas-stack {
  position: relative;
  width: 100%;
  height: 100%;
}

.canvas-stack .pd2d-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.pd2d-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
```

- [ ] **Step 7.3: Commit**

```bash
git add pages/knowledge/pd2d/pd2d.wxml pages/knowledge/pd2d/pd2d.wxss
git commit -m "feat(pd2d): add stacked webgl overlay canvas above photo canvas"
```

---

## Task 8: Wire overlay into pd2d.js + remove 2D cabinet path

**Files:**
- Modify: `pages/knowledge/pd2d/pd2d.js`

This is the largest task. It replaces the 2D PNG transparent paste with overlay calls and removes ~120 lines of dead code.

- [ ] **Step 8.1: Add overlay require + state at top of file**

At the top of `pages/knowledge/pd2d/pd2d.js`, **add** an import next to the existing requires:

```js
var cabinetSceneOverlay = require('../../../utils/cabinetSceneOverlay.js');
```

Inside the `Page({ ... })` object, near `_modelPreview` instance fields, **add**:

```js
_overlay: null,
_overlayCanvas: null,
_overlayInitialized: false,
_overlayPendingFrame: false,
```

- [ ] **Step 8.2: Add `_initOverlay()` and `_scheduleOverlayUpdate()` helpers**

Add these two methods to the `Page({ ... })` object (place after `_destroyModelPreview`):

```js
_initOverlay: function() {
  var self = this;
  if (self._overlayInitialized) return;
  // selectorQuery for the webgl overlay canvas
  var query = wx.createSelectorQuery().in(self);
  query.select('#pd2dOverlay')
    .fields({ node: true, size: true })
    .exec(function(res) {
      if (!res || !res[0] || !res[0].node) {
        // Canvas not yet mounted; retry once after the page settles.
        setTimeout(function() {
          if (!self._overlayInitialized) self._initOverlay();
        }, 200);
        return;
      }
      var canvas = res[0].node;
      var w = res[0].width;
      var h = res[0].height;
      if (!w || !h) {
        setTimeout(function() {
          if (!self._overlayInitialized) self._initOverlay();
        }, 200);
        return;
      }
      var overlay = cabinetSceneOverlay.createOverlay(canvas);
      var ok = overlay.init({ canvasWidth: w, canvasHeight: h, dpr: self._dpr || 2 });
      if (!ok) {
        console.error('[pd2d] overlay init failed; falling back to no-3D mode');
        return;
      }
      self._overlay = overlay;
      self._overlayCanvas = canvas;
      self._overlayInitialized = true;
      self._scheduleOverlayUpdate();
    });
},

_scheduleOverlayUpdate: function() {
  var self = this;
  if (!self._overlay) return;
  if (self._overlayPendingFrame) return;
  self._overlayPendingFrame = true;
  // Use canvas RAF if available, else setTimeout fallback.
  var raf = (self._canvas && self._canvas.requestAnimationFrame) || function(cb){ setTimeout(cb, 16); };
  raf(function() {
    self._overlayPendingFrame = false;
    if (!self._overlay) return;
    self._overlay.update({
      corners: self.data.corners,
      wallWidth: self.data.wallWidth,
      wallHeight: self.data.wallHeight,
      modules: self.data.modules
    });
  });
},
```

- [ ] **Step 8.3: Trigger overlay updates from change paths**

There are 4 places to invoke `_scheduleOverlayUpdate()`:

1. End of `onConfirmSpace` (after the `setTimeout(function() { self.initCanvas(); self._initModelPreview(); ... })`):

   Change the `setTimeout` callback to also call `self._initOverlay();`. The full callback becomes:
   ```js
   setTimeout(function() {
     self.initCanvas();
     self._initModelPreview();
     self._initOverlay();
   }, 120);
   ```

2. End of `onCanvasTouchMove` — currently calls `this._drawFrame()`. **After** `_drawFrame`, add:
   ```js
   this._scheduleOverlayUpdate();
   ```

3. `_placeModule` — currently ends with `this._drawFrame()`. **After** `_drawFrame`, add:
   ```js
   this._scheduleOverlayUpdate();
   ```

4. `prevBlock` and `resetWall` — both call `_drawFrame()`. After each `_drawFrame()`, add `this._scheduleOverlayUpdate();`.

- [ ] **Step 8.4: Wire door toggle to overlay**

Modify `toggleDoor`:

```js
toggleDoor() {
  var newVisible = !this.data.doorVisible;
  this.setData({ doorVisible: newVisible });
  if (this._modelPreview) {
    try { this._modelPreview.setDoorVisible(newVisible); } catch (e) {}
  }
  if (this._overlay) {
    try { this._overlay.setDoorVisible(newVisible); } catch (e) {}
  }
},
```

- [ ] **Step 8.5: Dispose overlay on unload**

Modify `onUnload`:

```js
onUnload() {
  this._destroyModelPreview();
  if (this._overlay) {
    try { this._overlay.dispose(); } catch (e) {}
    this._overlay = null;
    this._overlayInitialized = false;
  }
},
```

- [ ] **Step 8.6: Remove 2D cabinet rendering path**

Delete the following from `pd2d.js`:

1. The `_cabinetImageCache` and `_pendingImages` instance fields at the top of `Page({ ... })`.
2. The `_ensureCabinetImages` method.
3. The `_loadCabinetImages` method.
4. The `_loadImageToCache` method.
5. The `_buildCabinetList` method.
6. The `_nearestGapHeight` method.
7. The `_computeQuad` method.
8. The `_drawCabinets` method.
9. The `_getHomography` method.
10. The `assets` import at the top: `var assets = require('../../../utils/assets.js');` — only used by the cabinet image loader.
11. Inside `_drawFrame`, delete the block that draws cabinets:
    ```js
    if (isConvex && data.modules.length > 0) {
      var H = this._getHomography();
      if (H) {
        this._drawCabinets(ctx, H);
      }
    }
    ```
12. Inside `_placeModule`, remove `this._ensureCabinetImages();` (the GLB cache lives in the overlay now).

- [ ] **Step 8.7: Verify the file still parses**

Run: `node -e "require('./pages/knowledge/pd2d/pd2d.js')"` — expect either silent success or a `wx is not defined` error (which is fine; it means parsing succeeded, the runtime check failed because Node doesn't have `wx`).

If you see a SyntaxError, fix it before continuing.

- [ ] **Step 8.8: Commit**

```bash
git add pages/knowledge/pd2d/pd2d.js
git commit -m "feat(pd2d): wire 3D overlay; remove 2D cabinet image path"
```

---

## Task 9: Manual verification in WeChat Developer Tools

**Why no automated test:** The full path requires WebGL, the threejs-miniprogram runtime, GLB file reads via `wx.getFileSystemManager`, and the page lifecycle. Per `CLAUDE.md` this app only runs in WeChat Developer Tools.

- [ ] **Step 9.1: Open the project in WeChat Developer Tools**

Run: open the WeChat Developer Tools, import the project root `D:\工程\柠檬塔\程序\LemonTA-main\LemonTA-main`. Open the simulator and navigate to PD2D (knowledge → pd2d).

- [ ] **Step 9.2: Width-switch sanity check**

Confirm a space without a photo, then verify:
- Default 50cm chip is active; preview shows 6 50cm models.
- Tap 100cm chip → preview shows 6 100cm models.
- Tap 50cm again → 6 50cm models. No flicker, no error in the console.

If 100cm still shows 50cm: re-check Task 1 export of `setModels` and Task 2 reuse of `_modelPreview`.

- [ ] **Step 9.3: 3D placement check (no photo)**

Without a photo, confirm a 300×260 wall, drag corners to roughly trapezoidal. Tap "下一积木" once. Expected: a 3D 50A cabinet appears at left of wall, with visible depth (you should see the side face) and a faint contact shadow on the trim. Tap again — second cabinet places to the right of the first.

- [ ] **Step 9.4: 3D placement check (with photo)**

Re-enter PD2D, tap "上传墙面照片" → pick a wall photo → confirm space. Drag the 4 corners to outline a real wall. Tap "下一积木" multiple times. Cabinets should be lit consistently and follow the photo's perspective. Tap "显示柜门" — door panels appear.

- [ ] **Step 9.5: Reset and re-place**

Tap "重设墙面" → cabinets disappear, corners reset. Drag corners again, place new cabinets. Should work indefinitely.

- [ ] **Step 9.6: Run all tests one last time**

Run: `npx jest`
Expected: All tests pass (cabinetCatalog, perspective, homographyToCamera, cabinetSceneNodes, ensureLogin, checklist, cabinetLayout, cabinetMeshScaler, pd3dStorage).

- [ ] **Step 9.7: Final commit if any cleanup needed**

If manual verification revealed bugs, fix them, then:
```bash
git add -A
git commit -m "fix(pd2d): <specific fix from manual testing>"
```

---

## Self-Review Notes

This section is for the plan author (you) to verify before handoff:

**Spec coverage check:**
- [x] Width-switch fix → Task 1 + Task 2
- [x] 双 canvas 叠加 → Task 7 (wxml/wxss)
- [x] `cabinetSceneOverlay.js` 模块 → Tasks 5 + 6
- [x] `homographyToCamera.js` 纯函数 → Task 3 with TDD
- [x] 墙面坐标系 (y-up) → encoded in Task 4 tests + Task 6 update
- [x] 数据流 (rAF-merged update) → Task 8.2 `_scheduleOverlayUpdate`
- [x] Homography 分解步骤 → Task 3.3 implementation
- [x] 失败模式 (concave, singular, NaN) → Task 3 returns null, Task 6 guards
- [x] 柜体 GLB 缓存 + clone → Task 6 `_loadTemplateAsync` + `_addCabinetNode`
- [x] 门板可见性 → Task 6 `setDoorVisible` + Task 8.4 wiring
- [x] SK 修边 + g-* 程序化 cuboid → Task 4 tests + Task 6 `_addTrimNode`
- [x] 共享 `MeshStandardMaterial` → Task 5 `trimMaterial`
- [x] 阴影 (castShadow / receiveShadow / shadow.mapSize 1024) → Tasks 5 + 6
- [x] 移除 2D 柜体绘制 → Task 8.6
- [x] 测试: homographyToCamera 圆环测试 → Task 3.5
- [x] 测试: cabinetSceneNodes 几何等价 → Task 4.1
- [x] 测试: 既有 cabinetCatalog.test 仍通过 → Task 9.6

**Placeholder scan:** none. All code blocks are complete.

**Type consistency:** `setModels(ids, onReady)`, `createOverlay(canvas)`, `overlay.init/update/setDoorVisible/resize/dispose`, `homographyToCamera(opts) → {position, lookAt, up, fov, aspect, near, far} | null`, `buildSceneNodes(opts) → Array<{type, modelId?, x, y, z, w, h, d}>` — consistent across tasks.




