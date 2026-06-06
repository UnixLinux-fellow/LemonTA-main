# Photo-to-3D Pipeline Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the photo-to-3D pipeline from the overloaded `glbviewer.js` into a dedicated page `pages/knowledge/photo/photo` backed by two new modules (`roomReconstructor.js`, `roomScene.js`), with perspective-corrected textures, full room reconstruction, and enhanced 3D rendering.

**Architecture:** Three new files (roomReconstructor.js, roomScene.js, photo page) plus cleanup of two existing files (glbviewer.js, glbviewer.wxml) and one config change (app.json). Modules are independent — roomReconstructor is pure computation, roomScene is pure 3D rendering, photo.js orchestrates both.

**Tech Stack:** WeChat Mini Program, threejs-miniprogram (r108), Canvas 2D API, perspective.js (DLT homography)

---

### File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `utils/roomReconstructor.js` | CREATE | Photo analysis: geometry, texture warping, color sampling |
| `utils/roomScene.js` | CREATE | Enhanced 3D room: textured walls/floor, PBR, hemisphere light |
| `pages/knowledge/photo/photo.js` | CREATE | Page logic: 4-stage state machine |
| `pages/knowledge/photo/photo.wxml` | CREATE | Template: photo, markers, params, 3D canvas |
| `pages/knowledge/photo/photo.wxss` | CREATE | Styles |
| `pages/knowledge/glbviewer/glbviewer.js` | MODIFY | Remove ~600 lines of space mode code |
| `pages/knowledge/glbviewer/glbviewer.wxml` | MODIFY | Remove space mode templates |
| `app.json` | MODIFY | Register new page path |

---

### Task 1: Create `utils/roomReconstructor.js`

**Files:**
- Create: `utils/roomReconstructor.js`

- [ ] **Step 1: Write the complete module**

```js
/**
 * 房间重建器 — 从照片标记点反推房间几何与纹理
 *
 * 依赖: utils/perspective.js (DLT单应矩阵、透视变形、地板估算)
 *
 * API:
 *   computeGeometry(markers, photoW, photoH) → geo
 *   extractWallTexture(ctx, img, wallQuad, outW, outH) → boolean
 *   extractFloorTexture(ctx, img, floorQuad, outW, outH) → boolean
 *   sampleSideColor(wallQuad, img) → { left: '#hex', right: '#hex' }
 */

var perspective = require('./perspective.js');

// ---- 几何计算 ----

function computeGeometry(markers, photoW, photoH) {
  // 1. 按 y 排序：底部2个是地面点，顶部1个
  var sortedByY = markers.slice().sort(function(a, b) { return b.y - a.y; });
  var groundA = sortedByY[0];
  var groundB = sortedByY[1];
  var topMarker = sortedByY[2];

  // 2. 地面点按 x 排序 → BL(左), BR(右)
  var BL, BR;
  if (groundA.x < groundB.x) { BL = groundA; BR = groundB; }
  else                        { BL = groundB; BR = groundA; }

  // 3. 判断顶部点是 TL 还是 TR
  var midX = (BL.x + BR.x) / 2;
  var TL, TR;
  if (topMarker.x < midX) {
    TL = topMarker;
    TR = {
      x: BR.x + TL.x - BL.x,
      y: BR.y + TL.y - BL.y
    };
  } else {
    TR = topMarker;
    TL = {
      x: BL.x + TR.x - BR.x,
      y: BL.y + TR.y - BR.y
    };
  }

  // 4. 墙面四边形（像素坐标）
  var wallQuad = [
    { x: BL.x * photoW, y: BL.y * photoH },
    { x: BR.x * photoW, y: BR.y * photoH },
    { x: TR.x * photoW, y: TR.y * photoH },
    { x: TL.x * photoW, y: TL.y * photoH }
  ];

  // 5. 宽高比（从上边/下边 + 左边/右边估算）
  var topEdge = Math.sqrt(
    Math.pow(wallQuad[3].x - wallQuad[2].x, 2) +
    Math.pow(wallQuad[3].y - wallQuad[2].y, 2)
  );
  var bottomEdge = Math.sqrt(
    Math.pow(wallQuad[0].x - wallQuad[1].x, 2) +
    Math.pow(wallQuad[0].y - wallQuad[1].y, 2)
  );
  var leftEdge = Math.sqrt(
    Math.pow(wallQuad[0].x - wallQuad[3].x, 2) +
    Math.pow(wallQuad[0].y - wallQuad[3].y, 2)
  );
  var rightEdge = Math.sqrt(
    Math.pow(wallQuad[1].x - wallQuad[2].x, 2) +
    Math.pow(wallQuad[1].y - wallQuad[2].y, 2)
  );
  var avgH = (leftEdge + rightEdge) / 2;
  var avgW = (topEdge + bottomEdge) / 2;
  var aspectRatio = avgW > 0 ? avgH / avgW : 1.0;
  aspectRatio = Math.max(0.5, Math.min(3.0, aspectRatio));

  // 6. 转角类型（叉积）
  var v1x = BR.x - BL.x;
  var v1y = BR.y - BL.y;
  var v2x = topMarker.x - BR.x;
  var v2y = topMarker.y - BR.y;
  var cross = v1x * v2y - v1y * v2x;
  var cornerType = cross > 0 ? 'left' : 'right';

  // 7. 地板四边形（初始用默认进深比，调用方后续可重新估算）
  var floorQuad = null;
  try {
    floorQuad = perspective.estimateFloorQuad(
      wallQuad, photoW, photoH,
      0.6,  // 默认进深 0.6m
      3.0   // 默认宽度 3m (宽高比后续修正)
    );
  } catch (e) {
    floorQuad = null;
  }

  return {
    wallQuad: wallQuad,
    floorQuad: floorQuad,
    aspectRatio: aspectRatio,
    cornerType: cornerType
  };
}

// ---- 纹理提取 ----

function extractWallTexture(ctx, img, wallQuad, outW, outH) {
  // wallQuad order: BL, BR, TR, TL (matches warpPerspective srcQuad order)
  var ok = perspective.warpPerspective(ctx, img, wallQuad, outW, outH);
  if (!ok) {
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, 0, outW, outH);
  }
  return ok;
}

function extractFloorTexture(ctx, img, floorQuad, outW, outH) {
  if (!floorQuad || floorQuad.length < 4) {
    ctx.fillStyle = '#3a3530';
    ctx.fillRect(0, 0, outW, outH);
    return false;
  }
  // floorQuad from estimateFloorQuad is [BL, BR, TR, TL]
  var ok = perspective.warpPerspective(ctx, img, floorQuad, outW, outH);
  if (!ok) {
    ctx.fillStyle = '#3a3530';
    ctx.fillRect(0, 0, outW, outH);
  }
  return ok;
}

// ---- 侧墙颜色采样 ----

function sampleSideColor(wallQuad, img) {
  // 从墙面四边形的左右边缘采样2px宽列，取平均颜色
  var result = { left: '#d4c8b8', right: '#d4c8b8' };

  try {
    // 创建临时离屏canvas
    var tmpCanvas = wx.createOffscreenCanvas
      ? wx.createOffscreenCanvas({ type: '2d', width: img.width, height: img.height })
      : null;
    if (!tmpCanvas) return result;

    var tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.drawImage(img, 0, 0);

    // 左边缘：wallQuad[0](BL) 到 wallQuad[3](TL)
    result.left = _sampleEdge(tmpCtx, wallQuad[0], wallQuad[3], img.width, img.height);
    // 右边缘：wallQuad[1](BR) 到 wallQuad[2](TR)
    result.right = _sampleEdge(tmpCtx, wallQuad[1], wallQuad[2], img.width, img.height);
  } catch (e) {
    // 采样失败，使用默认暖灰色
  }

  return result;
}

function _sampleEdge(ctx, bottomPt, topPt, maxW, maxH) {
  var steps = 20;
  var r = 0, g = 0, b = 0, count = 0;

  for (var i = 0; i <= steps; i++) {
    var t = i / steps;
    var sx = Math.round(bottomPt.x + (topPt.x - bottomPt.x) * t);
    var sy = Math.round(bottomPt.y + (topPt.y - bottomPt.y) * t);
    sx = Math.max(1, Math.min(maxW - 2, sx));
    sy = Math.max(1, Math.min(maxH - 2, sy));

    // 采样2px宽的列
    for (var dx = -1; dx <= 1; dx++) {
      try {
        var pixel = ctx.getImageData(sx + dx, sy, 1, 1);
        r += pixel.data[0];
        g += pixel.data[1];
        b += pixel.data[2];
        count++;
      } catch (e) {
        // 越界跳过
      }
    }
  }

  if (count === 0) return '#d4c8b8';

  r = Math.round(r / count);
  g = Math.round(g / count);
  b = Math.round(b / count);

  return '#' + [r, g, b].map(function(c) {
    var hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

module.exports = {
  computeGeometry: computeGeometry,
  extractWallTexture: extractWallTexture,
  extractFloorTexture: extractFloorTexture,
  sampleSideColor: sampleSideColor
};
```

