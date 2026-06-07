/**
 * PD3D 场景管理器
 *
 * 构建 3D 房间（背墙照片纹理 + 侧墙 + 地板 + 天花板 + 半透明绿色放置区），
 * 管理柜子的加载/放置/缩放/选中（Task 6 填充），处理相机轨道控制。
 */

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
