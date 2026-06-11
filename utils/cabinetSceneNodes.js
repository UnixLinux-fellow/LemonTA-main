var SK = 2;
var CABINET_HEIGHT = 230;
var TOP_BAR_THICKNESS = 2;
var MIN_STANDARD_WIDTH = 50;
var CLOSING_PANEL_WIDTH = 4;
var SOLID_TRIM_THRESHOLD = 30;
var HIGH_WALL_THRESHOLD = 247;
var TOP_CLOSING_HEIGHT = 4;
var RIGHT_CLOSING_WIDTH = 4;

function _baseWidthFor(width) {
  return width <= 75 ? 50 : 100;
}

function _modelId(type, width) {
  return String(width) + String(type).toUpperCase();
}

function _emitCabinetStack(nodes, modelId, baseW, x, w, wallHeight, d) {
  nodes.push({
    type: 'cabinet', modelId: modelId,
    x: x, y: 0, z: 0, w: w, h: CABINET_HEIGHT, d: d
  });
  if (wallHeight >= HIGH_WALL_THRESHOLD) {
    var g1Height = wallHeight - CABINET_HEIGHT - TOP_CLOSING_HEIGHT;
    if (g1Height > 0) {
      nodes.push({
        type: 'cabinet', modelId: baseW + 'G1',
        x: x, y: CABINET_HEIGHT, z: 0,
        w: w, h: g1Height, d: d
      });
    }
    nodes.push({
      type: 'trim',
      x: x, y: wallHeight - TOP_CLOSING_HEIGHT, z: 0,
      w: w, h: TOP_CLOSING_HEIGHT, d: d
    });
  } else {
    var gap = wallHeight - CABINET_HEIGHT - TOP_BAR_THICKNESS;
    if (gap > 0) {
      nodes.push({
        type: 'trim',
        x: x, y: CABINET_HEIGHT, z: 0,
        w: w, h: gap, d: d
      });
    }
  }
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
    var baseW = _baseWidthFor(m.width);
    _emitCabinetStack(nodes, _modelId(m.type, m.width), baseW, m.wallX, m.width, Hh, d);
  }

  for (var ai = 0; ai < modules.length; ai++) {
    var am = modules[ai];
    if (!am.autoFilled) continue;
    var rx = am.wallX + am.width;
    nodes.push({
      type: 'trim',
      x: rx, y: 0, z: 0,
      w: RIGHT_CLOSING_WIDTH, h: CABINET_HEIGHT, d: d
    });
    if (Hh >= HIGH_WALL_THRESHOLD) {
      var upperH = Hh - CABINET_HEIGHT - TOP_CLOSING_HEIGHT;
      if (upperH > 0) {
        nodes.push({
          type: 'trim',
          x: rx, y: CABINET_HEIGHT, z: 0,
          w: RIGHT_CLOSING_WIDTH, h: upperH, d: d
        });
      }
    } else {
      var upperGap = Hh - CABINET_HEIGHT - TOP_BAR_THICKNESS;
      if (upperGap > 0) {
        nodes.push({
          type: 'trim',
          x: rx, y: CABINET_HEIGHT, z: 0,
          w: RIGHT_CLOSING_WIDTH, h: upperGap, d: d
        });
      }
    }
  }

  var rightmostEnd = SK;
  for (var ri = 0; ri < modules.length; ri++) {
    var rEnd = modules[ri].wallX + modules[ri].width;
    if (modules[ri].autoFilled) rEnd += RIGHT_CLOSING_WIDTH;
    if (rEnd > rightmostEnd) rightmostEnd = rEnd;
  }
  var residual = (W - SK) - rightmostEnd;
  if (residual > 0 && residual < SOLID_TRIM_THRESHOLD) {
    nodes.push({
      type: 'trim',
      x: rightmostEnd, y: 0, z: 0,
      w: residual, h: CABINET_HEIGHT, d: d
    });
    if (Hh >= HIGH_WALL_THRESHOLD) {
      var resUpper = Hh - CABINET_HEIGHT - TOP_CLOSING_HEIGHT;
      if (resUpper > 0) {
        nodes.push({ type: 'trim', x: rightmostEnd, y: CABINET_HEIGHT, z: 0, w: residual, h: resUpper, d: d });
      }
    } else {
      var resGap = Hh - CABINET_HEIGHT - TOP_BAR_THICKNESS;
      if (resGap > 0) {
        nodes.push({ type: 'trim', x: rightmostEnd, y: CABINET_HEIGHT, z: 0, w: residual, h: resGap, d: d });
      }
    }
  }

  nodes.push({ type: 'trim', x: 0,    y: 0, z: 0, w: SK, h: CABINET_HEIGHT, d: d });
  nodes.push({ type: 'trim', x: W-SK, y: 0, z: 0, w: SK, h: CABINET_HEIGHT, d: d });

  if (Hh >= HIGH_WALL_THRESHOLD) {
    var skUpperH = Hh - CABINET_HEIGHT;
    if (skUpperH > 0) {
      nodes.push({ type: 'trim', x: 0,    y: CABINET_HEIGHT, z: 0, w: SK, h: skUpperH, d: d });
      nodes.push({ type: 'trim', x: W-SK, y: CABINET_HEIGHT, z: 0, w: SK, h: skUpperH, d: d });
    }
  } else {
    var skUpperGap = Hh - CABINET_HEIGHT - TOP_BAR_THICKNESS;
    if (skUpperGap > 0) {
      nodes.push({ type: 'trim', x: 0,    y: CABINET_HEIGHT, z: 0, w: SK, h: skUpperGap, d: d });
      nodes.push({ type: 'trim', x: W-SK, y: CABINET_HEIGHT, z: 0, w: SK, h: skUpperGap, d: d });
    }
    if (W > 2*SK) {
      nodes.push({
        type: 'trim',
        x: SK, y: Hh - TOP_BAR_THICKNESS, z: 0,
        w: W - 2*SK, h: TOP_BAR_THICKNESS, d: d
      });
    }
  }

  return nodes;
}

module.exports = { buildSceneNodes: buildSceneNodes };
