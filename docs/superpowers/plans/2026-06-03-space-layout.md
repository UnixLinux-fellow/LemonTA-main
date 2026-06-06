# Space Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract layout computation into a shared utility, then add a cabinet layout stage to glbviewer's space mode — auto-fill default modules, allow tap/longpress editing on Canvas, and navigate to cost.

**Architecture:** New `utils/layoutCompute.js` holds shared pure functions. `layout.js` refactored to call them. `glbviewer.js` gains a `spaceStage` state machine (`marking` → `layout`) with Canvas-based module rendering and touch interaction. The cost page is reached via save-then-navigate (same pattern as layout.js).

**Tech Stack:** WeChat Mini Program, Canvas 2D, Cloud DB (for design save)

---

### Task 1: Create `utils/layoutCompute.js`

**Files:**
- Create: `utils/layoutCompute.js`

- [ ] **Step 1: Write the file**

```javascript
/**
 * 布局计算公共模块
 * layout.js 和 glbviewer/space-mode 共用
 */

/**
 * 计算布局核心参数
 * @param {number} wallWidth - 墙宽 (cm)
 * @param {string} cornerType - WZJ|ZZJ|YZJ|ZYZJ
 * @returns {{ standardWidth: number, customWidth: number, cornerCount: number }}
 */
function computeParams(wallWidth, cornerType) {
  var w = wallWidth;
  var cornerCount = cornerType === 'ZYZJ' ? 2 : (cornerType === 'WZJ' ? 0 : 1);

  var minX = w - 124 - (cornerCount * 110);
  var maxX = w - 44 - (cornerCount * 110);

  var standardWidth = 0;
  for (var x = Math.ceil(minX / 50) * 50; x <= maxX; x += 50) {
    if (x >= minX && x <= maxX) {
      standardWidth = x;
      break;
    }
  }
  if (standardWidth < 50) standardWidth = 50;

  var customWidth = w - 4 - (cornerCount * 110) - standardWidth;

  return {
    standardWidth: standardWidth,
    customWidth: customWidth,
    cornerCount: cornerCount
  };
}

/**
 * 自动填充推荐模块列表
 * 优先用 100cm 填 standardWidth，余数用 50cm
 * @param {number} standardWidth
 * @param {number} customWidth
 * @param {number} cornerCount - 0|1|2
 * @param {string} cornerType - WZJ|ZZJ|YZJ|ZYZJ
 * @returns {Array<{width: number, type: string, isCorner?: boolean, isCustom?: boolean}>}
 */
function autoFill(standardWidth, customWidth, cornerCount, cornerType) {
  var modules = [];
  var hasLeftCorner = (cornerType === 'ZZJ' || cornerType === 'ZYZJ');
  var hasRightCorner = (cornerType === 'YZJ' || cornerType === 'ZYZJ');

  // 左转角柜（ZZJ / ZYZJ）
  if (hasLeftCorner) {
    modules.push({ width: 110, type: 'a', isCorner: true });
  }

  // 标准模块：优先 100cm
  var remaining = standardWidth;
  while (remaining >= 100) {
    modules.push({ width: 100, type: 'a', isCorner: false });
    remaining -= 100;
  }
  if (remaining >= 50) {
    modules.push({ width: 50, type: 'a', isCorner: false });
    remaining -= 50;
  }

  // 非标模块
  if (customWidth >= 45) {
    modules.push({ width: customWidth, type: 'a', isCustom: true });
  }

  // 右转角柜（YZJ / ZYZJ）
  if (hasRightCorner) {
    modules.push({ width: 110, type: 'a', isCorner: true });
  }

  return modules;
}

/**
 * 获取最接近的可用非标宽度
 * @param {number} w
 * @returns {number}
 */
function getNearestEWidth(w) {
  var available = [45, 55, 65, 75, 85, 95, 105, 115];
  var nearest = 75;
  var minDiff = Infinity;
  for (var i = 0; i < available.length; i++) {
    var diff = Math.abs(available[i] - w);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = available[i];
    }
  }
  return nearest;
}

/**
 * 获取当前宽度下可选模块列表
 * @param {number} selectedWidth - 50|100 或其他
 * @param {number} customWidth
 * @param {boolean} isCustomModule
 * @param {function} pictureFn - assets.picture 函数引用
 * @returns {Array<{type: string, label: string, image: string}>}
 */
function getAvailableModules(selectedWidth, customWidth, isCustomModule, pictureFn) {
  var modules = [];
  if (isCustomModule) {
    var ew = getNearestEWidth(customWidth);
    modules = [
      { type: 'a', label: 'A型', image: pictureFn('e/a-' + ew + '-230') },
      { type: 'b', label: 'B型', image: pictureFn('e/b-' + ew + '-230') },
      { type: 'c', label: 'C型', image: pictureFn('e/c-' + ew + '-230') },
      { type: 'd', label: 'D型', image: pictureFn('e/d-' + ew + '-230') }
    ];
  } else {
    var w = selectedWidth;
    modules = [
      { type: 'a', label: 'A型', image: pictureFn(w + '/a-' + w + '-230') },
      { type: 'b', label: 'B型', image: pictureFn(w + '/b-' + w + '-230') },
      { type: 'c', label: 'C型', image: pictureFn(w + '/c-' + w + '-230') },
      { type: 'd', label: 'D型', image: pictureFn(w + '/d-' + w + '-230') }
    ];
  }
  return modules;
}

module.exports = {
  computeParams: computeParams,
  autoFill: autoFill,
  getNearestEWidth: getNearestEWidth,
  getAvailableModules: getAvailableModules
};
```

