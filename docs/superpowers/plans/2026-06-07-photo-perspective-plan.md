# Photo Perspective Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add photo upload + 2D perspective projection to the layout page, allowing users to place cabinet modules on real room photos.

**Architecture:** New `utils/perspective.js` module provides homography math and strip-based perspective rendering. `layout.js` gains a photo mode (activated by `choosePhoto`) that replaces the abstract 3D background with a user photo, renders cabinets with perspective via `drawPerspectiveImage`, and supports touch-drag corner adjustment.

**Tech Stack:** WeChat Mini Program Canvas 2D, Jest for unit tests

---

### Task 1: Create `utils/perspective.js` — Homography math + strip rendering

**Files:**
- Create: `utils/perspective.js`

- [ ] **Step 1: Write the module**

```javascript
/**
 * 透视投影工具模块
 * 提供单应性矩阵计算、点映射、四边形验证、分条透视渲染
 */

/**
 * DLT 算法：从 4 对对应点计算 3x3 单应性矩阵
 * @param {Array<{x:number,y:number}>} srcPoints - 源平面 4 点（墙面坐标）
 * @param {Array<{x:number,y:number}>} dstPoints - 目标平面 4 点（照片坐标）
 * @returns {Array<Array<number>>} 3x3 矩阵 [[a,b,c],[d,e,f],[g,h,1]]
 */
function computeHomography(srcPoints, dstPoints) {
  // 构建线性方程组 Ah = 0
  // 每对点提供 2 个方程，4 对点 = 8 个方程，求解 8 个未知数 (h00..h21, h22=1)
  var A = [];
  for (var i = 0; i < 4; i++) {
    var sx = srcPoints[i].x;
    var sy = srcPoints[i].y;
    var dx = dstPoints[i].x;
    var dy = dstPoints[i].y;
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
  }

  // 构建右侧向量 b（8 个方程，对应 dx, dy）
  var b = [];
  for (var j = 0; j < 4; j++) {
    b.push(dstPoints[j].x);
    b.push(dstPoints[j].y);
  }

  // 高斯消元求解 8x8 线性系统
  var n = 8;
  var augmented = [];
  for (var r = 0; r < n; r++) {
    augmented[r] = [];
    for (var c = 0; c < n; c++) {
      augmented[r][c] = A[r][c];
    }
    augmented[r][n] = b[r];
  }

  for (var col = 0; col < n; col++) {
    // 选主元
    var maxRow = col;
    var maxVal = Math.abs(augmented[col][col]);
    for (var row = col + 1; row < n; row++) {
      var absVal = Math.abs(augmented[row][col]);
      if (absVal > maxVal) {
        maxVal = absVal;
        maxRow = row;
      }
    }
    // 交换行
    if (maxRow !== col) {
      var tmp = augmented[col];
      augmented[col] = augmented[maxRow];
      augmented[maxRow] = tmp;
    }
    // 消元
    var pivot = augmented[col][col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (var row2 = 0; row2 < n; row2++) {
      if (row2 === col) continue;
      var factor = augmented[row2][col] / pivot;
      for (var c2 = col; c2 <= n; c2++) {
        augmented[row2][c2] -= factor * augmented[col][c2];
      }
    }
  }

  // 提取解
  var h = [];
  for (var k = 0; k < n; k++) {
    var piv = augmented[k][k];
    h[k] = Math.abs(piv) < 1e-12 ? 0 : augmented[k][n] / piv;
  }

  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1]
  ];
}

/**
 * 用单应性矩阵映射一个点
 * @param {Array<Array<number>>} H - 3x3 矩阵
 * @param {{x:number,y:number}} p - 输入点
 * @returns {{x:number,y:number}} 映射后的点
 */
function transformPoint(H, p) {
  var x = H[0][0] * p.x + H[0][1] * p.y + H[0][2];
  var y = H[1][0] * p.x + H[1][1] * p.y + H[1][2];
  var w = H[2][0] * p.x + H[2][1] * p.y + H[2][2];
  if (Math.abs(w) < 1e-10) w = 1e-10;
  return { x: x / w, y: y / w };
}

/**
 * 判断四边形是否为凸
 * @param {Array<{x:number,y:number}>} corners - 4 个角点（顺时针或逆时针）
 * @returns {boolean}
 */
function isConvexQuad(corners) {
  var signs = [];
  for (var i = 0; i < 4; i++) {
    var p0 = corners[i];
    var p1 = corners[(i + 1) % 4];
    var p2 = corners[(i + 2) % 4];
    var cross = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
    if (Math.abs(cross) > 1e-10) {
      signs.push(cross > 0);
    }
  }
  // 所有非零叉积符号应一致
  if (signs.length < 2) return true;
  var first = signs[0];
  for (var j = 1; j < signs.length; j++) {
    if (signs[j] !== first) return false;
  }
  return true;
}

/**
 * 在 Canvas 2D 上用分条法绘制透视图片
 * 将 img 的完整内容映射到目标四边形 quad 中
 * @param {CanvasRenderingContext2D} ctx
 * @param {Image} img - Canvas Image 对象
 * @param {Array<{x:number,y:number}>} quad - 目标四边形 4 角点 [TL, TR, BR, BL]
 * @param {number} numStrips - 分条数量（默认 150）
 */
function drawPerspectiveImage(ctx, img, quad, numStrips) {
  if (!img || !img.width || !img.height) return;
  var strips = numStrips || 150;
  var imgW = img.width;
  var imgH = img.height;

  var tl = quad[0], tr = quad[1], br = quad[2], bl = quad[3];

  for (var i = 0; i < strips; i++) {
    var tTop = i / strips;
    var tBot = (i + 1) / strips;

    // 源图纵坐标
    var srcY = tTop * imgH;
    var srcH = (tBot - tTop) * imgH;

    // 左侧边插值
    var leftTopX = bl.x + (tl.x - bl.x) * tTop;
    var leftTopY = bl.y + (tl.y - bl.y) * tTop;
    var leftBotX = bl.x + (tl.x - bl.x) * tBot;
    var leftBotY = bl.y + (tl.y - bl.y) * tBot;

    // 右侧边插值
    var rightTopX = br.x + (tr.x - br.x) * tTop;
    var rightTopY = br.y + (tr.y - br.y) * tTop;
    var rightBotX = br.x + (tr.x - br.x) * tBot;
    var rightBotY = br.y + (tr.y - br.y) * tBot;

    // 目标矩形近似：取平均 x 和平均宽度
    var dstX = (leftTopX + leftBotX) / 2;
    var dstW = ((rightTopX + rightBotX) - (leftTopX + leftBotX)) / 2;
    var dstY = (leftTopY + rightTopY) / 2;
    var dstH = ((leftBotY + rightBotY) - (leftTopY + rightTopY)) / 2;

    if (dstW < 0.5 || dstH < 0.5) continue;

    try {
      ctx.drawImage(img, 0, srcY, imgW, srcH, dstX, dstY, dstW, dstH);
    } catch (e) {
      // 跳过绘制失败的条
    }
  }
}

module.exports = {
  computeHomography: computeHomography,
  transformPoint: transformPoint,
  isConvexQuad: isConvexQuad,
  drawPerspectiveImage: drawPerspectiveImage
};
```

