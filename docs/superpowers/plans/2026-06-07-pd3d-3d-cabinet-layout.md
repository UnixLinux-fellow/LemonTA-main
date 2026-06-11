# PD3D 3D Cabinet Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new "空间布置" (PD3D) page in WeChat Mini Program where users upload a wall photo, render a textured 3D room (with wall dimensions input), place GLB cabinet models along the back wall (auto-laid out with last-position custom cabinet + 4cm fill), scale individual cabinets in 3 axes while preserving panel thickness, and save/load multiple layouts to local storage.

**Architecture:** New independent page `pages/knowledge/pd3d/pd3d` reusing existing `threejs-miniprogram` + `GLTFLoader`. Four new utils modules with single responsibilities: `pd3dSceneManager` (Three.js orchestration), `cabinetMeshScaler` (panel-aware non-uniform scaling), `cabinetCatalog` (local GLB list), `pd3dStorage` (wx.setStorageSync + wx.saveFile CRUD). Entry card added to knowledge home page.

**Tech Stack:** WeChat Mini Program, threejs-miniprogram 0.0.8, Jest 29.7 for unit tests, GLTFLoader (already in repo), wx.saveFile + wx.setStorageSync for persistence.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-06-07-pd3d-3d-cabinet-layout-design.md`
- Existing scene patterns: `utils/threeScene.js`, `utils/glbSceneManager.js`
- Existing test pattern: `__tests__/perspective.test.js`

---

## File Structure

**Create:**
- `pages/knowledge/pd3d/pd3d.json` — page config with 自定义导航
- `pages/knowledge/pd3d/pd3d.wxml` — Canvas + bottom toolbar + drawer
- `pages/knowledge/pd3d/pd3d.wxss` — page styles
- `pages/knowledge/pd3d/pd3d.js` — page controller
- `utils/pd3dSceneManager.js` — Three.js scene/cabinet/camera orchestration
- `utils/cabinetMeshScaler.js` — panel-thickness-preserving scaling
- `utils/cabinetCatalog.js` — local GLB model registry
- `utils/pd3dStorage.js` — layout CRUD via wx storage + file
- `__tests__/cabinetMeshScaler.test.js` — unit tests for scaling math
- `__tests__/pd3dStorage.test.js` — unit tests for layout CRUD
- `__tests__/cabinetCatalog.test.js` — unit tests for catalog
- `__tests__/cabinetLayout.test.js` — unit tests for placement algorithm

**Modify:**
- `app.json` — register new page route
- `app.js` — add `knowledgeGroups` entry for "空间布置" (search current location of group)
- `pages/knowledge/knowledge.wxml` — add icon mapping for `pd3d` type
- `pages/knowledge/knowledge.js` — add navigation case for `pd3d` type
- `utils/share.js` — add 'pd3d' page-type sharing entry

---

## Conventions

**Coordinate system inside `pd3dSceneManager`:** meters, with origin at room center (X=0). Back wall at z=0. Floor at y=0. X axis = wall-width direction, range `[-wallW/2, +wallW/2]`. Z axis points from back wall outward (positive Z = closer to camera). Cabinet back face flush with z=0; cabinet front face at z=CABINET_DEPTH_M (+0.6m).

**Units boundary:** All public API of utils takes/returns cm (matches storage and user-input). Conversion to meters happens once inside `pd3dSceneManager.init`.

**Constants:**
- `CABINET_DEPTH_CM = 60` (固定柜子深度，与 `threeScene.js` 现有保持一致)
- `CABINET_HEIGHT_CM = 230` (柜子模型高度档位)
- `END_FILLER_CM = 4` (末端收口宽度)
- `STANDARD_WIDTHS_CM = [50, 100]` (标准柜档位)
- `MIN_CUSTOM_WIDTH_CM = 8` (末位非标柜最小宽度)
- `SCALE_RANGE = { min: 0.5, max: 2.0 }`

**Naming:** All new identifiers prefixed `pd3d` or `cabinet` to avoid collisions. Existing `threeScene.js` left untouched.

**Style:** ES5 syntax (`var`, `function`, no arrow functions, no destructuring). The codebase is pre-ES6; matching that.

---

## Task 1: cabinetCatalog — local GLB model registry

**Files:**
- Create: `utils/cabinetCatalog.js`
- Create: `__tests__/cabinetCatalog.test.js`

This module is the single source of truth for "which GLB models exist locally and what they look like to the UI." `pd3d.js` reads from it; nothing depends on hardcoded model names elsewhere. Currently only `100G1` exists.

- [ ] **Step 1: Write the failing test**

Write `__tests__/cabinetCatalog.test.js`:

```js
var catalog = require('../utils/cabinetCatalog.js');

