# PD2D 保存唯一性 + 合成预览图 + 跳转 cost 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PD2D 第一屏增加方案名重名校验；保存方案时把照片+衣柜叠加成合成图持久化；保存成功后自动跳转 cost 页（合成图作为预览），返回时落在 pd2dList。

**Architecture:** 局部前端改动，复用现有 `pd2dStorage`（增字段+新增重名工具）、新增 `pd2dComposite` 离屏合成、`pd2dList` 增加 `openCostId` 自动跳 cost。不动云端，不动 `cost.js`，合成图失败降级为照片。

**Tech Stack:** WeChat 小程序 JS（CommonJS）；Jest 单元测试；现有 `__tests__/helpers/wx-mock.js` 提供 `wx.*` mock。

**Spec:** `docs/superpowers/specs/2026-06-11-pd2d-save-and-jump-design.md`

---

## File Structure

新建：
- `utils/pd2dComposite.js` — 唯一职责：将 2d 照片画布与 webgl 衣柜画布叠加成 PNG，返回临时路径。
- `__tests__/pd2dStorage.test.js` — `isNameUnique` 与 `saveLayout` 新字段的单测。

修改：
- `utils/pd2dStorage.js` — 新增 `isNameUnique`；`saveLayout` 接受 `compositePath`。
- `pages/knowledge/pd2d/pd2d.js` — `onConfirmSpace` 加重名校验；`_confirmLayout` 改成「合成图 + 保存 + redirectTo」流程。
- `pages/knowledge/pd2dList/pd2dList.js` — 抽 `_navigateToCost(rec)`；`onLoad` 接 `openCostId` 自动跳 cost。

---

## Task 1: pd2dStorage 新增 `isNameUnique` 工具

**Files:**
- Test: `__tests__/pd2dStorage.test.js`（新建）
- Modify: `utils/pd2dStorage.js`（在文件尾部 `module.exports` 前新增 `isNameUnique` 函数；`module.exports` 增加导出）

- [ ] **Step 1.1: 写失败测试**

新建 `__tests__/pd2dStorage.test.js`，写入：

```javascript
require('./helpers/wx-mock.js');
var storage = require('../utils/pd2dStorage.js');

beforeEach(function() {
  global._wxStorage.clear();
});

describe('pd2dStorage.isNameUnique', function() {
  it('returns true when storage is empty', function() {
    expect(storage.isNameUnique('客厅')).toBe(true);
  });

  it('returns false when name already exists', function(done) {
    storage.saveLayout({
      name: '客厅', photoPath: '',
      wall: { width: 300, height: 260 }, modules: []
    }).then(function() {
      expect(storage.isNameUnique('客厅')).toBe(false);
      done();
    });
  });

  it('trims both sides before compare ("客厅 " equals "客厅")', function(done) {
    storage.saveLayout({
      name: '客厅', photoPath: '',
      wall: { width: 300, height: 260 }, modules: []
    }).then(function() {
      expect(storage.isNameUnique('客厅 ')).toBe(false);
      expect(storage.isNameUnique(' 客厅')).toBe(false);
      done();
    });
  });

  it('returns true when excludeId matches the only same-name record', function(done) {
    storage.saveLayout({
      name: '客厅', photoPath: '',
      wall: { width: 300, height: 260 }, modules: []
    }).then(function(saved) {
      expect(storage.isNameUnique('客厅', saved.id)).toBe(true);
      done();
    });
  });
});
```

- [ ] **Step 1.2: 跑测试确认失败**

Run: `npx jest __tests__/pd2dStorage.test.js -t "isNameUnique"`
Expected: FAIL，原因为 `storage.isNameUnique is not a function`。

- [ ] **Step 1.3: 实现 `isNameUnique`**

在 `utils/pd2dStorage.js` 的 `module.exports = { ... }` **之前**插入：

```javascript
function isNameUnique(name, excludeId) {
  var target = (name || '').trim();
  if (!target) return true;
  var all = readAll();
  for (var i = 0; i < all.length; i++) {
    if (excludeId && all[i].id === excludeId) continue;
    var existing = (all[i].name || '').trim();
    if (existing === target) return false;
  }
  return true;
}
```

