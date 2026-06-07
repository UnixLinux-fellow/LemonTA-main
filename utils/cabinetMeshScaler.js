/**
 * 柜体板材厚度保持缩放算法
 *
 * 给定加载好的 GLB 柜子组，按 mesh 命名识别每块板的厚度方向：
 * Left/Right → X，Top/Bottom → Y，Back/Door → Z；其它 mesh 取最薄边为厚度方向。
 * applyScale 让柜子在三轴拉伸时，每块板的厚度保持不变。
 */

var SCALE_RANGE = { min: 0.5, max: 2.0 };

var NAMED_THICKNESS = {
  Left: 'x', Right: 'x',
  Top: 'y', Bottom: 'y',
  Back: 'z', Door: 'z'
};

function inferThicknessByName(name) {
  if (!name) return null;
  var keys = Object.keys(NAMED_THICKNESS);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (name === k || name.indexOf('_' + k) >= 0 || name.indexOf(k + '_') >= 0) {
      return NAMED_THICKNESS[k];
    }
  }
  return null;
}

function inferThicknessByGeometry(node) {
  if (!node.geometry || !node.geometry.boundingBox) return 'y';
  var bb = node.geometry.boundingBox;
  var sx = bb.max.x - bb.min.x;
  var sy = bb.max.y - bb.min.y;
  var sz = bb.max.z - bb.min.z;
  if (sx <= sy && sx <= sz) return 'x';
  if (sy <= sx && sy <= sz) return 'y';
  return 'z';
}

function inferThicknessAxis(node) {
  return inferThicknessByName(node.name) || inferThicknessByGeometry(node);
}

function preprocess(group) {
  var meta = { meshes: [] };
  group.traverse(function(node) {
    if (!node.isMesh) return;
    var thicknessAxis = inferThicknessAxis(node);
    meta.meshes.push({
      node: node,
      thicknessAxis: thicknessAxis,
      origCenter: { x: node.position.x, y: node.position.y, z: node.position.z }
    });
  });
  group.userData.scalerMeta = meta;
}

function clampScale(s) {
  if (s < SCALE_RANGE.min) return SCALE_RANGE.min;
  if (s > SCALE_RANGE.max) return SCALE_RANGE.max;
  return s;
}

function applyScale(group, scale) {
  var meta = group.userData && group.userData.scalerMeta;
  if (!meta) return;
  var sx = clampScale(scale.x);
  var sy = clampScale(scale.y);
  var sz = clampScale(scale.z);
  for (var i = 0; i < meta.meshes.length; i++) {
    var m = meta.meshes[i];
    var meshSx = sx, meshSy = sy, meshSz = sz;
    if (m.thicknessAxis === 'x') meshSx = 1;
    else if (m.thicknessAxis === 'y') meshSy = 1;
    else meshSz = 1;
    m.node.scale.set(meshSx, meshSy, meshSz);
    m.node.position.set(
      m.origCenter.x * sx,
      m.origCenter.y * sy,
      m.origCenter.z * sz
    );
  }
}

module.exports = {
  preprocess: preprocess,
  applyScale: applyScale,
  inferThicknessAxis: inferThicknessAxis,
  SCALE_RANGE: SCALE_RANGE
};
