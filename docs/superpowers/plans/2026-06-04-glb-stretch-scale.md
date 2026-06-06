# GLB 模型拉伸缩放 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace xr-frame GLB display with Three.js WebGL Canvas, supporting per-axis stretch/scale and uniform pinch-to-zoom on the model.

**Architecture:** New `utils/glbSceneManager.js` manages the Three.js scene, camera, lighting, GLB loading, and scale transforms. New `utils/GLTFLoader.js` provides GLB parsing compatible with WeChat Mini Program (threejs-miniprogram v0.0.8 does not include it). `glbviewer` page is updated to use WebGL Canvas + bottom control panel instead of xr-frame.

**Tech Stack:** threejs-miniprogram v0.0.8 (Three.js 0.108.0), WeChat Mini Program WebGL Canvas, wx file system API

---

## File Structure

| File | Role |
|------|------|
| `utils/GLTFLoader.js` | **New** — GLB parser for threejs-miniprogram, adapted from Three.js 0.108.0 GLTFLoader. Exposes `parse(data: ArrayBuffer, path: string)` returning `{scene, animations, ...}`. Registers as `THREE.GLTFLoader`. |
| `utils/glbSceneManager.js` | **New** — Scene management: renderer, camera (perspective + orbit), lights, model group with scale controls, touch gesture handling. |
| `pages/knowledge/glbviewer/glbviewer.wxml` | **Modify** — Replace `<xr-frame>` block with `<canvas type="webgl" id="glbCanvas">` + scale control panel (shown when model loaded). |
| `pages/knowledge/glbviewer/glbviewer.js` | **Modify** — Replace xr-frame event handlers with Three.js init/load/scale logic. |
| `pages/knowledge/glbviewer/glbviewer.wxss` | **Modify** — Add scale control panel styles. |

---

### Task 1: Create `utils/GLTFLoader.js`

**Files:**
- Create: `utils/GLTFLoader.js`

This is the Three.js 0.108.0 GLTFLoader adapted for WeChat Mini Program. The file is large (~1200 lines) because it needs the full glTF 2.0 parsing logic. Key adaptations from the standard Three.js GLTFLoader:

- Uses `wx.getFileSystemManager().readFileSync()` for loading external `.bin` buffers instead of `fetch()`
- Uses `wx.createImage()` for texture loading in `loadTexture()`
- Registers itself on the passed `THREE` object

- [ ] **Step 1: Download and adapt GLTFLoader from Three.js 0.108.0**

The full source is available from the Three.js repo at https://raw.githubusercontent.com/mrdoob/three.js/r108/examples/js/loaders/GLTFLoader.js

Key adaptations needed for WeChat:
1. Replace `self` references with a closure variable for the global scope
2. Override `loadTexture()` to use `wx.createImage()` 
3. Override buffer loading to use `wx.getFileSystemManager().readFileSync()`
4. Export as a CommonJS module that applies itself to a `THREE` instance

The file will be ~1200 lines. Write the complete adapted file:

```javascript
// utils/GLTFLoader.js
// Adapted from Three.js r108 GLTFLoader for WeChat Mini Program
// Original: https://github.com/mrdoob/three.js/blob/r108/examples/js/loaders/GLTFLoader.js

module.exports = function(THREE) {
  if (THREE.GLTFLoader) return THREE.GLTFLoader;

  // ... full GLTFLoader source (~1200 lines) with WeChat adaptations ...
  // Key method — loadTexture:
  //   var img = wx.createImage();
  //   img.onload = ...;
  //   img.src = uri;
  //
  // Key method — loadBuffer via wx file system:
  //   var fs = wx.getFileSystemManager();
  //   var buffer = fs.readFileSync(uri);
  //   return buffer;

  return THREE.GLTFLoader;
};
```

**Note:** The full adapted GLTFLoader source is ~1200 lines. Due to its length, it will be implemented inline during task execution. The adaptation touches 3 methods: `loadTexture` (use `wx.createImage()`), `loadFile` (use `wx.getFileSystemManager().readFileSync()`), and the `GLTFLoader` constructor (accept a `THREE` reference).

- [ ] **Step 2: Commit**