- [ ] **Step 2: Commit**

```bash
git add utils/layoutCompute.js
git commit -m "feat: extract layout computation into shared utils/layoutCompute"
```

---

### Task 2: Refactor `layout.js` to use `utils/layoutCompute`

**Files:**
- Modify: `packageDesign/layout/layout.js`

- [ ] **Step 1: Add require at top**

At line 2 (after `var assets = require('../../utils/assets.js');`), add:

```javascript
var layoutCompute = require('../../utils/layoutCompute.js');
```

- [ ] **Step 2: Replace onLoad computation (lines 89-109)**

Replace the inline cornerCount/standardWidth/customWidth computation:

Old code (lines 89-109):
```javascript
    var w = parseInt(width);
    var h = parseInt(height);
    var cornerCount = corner === 'ZYZJ' ? 2 : (corner === 'WZJ' ? 0 : 1);

    // 计算标准模块可摆放宽度 x
    var minX = w - 124 - (cornerCount * 110);
    var maxX = w - 44 - (cornerCount * 110);
    
    // 在 (minX, maxX) 之间找可被50整除的最小数
    var standardWidth = 0;
    for (var x = Math.ceil(minX / 50) * 50; x <= maxX; x += 50) {
      if (x >= minX && x <= maxX) {
        standardWidth = x;
        break;
      }
    }
    // 确保standardWidth至少为50
    if (standardWidth < 50) standardWidth = 50;

    // 非标宽度 e = 总宽 - 4(两侧收口条) - cornerCount*110 - standardWidth
    var customWidth = w - 4 - (cornerCount * 110) - standardWidth;
```

New code:
```javascript
    var w = parseInt(width);
    var h = parseInt(height);
    var params = layoutCompute.computeParams(w, corner);
    var cornerCount = params.cornerCount;
    var standardWidth = params.standardWidth;
    var customWidth = params.customWidth;
```

- [ ] **Step 3: Replace `updateAvailableModules` body (lines 170-196)**

Replace the method body to use `layoutCompute.getAvailableModules`:

```javascript
  updateAvailableModules() {
    var data = this.data;
    var modules = layoutCompute.getAvailableModules(
      data.selectedWidth,
      data.customWidth,
      data.isCustomModule,
      assets.picture
    );
    this.setData({ availableModules: modules });
  },
```

- [ ] **Step 4: Replace `getNearestEWidth` body (lines 198-210)**

Replace with delegation:

```javascript
  getNearestEWidth(w) {
    return layoutCompute.getNearestEWidth(w);
  },
```

- [ ] **Step 5: Commit**

```bash
git add packageDesign/layout/layout.js
git commit -m "refactor: layout.js delegates computation to utils/layoutCompute"
```

---