并在 `module.exports = {` 块中新增一行：

```javascript
  isNameUnique: isNameUnique,
```

（放在 `saveLayout: saveLayout,` 之后即可。）

- [ ] **Step 1.4: 跑测试确认通过**

Run: `npx jest __tests__/pd2dStorage.test.js -t "isNameUnique"`
Expected: 4 passing。

- [ ] **Step 1.5: Commit**

```bash
git add utils/pd2dStorage.js __tests__/pd2dStorage.test.js
git commit -m "feat(pd2dStorage): add isNameUnique helper with unit tests"
```

---

## Task 2: pd2dStorage.saveLayout 接受 `compositePath`

**Files:**
- Test: `__tests__/pd2dStorage.test.js`（在已有文件追加 describe）
- Modify: `utils/pd2dStorage.js`（`saveLayout` 函数体）

- [ ] **Step 2.1: 写失败测试**

在 `__tests__/pd2dStorage.test.js` 文件尾部追加：

```javascript
describe('pd2dStorage.saveLayout compositePath', function() {
  it('persists compositePath via wx.saveFile when provided', function(done) {
    storage.saveLayout({
      name: '客厅', photoPath: '',
      compositePath: 'wxfile://temp_composite_xyz',
      wall: { width: 300, height: 260 }, modules: []
    }).then(function(saved) {
      expect(saved.compositePath).toMatch(/^wxfile:\/\/saved_/);
      var loaded = storage.loadLayout(saved.id);
      expect(loaded.compositePath).toBe(saved.compositePath);
      done();
    });
  });

  it('defaults compositePath to empty string when not provided', function(done) {
    storage.saveLayout({
      name: '卧室', photoPath: '',
      wall: { width: 300, height: 260 }, modules: []
    }).then(function(saved) {
      expect(saved.compositePath).toBe('');
      var loaded = storage.loadLayout(saved.id);
      expect(loaded.compositePath).toBe('');
      done();
    });
  });
});
```

- [ ] **Step 2.2: 跑测试确认失败**

Run: `npx jest __tests__/pd2dStorage.test.js -t "compositePath"`
Expected: FAIL，原因 `saved.compositePath` 是 `undefined`。

- [ ] **Step 2.3: 修改 `saveLayout` 实现**

在 `utils/pd2dStorage.js` 找到 `function saveLayout(layout) {` 的实现，把整个函数替换为：

```javascript
function saveLayout(layout) {
  return Promise.all([
    persistPhoto(layout.photoPath),
    persistPhoto(layout.compositePath)
  ]).then(function(paths) {
    var savedPhoto = paths[0];
    var savedComposite = paths[1];
    var all = readAll();
    var now = Date.now();
    var id = layout.id || genId();
    var record = {
      id: id,
      name: layout.name || '未命名方案',
      createdAt: layout.createdAt || now,
      updatedAt: now,
      photoPath: savedPhoto,
      compositePath: savedComposite,
      wall: { width: layout.wall.width, height: layout.wall.height },
      spaceName: layout.spaceName || '',
      corners: (layout.corners || []).map(function(c){ return { x: c.x, y: c.y }; }),
      selectedWidth: layout.selectedWidth,
      selectedType: layout.selectedType,
      selectedModelId: layout.selectedModelId,
      doorVisible: !!layout.doorVisible,
      modules: (layout.modules || []).map(function(m) {
        return {
          type: m.type, width: m.width,
          wallX: m.wallX, isStandard: m.isStandard !== false
        };
      })
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
    return { id: record.id, photoPath: record.photoPath, compositePath: record.compositePath };
  });
}
```

- [ ] **Step 2.4: 跑全部 pd2dStorage 测试**

Run: `npx jest __tests__/pd2dStorage.test.js`
Expected: 全部通过（含此前 Task 1 的 4 个用例）。

- [ ] **Step 2.5: 跑全部测试确认无回归**

Run: `npx jest`
Expected: 全部通过（不影响 pd3dStorage、photoFit 等已有测试）。

- [ ] **Step 2.6: Commit**

```bash
git add utils/pd2dStorage.js __tests__/pd2dStorage.test.js
git commit -m "feat(pd2dStorage): saveLayout accepts compositePath, persisted via saveFile"
```

