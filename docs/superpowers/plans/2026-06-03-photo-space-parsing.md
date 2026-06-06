# Photo Space Parsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "photo space parsing" mode to the GLB viewer page where users mark wall corners on a photo, see a real-time top-view outline, and jump to the cabinet design flow with pre-filled dimensions.

**Architecture:** A new `space` mode coexists with the existing `glb` mode in glbviewer. Space mode shows a photo with overlaid markers, a Canvas 2D top-view preview, and dimension inputs. The preset page gains URL parameter support to pre-fill fields. Pure frontend, no backend.

**Tech Stack:** WeChat Mini Program (xr-frame, Canvas 2D, chooseMedia, movable-view)

---

### Task 1: preset.js — accept URL query params on load

**Files:**
- Modify: `packageDesign/preset/preset.js:17-28`

- [ ] **Step 1: Update `onLoad` to read `width`, `height`, `corner` from options**

Replace the existing `onLoad` method at line 17:

```javascript
onLoad: function(options) {
  try {
    var sysInfo = wx.getWindowInfo();
    var menuBtn = wx.getMenuButtonBoundingClientRect();
    var statusBarHeight = sysInfo.statusBarHeight || 20;
    var navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
    this.setData({ statusBarHeight: statusBarHeight, navBarHeight: navBarHeight });
  } catch (e) {
    this.setData({ statusBarHeight: 20, navBarHeight: 44 });
  }

  // 支持从拍照解析空间传参预填
  if (options && options.width) {
    this.setData({ wallWidth: options.width });
  }
  if (options && options.height) {
    this.setData({ wallHeight: options.height });
  }
  if (options && options.corner) {
    this.setData({ cornerType: options.corner });
    if (options.width) {
      this.validateCorner();
    }
  }
},
```

- [ ] **Step 2: Manual test**

Run the mini program, navigate to preset with query params:
`/packageDesign/preset/preset?width=300&height=260&corner=ZZJ`
Expected: form fields are pre-filled with 300cm width, 260cm height, left corner selected.

- [ ] **Step 3: Commit**

```bash
git add packageDesign/preset/preset.js
git commit -m "feat: preset page accepts width/height/corner URL params for photo space flow"
```

---

### Task 2: glbviewer.wxml — add space mode template

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.wxml`

- [ ] **Step 1: Add space mode idle entry button**

In the idle state overlay (line 47–61), after the two existing CTA buttons (after the "输入模型 URL" button on line 59), add a third button:

```xml
<view class="cta-btn cta-btn-photo" bindtap="startSpaceMode">
  <text class="cta-btn-text photo-text">📷 拍照解析空间</text>
</view>
```

Also add the photo entry to the bottom toolbar (line 132–141), after the "输入URL" button:

```xml
<view class="bar-btn" bindtap="startSpaceMode">
  <text class="bar-btn-icon">📷</text>
  <text class="bar-btn-label">拍照解析</text>