### Task 3: glbviewer.js — spaceStage fields + `confirmSpace` + `_drawLayout`

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.js`

- [ ] **Step 1: Add require at top**

At line 1 (after `var app = getApp();`), add:

```javascript
var layoutCompute = require('../../utils/layoutCompute.js');
```

- [ ] **Step 2: Add layout-stage data fields**

In the `data` object, add these fields after the existing space-mode fields (after `draggingIndex: -1`):

```javascript
    // 布局阶段
    spaceStage: 'marking',       // 'marking' | 'layout'
    wallWidthNum: 0,             // 确认后的墙宽数值
    wallHeightNum: 0,            // 确认后的墙高数值
    layoutModules: [],           // 当前已放置的模块列表 [{width, type, isCorner?, isCustom?, color}]
    selectedWidth: 50,           // 当前选中模块宽度：50 | 100（或 customWidth 数值）
    selectedType: 'a',           // 当前选中模块类型
    selectedColor: 'white',      // 当前选中颜色: 'white' | 'cream' | 'other'
    isCustomModule: false,       // 是否选中非标模块
    selectedModuleIndex: -1,     // 当前选中的柜子索引，-1 表示无
```

- [ ] **Step 3: Add `confirmSpace` — validate + autoFill + switch to layout stage**

Insert after `resetMarkers` method:

```javascript
  /** 确认空间参数，自动填充并切换到布局阶段 */
  confirmSpace: function() {
    var markers = this.data.markers;
    if (markers.length < 2) {
      wx.showToast({ title: '请至少标记2个墙角', icon: 'none' });
      return;
    }

    var wallWidth = parseInt(this.data.wallWidth);
    var wallHeight = parseInt(this.data.wallHeight);

    if (!wallWidth || wallWidth < 44) {
      wx.showToast({ title: '墙宽需 >= 44cm', icon: 'none' });
      return;
    }
    if (wallWidth > 1000) {
      wx.showToast({ title: '墙宽需 <= 1000cm', icon: 'none' });
      return;
    }
    if (!wallHeight || wallHeight < 232) {
      wx.showToast({ title: '墙高需 >= 232cm', icon: 'none' });
      return;
    }
    if (wallHeight > 400) {
      wx.showToast({ title: '墙高需 <= 400cm', icon: 'none' });
      return;
    }

    // 映射 corner 类型
    var cornerMap = { none: 'WZJ', left: 'ZZJ', right: 'YZJ', both: 'ZYZJ' };
    var cornerType = cornerMap[this.data.cornerType] || 'WZJ';

    var params = layoutCompute.computeParams(wallWidth, cornerType);
    var modules = layoutCompute.autoFill(
      params.standardWidth,
      params.customWidth,
      params.cornerCount,
      cornerType
    );

    // 给每个模块加上 color 属性
    for (var i = 0; i < modules.length; i++) {
      modules[i].color = 'white';
    }

    this.setData({
      spaceStage: 'layout',
      wallWidthNum: wallWidth,
      wallHeightNum: wallHeight,
      layoutModules: modules,
      selectedModuleIndex: -1,
      selectedWidth: 50,
      selectedType: 'a',
      selectedColor: 'white',
      isCustomModule: false
    });

    // 下一帧绘制
    var self = this;
    setTimeout(function() { self._drawLayout(); }, 300);
  },