Note: `wx.createOffscreenCanvas` may not be available in all WeChat versions. If it fails, `sampleSideColor` falls back to default gray `#d4c8b8`. The function is non-critical — 3D scene uses solid side wall colors when sampling fails.

---

### Task 2: Create `utils/roomScene.js`

**Files:**
- Create: `utils/roomScene.js`

- [ ] **Step 1: Write the complete module**

```js
/**
 * 增强型 3D 房间场景管理器
 *
 * 相比 threeScene.js 的增强:
 *   - 地板支持照片纹理（可选）
 *   - 侧墙使用照片边缘采样的真实颜色
 *   - PBR 材质 (MeshStandardMaterial + roughness/metalness)
 *   - 半球光 (HemisphereLight) 模拟天空/地面自然光
 *   - updateRoomDepth / updateWallSize 动态调整
 *
 * 使用方式:
 *   var THREE = require('threejs-miniprogram').createScopedThreejs(canvas);
 *   var mgr = require('roomScene').createSceneManager(canvas, THREE);
 *   mgr.init({ wallWidth, wallHeight, roomDepth, cornerType,
 *              wallTexture, floorTexture, sideColors, modules });
 *   mgr.animate();
 */

var CABINET_HEIGHT_M = 2.30;
var CABINET_DEPTH_M = 0.60;

function createSceneManager(canvas, THREE) {

  var scene, camera, renderer;
  var roomGroup, cabinetGroup;
  var wallWidthM, wallHeightM, roomDepthM;
  var cornerType;
  var backWallMesh;
  var modules = [];
  var selectedIndex = -1;
  var highlightMesh = null;

  // Textures / colors from init
  var _wallTexCanvas, _floorTexCanvas, _sideColors;

  // 轨道状态
  var theta = 0;
  var phi = 0.01;
  var radius = 4;
  var target = { x: 0, y: 1.25, z: 0 };

  // 触摸状态
  var touchStart = null;
  var touchStartDist = 0;
  var touchMoved = false;
  var _canvas = canvas;

  // ---- 初始化 ----

  function init(config) {
    wallWidthM = config.wallWidth;
    wallHeightM = config.wallHeight;
    roomDepthM = config.roomDepth || Math.max(wallWidthM * 0.5, 0.6);
    cornerType = config.cornerType || 'none';
    modules = config.modules || [];
    selectedIndex = -1;
    _wallTexCanvas = config.wallTexture || null;
    _floorTexCanvas = config.floorTexture || null;
    _sideColors = config.sideColors || { left: '#d4c8b8', right: '#d4c8b8' };

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: _canvas,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(2);
    renderer.setSize(_canvas.width, _canvas.height, false);
    renderer.shadowMap.enabled = false;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // Camera — 正视（正面观看墙面）
    camera = new THREE.PerspectiveCamera(45, _canvas.width / Math.max(_canvas.height, 1), 0.1, 100);
    radius = Math.max(wallWidthM, wallHeightM) * 1.2;
    target.x = 0;
    target.y = wallHeightM / 2;
    target.z = roomDepthM / 2;
    _updateCamera();

    // Lights — 增强光照
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.3));

    var keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
    keyLight.position.set(wallWidthM / 2 + 1, wallHeightM + 1, -1);
    scene.add(keyLight);

    var fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
    fillLight.position.set(-wallWidthM / 2 - 1, wallHeightM * 0.6, roomDepthM + 1);
    scene.add(fillLight);

    // Room group
    roomGroup = new THREE.Group();
    scene.add(roomGroup);

    _buildRoom();

    // Cabinet group
    cabinetGroup = new THREE.Group();
    scene.add(cabinetGroup);

    _rebuildCabinets();
    renderer.render(scene, camera);
  }

  // ---- 构建房间 ----

  function _buildRoom() {
    var halfW = wallWidthM / 2;

    // 1. 背墙（照片纹理）
    var backGeo = new THREE.PlaneGeometry(wallWidthM, wallHeightM);
    var backMat;
    if (_wallTexCanvas) {
      var texture = new THREE.CanvasTexture(_wallTexCanvas);
      texture.needsUpdate = true;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      backMat = new THREE.MeshStandardMaterial({ map: texture, side: THREE.FrontSide, roughness: 0.9 });
    } else {
      backMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 });
    }
    backWallMesh = new THREE.Mesh(backGeo, backMat);
    backWallMesh.rotation.y = Math.PI;
    backWallMesh.position.set(0, wallHeightM / 2, 0);
    backWallMesh.name = 'backWall';
    roomGroup.add(backWallMesh);

    // 2. 左侧墙（照片边缘采样色）
    if (cornerType !== 'left' && cornerType !== 'both') {
      _addSideWall(-halfW, _sideColors.left);
    }

    // 3. 右侧墙
    if (cornerType !== 'right' && cornerType !== 'both') {
      _addSideWall(halfW, _sideColors.right);
    }

    // 4. 地板（照片纹理或纯色）
    _addFloor();

    // 5. 天花板
    var ceilGeo = new THREE.PlaneGeometry(wallWidthM, roomDepthM);
    var ceilMat = new THREE.MeshStandardMaterial({ color: 0xf0ece6, roughness: 0.8, side: THREE.DoubleSide });
    var ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(0, wallHeightM, roomDepthM / 2);
    roomGroup.add(ceilMesh);

    // 6. 转角墙
    if (cornerType === 'left') {
      _addCornerWall(-halfW, 'left', _sideColors.left);
    } else if (cornerType === 'right') {
      _addCornerWall(halfW, 'right', _sideColors.right);
    } else if (cornerType === 'both') {
      _addCornerWall(-halfW, 'left', _sideColors.left);
      _addCornerWall(halfW, 'right', _sideColors.right);
    }
  }

  function _addSideWall(xEdge, hexColor) {
    var geo = new THREE.PlaneGeometry(roomDepthM, wallHeightM);
    var color = _parseHex(hexColor);
    var mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.75, metalness: 0.02, side: THREE.FrontSide });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = (xEdge < 0) ? Math.PI / 2 : -Math.PI / 2;
    mesh.position.set(xEdge, wallHeightM / 2, roomDepthM / 2);
    roomGroup.add(mesh);
  }

  function _addFloor() {
    var floorGeo = new THREE.PlaneGeometry(wallWidthM, roomDepthM);
    var floorMat;
    if (_floorTexCanvas) {
      var tex = new THREE.CanvasTexture(_floorTexCanvas);
      tex.needsUpdate = true;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide });
    } else {
      floorMat = new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.85, side: THREE.DoubleSide });
    }
    var floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, -0.01, roomDepthM / 2);
    floorMesh.name = 'floor';
    roomGroup.add(floorMesh);
  }

  function _addCornerWall(xEdge, side, hexColor) {
    var cornerDepth = Math.min(roomDepthM, 2.0);
    var geo = new THREE.PlaneGeometry(cornerDepth, wallHeightM);
    var color = _parseHex(hexColor);
    var mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.75, metalness: 0.02 });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = (side === 'left') ? 0 : Math.PI;
    mesh.position.set(
      xEdge + ((side === 'left') ? -cornerDepth / 2 : cornerDepth / 2),
      wallHeightM / 2,
      cornerDepth / 2
    );
    roomGroup.add(mesh);
  }

  function _parseHex(hex) {
    var h = hex.replace('#', '');
    return parseInt(h, 16);
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

  // ---- 重建房间（updateDepth/WallSize 调用） ----

  function _rebuildRoom() {
    while (roomGroup.children.length > 0) {
      var child = roomGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
      roomGroup.remove(child);
    }
    _buildRoom();
    backWallMesh = null;
    // 重新获取 backWallMesh 引用
    for (var i = 0; i < roomGroup.children.length; i++) {
      if (roomGroup.children[i].name === 'backWall') {
        backWallMesh = roomGroup.children[i];
        break;
      }
    }
  }

  // ---- 柜子 mesh 管理 (复用 threeScene 模式) ----

  function _rebuildCabinets() {
    while (cabinetGroup.children.length > 0) {
      var child = cabinetGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(function(m) { m.dispose(); });
        } else {
          child.material.dispose();
        }
      }
      cabinetGroup.remove(child);
    }
    if (highlightMesh) {
      cabinetGroup.remove(highlightMesh);
      if (highlightMesh.geometry) highlightMesh.geometry.dispose();
      if (highlightMesh.material) highlightMesh.material.dispose();
      highlightMesh = null;
    }

    if (modules.length === 0) {
      renderer.render(scene, camera);
      return;
    }

    var halfW = wallWidthM / 2;
    var cumulativeX = -halfW;

    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      var wM = m.width / 100;
      var x = cumulativeX + wM / 2;
      cumulativeX += wM;

      var geo = new THREE.BoxGeometry(wM, CABINET_HEIGHT_M, CABINET_DEPTH_M);
      var colorHex = (m.color === 'cream') ? 0xfff5d7 : 0xf5f5f5;
      var mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.45,
        metalness: 0.05
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, CABINET_HEIGHT_M / 2, CABINET_DEPTH_M / 2 + 0.005);
      mesh.userData = { moduleIndex: i, widthCm: m.width, type: m.type, color: m.color };
      cabinetGroup.add(mesh);
    }

    if (selectedIndex >= 0 && selectedIndex < modules.length) {
      _addHighlight(selectedIndex);
    }

    renderer.render(scene, camera);
  }

  function _addHighlight(index) {
    if (highlightMesh) {
      cabinetGroup.remove(highlightMesh);
      if (highlightMesh.geometry) highlightMesh.geometry.dispose();
      if (highlightMesh.material) highlightMesh.material.dispose();
      highlightMesh = null;
    }

    var m = modules[index];
    var halfW = wallWidthM / 2;
    var cumulativeX = -halfW;
    for (var i = 0; i < index; i++) cumulativeX += modules[i].width / 100;
    var wM = m.width / 100;
    var x = cumulativeX + wM / 2;

    var hlGeo = new THREE.BoxGeometry(wM + 0.03, CABINET_HEIGHT_M + 0.03, CABINET_DEPTH_M + 0.03);
    var hlMat = new THREE.MeshBasicMaterial({
      color: 0xFC9700,
      transparent: true,
      opacity: 0.3,
      depthTest: true,
      depthWrite: false
    });
    highlightMesh = new THREE.Mesh(hlGeo, hlMat);
    highlightMesh.position.set(x, CABINET_HEIGHT_M / 2, CABINET_DEPTH_M / 2 + 0.007);
    cabinetGroup.add(highlightMesh);
    renderer.render(scene, camera);
  }

  // ---- 射线检测 ----

  function hitTest(tapX, tapY) {
    if (!camera) return null;

    var mouse = {};
    mouse.x = (tapX / _canvas.width) * 2 - 1;
    mouse.y = -(tapY / _canvas.height) * 2 + 1;

    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Check cabinet children
    var cabChildren = cabinetGroup.children.slice();
    var intersects = raycaster.intersectObjects(cabChildren, false);

    if (intersects.length > 0) {
      var obj = intersects[0].object;
      if (obj.userData && obj.userData.moduleIndex !== undefined) {
        return {
          hitType: 'cabinet',
          moduleIndex: obj.userData.moduleIndex,
          point: intersects[0].point
        };
      }
    }

    // Check for the backWallMesh in the room group
    var wallMesh = null;
    if (roomGroup) {
      for (var i = 0; i < roomGroup.children.length; i++) {
        if (roomGroup.children[i].name === 'backWall') {
          wallMesh = roomGroup.children[i];
          break;
        }
      }
    }
    if (wallMesh) {
      var wallIntersects = raycaster.intersectObject(wallMesh, false);
      if (wallIntersects.length > 0) {
        var pt = wallIntersects[0].point;
        var halfW = wallWidthM / 2;
        var posCm = (pt.x + halfW) * 100;

        var accCm = 0;
        var hitIdx = -1;
        for (var j = 0; j < modules.length; j++) {
          var mEnd = accCm + modules[j].width;
          if (posCm >= accCm - 3 && posCm <= mEnd + 3) {
            hitIdx = j;
            break;
          }
          accCm = mEnd;
        }

        return { hitType: 'wall', posCm: posCm, moduleIndex: hitIdx };
      }
    }

    return null;
  }

  // ---- 触摸 / 轨道控制 ----

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
      var ratio = touchStartDist / Math.max(newDist, 1);
      radius *= ratio;
      radius = Math.max(1.5, Math.min(20, radius));
      touchStartDist = newDist;
      touchMoved = true;
    } else if (touches.length === 1) {
      var dx = touches[0].x - touchStart.x;
      var dy = touches[0].y - touchStart.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) touchMoved = true;
      theta -= dx * 0.008;
      phi += dy * 0.008;
      phi = Math.max(0.01, Math.min(Math.PI / 2 - 0.05, phi));
    }

    if (touchMoved) {
      _updateCamera();
      renderer.render(scene, camera);
    }

    if (touches.length === 1) {
      touchStart.x = touches[0].x;
      touchStart.y = touches[0].y;
    }
  }

  function handleTouchEnd(touches) {
    var wasTap = !touchMoved;
    touchStart = null;
    touchStartDist = 0;
    touchMoved = false;
    return wasTap;
  }

  // ---- 公开方法 ----

  function resetCamera() {
    theta = 0;
    phi = 0.01;
    radius = Math.max(wallWidthM, wallHeightM) * 1.2;
    target.x = 0;
    target.y = wallHeightM / 2;
    target.z = roomDepthM / 2;
    _updateCamera();
    renderer.render(scene, camera);
  }

  function updateRoomDepth(newDepthM) {
    roomDepthM = newDepthM;
    target.z = roomDepthM / 2;
    _rebuildRoom();
    _rebuildCabinets();
    _updateCamera();
    renderer.render(scene, camera);
  }

  function updateWallSize(wM, hM) {
    wallWidthM = wM;
    wallHeightM = hM;
    target.y = wallHeightM / 2;
    radius = Math.max(wallWidthM, wallHeightM) * 1.2;
    _rebuildRoom();
    _rebuildCabinets();
    _updateCamera();
    renderer.render(scene, camera);
  }

  function refreshCabinets(newModules) {
    modules = newModules || [];
    _rebuildCabinets();
  }

  function highlightCabinet(index) {
    selectedIndex = index;
    _addHighlight(index);
  }

  function clearHighlight() {
    selectedIndex = -1;
    if (highlightMesh) {
      cabinetGroup.remove(highlightMesh);
      if (highlightMesh.geometry) highlightMesh.geometry.dispose();
      if (highlightMesh.material) highlightMesh.material.dispose();
      highlightMesh = null;
    }
    renderer.render(scene, camera);
  }

  function animate() {
    _canvas.requestAnimationFrame(animate);
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  function dispose() {
    function cleanGroup(g) {
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
    cleanGroup(cabinetGroup);
    cleanGroup(roomGroup);
    if (renderer) renderer.dispose();
    scene = null; camera = null; renderer = null;
    roomGroup = null; cabinetGroup = null; backWallMesh = null;
    modules = []; selectedIndex = -1;
  }

  return {
    init: init, dispose: dispose,
    refreshCabinets: refreshCabinets,
    highlightCabinet: highlightCabinet,
    clearHighlight: clearHighlight,
    hitTest: hitTest,
    resetCamera: resetCamera,
    updateRoomDepth: updateRoomDepth,
    updateWallSize: updateWallSize,
    handleTouchStart: handleTouchStart,
    handleTouchMove: handleTouchMove,
    handleTouchEnd: handleTouchEnd,
    animate: animate,
    getModules: function() { return modules; }
  };
}

module.exports = { createSceneManager: createSceneManager };
```