</view>
```

- [ ] **Step 2: Add full space mode UI block**

After the xr-frame viewport block (after line 129 `</view>` closing `.viewport`), before the bottom bar, add the space mode block:

```xml
<!-- 空间解析模式 -->
<view class="space-mode" wx:if="{{mode === 'space'}}" style="top: {{statusBarHeight + navBarHeight}}px;">
  <!-- 照片区域 -->
  <view class="photo-area">
    <image class="photo-image"
           src="{{photoPath}}"
           mode="aspectFit"
           bindload="onPhotoLoad"
           style="width: 100%; height: 100%;" />
    <!-- 标记点叠加层 -->
    <view class="markers-layer"
          bindtap="onPhotoTap">
      <view class="marker {{index === draggingIndex ? 'marker-dragging' : ''}}"
            wx:for="{{markers}}"
            wx:key="index"
            style="left: {{item.x * 100}}%; top: {{item.y * 100}}%;"
            data-index="{{index}}"
            bindlongpress="onMarkerLongPress"
            catchtouchmove="onMarkerDrag"
            catchtouchend="onMarkerDragEnd">
        <view class="marker-dot">●</view>
        <text class="marker-label">{{index + 1}}</text>
      </view>
    </view>
  </view>

  <!-- 俯视轮廓预览 -->
  <view class="topview-section">
    <text class="section-label" wx:if="{{markers.length >= 2}}">俯视轮廓预览</text>
    <text class="section-label" wx:else>请在照片上标记墙角（至少2个点）</text>
    <canvas class="topview-canvas"
            canvas-id="topviewCanvas"
            wx:if="{{markers.length >= 2}}"
            style="width: 320rpx; height: 240rpx;">
    </canvas>
  </view>

  <!-- 转角类型（自动判断） -->
  <view class="corner-display" wx:if="{{markers.length >= 2}}">
    <text class="section-label">转角类型（自动判断）</text>
    <view class="corner-tags">
      <view class="corner-tag {{cornerType === 'none' ? 'corner-tag-active' : ''}}">无</view>
      <view class="corner-tag {{cornerType === 'left' ? 'corner-tag-active' : ''}}">左</view>
      <view class="corner-tag {{cornerType === 'right' ? 'corner-tag-active' : ''}}">右</view>
      <view class="corner-tag {{cornerType === 'both' ? 'corner-tag-active' : ''}}">双侧</view>
    </view>
  </view>

  <!-- 尺寸输入 -->
  <view class="size-inputs" wx:if="{{markers.length >= 2}}">
    <view class="size-row">
      <text class="size-label">墙宽 (cm)</text>
      <input class="size-input" type="digit" placeholder="44-1000" value="{{wallWidth}}" bindinput="onSpaceWidthInput" />
    </view>
    <view class="size-row">
      <text class="size-label">墙高 (cm)</text>
      <input class="size-input" type="digit" placeholder="232-400" value="{{wallHeight}}" bindinput="onSpaceHeightInput" />
    </view>
  </view>

  <!-- 操作按钮 -->
  <view class="space-actions">
    <view class="space-btn space-btn-reset" bindtap="resetMarkers" wx:if="{{markers.length > 0}}">
      <text>清除标记</text>
    </view>
    <view class="space-btn space-btn-design" bindtap="goDesign" wx:if="{{markers.length >= 2}}">
      <text>开始设计 →</text>
    </view>
  </view>
  <view class="space-actions">
    <view class="space-btn space-btn-outline" bindtap="reselectPhoto">
      <text>重新选图</text>
    </view>
  </view>
</view>
```

- [ ] **Step 3: Commit**

```bash
git add pages/knowledge/glbviewer/glbviewer.wxml
git commit -m "feat: add space mode template to glbviewer"
```

---

### Task 3: glbviewer.wxss — add space mode styles

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.wxss`

- [ ] **Step 1: Append space mode styles**

Append the following to the end of `glbviewer.wxss`:

```css
/* ===== 空间解析模式 ===== */

.cta-btn-photo {
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
}

.photo-text {
  color: #ffffff;
}

/* 空间模式容器 */
.space-mode {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #1a1a1a;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* 照片区域 */
.photo-area {
  position: relative;
  width: 100%;
  height: 500rpx;
  background: #0d0d0d;
  overflow: hidden;
}

.photo-image {
  width: 100%;
  height: 100%;
}

.markers-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.marker {
  position: absolute;
  width: 56rpx;
  height: 56rpx;
  margin-left: -28rpx;
  margin-top: -28rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.marker-dot {
  font-size: 32rpx;
  line-height: 1;
  color: #FF6B35;
  text-shadow: 0 0 8rpx rgba(255, 107, 53, 0.6);
}

.marker-label {
  position: absolute;
  top: -24rpx;
  font-size: 20rpx;
  font-weight: 700;
  color: #ffffff;
  background: #FF6B35;
  width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  text-align: center;
  border-radius: 50%;
}

.marker:nth-child(2) .marker-dot { color: #4A90D9; }
.marker:nth-child(2) .marker-label { background: #4A90D9; }
.marker:nth-child(3) .marker-dot { color: #50C878; }
.marker:nth-child(3) .marker-label { background: #50C878; }
.marker:nth-child(4) .marker-dot { color: #E74C3C; }
.marker:nth-child(4) .marker-label { background: #E74C3C; }

.marker-dragging {
  transform: scale(1.3);
}

.marker-dragging .marker-dot {
  text-shadow: 0 0 16rpx rgba(255, 107, 53, 0.9);
}

/* 俯视轮廓区 */
.topview-section {
  padding: 24rpx 32rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.section-label {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 16rpx;
}

.topview-canvas {
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 12rpx;
  background: rgba(255, 255, 255, 0.03);
}

/* 转角类型展示 */
.corner-display {
  padding: 16rpx 32rpx;
}

.corner-tags {
  display: flex;
  gap: 16rpx;
  margin-top: 12rpx;
}

.corner-tag {
  padding: 10rpx 28rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

.corner-tag-active {
  color: #FC9700;
  background: rgba(252, 151, 0, 0.12);
  border-color: rgba(252, 151, 0, 0.3);
}

/* 尺寸输入 */
.size-inputs {
  padding: 16rpx 32rpx;
  display: flex;
  gap: 20rpx;
}

.size-row {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.size-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.4);
}

.size-input {
  height: 72rpx;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: #ffffff;
  box-sizing: border-box;
}

/* 操作按钮 */
.space-actions {
  display: flex;
  gap: 20rpx;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.space-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22rpx 0;
  border-radius: 20rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.space-btn:active {
  opacity: 0.85;
}

.space-btn-reset {
  background: rgba(255, 59, 48, 0.12);
  color: rgba(255, 59, 48, 0.8);
  border: 1rpx solid rgba(255, 59, 48, 0.2);
}

.space-btn-design {
  background: linear-gradient(135deg, #FFB140 0%, #FC9700 100%);
  color: #ffffff;
}

.space-btn-outline {
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  border: 1rpx solid rgba(255, 255, 255, 0.12);
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/knowledge/glbviewer/glbviewer.wxss
git commit -m "feat: add space mode styles to glbviewer"
```

---

### Task 4: glbviewer.js — data fields and mode management

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.js`

- [ ] **Step 1: Add space mode data fields**

Update the `data` object (lines 23–37) to add:

```javascript
data: {
  statusBarHeight: 20,
  navBarHeight: 44,
  glbUrl: '',
  loadStage: 'idle',
  progressPercent: 0,
  downloadedSize: '',
  totalSize: '',
  downloadSpeed: '',
  fileName: '',
  hasError: false,
  errorMsg: '',
  showUrlInput: false,
  inputUrl: '',

  // 空间解析模式
  mode: 'glb',               // 'glb' | 'space'
  photoPath: '',             // 照片临时路径
  photoWidth: 0,             // 图片原始宽度
  photoHeight: 0,            // 图片原始高度
  markers: [],               // [{ x, y }] 标记点，x/y 为 0-1 比例
  wallWidth: '',             // 用户输入墙宽 (cm)
  wallHeight: '',            // 用户输入墙高 (cm)
  cornerType: 'none',        // 'none' | 'left' | 'right' | 'both'
  draggingIndex: -1          // 当前拖拽中的标记点索引，-1 表示无
},
```

- [ ] **Step 2: Add `startSpaceMode` handler**

Add method:

```javascript
startSpaceMode: function() {
  var self = this;
  wx.chooseMedia({
    count: 1,
    mediaType: ['image'],
    sourceType: ['album', 'camera'],
    success: function(res) {
      var tempPath = res.tempFiles[0].tempFilePath;
      self.setData({
        mode: 'space',
        photoPath: tempPath,
        markers: [],
        wallWidth: '',
        wallHeight: '',
        cornerType: 'none',
        draggingIndex: -1,
        glbUrl: ''
      });
    }
  });
},
```

- [ ] **Step 3: Add photo load handler**

Add method:

```javascript
onPhotoLoad: function(e) {
  this.setData({
    photoWidth: e.detail.width,
    photoHeight: e.detail.height
  });
},
```

- [ ] **Step 4: Add `reselectPhoto` and `resetMarkers` handlers**

```javascript
reselectPhoto: function() {
  this.startSpaceMode();
},