```

- [ ] **Step 4: Add `_drawLayout` — Canvas rendering of full layout**

Insert after `confirmSpace`:

```javascript
  /** 绘制完整布局：墙体轮廓 + 柜子色块 */
  _drawLayout: function() {
    var ctx = wx.createCanvasContext('layoutCanvas', this);
    var modules = this.data.layoutModules;
    var wallWidth = this.data.wallWidthNum;
    var selectedIndex = this.data.selectedModuleIndex;
    if (!wallWidth || modules.length === 0) return;

    var cw = 340;  // Canvas 逻辑宽度 (680rpx / 2)
    var ch = 140;  // Canvas 逻辑高度 (280rpx / 2)
    var padTop = 20;
    var padSide = 10;
    var barH = 80;  // 柜子矩形高度
    var barY = padTop + (ch - padTop - barH) / 2;

    var scale = (cw - padSide * 2) / wallWidth;

    ctx.clearRect(0, 0, cw, ch);

    // 墙体背景
    ctx.setFillStyle('rgba(255,255,255,0.04)');
    ctx.fillRect(padSide, barY - 4, cw - padSide * 2, barH + 8);
    ctx.setStrokeStyle('rgba(255,255,255,0.12)');
    ctx.setLineWidth(1);
    ctx.strokeRect(padSide, barY - 4, cw - padSide * 2, barH + 8);

    // 累计 x 偏移
    var cx = padSide;

    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      var mw = m.width * scale;
      var isSelected = (i === selectedIndex);
      var isCorner = m.isCorner;
      var isCustom = m.isCustom;

      // 颜色映射
      var colorHex;
      if (isCorner) {
        colorHex = 'rgba(252, 151, 0, 0.25)';  // 转角柜：橙色
      } else if (m.color === 'white') {
        colorHex = 'rgba(255, 255, 255, 0.15)';
      } else if (m.color === 'cream') {
        colorHex = 'rgba(255, 248, 220, 0.22)';
      } else {
        colorHex = 'rgba(180, 180, 180, 0.18)';
      }

      ctx.setFillStyle(colorHex);
      ctx.fillRect(cx, barY, mw, barH);
      ctx.setStrokeStyle(isSelected ? '#FC9700' : 'rgba(255,255,255,0.2)');
      ctx.setLineWidth(isSelected ? 2.5 : 1);
      ctx.strokeRect(cx, barY, mw, barH);

      // 标签
      var label = isCorner ? '转角' : (m.width + ' ' + m.type.toUpperCase());
      ctx.setFillStyle('#ffffff');
      ctx.setFontSize(11);
      ctx.setTextAlign('center');
      ctx.fillText(label, cx + mw / 2, barY + barH / 2 + 4);

      // 非标斜线标识
      if (isCustom) {
        ctx.setStrokeStyle('rgba(255,255,255,0.15)');
        ctx.setLineWidth(0.5);
        for (var diag = 0; diag < mw; diag += 8) {
          ctx.beginPath();
          ctx.moveTo(cx + diag, barY);
          ctx.lineTo(cx + diag + 6, barY + barH);
          ctx.stroke();
        }
      }

      cx += mw;
    }

    // 空余空间虚线
    if (cx < cw - padSide) {
      ctx.setStrokeStyle('rgba(255,255,255,0.12)');
      ctx.setLineWidth(1);
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(cx, barY, cw - padSide - cx, barH);
      ctx.setLineDash([]);
    }

    ctx.draw();
  },
```

- [ ] **Step 5: Commit**

```bash
git add pages/knowledge/glbviewer/glbviewer.js
git commit -m "feat: add spaceStage, confirmSpace, and _drawLayout to glbviewer"
```

---

### Task 4: glbviewer.js — module interaction handlers

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.js`

- [ ] **Step 1: Add `onSelectWidth`, `onSelectType`, `onSelectColor` handlers**

Insert after `_drawLayout`:

```javascript
  onSelectWidth: function(e) {
    var val = e.currentTarget.dataset.width;
    if (val === 'custom') {
      this.setData({ selectedWidth: this.data.wallWidthNum, isCustomModule: true });
    } else {
      this.setData({ selectedWidth: parseInt(val), isCustomModule: false });
    }
    this._updateSelectedModule();
  },

  onSelectType: function(e) {
    var val = e.currentTarget.dataset.type;
    this.setData({ selectedType: val });
    this._updateSelectedModule();
  },

  onSelectColor: function(e) {
    var val = e.currentTarget.dataset.color;
    this.setData({ selectedColor: val });
    this._updateSelectedModule();
  },
```

- [ ] **Step 2: Add `_updateSelectedModule` — apply selector values to selected cabinet**

```javascript
  /** 将选择器当前值应用到选中的柜子 */
  _updateSelectedModule: function() {
    var idx = this.data.selectedModuleIndex;
    if (idx < 0) return;
    var modules = this.data.layoutModules.slice();
    var m = modules[idx];
    if (m.isCorner) return;  // 转角柜不改类型
    m.type = this.data.selectedType;
    if (!m.isCustom) {
      m.width = this.data.selectedWidth;
    }
    m.color = this.data.selectedColor;
    this.setData({ layoutModules: modules });
    this._drawLayout();
  },
```

- [ ] **Step 3: Add `onLayoutCanvasTap` — tap cabinet to select, tap empty to add**