---

### Task 3: Create `pages/knowledge/photo/photo.wxss`

**Files:**
- Create: `pages/knowledge/photo/photo.wxss`

- [ ] **Step 1: Write the stylesheet**

```css
/* pages/knowledge/photo/photo.wxss */

.page {
  width: 100vw;
  height: 100vh;
  background: #1a1a1a;
  overflow: hidden;
}

/* Custom nav */
.custom-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(26, 26, 26, 0.95);
  backdrop-filter: blur(10px);
}
.nav-bar {
  display: flex;
  align-items: center;
  padding: 0 16rpx;
}
.nav-back {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-back-icon {
  font-size: 48rpx;
  color: #ccc;
  line-height: 1;
}
.nav-title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  color: #fff;
  font-weight: 500;
}

/* Stage: capture */
.capture-stage {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 88px;
}
.capture-hint {
  color: #aaa;
  font-size: 28rpx;
  margin-bottom: 40rpx;
}
.capture-photo-wrap {
  width: 90vw;
  height: 60vh;
  background: #222;
  border-radius: 16rpx;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.capture-photo {
  width: 100%;
  height: 100%;
}
.capture-placeholder {
  color: #666;
  font-size: 32rpx;
  text-align: center;
  line-height: 1.6;
}
.capture-placeholder-icon {
  font-size: 80rpx;
  display: block;
  margin-bottom: 16rpx;
}
.capture-actions {
  display: flex;
  gap: 24rpx;
  margin-top: 40rpx;
}
.capture-btn {
  padding: 20rpx 48rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
}
.capture-btn-primary {
  background: #FC9700;
  color: #fff;
}
.capture-btn-outline {
  border: 2rpx solid rgba(255,255,255,0.3);
  color: #ccc;
}

/* Stage: marking */
.marking-stage {
  position: fixed;
  top: 88px;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
}
.marker-hint {
  padding: 16rpx 32rpx;
  background: rgba(252, 151, 0, 0.15);
}
.marker-hint-text {
  font-size: 24rpx;
  color: #FC9700;
  text-align: center;
  display: block;
}
.photo-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}
.photo-image {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0; left: 0;
}
.markers-layer {
  position: absolute;
  top: 0; left: 0;
  right: 0; bottom: 0;
}
.marker {
  position: absolute;
  width: 40rpx;
  height: 40rpx;
  margin-left: -20rpx;
  margin-top: -20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.marker-dragging {
  z-index: 20;
}
.marker-dot {
  font-size: 36rpx;
  color: #FC9700;
  text-shadow: 0 0 8rpx rgba(0,0,0,0.6);
}
.marker-label {
  position: absolute;
  top: -28rpx;
  font-size: 20rpx;
  color: #fff;
  background: rgba(0,0,0,0.7);
  padding: 2rpx 8rpx;
  border-radius: 8rpx;
}
.marking-actions {
  display: flex;
  gap: 24rpx;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

/* Stage: estimate */
.estimate-stage {
  position: fixed;
  top: 88px;
  left: 0;
  right: 0;
  bottom: 0;
  overflow-y: auto;
  padding: 24rpx 32rpx;
}
.estimate-section {
  margin-bottom: 24rpx;
}
.estimate-section-title {
  font-size: 26rpx;
  color: #999;
  margin-bottom: 12rpx;
}
.estimate-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}
.estimate-label {
  width: 140rpx;
  font-size: 28rpx;
  color: #ccc;
  flex-shrink: 0;
}
.estimate-input {
  flex: 1;
  height: 64rpx;
  background: rgba(255,255,255,0.08);
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: #fff;
  text-align: right;
}
.estimate-unit {
  width: 50rpx;
  text-align: center;
  font-size: 24rpx;
  color: #888;
  flex-shrink: 0;
}
.estimate-slider {
  flex: 1;
  margin: 0 16rpx;
}
.estimate-slider-value {
  width: 80rpx;
  text-align: right;
  font-size: 24rpx;
  color: #FC9700;
  flex-shrink: 0;
}

/* Corner type tags */
.corner-tags {
  display: flex;
  gap: 16rpx;
}
.corner-tag {
  padding: 12rpx 24rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
  color: #999;
  background: rgba(255,255,255,0.06);
  border: 2rpx solid transparent;
}
.corner-tag-active {
  color: #FC9700;
  background: rgba(252, 151, 0, 0.15);
  border-color: #FC9700;
}

/* Top view */
.topview-section {
  margin-bottom: 24rpx;
}
.topview-canvas-wrap {
  width: 100%;
  height: 240rpx;
  background: rgba(255,255,255,0.04);
  border-radius: 12rpx;
  overflow: hidden;
}
.topview-canvas {
  width: 100%;
  height: 100%;
}

.estimate-actions {
  display: flex;
  gap: 24rpx;
  padding: 16rpx 0;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

/* Shared action buttons */
.space-btn {
  flex: 1;
  padding: 24rpx 0;
  border-radius: 40rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 500;
}
.space-btn-primary {
  background: #FC9700;
  color: #fff;
}
.space-btn-outline {
  border: 2rpx solid rgba(255,255,255,0.3);
  color: #ccc;
  background: transparent;
}
.space-btn-disabled {
  opacity: 0.4;
}

/* Stage: scene (3D) */
.scene-stage {
  position: fixed;
  top: 88px;
  left: 0;
  right: 0;
  bottom: 0;
}
.scene-canvas {
  width: 100%;
  height: 100%;
}

/* Scene top bar */
.scene-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 12rpx 16rpx;
  background: rgba(26,26,26,0.85);
  backdrop-filter: blur(10px);
  z-index: 10;
}
.scene-back-btn {
  color: #FC9700;
  font-size: 28rpx;
  padding: 8rpx 12rpx;
}
.scene-hint {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  color: #ccc;
}
.scene-hint-selected {
  color: #FC9700;
}
.scene-action-btn {
  color: #aaa;
  font-size: 24rpx;
  padding: 8rpx 16rpx;
}

/* Bottom panel (reused from glbviewer) */
.scene-bottom-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(26,26,26,0.92);
  backdrop-filter: blur(10px);
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  z-index: 10;
}
.selector-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}
.selector-label {
  width: 70rpx;
  font-size: 24rpx;
  color: #999;
  flex-shrink: 0;
}
.selector-tag {
  padding: 10rpx 20rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
  color: #999;
  background: rgba(255,255,255,0.06);
  border: 2rpx solid transparent;
}
.selector-tag-active {
  color: #FC9700;
  background: rgba(252, 151, 0, 0.15);
  border-color: #FC9700;
}
.module-preview-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}
.module-preview-scroll {
  flex: 1;
  white-space: nowrap;
}
.module-preview-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  margin-right: 12rpx;
  padding: 8rpx;
  border-radius: 12rpx;
  border: 2rpx solid transparent;
}
.module-preview-active {
  border-color: #FC9700;
  background: rgba(252, 151, 0, 0.1);
}
.module-preview-img {
  width: 80rpx;
  height: 80rpx;
}
.module-preview-label {
  font-size: 20rpx;
  color: #ccc;
  margin-top: 4rpx;
}
.scene-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 12rpx;
}
```