- [ ] **Step 2: Commit**

```bash
git add utils/perspective.js
git commit -m "feat: add perspective.js — homography math and strip-based rendering"
```

---

### Task 2: Unit tests for `utils/perspective.js`

**Files:**
- Create: `__tests__/perspective.test.js`

- [ ] **Step 1: Write the tests**

```javascript
var perspective = require('../utils/perspective.js');

describe('computeHomography', function() {
  it('identity: 4 corners of a unit square mapped to themselves', function() {
    var src = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
    var dst = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
    var H = perspective.computeHomography(src, dst);

    // 映射 (0.5, 0.5) 应该接近 (0.5, 0.5)
    var result = perspective.transformPoint(H, {x: 0.5, y: 0.5});
    expect(result.x).toBeCloseTo(0.5, 5);
    expect(result.y).toBeCloseTo(0.5, 5);
  });

  it('uniform scale: map unit square to 2x square', function() {
    var src = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
    var dst = [{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2}];
    var H = perspective.computeHomography(src, dst);

    var result = perspective.transformPoint(H, {x: 1, y: 1});
    expect(result.x).toBeCloseTo(2, 5);
    expect(result.y).toBeCloseTo(2, 5);
  });

  it('translation: map unit square to offset position', function() {
    var src = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
    var dst = [{x:10,y:20},{x:11,y:20},{x:11,y:21},{x:10,y:21}];
    var H = perspective.computeHomography(src, dst);

    var result = perspective.transformPoint(H, {x: 0.5, y: 0.5});
    expect(result.x).toBeCloseTo(10.5, 5);
    expect(result.y).toBeCloseTo(20.5, 5);
  });

  it('perspective: trapezoid transform', function() {
    // 将正方形映射为梯形（模拟透视效果）
    var src = [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
    var dst = [{x:30,y:0},{x:70,y:0},{x:80,y:100},{x:20,y:100}];
    var H = perspective.computeHomography(src, dst);

    // 顶边中点 (50, 0) → 应该在 (50, 0) 附近
    var topMid = perspective.transformPoint(H, {x: 50, y: 0});
    expect(topMid.x).toBeCloseTo(50, 5);
    expect(topMid.y).toBeCloseTo(0, 5);

    // 底边中点 (50, 100) → 应该在 (50, 100) 附近
    var botMid = perspective.transformPoint(H, {x: 50, y: 100});
    expect(botMid.x).toBeCloseTo(50, 5);
    expect(botMid.y).toBeCloseTo(100, 5);
  });
});

describe('transformPoint', function() {
  it('maps origin through identity-ish matrix', function() {
    var H = [[1, 0, 10], [0, 1, 20], [0, 0, 1]];
    var result = perspective.transformPoint(H, {x: 5, y: 3});
    expect(result.x).toBeCloseTo(15, 5);
    expect(result.y).toBeCloseTo(23, 5);
  });
});

describe('isConvexQuad', function() {
  it('returns true for a rectangle', function() {
    var rect = [{x:0,y:0},{x:100,y:0},{x:100,y:80},{x:0,y:80}];
    expect(perspective.isConvexQuad(rect)).toBe(true);
  });

  it('returns true for a trapezoid', function() {
    var trap = [{x:20,y:0},{x:80,y:0},{x:90,y:100},{x:10,y:100}];
    expect(perspective.isConvexQuad(trap)).toBe(true);
  });

  it('returns false for a crossed/bowtie quad', function() {
    var crossed = [{x:0,y:0},{x:100,y:0},{x:0,y:80},{x:100,y:80}];
    expect(perspective.isConvexQuad(crossed)).toBe(false);
  });

  it('returns true for collinear points (degenerate but not crossing)', function() {
    var line = [{x:0,y:0},{x:50,y:0},{x:100,y:0},{x:50,y:100}];
    // 3 点共线，其中一个叉积接近 0，跳过
    expect(perspective.isConvexQuad(line)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (perspective.js not loaded yet — skip if already committed)**

Run: `npx jest __tests__/perspective.test.js --no-coverage`
Expected: 8 tests pass (module already exists from Task 1)

- [ ] **Step 3: Commit**

```bash
git add __tests__/perspective.test.js
git commit -m "test: add unit tests for perspective.js"
```

---

### Task 3: Add photo mode UI to `layout.wxml`

**Files:**
- Modify: `packageDesign/layout/layout.wxml`

- [ ] **Step 1: Add photo action buttons and corner markers**

Add the following after the existing `action-row` (after line 36, before `<!-- 框架编辑器卡片 -->`):

```xml
    <!-- 照片模式按钮行 -->
    <view class="photo-actions" wx:if="{{!photoMode}}">
      <view class="photo-btn" bindtap="choosePhoto">📷 上传实拍照片</view>
    </view>
    <view class="photo-actions" wx:if="{{photoMode}}">
      <view class="photo-btn remove" bindtap="removePhoto">✕ 移除照片</view>
      <text class="photo-hint">拖拽橙色角标对准墙面四角</text>
    </view>