resetMarkers: function() {
  this.setData({ markers: [], cornerType: 'none' });
},
```

- [ ] **Step 5: Update `clearModel` to also reset space mode**

Replace the existing `clearModel` method (lines 264–277):

```javascript
clearModel: function() {
  this._abortDownload();
  this.setData({
    glbUrl: '',
    loadStage: 'idle',
    progressPercent: 0,
    downloadedSize: '',
    totalSize: '',
    downloadSpeed: '',
    fileName: '',
    hasError: false,
    errorMsg: '',
    mode: 'glb',
    photoPath: '',
    markers: [],
    wallWidth: '',
    wallHeight: '',
    cornerType: 'none',
    draggingIndex: -1
  });
},
```

- [ ] **Step 6: Commit**

```bash
git add pages/knowledge/glbviewer/glbviewer.js
git commit -m "feat: add space mode data fields and entry handlers to glbviewer"
```

---

### Task 5: glbviewer.js — marker management (add / longpress-drag / click-delete)

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.js`

- [ ] **Step 1: Add `onPhotoTap` — tap to add marker, tap existing marker to delete**

```javascript
/** 照片区域点击：空白处加点，已有标记点则删除 */
onPhotoTap: function(e) {
  var markers = this.data.markers.slice();
  var x = e.detail.x;  // 相对于 markers-layer 的 x 坐标（px）
  var y = e.detail.y;

  // 获取照片显示区域的尺寸（markers-layer 与 photo-area 同尺寸）
  // x/y 是 px 值，需要转为 0-1 比例
  // 使用 photoWidth/photoHeight 或组件查询来获取容器尺寸
  var self = this;
  var query = wx.createSelectorQuery().in(this);
  query.select('.markers-layer').boundingClientRect(function(rect) {
    if (!rect) return;
    var rx = (x - rect.left) / rect.width;
    var ry = (y - rect.top) / rect.height;

    // 检查是否点击了已有标记点（阈值 6% 视口）
    var hitIndex = -1;
    for (var i = 0; i < markers.length; i++) {
      var dx = markers[i].x - rx;
      var dy = markers[i].y - ry;
      if (Math.sqrt(dx * dx + dy * dy) < 0.06) {
        hitIndex = i;
        break;
      }
    }

    if (hitIndex >= 0) {
      // 删除已有标记点
      wx.showModal({
        title: '删除标记',
        content: '确定要删除标记点 ' + (hitIndex + 1) + ' 吗？',
        success: function(modalRes) {
          if (modalRes.confirm) {
            markers.splice(hitIndex, 1);
            self.setData({ markers: markers, draggingIndex: -1 });
            self._updateCornerType();
            self._drawTopView();
          }
        }
      });
    } else if (markers.length >= 4) {
      wx.showToast({ title: '最多标记4个墙角', icon: 'none' });
    } else {
      // 添加新标记点
      markers.push({ x: rx, y: ry });
      self.setData({ markers: markers });
      self._updateCornerType();
      self._drawTopView();
    }
  }).exec();
},
```

- [ ] **Step 2: Add `onMarkerLongPress` — activate drag mode**

```javascript
/** 长按标记点开始拖拽 */
onMarkerLongPress: function(e) {
  var index = e.currentTarget.dataset.index;
  // 触觉反馈
  wx.vibrateShort({ type: 'light' });
  this.setData({ draggingIndex: index });
},
```

- [ ] **Step 3: Add `onMarkerDrag` — update marker position during drag**