```bash
git add utils/GLTFLoader.js
git commit -m "feat: add GLTFLoader adapted for WeChat Mini Program"
```

---

### Task 2: Create `utils/glbSceneManager.js`

**Files:**
- Create: `utils/glbSceneManager.js`

- [ ] **Step 1: Write the scene manager**

```javascript
// utils/glbSceneManager.js
// Three.js GLB model viewer with stretch/scale support for WeChat Mini Program

function createGLBSceneManager(canvas, THREE) {

  var scene, camera, renderer;
  var modelGroup;
  var originalSize = { x: 0, y: 0, z: 0 };
  var currentScale = { x: 1, y: 1, z: 1 };
  var _canvas = canvas;
  var _THREE = THREE;

  // Orbit state
  var theta = 0.3;
  var phi = Math.PI / 4;
  var radius = 3;
  var target = { x: 0, y: 0, z: 0 };

  // Touch state
  var touchStart = null;
  var touchStartDist = 0;
  var touchMoved = false;

  function init() {
    renderer = new THREE.WebGLRenderer({
      canvas: _canvas,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(2);
    renderer.setSize(_canvas.width, _canvas.height, false);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(45, _canvas.width / Math.max(_canvas.height, 1), 0.1, 100);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    var dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);
    var fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-2, 1, -2);
    scene.add(fillLight);

    modelGroup = new THREE.Group();
    scene.add(modelGroup);

    _updateCamera();
    renderer.render(scene, camera);
  }

  function loadGLB(url) {
    return new Promise(function(resolve, reject) {
      try {
        var fs = wx.getFileSystemManager();
        var data = fs.readFileSync(url);
        if (!data) {
          reject(new Error('Failed to read file: ' + url));
          return;
        }
        var loader = new _THREE.GLTFLoader();
        loader.parse(data.buffer, '', function(gltf) {
          // Remove old model
          while (modelGroup.children.length > 0) {
            var child = modelGroup.children[0];
            _disposeObject(child);
            modelGroup.remove(child);
          }
          modelGroup.add(gltf.scene);

          // Calculate original bounding box
          var box = new _THREE.Box3().setFromObject(gltf.scene);
          var size = new _THREE.Vector3();
          box.getSize(size);
          originalSize.x = parseFloat(size.x.toFixed(3));
          originalSize.y = parseFloat(size.y.toFixed(3));
          originalSize.z = parseFloat(size.z.toFixed(3));

          // Auto-fit camera
          var maxDim = Math.max(originalSize.x, originalSize.y, originalSize.z);
          if (maxDim < 0.01) maxDim = 1;
          radius = maxDim * 2.5;
          target.x = 0;
          target.y = originalSize.y / 2;
          target.z = 0;
          phi = Math.PI / 4;
          theta = 0.3;
          currentScale.x = 1;
          currentScale.y = 1;
          currentScale.z = 1;
          modelGroup.scale.set(1, 1, 1);

          _updateCamera();
          renderer.render(scene, camera);

          resolve({
            x: Math.round(originalSize.x * 100),
            y: Math.round(originalSize.y * 100),
            z: Math.round(originalSize.z * 100)
          });
        }, function(err) {
          reject(new Error('GLB parse error: ' + (err.message || err)));
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  function _disposeObject(obj) {
    if (!obj) return;
    obj.traverse(function(child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(function(m) { _disposeMaterial(m); });
        } else {
          _disposeMaterial(child.material);
        }
      }
    });
  }

  function _disposeMaterial(mat) {
    Object.keys(mat).forEach(function(key) {
      if (mat[key] && mat[key].isTexture) {
        mat[key].dispose();
      }
    });
    mat.dispose();
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

  function setUniformScale(s) {
    currentScale.x = s;
    currentScale.y = s;
    currentScale.z = s;
    modelGroup.scale.set(s, s, s);
    renderer.render(scene, camera);
  }

  function setAxisScale(x, y, z) {
    currentScale.x = x;
    currentScale.y = y;
    currentScale.z = z;
    modelGroup.scale.set(x, y, z);
    renderer.render(scene, camera);
  }

  function getOriginalSize() {
    return { x: originalSize.x, y: originalSize.y, z: originalSize.z };
  }

  function getCurrentScale() {
    return { x: currentScale.x, y: currentScale.y, z: currentScale.z };
  }

  function resetScale() {
    currentScale.x = 1;
    currentScale.y = 1;
    currentScale.z = 1;
    modelGroup.scale.set(1, 1, 1);
    renderer.render(scene, camera);
  }

  // ---- Touch / Orbit ----

  function _dist(t1, t2) {
    var dx = t1.x - t2.x;
    var dy = t1.y - t2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function handleTouchStart(touches) {
    if (!touches || touches.length === 0) return;
    touchStart = { x: touches[0].x, y: touches[0].y };
    touchMoved = false;
    if (touches.length >= 2) {
      touchStartDist = _dist(touches[0], touches[1]);
    } else {
      touchStartDist = 0;
    }
  }

  function handleTouchMove(touches) {
    if (!touchStart || !touches || touches.length === 0) return;

    if (touches.length >= 2 && touchStartDist > 0) {
      var newDist = _dist(touches[0], touches[1]);
      var factor = newDist / touchStartDist;
      var s = Math.max(0.3, Math.min(3, currentScale.x * factor));
      setUniformScale(s);
      touchStartDist = newDist;
      touchMoved = true;
    } else if (touches.length === 1) {
      var dx = touches[0].x - touchStart.x;
      var dy = touches[0].y - touchStart.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) touchMoved = true;
      theta -= dx * 0.008;
      phi += dy * 0.008;
      phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, phi));
      _updateCamera();
      renderer.render(scene, camera);
    }

    if (touches.length === 1) {
      touchStart.x = touches[0].x;
      touchStart.y = touches[0].y;
    }
  }

  function handleTouchEnd() {
    var wasTap = !touchMoved;
    touchStart = null;
    touchStartDist = 0;
    touchMoved = false;
    return wasTap;
  }

  function animate() {
    _canvas.requestAnimationFrame(animate);
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  function dispose() {
    if (modelGroup) {
      while (modelGroup.children.length > 0) {
        var child = modelGroup.children[0];
        _disposeObject(child);
        modelGroup.remove(child);
      }
    }
    if (renderer) renderer.dispose();
    scene = null;
    camera = null;
    renderer = null;
    modelGroup = null;
  }

  return {
    init: init,
    loadGLB: loadGLB,
    setUniformScale: setUniformScale,
    setAxisScale: setAxisScale,
    getOriginalSize: getOriginalSize,
    getCurrentScale: getCurrentScale,
    resetScale: resetScale,
    handleTouchStart: handleTouchStart,
    handleTouchMove: handleTouchMove,
    handleTouchEnd: handleTouchEnd,
    animate: animate,
    dispose: dispose
  };
}

module.exports = { createGLBSceneManager: createGLBSceneManager };
```

