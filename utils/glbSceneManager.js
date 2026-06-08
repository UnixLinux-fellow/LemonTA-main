/**
 * Three.js GLB 模型查看器场景管理器
 *
 * 加载 .glb 模型文件，支持轨道旋转、双指缩放模型、等比例/非等比例拉伸。
 *
 * 使用方式:
 *   var THREE = require('threejs-miniprogram').createScopedThreejs(canvas);
 *   require('../../utils/GLTFLoader.js')(THREE);
 *   var mgr = require('../../utils/glbSceneManager.js').createGLBSceneManager(canvas, THREE);
 *   mgr.init();
 *   mgr.loadGLB(url).then(function(sizeCm) { ... });
 *   mgr.animate();
 */

function createGLBSceneManager(canvas, THREE) {

  var scene, camera, renderer;
  var modelGroup;
  var originalSize = null;
  var currentScale = { x: 1, y: 1, z: 1 };
  var _doorMeshes = [];

  function _isDoorMesh(name) {
    if (!name) return false;
    var lower = name.toLowerCase();
    return lower === 'door' || lower.indexOf('_door') >= 0 || lower.indexOf('door_') >= 0;
  }

  // Orbit state (Z-up convention: theta = azimuth around Z, phi = elevation)
  var theta = 0;
  var phi = Math.PI / 12;
  var radius = 3;
  var target = { x: 0, y: 0, z: 0 };

  // Touch state
  var touchStart = null;
  var touchStartDist = 0;
  var touchMoved = false;
  var _canvas = canvas;

  // ---- 初始化 ----

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
    camera.up.set(0, 0, 1);

    scene.add(new THREE.AmbientLight(0xffffff, 2.5));
    var dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);
    var fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
    fillLight.position.set(-2, 1, -2);
    scene.add(fillLight);

    modelGroup = new THREE.Group();
    scene.add(modelGroup);

    _updateCamera();
    renderer.render(scene, camera);
  }

  // ---- GLB 加载 ----

  function loadGLB(url) {
    return new Promise(function (resolve, reject) {
      try {
        var fs = wx.getFileSystemManager();
        var data = null;
        var paths = [url];
        if (url.indexOf('/') !== 0) paths.push('/' + url);
        for (var i = 0; i < paths.length; i++) {
          try { data = fs.readFileSync(paths[i]); break; } catch (e) {}
        }
        if (!data || data.byteLength === 0) {
          reject(new Error('文件读取失败或文件为空'));
          return;
        }
        new THREE.GLTFLoader().parse(data, '', function (gltf) {
          if (!gltf || !gltf.scene) {
            reject(new Error('模型解析结果为空'));
            return;
          }
          _clearModelGroup();

          modelGroup.add(gltf.scene);

          // Collect door nodes by name (case-insensitive) and hide them by default.
          // Setting visible=false on a Group hides its whole subtree.
          gltf.scene.traverse(function (node) {
            if (_isDoorMesh(node.name)) {
              node.visible = false;
              _doorMeshes.push(node);
            }
          });

          var box = new THREE.Box3().setFromObject(gltf.scene);
          var size = new THREE.Vector3();
          box.getSize(size);
          var center = new THREE.Vector3();
          box.getCenter(center);

          // If bounding box is zero-sized (e.g. empty scene), use a fallback
          if (size.x < 0.001 && size.y < 0.001 && size.z < 0.001) {
            size.set(1, 1, 1);
            center.set(0, 0, 0);
          }

          originalSize = { x: size.x, y: size.y, z: size.z };

          currentScale = { x: 1, y: 1, z: 1 };
          modelGroup.scale.set(1, 1, 1);

          // Center model at origin
          modelGroup.position.set(-center.x, -center.y, -center.z);

          var maxDim = Math.max(size.x, size.y, size.z, 0.01);
          radius = maxDim * 2.5;
          target.x = 0;
          target.y = 0;
          target.z = 0;
          _updateCamera();

          renderer.render(scene, camera);

          resolve({
            x: size.x * 100,
            y: size.y * 100,
            z: size.z * 100
          });
        }, function (err) {
          reject(err || new Error('GLB parse failed'));
        });
      } catch (e) {
        reject(new Error('文件读取失败: ' + (e.message || e)));
      }
    });
  }

  function _clearModelGroup() {
    while (modelGroup.children.length > 0) {
      var child = modelGroup.children[0];
      _disposeObject(child);
      modelGroup.remove(child);
    }
    originalSize = null;
    _doorMeshes = [];
  }

  function _disposeObject(obj) {
    if (!obj) return;
    obj.traverse(function (node) {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        if (Array.isArray(node.material)) {
          node.material.forEach(function (m) {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (node.material.map) node.material.map.dispose();
          node.material.dispose();
        }
      }
    });
  }

  // ---- 缩放控制 ----

  function setUniformScale(s) {
    s = Math.max(0.01, Math.min(100, s));
    currentScale.x = s;
    currentScale.y = s;
    currentScale.z = s;
    modelGroup.scale.set(s, s, s);
    renderer.render(scene, camera);
  }

  function setAxisScale(x, y, z) {
    x = Math.max(0.01, Math.min(100, x));
    y = Math.max(0.01, Math.min(100, y));
    z = Math.max(0.01, Math.min(100, z));
    currentScale.x = x;
    currentScale.y = y;
    currentScale.z = z;
    modelGroup.scale.set(x, y, z);
    renderer.render(scene, camera);
  }

  function getOriginalSize() {
    return originalSize || { x: 0, y: 0, z: 0 };
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

  // ---- Door visibility ----

  function setDoorVisible(visible) {
    if (!_doorMeshes || _doorMeshes.length === 0) return;
    var v = !!visible;
    for (var i = 0; i < _doorMeshes.length; i++) {
      _doorMeshes[i].visible = v;
    }
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  function hasDoorMeshes() {
    return _doorMeshes && _doorMeshes.length > 0;
  }

  // ---- Camera ----

  // Z-up orbit: theta = azimuth around +Z, phi = elevation above XY plane.
  // theta=0 places camera along -Y looking toward +Y (so model's -Y face is
  // front-on to the viewer). camera.up = +Z is set in init().
  function _updateCamera() {
    var sp = Math.sin(phi);
    var cp = Math.cos(phi);
    var st = Math.sin(theta);
    var ct = Math.cos(theta);
    camera.position.set(
      target.x + radius * cp * st,
      target.y - radius * cp * ct,
      target.z + radius * sp
    );
    camera.lookAt(target.x, target.y, target.z);
  }

  // ---- 触摸 / 手势 ----

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
      var newScale = currentScale.x * factor;
      newScale = Math.max(0.01, Math.min(100, newScale));
      currentScale.x = newScale;
      currentScale.y = newScale;
      currentScale.z = newScale;
      modelGroup.scale.set(newScale, newScale, newScale);
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

  function handleTouchEnd() {
    var wasTap = !touchMoved;
    touchStart = null;
    touchStartDist = 0;
    touchMoved = false;
    return wasTap;
  }

  // ---- 渲染循环 ----

  function animate() {
    _canvas.requestAnimationFrame(animate);
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  // ---- 销毁 ----

  function dispose() {
    if (modelGroup) {
      _clearModelGroup();
    }
    if (renderer) renderer.dispose();
    scene = null;
    camera = null;
    renderer = null;
    modelGroup = null;
    originalSize = null;
    currentScale = { x: 1, y: 1, z: 1 };
    _doorMeshes = [];
  }

  return {
    init: init,
    loadGLB: loadGLB,
    setUniformScale: setUniformScale,
    setAxisScale: setAxisScale,
    getOriginalSize: getOriginalSize,
    getCurrentScale: getCurrentScale,
    resetScale: resetScale,
    setDoorVisible: setDoorVisible,
    hasDoorMeshes: hasDoorMeshes,
    handleTouchStart: handleTouchStart,
    handleTouchMove: handleTouchMove,
    handleTouchEnd: handleTouchEnd,
    animate: animate,
    dispose: dispose
  };
}

module.exports = { createGLBSceneManager: createGLBSceneManager };