```

- [ ] **Step 2: Commit**

```bash
git add packageDesign/layout/layout.wxml
git commit -m "feat: add photo mode upload/remove buttons to layout page"
```

---

### Task 4: Add photo mode styles to `layout.wxss`

**Files:**
- Modify: `packageDesign/layout/layout.wxss`

- [ ] **Step 1: Add photo mode styles**

Append to the end of the file:

```css
/* 照片模式操作按钮 */
.photo-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.photo-btn {
  padding: 16rpx 40rpx;
  border: 2rpx dashed #FC9700;
  border-radius: 40rpx;
  font-size: 26rpx;
  color: #FC9700;
  background: #FFF8F0;
  transition: all 0.2s;
}

.photo-btn:active {
  background: #FFF0E0;
}

.photo-btn.remove {
  border-color: #ccc;
  color: #999;
  background: #f5f5f5;
}

.photo-btn.remove:active {
  background: #eee;
}

.photo-hint {
  font-size: 22rpx;
  color: #FC9700;
}
```

- [ ] **Step 2: Commit**

```bash
git add packageDesign/layout/layout.wxss
git commit -m "feat: add photo mode styles to layout page"
```

---

### Task 5: Add photo mode state and upload logic to `layout.js`

**Files:**
- Modify: `packageDesign/layout/layout.js`

- [ ] **Step 1: Add new data fields**

In the `data` object (after line 57, before `// Canvas`), add:

```javascript
    // 照片透视模式
    photoMode: false,
    photoPath: '',
    photoCorners: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 }
    ],
    draggingCorner: -1,
```

- [ ] **Step 2: Add photo image cache field**

After the existing `_imageCache: {}` (line 64), add:

```javascript
  _photoImg: null,
```

- [ ] **Step 3: Add require for perspective module**

After `var layoutCompute = require('../../utils/layoutCompute.js');` (line 3), add:

```javascript
var perspective = require('../../utils/perspective.js');
```

- [ ] **Step 4: Add photo upload and remove methods**

Add after the `onShow` method (after line 140):

```javascript
  /**
   * 选择照片（拍照或相册）
   */
  choosePhoto() {
    var self = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        var tempPath = res.tempFilePaths[0];
        if (!tempPath) return;
        self._loadPhotoToCanvas(tempPath);
      },
      fail: function(err) {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '选择照片失败', icon: 'none' });
        }
      }
    });
  },

  /**
   * 将照片加载到 Canvas Image 对象中
   */
  _loadPhotoToCanvas(tempPath) {
    var self = this;
    if (!self._canvas) {
      wx.showToast({ title: 'Canvas 未就绪，请稍后重试', icon: 'none' });
      return;
    }
    var img = self._canvas.createImage();
    img.onload = function() {
      self._photoImg = img;
      self._initDefaultCorners();
      self.setData({
        photoMode: true,
        photoPath: tempPath
      });
      self._scheduleDraw();
    };
    img.onerror = function() {
      wx.showToast({ title: '照片加载失败', icon: 'none' });
    };
    img.src = tempPath;
  },

  /**
   * 初始化默认角点：Canvas 区域向内缩进 20%
   */
  _initDefaultCorners() {
    var cw = this.data.canvasWidth;
    var ch = this.data.canvasHeight;
    this.setData({
      photoCorners: [
        { x: cw * 0.2, y: ch * 0.2 },
        { x: cw * 0.8, y: ch * 0.2 },
        { x: cw * 0.8, y: ch * 0.8 },
        { x: cw * 0.2, y: ch * 0.8 }
      ]
    });
  },

  /**
   * 移除照片，回到抽象 3D 视图
   */
  removePhoto() {
    this._photoImg = null;
    this.setData({
      photoMode: false,
      photoPath: '',
      draggingCorner: -1
    });
    this._scheduleDraw();
  },
```