- [ ] **Step 2: Commit**

```bash
git add utils/glbSceneManager.js
git commit -m "feat: add GLB scene manager with stretch/scale support"
```

---

### Task 3: Update `glbviewer.wxml` — replace xr-frame with WebGL canvas + control panel

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.wxml`

- [ ] **Step 1: Replace the viewport section**

Replace the entire `<!-- 3D 视口 -->` block (the `<view class="viewport" ... wx:if="{{mode === 'glb'}}">` section) with the new canvas-based implementation.

The new viewport block:

```xml
<!-- 3D 视口 -->
<view class="viewport" style="top: {{statusBarHeight + navBarHeight}}px;" wx:if="{{mode === 'glb'}}">
  <!-- WebGL Canvas -->
  <canvas type="webgl" id="glbCanvas" class="glb-canvas"
          wx:if="{{loadStage === 'done'}}"
          bindtouchstart="onGLBTouch"
          bindtouchmove="onGLBTouch"
          bindtouchend="onGLBTouch">
  </canvas>

  <!-- 空状态 -->
  <view class="center-overlay" wx:if="{{loadStage === 'idle'}}">
    <view class="center-icon-wrap">
      <text class="center-icon">📦</text>
    </view>
    <text class="center-title">GLB 模型预览</text>
    <text class="center-desc">支持 .glb / .gltf 格式的三维模型文件</text>
    <!-- 柜子3D模型快捷入口 -->
    <view class="cabinet-presets" wx:if="{{modelList.length > 0}}">
      <text class="presets-title">柜子 3D 模型</text>
      <scroll-view class="presets-scroll" scroll-x="true" enhanced="{{true}}" show-scrollbar="{{false}}">
        <view class="preset-item" wx:for="{{modelList}}" wx:key="name" bindtap="loadCabinetModel" data-url="{{item.url}}" data-name="{{item.name}}">
          <text class="preset-icon">🧊</text>
          <text class="preset-label">{{item.label}}</text>
        </view>
      </scroll-view>
    </view>
    <view class="center-actions">
      <view class="cta-btn" bindtap="chooseFile">
        <text class="cta-btn-text">选择 GLB 文件</text>
      </view>
      <view class="cta-btn cta-btn-outline" bindtap="toggleUrlInput">
        <text class="cta-btn-text outline-text">输入模型 URL</text>
      </view>
      <view class="cta-btn cta-btn-photo" bindtap="startSpaceMode">
        <text class="cta-btn-text photo-text">📷 拍照解析空间</text>
      </view>
    </view>
  </view>

  <!-- 错误状态 -->
  <view class="center-overlay" wx:if="{{loadStage === 'error'}}">
    <view class="center-icon-wrap error-icon-wrap">
      <text class="center-icon">⚠️</text>
    </view>
    <text class="center-title">加载失败</text>
    <text class="center-desc error-desc">{{errorMsg}}</text>
    <view class="center-actions">
      <view class="cta-btn" bindtap="chooseFile">
        <text class="cta-btn-text">重新选择文件</text>
      </view>
      <view class="cta-btn cta-btn-outline" bindtap="toggleUrlInput">
        <text class="cta-btn-text outline-text">输入 URL 重试</text>
      </view>
    </view>
  </view>

  <!-- 下载进度面板 -->
  <view class="center-overlay" wx:if="{{loadStage === 'resolving' || loadStage === 'downloading' || loadStage === 'parsing'}}">
    <view class="stage-icon-wrap">
      <view class="stage-icon" wx:if="{{loadStage === 'resolving'}}">
        <text class="stage-icon-text">🔗</text>
      </view>
      <view class="stage-icon" wx:if="{{loadStage === 'downloading'}}">
        <text class="stage-icon-text">📥</text>
      </view>
      <view class="stage-icon" wx:if="{{loadStage === 'parsing'}}">
        <text class="stage-icon-text">🔧</text>
      </view>
    </view>
    <text class="stage-label" wx:if="{{loadStage === 'resolving'}}">正在解析下载链接...</text>
    <text class="stage-label" wx:if="{{loadStage === 'downloading'}}">正在下载模型文件</text>
    <text class="stage-label" wx:if="{{loadStage === 'parsing'}}">正在加载 3D 场景...</text>
    <text class="stage-filename" wx:if="{{fileName}}">{{fileName}}</text>
    <view class="progress-wrap" wx:if="{{loadStage !== 'resolving'}}">
      <view class="progress-bar">
        <view class="progress-fill" style="width: {{progressPercent}}%;"></view>
      </view>
      <text class="progress-text">{{progressPercent}}%</text>
    </view>
    <view class="dl-detail" wx:if="{{loadStage === 'downloading'}}">
      <text class="dl-detail-text" wx:if="{{downloadedSize && totalSize}}">{{downloadedSize}} / {{totalSize}}</text>
      <text class="dl-detail-text" wx:elif="{{downloadedSize}}">已下载 {{downloadedSize}}</text>
      <view class="dl-detail-row" wx:if="{{downloadSpeed}}">
        <text class="dl-detail-text dl-speed">{{downloadSpeed}}</text>
      </view>
    </view>
    <view class="cancel-btn" wx:if="{{loadStage === 'downloading'}}" bindtap="cancelDownload">
      <text class="cancel-btn-text">取消下载</text>
    </view>
  </view>

  <!-- 底部控制面板（模型加载完成后显示） -->
  <view class="scale-panel" wx:if="{{loadStage === 'done'}}">
    <!-- Tab 切换 -->
    <view class="scale-tabs">
      <view class="scale-tab {{scaleMode === 'uniform' ? 'scale-tab-active' : ''}}" bindtap="switchScaleMode" data-mode="uniform">
        <text>等比缩放</text>
      </view>
      <view class="scale-tab {{scaleMode === 'axis' ? 'scale-tab-active' : ''}}" bindtap="switchScaleMode" data-mode="axis">
        <text>轴向拉伸</text>
      </view>
    </view>

    <!-- 等比缩放模式 -->
    <view class="scale-sliders" wx:if="{{scaleMode === 'uniform'}}">
      <view class="slider-row">
        <text class="slider-label">缩放</text>
        <slider class="scale-slider"
                min="30" max="300" step="1"
                value="{{uniformScalePercent}}"
                bindchange="onUniformScaleChange"
                show-value="{{true}}"
                activeColor="#FC9700"
                backgroundColor="rgba(255,255,255,0.1)" />
        <text class="slider-value">{{uniformScaleText}}</text>
      </view>
    </view>

    <!-- 轴向拉伸模式 -->
    <view class="scale-sliders" wx:if="{{scaleMode === 'axis'}}">
      <view class="slider-row">
        <text class="slider-label">X (宽)</text>
        <slider class="scale-slider"
                min="{{axisMin.x}}" max="{{axisMax.x}}" step="1"
                value="{{axisValue.x}}"
                bindchange="onAxisScaleXChange"
                show-value="{{true}}"
                activeColor="#FC9700"
                backgroundColor="rgba(255,255,255,0.1)" />
        <text class="slider-value">{{axisDisplay.x}}cm</text>
      </view>
      <view class="slider-row">
        <text class="slider-label">Y (高)</text>
        <slider class="scale-slider"
                min="{{axisMin.y}}" max="{{axisMax.y}}" step="1"
                value="{{axisValue.y}}"
                bindchange="onAxisScaleYChange"
                show-value="{{true}}"
                activeColor="#FC9700"
                backgroundColor="rgba(255,255,255,0.1)" />
        <text class="slider-value">{{axisDisplay.y}}cm</text>
      </view>
      <view class="slider-row">
        <text class="slider-label">Z (深)</text>
        <slider class="scale-slider"
                min="{{axisMin.z}}" max="{{axisMax.z}}" step="1"
                value="{{axisValue.z}}"
                bindchange="onAxisScaleZChange"
                show-value="{{true}}"
                activeColor="#FC9700"
                backgroundColor="rgba(255,255,255,0.1)" />
        <text class="slider-value">{{axisDisplay.z}}cm</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="scale-actions">
      <view class="scale-action-btn scale-action-reset" bindtap="resetGLBScale">
        <text>重置</text>
      </view>
      <view class="scale-action-btn scale-action-confirm" bindtap="confirmGLBSize">
        <text>确认尺寸</text>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 2: Commit**