---

## Task 3: 新增 `utils/pd2dComposite.js`

**Files:**
- Create: `utils/pd2dComposite.js`

不写单测：函数依赖 `wx.createOffscreenCanvas` 和 `wx.canvasToTempFilePath`，这两个 API 行为复杂、mock 价值低。手测在 Task 6 覆盖。

- [ ] **Step 3.1: 创建文件**

新建 `utils/pd2dComposite.js`，内容：

```javascript
/**
 * PD2D 合成预览图工具
 *
 * 把 pd2d 页面的 2d 照片画布与 webgl 衣柜叠加画布合并成一张 PNG。
 * 失败时 reject——上层用 catch 降级为不存合成图。
 *
 * 唯一导出：
 *   composePreview({ photoCanvas, overlayCanvas, width, height, dpr })
 *     return Promise<string>  // wxfile://temp_xxx 临时路径
 */

function composePreview(opts) {
  return new Promise(function(resolve, reject) {
    if (!opts || !opts.photoCanvas || !opts.overlayCanvas) {
      reject(new Error('composePreview: missing canvases'));
      return;
    }
    var w = opts.width;
    var h = opts.height;
    var dpr = opts.dpr || 2;
    if (!w || !h) {
      reject(new Error('composePreview: invalid size'));
      return;
    }
    var pxW = Math.round(w * dpr);
    var pxH = Math.round(h * dpr);

    var off;
    try {
      off = wx.createOffscreenCanvas({ type: '2d', width: pxW, height: pxH });
    } catch (e) {
      reject(e);
      return;
    }
    if (!off) {
      reject(new Error('composePreview: createOffscreenCanvas returned null'));
      return;
    }
    var ctx = off.getContext('2d');
    if (!ctx) {
      reject(new Error('composePreview: getContext failed'));
      return;
    }

    try {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, pxW, pxH);
      ctx.drawImage(opts.photoCanvas, 0, 0, pxW, pxH);
      ctx.drawImage(opts.overlayCanvas, 0, 0, pxW, pxH);
    } catch (e) {
      reject(e);
      return;
    }

    wx.canvasToTempFilePath({
      canvas: off,
      fileType: 'png',
      success: function(res) {
        if (res && res.tempFilePath) {
          resolve(res.tempFilePath);
        } else {
          reject(new Error('composePreview: empty tempFilePath'));
        }
      },
      fail: function(err) {
        reject(err || new Error('composePreview: canvasToTempFilePath failed'));
      }
    });
  });
}

module.exports = {
  composePreview: composePreview
};
```

- [ ] **Step 3.2: Commit**

```bash
git add utils/pd2dComposite.js
git commit -m "feat(pd2dComposite): offscreen 2d composite of photo + webgl overlay"
```

---

## Task 4: pd2d.js `onConfirmSpace` 增加重名校验

**Files:**
- Modify: `pages/knowledge/pd2d/pd2d.js`（顶部 `require` 区；`onConfirmSpace` 函数）

不写新单测：页面交互层依赖 wx mock + 页面构造，性价比低。功能由 Task 7 手测覆盖。

- [ ] **Step 4.1: 已 require 检查**

确认 `pages/knowledge/pd2d/pd2d.js` 顶部已有：

```javascript
var photoFit = require('../../../utils/photoFit.js');
```

`pd2dStorage` **暂无** require，需要在 `_confirmLayout` 中再 require（保持现状最小改动；那里已有 `var storage = require('../../../utils/pd2dStorage.js');`）。本步骤不在顶部加 require，只在 `onConfirmSpace` 内部局部 require 用一次。

- [ ] **Step 4.2: 修改 `onConfirmSpace`**

定位 `pages/knowledge/pd2d/pd2d.js` 的 `onConfirmSpace` 函数。把整个函数体替换为：

