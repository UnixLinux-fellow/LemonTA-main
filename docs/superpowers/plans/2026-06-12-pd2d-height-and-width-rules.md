# PD2D 墙高分级 + 柜位放置规则 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 PD2D 衣柜布置在「墙高 ≥247cm」时增加 G1 柜+4cm 收口，在「剩余墙宽 ≤100cm」时禁止用户放柜并自动补缩小宽度 100A，在「100<剩余 ≤150cm」时仅允许放 50cm 柜。

**Architecture:** 渲染规则集中在 `utils/cabinetSceneNodes.js`，按 `wallHeight` 分支生成柜位节点；放置规则集中在 `pages/knowledge/pd2d/pd2d.js`，按 `trailing` 拦截 nextBlock/selectWidth 并自动 push autoFilled 模块到 modules 数组；UI 状态由 `canPlace50`/`canPlace100` 数据字段驱动 wxml。

**Tech Stack:** WeChat Mini Program (JS, WXML), Three.js (scene overlay), Jest (单元测试)

**说明：** 本计划将"剩余墙宽 ≤100cm 自动补"规则统一应用，**包括用户尚未放置任何柜（初始 trailing 已 ≤100，例如 55–104cm 墙宽）的情况** —— 即进入布置模式即触发自动补柜。如需限制为"用户放置后才补"请回到 spec 修改。

**Spec：** `docs/superpowers/specs/2026-06-12-pd2d-height-and-width-rules-design.md`

---

## 文件结构

| 文件 | 责任 |
|---|---|
| `utils/cabinetSceneNodes.js` | 单柜位渲染分支（按 wallHeight）、autoFilled 模块的 4cm 右收口 |
| `__tests__/cabinetSceneNodes.test.js` | 上述渲染分支的单元测试 |
| `pages/knowledge/pd2d/pd2d.js` | 放置档位计算、nextBlock/selectWidth 拦截、autoFilled 自动补、点击换型号 |
| `pages/knowledge/pd2d/pd2d.wxml` | 50/100 chip 的 disabled 状态绑定 |
| `packageDesign/cost/cost.js` | autoFilled 模块按 100 系列计价 |

---

## Task 1: cabinetSceneNodes.js — 单柜位 emit 方法引入墙高分支

**Files:**
- Modify: `utils/cabinetSceneNodes.js`
- Test: `__tests__/cabinetSceneNodes.test.js`

- [ ] **Step 1: 写失败测试 — wallHeight ≥ 247 时柜位上方多出 G1 cabinet 节点**

在 `__tests__/cabinetSceneNodes.test.js` 文件末尾追加：

```js
describe('buildSceneNodes - high wall (≥247)', function() {
  var DEPTH = 60;

  it('high wall: cabinet at y=0 + G1 cabinet at y=230 + 4cm trim at y=wallHeight-4', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 280,
      modules: [{ type: 'a', width: 100, wallX: 50 }],
      depth: DEPTH
    });
    var cab = out.filter(function(n) { return n.type === 'cabinet'; });
    expect(cab.length).toBe(2);
    var main = cab.filter(function(n) { return n.modelId === '100A'; })[0];
    var g1   = cab.filter(function(n) { return n.modelId === '100G1'; })[0];
    expect(main.y).toBe(0);
    expect(main.h).toBe(230);
    expect(g1).toBeDefined();
    expect(g1.y).toBe(230);
    expect(g1.h).toBe(280 - 230 - 4);
    expect(g1.x).toBe(50);
    expect(g1.w).toBe(100);
    var topClose = out.filter(function(n) {
      return n.type === 'trim' && n.x === 50 && n.y === 280 - 4 && n.h === 4 && n.w === 100;
    });
    expect(topClose.length).toBe(1);
  });

  it('high wall, 50cm cabinet: G1 modelId is 50G1', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 260,
      modules: [{ type: 'b', width: 50, wallX: 100 }],
      depth: DEPTH
    });
    var g1 = out.filter(function(n) { return n.type==='cabinet' && n.modelId==='50G1'; });
    expect(g1.length).toBe(1);
    expect(g1[0].h).toBe(260 - 230 - 4);
  });

  it('low wall (<247) keeps existing g-* trim filler above cabinet', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 246,
      modules: [{ type: 'a', width: 100, wallX: 50 }],
      depth: DEPTH
    });
    var fillers = out.filter(function(n) {
      return n.type === 'trim' && n.y === 230 && n.x === 50 && n.w === 100;
    });
    expect(fillers.length).toBe(1);
    expect(fillers[0].h).toBe(246 - 230 - 2);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx jest __tests__/cabinetSceneNodes.test.js -t "high wall"
```