```bash
git add pages/knowledge/glbviewer/glbviewer.wxml
git commit -m "feat: replace xr-frame with WebGL canvas + scale control panel"
```

---

### Task 4: Update `glbviewer.js` — integrate glbSceneManager

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.js`

- [ ] **Step 1: Add data fields and modify existing handlers**

In `Page.data`, add these new fields:

```javascript
data: {
  // ... existing fields ...

  // New: GLB scale control
  scaleMode: 'uniform',
  uniformScalePercent: 100,
  uniformScaleText: '1.00x',
  axisMin: { x: 30, y: 30, z: 30 },
  axisMax: { x: 300, y: 300, z: 300 },
  axisValue: { x: 100, y: 100, z: 100 },
  axisDisplay: { x: '0cm', y: '0cm', z: '0cm' },
  origSizeCm: { x: 0, y: 0, z: 0 },
},
```

- [ ] **Step 2: Add GLB scene initialization method and lifecycle changes**

In `onUnload`, update to clean up GLB scene manager. Add new methods after existing code.

```javascript
// In onUnload, add before the existing _sceneManager check:
onUnload: function() {
  this._abortDownload();
  if (this._glbManager) {
    try { this._glbManager.dispose(); } catch (e) {}
    this._glbManager = null;
    this._glbTHREE = null;
  }
  if (this._sceneManager) {
    try { this._sceneManager.dispose(); } catch (e) {}
    this._sceneManager = null;
    this._THREE = null;
  }
},