```javascript
  onConfirmSpace() {
    var name = (this.data.spaceName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入空间名称', icon: 'none' });
      return;
    }
    var w = parseInt(this.data.wallWidth, 10);
    var h = parseInt(this.data.wallHeight, 10);
    if (isNaN(w) || w < 44 || w > 1000) {
      wx.showToast({ title: '墙宽需在44-1000cm', icon: 'none' });
      return;
    }
    if (isNaN(h) || h < 232 || h > 400) {
      wx.showToast({ title: '墙高需在232-400cm', icon: 'none' });
      return;
    }
    var storage = require('../../../utils/pd2dStorage.js');
    try {
      if (!storage.isNameUnique(name)) {
        wx.showToast({ title: '该空间名称已存在', icon: 'none' });
        return;
      }
    } catch (e) {
      // 存储读取异常时不阻断流程，让用户继续；保存阶段会再次失败给提示
    }
    var areaH = this._photoImg
      ? this.data.photoAreaHeight
      : photoFit.computePhotoAreaHeight(
          w, h, this._screenW || 375, this._screenH || 667,
          PHOTO_MIN_VH, PHOTO_MAX_VH
        );
    this.setData({
      spaceName: name, wallWidth: w, wallHeight: h,
      spaceConfirmed: true, modules: [],
      isWallFull: false, doorVisible: false,
      photoAreaHeight: areaH
    });
    var self = this;
    self._canvas = null;
    self._ctx = null;
    setTimeout(function() {
      self.initCanvas();
      self._initModelPreview();
      self._initOverlay();
    }, 120);
  },
```

- [ ] **Step 4.3: 跑全部单测确认无回归**

Run: `npx jest`
Expected: 全绿。

- [ ] **Step 4.4: Commit**

```bash
git add pages/knowledge/pd2d/pd2d.js
git commit -m "feat(pd2d): block duplicate space name on confirm"
```

---

## Task 5: pd2d.js `_confirmLayout` 改为合成图 + 跳转流程

**Files:**
- Modify: `pages/knowledge/pd2d/pd2d.js`（`_confirmLayout` 函数）

- [ ] **Step 5.1: 替换 `_confirmLayout` 全函数**

定位 `pages/knowledge/pd2d/pd2d.js` 的 `_confirmLayout`，整个函数替换为：

```javascript
  _confirmLayout() {
    var self = this;
    if (!self.data.modules || self.data.modules.length === 0) {
      wx.showToast({ title: '请先放置柜体', icon: 'none' });
      return;
    }
    if (self._saving) return;
    var name = self.data.spaceName || '未命名方案';
    wx.showModal({
      title: '保存方案',
      content: '保存方案到《' + name + '》？',
      success: function(modal) {
        if (!modal.confirm) return;
        if (self._saving) return;
        self._saving = true;
        wx.showLoading({ title: '保存中...', mask: true });

        var composite = require('../../../utils/pd2dComposite.js');
        var compositePromise = composite.composePreview({
          photoCanvas: self._canvas,
          overlayCanvas: self._overlayCanvas,
          width: self.data.canvasWidth,
          height: self.data.canvasHeight,
          dpr: self._dpr || 2
        }).catch(function(err) {
          console.warn('[pd2d] composePreview failed, fall back to no composite:', err);
          return '';
        });

        compositePromise.then(function(compositePath) {
          var storage = require('../../../utils/pd2dStorage.js');
          var photoPath = self._photoTempPath || '';
          return storage.saveLayout({
            name: name,
            photoPath: photoPath,
            compositePath: compositePath || '',
            spaceName: self.data.spaceName,
            wall: { width: self.data.wallWidth, height: self.data.wallHeight },
            corners: self.data.corners,
            selectedWidth: self.data.selectedWidth,
            selectedType: self.data.selectedType,
            selectedModelId: self.data.selectedModelId,
            doorVisible: self.data.doorVisible,
            modules: self.data.modules
          });
        }).then(function(saved) {
          wx.hideLoading();
          wx.showToast({ title: '已保存', icon: 'success', duration: 800 });
          var bridgeId = 'pd2dlocal:' + saved.id;
          var url = '/pages/knowledge/pd2dList/pd2dList?openCostId=' + encodeURIComponent(bridgeId);
          setTimeout(function() {
            wx.redirectTo({
              url: url,
              fail: function() {
                wx.navigateTo({
                  url: url,
                  fail: function() {
                    wx.showToast({ title: '跳转失败', icon: 'none' });
                  }
                });
              }
            });
            self._saving = false;
          }, 600);
        }).catch(function(err) {
          self._saving = false;
          wx.hideLoading();
          console.error('[pd2d] save layout failed', err);
          wx.showToast({ title: '保存失败', icon: 'none' });
        });
      },
      fail: function() { /* user dismissed modal */ }
    });
  },
```

