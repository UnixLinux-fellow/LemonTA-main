/**
 * 柜体模型缩略图预览器
 *
 * 在单个 WebGL canvas 上并排渲染多个 GLB 模型缩略图，
 * 支持触摸选择和高亮。使用 scissor/viewport 为每个模型分配独立区域。
 *
 * 渲染风格与 glbSceneManager.js 对齐：相同的光照、相同的相机摆位
 * （theta=π, phi=π/24, radius=maxDim*2.5, target.y=-size.y/4），
 * 模型仅以 group.position 平移到原点，不做额外缩放，
 * 每个 cell 使用各自模型尺寸推导出独立相机。
 *
 * 使用方式:
 *   var preview = require('../../utils/cabinetModelPreview.js').createPreview(canvas);
 *   preview.init(modelIds, function onReady() { ... });
 *   preview.selectModel(index);
 *   preview.handleTouchStart / Move / End
 *   preview.dispose();
 */

function createPreview(canvas) {
  var THREE = null;
  var renderer = null;
  var scene = null;

  var models = [];
  var cellCount = 0;
  var selectedIndex = -1;
  var canvasWidth = 0;
  var canvasHeight = 0;
  var dpr = 2;
  var doorVisible = false;

  function _isDoorMesh(name) {
    if (!name) return false;
    var lower = name.toLowerCase();
    return lower === 'door' || lower.indexOf('_door') >= 0 || lower.indexOf('door_') >= 0;
  }

  function _initThree() {
    try {
      THREE = require('./threejs-miniprogram.js').createScopedThreejs(canvas);
    } catch (e) {
      console.error('[cabinetModelPreview] createScopedThreejs failed:', e);
      return e;
    }
    if (!THREE) {
      console.error('[cabinetModelPreview] createScopedThreejs returned null');
      return new Error('createScopedThreejs returned null');
    }
    if (!THREE.WebGLRenderer) {
      console.error('[cabinetModelPreview] THREE.WebGLRenderer missing');
      return new Error('THREE.WebGLRenderer missing');
    }
    try {
      require('./GLTFLoader.js')(THREE);
    } catch (e) {
      console.error('[cabinetModelPreview] GLTFLoader patch failed:', e);
      return e;
    }
    return null;
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
        if (!gltf || !gltf.scene) {
          reject(new Error('empty gltf'));
          return;
        }
        resolve(gltf.scene);
      }, function(err) {
        reject(err || new Error('parse failed'));
      });
    });
  }

  // 与 glbSceneManager 的中心化策略一致：仅平移 group，不缩放模型。
  // 每个 cell 的相机距离会基于模型自身尺寸推导，从而保证视觉大小一致。
  // 同时与 glbSceneManager 保持一致：检测门板节点，默认隐藏，由外部 toggle 控制显示。
  function _fitModelToCell(gltfScene) {
    var doorMeshes = [];
    gltfScene.traverse(function(node) {
      if (_isDoorMesh(node.name)) {
        node.visible = doorVisible;
        doorMeshes.push(node);
      }
    });

    var box = new THREE.Box3().setFromObject(gltfScene);
    var size = new THREE.Vector3();
    box.getSize(size);
    var center = new THREE.Vector3();
    box.getCenter(center);

    if (size.x < 0.001 && size.y < 0.001 && size.z < 0.001) {
      size.set(1, 1, 1);
      center.set(0, 0, 0);
    }

    var group = new THREE.Group();
    group.add(gltfScene);
    group.position.set(-center.x, -center.y, -center.z);
    group.userData.size = { x: size.x, y: size.y, z: size.z };
    group.userData.doorMeshes = doorMeshes;
    return group;
  }

  function _setupScene() {
    scene = new THREE.Scene();
    // 不设置 scene.background：每个 cell 通过 setClearColor + scissor
    // 自行控制背景色（包括高亮色），scene.background 会覆盖 clearColor。

    scene.add(new THREE.AmbientLight(0xffffff, 2.5));
    var dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);
    var fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
    fillLight.position.set(-2, 1, -2);
    scene.add(fillLight);
  }

  function init(modelIds, onReady) {
    var initErr = _initThree();
    if (initErr) {
      if (onReady) onReady(initErr);
      return;
    }

    // canvas.width/canvas.height 已由调用方 (pd2d.js) 设为 CSS 像素尺寸 (res[0].width/height)，
    // 这里直接保留为 CSS 像素，作为 viewport / scissor 计算基准。
    // setSize 之后 three.js 会把 canvas.width 调整为 CSS * pixelRatio。
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(dpr);
    renderer.setSize(canvasWidth, canvasHeight, false);
    renderer.setScissorTest(true);
    renderer.autoClear = true;

    _setupScene();

    cellCount = modelIds.length;
    if (cellCount === 0) {
      if (onReady) onReady(null, []);
      return;
    }

    var loaded = 0;
    var total = cellCount;
    var catalog = require('./cabinetCatalog.js');

    for (var i = 0; i < cellCount; i++) {
      (function(idx) {
        var id = modelIds[idx];
        var path = catalog.getModelPath(id);
        if (!path) {
          loaded++;
          models[idx] = null;
          if (loaded >= total && onReady) onReady(null, models);
          return;
        }
        var data = _readGLB(path);
        if (!data) {
          loaded++;
          models[idx] = null;
          if (loaded >= total && onReady) onReady(null, models);
          return;
        }
        _parseGLB(data).then(function(gltfScene) {
          var group = _fitModelToCell(gltfScene);
          group.userData.modelId = id;
          group.userData.cellIndex = idx;
          group.visible = false;
          scene.add(group);
          models[idx] = group;
          loaded++;
          if (loaded >= total && onReady) onReady(null, models);
        }).catch(function() {
          models[idx] = null;
          loaded++;
          if (loaded >= total && onReady) onReady(null, models);
        });
      })(i);
    }
  }

  function setModels(modelIds, onReady) {
    if (!scene || !renderer) {
      if (onReady) onReady(new Error('preview not initialized'));
      return;
    }
    _clearModels();
    cellCount = modelIds.length;
    selectedIndex = -1;
    if (cellCount === 0) {
      renderAll();
      if (onReady) onReady(null, []);
      return;
    }
    var loaded = 0;
    var total = cellCount;
    var catalog = require('./cabinetCatalog.js');
    for (var i = 0; i < cellCount; i++) {
      (function(idx) {
        var id = modelIds[idx];
        var path = catalog.getModelPath(id);
        if (!path) {
          loaded++; models[idx] = null;
          if (loaded >= total) { renderAll(); if (onReady) onReady(null, models); }
          return;
        }
        var data = _readGLB(path);
        if (!data) {
          loaded++; models[idx] = null;
          if (loaded >= total) { renderAll(); if (onReady) onReady(null, models); }
          return;
        }
        _parseGLB(data).then(function(gltfScene) {
          var group = _fitModelToCell(gltfScene);
          group.userData.modelId = id;
          group.userData.cellIndex = idx;
          group.visible = false;
          scene.add(group);
          models[idx] = group;
          loaded++;
          if (loaded >= total) { renderAll(); if (onReady) onReady(null, models); }
        }).catch(function() {
          models[idx] = null;
          loaded++;
          if (loaded >= total) { renderAll(); if (onReady) onReady(null, models); }
        });
      })(i);
    }
  }

  // 为指定 cell 构造与 glbSceneManager 等价的轨道相机：
  //   theta=π, phi=π/24, radius=maxDim*2.5, target=(0, -size.y*0.25, 0)
  function _makeCellCamera(cellW, cellH, modelSize) {
    var size = modelSize || { x: 1, y: 1, z: 1 };
    var maxDim = Math.max(size.x, size.y, size.z, 0.01);

    var radius = maxDim * 2.5;
    var theta = Math.PI;
    var phi = Math.PI / 24;
    var targetX = 0;
    var targetY = -size.y * 0.25;
    var targetZ = 0;

    var sp = Math.sin(phi);
    var cp = Math.cos(phi);
    var st = Math.sin(theta);
    var ct = Math.cos(theta);

    var camera = new THREE.PerspectiveCamera(
      45,
      cellW / Math.max(cellH, 1),
      Math.max(0.01, radius * 0.05),
      Math.max(50, radius * 10)
    );
    camera.position.set(
      targetX + radius * cp * st,
      targetY + radius * sp,
      targetZ - radius * cp * ct
    );
    camera.lookAt(targetX, targetY, targetZ);
    return camera;
  }

  function _renderCell(index, highlight) {
    if (!renderer || !scene) return;
    var cellW = Math.floor(canvasWidth / cellCount);
    var cellH = canvasHeight;
    var x = index * cellW;
    var y = 0;

    renderer.setViewport(x, y, cellW, cellH);
    renderer.setScissor(x, y, cellW, cellH);

    if (highlight) {
      renderer.setClearColor(new THREE.Color(0x3a3020), 1);
    } else {
      renderer.setClearColor(new THREE.Color(0x2a2a2a), 1);
    }

    var group = models[index];
    if (!group) {
      renderer.clear();
      return;
    }

    var camera = _makeCellCamera(cellW, cellH, group.userData.size);
    renderer.render(scene, camera);
  }

  function renderAll() {
    if (!renderer || !scene) return;
    for (var i = 0; i < cellCount; i++) {
      var group = models[i];
      if (group) group.visible = true;
      _renderCell(i, i === selectedIndex);
      if (group) group.visible = false;
    }
  }

  function selectModel(index) {
    if (index === selectedIndex) return;
    selectedIndex = index;
    renderAll();
  }

  function getModelIdAt(index) {
    if (index < 0 || index >= cellCount) return null;
    var group = models[index];
    if (!group) return null;
    return group.userData.modelId;
  }

  function hitTest(tapX, tapY) {
    if (cellCount === 0) return -1;
    var cellW = canvasWidth / cellCount;
    var idx = Math.floor(tapX / cellW);
    if (idx < 0 || idx >= cellCount) return -1;
    if (!models[idx]) return -1;
    return idx;
  }

  function getModelCount() {
    return cellCount;
  }

  // 与 glbSceneManager.setDoorVisible 行为一致：遍历所有已加载模型的门板节点。
  function setDoorVisible(visible) {
    doorVisible = !!visible;
    for (var i = 0; i < models.length; i++) {
      var group = models[i];
      if (!group) continue;
      var doors = group.userData.doorMeshes || [];
      for (var j = 0; j < doors.length; j++) {
        doors[j].visible = doorVisible;
      }
    }
    renderAll();
  }

  function hasDoorMeshes() {
    for (var i = 0; i < models.length; i++) {
      var group = models[i];
      if (group && group.userData.doorMeshes && group.userData.doorMeshes.length > 0) {
        return true;
      }
    }
    return false;
  }

  function _clearModels() {
    if (!scene) return;
    for (var i = 0; i < models.length; i++) {
      if (models[i]) {
        models[i].traverse(function(node) {
          if (node.geometry) node.geometry.dispose();
          if (node.material) {
            if (Array.isArray(node.material)) {
              node.material.forEach(function(m) { m.dispose(); });
            } else {
              node.material.dispose();
            }
          }
        });
        scene.remove(models[i]);
      }
    }
    models = [];
  }

  function dispose() {
    _clearModels();
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    scene = null;
    THREE = null;
    cellCount = 0;
    selectedIndex = -1;
  }

  return {
    init: init,
    setModels: setModels,
    renderAll: renderAll,
    selectModel: selectModel,
    getModelIdAt: getModelIdAt,
    hitTest: hitTest,
    getModelCount: getModelCount,
    setDoorVisible: setDoorVisible,
    hasDoorMeshes: hasDoorMeshes,
    dispose: dispose
  };
}

module.exports = {
  createPreview: createPreview
};