// ... existing methods ...

// ---- New: GLB Three.js scene methods ----

_initGLBScene: function() {
  var self = this;
  var query = wx.createSelectorQuery().in(this);
  query.select('#glbCanvas')
    .fields({ node: true, size: true })
    .exec(function(res) {
      if (!res || !res[0] || !res[0].node) {
        if ((self._glbInitRetry = (self._glbInitRetry || 0) + 1) < 5) {
          setTimeout(function() { self._initGLBScene(); }, 300);
        } else {
          self.setData({ loadStage: 'error', hasError: true, errorMsg: '3D 初始化失败' });
        }
        return;
      }
      var canvas = res[0].node;
      canvas.width = res[0].width;
      canvas.height = res[0].height;

      try {
        var scopedThree = require('../../../utils/threejs-miniprogram.js').createScopedThreejs(canvas);
        if (!scopedThree || !scopedThree.WebGLRenderer) {
          throw new Error('threejs-miniprogram 加载失败');
        }
        // Register GLTFLoader
        require('../../../utils/GLTFLoader.js')(scopedThree);

        var mgr = require('../../../utils/glbSceneManager.js').createGLBSceneManager(canvas, scopedThree);
        mgr.init();
        self._glbManager = mgr;
        self._glbTHREE = scopedThree;
        mgr.animate();

        // Load the model
        var glbUrl = self.data.glbUrl;
        if (glbUrl) {
          mgr.loadGLB(glbUrl).then(function(origSizeCm) {
            self.setData({
              loadStage: 'done',
              origSizeCm: origSizeCm,
              uniformScalePercent: 100,
              uniformScaleText: '1.00x',
              axisMin: {
                x: Math.round(origSizeCm.x * 0.3),
                y: Math.round(origSizeCm.y * 0.3),
                z: Math.round(origSizeCm.z * 0.3)
              },
              axisMax: {
                x: Math.round(origSizeCm.x * 3),
                y: Math.round(origSizeCm.y * 3),
                z: Math.round(origSizeCm.z * 3)
              },
              axisValue: {
                x: origSizeCm.x,
                y: origSizeCm.y,
                z: origSizeCm.z
              },
              axisDisplay: {
                x: origSizeCm.x + 'cm',
                y: origSizeCm.y + 'cm',
                z: origSizeCm.z + 'cm'
              }
            });
          }).catch(function(err) {
            console.error('[glb] load error:', err);
            self.setData({ loadStage: 'error', hasError: true, errorMsg: '模型解析失败: ' + (err.message || '') });
          });
        }
      } catch (err) {
        console.error('[glb] init error:', err);
        self.setData({ loadStage: 'error', hasError: true, errorMsg: '3D 引擎启动失败' });
      }
    });
},