- [ ] **Step 5: Commit**

```bash
git add packageDesign/layout/layout.js
git commit -m "feat: add photo mode state, upload, and remove logic to layout page"
```

---

### Task 6: Add corner dragging touch handlers to `layout.js`

**Files:**
- Modify: `packageDesign/layout/layout.js`

- [ ] **Step 1: Add touch event handlers**

Add after the `removePhoto` method:

```javascript
  /**
   * Canvas touchstart — 检测是否命中角标
   */
  onCanvasTouchStart(e) {
    if (!this.data.photoMode) return;
    var touches = e.touches;
    if (!touches || touches.length === 0) return;

    var touch = touches[0];
    var corners = this.data.photoCorners;
    var hitRadius = 20;
    var hitIndex = -1;
    var minDist = Infinity;

    for (var i = 0; i < 4; i++) {
      var dx = touch.x - corners[i].x;
      var dy = touch.y - corners[i].y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < hitRadius && dist < minDist) {
        hitIndex = i;
        minDist = dist;
      }
    }

    if (hitIndex >= 0) {
      this.setData({ draggingCorner: hitIndex });
    }
  },

  /**
   * Canvas touchmove — 拖拽角标
   */
  onCanvasTouchMove(e) {
    if (!this.data.photoMode || this.data.draggingCorner < 0) return;
    var touches = e.touches;
    if (!touches || touches.length === 0) return;

    var touch = touches[0];
    var idx = this.data.draggingCorner;
    var corners = this.data.photoCorners.slice();

    // 限制在 Canvas 范围内
    corners[idx] = {
      x: Math.max(5, Math.min(this.data.canvasWidth - 5, touch.x)),
      y: Math.max(5, Math.min(this.data.canvasHeight - 5, touch.y))
    };

    this.setData({ photoCorners: corners });
    this._scheduleDraw();
  },

  /**
   * Canvas touchend — 结束拖拽
   */
  onCanvasTouchEnd() {
    if (this.data.draggingCorner >= 0) {
      this.setData({ draggingCorner: -1 });
    }
  },
```

- [ ] **Step 2: Commit**

```bash
git add packageDesign/layout/layout.js
git commit -m "feat: add corner dragging touch handlers for photo mode"
```

---

### Task 7: Add touch event bindings to `layout.wxml`

**Files:**
- Modify: `packageDesign/layout/layout.wxml`

- [ ] **Step 1: Bind touch events on Canvas**

Replace the Canvas element (line 21-23):

Old:
```xml
      <canvas type="2d" 
              id="previewCanvas"
              class="preview-canvas"></canvas>
```

New:
```xml
      <canvas type="2d" 
              id="previewCanvas"
              class="preview-canvas"
              bindtouchstart="onCanvasTouchStart"
              bindtouchmove="onCanvasTouchMove"
              bindtouchend="onCanvasTouchEnd"></canvas>
```

- [ ] **Step 2: Commit**

```bash
git add packageDesign/layout/layout.wxml
git commit -m "feat: bind canvas touch events for corner dragging"
```

---

### Task 8: Integrate perspective rendering into `layout.js` `_doDrawPreview`

**Files:**
- Modify: `packageDesign/layout/layout.js`

- [ ] **Step 1: Add photo mode rendering branch to `_doDrawPreview`**

After the `// 数据校验` block and canvas setup (after line 1077, before `// === 绘制白色背景 ===` on line 1080), add the photo mode branch:

```javascript
    // 照片模式：走透视渲染路径
    if (data.photoMode && self._photoImg) {
      self._drawPhotoMode(ctx, data, canvasW, canvasH, wallWidth, wallHeight,
        cornerType, modules, showDoor, customWidth, selectedModule,
        selectedWidth, isCustomModule, isLastModule, remainingStdWidth, gapH);
      return;
    }
```

- [ ] **Step 2: Add `_drawPhotoMode` method**

Add before the `_drawModule` method (before line 1321):