```javascript
  /** Canvas 点击：选中柜子 / 空白处添加 */
  onLayoutCanvasTap: function(e) {
    var modules = this.data.layoutModules;
    var wallWidth = this.data.wallWidthNum;
    if (!wallWidth || modules.length === 0) return;

    var x = e.detail.x;
    var cw = 340;
    var padSide = 10;
    var scale = (cw - padSide * 2) / wallWidth;

    // 点击的墙位置 (cm)
    var tapCm = (x - padSide) / scale;

    // 查找点击了哪个模块
    var accumulatedCm = 0;
    var hitIndex = -1;
    for (var i = 0; i < modules.length; i++) {
      var mEnd = accumulatedCm + modules[i].width;
      if (tapCm >= accumulatedCm && tapCm <= mEnd) {
        hitIndex = i;
        break;
      }
      accumulatedCm = mEnd;
    }

    if (hitIndex >= 0) {
      // 选中该柜子，底部选择器同步
      var m = modules[hitIndex];
      this.setData({
        selectedModuleIndex: hitIndex,
        selectedWidth: m.isCustom ? m.width : m.width,
        selectedType: m.type,
        selectedColor: m.color || 'white',
        isCustomModule: !!m.isCustom
      });
    } else {
      // 点击空白 → 添加新模块
      var newWidth = this.data.selectedWidth;
      if (!newWidth) newWidth = 50;

      // 检查总宽度
      var totalW = 0;
      for (var i = 0; i < modules.length; i++) {
        totalW += modules[i].width;
      }
      if (totalW + newWidth > wallWidth) {
        wx.showToast({ title: '空间不足，请调整模块宽度', icon: 'none' });
        return;
      }

      // 找插入位置
      var insertIdx = modules.length;
      var acc = 0;
      for (var i = 0; i < modules.length; i++) {
        if (tapCm < acc + modules[i].width) {
          insertIdx = i;
          break;
        }
        acc += modules[i].width;
      }

      var newModule = {
        width: newWidth,
        type: this.data.selectedType,
        color: this.data.selectedColor,
        isCustom: this.data.isCustomModule
      };
      modules.splice(insertIdx, 0, newModule);
      this.setData({ layoutModules: modules, selectedModuleIndex: insertIdx });
    }

    this._drawLayout();
  },
```

- [ ] **Step 4: Add `onModuleLongPress` — delete module**

```javascript
  /** 长按柜子删除 */
  onLayoutCanvasLongPress: function(e) {
    var modules = this.data.layoutModules;
    var wallWidth = this.data.wallWidthNum;
    if (modules.length <= 1) {
      wx.showToast({ title: '请至少保留一个模块', icon: 'none' });
      return;
    }

    var x = e.detail.x;
    var cw = 340;
    var padSide = 10;
    var scale = (cw - padSide * 2) / wallWidth;
    var tapCm = (x - padSide) / scale;

    var accumulatedCm = 0;
    var hitIndex = -1;
    for (var i = 0; i < modules.length; i++) {
      var mEnd = accumulatedCm + modules[i].width;
      if (tapCm >= accumulatedCm && tapCm <= mEnd) {
        hitIndex = i;
        break;
      }
      accumulatedCm = mEnd;
    }

    if (hitIndex < 0) return;

    var m = modules[hitIndex];
    if (m.isCorner) {
      wx.showToast({ title: '转角柜不可删除', icon: 'none' });
      return;
    }

    var self = this;
    wx.showModal({
      title: '删除模块',
      content: '确定删除该模块吗？',
      success: function(res) {
        if (res.confirm) {
          modules.splice(hitIndex, 1);
          self.setData({
            layoutModules: modules,
            selectedModuleIndex: -1
          });
          self._drawLayout();
        }
      }
    });
  },
```

- [ ] **Step 5: Add `goCost` — save design and navigate to cost page**

```javascript
  /** 保存设计并跳转到算价页面 */
  goCost: function() {
    var modules = this.data.layoutModules;
    if (modules.length === 0) {
      wx.showToast({ title: '请至少添加一个模块', icon: 'none' });
      return;
    }

    // 确保已登录
    var self = this;
    app.ensureLogin().then(function() {
      var now = new Date();
      var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
      var designId = '' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate())
        + pad(now.getHours()) + pad(now.getMinutes());

      var cornerMap = { none: 'WZJ', left: 'ZZJ', right: 'YZJ', both: 'ZYZJ' };
      var cornerType = cornerMap[self.data.cornerType] || 'WZJ';
      var cornerLabels = { WZJ: '无转角柜', ZZJ: '左转角', YZJ: '右转角', ZYZJ: '双侧转角' };

      var design = {
        id: designId,
        name: '拍照设计_' + pad(now.getMonth() + 1) + pad(now.getDate()),
        cornerType: cornerType,
        cornerLabel: cornerLabels[cornerType],
        wallWidth: self.data.wallWidthNum,
        wallHeight: self.data.wallHeightNum,
        modules: modules,
        source: 'photo'
      };

      wx.showLoading({ title: '保存中...' });
      app.saveDesign(design).then(function(result) {
        wx.hideLoading();
        if (result.success) {
          wx.showToast({ title: '保存成功', icon: 'success' });
          setTimeout(function() {
            wx.navigateTo({ url: '/packageDesign/cost/cost?id=' + result._id });
          }, 800);
        } else {
          wx.showModal({
            title: '保存失败',
            content: result.msg || '请检查网络后重试',
            showCancel: false
          });
        }
      });
    }).catch(function(err) {
      wx.showToast({ title: '请先登录', icon: 'none' });
    });
  },
```

