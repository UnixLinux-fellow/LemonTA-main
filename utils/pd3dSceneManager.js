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
  var cabinets = []; // { instanceId, modelId, widthCm, isCustom, wallStartCm, scale, group, baseSize }

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
    cabinets = [];
    initialCamState = null;
    touchStart = null;
    touchStartDist = 0;
  }

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
}

module.exports = {
  createSceneManager: createSceneManager,
  CABINET_DEPTH_M: CABINET_DEPTH_M,
  CABINET_HEIGHT_M: CABINET_HEIGHT_M
};