---

### Task 4: Create `pages/knowledge/photo/photo.wxml`

**Files:**
- Create: `pages/knowledge/photo/photo.wxml`

- [ ] **Step 1: Write the template**

```html
<!--pages/knowledge/photo/photo.wxml-->
<view class="page">

  <!-- 自定义导航栏 -->
  <view class="custom-nav" style="padding-top: {{statusBarHeight}}px;">
    <view class="nav-bar" style="height: {{navBarHeight}}px;">
      <view class="nav-back" bindtap="goBack">
        <text class="nav-back-icon">‹</text>
      </view>
      <text class="nav-title">拍照解析空间</text>
    </view>
  </view>

  <!-- ===== Stage: capture ===== -->
  <view class="capture-stage" wx:if="{{stage === 'capture'}}">
    <view class="capture-photo-wrap" wx:if="{{photoPath}}">
      <image class="capture-photo" src="{{photoPath}}" mode="aspectFit" bindload="onPhotoLoad" />
    </view>
    <view class="capture-photo-wrap" wx:else>
      <view class="capture-placeholder">
        <text class="capture-placeholder-icon">📷</text>
        <text>拍摄或选择一张墙面照片</text>
      </view>
    </view>
    <view class="capture-actions">
      <view class="capture-btn capture-btn-primary" bindtap="takePhoto">
        <text>{{photoPath ? '重选照片' : '拍照 / 选图'}}</text>
      </view>
      <view class="capture-btn capture-btn-outline" wx:if="{{photoPath}}" bindtap="confirmPhoto">
        <text>确认照片 →</text>
      </view>
    </view>
  </view>

  <!-- ===== Stage: marking ===== -->
  <view class="marking-stage" wx:if="{{stage === 'marking'}}">
    <view class="marker-hint">
      <text class="marker-hint-text">请标记3个墙角：地面左 → 地面右 → 顶部</text>
    </view>
    <view class="photo-area">
      <image class="photo-image"
             wx:if="{{photoPath}}"
             src="{{photoPath}}"
             mode="aspectFit"
             style="width: 100%; height: 100%;" />
      <view class="markers-layer" bindtap="onMarkingTap">
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
    <view class="marking-actions">
      <view class="space-btn space-btn-outline" bindtap="resetMarkers" wx:if="{{markers.length > 0}}">
        <text>清除标记</text>
      </view>
      <view class="space-btn space-btn-primary {{markers.length !== 3 ? 'space-btn-disabled' : ''}}"
            bindtap="confirmMarkers" wx:if="{{markers.length === 3}}">
        <text>确认空间 →</text>
      </view>
    </view>
  </view>

  <!-- ===== Stage: estimate ===== -->
  <view class="estimate-stage" wx:if="{{stage === 'estimate'}}">
    <view class="estimate-section">
      <view class="estimate-section-title">墙面尺寸</view>
      <view class="estimate-row">
        <text class="estimate-label">墙宽</text>
        <slider class="estimate-slider"
                min="44" max="1000" step="1"
                value="{{wallWidth}}"
                bindchange="onWallWidthChange"
                activeColor="#FC9700"
                backgroundColor="rgba(255,255,255,0.1)" />
        <text class="estimate-slider-value">{{wallWidth}}cm</text>
      </view>
      <view class="estimate-row">
        <text class="estimate-label">墙高</text>
        <slider class="estimate-slider"
                min="232" max="400" step="1"
                value="{{wallHeight}}"
                bindchange="onWallHeightChange"
                activeColor="#FC9700"
                backgroundColor="rgba(255,255,255,0.1)" />
        <text class="estimate-slider-value">{{wallHeight}}cm</text>
      </view>
      <view class="estimate-row">
        <text class="estimate-label">进深</text>
        <slider class="estimate-slider"
                min="40" max="150" step="1"
                value="{{roomDepth}}"
                bindchange="onRoomDepthChange"
                activeColor="#FC9700"
                backgroundColor="rgba(255,255,255,0.1)" />
        <text class="estimate-slider-value">{{roomDepth}}cm</text>
      </view>
    </view>

    <view class="estimate-section">
      <view class="estimate-section-title">转角类型</view>
      <view class="corner-tags">
        <view class="corner-tag {{cornerType === 'none' ? 'corner-tag-active' : ''}}"
              bindtap="onCornerTypeChange" data-type="none">无</view>
        <view class="corner-tag {{cornerType === 'left' ? 'corner-tag-active' : ''}}"
              bindtap="onCornerTypeChange" data-type="left">左</view>
        <view class="corner-tag {{cornerType === 'right' ? 'corner-tag-active' : ''}}"
              bindtap="onCornerTypeChange" data-type="right">右</view>
        <view class="corner-tag {{cornerType === 'both' ? 'corner-tag-active' : ''}}"
              bindtap="onCornerTypeChange" data-type="both">双侧</view>
      </view>
    </view>

    <view class="estimate-section" wx:if="{{markers.length >= 3}}">
      <view class="estimate-section-title">俯视轮廓预览</view>
      <view class="topview-canvas-wrap">
        <canvas class="topview-canvas" canvas-id="topviewCanvas"
                style="width: 100%; height: 240rpx;"></canvas>
      </view>
    </view>

    <view class="estimate-actions">
      <view class="space-btn space-btn-outline" bindtap="goBackToMarking">
        <text>返回标记</text>
      </view>
      <view class="space-btn space-btn-primary" bindtap="enterScene">
        <text>进入3D场景 →</text>
      </view>
    </view>
  </view>

  <!-- ===== Stage: scene (3D) ===== -->
  <view class="scene-stage" wx:if="{{stage === 'scene'}}">
    <canvas type="webgl" id="room3dCanvas" class="scene-canvas"
            bindtouchstart="onSceneTouch"
            bindtouchmove="onSceneTouch"
            bindtouchend="onSceneTouch">
    </canvas>

    <!-- 顶部栏 -->
    <view class="scene-top-bar">
      <view class="scene-back-btn" bindtap="goBackToEstimate">
        <text>‹ 返回调整</text>
      </view>
      <text class="scene-hint" wx:if="{{selectedModuleIndex < 0}}">点击墙面添加柜子</text>
      <text class="scene-hint scene-hint-selected" wx:else>
        已选: {{layoutModules[selectedModuleIndex].width}}cm {{layoutModules[selectedModuleIndex].type.toUpperCase()}}型
      </text>
      <view class="scene-action-btn" bindtap="resetCamera3d">
        <text>⟳ 正视</text>
      </view>
    </view>

    <!-- 底部控制面板 -->
    <view class="scene-bottom-panel">
      <view class="selector-row">
        <text class="selector-label">宽度</text>
        <view class="selector-tag {{selectedWidth === 50 && !isCustomModule ? 'selector-tag-active' : ''}}"
              bindtap="onSelectWidth" data-width="50">50</view>
        <view class="selector-tag {{selectedWidth === 100 && !isCustomModule ? 'selector-tag-active' : ''}}"
              bindtap="onSelectWidth" data-width="100">100</view>
        <view class="selector-tag {{isCustomModule ? 'selector-tag-active' : ''}}"
              bindtap="onSelectWidth" data-width="custom">非标</view>
      </view>

      <view class="module-preview-row">
        <text class="selector-label">类型</text>
        <scroll-view class="module-preview-scroll" scroll-x="true" enhanced="{{true}}" show-scrollbar="{{false}}">
          <block wx:for="{{isCustomModule ? availableModulesCustom : availableModules}}" wx:key="type">
            <view class="module-preview-item {{selectedType === item.type ? 'module-preview-active' : ''}}"
                  bindtap="onSelectType" data-type="{{item.type}}">
              <image class="module-preview-img" wx:if="{{item.image}}" src="{{item.image}}" mode="aspectFit" />
              <text class="module-preview-label">{{item.label}}</text>
            </view>
          </block>
        </scroll-view>
      </view>

      <view class="selector-row">
        <text class="selector-label">颜色</text>
        <view class="selector-tag {{selectedColor === 'white' ? 'selector-tag-active' : ''}}"
              bindtap="onSelectColor" data-color="white">白</view>
        <view class="selector-tag {{selectedColor === 'cream' ? 'selector-tag-active' : ''}}"
              bindtap="onSelectColor" data-color="cream">奶油</view>
      </view>

      <view class="scene-actions">
        <view class="space-btn space-btn-outline" bindtap="goBackToEstimate">
          <text>返回调整</text>
        </view>
        <view class="space-btn space-btn-primary" bindtap="saveAndCost">
          <text>保存并算价</text>
        </view>
      </view>
    </view>
  </view>

  <!-- 隐藏的纹理预处理 canvas -->
  <canvas type="2d" id="texturePrepCanvas"
          style="position:fixed;left:-9999px;top:-9999px;width:512px;height:512px;">
  </canvas>
  <canvas type="2d" id="floorPrepCanvas"
          style="position:fixed;left:-9999px;top:-9999px;width:512px;height:256px;">
  </canvas>

</view>
```