- [ ] **Step 6: Commit**

```bash
git add pages/knowledge/glbviewer/glbviewer.js
git commit -m "feat: add module interaction handlers and goCost to glbviewer"
```

---

### Task 5: glbviewer.wxml — layout stage UI

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.wxml`

- [ ] **Step 1: Replace "开始设计" button with "确认空间" + "算价" split**

In the marking-stage size-input area (inside the `.space-mode` block), replace the `goDesign` button binding. The space-actions section should change from `goDesign` to `confirmSpace`:

Find the line with `bindtap="goDesign"` inside the `.space-mode` block and change it to `bindtap="confirmSpace"`. The button text stays "确认空间 →".

- [ ] **Step 2: Add layout stage block**

After the marking-stage closing `</view>` of `.space-mode`, add a new layout-mode block:

```xml
  <!-- 布局阶段 -->
  <view class="layout-mode" wx:if="{{mode === 'space' && spaceStage === 'layout'}}" style="top: {{statusBarHeight + navBarHeight}}px;">
    <!-- 照片缩略图 -->
    <view class="photo-thumb" bindtap="goBackToMarking">
      <image class="photo-thumb-img" src="{{photoPath}}" mode="aspectFill" />
      <text class="photo-thumb-label">‹ 返回标记</text>
    </view>

    <!-- Canvas 操作区 -->
    <view class="layout-canvas-wrap">
      <canvas class="layout-canvas"
              canvas-id="layoutCanvas"
              bindtap="onLayoutCanvasTap"
              bindlongpress="onLayoutCanvasLongPress"
              style="width: 680rpx; height: 280rpx;">
      </canvas>
    </view>

    <!-- 宽度选择 -->
    <view class="selector-row">
      <text class="selector-label">宽度</text>
      <view class="selector-tag {{selectedWidth === 50 && !isCustomModule ? 'selector-tag-active' : ''}}"
            bindtap="onSelectWidth" data-width="50">50cm</view>
      <view class="selector-tag {{selectedWidth === 100 && !isCustomModule ? 'selector-tag-active' : ''}}"
            bindtap="onSelectWidth" data-width="100">100cm</view>
      <view class="selector-tag {{isCustomModule ? 'selector-tag-active' : ''}}"
            bindtap="onSelectWidth" data-width="custom">非标</view>
    </view>

    <!-- 类型选择 -->
    <view class="selector-row">
      <text class="selector-label">类型</text>
      <view class="selector-tag {{selectedType === 'a' ? 'selector-tag-active' : ''}}"
            bindtap="onSelectType" data-type="a">A型</view>
      <view class="selector-tag {{selectedType === 'b' ? 'selector-tag-active' : ''}}"
            bindtap="onSelectType" data-type="b">B型</view>
      <view class="selector-tag {{selectedType === 'c' ? 'selector-tag-active' : ''}}"
            bindtap="onSelectType" data-type="c">C型</view>
      <view class="selector-tag {{selectedType === 'd' ? 'selector-tag-active' : ''}}"
            bindtap="onSelectType" data-type="d">D型</view>
    </view>

    <!-- 颜色选择 -->
    <view class="selector-row">
      <text class="selector-label">颜色</text>
      <view class="selector-tag {{selectedColor === 'white' ? 'selector-tag-active' : ''}}"
            bindtap="onSelectColor" data-color="white">白色</view>
      <view class="selector-tag {{selectedColor === 'cream' ? 'selector-tag-active' : ''}}"
            bindtap="onSelectColor" data-color="cream">奶油</view>
      <view class="selector-tag {{selectedColor === 'other' ? 'selector-tag-active' : ''}}"
            bindtap="onSelectColor" data-color="other">其他</view>
    </view>

    <!-- 操作按钮 -->
    <view class="layout-actions">
      <view class="space-btn space-btn-reset" bindtap="goBackToMarking">
        <text>返回修改</text>
      </view>
      <view class="space-btn space-btn-design" bindtap="goCost">
        <text>算价 →</text>
      </view>
    </view>
  </view>