预期：3 个新增 case 失败（cabinets.length=2 ≠ 1，因为旧逻辑只 emit 主柜）。

- [ ] **Step 3: 改 `utils/cabinetSceneNodes.js` 顶部常量**

把 line 1-6 替换为：

```js
var SK = 2;
var CABINET_HEIGHT = 230;
var TOP_BAR_THICKNESS = 2;
var MIN_STANDARD_WIDTH = 50;
var CLOSING_PANEL_WIDTH = 4;
var SOLID_TRIM_THRESHOLD = 30;
var HIGH_WALL_THRESHOLD = 247;
var TOP_CLOSING_HEIGHT = 4;
var RIGHT_CLOSING_WIDTH = 4;

function _baseWidthFor(width) {
  return width <= 75 ? 50 : 100;
}
```

- [ ] **Step 4: 替换 `_emitCabinetWithGap`（line 12-25）为按墙高分支的 `_emitCabinetStack`**

```js
function _emitCabinetStack(nodes, modelId, baseW, x, w, wallHeight, d) {
  nodes.push({
    type: 'cabinet', modelId: modelId,
    x: x, y: 0, z: 0, w: w, h: CABINET_HEIGHT, d: d
  });
  if (wallHeight >= HIGH_WALL_THRESHOLD) {
    var g1Height = wallHeight - CABINET_HEIGHT - TOP_CLOSING_HEIGHT;
    if (g1Height > 0) {
      nodes.push({
        type: 'cabinet', modelId: baseW + 'G1',
        x: x, y: CABINET_HEIGHT, z: 0,
        w: w, h: g1Height, d: d
      });
    }
    nodes.push({
      type: 'trim',
      x: x, y: wallHeight - TOP_CLOSING_HEIGHT, z: 0,
      w: w, h: TOP_CLOSING_HEIGHT, d: d
    });
  } else {
    var gap = wallHeight - CABINET_HEIGHT - TOP_BAR_THICKNESS;
    if (gap > 0) {
      nodes.push({
        type: 'trim',
        x: x, y: CABINET_HEIGHT, z: 0,
        w: w, h: gap, d: d
      });
    }
  }
}
```

- [ ] **Step 5: 替换 `buildSceneNodes` 主循环（line 50-53）调用新方法**

把：
```js
  for (var i = 0; i < modules.length; i++) {
    var m = modules[i];
    _emitCabinetWithGap(nodes, _modelId(m.type, m.width), m.wallX, m.width, gap, d);
  }
```

替换为：
```js
  for (var i = 0; i < modules.length; i++) {
    var m = modules[i];
    var baseW = _baseWidthFor(m.width);
    _emitCabinetStack(nodes, _modelId(m.type, m.width), baseW, m.wallX, m.width, Hh, d);
  }
```

并删除 line 47 的 `var gap = Math.max(...)`（该变量不再用于柜位 emit；后面 SK 上方填充会重新算）。

- [ ] **Step 6: 跑测试确认通过**

```bash
npx jest __tests__/cabinetSceneNodes.test.js -t "high wall"
```

预期：3 个新 case 全部 PASS。

- [ ] **Step 7: 跑全量测试确认现有测试不受影响**

```bash
npx jest __tests__/cabinetSceneNodes.test.js
```

预期：除当前 task 中受 Task 2/3 影响的 case 暂未通过外，其他 case 应不变。如有意外失败，记录后由后续 Task 处理。

- [ ] **Step 8: Commit**

```bash
git add utils/cabinetSceneNodes.js __tests__/cabinetSceneNodes.test.js
git commit -m "feat(pd2d): cabinet stack branches on wallHeight (G1 + 4cm closure when ≥247)"
```

---

## Task 2: cabinetSceneNodes.js — 高墙模式跳过全墙顶梁 + SK 柱直通顶部

**Files:**
- Modify: `utils/cabinetSceneNodes.js`
- Test: `__tests__/cabinetSceneNodes.test.js`

- [ ] **Step 1: 写失败测试**

在 Task 1 新增的 describe 块末尾追加：

```js
  it('high wall: no full-wall 2cm top bar', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 280, modules: [], depth: 60
    });
    var topBar = out.filter(function(n) {
      return n.type === 'trim' && n.x === SK_VAL() && n.y === 278 && n.h === 2;
    });
    expect(topBar.length).toBe(0);
  });

  it('high wall, empty wall: SK columns span full height in two pieces', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 280, modules: [], depth: 60
    });
    var leftMain  = out.filter(function(n) { return n.type==='trim' && n.x===0 && n.y===0   && n.h===230 && n.w===2; });
    var leftUpper = out.filter(function(n) { return n.type==='trim' && n.x===0 && n.y===230 && n.h===50  && n.w===2; });
    expect(leftMain.length).toBe(1);
    expect(leftUpper.length).toBe(1);
  });

  function SK_VAL() { return 2; }
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx jest __tests__/cabinetSceneNodes.test.js -t "no full-wall 2cm top bar"
```