- [ ] **Step 5.2: 跑全部测试**

Run: `npx jest`
Expected: 全绿（pd2d.js 不直接被单测，但确保无意外破坏 utils 引用）。

- [ ] **Step 5.3: Commit**

```bash
git add pages/knowledge/pd2d/pd2d.js
git commit -m "feat(pd2d): save with composite preview, then redirect to pd2dList"
```

---

## Task 6: pd2dList.js 抽 `_navigateToCost` + 处理 `openCostId`

**Files:**
- Modify: `pages/knowledge/pd2dList/pd2dList.js`（`onLoad` / `openLayout` / 新增 `_navigateToCost`）

- [ ] **Step 6.1: 新增 `_navigateToCost` 与改造 `openLayout`**

定位 `pages/knowledge/pd2dList/pd2dList.js` 的 `openLayout` 函数。整段替换为下面的两个方法（先 `_navigateToCost` 后 `openLayout`）：

```javascript
  // 把本地方案桥接到 globalData.designs 并 navigateTo cost 页
  _navigateToCost: function(rec) {
    if (!rec) return;
    var bridgeId = BRIDGE_PREFIX + rec.id;
    var preview = rec.compositePath || rec.photoPath || '';
    var design = {
      _id: bridgeId,
      name: rec.name,
      wallWidth: (rec.wall && rec.wall.width) || 0,
      wallHeight: (rec.wall && rec.wall.height) || 0,
      modules: rec.modules || [],
      previewImage: preview,
      cornerType: 'none',
      createTime: rec.createdAt
    };
    if (!app.globalData.designs) app.globalData.designs = [];
    var existing = app.globalData.designs;
    var found = false;
    for (var i = 0; i < existing.length; i++) {
      if (existing[i]._id === bridgeId) { existing[i] = design; found = true; break; }
    }
    if (!found) existing.push(design);
    app.globalData.currentDesignPreview = preview;
    wx.navigateTo({
      url: '/packageDesign/cost/cost?id=' + encodeURIComponent(bridgeId),
      fail: function() { wx.showToast({ title: '跳转失败', icon: 'none' }); }
    });
  },

  openLayout: function(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    var rec = storage.loadLayout(id);
    if (!rec) {
      wx.showToast({ title: '方案不存在', icon: 'none' });
      this._refresh();
      return;
    }
    this._navigateToCost(rec);
  },
```

- [ ] **Step 6.2: 修改 `onLoad` 接 `openCostId`**

定位 `pages/knowledge/pd2dList/pd2dList.js` 的 `onLoad`。整段替换为：

```javascript
  onLoad: function(options) {
    try {
      var sysInfo = wx.getWindowInfo();
      var menuBtn = wx.getMenuButtonBoundingClientRect();
      var sb = sysInfo.statusBarHeight || 20;
      var nb = (menuBtn.top - sb) * 2 + menuBtn.height;
      this.setData({ statusBarHeight: sb, navBarHeight: nb });
    } catch (e) {}

    if (options && options.openCostId) {
      var raw = decodeURIComponent(options.openCostId);
      var realId = raw.indexOf(BRIDGE_PREFIX) === 0
        ? raw.substring(BRIDGE_PREFIX.length)
        : raw;
      this._refresh();
      var rec = storage.loadLayout(realId);
      if (rec) {
        var self = this;
        setTimeout(function() { self._navigateToCost(rec); }, 50);
      }
    }
  },
```

- [ ] **Step 6.3: 跑全部测试**

Run: `npx jest`
Expected: 全绿。

- [ ] **Step 6.4: Commit**

```bash
git add pages/knowledge/pd2dList/pd2dList.js
git commit -m "feat(pd2dList): auto-navigate to cost on openCostId; reuse _navigateToCost"
```

---

## Task 7: 手测验证 + 总收尾 commit

**Files:** none（仅手测）