```javascript
/** 拖拽移动标记点 */
onMarkerDrag: function(e) {
  var index = this.data.draggingIndex;
  if (index < 0) return;

  var touch = e.touches[0];
  var query = wx.createSelectorQuery().in(this);
  var self = this;

  query.select('.markers-layer').boundingClientRect(function(rect) {
    if (!rect) return;
    var rx = (touch.pageX - rect.left) / rect.width;
    var ry = (touch.pageY - rect.top) / rect.height;
    rx = Math.max(0, Math.min(1, rx));
    ry = Math.max(0, Math.min(1, ry));

    var markers = self.data.markers.slice();
    markers[index] = { x: rx, y: ry };
    self.setData({ markers: markers });
  }).exec();
},
```

- [ ] **Step 4: Add `onMarkerDragEnd` — deactivate drag, redraw**

```javascript
/** 拖拽结束 */
onMarkerDragEnd: function() {
  this.setData({ draggingIndex: -1 });
  this._updateCornerType();
  this._drawTopView();
},
```

- [ ] **Step 5: Commit**

```bash
git add pages/knowledge/glbviewer/glbviewer.js
git commit -m "feat: add marker management (tap-add, longpress-drag, tap-delete) to space mode"
```

---

### Task 6: glbviewer.js — Canvas top-view drawing and corner detection

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.js`

- [ ] **Step 1: Add `_updateCornerType` — auto-detect corner type from markers**

```javascript
/** 根据标记点自动判断转角类型 */
_updateCornerType: function() {
  var markers = this.data.markers;
  var n = markers.length;
  var type = 'none';

  if (n === 2) {
    type = 'none';
  } else if (n === 3) {
    // 三点的拐点方向：计算向量叉积
    var a = markers[0];
    var b = markers[1];
    var c = markers[2];
    // (b-a) × (c-b)
    var v1x = b.x - a.x;
    var v1y = b.y - a.y;
    var v2x = c.x - b.x;
    var v2y = c.y - b.y;
    var cross = v1x * v2y - v1y * v2x;
    type = cross > 0 ? 'left' : 'right';
  } else if (n === 4) {
    type = 'both';
  }

  this.setData({ cornerType: type });
},
```

- [ ] **Step 2: Add `_drawTopView` — draw top-down outline on Canvas**

```javascript
/** 在 Canvas 上绘制房间俯视轮廓 */
_drawTopView: function() {
  var markers = this.data.markers;
  if (markers.length < 2) return;

  var ctx = wx.createCanvasContext('topviewCanvas', this);
  var w = 160;  // Canvas 逻辑尺寸（320rpx / 2）
  var h = 120;  // Canvas 逻辑尺寸（240rpx / 2）
  var pad = 16; // 内边距

  // 计算包围盒
  var minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (var i = 0; i < markers.length; i++) {
    if (markers[i].x < minX) minX = markers[i].x;
    if (markers[i].x > maxX) maxX = markers[i].x;
    if (markers[i].y < minY) minY = markers[i].y;
    if (markers[i].y > maxY) maxY = markers[i].y;
  }

  var bw = maxX - minX || 0.01;
  var bh = maxY - minY || 0.01;
  var scaleX = (w - pad * 2) / bw;
  var scaleY = (h - pad * 2) / bh;
  var scale = Math.min(scaleX, scaleY);

  // 居中偏移
  var drawW = bw * scale;
  var drawH = bh * scale;
  var offX = pad + (w - pad * 2 - drawW) / 2;
  var offY = pad + (h - pad * 2 - drawH) / 2;

  // 映射函数
  function tx(vx) { return offX + (vx - minX) * scale; }
  function ty(vy) { return offY + (vy - minY) * scale; }

  // 清空
  ctx.clearRect(0, 0, w, h);

  // 绘制填充
  ctx.beginPath();
  ctx.moveTo(tx(markers[0].x), ty(markers[0].y));
  for (var i = 1; i < markers.length; i++) {
    ctx.lineTo(tx(markers[i].x), ty(markers[i].y));
  }
  ctx.closePath();
  ctx.setFillStyle('rgba(252, 151, 0, 0.08)');
  ctx.fill();

  // 绘制边线
  ctx.beginPath();
  ctx.moveTo(tx(markers[0].x), ty(markers[0].y));
  for (var i = 1; i < markers.length; i++) {
    ctx.lineTo(tx(markers[i].x), ty(markers[i].y));
  }
  ctx.closePath();
  ctx.setStrokeStyle('rgba(252, 151, 0, 0.7)');
  ctx.setLineWidth(2);
  ctx.stroke();

  // 绘制顶点
  var colors = ['#FF6B35', '#4A90D9', '#50C878', '#E74C3C'];
  for (var i = 0; i < markers.length; i++) {
    var px = tx(markers[i].x);
    var py = ty(markers[i].y);
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.setFillStyle(colors[i]);
    ctx.fill();
  }

  ctx.draw();
},
```

- [ ] **Step 3: Wire `_drawTopView` into marker changes**

After each marker add/delete/drag in Task 5's handlers, the `self._drawTopView()` is already called. Verify it's present in all three operations: `onPhotoTap` (add + delete branches), and `onMarkerDragEnd`.

- [ ] **Step 4: Commit**

```bash
git add pages/knowledge/glbviewer/glbviewer.js
git commit -m "feat: add Canvas top-view drawing and corner auto-detection"
```

---

### Task 7: glbviewer.js — validation and navigation to preset

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.js`