---

### Task 5: Create `pages/knowledge/photo/photo.js`

**Files:**
- Create: `pages/knowledge/photo/photo.js`

- [ ] **Step 1: Write the page logic**

```js
var app = getApp();
var layoutCompute = require('../../../utils/layoutCompute.js');
var assets = require('../../../utils/assets.js');
var roomReconstructor = require('../../../utils/roomReconstructor.js');

Page({
  _sceneManager: null,
  _THREE: null,
  _sceneRetry: 0,

  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    stage: 'capture',
    photoPath: '',
    photoWidth: 0,
    photoHeight: 0,
    markers: [],
    draggingIndex: -1,

    // Estimate params
    wallWidth: 300,
    wallHeight: 250,
    roomDepth: 60,
    cornerType: 'none',
    _geo: null,

    // Cabinet layout
    layoutModules: [],
    selectedModuleIndex: -1,
    selectedWidth: 50,
    selectedType: 'a',
    selectedColor: 'white',
    isCustomModule: false,
    availableModules: [],
    availableModulesCustom: [],
    customWidth: 0,
    standardWidth: 50
  },

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
  },

  onUnload: function() {
    if (this._sceneManager) {
      try { this._sceneManager.dispose(); } catch (e) {}
      this._sceneManager = null;
      this._THREE = null;
    }
  },

  goBack: function() {
    wx.navigateBack({ delta: 1 });
  },

  // ===== Stage: capture =====

  takePhoto: function() {
    var self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        self.setData({
          photoPath: res.tempFiles[0].tempFilePath,
          markers: [],
          cornerType: 'none'
        });
      }
    });
  },

  onPhotoLoad: function(e) {
    this.setData({
      photoWidth: e.detail.width,
      photoHeight: e.detail.height
    });
  },

  confirmPhoto: function() {
    if (!this.data.photoPath) {
      wx.showToast({ title: '请先选择照片', icon: 'none' });
      return;
    }
    this.setData({ stage: 'marking', markers: [] });
  },

  // ===== Stage: marking =====

  onMarkingTap: function(e) {
    var markers = this.data.markers.slice();
    var x = e.detail.x;
    var y = e.detail.y;

    var self = this;
    var query = wx.createSelectorQuery().in(this);
    query.select('.markers-layer').boundingClientRect(function(rect) {
      if (!rect) return;
      var rx = (x - rect.left) / rect.width;
      var ry = (y - rect.top) / rect.height;

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
        wx.showModal({
          title: '删除标记',
          content: '确定要删除标记点 ' + (hitIndex + 1) + ' 吗？',
          success: function(modalRes) {
            if (modalRes.confirm) {
              markers.splice(hitIndex, 1);
              self.setData({ markers: markers, draggingIndex: -1 });
              self._drawTopView();
            }
          }
        });
      } else if (markers.length >= 3) {
        wx.showToast({ title: '最多标记3个墙角', icon: 'none' });
      } else {
        markers.push({ x: rx, y: ry });
        self.setData({ markers: markers });
        self._drawTopView();
      }
    }).exec();
  },

  onMarkerLongPress: function(e) {
    var index = e.currentTarget.dataset.index;
    wx.vibrateShort({ type: 'light' });
    this.setData({ draggingIndex: index });
  },

  onMarkerDrag: function(e) {
    var index = this.data.draggingIndex;
    if (index < 0) return;

    var touch = e.touches[0];
    var self = this;
    var query = wx.createSelectorQuery().in(this);
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

  onMarkerDragEnd: function() {
    this.setData({ draggingIndex: -1 });
    this._drawTopView();
  },

  resetMarkers: function() {
    this.setData({ markers: [], cornerType: 'none' });
  },

  confirmMarkers: function() {
    if (this.data.markers.length !== 3) return;

    var geo = roomReconstructor.computeGeometry(
      this.data.markers,
      this.data.photoWidth || 1,
      this.data.photoHeight || 1
    );

    // 从宽高比估算默认尺寸
    var defaultWidth = 300; // cm
    var defaultHeight = Math.round(defaultWidth / geo.aspectRatio);
    defaultHeight = Math.max(232, Math.min(400, defaultHeight));
    var defaultDepth = Math.round(defaultWidth * 0.4);
    defaultDepth = Math.max(40, Math.min(150, defaultDepth));

    this.setData({
      stage: 'estimate',
      wallWidth: defaultWidth,
      wallHeight: defaultHeight,
      roomDepth: defaultDepth,
      cornerType: geo.cornerType,
      _geo: geo
    });

    var self = this;
    setTimeout(function() { self._drawTopView(); }, 300);
  },

  // ===== Stage: estimate =====

  onWallWidthChange: function(e) {
    this.setData({ wallWidth: e.detail.value });
    this._drawTopView();
  },

  onWallHeightChange: function(e) {
    this.setData({ wallHeight: e.detail.value });
    this._drawTopView();
  },

  onRoomDepthChange: function(e) {
    this.setData({ roomDepth: e.detail.value });
    this._drawTopView();
  },

  onCornerTypeChange: function(e) {
    this.setData({ cornerType: e.currentTarget.dataset.type });
    this._drawTopView();
  },

  goBackToMarking: function() {
    this.setData({ stage: 'marking', _geo: null });
  },

  enterScene: function() {
    var self = this;

    // 准备柜子模块数据
    var wallWidthCm = this.data.wallWidth;
    var cornerType = this.data.cornerType;
    var params = layoutCompute.computeParams(wallWidthCm, cornerType);
    var availStd = layoutCompute.getAvailableModules(50, params.customWidth, false, assets.picture);
    var availCustom = layoutCompute.getAvailableModules(50, params.customWidth, true, assets.picture);

    var firstWidth = wallWidthCm >= 50 ? 50 : (wallWidthCm - 4);
    var firstIsCustom = wallWidthCm < 50;
    var firstModule = { width: firstWidth, type: 'a', color: 'white', isCustom: firstIsCustom };

    self.setData({
      stage: 'scene',
      standardWidth: params.standardWidth,
      customWidth: params.customWidth,
      layoutModules: [firstModule],
      availableModules: availStd,
      availableModulesCustom: availCustom,
      selectedModuleIndex: 0,
      selectedWidth: 50,
      selectedType: 'a',
      selectedColor: 'white',
      isCustomModule: false
    });

    self._sceneRetry = 0;
    setTimeout(function() { self._initScene(); }, 500);
  },

  // ===== Stage: scene =====

  _initScene: function() {
    var self = this;
    var query = wx.createSelectorQuery().in(this);
    query.select('#room3dCanvas')
      .fields({ node: true, size: true })
      .exec(function(res) {
        if (!res || !res[0] || !res[0].node) {
          if ((self._sceneRetry = (self._sceneRetry || 0) + 1) < 5) {
            setTimeout(function() { self._initScene(); }, 300);
          } else {
            wx.showToast({ title: '3D 初始化失败，请重试', icon: 'none' });
            self.setData({ stage: 'estimate' });
          }
          return;
        }
        var canvas = res[0].node;
        canvas.width = res[0].width;
        canvas.height = res[0].height;

        self._prepareTextures(function(wallTex, floorTex, sideColors) {
          try {
            var scopedThree = require('../../../utils/threejs-miniprogram.js').createScopedThreejs(canvas);
            if (!scopedThree || !scopedThree.WebGLRenderer) {
              throw new Error('threejs-miniprogram load failed');
            }
            var mgr = require('../../../utils/roomScene.js').createSceneManager(canvas, scopedThree);
            mgr.init({
              wallWidth: self.data.wallWidth / 100,
              wallHeight: self.data.wallHeight / 100,
              roomDepth: self.data.roomDepth / 100,
              cornerType: self.data.cornerType,
              wallTexture: wallTex,
              floorTexture: floorTex,
              sideColors: sideColors,
              modules: self.data.layoutModules
            });
            self._sceneManager = mgr;
            self._THREE = scopedThree;
            mgr.animate();
          } catch (err) {
            console.error('[roomScene] init error:', err);
            wx.showToast({ title: '3D 引擎启动失败', icon: 'none' });
            self.setData({ stage: 'estimate' });
          }
        });
      });
  },

  _prepareTextures: function(callback) {
    var self = this;
    var geo = self.data._geo;
    if (!geo || !geo.wallQuad) {
      callback(null, null, { left: '#d4c8b8', right: '#d4c8b8' });
      return;
    }

    var query = wx.createSelectorQuery().in(this);
    query.select('#texturePrepCanvas')
      .fields({ node: true, size: true })
      .exec(function(wallRes) {
        var wallCtx = null, wallCanvas = null;
        if (wallRes && wallRes[0] && wallRes[0].node) {
          wallCanvas = wallRes[0].node;
          wallCanvas.width = 512;
          wallCanvas.height = 512;
          wallCtx = wallCanvas.getContext('2d');
        }

        query.select('#floorPrepCanvas')
          .fields({ node: true, size: true })
          .exec(function(floorRes) {
            var floorCtx = null, floorCanvas = null;
            if (floorRes && floorRes[0] && floorRes[0].node) {
              floorCanvas = floorRes[0].node;
              floorCanvas.width = 512;
              floorCanvas.height = 256;
              floorCtx = floorCanvas.getContext('2d');
            }

            var img = (wallCanvas || floorCanvas)
              ? (wallCanvas || floorCanvas).createImage()
              : null;

            if (!img) {
              callback(null, null, { left: '#d4c8b8', right: '#d4c8b8' });
              return;
            }

            img.onload = function() {
              // Extract wall texture
              if (wallCtx) {
                roomReconstructor.extractWallTexture(wallCtx, img, geo.wallQuad, 512, 512);
              }

              // Extract floor texture (re-estimate with actual depth)
              var floorQuad = geo.floorQuad;
              if (floorCtx && floorQuad) {
                roomReconstructor.extractFloorTexture(floorCtx, img, floorQuad, 512, 256);
              }

              // Sample side colors
              var sideColors = roomReconstructor.sampleSideColor(geo.wallQuad, img);

              callback(wallCanvas, floorCtx ? floorCanvas : null, sideColors);
            };
            img.onerror = function() {
              callback(null, null, { left: '#d4c8b8', right: '#d4c8b8' });
            };
            img.src = self.data.photoPath;
          });
      });
  },

  // Scene touch
  onSceneTouch: function(e) {
    var mgr = this._sceneManager;
    if (!mgr) return;

    if (e.type === 'touchstart') {
      this._touchMoved = false;
      mgr.handleTouchStart(e.touches);
    } else if (e.type === 'touchmove') {
      if (e.touches && e.touches.length === 1 && !this._touchMoved) {
        this._touchMoved = true;
      }
      mgr.handleTouchMove(e.touches);
    } else if (e.type === 'touchend') {
      var wasTap = mgr.handleTouchEnd(e.touches);
      if (!this._touchMoved && wasTap && e.changedTouches && e.changedTouches[0]) {
        this._handleSceneTap(e.changedTouches[0]);
      }
    }
  },

  _handleSceneTap: function(touch) {
    var mgr = this._sceneManager;
    if (!mgr) return;

    var result = mgr.hitTest(touch.x, touch.y);
    if (!result) return;

    var self = this;
    var modules = self.data.layoutModules.slice();

    if (result.hitType === 'cabinet') {
      var idx = result.moduleIndex;
      if (idx === self.data.selectedModuleIndex) {
        if (modules.length <= 1) {
          wx.showToast({ title: '至少保留一个模块', icon: 'none' });
          return;
        }
        wx.showModal({
          title: '删除模块',
          content: '确定删除该模块吗？',
          success: function(modalRes) {
            if (modalRes.confirm) {
              var mods = self.data.layoutModules.slice();
              mods.splice(idx, 1);
              self.setData({ layoutModules: mods, selectedModuleIndex: -1 });
              mgr.clearHighlight();
              mgr.refreshCabinets(mods);
            }
          }
        });
        return;
      }
      var m = modules[idx];
      self.setData({
        selectedModuleIndex: idx,
        selectedWidth: m.isCorner ? 50 : m.width,
        selectedType: m.isCorner ? 'a' : (m.type || 'a'),
        selectedColor: m.color || 'white',
        isCustomModule: !!m.isCustom
      });
      mgr.highlightCabinet(idx);
      return;
    }

    // Tap wall: add cabinet
    var newW = self.data.selectedWidth;
    if (!newW) newW = 50;

    var totalW = 0;
    for (var j = 0; j < modules.length; j++) totalW += modules[j].width;
    if ((totalW + newW) * 10 > self.data.wallWidth) {
      wx.showToast({ title: '空间不足', icon: 'none' });
      return;
    }

    var posCm = result.posCm;
    var insertIdx = modules.length;
    var acc = 0;
    for (var k = 0; k < modules.length; k++) {
      if (posCm < acc + modules[k].width / 2) {
        insertIdx = k;
        break;
      }
      acc += modules[k].width;
    }

    modules.splice(insertIdx, 0, {
      width: newW,
      type: self.data.selectedType,
      color: self.data.selectedColor,
      isCustom: self.data.isCustomModule
    });

    self.setData({ layoutModules: modules, selectedModuleIndex: insertIdx });
    mgr.refreshCabinets(modules);
    mgr.highlightCabinet(insertIdx);
  },

  resetCamera3d: function() {
    if (this._sceneManager) {
      this._sceneManager.resetCamera();
    }
  },

  goBackToEstimate: function() {
    if (this._sceneManager) {
      try { this._sceneManager.dispose(); } catch (e) {}
      this._sceneManager = null;
      this._THREE = null;
    }
    this.setData({ stage: 'estimate', layoutModules: [] });
  },

  // Cabinet selectors (reused from glbviewer)
  onSelectWidth: function(e) {
    var val = e.currentTarget.dataset.width;
    if (val === 'custom') {
      this.setData({ selectedWidth: this.data.customWidth || 75, isCustomModule: true });
    } else {
      this.setData({ selectedWidth: parseInt(val), isCustomModule: false });
    }
    this._updateAvailableModules();
    this._updateSelectedModule();
  },

  onSelectType: function(e) {
    this.setData({ selectedType: e.currentTarget.dataset.type });
    this._updateSelectedModule();
  },

  onSelectColor: function(e) {
    this.setData({ selectedColor: e.currentTarget.dataset.color });
    this._updateSelectedModule();
  },

  _updateAvailableModules: function() {
    var data = this.data;
    var modules = layoutCompute.getAvailableModules(
      data.selectedWidth, data.customWidth, data.isCustomModule, assets.picture
    );
    if (data.isCustomModule) {
      this.setData({ availableModulesCustom: modules });
    } else {
      this.setData({ availableModules: modules });
    }
  },

  _updateSelectedModule: function() {
    var idx = this.data.selectedModuleIndex;
    if (idx < 0) return;
    var modules = this.data.layoutModules.slice();
    var m = modules[idx];
    if (m.isCorner) return;
    m.type = this.data.selectedType;
    if (!m.isCustom) m.width = this.data.selectedWidth;
    m.color = this.data.selectedColor;
    this.setData({ layoutModules: modules });
    if (this._sceneManager) {
      this._sceneManager.refreshCabinets(modules);
      this._sceneManager.highlightCabinet(idx);
    }
  },

  // Save
  saveAndCost: function() {
    var modules = this.data.layoutModules;
    if (modules.length === 0) {
      wx.showToast({ title: '请至少添加一个模块', icon: 'none' });
      return;
    }

    var self = this;
    app.ensureLogin().then(function() {
      var now = new Date();
      var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
      var designId = '' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate())
        + pad(now.getHours()) + pad(now.getMinutes());

      var cornerLabels = { none: '无转角柜', left: '左转角', right: '右转角', both: '双侧转角' };

      var design = {
        id: designId,
        name: '拍照设计_' + pad(now.getMonth() + 1) + pad(now.getDate()),
        cornerType: self.data.cornerType,
        cornerLabel: cornerLabels[self.data.cornerType] || '无转角柜',
        wallWidth: self.data.wallWidth,
        wallHeight: self.data.wallHeight,
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

  // Topview drawing
  _drawTopView: function() {
    var markers = this.data.markers;
    if (markers.length < 2) return;

    var self = this;
    setTimeout(function() {
      var query = wx.createSelectorQuery().in(self);
      query.select('.topview-canvas-wrap').boundingClientRect(function(rect) {
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        self._doDrawTopView(rect.width, rect.height);
      }).exec();
    }, 200);
  },

  _doDrawTopView: function(w, h) {
    var markers = this.data.markers;
    if (markers.length < 2) return;

    var ctx = wx.createCanvasContext('topviewCanvas', this);
    var pad = 16;

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

    var drawW = bw * scale;
    var drawH = bh * scale;
    var offX = pad + (w - pad * 2 - drawW) / 2;
    var offY = pad + (h - pad * 2 - drawH) / 2;

    function tx(vx) { return offX + (vx - minX) * scale; }
    function ty(vy) { return offY + (vy - minY) * scale; }

    ctx.clearRect(0, 0, w, h);

    // Floor outline
    var wallW = this.data.wallWidth;
    var depthPx = (this.data.roomDepth / Math.max(wallW, 1)) * drawW;

    // Draw wall line
    ctx.beginPath();
    ctx.moveTo(tx(markers[0].x), ty(markers[0].y));
    ctx.lineTo(tx(markers[1].x), ty(markers[1].y));
    ctx.setStrokeStyle('rgba(252, 151, 0, 0.7)');
    ctx.setLineWidth(2);
    ctx.stroke();

    // Draw depth
    ctx.beginPath();
    ctx.moveTo(tx(markers[0].x), ty(markers[0].y));
    ctx.lineTo(tx(markers[0].x), ty(markers[0].y) + depthPx);
    ctx.lineTo(tx(markers[1].x), ty(markers[1].y) + depthPx);
    ctx.lineTo(tx(markers[1].x), ty(markers[1].y));
    ctx.closePath();
    ctx.setFillStyle('rgba(252, 151, 0, 0.06)');
    ctx.fill();
    ctx.setStrokeStyle('rgba(252, 151, 0, 0.3)');
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    var colors = ['#FF6B35', '#4A90D9', '#50C878'];
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

  // Share
  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('knowledge', this, res);
  },

  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('knowledge', this);
  }
});
```

