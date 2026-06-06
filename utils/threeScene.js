/**
 * Three.js 3D 实景匹配场景管理器 — 房间模式
 *
 * 构建矩形 3D 空间：照片纹理背墙 + 侧墙 + 地板 + 天花板 + 柜子。
 *
 * 使用方式:
 *   var THREE = require('threejs-miniprogram').createScopedThreejs(canvas);
 *   var mgr = require('../../utils/threeScene.js').createSceneManager(canvas, THREE);
 *   mgr.init(wallWidthCm, wallHeightCm, textureCanvas, cornerType, modules);
 *   mgr.animate();
 */

var CABINET_HEIGHT_M = 2.30;
var CABINET_DEPTH_M = 0.60;

function createSceneManager(canvas, THREE) {

  var scene, camera, renderer;
  var roomGroup, cabinetGroup;
  var wallWidthM, wallHeightM, roomDepthM;
  var backWallMesh;
  var modules = [];
  var selectedIndex = -1;
  var highlightMesh = null;

  // 轨道状态
  var theta = 0.3;
  var phi = Math.PI / 4;
  var radius = 4;
  var target = { x: 0, y: 1.25, z: 0 };

  // 触摸状态
  var touchStart = null;
  var touchStartDist = 0;
  var touchMoved = false;
  var _canvas = canvas;

  // ---- 初始化 ----

  function init(wallWidthCm, wallHeightCm, textureCanvas, cornerType, initialModules) {
    wallWidthM = wallWidthCm / 1000;
    wallHeightM = wallHeightCm / 1000;
    roomDepthM = Math.max(wallWidthM * 0.6, 2.0);
    modules = initialModules || [];
    selectedIndex = -1;
    cornerType = cornerType || 'none';

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

    // Camera — 初始在房间前方，偏侧一点看透视
    camera = new THREE.PerspectiveCamera(45, _canvas.width / Math.max(_canvas.height, 1), 0.1, 100);
    radius = Math.max(wallWidthM, wallHeightM) * 1.6;
    target.x = 0;
    target.y = wallHeightM / 2;
    target.z = roomDepthM / 2;
    _updateCamera();

    // Lights — 正面白色灯光
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    var keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(0, wallHeightM * 0.7, -roomDepthM * 0.8);
    scene.add(keyLight);
    var fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-wallWidthM / 2, wallHeightM * 0.4, -roomDepthM * 0.5);
    scene.add(fillLight);

    // Room group
    roomGroup = new THREE.Group();
    scene.add(roomGroup);

    // ---- 构建 3D 房间 ----

    var halfW = wallWidthM / 2;

    // 1. 背墙（照片纹理）
    var backGeo = new THREE.PlaneGeometry(wallWidthM, wallHeightM);
    var backMat;
    if (textureCanvas) {
      var texture = new THREE.CanvasTexture(textureCanvas);
      texture.needsUpdate = true;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      backMat = new THREE.MeshStandardMaterial({ map: texture, side: THREE.FrontSide, roughness: 0.6 });
    } else {
      backMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6 });
    }
    backWallMesh = new THREE.Mesh(backGeo, backMat);
    backWallMesh.rotation.y = Math.PI;
    backWallMesh.position.set(0, wallHeightM / 2, 0);
    backWallMesh.name = 'backWall';
    roomGroup.add(backWallMesh);

    // 侧墙颜色（从背墙照片边缘采样 / 暖灰色）
    var sideColor = 0xd4c8b8;

    // 2. 左侧墙
    if (cornerType !== 'left' && cornerType !== 'both') {
      _addSideWall(-halfW, sideColor);
    }

    // 3. 右侧墙
    if (cornerType !== 'right' && cornerType !== 'both') {
      _addSideWall(halfW, sideColor);
    }

    // 4. 地板
    _addFloor();

    // 5. 天花板（可选，轻量色）
    var ceilGeo = new THREE.PlaneGeometry(wallWidthM, roomDepthM);
    var ceilMat = new THREE.MeshStandardMaterial({ color: 0xf0ece6, roughness: 0.8, side: THREE.DoubleSide });
    var ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(0, wallHeightM, roomDepthM / 2);
    roomGroup.add(ceilMesh);

    // 6. 转角墙（如需要）
    if (cornerType === 'left') {
      _addCornerWall(-halfW, 'left', textureCanvas);
    } else if (cornerType === 'right') {
      _addCornerWall(halfW, 'right', textureCanvas);
    } else if (cornerType === 'both') {
      _addCornerWall(-halfW, 'left', textureCanvas);
      _addCornerWall(halfW, 'right', textureCanvas);
    }

    // Cabinet group
    cabinetGroup = new THREE.Group();
    scene.add(cabinetGroup);

    _rebuildCabinets();
    renderer.render(scene, camera);
  }

  function _addSideWall(xEdge, color) {
    var geo = new THREE.PlaneGeometry(roomDepthM, wallHeightM);
    var mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.65, side: THREE.FrontSide });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = (xEdge < 0) ? Math.PI / 2 : -Math.PI / 2;
    mesh.position.set(xEdge, wallHeightM / 2, roomDepthM / 2);
    roomGroup.add(mesh);
  }

  function _addFloor() {
    var floorGeo = new THREE.PlaneGeometry(wallWidthM, roomDepthM);
    var floorMat = new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.85, side: THREE.DoubleSide });
    var floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, -0.01, roomDepthM / 2);
    floorMesh.name = 'floor';
    roomGroup.add(floorMesh);
  }

  function _addCornerWall(xEdge, side, textureCanvas) {
    var cornerDepth = Math.min(roomDepthM, 2.0);
    var geo = new THREE.PlaneGeometry(cornerDepth, wallHeightM);
    var mat;
    if (textureCanvas) {
      // 复用同一纹理（转角墙用同一个照片）
      var tex = new THREE.CanvasTexture(textureCanvas);
      tex.needsUpdate = true;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    } else {
      mat = new THREE.MeshStandardMaterial({ color: 0xd4c8b8, roughness: 0.9 });
    }
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = (side === 'left') ? 0 : Math.PI;
    mesh.position.set(
      xEdge + ((side === 'left') ? -cornerDepth / 2 : cornerDepth / 2),
      wallHeightM / 2,
      cornerDepth / 2
    );
    roomGroup.add(mesh);
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

  // ---- 柜子 mesh 管理 ----

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
        roughness: 0.5,
        metalness: 0.08
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, CABINET_HEIGHT_M / 2, CABINET_DEPTH_M / 2);
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
    highlightMesh.position.set(x, CABINET_HEIGHT_M / 2, CABINET_DEPTH_M / 2);
    highlightMesh.userData = { moduleIndex: index };
    cabinetGroup.add(highlightMesh);
    renderer.render(scene, camera);
  }

  // ---- 公开方法 ----

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

  // ---- 射线检测 ----

  function hitTest(tapX, tapY) {
    if (!camera || !backWallMesh) return null;

    var rect = { width: _canvas.width, height: _canvas.height };
    if (!rect.width || !rect.height) return null;

    var mouse = {};
    mouse.x = (tapX / rect.width) * 2 - 1;
    mouse.y = -(tapY / rect.height) * 2 + 1;

    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Check cabinet children first
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

    // Check back wall
    var wallIntersects = raycaster.intersectObject(backWallMesh, false);
    if (wallIntersects.length > 0) {
      var pt = wallIntersects[0].point;
      var halfW = wallWidthM / 2;
      var posCm = (pt.x + halfW) * 100;

      var accCm = 0;
      var hitIdx = -1;
      for (var i = 0; i < modules.length; i++) {
        var mEnd = accCm + modules[i].width;
        if (posCm >= accCm - 3 && posCm <= mEnd + 3) {
          hitIdx = i;
          break;
        }
        accCm = mEnd;
      }

      return { hitType: 'wall', posCm: posCm, moduleIndex: hitIdx };
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
      phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, phi));
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

  function resetCamera() {
    theta = 0.3;
    phi = Math.PI / 4;
    radius = Math.max(wallWidthM, wallHeightM) * 1.6;
    target.x = 0;
    target.y = wallHeightM / 2;
    target.z = roomDepthM / 2;
    _updateCamera();
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
    handleTouchStart: handleTouchStart,
    handleTouchMove: handleTouchMove,
    handleTouchEnd: handleTouchEnd,
    animate: animate,
    getModules: function() { return modules; }
  };
}

module.exports = { createSceneManager: createSceneManager };