预期：FAIL（旧实现仍生成顶梁）。

- [ ] **Step 3: 改 `buildSceneNodes` 末尾的 SK 立柱 + 顶梁逻辑（原 line 73-87）**

替换那一整段为：

```js
  nodes.push({ type: 'trim', x: 0,    y: 0, z: 0, w: SK, h: CABINET_HEIGHT, d: d });
  nodes.push({ type: 'trim', x: W-SK, y: 0, z: 0, w: SK, h: CABINET_HEIGHT, d: d });

  if (Hh >= HIGH_WALL_THRESHOLD) {
    var skUpperH = Hh - CABINET_HEIGHT;
    if (skUpperH > 0) {
      nodes.push({ type: 'trim', x: 0,    y: CABINET_HEIGHT, z: 0, w: SK, h: skUpperH, d: d });
      nodes.push({ type: 'trim', x: W-SK, y: CABINET_HEIGHT, z: 0, w: SK, h: skUpperH, d: d });
    }
  } else {
    var skUpperGap = Hh - CABINET_HEIGHT - TOP_BAR_THICKNESS;
    if (skUpperGap > 0) {
      nodes.push({ type: 'trim', x: 0,    y: CABINET_HEIGHT, z: 0, w: SK, h: skUpperGap, d: d });
      nodes.push({ type: 'trim', x: W-SK, y: CABINET_HEIGHT, z: 0, w: SK, h: skUpperGap, d: d });
    }
    if (W > 2*SK) {
      nodes.push({
        type: 'trim',
        x: SK, y: Hh - TOP_BAR_THICKNESS, z: 0,
        w: W - 2*SK, h: TOP_BAR_THICKNESS, d: d
      });
    }
  }
```

- [ ] **Step 4: 跑测试确认通过**

```bash
npx jest __tests__/cabinetSceneNodes.test.js -t "high wall"
```