---

### Task 6: Clean up `glbviewer.js` — remove space mode code

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.js`

Remove these sections from glbviewer.js (exact line ranges will have shifted after previous edits; search by function name):

**Data fields to remove** (from `data: { ... }`):
Remove: `mode`, `photoPath`, `photoWidth`, `photoHeight`, `markers`, `wallWidth`, `wallHeight`, `roomDepth`, `cornerType`, `draggingIndex`, `spaceStage`, `wallWidthNum`, `wallHeightNum`, `roomDepthNum`, `customWidth`, `layoutModules`, `availableModules`, `availableModulesCustom`, `selectedWidth`, `selectedType`, `selectedColor`, `isCustomModule`, `selectedModuleIndex`, `standardWidth`

**Methods to remove:**
- `startSpaceMode`
- `onPhotoLoad`
- `reselectPhoto`
- `resetMarkers`
- `confirmSpace`
- `_initPhotoLayoutCanvas`
- `_loadPhotoImage`
- `_renderPhotoLayout`
- `_calcWallRegion`
- `_drawCabinetsOnWall`
- `_drawOneCabinet`
- `onPhotoLayoutTap`
- `onPhotoLayoutLongPress`
- `updateAvailableModules`
- `onSelectWidth`
- `onSelectType`
- `onSelectColor`
- `_updateSelectedModule`
- `goBackToMarking`
- `_initSpace3d`
- `_prepareWallTexture`
- `onSpace3dTouch`
- `_handleSpace3dTap`
- `onNextModule`
- `resetCamera3d`
- `goCost` (space mode logic in this method)
- `onSpaceWidthInput`
- `onSpaceHeightInput`
- `onSpaceDepthInput`
- `goDesign`
- `_updateCornerType`
- `_drawTopView`
- `_doDrawTopView`
- `onPhotoTap`
- `onMarkerLongPress`
- `onMarkerDrag`
- `onMarkerDragEnd`

**Requires to remove:**
- `var layoutCompute = require('../../../utils/layoutCompute.js');` (line 2) — if only used in space mode
- `var perspective = require('../../../utils/perspective.js');` (line 4) — was added in Task 3 of previous plan

Wait — `layoutCompute` may also be used elsewhere. Check if it's referenced in GLB mode code. Actually, `layoutCompute` was imported for space mode cabinet layout. GLB mode doesn't use it. Remove it.

But `assets` is used in GLB mode for `modelCatalog()`. Keep it.

**Change "拍照解析空间" button:**
```js
// Before (in startSpaceMode / loadCabinetModel):
// The "拍照解析空间" button calls startSpaceMode