- [ ] **Step 1: Add size input handlers**

```javascript
onSpaceWidthInput: function(e) {
  this.setData({ wallWidth: e.detail.value });
},

onSpaceHeightInput: function(e) {
  this.setData({ wallHeight: e.detail.value });
},
```

- [ ] **Step 2: Add `goDesign` — validate and navigate to preset**

```javascript
/** 跳转预设页面 */
goDesign: function() {
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

  // none -> WZJ, left -> ZZJ, right -> YZJ, both -> ZYZJ
  var cornerMap = { none: 'WZJ', left: 'ZZJ', right: 'YZJ', both: 'ZYZJ' };
  var corner = cornerMap[this.data.cornerType] || 'WZJ';

  var url = '/packageDesign/preset/preset'
    + '?width=' + wallWidth
    + '&height=' + wallHeight
    + '&corner=' + corner;

  wx.navigateTo({ url: url });
},
```

- [ ] **Step 3: Manual end-to-end test**

1. Open glbviewer → click "拍照解析空间"
2. Take/select a room photo
3. Tap to mark 3 corner points on the photo
4. Verify top-view Canvas updates with orange outline
5. Verify "右" or "左" corner tag is highlighted
6. Enter width=300, height=260
7. Tap "开始设计" → should navigate to preset with fields pre-filled
8. Test validation: clear markers → "至少标记2个墙角"
9. Test validation: enter width=30 → "墙宽需 >= 44cm"
10. Test validation: enter height=200 → "墙高需 >= 232cm"

- [ ] **Step 4: Commit**

```bash
git add pages/knowledge/glbviewer/glbviewer.js
git commit -m "feat: add validation and navigation from space mode to preset"
```

---

### Task 8: Final integration verification

- [ ] **Step 1: Verify GLB mode is unaffected**

Open glbviewer → load a GLB file → verify it renders correctly → clear model → try loading via URL.
Expected: All existing GLB functionality works unchanged.

- [ ] **Step 2: Verify space → preset → layout flow**

Complete the full flow: space mode with 3 markers → enter dimensions → navigate to preset → verify pre-filled fields → modify if needed → confirm → verify layout page loads with correct parameters.

- [ ] **Step 3: Verify navigation back from space mode**

In space mode, tap back button → returns to knowledge page. Expected: no crashes or state leaks.

- [ ] **Step 4: Verify mode isolation**

From space mode, tap back → return to knowledge page → re-enter glbviewer → verify it starts in idle/glb mode (not stuck in space mode).
