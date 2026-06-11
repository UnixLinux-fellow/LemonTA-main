/**
 * 3D 柜体透视叠加层。
 * 在 PD2D 页面的 webgl canvas 上渲染：
 *  - 已放置柜体的 GLB（按宽度归一化、按 wallX 平移）
 *  - 程序化 SK 修边 + g-* 间隙填充 cuboid
 *  - 从 4 个像素角点反推的 PerspectiveCamera
 * 透明背景，叠加在 2D 照片之上。
 */
var sceneNodes = require('./cabinetSceneNodes.js');
var h2c = require('./homographyToCamera.js');
var perspective = require('./perspective.js');
var catalog = require('./cabinetCatalog.js');

var DEFAULT_DEPTH = 60;
var TRIM_COLOR = 0xF5F1E8;
var FIXED_CAM_DISTANCE = 1500;

function createOverlay(canvas) {
  var THREE = null;
  var renderer = null;
  var scene = null;
  var camera = null;
  var lights = null;
  var trimMaterial = null;

  var templates = {};
  var liveNodes = [];

  var doorVisible = false;
  var canvasWidth = 0;
  var canvasHeight = 0;
  var dpr = 2;

  var lastCornersKey = null;
  var lastNodesKey = null;

  function _initThree() {
    THREE = require('./threejs-miniprogram.js').createScopedThreejs(canvas);
    if (!THREE || !THREE.WebGLRenderer) {
      throw new Error('THREE init failed');
    }
    require('./GLTFLoader.js')(THREE);
  }

  function _setupRenderer(w, h, ratio) {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
  }

  function _setupScene() {
    scene = new THREE.Scene();
    var amb = new THREE.AmbientLight(0xffffff, 2.5);
    var key = new THREE.DirectionalLight(0xffffff, 3.0);
    key.position.set(2, 4, 3);
    key.castShadow = true;
    if (key.shadow && key.shadow.mapSize) {
      key.shadow.mapSize.set(1024, 1024);
    }
    var fill = new THREE.DirectionalLight(0xffffff, 1.2);
    fill.position.set(-2, 1, -2);
    scene.add(amb); scene.add(key); scene.add(fill);
    lights = { amb: amb, key: key, fill: fill };
    trimMaterial = new THREE.MeshStandardMaterial({
      color: TRIM_COLOR, roughness: 0.7, metalness: 0.0
    });
  }

  function _disposeNode(node) {
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      if (Array.isArray(node.material)) {
        node.material.forEach(function(m){ m.dispose(); });
      } else {
        node.material.dispose();
      }
    }
  }

  function _clearLive() {
    if (!scene) return;
    for (var i = 0; i < liveNodes.length; i++) {
      var ln = liveNodes[i];
      var obj = ln.mesh || ln.group;
      if (!obj) continue;
      scene.remove(obj);
      if (ln.kind === 'trim' && ln.mesh && ln.mesh.geometry) {
        ln.mesh.geometry.dispose();
      }
    }
    liveNodes = [];
  }

  function _readGLB(path) {
    var fs = wx.getFileSystemManager();
    var paths = [path];
    if (path.indexOf('/') !== 0) paths.push('/' + path);
    for (var i = 0; i < paths.length; i++) {
      try {
        var data = fs.readFileSync(paths[i]);
        if (data && data.byteLength > 0) return data;
      } catch (e) {}
    }
    return null;
  }

  function _parseGLB(data) {
    return new Promise(function(resolve, reject) {
      new THREE.GLTFLoader().parse(data, '', function(gltf) {
        if (!gltf || !gltf.scene) { reject(new Error('empty gltf')); return; }
        resolve(gltf.scene);
      }, function(err) { reject(err || new Error('parse failed')); });
    });
  }

  function _isDoorMesh(name) {
    if (!name) return false;
    var lower = name.toLowerCase();
    return lower === 'door' || lower.indexOf('_door') >= 0 || lower.indexOf('door_') >= 0;
  }

  // Normalize a parsed GLB into a 0-aligned bounding box of (targetW × targetH × targetD) cm.
  function _buildTemplate(gltfScene, modelId, targetW, targetH, targetD) {
    var box = new THREE.Box3().setFromObject(gltfScene);
    var size = new THREE.Vector3(); box.getSize(size);
    var min = box.min;
    if (size.x < 0.001) size.x = 1;
    if (size.y < 0.001) size.y = 1;
    if (size.z < 0.001) size.z = 1;
    var sx = targetW / size.x;
    var sy = targetH / size.y;
    var sz = targetD / size.z;
    var template = new THREE.Group();
    var inner = new THREE.Group();
    inner.add(gltfScene);
    inner.position.set(-min.x, -min.y, -min.z);
    template.add(inner);
    template.scale.set(sx, sy, sz);
    template.userData.modelId = modelId;
    return template;
  }

  function _loadTemplateAsync(modelId, cb) {
    if (templates[modelId]) { cb(null, templates[modelId]); return; }
    var path = catalog.getModelPath(modelId);
    if (!path) { console.warn('[overlay] unknown modelId:', modelId); cb(new Error('unknown')); return; }
    var meta = null;
    var all = catalog.listModels();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === modelId) { meta = all[i]; break; }
    }
    if (!meta) { cb(new Error('no meta')); return; }
    var data = _readGLB(path);
    if (!data) { console.warn('[overlay] GLB read failed:', path); cb(new Error('read failed')); return; }
    _parseGLB(data).then(function(gltfScene) {
      var template = _buildTemplate(gltfScene, modelId, meta.width, 230, DEFAULT_DEPTH);
      templates[modelId] = { templateGroup: template, baseWidth: meta.width };
      cb(null, templates[modelId]);
    }).catch(function(err) {
      console.warn('[overlay] GLB parse failed:', path, err);
      cb(err);
    });
  }

  function _collectDoors(group) {
    var doors = [];
    group.traverse(function(node) { if (_isDoorMesh(node.name)) doors.push(node); });
    return doors;
  }

  function _addCabinetNode(desc) {
    var template = templates[desc.modelId];
    if (!template) return;
    var clone = template.templateGroup.clone(true);
    clone.position.set(desc.x, desc.y, desc.z);
    var baseW = template.baseWidth || desc.w;
    if (desc.w && desc.w !== baseW) {
      clone.scale.x *= (desc.w / baseW);
    }
    var doors = _collectDoors(clone);
    for (var i = 0; i < doors.length; i++) doors[i].visible = doorVisible;
    clone.traverse(function(n) {
      if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
    });
    scene.add(clone);
    liveNodes.push({ kind:'cabinet', group: clone, descriptor: desc, doors: doors });
  }

  function _addTrimNode(desc) {
    var geom = new THREE.BoxGeometry(desc.w, desc.h, desc.d);
    var mesh = new THREE.Mesh(geom, trimMaterial);
    mesh.position.set(desc.x + desc.w/2, desc.y + desc.h/2, desc.z + desc.d/2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    liveNodes.push({ kind:'trim', mesh: mesh, descriptor: desc });
  }

  function init(opts) {
    canvasWidth = opts.canvasWidth;
    canvasHeight = opts.canvasHeight;
    dpr = opts.dpr || 2;
    try {
      _initThree();
      _setupRenderer(canvasWidth, canvasHeight, dpr);
      _setupScene();
      camera = new THREE.PerspectiveCamera(60, canvasWidth/canvasHeight, 1, 5000);
      return true;
    } catch (e) {
      console.error('[cabinetSceneOverlay] init failed:', e);
      renderer = null;
      scene = null;
      return false;
    }
  }

  function resize(w, h, ratio) {
    if (!renderer) return;
    canvasWidth = w; canvasHeight = h; dpr = ratio || dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    if (camera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function dispose() {
    _clearLive();
    if (trimMaterial) { trimMaterial.dispose(); trimMaterial = null; }
    var keys = Object.keys(templates);
    for (var i = 0; i < keys.length; i++) {
      var t = templates[keys[i]];
      if (t && t.templateGroup) {
        t.templateGroup.traverse(_disposeNode);
      }
    }
    templates = {};
    if (renderer) { renderer.dispose(); renderer = null; }
    scene = null; camera = null; lights = null; THREE = null;
    lastCornersKey = null; lastNodesKey = null;
  }

  // Stubs filled in by Task 6.
  function update(state) {
    if (!renderer || !scene) return;

    var corners = state.corners;
    var W = state.wallWidth;
    var Hh = state.wallHeight;
    var modules = state.modules || [];

    if (!perspective.isConvexQuad(corners)) {
      _clearLive();
      renderer.clear();
      return;
    }

    var nodes = sceneNodes.buildSceneNodes({
      wallWidth: W, wallHeight: Hh, modules: modules, depth: DEFAULT_DEPTH
    });

    // Async-load any missing cabinet templates, then re-run.
    var missing = {};
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.type === 'cabinet' && !templates[n.modelId]) missing[n.modelId] = true;
    }
    var missingIds = Object.keys(missing);
    if (missingIds.length > 0) {
      var pending = missingIds.length;
      for (var k = 0; k < missingIds.length; k++) {
        _loadTemplateAsync(missingIds[k], function() {
          pending--;
          if (pending <= 0) update(state);
        });
      }
      // Continue: trim cuboids and already-loaded cabinets render now.
    }

    // Diff: only rebuild scene if node signature changed.
    var nodesKey = JSON.stringify(nodes);
    if (nodesKey !== lastNodesKey) {
      _clearLive();
      for (var j = 0; j < nodes.length; j++) {
        var nd = nodes[j];
        if (nd.type === 'cabinet') _addCabinetNode(nd);
        else _addTrimNode(nd);
      }
      // Cabinets whose templates are still loading were silently skipped by
      // _addCabinetNode. Don't cache nodesKey in that case — the recursive
      // update() fired by the async load callback would otherwise short-circuit
      // and the missing cabinet would never reach the scene.
      lastNodesKey = (missingIds.length === 0) ? nodesKey : null;
    }

    // Recompute camera when corners or wall size changed.
    var cornersKey = corners.map(function(c){return c.x+','+c.y;}).join('|') + ':' + W + 'x' + Hh;
    if (cornersKey !== lastCornersKey) {
      var cm = [
        {x:0,  y:Hh}, {x:W, y:Hh}, {x:W, y:0}, {x:0, y:0}
      ];
      // Choose FOV so the recovered camera sits ≈ FIXED_CAM_DISTANCE from the wall
      // regardless of wallWidth. With a closer camera, the 60cm-deep cabinet front
      // foreshortens dramatically (its top falls outside the wall outline). Using
      // a narrow FOV pushes the camera far back, so cabinets project nearly
      // orthographically and stay fully inside the photo area. The homography
      // solver still glues wall corners to the user-dragged pxCorners exactly.
      var topEdgePx = Math.sqrt(
        (corners[1].x - corners[0].x) * (corners[1].x - corners[0].x) +
        (corners[1].y - corners[0].y) * (corners[1].y - corners[0].y)
      );
      var botEdgePx = Math.sqrt(
        (corners[2].x - corners[3].x) * (corners[2].x - corners[3].x) +
        (corners[2].y - corners[3].y) * (corners[2].y - corners[3].y)
      );
      var avgEdgePx = 0.5 * (topEdgePx + botEdgePx);
      if (!(avgEdgePx > 1)) avgEdgePx = canvasWidth * 0.5;
      var fovRad = 2 * Math.atan((canvasHeight * W) / (2 * avgEdgePx * FIXED_CAM_DISTANCE));
      var dynFovDeg = fovRad * 180 / Math.PI;
      if (!(dynFovDeg > 0) || !isFinite(dynFovDeg)) dynFovDeg = 30;
      if (dynFovDeg < 5) dynFovDeg = 5;
      if (dynFovDeg > 70) dynFovDeg = 70;
      // homographyToCamera's projection model is 180° rotated relative to three.js.
      // Pre-rotate the user's pxCorners around canvas center so the recovered
      // camera renders with +Y up in three.js. Without this, the wall renders
      // upside-down and mirrored.
      var rotatedPx = corners.map(function(c) {
        return { x: canvasWidth - c.x, y: canvasHeight - c.y };
      });
      var camParams = h2c.homographyToCamera({
        cmCorners: cm, pxCorners: rotatedPx,
        canvasWidth: canvasWidth, canvasHeight: canvasHeight, fovDegrees: dynFovDeg
      });
      if (!camParams) {
        console.warn('[overlay] camera recovery failed; skipping render');
        lastCornersKey = null;
        renderer.clear();
        return;
      }
      camera.position.set(camParams.position[0], camParams.position[1], camParams.position[2]);
      camera.up.set(camParams.up[0], camParams.up[1], camParams.up[2]);
      camera.lookAt(camParams.lookAt[0], camParams.lookAt[1], camParams.lookAt[2]);
      camera.fov = camParams.fov;
      camera.aspect = camParams.aspect;
      camera.near = camParams.near;
      camera.far = camParams.far;
      camera.updateProjectionMatrix();
      lastCornersKey = cornersKey;
    }

    renderer.render(scene, camera);
  }

  function setDoorVisible(v) {
    doorVisible = !!v;
    for (var i = 0; i < liveNodes.length; i++) {
      var ln = liveNodes[i];
      if (ln.kind !== 'cabinet') continue;
      var doors = ln.doors || [];
      for (var j = 0; j < doors.length; j++) doors[j].visible = doorVisible;
    }
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  return {
    init: init,
    update: update,
    setDoorVisible: setDoorVisible,
    resize: resize,
    dispose: dispose
  };
}

module.exports = { createOverlay: createOverlay };