describe('cabinetCatalog', function() {
  it('listModels returns at least one entry', function() {
    var list = catalog.listModels();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('each entry has id, label, path', function() {
    var list = catalog.listModels();
    for (var i = 0; i < list.length; i++) {
      expect(typeof list[i].id).toBe('string');
      expect(typeof list[i].label).toBe('string');
      expect(typeof list[i].path).toBe('string');
      expect(list[i].path.indexOf('.glb')).toBeGreaterThan(0);
    }
  });

  it('includes 100G1 with utils path', function() {
    var list = catalog.listModels();
    var found = list.filter(function(m) { return m.id === '100G1'; });
    expect(found.length).toBe(1);
    expect(found[0].path).toBe('utils/100G1.glb');
  });

  it('getModelPath returns path by id', function() {
    expect(catalog.getModelPath('100G1')).toBe('utils/100G1.glb');
  });

  it('getModelPath returns null for unknown id', function() {
    expect(catalog.getModelPath('NOT_REAL')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest __tests__/cabinetCatalog.test.js`
Expected: FAIL with `Cannot find module '../utils/cabinetCatalog.js'`

- [ ] **Step 3: Implement the catalog**

Write `utils/cabinetCatalog.js`:

```js
var MODELS = [
  {
    id: '100G1',
    label: '100G1 标准柜',
    path: 'utils/100G1.glb'
  }
];

function listModels() {
  return MODELS.slice();
}

function getModelPath(id) {
  for (var i = 0; i < MODELS.length; i++) {
    if (MODELS[i].id === id) return MODELS[i].path;
  }
  return null;
}

module.exports = {
  listModels: listModels,
  getModelPath: getModelPath
};
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest __tests__/cabinetCatalog.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add utils/cabinetCatalog.js __tests__/cabinetCatalog.test.js
git commit -m "feat(pd3d): add cabinetCatalog with 100G1 entry"
```

---

## Task 2: cabinetLayout — placement algorithm (pure function)

**Files:**
- Create: `utils/cabinetLayout.js`
- Create: `__tests__/cabinetLayout.test.js`

This is the pure-function placement algorithm: given standard cabinet widths and total wall width, produce the cabinet array including the auto-computed end-position custom cabinet plus 4cm filler accounting. Splitting it from `pd3dSceneManager` lets us test the math without Three.js.

Key responsibilities:
1. Each cabinet has `widthCm`, `isCustom`, `wallStartCm` (left edge in cm, 0 at wall left), `scale` (`{x,y,z}`).
2. `addStandard(list, widthCm, wallWidthCm)` — append a standard cabinet if it fits given the 4cm reserved end-filler. Refuses if a trailing custom already exists.
3. `finalize(list, wallWidthCm)` — append/replace the trailing custom cabinet with width `wallWidthCm − sumStandard − END_FILLER_CM`. Returns `{list:null, error}` if remaining width < 8cm.
4. `removeAt(list, index, wallWidthCm)` — remove cabinet at index; if a standard was removed and a trailing custom existed, recompute the trailing custom's width; shift positions.
5. `canFitWall(wallWidthCm)` — true iff wall fits at least one minimum-standard + filler.

- [ ] **Step 1: Write the failing test**

Write `__tests__/cabinetLayout.test.js`:

```js
var layout = require('../utils/cabinetLayout.js');

describe('cabinetLayout.addStandard', function() {
  it('adds first standard at wallStartCm 0', function() {
    var r = layout.addStandard([], 50, 150);
    expect(r.added).toBe(true);
    expect(r.list.length).toBe(1);
    expect(r.list[0]).toEqual({ widthCm: 50, isCustom: false, wallStartCm: 0,
                                scale: { x: 1, y: 1, z: 1 } });
  });

  it('adds second standard right after the first', function() {
    var list = [{ widthCm: 50, isCustom: false, wallStartCm: 0,
                  scale: { x: 1, y: 1, z: 1 } }];
    var r = layout.addStandard(list, 100, 200);
    expect(r.added).toBe(true);
    expect(r.list[1].widthCm).toBe(100);
    expect(r.list[1].wallStartCm).toBe(50);
  });

  it('refuses when adding would exceed wallWidth - filler', function() {
    var list = [{ widthCm: 100, isCustom: false, wallStartCm: 0,
                  scale: { x: 1, y: 1, z: 1 } }];
    var r = layout.addStandard(list, 50, 150);
    expect(r.added).toBe(false);
    expect(r.list.length).toBe(1);
  });

  it('refuses when a trailing custom already exists', function() {
    var list = [
      { widthCm: 50, isCustom: false, wallStartCm: 0,
        scale: { x: 1, y: 1, z: 1 } },
      { widthCm: 96, isCustom: true, wallStartCm: 50,
        scale: { x: 1, y: 1, z: 1 } }
    ];
    var r = layout.addStandard(list, 50, 200);
    expect(r.added).toBe(false);
  });
});

describe('cabinetLayout.finalize', function() {
  it('appends custom of remaining minus filler', function() {
    var list = [{ widthCm: 50, isCustom: false, wallStartCm: 0,
                  scale: { x: 1, y: 1, z: 1 } }];
    var r = layout.finalize(list, 150);
    expect(r.list.length).toBe(2);
    expect(r.list[1].widthCm).toBe(96);
    expect(r.list[1].isCustom).toBe(true);
    expect(r.list[1].wallStartCm).toBe(50);
  });

  it('replaces existing trailing custom with recomputed width', function() {
    var list = [
      { widthCm: 50, isCustom: false, wallStartCm: 0,
        scale: { x: 1, y: 1, z: 1 } },
      { widthCm: 96, isCustom: true, wallStartCm: 50,
        scale: { x: 1, y: 1, z: 1 } }
    ];
    var r = layout.finalize(list, 250);
    expect(r.list.length).toBe(2);
    expect(r.list[1].widthCm).toBe(196);
  });

  it('returns null when remaining < MIN_CUSTOM_WIDTH_CM', function() {
    var list = [{ widthCm: 100, isCustom: false, wallStartCm: 0,
                  scale: { x: 1, y: 1, z: 1 } }];
    var r = layout.finalize(list, 110);
    expect(r.list).toBe(null);
    expect(r.error).toBeDefined();
  });
});

describe('cabinetLayout.removeAt', function() {
  it('removes a standard and recomputes trailing custom', function() {
    var list = [
      { widthCm: 50, isCustom: false, wallStartCm: 0,
        scale: { x: 1, y: 1, z: 1 } },
      { widthCm: 100, isCustom: false, wallStartCm: 50,
        scale: { x: 1, y: 1, z: 1 } },
      { widthCm: 96, isCustom: true, wallStartCm: 150,
        scale: { x: 1, y: 1, z: 1 } }
    ];
    var r = layout.removeAt(list, 0, 250);
    expect(r.list.length).toBe(2);
    expect(r.list[0].widthCm).toBe(100);
    expect(r.list[0].wallStartCm).toBe(0);
    expect(r.list[1].isCustom).toBe(true);
    expect(r.list[1].widthCm).toBe(146);
  });

  it('removes trailing custom and leaves standards', function() {
    var list = [
      { widthCm: 50, isCustom: false, wallStartCm: 0,
        scale: { x: 1, y: 1, z: 1 } },
      { widthCm: 96, isCustom: true, wallStartCm: 50,
        scale: { x: 1, y: 1, z: 1 } }
    ];
    var r = layout.removeAt(list, 1, 150);
    expect(r.list.length).toBe(1);
    expect(r.list[0].widthCm).toBe(50);
  });
});

describe('cabinetLayout.canFitWall', function() {
  it('returns true when wall >= MIN_STD + END_FILLER', function() {
    expect(layout.canFitWall(54)).toBe(true);
    expect(layout.canFitWall(53)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest __tests__/cabinetLayout.test.js`
Expected: FAIL with `Cannot find module '../utils/cabinetLayout.js'`

- [ ] **Step 3: Implement utils/cabinetLayout.js**

```js
var END_FILLER_CM = 4;
var MIN_CUSTOM_WIDTH_CM = 8;
var STANDARD_WIDTHS_CM = [50, 100];
var MIN_STANDARD_WIDTH_CM = 50;

function cloneList(list) {
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    out.push({
      widthCm: m.widthCm,
      isCustom: m.isCustom,
      wallStartCm: m.wallStartCm,
      scale: { x: m.scale.x, y: m.scale.y, z: m.scale.z }
    });
  }
  return out;
}

function sumStandardWidths(list) {
  var sum = 0;
  for (var i = 0; i < list.length; i++) {
    if (!list[i].isCustom) sum += list[i].widthCm;
  }
  return sum;
}

function hasTrailingCustom(list) {
  return list.length > 0 && list[list.length - 1].isCustom;
}

function recomputePositions(list) {
  var x = 0;
  for (var i = 0; i < list.length; i++) {
    list[i].wallStartCm = x;
    x += list[i].widthCm;
  }
}

function addStandard(list, widthCm, wallWidthCm) {
  var copy = cloneList(list);
  if (hasTrailingCustom(copy)) {
    return { added: false, list: copy, error: 'finalized' };
  }
  var used = sumStandardWidths(copy);
  if (used + widthCm + END_FILLER_CM > wallWidthCm) {
    return { added: false, list: copy, error: 'no-space' };
  }
  copy.push({
    widthCm: widthCm,
    isCustom: false,
    wallStartCm: used,
    scale: { x: 1, y: 1, z: 1 }
  });
  return { added: true, list: copy };
}

function finalize(list, wallWidthCm) {
  var copy = cloneList(list);
  if (hasTrailingCustom(copy)) copy.pop();
  var used = sumStandardWidths(copy);
  var customW = wallWidthCm - used - END_FILLER_CM;
  if (customW < MIN_CUSTOM_WIDTH_CM) {
    return { list: null, error: 'remaining-too-small' };
  }
  copy.push({
    widthCm: customW,
    isCustom: true,
    wallStartCm: used,
    scale: { x: 1, y: 1, z: 1 }
  });
  return { list: copy };
}

function removeAt(list, index, wallWidthCm) {
  var copy = cloneList(list);
  if (index < 0 || index >= copy.length) {
    return { list: copy, error: 'out-of-range' };
  }
  var removedWasCustom = copy[index].isCustom;
  copy.splice(index, 1);
  if (!removedWasCustom && hasTrailingCustom(copy)) {
    copy.pop();
    var used = sumStandardWidths(copy);
    var newCustomW = wallWidthCm - used - END_FILLER_CM;
    if (newCustomW >= MIN_CUSTOM_WIDTH_CM) {
      copy.push({
        widthCm: newCustomW,
        isCustom: true,
        wallStartCm: used,
        scale: { x: 1, y: 1, z: 1 }
      });
    }
  }
  recomputePositions(copy);
  return { list: copy };
}

function canFitWall(wallWidthCm) {
  return wallWidthCm >= MIN_STANDARD_WIDTH_CM + END_FILLER_CM;
}

module.exports = {
  addStandard: addStandard,
  finalize: finalize,
  removeAt: removeAt,
  canFitWall: canFitWall,
  END_FILLER_CM: END_FILLER_CM,
  MIN_CUSTOM_WIDTH_CM: MIN_CUSTOM_WIDTH_CM,
  STANDARD_WIDTHS_CM: STANDARD_WIDTHS_CM
};
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest __tests__/cabinetLayout.test.js`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add utils/cabinetLayout.js __tests__/cabinetLayout.test.js
git commit -m "feat(pd3d): add cabinetLayout placement algorithm"
```

---

## Task 3: cabinetMeshScaler — panel-thickness-preserving scaling

**Files:**
- Create: `utils/cabinetMeshScaler.js`
- Create: `__tests__/cabinetMeshScaler.test.js`

This is the core new algorithm. Given a Three.js group containing a loaded GLB cabinet, identify each mesh's "thickness axis" (X/Y/Z) by name (Left/Right→X, Top/Bottom→Y, Back/Door→Z), then expose `applyScale(group, scale)` that scales each mesh in two non-thickness directions while keeping its thickness 1.0, plus repositions each mesh's center along the global scale.

The Jest tests use a tiny mock of Three.js — we don't need the real library to verify scaling math. We just construct mock objects with `.name`, `.position`, `.scale` and a `traverse` method.

- [ ] **Step 1: Write the failing test**

Write `__tests__/cabinetMeshScaler.test.js`:

```js
var scaler = require('../utils/cabinetMeshScaler.js');

function mockMesh(name, center, size) {
  return {
    isMesh: true,
    name: name,
    position: { x: center.x, y: center.y, z: center.z,
                set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    scale: { x: 1, y: 1, z: 1,
             set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    geometry: {
      boundingBox: {
        min: { x: -size.x / 2, y: -size.y / 2, z: -size.z / 2 },
        max: { x: size.x / 2, y: size.y / 2, z: size.z / 2 }
      }
    },
    parent: null
  };
}

function mockGroup(meshes) {
  return {
    userData: {},
    children: meshes,
    traverse: function(fn) {
      fn(this);
      for (var i = 0; i < this.children.length; i++) fn(this.children[i]);
    }
  };
}

describe('cabinetMeshScaler.preprocess', function() {
  it('records mesh meta with name-based thickness axis', function() {
    var meshes = [
      mockMesh('Left', { x: -0.3, y: 1.0, z: 0.3 }, { x: 0.018, y: 2.0, z: 0.6 }),
      mockMesh('Right', { x: 0.3, y: 1.0, z: 0.3 }, { x: 0.018, y: 2.0, z: 0.6 }),
      mockMesh('Top', { x: 0, y: 2.0, z: 0.3 }, { x: 0.6, y: 0.018, z: 0.6 }),
      mockMesh('Bottom', { x: 0, y: 0.05, z: 0.3 }, { x: 0.6, y: 0.018, z: 0.6 }),
      mockMesh('Back', { x: 0, y: 1.0, z: 0.01 }, { x: 0.6, y: 2.0, z: 0.005 }),
      mockMesh('Door', { x: 0, y: 1.0, z: 0.6 }, { x: 0.6, y: 2.0, z: 0.018 })
    ];
    var g = mockGroup(meshes);
    scaler.preprocess(g);
    expect(g.userData.scalerMeta).toBeDefined();
    var metaList = g.userData.scalerMeta.meshes;
    var byName = {};
    for (var i = 0; i < metaList.length; i++) byName[metaList[i].node.name] = metaList[i];
    expect(byName['Left'].thicknessAxis).toBe('x');
    expect(byName['Right'].thicknessAxis).toBe('x');
    expect(byName['Top'].thicknessAxis).toBe('y');
    expect(byName['Bottom'].thicknessAxis).toBe('y');
    expect(byName['Back'].thicknessAxis).toBe('z');
    expect(byName['Door'].thicknessAxis).toBe('z');
  });

  it('falls back to thinnest axis for unnamed mesh', function() {
    var meshes = [
      mockMesh('Geom3D', { x: 0, y: 0.5, z: 0.3 }, { x: 0.5, y: 0.018, z: 0.5 })
    ];
    var g = mockGroup(meshes);
    scaler.preprocess(g);
    expect(g.userData.scalerMeta.meshes[0].thicknessAxis).toBe('y');
  });

  it('falls back to thinnest axis when name does not match known panels', function() {
    var meshes = [
      mockMesh('PushLatch', { x: 0.1, y: 1.0, z: 0.6 }, { x: 0.05, y: 0.05, z: 0.02 })
    ];
    var g = mockGroup(meshes);
    scaler.preprocess(g);
    expect(g.userData.scalerMeta.meshes[0].thicknessAxis).toBe('z');
  });
});

describe('cabinetMeshScaler.applyScale', function() {
  it('keeps thickness axis at 1 and scales other axes for Left panel', function() {
    var leftMesh = mockMesh('Left', { x: -0.3, y: 1.0, z: 0.3 },
                             { x: 0.018, y: 2.0, z: 0.6 });
    var g = mockGroup([leftMesh]);
    scaler.preprocess(g);
    scaler.applyScale(g, { x: 2, y: 1.5, z: 1 });
    expect(leftMesh.scale.x).toBe(1);
    expect(leftMesh.scale.y).toBe(1.5);
    expect(leftMesh.scale.z).toBe(1);
    expect(leftMesh.position.x).toBeCloseTo(-0.6, 5);
    expect(leftMesh.position.y).toBeCloseTo(1.5, 5);
    expect(leftMesh.position.z).toBeCloseTo(0.3, 5);
  });

  it('keeps thickness axis at 1 and scales other axes for Top panel', function() {
    var topMesh = mockMesh('Top', { x: 0, y: 2.0, z: 0.3 },
                            { x: 0.6, y: 0.018, z: 0.6 });
    var g = mockGroup([topMesh]);
    scaler.preprocess(g);
    scaler.applyScale(g, { x: 2, y: 1.5, z: 1.2 });
    expect(topMesh.scale.x).toBe(2);
    expect(topMesh.scale.y).toBe(1);
    expect(topMesh.scale.z).toBe(1.2);
    expect(topMesh.position.y).toBeCloseTo(3.0, 5);
  });

  it('exposes SCALE_RANGE bounds', function() {
    expect(scaler.SCALE_RANGE.min).toBe(0.5);
    expect(scaler.SCALE_RANGE.max).toBe(2.0);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest __tests__/cabinetMeshScaler.test.js`
Expected: FAIL with `Cannot find module '../utils/cabinetMeshScaler.js'`

- [ ] **Step 3: Implement utils/cabinetMeshScaler.js**

```js
var SCALE_RANGE = { min: 0.5, max: 2.0 };

var NAMED_THICKNESS = {
  Left: 'x', Right: 'x',
  Top: 'y', Bottom: 'y',
  Back: 'z', Door: 'z'
};

function inferThicknessByName(name) {
  if (!name) return null;
  var keys = Object.keys(NAMED_THICKNESS);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (name === k || name.indexOf('_' + k) >= 0 || name.indexOf(k + '_') >= 0) {
      return NAMED_THICKNESS[k];
    }
  }
  return null;
}

function inferThicknessByGeometry(node) {
  if (!node.geometry || !node.geometry.boundingBox) return 'y';
  var bb = node.geometry.boundingBox;
  var sx = bb.max.x - bb.min.x;
  var sy = bb.max.y - bb.min.y;
  var sz = bb.max.z - bb.min.z;
  if (sx <= sy && sx <= sz) return 'x';
  if (sy <= sx && sy <= sz) return 'y';
  return 'z';
}

function inferThicknessAxis(node) {
  return inferThicknessByName(node.name) || inferThicknessByGeometry(node);
}

function preprocess(group) {
  var meta = { meshes: [] };
  group.traverse(function(node) {
    if (!node.isMesh) return;
    var thicknessAxis = inferThicknessAxis(node);
    meta.meshes.push({
      node: node,
      thicknessAxis: thicknessAxis,
      origCenter: { x: node.position.x, y: node.position.y, z: node.position.z }
    });
  });
  group.userData.scalerMeta = meta;
}

function clampScale(s) {
  if (s < SCALE_RANGE.min) return SCALE_RANGE.min;
  if (s > SCALE_RANGE.max) return SCALE_RANGE.max;
  return s;
}

function applyScale(group, scale) {
  var meta = group.userData && group.userData.scalerMeta;
  if (!meta) return;
  var sx = clampScale(scale.x);
  var sy = clampScale(scale.y);
  var sz = clampScale(scale.z);
  for (var i = 0; i < meta.meshes.length; i++) {
    var m = meta.meshes[i];
    var meshSx = sx, meshSy = sy, meshSz = sz;
    if (m.thicknessAxis === 'x') meshSx = 1;
    else if (m.thicknessAxis === 'y') meshSy = 1;
    else meshSz = 1;
    m.node.scale.set(meshSx, meshSy, meshSz);
    m.node.position.set(
      m.origCenter.x * sx,
      m.origCenter.y * sy,
      m.origCenter.z * sz
    );
  }
}

module.exports = {
  preprocess: preprocess,
  applyScale: applyScale,
  inferThicknessAxis: inferThicknessAxis,
  SCALE_RANGE: SCALE_RANGE
};
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest __tests__/cabinetMeshScaler.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add utils/cabinetMeshScaler.js __tests__/cabinetMeshScaler.test.js
git commit -m "feat(pd3d): add cabinetMeshScaler with name-based panel detection"
```

---

## Task 4: pd3dStorage — layout CRUD via wx storage + file

**Files:**
- Create: `utils/pd3dStorage.js`
- Create: `__tests__/pd3dStorage.test.js`
- Reference: `__tests__/helpers/wx-mock.js` (existing mini program API mock)

`pd3dStorage` provides four entry points for layout persistence: save, list, load, delete. Photos go through `wx.saveFile` to persist to file system; layout records (without photo bytes, just the path) live in `wx.setStorageSync('pd3d_layouts', [...])`.

The save API takes a layout containing a temp photo path; it persists the photo (if not already persisted) and writes the layout. Returns a Promise for the save (because `wx.saveFile` is async); the rest are sync.

- [ ] **Step 1: Inspect the existing wx mock to know what is available**

Read: `__tests__/helpers/wx-mock.js`. We need to know which `wx.*` APIs exist so we can extend if needed. If `setStorageSync` / `getStorageSync` / `saveFile` / `removeSavedFile` are not all there, add them.

- [ ] **Step 2: Extend the wx mock if needed**

If `__tests__/helpers/wx-mock.js` is missing any of: `setStorageSync`, `getStorageSync`, `removeStorageSync`, `saveFile`, `removeSavedFile`, append:

```js
// In-memory storage for unit tests
var __storage = {};
var __files = {};

global.wx = global.wx || {};
global.wx.setStorageSync = function(k, v) { __storage[k] = JSON.parse(JSON.stringify(v)); };
global.wx.getStorageSync = function(k) {
  return __storage.hasOwnProperty(k) ? JSON.parse(JSON.stringify(__storage[k])) : '';
};
global.wx.removeStorageSync = function(k) { delete __storage[k]; };
global.wx.saveFile = function(opts) {
  var savedPath = 'wxfile://saved_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  __files[savedPath] = opts.tempFilePath;
  setTimeout(function() {
    if (opts.success) opts.success({ savedFilePath: savedPath });
  }, 0);
};
global.wx.removeSavedFile = function(opts) {
  delete __files[opts.filePath];
  setTimeout(function() { if (opts.success) opts.success({}); }, 0);
};
global.wx.__resetStorage = function() {
  __storage = {};
  __files = {};
};
```

If the mock file already exposes the same names but slightly different shapes, leave it alone — adapt the test instead.

- [ ] **Step 3: Write the failing test**

Write `__tests__/pd3dStorage.test.js`:

```js
require('./helpers/wx-mock.js');
var storage = require('../utils/pd3dStorage.js');

beforeEach(function() {
  if (global.wx.__resetStorage) global.wx.__resetStorage();
});

describe('pd3dStorage.saveLayout', function() {
  it('persists temp photo via wx.saveFile and stores layout', function(done) {
    storage.saveLayout({
      name: 'Layout A',
      photoPath: 'wxfile://temp_abc',
      wall: { width: 150, height: 260, depth: 60 },
      cabinets: [
        { widthCm: 50, isCustom: false, wallStartCm: 0,
          scale: { x: 1, y: 1, z: 1 } }
      ]
    }).then(function(saved) {
      expect(saved.id).toMatch(/^layout_/);
      expect(saved.photoPath).toMatch(/^wxfile:\/\/saved_/);
      var list = storage.listLayouts();
      expect(list.length).toBe(1);
      expect(list[0].name).toBe('Layout A');
      done();
    });
  });

  it('updates existing layout when id provided', function(done) {
    storage.saveLayout({
      name: 'A', photoPath: 'wxfile://t1',
      wall: { width: 150, height: 260, depth: 60 }, cabinets: []
    }).then(function(s1) {
      return storage.saveLayout({
        id: s1.id, name: 'A renamed',
        photoPath: s1.photoPath,
        wall: { width: 200, height: 260, depth: 60 }, cabinets: []
      });
    }).then(function(s2) {
      var list = storage.listLayouts();
      expect(list.length).toBe(1);
      expect(list[0].name).toBe('A renamed');
      expect(list[0].wall.width).toBe(200);
      done();
    });
  });

  it('does not re-save photo when path is already wxfile://saved_', function(done) {
    storage.saveLayout({
      name: 'A', photoPath: 'wxfile://saved_existing',
      wall: { width: 150, height: 260, depth: 60 }, cabinets: []
    }).then(function(s) {
      expect(s.photoPath).toBe('wxfile://saved_existing');
      done();
    });
  });
});

describe('pd3dStorage.listLayouts', function() {
  it('returns empty array when no layouts', function() {
    expect(storage.listLayouts()).toEqual([]);
  });

  it('returns summaries in createdAt desc order', function(done) {
    storage.saveLayout({
      name: 'older', photoPath: 'wxfile://t',
      wall: { width: 150, height: 260, depth: 60 }, cabinets: []
    }).then(function() {
      return new Promise(function(r) { setTimeout(r, 5); });
    }).then(function() {
      return storage.saveLayout({
        name: 'newer', photoPath: 'wxfile://t',
        wall: { width: 150, height: 260, depth: 60 }, cabinets: []
      });
    }).then(function() {
      var list = storage.listLayouts();
      expect(list[0].name).toBe('newer');
      expect(list[1].name).toBe('older');
      done();
    });
  });
});

describe('pd3dStorage.loadLayout', function() {
  it('returns full layout by id', function(done) {
    storage.saveLayout({
      name: 'A', photoPath: 'wxfile://t',
      wall: { width: 150, height: 260, depth: 60 },
      cabinets: [
        { widthCm: 50, isCustom: false, wallStartCm: 0,
          scale: { x: 1, y: 1, z: 1 } }
      ]
    }).then(function(saved) {
      var loaded = storage.loadLayout(saved.id);
      expect(loaded.name).toBe('A');
      expect(loaded.cabinets.length).toBe(1);
      done();
    });
  });

  it('returns null for unknown id', function() {
    expect(storage.loadLayout('layout_does_not_exist')).toBe(null);
  });
});

describe('pd3dStorage.deleteLayout', function() {
  it('removes layout and its photo', function(done) {
    storage.saveLayout({
      name: 'A', photoPath: 'wxfile://t',
      wall: { width: 150, height: 260, depth: 60 }, cabinets: []
    }).then(function(saved) {
      storage.deleteLayout(saved.id);
      expect(storage.listLayouts().length).toBe(0);
      expect(storage.loadLayout(saved.id)).toBe(null);
      done();
    });
  });
});
```

- [ ] **Step 4: Run test to verify failure**

Run: `npx jest __tests__/pd3dStorage.test.js`
Expected: FAIL with `Cannot find module '../utils/pd3dStorage.js'`

- [ ] **Step 5: Implement utils/pd3dStorage.js**

```js
var STORAGE_KEY = 'pd3d_layouts';

function readAll() {
  var raw = wx.getStorageSync(STORAGE_KEY);
  if (!raw || !Array.isArray(raw)) return [];
  return raw;
}

function writeAll(list) {
  wx.setStorageSync(STORAGE_KEY, list);
}

function genId() {
  return 'layout_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

function persistPhoto(tempPath) {
  return new Promise(function(resolve, reject) {
    if (!tempPath) {
      resolve('');
      return;
    }
    if (tempPath.indexOf('wxfile://saved_') === 0 ||
        tempPath.indexOf('http://usr/') === 0 ||
        tempPath.indexOf('store_') >= 0) {
      resolve(tempPath);
      return;
    }
    wx.saveFile({
      tempFilePath: tempPath,
      success: function(res) { resolve(res.savedFilePath); },
      fail: function(err) { reject(err); }
    });
  });
}

function saveLayout(layout) {
  return persistPhoto(layout.photoPath).then(function(savedPath) {
    var all = readAll();
    var now = Date.now();
    var id = layout.id || genId();
    var record = {
      id: id,
      name: layout.name || '未命名方案',
      createdAt: layout.createdAt || now,
      updatedAt: now,
      photoPath: savedPath,
      wall: {
        width: layout.wall.width,
        height: layout.wall.height,
        depth: layout.wall.depth
      },
      cabinets: layout.cabinets || []
    };
    var existingIdx = -1;
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) { existingIdx = i; break; }
    }
    if (existingIdx >= 0) {
      record.createdAt = all[existingIdx].createdAt;
      all[existingIdx] = record;
    } else {
      all.push(record);
    }
    writeAll(all);
    return { id: record.id, photoPath: record.photoPath };
  });
}

function listLayouts() {
  var all = readAll();
  var summaries = all.map(function(l) {
    return {
      id: l.id,
      name: l.name,
      photoPath: l.photoPath,
      wall: l.wall,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      cabinetCount: (l.cabinets || []).length
    };
  });
  summaries.sort(function(a, b) { return b.createdAt - a.createdAt; });
  return summaries;
}

function loadLayout(id) {
  var all = readAll();
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) return all[i];
  }
  return null;
}

function deleteLayout(id) {
  var all = readAll();
  var photoPath = null;
  var kept = [];
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) {
      photoPath = all[i].photoPath;
    } else {
      kept.push(all[i]);
    }
  }
  writeAll(kept);
  if (photoPath && photoPath.indexOf('wxfile://') === 0) {
    try {
      wx.removeSavedFile({ filePath: photoPath, success: function() {}, fail: function() {} });
    } catch (e) {}
  }
}

module.exports = {
  saveLayout: saveLayout,
  listLayouts: listLayouts,
  loadLayout: loadLayout,
  deleteLayout: deleteLayout,
  STORAGE_KEY: STORAGE_KEY
};
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npx jest __tests__/pd3dStorage.test.js`
Expected: PASS (8 tests)

- [ ] **Step 7: Commit**

```bash
git add utils/pd3dStorage.js __tests__/pd3dStorage.test.js __tests__/helpers/wx-mock.js
git commit -m "feat(pd3d): add pd3dStorage layout CRUD with wx.saveFile and wx.setStorageSync"
```

---

## Task 5: pd3dSceneManager skeleton — room, lights, camera, dispose

**Files:**
- Create: `utils/pd3dSceneManager.js` (initial version)

This task introduces only the scene scaffolding: renderer + scene + camera, room walls (back/left/right/floor/ceiling), green placement zone, lighting, orbit camera control, dispose. Cabinet handling is added in Task 6.

This is environment-dependent code (needs Three.js + canvas) so we don't write Jest tests for it. Manual smoke test happens in Task 9 once the page wires it together.

- [ ] **Step 1: Create utils/pd3dSceneManager.js**

```js
var meshScaler = require('./cabinetMeshScaler.js');

var CABINET_DEPTH_M = 0.60;
var CABINET_HEIGHT_M = 2.30;
var PLACEMENT_COLOR = 0x90ee90;
var SIDE_WALL_COLOR = 0xd4c8b8;
var FLOOR_COLOR = 0x3a3530;
var CEIL_COLOR = 0xf0ece6;

function createSceneManager(canvas, THREE) {
  var renderer = null;
  var scene = null;
  var camera = null;
  var roomGroup = null;
  var cabinetGroup = null;
  var highlightMesh = null;

  var wallWidthM = 1.5;
  var wallHeightM = 2.6;
  var wallDepthM = 0.6;

  var theta = 0.3;
  var phi = Math.PI / 4;
  var radius = 4;
  var target = { x: 0, y: 1.3, z: 1.5 };

  var initialCamState = null;

  function init(wallCm, photoCanvas) {
    wallWidthM = wallCm.width / 100;
    wallHeightM = wallCm.height / 100;
    wallDepthM = wallCm.depth / 100;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(2);
    renderer.setSize(canvas.width, canvas.height, false);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(45, canvas.width / Math.max(canvas.height, 1), 0.1, 100);
    radius = Math.max(wallWidthM, wallHeightM) * 1.6;
    target.x = 0;
    target.y = wallHeightM / 2;
    target.z = wallDepthM / 2;
    initialCamState = { theta: theta, phi: phi, radius: radius,
                       target: { x: target.x, y: target.y, z: target.z } };
    _updateCamera();

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    var keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(0, wallHeightM * 0.7, -wallDepthM * 0.8);
    scene.add(keyLight);
    var fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-wallWidthM / 2, wallHeightM * 0.4, -wallDepthM * 0.5);
    scene.add(fillLight);

    roomGroup = new THREE.Group();
    scene.add(roomGroup);
    _buildRoom(THREE, photoCanvas);

    cabinetGroup = new THREE.Group();
    scene.add(cabinetGroup);

    renderer.render(scene, camera);
  }

  function _buildRoom(THREE, photoCanvas) {
    var halfW = wallWidthM / 2;

    // Back wall with photo texture
    var backGeo = new THREE.PlaneGeometry(wallWidthM, wallHeightM);
    var backMat;
    if (photoCanvas) {
      var tex = new THREE.CanvasTexture(photoCanvas);
      tex.needsUpdate = true;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      backMat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.FrontSide, roughness: 0.6 });
    } else {
      backMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6 });
    }
    var back = new THREE.Mesh(backGeo, backMat);
    back.rotation.y = Math.PI;
    back.position.set(0, wallHeightM / 2, 0);
    roomGroup.add(back);

    // Side walls
    var leftGeo = new THREE.PlaneGeometry(wallDepthM, wallHeightM);
    var leftMat = new THREE.MeshStandardMaterial({ color: SIDE_WALL_COLOR, roughness: 0.65 });
    var left = new THREE.Mesh(leftGeo, leftMat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-halfW, wallHeightM / 2, wallDepthM / 2);
    roomGroup.add(left);

    var rightGeo = new THREE.PlaneGeometry(wallDepthM, wallHeightM);
    var rightMat = new THREE.MeshStandardMaterial({ color: SIDE_WALL_COLOR, roughness: 0.65 });
    var right = new THREE.Mesh(rightGeo, rightMat);
    right.rotation.y = -Math.PI / 2;
    right.position.set(halfW, wallHeightM / 2, wallDepthM / 2);
    roomGroup.add(right);

    // Floor
    var floorGeo = new THREE.PlaneGeometry(wallWidthM, wallDepthM);
    var floorMat = new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.85, side: THREE.DoubleSide });
    var floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, wallDepthM / 2);
    roomGroup.add(floor);

    // Ceiling
    var ceilGeo = new THREE.PlaneGeometry(wallWidthM, wallDepthM);
    var ceilMat = new THREE.MeshStandardMaterial({ color: CEIL_COLOR, roughness: 0.8, side: THREE.DoubleSide });
    var ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, wallHeightM, wallDepthM / 2);
    roomGroup.add(ceil);

    // Placement zone strip on floor (along back wall, depth = cabinet depth)
    var stripGeo = new THREE.PlaneGeometry(wallWidthM, CABINET_DEPTH_M);
    var stripMat = new THREE.MeshBasicMaterial({
      color: PLACEMENT_COLOR, transparent: true, opacity: 0.25, depthWrite: false
    });
    var strip = new THREE.Mesh(stripGeo, stripMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.001, CABINET_DEPTH_M / 2);
    roomGroup.add(strip);
  }

  function _updateCamera() {
    var sp = Math.sin(phi);
    var cp = Math.cos(phi);
    var st = Math.sin(theta);
    var ct = Math.cos(theta);
    camera.position.set(
      target.x + radius * cp * st,
      target.y + radius * sp,
      target.z - radius * cp * ct
    );
    camera.lookAt(target.x, target.y, target.z);
  }

  function resetCamera() {
    if (!initialCamState) return;
    theta = initialCamState.theta;
    phi = initialCamState.phi;
    radius = initialCamState.radius;
    target.x = initialCamState.target.x;
    target.y = initialCamState.target.y;
    target.z = initialCamState.target.z;
    _updateCamera();
    if (renderer) renderer.render(scene, camera);
  }

  // Touch state for orbit
  var touchStart = null;
  var touchStartDist = 0;

  function _dist(a, b) { var dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }

  function handleTouchStart(touches) {
    if (!touches || touches.length === 0) return;
    touchStart = { x: touches[0].x, y: touches[0].y };
    touchStartDist = touches.length >= 2 ? _dist(touches[0], touches[1]) : 0;
  }

  function handleTouchMove(touches) {
    if (!touchStart || !touches || touches.length === 0) return;
    if (touches.length >= 2 && touchStartDist > 0) {
      var newDist = _dist(touches[0], touches[1]);
      var ratio = touchStartDist / Math.max(newDist, 1);
      radius = Math.max(1.0, Math.min(30, radius * ratio));
      touchStartDist = newDist;
    } else if (touches.length === 1) {
      var dx = touches[0].x - touchStart.x;
      var dy = touches[0].y - touchStart.y;
      theta -= dx * 0.008;
      phi += dy * 0.008;
      phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, phi));
      touchStart.x = touches[0].x;
      touchStart.y = touches[0].y;
    }
    _updateCamera();
    if (renderer) renderer.render(scene, camera);
  }

  function handleTouchEnd() {
    touchStart = null;
    touchStartDist = 0;
  }

  function animate() {
    if (!canvas || !renderer || !scene || !camera) return;
    canvas.requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  function _disposeGroup(g) {
    if (!g) return;
    while (g.children.length > 0) {
      var c = g.children[0];
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) {
          c.material.forEach(function(m) { if (m.map) m.map.dispose(); m.dispose(); });
        } else {
          if (c.material.map) c.material.map.dispose();
          c.material.dispose();
        }
      }
      g.remove(c);
    }
  }

  function dispose() {
    _disposeGroup(cabinetGroup);
    _disposeGroup(roomGroup);
    if (renderer) renderer.dispose();
    renderer = null; scene = null; camera = null;
    roomGroup = null; cabinetGroup = null; highlightMesh = null;
  }

  return {
    init: init,
    dispose: dispose,
    animate: animate,
    resetCamera: resetCamera,
    handleTouchStart: handleTouchStart,
    handleTouchMove: handleTouchMove,
    handleTouchEnd: handleTouchEnd,
    // Filled in by Task 6:
    addCabinet: function() {},
    removeCabinetByInstanceId: function() {},
    repositionCabinet: function() {},
    setCabinetScale: function() {},
    selectCabinetByInstanceId: function() {},
    clearSelection: function() {},
    hitTest: function() { return null; },
    getCabinets: function() { return []; }
  };
}

module.exports = {
  createSceneManager: createSceneManager,
  CABINET_DEPTH_M: CABINET_DEPTH_M,
  CABINET_HEIGHT_M: CABINET_HEIGHT_M
};
```

- [ ] **Step 2: Run existing tests to make sure nothing breaks**

Run: `npx jest`
Expected: PASS — only adds a new file; no existing tests touch it.

- [ ] **Step 3: Commit**

```bash
git add utils/pd3dSceneManager.js
git commit -m "feat(pd3d): add pd3dSceneManager skeleton with room, lights, orbit camera"
```

---

## Task 6: pd3dSceneManager — cabinet loading and management

**Files:**
- Modify: `utils/pd3dSceneManager.js`

This task fills in the cabinet-related methods stubbed in Task 5: GLB loading per cabinet, position computation from `wallStartCm` and `widthCm`, scaling via `cabinetMeshScaler`, ray-casting for selection, highlight outline, removal.

**Cabinet positioning rule:** A cabinet at `wallStartCm` with `widthCm` is centered at world X = `(wallStartCm + widthCm/2)/100 - wallWidthM/2`. Y center = `CABINET_HEIGHT_M/2`. Z center = `CABINET_DEPTH_M/2` (back face flush with z=0).

**GLB normalization:** A loaded GLB is centered/scaled so its bounding box matches `(widthCm/100) × CABINET_HEIGHT_M × CABINET_DEPTH_M`. This is the "base" unscaled size; user-controlled `scale` multiplies on top.

- [ ] **Step 1: Replace the stubs in utils/pd3dSceneManager.js**

Find the `return { ... }` block at the bottom and replace it with the full implementation below. Also add the new module-level state and helper functions.

Add these state variables after `var highlightMesh = null;`:

```js
  var cabinets = []; // array of { instanceId, modelId, widthCm, isCustom, wallStartCm, scale, group, baseSize }
  var GLTFLoaderModule = null; // optional setter from page
```

Add these helper functions before the `return` statement:

```js
  function _newInstanceId() {
    return 'cab_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }

  function _xCenterM(wallStartCm, widthCm) {
    return (wallStartCm + widthCm / 2) / 100 - wallWidthM / 2;
  }

  function _loadGLB(path) {
    return new Promise(function(resolve, reject) {
      try {
        var fs = wx.getFileSystemManager();
        var data = null;
        var paths = [path];
        if (path.indexOf('/') !== 0) paths.push('/' + path);
        for (var i = 0; i < paths.length; i++) {
          try { data = fs.readFileSync(paths[i]); break; } catch (e) {}
        }
        if (!data || data.byteLength === 0) {
          reject(new Error('GLB read failed'));
          return;
        }
        new THREE.GLTFLoader().parse(data, '', function(gltf) {
          if (!gltf || !gltf.scene) {
            reject(new Error('GLB parse empty'));
            return;
          }
          resolve(gltf.scene);
        }, function(err) {
          reject(err || new Error('GLB parse failed'));
        });
      } catch (e) { reject(e); }
    });
  }

  function _normalizeCabinetMesh(group, widthCm) {
    var box = new THREE.Box3().setFromObject(group);
    var size = new THREE.Vector3();
    box.getSize(size);
    var center = new THREE.Vector3();
    box.getCenter(center);
    var targetW = widthCm / 100;
    var targetH = CABINET_HEIGHT_M;
    var targetD = CABINET_DEPTH_M;
    var sx = size.x > 0.001 ? targetW / size.x : 1;
    var sy = size.y > 0.001 ? targetH / size.y : 1;
    var sz = size.z > 0.001 ? targetD / size.z : 1;
    var wrap = new THREE.Group();
    group.position.set(-center.x, -center.y, -center.z);
    var inner = new THREE.Group();
    inner.add(group);
    inner.scale.set(sx, sy, sz);
    inner.position.set(0, targetH / 2, 0);
    wrap.add(inner);
    return { wrap: wrap, baseSize: { x: targetW, y: targetH, z: targetD } };
  }

  function addCabinet(spec) {
    var path = spec.modelPath;
    if (!path) return Promise.reject(new Error('missing modelPath'));
    return _loadGLB(path).then(function(gltfScene) {
      var n = _normalizeCabinetMesh(gltfScene, spec.widthCm);
      meshScaler.preprocess(n.wrap);
      var sx = (spec.scale && spec.scale.x) || 1;
      var sy = (spec.scale && spec.scale.y) || 1;
      var sz = (spec.scale && spec.scale.z) || 1;
      meshScaler.applyScale(n.wrap, { x: sx, y: sy, z: sz });
      var instanceId = spec.instanceId || _newInstanceId();
      n.wrap.userData.instanceId = instanceId;
      n.wrap.position.set(_xCenterM(spec.wallStartCm, spec.widthCm), 0, CABINET_DEPTH_M / 2);
      cabinetGroup.add(n.wrap);
      cabinets.push({
        instanceId: instanceId,
        modelId: spec.modelId,
        widthCm: spec.widthCm,
        isCustom: !!spec.isCustom,
        wallStartCm: spec.wallStartCm,
        scale: { x: sx, y: sy, z: sz },
        group: n.wrap,
        baseSize: n.baseSize
      });
      if (renderer) renderer.render(scene, camera);
      return instanceId;
    });
  }

  function _findCabinet(instanceId) {
    for (var i = 0; i < cabinets.length; i++) {
      if (cabinets[i].instanceId === instanceId) return cabinets[i];
    }
    return null;
  }

  function setCabinetScale(instanceId, scale) {
    var c = _findCabinet(instanceId);
    if (!c) return;
    c.scale = { x: scale.x, y: scale.y, z: scale.z };
    meshScaler.applyScale(c.group, scale);
    if (renderer) renderer.render(scene, camera);
  }

  function _disposeWrap(wrap) {
    wrap.traverse(function(node) {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        if (Array.isArray(node.material)) {
          node.material.forEach(function(m) { if (m.map) m.map.dispose(); m.dispose(); });
        } else {
          if (node.material.map) node.material.map.dispose();
          node.material.dispose();
        }
      }
    });
  }

  function removeCabinetByInstanceId(instanceId) {
    for (var i = 0; i < cabinets.length; i++) {
      if (cabinets[i].instanceId === instanceId) {
        cabinetGroup.remove(cabinets[i].group);
        _disposeWrap(cabinets[i].group);
        cabinets.splice(i, 1);
        clearSelection();
        if (renderer) renderer.render(scene, camera);
        return;
      }
    }
  }

  function repositionCabinet(instanceId, wallStartCm, widthCm, isCustom) {
    var c = _findCabinet(instanceId);
    if (!c) return;
    c.wallStartCm = wallStartCm;
    c.widthCm = widthCm;
    c.isCustom = !!isCustom;
    c.group.position.x = _xCenterM(wallStartCm, widthCm);
    if (renderer) renderer.render(scene, camera);
  }

  function selectCabinetByInstanceId(instanceId) {
    clearSelection();
    var c = _findCabinet(instanceId);
    if (!c) return;
    var s = c.baseSize;
    var hlGeo = new THREE.BoxGeometry(s.x * c.scale.x + 0.02,
                                       s.y * c.scale.y + 0.02,
                                       s.z * c.scale.z + 0.02);
    var hlMat = new THREE.MeshBasicMaterial({
      color: 0xFC9700, transparent: true, opacity: 0.3,
      depthTest: true, depthWrite: false
    });
    highlightMesh = new THREE.Mesh(hlGeo, hlMat);
    highlightMesh.position.copy(c.group.position);
    highlightMesh.position.y = (s.y * c.scale.y) / 2;
    cabinetGroup.add(highlightMesh);
    if (renderer) renderer.render(scene, camera);
  }

  function clearSelection() {
    if (highlightMesh) {
      cabinetGroup.remove(highlightMesh);
      if (highlightMesh.geometry) highlightMesh.geometry.dispose();
      if (highlightMesh.material) highlightMesh.material.dispose();
      highlightMesh = null;
    }
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  function hitTest(tapX, tapY) {
    if (!camera || !canvas.width || !canvas.height) return null;
    var ndc = {
      x: (tapX / canvas.width) * 2 - 1,
      y: -(tapY / canvas.height) * 2 + 1
    };
    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    var targets = cabinets.map(function(c) { return c.group; });
    var hits = raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      var hit = hits[0].object;
      while (hit && !hit.userData.instanceId) hit = hit.parent;
      if (hit && hit.userData.instanceId) {
        return { instanceId: hit.userData.instanceId };
      }
    }
    return null;
  }

  function getCabinets() {
    return cabinets.map(function(c) {
      return {
        instanceId: c.instanceId, modelId: c.modelId,
        widthCm: c.widthCm, isCustom: c.isCustom,
        wallStartCm: c.wallStartCm,
        scale: { x: c.scale.x, y: c.scale.y, z: c.scale.z }
      };
    });
  }
```

Replace the entire `return { ... }` at the bottom with:

```js
  return {
    init: init,
    dispose: dispose,
    animate: animate,
    resetCamera: resetCamera,
    handleTouchStart: handleTouchStart,
    handleTouchMove: handleTouchMove,
    handleTouchEnd: handleTouchEnd,
    addCabinet: addCabinet,
    removeCabinetByInstanceId: removeCabinetByInstanceId,
    repositionCabinet: repositionCabinet,
    setCabinetScale: setCabinetScale,
    selectCabinetByInstanceId: selectCabinetByInstanceId,
    clearSelection: clearSelection,
    hitTest: hitTest,
    getCabinets: getCabinets
  };
```

- [ ] **Step 2: Run existing tests to make sure nothing breaks**

Run: `npx jest`
Expected: PASS — this file is not exercised by Jest; only confirming syntax is valid.

- [ ] **Step 3: Commit**

```bash
git add utils/pd3dSceneManager.js
git commit -m "feat(pd3d): add cabinet load/place/scale/select to sceneManager"
```

---

## Task 7: pd3d page files — config, template, styles

**Files:**
- Create: `pages/knowledge/pd3d/pd3d.json`
- Create: `pages/knowledge/pd3d/pd3d.wxml`
- Create: `pages/knowledge/pd3d/pd3d.wxss`

This task creates the static page files. The JS controller comes in Task 8.

- [ ] **Step 1: Create pd3d.json**

```json
{
  "navigationStyle": "custom",
  "usingComponents": {}
}
```

- [ ] **Step 2: Create pd3d.wxml**

```xml
<view class="page">
  <view class="custom-nav" style="padding-top: {{statusBarHeight}}px;">
    <view class="nav-bar" style="height: {{navBarHeight}}px;">
      <view class="nav-back" bindtap="goBack"><text class="nav-back-icon">‹</text></view>
      <text class="nav-title">空间布置</text>
      <view class="nav-action" bindtap="openLayoutDrawer">
        <text class="nav-action-text">方案列表</text>
      </view>
    </view>
  </view>

  <view class="canvas-wrapper" style="padding-top: {{statusBarHeight + navBarHeight}}px;">
    <canvas wx:if="{{mode !== 'init'}}"
      type="webgl"
      id="pd3dCanvas"
      class="pd3d-canvas"
      bindtouchstart="onCanvasTouchStart"
      bindtouchmove="onCanvasTouchMove"
      bindtouchend="onCanvasTouchEnd"></canvas>
    <view wx:if="{{mode === 'init'}}" class="init-hint">
      <text>输入墙面尺寸 · 上传照片 · 开始布置</text>
    </view>
  </view>

  <view class="bottom-bar">
    <block wx:if="{{mode === 'init'}}">
      <view class="dims-row">
        <text class="dims-label">宽</text>
        <input class="dims-input" type="number" value="{{wallWidth}}" bindinput="onWallWidthInput" bindblur="onWallWidthBlur" />
        <text class="dims-label">高</text>
        <input class="dims-input" type="number" value="{{wallHeight}}" bindinput="onWallHeightInput" bindblur="onWallHeightBlur" />
        <text class="dims-label">深</text>
        <input class="dims-input" type="number" value="{{wallDepth}}" bindinput="onWallDepthInput" bindblur="onWallDepthBlur" />
        <text class="dims-label">cm</text>
      </view>
      <view class="btn btn-primary btn-block" bindtap="onUploadAndStart">
        <text>上传照片并开始</text>
      </view>
    </block>

    <block wx:if="{{mode === 'placing'}}">
      <view class="chip-row">
        <view wx:for="{{modelList}}" wx:key="id"
          class="chip {{selectedModelId === item.id ? 'chip-active' : ''}}"
          bindtap="onSelectModel" data-id="{{item.id}}">
          <text>{{item.label}}</text>
        </view>
      </view>
      <view class="chip-row">
        <view class="chip {{selectedWidthCm === 50 ? 'chip-active' : ''}}"
          bindtap="onSelectWidth" data-w="50"><text>50cm</text></view>
        <view class="chip {{selectedWidthCm === 100 ? 'chip-active' : ''}}"
          bindtap="onSelectWidth" data-w="100"><text>100cm</text></view>
        <view class="btn btn-primary" bindtap="onAddCabinet"><text>添加柜子</text></view>
        <view class="btn btn-outline" bindtap="onFinalize"><text>完成布置</text></view>
      </view>
      <view class="chip-row">
        <view class="btn btn-outline" bindtap="onResetCamera"><text>重置视角</text></view>
        <view class="btn btn-primary" bindtap="onSaveLayout"><text>保存方案</text></view>
      </view>
    </block>

    <block wx:if="{{mode === 'selected'}}">
      <view class="slider-row">
        <text class="slider-label">宽 {{selScale.x}}</text>
        <slider min="50" max="200" step="5" value="{{selScalePct.x}}"
          bindchange="onScaleX" activeColor="#FC9700" />
      </view>
      <view class="slider-row">
        <text class="slider-label">高 {{selScale.y}}</text>
        <slider min="50" max="200" step="5" value="{{selScalePct.y}}"
          bindchange="onScaleY" activeColor="#FC9700" />
      </view>
      <view class="slider-row">
        <text class="slider-label">深 {{selScale.z}}</text>
        <slider min="50" max="200" step="5" value="{{selScalePct.z}}"
          bindchange="onScaleZ" activeColor="#FC9700" />
      </view>
      <view class="chip-row">
        <view class="btn btn-outline" bindtap="onCancelSelection"><text>取消选中</text></view>
        <view class="btn btn-danger" bindtap="onDeleteSelected"><text>删除</text></view>
      </view>
    </block>
  </view>

  <view class="drawer-mask {{drawerOpen ? 'drawer-mask-open' : ''}}" bindtap="closeLayoutDrawer"></view>
  <view class="drawer {{drawerOpen ? 'drawer-open' : ''}}">
    <view class="drawer-header"><text>已保存的方案</text></view>
    <scroll-view class="drawer-list" scroll-y>
      <block wx:if="{{savedLayouts.length === 0}}">
        <view class="drawer-empty"><text>还没有方案。布置完成后点保存。</text></view>
      </block>
      <view wx:for="{{savedLayouts}}" wx:key="id" class="drawer-item">
        <view class="drawer-item-info" bindtap="onLoadLayout" data-id="{{item.id}}">
          <text class="drawer-item-name">{{item.name}}</text>
          <text class="drawer-item-meta">{{item.wall.width}}×{{item.wall.height}}×{{item.wall.depth}}cm · {{item.cabinetCount}}个柜</text>
        </view>
        <view class="drawer-item-del" bindtap="onDeleteLayout" data-id="{{item.id}}"><text>删除</text></view>
      </view>
    </scroll-view>
  </view>

  <canvas type="2d" id="texturePrepCanvas" class="hidden-canvas"
    style="width: 512px; height: 512px;"></canvas>
</view>
```

- [ ] **Step 3: Create pd3d.wxss**

```css
.page { width: 100%; height: 100vh; background: #1a1a1a; position: relative; overflow: hidden; }
.custom-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100;
              background: rgba(26,26,26,0.85); }
.nav-bar { display: flex; align-items: center; padding: 0 24rpx; }
.nav-back { width: 60rpx; }
.nav-back-icon { color: #fff; font-size: 56rpx; }
.nav-title { color: #fff; font-size: 32rpx; flex: 1; text-align: center; }
.nav-action { padding: 0 16rpx; }
.nav-action-text { color: #FC9700; font-size: 28rpx; }
.canvas-wrapper { width: 100%; height: 100%; box-sizing: border-box; padding-bottom: 380rpx; }
.pd3d-canvas { width: 100%; height: 100%; display: block; }
.init-hint { color: #888; text-align: center; padding-top: 200rpx; font-size: 28rpx; }
.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; background: #222;
              padding: 16rpx 24rpx env(safe-area-inset-bottom); z-index: 50; }
.dims-row { display: flex; align-items: center; gap: 12rpx; padding-bottom: 16rpx; }
.dims-label { color: #aaa; font-size: 26rpx; }
.dims-input { background: #333; color: #fff; border-radius: 8rpx; flex: 1; padding: 8rpx 12rpx;
              text-align: center; font-size: 26rpx; min-width: 0; }
.chip-row { display: flex; flex-wrap: wrap; gap: 12rpx; padding-bottom: 12rpx; }
.chip { padding: 12rpx 20rpx; background: #333; color: #ccc; border-radius: 999rpx;
        font-size: 24rpx; }
.chip-active { background: #FC9700; color: #fff; }
.btn { padding: 14rpx 28rpx; border-radius: 8rpx; font-size: 26rpx; }
.btn-primary { background: #FC9700; color: #fff; }
.btn-outline { background: transparent; color: #FC9700; border: 1rpx solid #FC9700; }
.btn-danger { background: #d04444; color: #fff; }
.btn-block { width: 100%; text-align: center; padding: 22rpx 0; }
.slider-row { display: flex; align-items: center; gap: 16rpx; padding: 6rpx 0; }
.slider-label { color: #ccc; font-size: 24rpx; min-width: 110rpx; }
.slider-row slider { flex: 1; }
.drawer-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200;
               opacity: 0; pointer-events: none; transition: opacity .2s; }
.drawer-mask-open { opacity: 1; pointer-events: auto; }
.drawer { position: fixed; right: 0; top: 0; bottom: 0; width: 80%; background: #2a2a2a;
          transform: translateX(100%); transition: transform .25s ease; z-index: 201;
          display: flex; flex-direction: column; }
.drawer-open { transform: translateX(0); }
.drawer-header { color: #fff; font-size: 32rpx; padding: 32rpx 24rpx 16rpx; }
.drawer-list { flex: 1; }
.drawer-item { display: flex; align-items: center; padding: 20rpx 24rpx;
               border-bottom: 1rpx solid #333; }
.drawer-item-info { flex: 1; }
.drawer-item-name { color: #fff; font-size: 28rpx; display: block; }
.drawer-item-meta { color: #888; font-size: 22rpx; display: block; padding-top: 6rpx; }
.drawer-item-del { color: #d04444; font-size: 24rpx; padding: 8rpx 16rpx; }
.drawer-empty { color: #666; padding: 32rpx 24rpx; font-size: 26rpx; }
.hidden-canvas { position: fixed; left: -9999px; top: -9999px; pointer-events: none; }
```

- [ ] **Step 4: Commit**

```bash
git add pages/knowledge/pd3d/pd3d.json pages/knowledge/pd3d/pd3d.wxml pages/knowledge/pd3d/pd3d.wxss
git commit -m "feat(pd3d): add page template, config, and styles"
```

---

## Task 8: pd3d.js page controller

**Files:**
- Create: `pages/knowledge/pd3d/pd3d.js`

The page controller orchestrates UI state, scene manager, layout algorithm, catalog, and storage. It mirrors the patterns used in `pages/knowledge/glbviewer/glbviewer.js` for canvas init / Three.js scoped require / texture prep.

- [ ] **Step 1: Create pages/knowledge/pd3d/pd3d.js**

```js
var catalog = require('../../../utils/cabinetCatalog.js');
var layoutAlgo = require('../../../utils/cabinetLayout.js');
var storage = require('../../../utils/pd3dStorage.js');

Page({
  _canvas: null,
  _sceneManager: null,
  _THREE: null,
  _photoTempPath: '',
  _initRetry: 0,
  _activeLoadingId: null,

  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    mode: 'init',
    wallWidth: 150,
    wallHeight: 260,
    wallDepth: 60,
    modelList: [],
    selectedModelId: '100G1',
    selectedWidthCm: 50,
    cabinets: [],
    selectedInstanceId: '',
    selScale: { x: '1.00', y: '1.00', z: '1.00' },
    selScalePct: { x: 100, y: 100, z: 100 },
    drawerOpen: false,
    savedLayouts: [],
    currentLayoutId: ''
  },

  onLoad: function() {
    try {
      var sysInfo = wx.getWindowInfo();
      var menuBtn = wx.getMenuButtonBoundingClientRect();
      var statusBarHeight = sysInfo.statusBarHeight || 20;
      var navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
      this.setData({ statusBarHeight: statusBarHeight, navBarHeight: navBarHeight });
    } catch (e) {
      this.setData({ statusBarHeight: 20, navBarHeight: 44 });
    }
    this.setData({ modelList: catalog.listModels() });
  },

  onUnload: function() {
    this._teardownScene();
  },

  _teardownScene: function() {
    if (this._sceneManager) {
      try { this._sceneManager.dispose(); } catch (e) {}
      this._sceneManager = null;
      this._THREE = null;
    }
    this._canvas = null;
  },

  // -------- Wall input --------

  onWallWidthInput: function(e) { this.setData({ wallWidth: e.detail.value }); },
  onWallHeightInput: function(e) { this.setData({ wallHeight: e.detail.value }); },
  onWallDepthInput: function(e) { this.setData({ wallDepth: e.detail.value }); },

  onWallWidthBlur: function(e) {
    var v = parseInt(e.detail.value, 10);
    if (isNaN(v)) v = 150;
    v = Math.max(30, Math.min(1000, v));
    this.setData({ wallWidth: v });
  },
  onWallHeightBlur: function(e) {
    var v = parseInt(e.detail.value, 10);
    if (isNaN(v)) v = 260;
    v = Math.max(100, Math.min(1000, v));
    this.setData({ wallHeight: v });
  },
  onWallDepthBlur: function(e) {
    var v = parseInt(e.detail.value, 10);
    if (isNaN(v)) v = 60;
    v = Math.max(10, Math.min(150, v));
    this.setData({ wallDepth: v });
  },

  // -------- Upload + start --------

  onUploadAndStart: function() {
    var self = this;
    var w = parseInt(self.data.wallWidth, 10);
    var h = parseInt(self.data.wallHeight, 10);
    var d = parseInt(self.data.wallDepth, 10);
    if (!layoutAlgo.canFitWall(w)) {
      wx.showToast({ title: '墙宽过小', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        var temp = res.tempFiles[0].tempFilePath;
        self._photoTempPath = temp;
        self.setData({ mode: 'placing', cabinets: [], wallWidth: w, wallHeight: h, wallDepth: d });
        self._initRetry = 0;
        setTimeout(function() { self._initScene(); }, 200);
      }
    });
  },

  _initScene: function() {
    var self = this;
    var query = wx.createSelectorQuery().in(self);
    query.select('#pd3dCanvas').fields({ node: true, size: true }).exec(function(res) {
      if (!res || !res[0] || !res[0].node) {
        if ((self._initRetry = (self._initRetry || 0) + 1) < 8) {
          var delay = self._initRetry <= 3 ? 150 : 300;
          setTimeout(function() { self._initScene(); }, delay);
        } else {
          wx.showToast({ title: '3D 初始化失败', icon: 'none' });
          self.setData({ mode: 'init' });
        }
        return;
      }
      var canvas = res[0].node;
      canvas.width = res[0].width;
      canvas.height = res[0].height;
      self._canvas = canvas;
      self._prepareTextureCanvas(function(textureCanvas) {
        try {
          var scopedThree = require('../../../utils/threejs-miniprogram.js').createScopedThreejs(canvas);
          require('../../../utils/GLTFLoader.js')(scopedThree);
          self._THREE = scopedThree;
          var mgr = require('../../../utils/pd3dSceneManager.js').createSceneManager(canvas, scopedThree);
          mgr.init({
            width: parseInt(self.data.wallWidth, 10),
            height: parseInt(self.data.wallHeight, 10),
            depth: parseInt(self.data.wallDepth, 10)
          }, textureCanvas);
          self._sceneManager = mgr;
          mgr.animate();
        } catch (err) {
          console.error('[pd3d] init error', err);
          wx.showToast({ title: '3D 引擎启动失败', icon: 'none' });
          self.setData({ mode: 'init' });
        }
      });
    });
  },

  _prepareTextureCanvas: function(cb) {
    var self = this;
    var query = wx.createSelectorQuery().in(self);
    query.select('#texturePrepCanvas').fields({ node: true, size: true }).exec(function(res) {
      if (!res || !res[0] || !res[0].node) { cb(null); return; }
      var prep = res[0].node;
      prep.width = 1024;
      prep.height = 1024;
      var ctx = prep.getContext('2d');
      var img = prep.createImage();
      img.onload = function() {
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, prep.width, prep.height);
        cb(prep);
      };
      img.onerror = function() {
        ctx.fillStyle = '#555'; ctx.fillRect(0, 0, prep.width, prep.height);
        cb(prep);
      };
      img.src = self._photoTempPath || self.data.currentPhotoPath || '';
    });
  },

  // -------- Cabinet selection / placing --------

  onSelectModel: function(e) { this.setData({ selectedModelId: e.currentTarget.dataset.id }); },
  onSelectWidth: function(e) {
    this.setData({ selectedWidthCm: parseInt(e.currentTarget.dataset.w, 10) });
  },

  onAddCabinet: function() {
    var self = this;
    if (!self._sceneManager) return;
    var wallW = parseInt(self.data.wallWidth, 10);
    var widthCm = self.data.selectedWidthCm;
    var modelId = self.data.selectedModelId;
    var path = catalog.getModelPath(modelId);
    if (!path) { wx.showToast({ title: '模型不存在', icon: 'none' }); return; }

    var result = layoutAlgo.addStandard(self.data.cabinets, widthCm, wallW);
    if (!result.added) {
      var msg = result.error === 'finalized' ? '已完成布置，无法再加' : '空间不足';
      wx.showToast({ title: msg, icon: 'none' });
      return;
    }
    var newSpec = result.list[result.list.length - 1];
    wx.showLoading({ title: '加载柜子...' });
    self._sceneManager.addCabinet({
      modelId: modelId,
      modelPath: path,
      widthCm: newSpec.widthCm,
      wallStartCm: newSpec.wallStartCm,
      isCustom: newSpec.isCustom,
      scale: newSpec.scale
    }).then(function(instanceId) {
      wx.hideLoading();
      newSpec.instanceId = instanceId;
      self.setData({ cabinets: result.list });
    }).catch(function(err) {
      wx.hideLoading();
      console.error(err);
      wx.showToast({ title: '柜子加载失败', icon: 'none' });
    });
  },

  onFinalize: function() {
    var self = this;
    if (!self._sceneManager) return;
    var wallW = parseInt(self.data.wallWidth, 10);
    var result = layoutAlgo.finalize(self.data.cabinets, wallW);
    if (!result.list) {
      wx.showToast({ title: '剩余空间过小', icon: 'none' });
      return;
    }
    var oldList = self.data.cabinets;
    var newList = result.list;
    var oldHadCustom = oldList.length > 0 && oldList[oldList.length - 1].isCustom;
    if (oldHadCustom) {
      // remove old custom from scene before adding new one
      var oldCustom = oldList[oldList.length - 1];
      if (oldCustom.instanceId) {
        self._sceneManager.removeCabinetByInstanceId(oldCustom.instanceId);
      }
    }
    var newCustom = newList[newList.length - 1];
    var path = catalog.getModelPath(self.data.selectedModelId);
    wx.showLoading({ title: '生成非标柜...' });
    self._sceneManager.addCabinet({
      modelId: self.data.selectedModelId,
      modelPath: path,
      widthCm: newCustom.widthCm,
      wallStartCm: newCustom.wallStartCm,
      isCustom: true,
      scale: newCustom.scale
    }).then(function(instanceId) {
      wx.hideLoading();
      newCustom.instanceId = instanceId;
      // copy instanceIds from old standard list to new standard entries (same indices, same widths)
      for (var i = 0; i < newList.length - 1; i++) {
        if (oldList[i] && oldList[i].instanceId) {
          newList[i].instanceId = oldList[i].instanceId;
        }
      }
      self.setData({ cabinets: newList });
    }).catch(function(err) {
      wx.hideLoading();
      console.error(err);
      wx.showToast({ title: '生成失败', icon: 'none' });
    });
  },

  // -------- Touch + selection --------

  onCanvasTouchStart: function(e) {
    if (!this._sceneManager) return;
    this._touchStartXY = e.touches[0] ? { x: e.touches[0].x, y: e.touches[0].y } : null;
    this._touchMoved = false;
    this._sceneManager.handleTouchStart(e.touches);
  },
  onCanvasTouchMove: function(e) {
    if (!this._sceneManager) return;
    if (e.touches[0] && this._touchStartXY) {
      var dx = e.touches[0].x - this._touchStartXY.x;
      var dy = e.touches[0].y - this._touchStartXY.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this._touchMoved = true;
    }
    this._sceneManager.handleTouchMove(e.touches);
  },
  onCanvasTouchEnd: function(e) {
    if (!this._sceneManager) return;
    this._sceneManager.handleTouchEnd();
    if (!this._touchMoved && e.changedTouches[0]) {
      var hit = this._sceneManager.hitTest(e.changedTouches[0].x, e.changedTouches[0].y);
      if (hit) {
        this._selectInstance(hit.instanceId);
      } else if (this.data.mode === 'selected') {
        this._cancelSelection();
      }
    }
  },

  _selectInstance: function(instanceId) {
    var c = null;
    for (var i = 0; i < this.data.cabinets.length; i++) {
      if (this.data.cabinets[i].instanceId === instanceId) { c = this.data.cabinets[i]; break; }
    }
    if (!c) return;
    this._sceneManager.selectCabinetByInstanceId(instanceId);
    this.setData({
      mode: 'selected',
      selectedInstanceId: instanceId,
      selScale: { x: c.scale.x.toFixed(2), y: c.scale.y.toFixed(2), z: c.scale.z.toFixed(2) },
      selScalePct: {
        x: Math.round(c.scale.x * 100),
        y: Math.round(c.scale.y * 100),
        z: Math.round(c.scale.z * 100)
      }
    });
  },

  _cancelSelection: function() {
    if (this._sceneManager) this._sceneManager.clearSelection();
    this.setData({ mode: 'placing', selectedInstanceId: '' });
  },

  onCancelSelection: function() { this._cancelSelection(); },

  onScaleX: function(e) { this._applyScaleAxis('x', e.detail.value); },
  onScaleY: function(e) { this._applyScaleAxis('y', e.detail.value); },
  onScaleZ: function(e) { this._applyScaleAxis('z', e.detail.value); },

  _applyScaleAxis: function(axis, pct) {
    var id = this.data.selectedInstanceId;
    if (!id) return;
    var list = this.data.cabinets.slice();
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].instanceId === id) { idx = i; break; }
    if (idx < 0) return;
    var s = {
      x: list[idx].scale.x, y: list[idx].scale.y, z: list[idx].scale.z
    };
    s[axis] = pct / 100;
    list[idx] = {
      instanceId: list[idx].instanceId, modelId: list[idx].modelId,
      widthCm: list[idx].widthCm, isCustom: list[idx].isCustom,
      wallStartCm: list[idx].wallStartCm, scale: s
    };
    this._sceneManager.setCabinetScale(id, s);
    this._sceneManager.selectCabinetByInstanceId(id);
    var newPct = {
      x: this.data.selScalePct.x, y: this.data.selScalePct.y, z: this.data.selScalePct.z
    };
    newPct[axis] = pct;
    var newScale = {
      x: this.data.selScale.x, y: this.data.selScale.y, z: this.data.selScale.z
    };
    newScale[axis] = (pct / 100).toFixed(2);
    this.setData({ cabinets: list, selScalePct: newPct, selScale: newScale });
  },

  onDeleteSelected: function() {
    var self = this;
    var id = self.data.selectedInstanceId;
    if (!id) return;
    var idx = -1;
    var list = self.data.cabinets;
    for (var i = 0; i < list.length; i++) if (list[i].instanceId === id) { idx = i; break; }
    if (idx < 0) return;
    wx.showModal({
      title: '删除柜子', content: '确定删除这个柜子？',
      success: function(modal) {
        if (!modal.confirm) return;
        var wallW = parseInt(self.data.wallWidth, 10);
        var oldList = self.data.cabinets;
        var oldCustom = oldList.length > 0 && oldList[oldList.length - 1].isCustom
          ? oldList[oldList.length - 1] : null;
        var result = layoutAlgo.removeAt(oldList, idx, wallW);
        // Remove the deleted from scene
        self._sceneManager.removeCabinetByInstanceId(id);
        // If a custom existed before and the new list ends with a custom of different widthCm,
        // dispose the old custom mesh (if it wasn't already the deleted one) and add a new one.
        var newCustom = result.list.length > 0 && result.list[result.list.length - 1].isCustom
          ? result.list[result.list.length - 1] : null;
        if (oldCustom && oldCustom.instanceId !== id && newCustom &&
            newCustom.widthCm !== oldCustom.widthCm) {
          self._sceneManager.removeCabinetByInstanceId(oldCustom.instanceId);
          var path = catalog.getModelPath(self.data.selectedModelId);
          self._sceneManager.addCabinet({
            modelId: self.data.selectedModelId,
            modelPath: path,
            widthCm: newCustom.widthCm,
            wallStartCm: newCustom.wallStartCm,
            isCustom: true,
            scale: newCustom.scale
          }).then(function(newId) {
            newCustom.instanceId = newId;
            self._repositionRemaining(result.list);
            self.setData({ cabinets: result.list, mode: 'placing', selectedInstanceId: '' });
            self._sceneManager.clearSelection();
          });
          return;
        }
        // Carry instanceIds for surviving entries
        var oldById = {};
        for (var j = 0; j < oldList.length; j++) oldById[oldList[j].instanceId] = oldList[j];
        for (var k = 0; k < result.list.length; k++) {
          var entry = result.list[k];
          // Match by widthCm + isCustom + position within remaining survivors
          // Simplest: find first old surviving entry with same (widthCm, isCustom) not yet claimed
          for (var n = 0; n < oldList.length; n++) {
            var ol = oldList[n];
            if (ol.instanceId === id) continue;
            if (oldById[ol.instanceId] === ol &&
                ol.widthCm === entry.widthCm && ol.isCustom === entry.isCustom &&
                !entry.instanceId) {
              entry.instanceId = ol.instanceId;
              delete oldById[ol.instanceId];
              break;
            }
          }
        }
        self._repositionRemaining(result.list);
        self.setData({ cabinets: result.list, mode: 'placing', selectedInstanceId: '' });
        self._sceneManager.clearSelection();
      }
    });
  },

  _repositionRemaining: function(list) {
    if (!this._sceneManager) return;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.instanceId) {
        this._sceneManager.repositionCabinet(c.instanceId, c.wallStartCm, c.widthCm, c.isCustom);
      }
    }
  },

  onResetCamera: function() {
    if (this._sceneManager) this._sceneManager.resetCamera();
  },

  // -------- Save / load / drawer --------

  onSaveLayout: function() {
    var self = this;
    if (self.data.cabinets.length === 0) {
      wx.showToast({ title: '请先添加柜子', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '保存方案', editable: true, placeholderText: '方案名',
      success: function(modal) {
        if (!modal.confirm) return;
        var name = (modal.content || '').trim() || '未命名方案';
        wx.showLoading({ title: '保存中...' });
        var serialCabinets = self.data.cabinets.map(function(c) {
          return {
            widthCm: c.widthCm, isCustom: c.isCustom,
            wallStartCm: c.wallStartCm,
            scale: { x: c.scale.x, y: c.scale.y, z: c.scale.z },
            modelId: c.modelId
          };
        });
        storage.saveLayout({
          id: self.data.currentLayoutId || null,
          name: name,
          photoPath: self._photoTempPath,
          wall: {
            width: parseInt(self.data.wallWidth, 10),
            height: parseInt(self.data.wallHeight, 10),
            depth: parseInt(self.data.wallDepth, 10)
          },
          cabinets: serialCabinets
        }).then(function(saved) {
          wx.hideLoading();
          self._photoTempPath = saved.photoPath;
          self.setData({ currentLayoutId: saved.id });
          wx.showToast({ title: '已保存', icon: 'success' });
        }).catch(function(err) {
          wx.hideLoading();
          console.error(err);
          wx.showToast({ title: '保存失败', icon: 'none' });
        });
      }
    });
  },

  openLayoutDrawer: function() {
    this.setData({ drawerOpen: true, savedLayouts: storage.listLayouts() });
  },
  closeLayoutDrawer: function() { this.setData({ drawerOpen: false }); },

  onLoadLayout: function(e) {
    var self = this;
    var id = e.currentTarget.dataset.id;
    var l = storage.loadLayout(id);
    if (!l) { wx.showToast({ title: '方案不存在', icon: 'none' }); return; }
    self._teardownScene();
    self._photoTempPath = l.photoPath;
    self.setData({
      mode: 'placing', drawerOpen: false,
      wallWidth: l.wall.width, wallHeight: l.wall.height, wallDepth: l.wall.depth,
      cabinets: [], currentLayoutId: l.id,
      selectedInstanceId: ''
    });
    self._initRetry = 0;
    setTimeout(function() {
      self._initScene();
      setTimeout(function() { self._restoreCabinetsFrom(l.cabinets); }, 700);
    }, 200);
  },

  _restoreCabinetsFrom: function(cabSpecs) {
    var self = this;
    if (!self._sceneManager) return;
    var added = [];
    function addNext(idx) {
      if (idx >= cabSpecs.length) {
        self.setData({ cabinets: added });
        return;
      }
      var c = cabSpecs[idx];
      var path = catalog.getModelPath(c.modelId || '100G1');
      self._sceneManager.addCabinet({
        modelId: c.modelId || '100G1',
        modelPath: path,
        widthCm: c.widthCm,
        wallStartCm: c.wallStartCm,
        isCustom: c.isCustom,
        scale: c.scale
      }).then(function(instanceId) {
        added.push({
          instanceId: instanceId, modelId: c.modelId || '100G1',
          widthCm: c.widthCm, isCustom: c.isCustom,
          wallStartCm: c.wallStartCm,
          scale: { x: c.scale.x, y: c.scale.y, z: c.scale.z }
        });
        addNext(idx + 1);
      }).catch(function() { addNext(idx + 1); });
    }
    addNext(0);
  },

  onDeleteLayout: function(e) {
    var self = this;
    var id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除方案', content: '确定删除该方案？',
      success: function(modal) {
        if (!modal.confirm) return;
        storage.deleteLayout(id);
        self.setData({ savedLayouts: storage.listLayouts() });
        if (self.data.currentLayoutId === id) {
          self.setData({ currentLayoutId: '' });
        }
      }
    });
  },

  goBack: function() { wx.navigateBack({ delta: 1 }); },

  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('pd3d', this, res);
  },
  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('pd3d', this);
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add pages/knowledge/pd3d/pd3d.js
git commit -m "feat(pd3d): add page controller wiring scene manager + storage"
```

---

## Task 9: Wire into app — register route, add knowledge entry, share

**Files:**
- Modify: `app.json`
- Modify: `app.js`
- Modify: `pages/knowledge/knowledge.wxml`
- Modify: `utils/share.js`

- [ ] **Step 1: Register page in app.json**

In `app.json`, find the `"pages"` array. Add `"pages/knowledge/pd3d/pd3d"` to the end of the array (after `"pages/knowledge/pd2d/pd2d"`).

Resulting fragment:

```json
"pages/knowledge/pd2d/pd2d",
"pages/knowledge/pd3d/pd3d"
```

- [ ] **Step 2: Add knowledge entry**

Open `app.js` and locate `globalData.knowledgeGroups` definition. The existing PD2D entry is in one of the groups; find it via Grep (`grep -n "pd2d" app.js`) and add a sibling entry right after it:

```js
{
  id: 'pd3d',
  type: 'pd3d',
  title: '空间布置',
  subtitle: '3D 房间柜子摆放（实验）'
}
```

Match the exact field naming (`id`, `type`, `title`, `subtitle`) used by the surrounding entries. If existing entries use a different shape, mirror that shape.

- [ ] **Step 3: Add icon + nav route in knowledge.wxml/.js**

In `pages/knowledge/knowledge.wxml`, locate the `<view class="article-icon">` block of `<text>` icons. Add right after the `pd2d` line:

```xml
<text wx:if="{{item.type === 'pd3d'}}">🧱</text>
```

In `pages/knowledge/knowledge.js`, locate the `openArticle` function. Add right after the existing PD2D `if (type === 'pd2d')` block:

```js
if (type === 'pd3d') {
  wx.navigateTo({ url: '/pages/knowledge/pd3d/pd3d' });
  return;
}
```

- [ ] **Step 4: Add 'pd3d' share entry**

Open `utils/share.js`. Find the share-config map (it has entries for `home`, `design`, `knowledge`, etc.). Add a new entry:

```js
pd3d: {
  title: '柠檬塔 · 3D 空间布置',
  path: '/pages/knowledge/pd3d/pd3d',
  imageUrl: ''
}
```

If the existing entries have a different shape (e.g., functions for dynamic titles), follow the same pattern — for `pd3d`, a static title is fine.

- [ ] **Step 5: Run all Jest tests once more**

Run: `npx jest`
Expected: PASS — all earlier tests still green; no new tests added in this task.

- [ ] **Step 6: Commit**

```bash
git add app.json app.js pages/knowledge/knowledge.wxml pages/knowledge/knowledge.js utils/share.js
git commit -m "feat(pd3d): register pd3d page route and knowledge entry"
```

---

## Task 10: Manual smoke test in WeChat DevTools

**Files:** none (manual verification)

WeChat Mini Program code can't be unit-tested end-to-end. Run a manual smoke test in the WeChat Developer Tools (微信开发者工具) to verify the wired-up feature works.

- [ ] **Step 1: Verify knowledge entry appears**

Open WeChat DevTools, import project root, click compile. Navigate to "知识库" tab. Confirm "空间布置" entry appears in the list with the brick emoji. Tap it and confirm it opens the new page (you see "上传照片并开始" button).

- [ ] **Step 2: Verify upload + 3D scene loads**

Tap the upload button. Pick any image. Confirm:
- Page transitions to placing mode (model + width chips visible).
- Canvas renders a 3D room: back wall shows your photo, gray side walls, dark floor, light ceiling, and a thin pale-green strip on the floor along the back wall.
- Single-finger drag rotates the camera; two-finger pinch zooms.

- [ ] **Step 3: Verify cabinet placement**

With "100G1 标准柜" selected and 50cm chip selected, tap "添加柜子". Wait ~1 second. Confirm a cabinet model appears flush against the back wall starting at the left edge. Tap "添加柜子" again with 100cm. Confirm a second cabinet appears immediately to the right.

- [ ] **Step 4: Verify finalize**

Tap "完成布置". Confirm a third cabinet (the custom end-position one) appears on the right side, its width matches `wallWidth − 50 − 100 − 4` cm.

- [ ] **Step 5: Verify selection + scaling**

Tap one of the cabinets in the canvas. Confirm an orange highlight appears on it. Confirm bottom toolbar switches to 3 sliders.
Drag the height slider up. Confirm the cabinet model gets visually taller, but each panel (especially the top panel) does NOT get thicker. Drag the width slider; same behavior on side panels.

- [ ] **Step 6: Verify save + reload**

Tap "取消选中" then "保存方案". Enter a name. Confirm the toast "已保存". Reload the page (back arrow then re-enter). Tap "方案列表" in the top bar; the saved entry should appear. Tap it to load. Confirm the room and all cabinets restore identically.

- [ ] **Step 7: Verify delete**

In the drawer, tap "删除" on the saved layout. Confirm it disappears from the list.

If any step fails, file the bug, fix it, re-run the affected step. Do not check the box until the step passes cleanly.

- [ ] **Step 8: Commit any fixes from smoke test**

If steps 2-7 found bugs, fix them. Each fix should produce its own commit. After all steps pass, run:

```bash
git log --oneline -20
```

to confirm the commit history is clean.

---

## Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx jest`
Expected: All tests pass (catalog 5, layout 10, scaler 6, storage 8 — total 29 new tests, plus pre-existing perspective + checklist + ensureLogin tests).

- [ ] **Step 2: Confirm commit history**

Run: `git log --oneline feature/photo-perspective..HEAD` (or compare against main)
Expected: Roughly 10–13 well-scoped commits, one per task plus any smoke-test fixes.

- [ ] **Step 3: Final commit if anything outstanding**

If anything is uncommitted, commit it now with a descriptive message.

---