预期：5 个 high wall case 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add utils/cabinetSceneNodes.js __tests__/cabinetSceneNodes.test.js
git commit -m "feat(pd2d): high wall skips top bar; SK columns span full height"
```

<!-- TASK_3_MARKER -->

---

## Task 3: cabinetSceneNodes.js — 删除旧 trailing 自动补 50A 逻辑

旧 trailing filler（line 55-71）由 cabinetSceneNodes 在渲染期补；新规则把"补柜"提到 pd2d.js 放置期，scene-nodes 不再自动补 — 它会作为普通模块从 modules 数组里走。但要保留 < 30 纯 trim 兜底（spec 明确 <30 保留现状），这条由 pd2d.js 在放置期处理 ≥ 30 的情况，而 scene-nodes 此处不再插入任何 trailing 节点。

**Files:**
- Modify: `utils/cabinetSceneNodes.js`
- Test: `__tests__/cabinetSceneNodes.test.js`

- [ ] **Step 1: 写失败测试**

```js
describe('buildSceneNodes - trailing handed off to caller', function() {
  var DEPTH = 60;

  it('does NOT auto-emit a trailing 50A when modules leave 50<gap<100 on right', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 260,
      modules: [{ type: 'a', width: 200, wallX: 2 }],
      depth: DEPTH
    });
    var fillerCabs = out.filter(function(n) {
      return n.type === 'cabinet' && n.modelId === '50A';
    });
    expect(fillerCabs.length).toBe(0);
  });

  it('does NOT auto-emit trailing trim cuboid for narrow gap (<30)', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 260,
      modules: [{ type: 'a', width: 280, wallX: 2 }],
      depth: DEPTH
    });
    var trailingTrim = out.filter(function(n) {
      return n.type === 'trim' && n.x === 282 && n.y === 0 && n.h === 230;
    });
    expect(trailingTrim.length).toBe(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx jest __tests__/cabinetSceneNodes.test.js -t "trailing handed off"
```

预期：FAIL（旧 line 55-71 仍在 emit）。

- [ ] **Step 3: 删除 `buildSceneNodes` 中 line 55-71 整块 `if (modules.length > 0) { ... var rightmostEnd ... }`**

把这一整块（含 `if (trailing > 0 && trailing < MIN_STANDARD_WIDTH)` 整个 if/else）整体删除。

- [ ] **Step 4: 跑全量测试**

```bash
npx jest __tests__/cabinetSceneNodes.test.js
```

预期：旧的针对 trailing 自动补的 case 会失败（如果存在）—— 这是预期的 spec 变化。如有依赖该行为的旧 case，标注 `xit` 跳过并加注释「behavior moved to pd2d.js」。Task 3 中心只关心新加的两个 case PASS。

- [ ] **Step 5: Commit**

```bash
git add utils/cabinetSceneNodes.js __tests__/cabinetSceneNodes.test.js
git commit -m "refactor(pd2d): remove auto trailing filler from scene-nodes (moved to placement layer)"
```

---

## Task 4: cabinetSceneNodes.js — autoFilled 模块的 4cm 右收口节点

由 pd2d.js push 进来的 autoFilled 模块走标准柜路径，但它右侧紧挨 SK 立柱，需要在它右沿插入一条 4cm 同色 trim cuboid 作为收口（覆盖竖直整段：墙高 <247 时高 230，≥247 时高 wallHeight−4，与同柜位主柜+G1 的总高对齐）。

**Files:**
- Modify: `utils/cabinetSceneNodes.js`
- Test: `__tests__/cabinetSceneNodes.test.js`

- [ ] **Step 1: 写失败测试**

```js
describe('buildSceneNodes - autoFilled right closure', function() {
  var DEPTH = 60;

  it('autoFilled module: 4cm trim cuboid at its right edge, full main height (low wall)', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 200, wallHeight: 260,
      modules: [{ type: 'a', width: 196, wallX: 2, autoFilled: true }],
      depth: DEPTH
    });
    var rightClose = out.filter(function(n) {
      return n.type === 'trim' && n.x === 198 && n.y === 0 && n.w === 4 && n.h === 230;
    });
    expect(rightClose.length).toBe(1);
  });

  it('autoFilled module: right closure also extends through G1 region (high wall)', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 200, wallHeight: 280,
      modules: [{ type: 'a', width: 196, wallX: 2, autoFilled: true }],
      depth: DEPTH
    });
    var rightCloseMain = out.filter(function(n) {
      return n.type==='trim' && n.x===198 && n.y===0 && n.w===4 && n.h===230;
    });
    var rightCloseUpper = out.filter(function(n) {
      return n.type==='trim' && n.x===198 && n.y===230 && n.w===4 && n.h===(280-230-4);
    });
    expect(rightCloseMain.length).toBe(1);
    expect(rightCloseUpper.length).toBe(1);
  });

  it('non-autoFilled module: NO right closure trim', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 200, wallHeight: 260,
      modules: [{ type: 'a', width: 196, wallX: 2 }],
      depth: DEPTH
    });
    var rightClose = out.filter(function(n) {
      return n.type==='trim' && n.x===198 && n.y===0 && n.w===4;
    });
    expect(rightClose.length).toBe(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx jest __tests__/cabinetSceneNodes.test.js -t "autoFilled right closure"
```

预期：3 个 case 全部 FAIL。

- [ ] **Step 3: 在 `buildSceneNodes` 主循环之后加 autoFilled 收口逻辑**

在 Task 1 改造过的 `for (var i = 0; i < modules.length; i++)` 主循环结束之后，立即追加：

```js
  for (var ai = 0; ai < modules.length; ai++) {
    var am = modules[ai];
    if (!am.autoFilled) continue;
    var rx = am.wallX + am.width;
    nodes.push({
      type: 'trim',
      x: rx, y: 0, z: 0,
      w: RIGHT_CLOSING_WIDTH, h: CABINET_HEIGHT, d: d
    });
    if (Hh >= HIGH_WALL_THRESHOLD) {
      var upperH = Hh - CABINET_HEIGHT - TOP_CLOSING_HEIGHT;
      if (upperH > 0) {
        nodes.push({
          type: 'trim',
          x: rx, y: CABINET_HEIGHT, z: 0,
          w: RIGHT_CLOSING_WIDTH, h: upperH, d: d
        });
      }
    } else {
      var upperGap = Hh - CABINET_HEIGHT - TOP_BAR_THICKNESS;
      if (upperGap > 0) {
        nodes.push({
          type: 'trim',
          x: rx, y: CABINET_HEIGHT, z: 0,
          w: RIGHT_CLOSING_WIDTH, h: upperGap, d: d
        });
      }
    }
  }
```

- [ ] **Step 4: 跑测试确认通过**

```bash
npx jest __tests__/cabinetSceneNodes.test.js -t "autoFilled right closure"
```

预期：3 个 case PASS。

- [ ] **Step 5: 跑全量 sceneNodes 测试**

```bash
npx jest __tests__/cabinetSceneNodes.test.js
```

预期：所有非旧-trailing 相关 case PASS。

- [ ] **Step 6: Commit**

```bash
git add utils/cabinetSceneNodes.js __tests__/cabinetSceneNodes.test.js
git commit -m "feat(pd2d): scene nodes emit 4cm right closure for autoFilled modules"
```

<!-- TASK_5_MARKER -->

---

## Task 5: pd2d.js — trailing 计算与放置拦截 + 自动补 100A

**Files:**
- Modify: `pages/knowledge/pd2d/pd2d.js`

- [ ] **Step 1: 在 pd2d.js Page 对象内 `data` 之后、`onLoad` 之前，新增工具方法**

在 line 53 `onLoad` 之前插入：

```js
  _computeTrailing: function() {
    var SK = 2;
    var used = SK * 2;
    var modules = this.data.modules || [];
    for (var i = 0; i < modules.length; i++) used += modules[i].width;
    return this.data.wallWidth - used;
  },

  _hasAutoFilled: function() {
    var modules = this.data.modules || [];
    for (var i = 0; i < modules.length; i++) {
      if (modules[i].autoFilled) return true;
    }
    return false;
  },

  _refreshPlacementUI: function() {
    var trailing = this._computeTrailing();
    var canPlace50 = false, canPlace100 = false;
    if (!this._hasAutoFilled()) {
      if (trailing > 150) { canPlace50 = true; canPlace100 = true; }
      else if (trailing > 100) { canPlace50 = true; }
    }
    var isWallFull = this._hasAutoFilled() || (trailing <= 100);
    this.setData({
      canPlace50: canPlace50,
      canPlace100: canPlace100,
      isWallFull: isWallFull
    });
  },

  _maybeAutoFillTrailing: function() {
    if (this._hasAutoFilled()) return false;
    var trailing = this._computeTrailing();
    if (trailing < 30 || trailing > 100) return false;
    var SK = 2;
    var modules = (this.data.modules || []).slice();
    var rightmostEnd = SK;
    for (var i = 0; i < modules.length; i++) {
      var endX = modules[i].wallX + modules[i].width;
      if (endX > rightmostEnd) rightmostEnd = endX;
    }
    var fillerWidth = trailing - 4;
    if (fillerWidth <= 0) return false;
    modules.push({
      type: 'a',
      width: fillerWidth,
      wallX: rightmostEnd,
      isStandard: false,
      autoFilled: true
    });
    modules.sort(function(a, b) { return a.wallX - b.wallX; });
    this.setData({ modules: modules });
    this._drawFrame();
    this._scheduleOverlayUpdate();
    return true;
  },
```

- [ ] **Step 2: 改 `data` 默认值，加 `canPlace50` / `canPlace100`**

在 line 51 附近的 data 对象内追加（与 `hasDoor: false` 同级）：

```js
    canPlace50: true,
    canPlace100: true,
```

- [ ] **Step 3: 改 `selectWidth`（line 297-302）拦截**

替换为：

```js
  selectWidth(e) {
    var w = parseInt(e.currentTarget.dataset.width, 10);
    if (w === 100 && !this.data.canPlace100) {
      wx.showToast({ title: '剩余墙宽不足，无法放100cm柜', icon: 'none' });
      return;
    }
    if (w === 50 && !this.data.canPlace50) {
      wx.showToast({ title: '墙面已满', icon: 'none' });
      return;
    }
    this.setData({ selectedWidth: w });
    this._recomputeIsWallFull();
    this._initModelPreview();
  },
```

- [ ] **Step 4: 改 `nextBlock`（line 318-331）按 trailing 分档**

替换为：

```js
  nextBlock() {
    if (this.data.isWallFull) {
      this._confirmLayout();
      return;
    }
    var trailing = this._computeTrailing();
    var sw = this.data.selectedWidth;
    if (trailing > 150) {
      // 正常路径
    } else if (trailing > 100) {
      if (sw !== 50) {
        wx.showToast({ title: '剩余空间仅可放50cm柜', icon: 'none' });
        return;
      }
    } else {
      // trailing ≤ 100：禁止放置，触发自动补
      if (this._maybeAutoFillTrailing()) {
        this._refreshPlacementUI();
      } else {
        this.setData({ isWallFull: true });
      }
      return;
    }
    var wallX = this._findNextWallPosition();
    if (wallX < 0) {
      this._maybeAutoFillTrailing();
      this._refreshPlacementUI();
      return;
    }
    this._placeModule(wallX);
    // 放置后重新计算并按需自动补
    this._maybeAutoFillTrailing();
    this._refreshPlacementUI();
  },
```

- [ ] **Step 5: 改 `_recomputeIsWallFull`（line 371-380）走新路径**

替换为：

```js
  _recomputeIsWallFull() {
    this._refreshPlacementUI();
  },
```

- [ ] **Step 6: 改 `prevBlock`（line 306-316）撤回时连带清掉 autoFilled**

替换为：

```js
  prevBlock() {
    if (this.data.modules.length === 0) {
      wx.showToast({ title: '已无柜体', icon: 'none' });
      return;
    }
    var modules = this.data.modules.slice();
    while (modules.length > 0 && modules[modules.length - 1].autoFilled) {
      modules.pop();
    }
    if (modules.length > 0) modules.pop();
    this.setData({ modules: modules, isWallFull: false });
    this._drawFrame();
    this._scheduleOverlayUpdate();
    this._refreshPlacementUI();
  },
```

- [ ] **Step 7: 改 `resetWall`（line 333-341）刷新 UI 状态**

替换为：

```js
  resetWall() {
    this.setData({ modules: [], isWallFull: false, draggingCorner: -1 });
    if (this._photoImg) {
      this._initDefaultCorners();
    }
    this._drawFrame();
    this._scheduleOverlayUpdate();
    this._refreshPlacementUI();
  },
```

- [ ] **Step 8: 在 `onConfirmSpace`（line 165）保存 setData 之后调一次 `_refreshPlacementUI`**

找到 line 196 `this.setData({ spaceName: name, ... });` 之后、`setTimeout` 之前，插入：

```js
    this._refreshPlacementUI();
```

并紧接着在初始化模式中调一次 autoFill（处理初始 trailing 已 ≤100 的情况）：

```js
    this._maybeAutoFillTrailing();
    this._refreshPlacementUI();
```

- [ ] **Step 9: 手测（无单元测试覆盖小程序 Page 行为）**

在微信开发者工具中验证：
- 墙宽 300 + 50cm 柜 ×5 → trailing = 296-250 = 46 → 自动补 42cm 100A
- 墙宽 300 + 100cm 柜 ×2 → trailing = 96 → 自动补 92cm 100A
- 墙宽 200 → 进入布置即触发自动补 196cm 缩小柜（因初始 trailing 已 = 196 ≤ 100？不，是 196 > 100，要确认这个边界没问题）—— 200-4=196，所以正常允许放 50/100，OK
- 墙宽 110 → 初始 trailing = 106 > 100 但 ≤ 150 → 50 按钮可点；放完 50 → trailing=56 → 自动补 52cm 100A
- 墙宽 60 → 初始 trailing = 56 ≤ 100 → 直接触发自动补 52cm 100A

- [ ] **Step 10: Commit**

```bash
git add pages/knowledge/pd2d/pd2d.js
git commit -m "feat(pd2d): trailing-based placement gating + auto-fill 100A on save"
```

---

## Task 6: pd2d.wxml — 50/100 chip 按钮 disabled 视觉与命中

**Files:**
- Modify: `pages/knowledge/pd2d/pd2d.wxml`
- Modify: `pages/knowledge/pd2d/pd2d.wxss`（如样式表存在）

- [ ] **Step 1: 改 wxml 中 50/100 chip（line 92-97）**

替换为：

```xml
        <view class="chip {{selectedWidth === 50 ? 'chip-active' : ''}} {{!canPlace50 ? 'chip-disabled' : ''}}" bindtap="selectWidth" data-width="50">
          <text>50cm</text>
        </view>
        <view class="chip {{selectedWidth === 100 ? 'chip-active' : ''}} {{!canPlace100 ? 'chip-disabled' : ''}}" bindtap="selectWidth" data-width="100">
          <text>100cm</text>
        </view>
```

注意 disabled 时仍然 bindtap，但点击会被 selectWidth 内的拦截逻辑（Task 5 Step 3）阻止并 toast。

- [ ] **Step 2: 在 pd2d.wxss 加 disabled 样式**

```css
.chip-disabled {
  opacity: 0.4;
  pointer-events: auto;  /* 仍然可点击以触发 toast 提示 */
}
```

- [ ] **Step 3: 手测**

在微信开发者工具中确认：墙宽 110、放完 50cm 柜后，50/100 两个按钮变灰；点 100 弹"剩余墙宽不足"。

- [ ] **Step 4: Commit**

```bash
git add pages/knowledge/pd2d/pd2d.wxml pages/knowledge/pd2d/pd2d.wxss
git commit -m "feat(pd2d): width chips show disabled when canPlace50/100 false"
```

---

## Task 7: cost.js — autoFilled 模块按 100 系列计价

**Files:**
- Modify: `packageDesign/cost/cost.js`

由于 spec 要求 autoFilled 模块即使实际 width 小于 100，也要按 100A/B/C/D 价格计价（料件按 100 系列）。需要在成本计算的核心入口处把 autoFilled 模块的 width 临时归一为 100。

- [ ] **Step 1: 定位计算入口**

```bash
grep -n "modules" packageDesign/cost/cost.js | head -30
```

找到主计算函数（通常是 `calculate` / `computeCost` / `_computeAll` 之类）接收 modules 数组的位置。

- [ ] **Step 2: 在该函数顶部加归一化映射**

在主计算函数开头（接收 modules 之后），插入：

```js
    var modulesForCost = (modules || []).map(function(m) {
      if (m && m.autoFilled) {
        return Object.assign({}, m, { width: 100 });
      }
      return m;
    });
```

并把后续所有原本用 `modules` 的地方替换为 `modulesForCost`。

- [ ] **Step 3: 手测**

在微信开发者工具中：
- 墙宽 300 + 100cm 柜 ×2 → 自动补 92cm 100A → 保存方案 → 进 cost 页 → 总成本应等于「3 个 100A 柜的全价」（每个按 100cm 计算的板材+五金价）

- [ ] **Step 4: Commit**

```bash
git add packageDesign/cost/cost.js
git commit -m "feat(cost): autoFilled modules priced as full 100cm in cost calc"
```

---

## Self-Review

**Spec 覆盖检查：**

| Spec 章节 | 实现 Task |
|---|---|
| A 墙高 < 247（现状） | Task 1（保留低墙分支）+ Task 2（保留全墙顶梁低墙分支） |
| A 墙高 ≥ 247（主柜+G1+4cm 收口、不画顶梁） | Task 1（G1 + 4cm 收口）+ Task 2（跳顶梁、SK 直通顶部） |
| B trailing < 30（纯 trim，保留现状） | spec 重审：scene-nodes 不再 emit；pd2d.js 也不补 → 留下纯空白。**spec 与 plan 不一致 → 见下条** |
| B 30 ≤ trailing < 100（拦截 + 补 100A + 4cm 收口） | Task 5（pd2d 补）+ Task 4（scene-nodes 4cm 收口） |
| B trailing = 100（同 < 100） | Task 5 `trailing ≤ 100` 分支 |
| B 100 < trailing ≤ 150（仅 50cm） | Task 5 nextBlock 分支 |
| B trailing > 150（全可放） | Task 5 nextBlock 正常路径 |
| C autoFilled 数据语义 | Task 5（push 节点）+ Task 4（scene-nodes 收口）+ Task 7（计价） |
| C 点击补柜位换型号 | **未覆盖** → 见下条 |
| D 50/100 按钮 disabled | Task 6 |

**发现的 gap，已补：**

1. **trailing < 30 的 trim 在 plan 中丢失：** spec 说「<30 保留纯同色 trim」。Task 3 删除了 scene-nodes 端补 trim，Task 5 也跳过 trailing<30。需要补一个 task 处理：要么在 pd2d.js 里把 <30 trailing 也 push 一条 autoFilled 模块（width=trailing，不带 4cm 收口标记，但 spec 说"纯 trim"意思是不算柜子）；或者在 scene-nodes 末尾保留一条简单的 trailing 检测：若末位非 autoFilled module 之后到 W-SK 还有 <30 空隙，emit 一条 trim cuboid。

2. **点击补柜位换型号未实现。**

补一个 Task 8：

---

## Task 8: trailing < 30 trim 兜底 + 点补柜位换型号

**Files:**
- Modify: `utils/cabinetSceneNodes.js`
- Modify: `pages/knowledge/pd2d/pd2d.js`
- Test: `__tests__/cabinetSceneNodes.test.js`

- [ ] **Step 1: scene-nodes 写失败测试 — trailing<30 时末尾自动 emit trim**

```js
describe('buildSceneNodes - residual <30 trim cuboid', function() {
  var DEPTH = 60;
  it('emits trim cuboid when wallWidth - SK*2 - sum(modules.width) < 30 and > 0', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 260,
      modules: [{ type: 'a', width: 280, wallX: 2 }],
      depth: DEPTH
    });
    var trail = out.filter(function(n) {
      return n.type==='trim' && n.x===282 && n.y===0 && n.h===230 && n.w===16;
    });
    expect(trail.length).toBe(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx jest __tests__/cabinetSceneNodes.test.js -t "residual <30"
```

- [ ] **Step 3: 在 `buildSceneNodes` SK 立柱 emit 之前加 residual trim**

在 Task 1/2/3/4 改造后的 `buildSceneNodes` 里，紧接着主循环和 autoFilled 收口循环之后、SK 立柱之前插入：

```js
  var rightmostEnd = SK;
  for (var ri = 0; ri < modules.length; ri++) {
    var rEnd = modules[ri].wallX + modules[ri].width;
    if (modules[ri].autoFilled) rEnd += RIGHT_CLOSING_WIDTH;
    if (rEnd > rightmostEnd) rightmostEnd = rEnd;
  }
  var residual = (W - SK) - rightmostEnd;
  if (residual > 0 && residual < SOLID_TRIM_THRESHOLD) {
    var resH = (Hh >= HIGH_WALL_THRESHOLD) ? (Hh - TOP_CLOSING_HEIGHT) : CABINET_HEIGHT;
    nodes.push({
      type: 'trim',
      x: rightmostEnd, y: 0, z: 0,
      w: residual, h: CABINET_HEIGHT, d: d
    });
    if (Hh >= HIGH_WALL_THRESHOLD) {
      var resUpper = Hh - CABINET_HEIGHT - TOP_CLOSING_HEIGHT;
      if (resUpper > 0) {
        nodes.push({ type:'trim', x: rightmostEnd, y: CABINET_HEIGHT, z:0, w: residual, h: resUpper, d: d });
      }
    } else {
      var resGap = Hh - CABINET_HEIGHT - TOP_BAR_THICKNESS;
      if (resGap > 0) {
        nodes.push({ type:'trim', x: rightmostEnd, y: CABINET_HEIGHT, z:0, w: residual, h: resGap, d: d });
      }
    }
  }
```

- [ ] **Step 4: 跑测试确认通过**

```bash
npx jest __tests__/cabinetSceneNodes.test.js
```

- [ ] **Step 5: pd2d.js — 点击 canvas 命中 autoFilled 模块时弹型号选择器**

在 `onCanvasTouchStart`（line 665）之后、`onCanvasTouchEnd` 之前插入新方法：

```js
  _hitTestModule: function(touchX, touchY) {
    if (!this._photoImg && !this.data.spaceConfirmed) return -1;
    var canvasW = this.data.canvasWidth;
    var SK = 2;
    var pxPerCm = (canvasW - 2 * SK) / Math.max(this.data.wallWidth - 2 * SK, 1);
    var modules = this.data.modules || [];
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      if (!m.autoFilled) continue;
      var x0 = m.wallX * pxPerCm;
      var x1 = (m.wallX + m.width) * pxPerCm;
      if (touchX >= x0 && touchX <= x1) return i;
    }
    return -1;
  },

  _showAutoFilledTypeSelector: function(idx) {
    var self = this;
    wx.showActionSheet({
      itemList: ['100A', '100B', '100C', '100D'],
      success: function(res) {
        var typeMap = ['a','b','c','d'];
        var newType = typeMap[res.tapIndex];
        var modules = self.data.modules.slice();
        modules[idx] = Object.assign({}, modules[idx], { type: newType });
        self.setData({ modules: modules });
        self._drawFrame();
        self._scheduleOverlayUpdate();
      }
    });
  },
```

- [ ] **Step 6: 改 `onCanvasTouchStart`（line 665）增加 autoFilled 命中分支**

在该方法 `if (!this.data.spaceConfirmed) return;` 之后追加：

```js
    if (e.touches && e.touches[0]) {
      var t0 = e.touches[0];
      var hitIdx = this._hitTestModule(t0.x, t0.y);
      if (hitIdx >= 0) {
        this._showAutoFilledTypeSelector(hitIdx);
        return;
      }
    }
```

- [ ] **Step 7: 手测**

在微信开发者工具中：放 100cm 柜 ×2 触发自动补 → 点画布上自动补柜位 → 弹 4 选 1 → 选 100C → 重渲染显示 C 型柜模板。

- [ ] **Step 8: Commit**

```bash
git add utils/cabinetSceneNodes.js pages/knowledge/pd2d/pd2d.js __tests__/cabinetSceneNodes.test.js
git commit -m "feat(pd2d): residual <30 trim fallback + tap autoFilled module to swap 100 cabinet type"
```

---

## 完工后整体回归测试

- [ ] **Step 1: 全量单元测试**

```bash
npx jest
```

预期：全部 PASS。如有 fail，回到对应 Task 修复。

- [ ] **Step 2: 真机 / 模拟器手测覆盖矩阵**

| 墙宽 | 墙高 | 期望行为 |
|---|---|---|
| 300 | 232 | 5 个 50cm 柜后 trailing=46，自动补 42A，全墙 2cm 顶梁 |
| 300 | 247 | 同上但每个柜位上方加 G1+4cm 收口，不画顶梁 |
| 300 | 280 | 高墙完整链路 |
| 110 | 260 | 50 按钮可点，100 灰；放 1 个 50 触发自动补 |
| 60 | 260 | 进入即触发自动补 |
| 200 | 246 | 边界值 wallHeight=246 走低墙分支 |
| 200 | 247 | 边界值 wallHeight=247 走高墙分支 |
| 1000 | 400 | 上限校验 |

- [ ] **Step 3: 创建分支 PR / merge 到 feature/photo-perspective**

```bash
git status
git log --oneline -10
```

确认 commit 序列清晰，按需推送。

