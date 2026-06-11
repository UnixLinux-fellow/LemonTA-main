var SK = 2;
var CABINET_HEIGHT = 230;
var TOP_BAR_THICKNESS = 2;
var MIN_STANDARD_WIDTH = 50;
var CLOSING_PANEL_WIDTH = 4;
var SOLID_TRIM_THRESHOLD = 30;

function _modelId(type, width) {
  return String(width) + String(type).toUpperCase();
}

function _emitCabinetWithGap(nodes, modelId, x, w, gap, d) {
  nodes.push({
    type: 'cabinet', modelId: modelId,
    x: x, y: 0, z: 0,
    w: w, h: CABINET_HEIGHT, d: d
  });
  if (gap > 0) {
    nodes.push({
      type: 'trim',
      x: x, y: CABINET_HEIGHT, z: 0,
      w: w, h: gap, d: d
    });
  }
}

function _emitTrimWithGap(nodes, x, w, gap, d) {
  nodes.push({
    type: 'trim',
    x: x, y: 0, z: 0,
    w: w, h: CABINET_HEIGHT, d: d
  });
  if (gap > 0) {
    nodes.push({
      type: 'trim',
      x: x, y: CABINET_HEIGHT, z: 0,
      w: w, h: gap, d: d
    });
  }
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
    _emitCabinetWithGap(nodes, _modelId(m.type, m.width), m.wallX, m.width, gap, d);
  }

  if (modules.length > 0) {
    var rightmostEnd = 0;
    for (var p = 0; p < modules.length; p++) {
      var endX = modules[p].wallX + modules[p].width;
      if (endX > rightmostEnd) rightmostEnd = endX;
    }
    var trailing = (W - SK) - rightmostEnd;
    if (trailing > 0 && trailing < MIN_STANDARD_WIDTH) {
      if (trailing < SOLID_TRIM_THRESHOLD) {
        _emitTrimWithGap(nodes, rightmostEnd, trailing, gap, d);
      } else {
        var scaledW = trailing - CLOSING_PANEL_WIDTH;
        _emitCabinetWithGap(nodes, '50A', rightmostEnd, scaledW, gap, d);
        _emitTrimWithGap(nodes, rightmostEnd + scaledW, CLOSING_PANEL_WIDTH, gap, d);
      }
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