// ---- Touch handler ----

onGLBTouch: function(e) {
  var mgr = this._glbManager;
  if (!mgr) return;

  if (e.type === 'touchstart') {
    mgr.handleTouchStart(e.touches);
  } else if (e.type === 'touchmove') {
    mgr.handleTouchMove(e.touches);
  } else if (e.type === 'touchend') {
    mgr.handleTouchEnd();
  }
},

// ---- Scale controls ----

switchScaleMode: function(e) {
  this.setData({ scaleMode: e.currentTarget.dataset.mode });
},

onUniformScaleChange: function(e) {
  var pct = e.detail.value;
  var s = pct / 100;
  this.setData({
    uniformScalePercent: pct,
    uniformScaleText: s.toFixed(2) + 'x'
  });
  if (this._glbManager) {
    this._glbManager.setUniformScale(s);
    var mgr = this._glbManager;
    var sc = mgr.getCurrentScale();
    var orig = this.data.origSizeCm;
    this.setData({
      axisValue: {
        x: Math.round(orig.x * sc.x),
        y: Math.round(orig.y * sc.y),
        z: Math.round(orig.z * sc.z)
      },
      axisDisplay: {
        x: Math.round(orig.x * sc.x) + 'cm',
        y: Math.round(orig.y * sc.y) + 'cm',
        z: Math.round(orig.z * sc.z) + 'cm'
      }
    });
  }
},