- [ ] **Step 7.1: 启动微信开发者工具**

打开 WeChat Developer Tools，导入项目根目录 `D:\工程\柠檬塔\程序\LemonTA-main\LemonTA-main`，编译。

- [ ] **Step 7.2: A 组重名校验手测**

清空小程序缓存（开发工具 → 清缓存 → 全部），然后逐项执行：

- 进入 PD2D 页面，输入 `客厅` + 墙 300×260 → 点【确认】 → 应进入画布
- 返回上一级再进 PD2D，输入 `客厅` → 点【确认】 → Toast `该空间名称已存在`，停留在第一屏
- 输入 `客厅 `（尾部空格）+ 墙宽高 → 点【确认】 → 同样 Toast `该空间名称已存在`
- 输入 `客厅2` → 点【确认】 → 顺利进入画布
- 输入空 / 全空格 + 点【确认】 → Toast `请输入空间名称`

全部勾选后再继续。

- [ ] **Step 7.3: B 组保存 + 合成图 + 跳转手测**

- 进入 PD2D 输入新空间名（不重名）→ 进画布
- 上传一张照片，调四角，放置至少一个柜体直至墙满
- 点【保存方案】→ 弹窗内容应为「保存方案到《XX》？」，**无输入框**
- 确认 → Loading 出现 → 消失 → Toast `已保存` → 自动跳到 pd2dList
- pd2dList 应能立刻看到新卡片，并自动 `navigateTo` 到 cost 页
- cost 页顶部预览应是**含柜体的合成图**（不是空墙照片）
- 在 cost 页点返回 → 应落在 **pd2dList**（不是 pd2d 画布）

- [ ] **Step 7.4: C 组未上传照片场景**

- 进 PD2D，输入新空间名，**不上传照片**，直接点【确认】→ 进入画布（仅墙面草绘）
- 放至少一个柜体 → 保存
- cost 页应能正常显示（合成图无照片但有柜体灰底）

- [ ] **Step 7.5: D 组合成图降级手测（可选）**

临时把 `utils/pd2dComposite.js` 的 `composePreview` 内 `resolve` 改为 `reject(new Error('manual test'))`，重新编译：

- 走一次完整保存流程 → 应仍弹 `已保存`，跳到 pd2dList，再跳 cost；cost 页 preview 退化为照片本身（无柜体叠加）

测完恢复 `utils/pd2dComposite.js`（`git checkout utils/pd2dComposite.js`）。

- [ ] **Step 7.6: E 组回归手测**

- pd2dList 点已存在的方案卡片 → 仍正常打开 cost 页（验证 `_navigateToCost` 抽方法没坏）
- pd2dList 点【开始新设计】→ 跳到 pd2d 第一屏正常
- 知识库直接进 PD2D（无 `openCostId`）→ 第一屏正常显示

- [ ] **Step 7.7: F 组防重入手测**

- 走到墙满后弹出弹窗，**快速连点确认按钮两下** → 应只保存一条记录（去 pd2dList 看卡片数量）

- [ ] **Step 7.8: 跑最终单测**

Run: `npx jest`
Expected: 全部通过。

- [ ] **Step 7.9: 检查无遗留调试代码**

Run: `git diff main -- utils pages | grep -nE "console\.(log|debug)"`
Expected: 仅业务必要的 `console.warn` / `console.error`，无新增调试 `console.log`。如有调试日志，删除。

- [ ] **Step 7.10: 总收尾（如有上一步删除）**

如果 Step 7.9 有改动：

```bash
git add -p
git commit -m "chore(pd2d): remove debug logs"
```

否则跳过此步。

---

## 风险与回滚

- 每个 Task 一个独立 commit，回滚粒度是单 Task。
- 最高风险：Task 5（`_confirmLayout`）改动最大，单 commit 内回滚即可。
- 二级风险：Task 2（`saveLayout` 签名变化）—— 单测兜底，回滚也是单 commit。

## 验收

- `npx jest` 全绿
- A–F 全部手测项勾选
- `git log feature/photo-perspective ^main` 应有 6 个新 commit（Task 1, 2, 3, 4, 5, 6 各一个；Task 7 通常不产生 commit）