```javascript
  /**
   * 照片模式绘制：照片背景 + 透视柜体 + 角标
   */
  _drawPhotoMode(ctx, data, canvasW, canvasH, wallWidth, wallHeight,
                 cornerType, modules, showDoor, customWidth, selectedModule,
                 selectedWidth, isCustomModule, isLastModule, remainingStdWidth, gapH) {
    // 1. 绘制照片背景
    if (this._photoImg) {
      ctx.drawImage(this._photoImg, 0, 0, canvasW, canvasH);
    }

    // 2. 计算单应性矩阵（墙面坐标 → 照片Canvas坐标）
    var corners = data.photoCorners;
    var srcPoints = [
      { x: 0, y: 0 },
      { x: wallWidth, y: 0 },
      { x: wallWidth, y: wallHeight },
      { x: 0, y: wallHeight }
    ];

    if (!perspective.isConvexQuad(corners)) {
      // 非凸四边形：只绘制角标，提示用户调整
      this._drawCornerMarkers(ctx, corners, data.draggingCorner);
      ctx.fillStyle = '#FF6B6B';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('角点位置不合理，请调整', canvasW / 2, canvasH - 16);
      ctx.textAlign = 'start';
      return;
    }

    var H = perspective.computeHomography(srcPoints, corners);

    // 3. 构建待渲染的柜体列表（含收口条、转角柜）
    var cabinetList = this._buildPhotoCabinetList(data, wallWidth, wallHeight, gapH);

    // 4. 按墙面 x 坐标排序（远处先画，近处后画）
    cabinetList.sort(function(a, b) { return a.wallX - b.wallX; });

    // 5. 逐柜体透视渲染
    for (var i = 0; i < cabinetList.length; i++) {
      var cab = cabinetList[i];
      this._drawCabinetPerspective(ctx, cab, H, showDoor, data.selectedColor);
    }

    // 6. 绘制角标和连线
    this._drawCornerMarkers(ctx, corners, data.draggingCorner);
  },

  /**
   * 构建照片模式下需要渲染的柜体列表（墙面坐标）
   */
  _buildPhotoCabinetList(data, wallWidth, wallHeight, gapH) {
    var list = [];
    var cornerType = data.cornerType;
    var modules = data.modules;
    var skW = 2; // 收口条宽 2cm
    var zW = 110; // 转角柜宽 110cm
    var moduleH = 230; // 主柜高 230cm

    var hasLeftCorner = (cornerType === 'ZZJ' || cornerType === 'ZYZJ');
    var hasRightCorner = (cornerType === 'YZJ' || cornerType === 'ZYZJ');

    var curX = 0;

    // 左侧收口条
    list.push({
      wallX: curX, wallY: gapH, wallW: skW, wallH: moduleH,
      imgKey: 'SK/SK-2-230', isModule: false
    });
    if (gapH > 0) {
      list.push({
        wallX: curX, wallY: 0, wallW: skW, wallH: gapH,
        imgKey: 'SK/SK-2-230', isModule: false
      });
    }
    list.push({
      wallX: curX, wallY: 0, wallW: skW, wallH: 2,
      imgKey: 'SK/SK-300-2', isModule: false
    });
    curX += skW;

    // 左转角柜
    if (hasLeftCorner) {
      var zKey = data.showDoor ? 'z/z-110-230G' : 'z/z-110-230';
      list.push({
        wallX: curX, wallY: gapH, wallW: zW, wallH: moduleH,
        imgKey: zKey, isModule: false
      });
      if (gapH > 0) {
        var nearGH = this.getNearestGapHeight(gapH, true);
        var zgKey = data.showDoor ? 'z/zg-110-' + nearGH + 'G' : 'z/zg-110-' + nearGH;
        list.push({
          wallX: curX, wallY: 0, wallW: zW, wallH: gapH,
          imgKey: zgKey, isModule: false
        });
      }
      list.push({
        wallX: curX, wallY: 0, wallW: zW, wallH: 2,
        imgKey: 'SK/SK-300-2', isModule: false
      });
      curX += zW;
    }

    // 已放置的模块
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      this._addModuleToPhotoList(list, m, curX, gapH, data.showDoor);
      curX += m.width;
    }

    // 中间顶部收口条
    var topSkStartX = skW + (hasLeftCorner ? zW : 0);
    var topSkEndX = wallWidth - skW - (hasRightCorner ? zW : 0);
    if (topSkEndX > topSkStartX) {
      list.push({
        wallX: topSkStartX, wallY: 0, wallW: topSkEndX - topSkStartX, wallH: 2,
        imgKey: 'SK/SK-300-2', isModule: false
      });
    }

    // 右转角柜
    if (hasRightCorner) {
      var yX = wallWidth - skW - zW;
      var yKey = data.showDoor ? 'y/y-110-230G' : 'y/y-110-230';
      list.push({
        wallX: yX, wallY: gapH, wallW: zW, wallH: moduleH,
        imgKey: yKey, isModule: false
      });
      if (gapH > 0) {
        var nearGHy = this.getNearestGapHeight(gapH, true);
        var ygKey = data.showDoor ? 'y/yg-110-' + nearGHy + 'G' : 'y/yg-110-' + nearGHy;
        list.push({
          wallX: yX, wallY: 0, wallW: zW, wallH: gapH,
          imgKey: ygKey, isModule: false
        });
      }
      list.push({
        wallX: yX, wallY: 0, wallW: zW, wallH: 2,
        imgKey: 'SK/SK-300-2', isModule: false
      });
    }

    // 右侧收口条
    var rightSkX = wallWidth - skW;
    list.push({
      wallX: rightSkX, wallY: gapH, wallW: skW, wallH: moduleH,
      imgKey: 'SK/SK-2-230', isModule: false
    });
    if (gapH > 0) {
      list.push({
        wallX: rightSkX, wallY: 0, wallW: skW, wallH: gapH,
        imgKey: 'SK/SK-2-230', isModule: false
      });
    }
    list.push({
      wallX: rightSkX, wallY: 0, wallW: skW, wallH: 2,
      imgKey: 'SK/SK-300-2', isModule: false
    });

    return list;
  },

  /**
   * 将单个模块添加到照片柜体列表
   */
  _addModuleToPhotoList(list, m, startX, gapH, showDoor) {
    var assets = require('../../utils/assets.js');
    var w = m.width;
    var moduleH = 230;

    if (m.isStandard) {
      var mainKey = w + '/' + m.type + '-' + w + '-230';
      list.push({ wallX: startX, wallY: gapH, wallW: w, wallH: moduleH, imgKey: mainKey, isModule: true });
      if (showDoor) {
        list.push({ wallX: startX, wallY: gapH, wallW: w, wallH: moduleH, imgKey: w + '/m-' + w + '-230G', isModule: true });
      }
      if (gapH > 0) {
        var nearGH = this.getNearestGapHeight(gapH, false);
        list.push({ wallX: startX, wallY: 0, wallW: w, wallH: gapH, imgKey: w + '/g-' + w + '-' + nearGH, isModule: true });
        if (showDoor) {
          list.push({ wallX: startX, wallY: 0, wallW: w, wallH: gapH, imgKey: w + '/gm-' + w + '-30', isModule: true });
        }
      }
    } else {
      var ew = this.getNearestEWidth(w);
      var eMainKey = 'e/' + m.type + '-' + ew + '-230';
      list.push({ wallX: startX, wallY: gapH, wallW: w, wallH: moduleH, imgKey: eMainKey, isModule: true });
      if (showDoor) {
        var doorW = w > 75 ? 100 : 50;
        list.push({ wallX: startX, wallY: gapH, wallW: w, wallH: moduleH, imgKey: 'e/m-' + doorW + '-230G', isModule: true });
      }
      if (gapH > 0) {
        var eNearGH = this.getNearestGapHeight(gapH, false);
        list.push({ wallX: startX, wallY: 0, wallW: w, wallH: gapH, imgKey: 'e/g/g-' + ew + '-' + eNearGH, isModule: true });
        if (showDoor) {
          var gmW = w > 75 ? 100 : 50;
          var gmFile = gmW === 100 ? 'gm-100-60' : 'gm-50-30';
          list.push({ wallX: startX, wallY: 0, wallW: w, wallH: gapH, imgKey: 'e/g/' + gmFile, isModule: true });
        }
      }
    }
    // 顶部收口条
    list.push({ wallX: startX, wallY: 0, wallW: w, wallH: 2, imgKey: 'SK/SK-300-2', isModule: false });
  },

  /**
   * 以透视方式绘制单个柜体
   */
  _drawCabinetPerspective(ctx, cab, H, showDoor, selectedColor) {
    var assets = require('../../utils/assets.js');
    var imgKey = cab.imgKey;
    var img = this._imageCache[assets.picture(imgKey)];
    if (!img) {
      // 图片未加载，使用回退色块
      var quad = this._computeQuad(H, cab.wallX, cab.wallY, cab.wallW, cab.wallH);
      ctx.fillStyle = cab.isModule ? '#f0ece2' : '#ddd9cf';
      ctx.fillRect(
        Math.min(quad[0].x, quad[3].x),
        Math.min(quad[0].y, quad[1].y),
        Math.abs(quad[1].x - quad[0].x),
        Math.abs(quad[3].y - quad[0].y)
      );
      return;
    }
    var quad = this._computeQuad(H, cab.wallX, cab.wallY, cab.wallW, cab.wallH);
    perspective.drawPerspectiveImage(ctx, img, quad, 150);

    // 米色叠底
    if (selectedColor === 'cream') {
      var colorImg = this._imageCache[assets.color('MI')];
      if (colorImg) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        perspective.drawPerspectiveImage(ctx, colorImg, quad, 150);
        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  },

  /**
   * 计算墙面矩形在照片 Canvas 中的四边形
   */
  _computeQuad(H, wallX, wallY, wallW, wallH) {
    var tl = perspective.transformPoint(H, { x: wallX, y: wallY });
    var tr = perspective.transformPoint(H, { x: wallX + wallW, y: wallY });
    var br = perspective.transformPoint(H, { x: wallX + wallW, y: wallY + wallH });
    var bl = perspective.transformPoint(H, { x: wallX, y: wallY + wallH });
    return [tl, tr, br, bl];
  },

  /**
   * 绘制四个角标和四边形连线
   */
  _drawCornerMarkers(ctx, corners, draggingCorner) {
    // 四边形连线
    ctx.strokeStyle = 'rgba(252, 151, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (var i = 1; i < 4; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // 四个角标圆点
    for (var j = 0; j < 4; j++) {
      var isDragging = (j === draggingCorner);
      var r = isDragging ? 10 : 7;
      ctx.fillStyle = isDragging ? '#E08000' : '#FC9700';
      ctx.beginPath();
      ctx.arc(corners[j].x, corners[j].y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },
```

- [ ] **Step 3: Commit**

```bash
git add packageDesign/layout/layout.js
git commit -m "feat: integrate perspective rendering into layout _doDrawPreview"
```

---

### Task 9: Run all tests and verify

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
npx jest --no-coverage
```
Expected: All existing tests + 8 new perspective tests pass.

- [ ] **Step 2: Verify the plan covers all spec requirements**

- [x] 四点透视映射 → `computeHomography` + `drawPerspectiveImage`
- [x] 增强现有 layout 页 → photo mode in `layout.js`
- [x] 保留墙面参数输入 → `srcPoints` from wall dimensions
- [x] 先框矩形再微调 → `_initDefaultCorners` + touch drag
- [x] 拍照+相册 → `wx.chooseImage` with both source types
- [x] 仅本地预览 → `photoPath` as temp path, no cloud upload
- [x] 角点非凸检查 → `isConvexQuad` guard in `_drawPhotoMode`
- [x] 照片加载失败 → toast + fallback
- [x] Canvas 未就绪 → `_photoImg` null check