onAxisScaleXChange: function(e) {
  this._applyAxisVal('x', e.detail.value);
},
onAxisScaleYChange: function(e) {
  this._applyAxisVal('y', e.detail.value);
},
onAxisScaleZChange: function(e) {
  this._applyAxisVal('z', e.detail.value);
},

_applyAxisVal: function(axis, cmVal) {
  var orig = this.data.origSizeCm;
  var scaleVal = orig[axis] > 0 ? cmVal / orig[axis] : 1;
  var newAxisVal = {};
  newAxisVal[axis] = cmVal;
  var newAxisDisplay = {};
  newAxisDisplay[axis] = cmVal + 'cm';

  var cur = this._glbManager ? this._glbManager.getCurrentScale() : { x: 1, y: 1, z: 1 };
  cur[axis] = scaleVal;

  this.setData({ axisValue: Object.assign({}, this.data.axisValue, newAxisVal),
                  axisDisplay: Object.assign({}, this.data.axisDisplay, newAxisDisplay) });
  if (this._glbManager) {
    this._glbManager.setAxisScale(cur.x, cur.y, cur.z);
  }
},

resetGLBScale: function() {
  if (this._glbManager) {
    this._glbManager.resetScale();
  }
  var orig = this.data.origSizeCm;
  this.setData({
    scaleMode: 'uniform',
    uniformScalePercent: 100,
    uniformScaleText: '1.00x',
    axisValue: { x: orig.x, y: orig.y, z: orig.z },
    axisDisplay: { x: orig.x + 'cm', y: orig.y + 'cm', z: orig.z + 'cm' }
  });
},

confirmGLBSize: function() {
  var sc = this._glbManager ? this._glbManager.getCurrentScale() : { x: 1, y: 1, z: 1 };
  var orig = this.data.origSizeCm;
  wx.showModal({
    title: '当前尺寸',
    content: 'X(宽): ' + Math.round(orig.x * sc.x) + 'cm\n' +
             'Y(高): ' + Math.round(orig.y * sc.y) + 'cm\n' +
             'Z(深): ' + Math.round(orig.z * sc.z) + 'cm',
    showCancel: false
  });
},
```

- [ ] **Step 3: Modify `_startDownload` success callback to trigger Three.js init**

In `_startDownload`, change the `success` callback. After `self.setData({ glbUrl: res.tempFilePath })`, replace the existing logic with a call to `_initGLBScene()`:

```javascript
// In _startDownload, the success callback. Replace:
//   self.setData({ loadStage: 'parsing', progressPercent: 100, downloadSpeed: '' });
//   self.setData({ glbUrl: res.tempFilePath });
// With:
success: function(res) {
  self._downloadTask = null;
  if (res.statusCode === 200 && res.tempFilePath) {
    self.setData({ loadStage: 'parsing', progressPercent: 100, downloadSpeed: '' });
    self.setData({ glbUrl: res.tempFilePath }, function() {
      // Wait for next tick so wxml renders canvas
      setTimeout(function() { self._initGLBScene(); }, 200);
    });
  } else {
    self.setData({
      loadStage: 'error', hasError: true,
      errorMsg: '下载失败 (HTTP ' + (res.statusCode || '?') + ')'
    });
  }
},
```

- [ ] **Step 4: Modify `_loadGlb` to handle local files directly with Three.js**

In `_loadGlb`, when url starts with `wxfile://` or `http://usr`, instead of just setting `glbUrl` and switching to `parsing`, trigger Three.js loading directly:

```javascript
// In _loadGlb, replace:
//   if (url.indexOf('wxfile://') === 0 || url.indexOf('http://usr') === 0) {
//     self.setData({ loadStage: 'parsing', progressPercent: 100 });
//     self.setData({ glbUrl: url });
//     return;
//   }
// With:
if (url.indexOf('wxfile://') === 0 || url.indexOf('http://usr') === 0) {
  self.setData({ loadStage: 'parsing', progressPercent: 100, glbUrl: url }, function() {
    setTimeout(function() { self._initGLBScene(); }, 200);
  });
  return;
}
```

- [ ] **Step 5: Modify `clearModel` to also clean up GLB scene**

