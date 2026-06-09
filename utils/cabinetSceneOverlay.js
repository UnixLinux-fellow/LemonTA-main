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
  function update(state) { /* implemented in Task 6 */ }
  function setDoorVisible(v) { doorVisible = !!v; /* implemented in Task 6 */ }

  return {
    init: init,
    update: update,
    setDoorVisible: setDoorVisible,
    resize: resize,
    dispose: dispose
  };
}

module.exports = { createOverlay: createOverlay };
