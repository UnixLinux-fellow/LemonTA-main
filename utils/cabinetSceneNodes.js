var SK = 2;
var CABINET_HEIGHT = 230;
var TOP_BAR_THICKNESS = 2;

function _modelId(type, width) {
  return String(width) + String(type).toUpperCase();
}

function buildSceneNodes(opts) {
  var W = opts.wallWidth;
  var Hh = opts.wallHeight;
  var modules = opts.modules || [];
  var d = opts.depth;
  var gap = Math.max(Hh - CABINET_HEIGHT - TOP_BAR_THICKNESS, 0);
  var nodes = [];

  for (var i = 0; i < modules.length; i++) {
    var m = modules[i];
    nodes.push({
      type: 'cabinet',
      modelId: _modelId(m.type, m.width),
      x: m.wallX, y: 0, z: 0,
      w: m.width, h: CABINET_HEIGHT, d: d
    });
    if (gap > 0) {
      nodes.push({
        type: 'trim',
        x: m.wallX, y: CABINET_HEIGHT, z: 0,
        w: m.width, h: gap, d: d
      });
    }
  }

  nodes.push({ type: 'trim', x: 0,    y: 0, z: 0, w: SK, h: CABINET_HEIGHT, d: d });
  nodes.push({ type: 'trim', x: W-SK, y: 0, z: 0, w: SK, h: CABINET_HEIGHT, d: d });

  if (gap > 0) {
    nodes.push({ type: 'trim', x: 0,    y: CABINET_HEIGHT, z: 0, w: SK, h: gap, d: d });
    nodes.push({ type: 'trim', x: W-SK, y: CABINET_HEIGHT, z: 0, w: SK, h: gap, d: d });
  }

  if (W > 2*SK) {
    nodes.push({
      type: 'trim',
      x: SK, y: Hh - TOP_BAR_THICKNESS, z: 0,
      w: W - 2*SK, h: TOP_BAR_THICKNESS, d: d
    });
  }

  return nodes;
}

module.exports = { buildSceneNodes: buildSceneNodes };