```javascript
// In clearModel, add before the existing dispose logic:
clearModel: function() {
  this._abortDownload();
  if (this._glbManager) {
    try { this._glbManager.dispose(); } catch (e) {}
    this._glbManager = null;
    this._glbTHREE = null;
  }
  if (this._sceneManager) {
    try { this._sceneManager.dispose(); } catch (e) {}
    this._sceneManager = null;
    this._THREE = null;
  }
  this.setData({
    glbUrl: '',
    loadStage: 'idle',
    // ... rest of existing fields ...
    scaleMode: 'uniform',
    uniformScalePercent: 100,
    uniformScaleText: '1.00x',
    origSizeCm: { x: 0, y: 0, z: 0 },
  });
},
```

- [ ] **Step 6: Remove xr-frame event handlers**

Remove these methods which are no longer used:
- `onXrReady`
- `onXrError`
- `onAssetLoaded`
- `onAssetError`

These were bound to xr-frame events in the old WXML and are no longer triggered.

- [ ] **Step 7: Commit**

```bash
git add pages/knowledge/glbviewer/glbviewer.js
git commit -m "feat: integrate Three.js GLB scene with stretch/scale controls"
```

---

### Task 5: Update `glbviewer.wxss` — add scale panel styles

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.wxss`

- [ ] **Step 1: Add styles for WebGL canvas and scale control panel**

Append at end of file:

```css
/* ===== WebGL Canvas ===== */
.glb-canvas {
  width: 100%;
  height: 100%;
}

/* ===== 底部缩放控制面板 ===== */
.scale-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1rpx solid rgba(255, 255, 255, 0.08);
  padding: 8rpx 0;
  padding-bottom: calc(8rpx + env(safe-area-inset-bottom));
  z-index: 50;
}

/* Tab 切换 */
.scale-tabs {
  display: flex;
  gap: 0;
  margin: 0 32rpx 12rpx;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 14rpx;
  overflow: hidden;
}

.scale-tab {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.4);
  border-radius: 14rpx;
  transition: all 0.15s;
}

.scale-tab:active {
  opacity: 0.7;
}

.scale-tab-active {
  background: rgba(252, 151, 0, 0.18);
  color: #FC9700;
  font-weight: 600;
}

/* 滑块行 */
.scale-sliders {
  padding: 6rpx 32rpx 10rpx;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 6rpx;
}

.slider-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.4);
  width: 80rpx;
  flex-shrink: 0;
  text-align: right;
}

.scale-slider {
  flex: 1;
}

.slider-value {
  font-size: 24rpx;
  color: #FC9700;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  min-width: 96rpx;
  text-align: right;
  flex-shrink: 0;
}

/* 操作按钮 */
.scale-actions {
  display: flex;
  gap: 20rpx;
  padding: 12rpx 32rpx 4rpx;
}

.scale-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18rpx 0;
  border-radius: 20rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.scale-action-btn:active {
  opacity: 0.85;
}

.scale-action-reset {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
}

.scale-action-confirm {
  background: linear-gradient(135deg, #FFB140 0%, #FC9700 100%);
  color: #ffffff;
}
```

- [ ] **Step 2: Remove unused xr-frame styles**

Remove the `.xr-frame` style (no longer needed since xr-frame is removed).

- [ ] **Step 3: Remove the bottom-bar styles**

Remove the entire `.bottom-bar` block and its child `.bar-btn` styles. These were for the old "更换文件/输入URL/拍照解析" bar that appeared after xr-frame loaded. The new scale panel replaces it.

- [ ] **Step 4: Commit**

```bash
git add pages/knowledge/glbviewer/glbviewer.wxss
git commit -m "style: add scale control panel styles, remove xr-frame styles"
```

---

## Verification

Since this is a WeChat Mini Program, there is no automated test framework for Canvas/WebGL rendering. Verification steps (manual in WeChat DevTools):

1. Open the `glbviewer` page
2. Click "选择 GLB 文件" and pick a `.glb` file
3. Verify model renders on the canvas
4. Single-finger drag — verify orbit rotation
5. Two-finger pinch — verify model scales uniformly
6. Switch to "轴向拉伸" tab
7. Drag each slider — verify model stretches on correct axis
8. Click "重置" — verify model returns to original size
9. Click a cabinet preset from the model catalog — verify it loads