```

- [ ] **Step 3: Add `goBackToMarking` and update marking-stage bindings**

The marking stage `confirmSpace` replaces `goDesign`. Add `goBackToMarking` to switch from layout back to marking:

In the JS, add this method (included here for clarity — the implementer will add it):

```javascript
  /** 从布局返回标记阶段 */
  goBackToMarking: function() {
    this.setData({
      spaceStage: 'marking',
      layoutModules: [],
      selectedModuleIndex: -1
    });
  },
```

- [ ] **Step 4: Commit**

```bash
git add pages/knowledge/glbviewer/glbviewer.wxml pages/knowledge/glbviewer/glbviewer.js
git commit -m "feat: add layout stage UI template with module selectors"
```

---

### Task 6: glbviewer.wxss — layout stage styles

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.wxss`

- [ ] **Step 1: Append layout stage styles**

Append to the end of the file:

```css
/* ===== 布局阶段 ===== */

.layout-mode {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #1a1a1a;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* 照片缩略图 */
.photo-thumb {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 32rpx;
  background: rgba(255,255,255,0.03);
  border-bottom: 1rpx solid rgba(255,255,255,0.05);
}

.photo-thumb-img {
  width: 80rpx;
  height: 60rpx;
  border-radius: 8rpx;
  opacity: 0.6;
}

.photo-thumb-label {
  font-size: 24rpx;
  color: rgba(255,255,255,0.4);
}

/* Canvas 操作区 */
.layout-canvas-wrap {
  display: flex;
  justify-content: center;
  padding: 24rpx 16rpx;
}

.layout-canvas {
  border: 1rpx solid rgba(255,255,255,0.08);
  border-radius: 12rpx;
  background: rgba(255,255,255,0.02);
}

/* 选择器行 */
.selector-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 32rpx;
}

.selector-label {
  font-size: 24rpx;
  color: rgba(255,255,255,0.35);
  width: 72rpx;
  flex-shrink: 0;
}

.selector-tag {
  padding: 10rpx 24rpx;
  border-radius: 14rpx;
  font-size: 24rpx;
  color: rgba(255,255,255,0.45);
  background: rgba(255,255,255,0.06);
  border: 1rpx solid rgba(255,255,255,0.08);
  transition: all 0.15s;
}

.selector-tag-active {
  color: #FC9700;
  background: rgba(252,151,0,0.12);
  border-color: rgba(252,151,0,0.3);
}

.selector-tag:active {
  opacity: 0.7;
}

/* 布局操作按钮 */
.layout-actions {
  display: flex;
  gap: 20rpx;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/knowledge/glbviewer/glbviewer.wxss
git commit -m "feat: add layout stage styles to glbviewer"
```

---

### Task 7: Integration verification

- [ ] **Step 1: Verify layout.js still works**

Open preset → set wall params → confirm → layout page loads with correct module selection. Expected: no behavior change from before refactoring.

- [ ] **Step 2: Verify full space → layout flow**

1. Open glbviewer → click "拍照解析空间" → take/select photo
2. Mark 3 corner points → enter width=300, height=260
3. Click "确认空间" → verify auto-fill generated modules appear on Canvas
4. Verify color blocks are rendered with labels
5. Click a cabinet → verify it gets orange highlight border
6. Switch type to "B型" → verify Canvas redraws with B type
7. Switch color to "奶油" → verify color changes
8. Click empty space on wall → verify new module added
9. Long press a non-corner module → verify delete modal appears
10. Verify corner cabinet cannot be deleted
11. Click "算价" → verify design saves → verify navigation to cost page

- [ ] **Step 3: Verify edge cases**

1. Only 1 module → try delete → "请至少保留一个模块"
2. Try add module when total width = wallWidth → "空间不足"
3. Click "返回标记" from layout → verify returns to photo marking
4. Update mark points → "确认空间" → verify auto-fill regenerates
5. GLB mode still works: load a .glb file → verify unaffected