// Change the button handler:
startSpaceMode: function() {
  wx.navigateTo({ url: '/pages/knowledge/photo/photo' });
},
```

Actually, since we're removing `startSpaceMode`, we need to keep a navigation method. Rename/keep it as a simple navigator:

```js
goToPhotoSpace: function() {
  wx.navigateTo({ url: '/pages/knowledge/photo/photo' });
},
```

And change the WXML button binding from `bindtap="startSpaceMode"` to `bindtap="goToPhotoSpace"`.

**In `clearModel`**: Remove all space-mode data resets (keep only GLB-related fields).

**In `onUnload`**: Remove space-mode cleanup (already only has GLB + space3d cleanup, remove the space3d part — but WAIT, we already have `_sceneManager` for space3d mode. After cleanup, only GLB manager remains. Keep `_glbManager` disposal, remove `_sceneManager` disposal).

---

### Task 7: Clean up `glbviewer.wxml` — remove space mode templates

**Files:**
- Modify: `pages/knowledge/glbviewer/glbviewer.wxml`

Remove these template blocks:
- Lines ~190-275: Space marking mode (`wx:if="{{mode === 'space' && spaceStage !== 'layout'}}"`)
- Lines ~277-343: Layout mode (`wx:if="{{mode === 'space' && spaceStage === 'layout'}}"`)
- Lines ~345-414: Space3d mode (`wx:if="{{mode === 'space3d'}}"`)
- Lines ~417-419: Texture prep canvas (hidden 2d canvas for space mode)

Change the "拍照解析空间" button in the center overlay:
```html
<!-- Before: -->
<view class="cta-btn cta-btn-photo" bindtap="startSpaceMode">

<!-- After: -->
<view class="cta-btn cta-btn-photo" bindtap="goToPhotoSpace">
```

Also remove the `wx:if="{{mode === 'glb'}}"` condition on the GLB viewport (line 17) since there's no other mode:
```html
<!-- Before: -->
<view class="viewport" ... wx:if="{{mode === 'glb'}}">

<!-- After: -->
<view class="viewport" ...>
```

---

### Task 8: Register new page in `app.json`

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Add photo page to the knowledge pages array**

In `app.json`, under the `pages/knowledge` subPackage (or pages array if not using subPackages), add `photo/photo`:

```json
{
  "root": "pages/knowledge",
  "pages": [
    "detail/detail",
    "budget/budget",
    "needs/needs",
    "inspect/inspect",
    "move/move",
    "checklist/checklist",
    "glbviewer/glbviewer",
    "photo/photo"
  ]
}
```

Find the exact location of the knowledge subPackage in app.json and add the entry.
