var nodes = require('../utils/cabinetSceneNodes.js');

describe('buildSceneNodes', function() {
  var DEPTH = 60;

  it('empty wall: 5 trim nodes (2 main SK + 2 upper SK + top bar) when gap>0', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 246, modules: [], depth: DEPTH
    });
    var trims = out.filter(function(n) { return n.type === 'trim'; });
    var cabinets = out.filter(function(n) { return n.type === 'cabinet'; });
    expect(cabinets.length).toBe(0);
    expect(trims.length).toBe(5);
  });

  it('empty wall, gap==0: only 3 trim nodes (2 main side + top bar)', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 232, modules: [], depth: DEPTH
    });
    var trims = out.filter(function(n) { return n.type === 'trim'; });
    expect(trims.length).toBe(3);
  });

  it('one cabinet: cabinet at (wallX, 0, 0) with width × 230 × depth', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 246,
      modules: [{ type: 'a', width: 100, wallX: 50 }],
      depth: DEPTH
    });
    var cab = out.filter(function(n) { return n.type === 'cabinet'; });
    expect(cab.length).toBe(1);
    expect(cab[0].modelId).toBe('100A');
    expect(cab[0].x).toBe(50);
    expect(cab[0].y).toBe(0);
    expect(cab[0].z).toBe(0);
    expect(cab[0].w).toBe(100);
    expect(cab[0].h).toBe(230);
    expect(cab[0].d).toBe(DEPTH);
  });

  it('one cabinet with gap>0: emits a g-* filler at (wallX, 230, 0) sized (width, gap, depth)', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 246,
      modules: [{ type: 'b', width: 50, wallX: 100 }],
      depth: DEPTH
    });
    var fillers = out.filter(function(n) {
      return n.type === 'trim' && n.y === 230 && n.x === 100;
    });
    expect(fillers.length).toBe(1);
    expect(fillers[0].w).toBe(50);
    expect(fillers[0].h).toBe(14);
    expect(fillers[0].d).toBe(DEPTH);
  });

  it('top bar spans full inner width', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 246, modules: [], depth: DEPTH
    });
    var top = out.filter(function(n) {
      return n.type === 'trim' && n.h === 2 && n.y === 244;
    });
    expect(top.length).toBe(1);
    expect(top[0].x).toBe(2);
    expect(top[0].w).toBe(296);
  });

  it('side SK columns at x=0 and x=wallWidth-2', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 246, modules: [], depth: DEPTH
    });
    var leftMain  = out.filter(function(n) { return n.type==='trim' && n.x===0   && n.y===0   && n.h===230; });
    var rightMain = out.filter(function(n) { return n.type==='trim' && n.x===298 && n.y===0   && n.h===230; });
    var leftUpper = out.filter(function(n) { return n.type==='trim' && n.x===0   && n.y===230 && n.h===14; });
    expect(leftMain.length).toBe(1);
    expect(rightMain.length).toBe(1);
    expect(leftUpper.length).toBe(1);
  });

  it('cabinet modelId derived from type+width: type uppercased', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 200, wallHeight: 260,
      modules: [{ type: 'g1', width: 50, wallX: 0 }],
      depth: DEPTH
    });
    var cab = out.filter(function(n) { return n.type === 'cabinet'; });
    expect(cab[0].modelId).toBe('50G1');
  });

  // behavior moved to pd2d.js (Task 5) / scene-nodes residual fallback (Task 8)
  xit('trailing < 30cm: emits a single closing trim spanning full trailing width', function() {
    // wallWidth=282, modules end at 252; trailing = 282 - 2 - 252 = 28 (< 30)
    var out = nodes.buildSceneNodes({
      wallWidth: 282, wallHeight: 232,
      modules: [
        { type: 'a', width: 100, wallX: 2 },
        { type: 'a', width: 100, wallX: 102 },
        { type: 'a', width: 50,  wallX: 202 }
      ],
      depth: DEPTH
    });
    var fillTrims = out.filter(function(n) {
      return n.type === 'trim' && n.x === 252 && n.y === 0 && n.h === 230;
    });
    expect(fillTrims.length).toBe(1);
    expect(fillTrims[0].w).toBe(28);
    var fillCabs = out.filter(function(n) {
      return n.type === 'cabinet' && n.modelId === '50A' && n.x === 252;
    });
    expect(fillCabs.length).toBe(0);
  });

  // behavior moved to pd2d.js (Task 5) / scene-nodes residual fallback (Task 8)
  xit('30 <= trailing < 50cm: emits scaled 50A + 4cm closing trim against right SK', function() {
    // wallWidth=240, modules end at 202; trailing = 240 - 2 - 202 = 36 (>=30, <50)
    var out = nodes.buildSceneNodes({
      wallWidth: 240, wallHeight: 232,
      modules: [
        { type: 'a', width: 100, wallX: 2 },
        { type: 'a', width: 100, wallX: 102 }
      ],
      depth: DEPTH
    });
    var fillCabs = out.filter(function(n) {
      return n.type === 'cabinet' && n.modelId === '50A' && n.x === 202;
    });
    expect(fillCabs.length).toBe(1);
    expect(fillCabs[0].w).toBe(32); // 36 - 4
    expect(fillCabs[0].h).toBe(230);
    var closing = out.filter(function(n) {
      return n.type === 'trim' && n.x === 234 && n.y === 0 && n.w === 4 && n.h === 230;
    });
    expect(closing.length).toBe(1);
  });

  it('trailing >= 50cm: no auto-fill (user can still place another cabinet)', function() {
    // wallWidth=254, modules end at 202; trailing = 254 - 2 - 202 = 50
    var out = nodes.buildSceneNodes({
      wallWidth: 254, wallHeight: 232,
      modules: [
        { type: 'a', width: 100, wallX: 2 },
        { type: 'a', width: 100, wallX: 102 }
      ],
      depth: DEPTH
    });
    var fillCabs = out.filter(function(n) {
      return n.type === 'cabinet' && n.modelId === '50A' && n.x >= 200;
    });
    expect(fillCabs.length).toBe(0);
    var fillerTrims = out.filter(function(n) {
      return n.type === 'trim' && n.y === 0 && n.x > 200 && n.x < 252;
    });
    expect(fillerTrims.length).toBe(0);
  });

  it('empty wall: no auto-fill regardless of width', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 232, modules: [], depth: DEPTH
    });
    var fillCabs = out.filter(function(n) {
      return n.type === 'cabinet' && n.modelId === '50A';
    });
    expect(fillCabs.length).toBe(0);
  });

  // behavior moved to pd2d.js (Task 5) / scene-nodes residual fallback (Task 8)
  xit('auto-fill respects wall gap: emits upper-SK fragments above scaled cabinet and closing panel', function() {
    // wallWidth=240, wallHeight=260, gap=28
    var out = nodes.buildSceneNodes({
      wallWidth: 240, wallHeight: 260,
      modules: [
        { type: 'a', width: 100, wallX: 2 },
        { type: 'a', width: 100, wallX: 102 }
      ],
      depth: DEPTH
    });
    var scaledUpper = out.filter(function(n) {
      return n.type === 'trim' && n.x === 202 && n.y === 230 && n.w === 32 && n.h === 28;
    });
    expect(scaledUpper.length).toBe(1);
    var closingUpper = out.filter(function(n) {
      return n.type === 'trim' && n.x === 234 && n.y === 230 && n.w === 4 && n.h === 28;
    });
    expect(closingUpper.length).toBe(1);
  });

  it('low wall (<247) keeps existing g-* trim filler above cabinet', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 246,
      modules: [{ type: 'a', width: 100, wallX: 50 }],
      depth: DEPTH
    });
    var fillers = out.filter(function(n) {
      return n.type === 'trim' && n.y === 230 && n.x === 50 && n.w === 100;
    });
    expect(fillers.length).toBe(1);
    expect(fillers[0].h).toBe(246 - 230 - 2);
  });
});

describe('buildSceneNodes - trailing handed off to caller', function() {
  var DEPTH = 60;

  it('does NOT auto-emit a trailing 50A when modules leave 50<gap<100 on right', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 246,
      modules: [{ type: 'a', width: 200, wallX: 2 }],
      depth: DEPTH
    });
    var fillerCabs = out.filter(function(n) {
      return n.type === 'cabinet' && n.modelId === '50A';
    });
    expect(fillerCabs.length).toBe(0);
  });

  it('does NOT auto-emit trailing trim cuboid for narrow gap (<30)', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 246,
      modules: [{ type: 'a', width: 280, wallX: 2 }],
      depth: DEPTH
    });
    var trailingTrim = out.filter(function(n) {
      return n.type === 'trim' && n.x === 282 && n.y === 0 && n.h === 230;
    });
    expect(trailingTrim.length).toBe(0);
  });
});

describe('buildSceneNodes - high wall (≥247)', function() {
  var DEPTH = 60;

  it('high wall: cabinet at y=0 + G1 cabinet at y=230 + 4cm trim at y=wallHeight-4', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 280,
      modules: [{ type: 'a', width: 100, wallX: 50 }],
      depth: DEPTH
    });
    var cab = out.filter(function(n) { return n.type === 'cabinet'; });
    expect(cab.length).toBe(2);
    var main = cab.filter(function(n) { return n.modelId === '100A'; })[0];
    var g1   = cab.filter(function(n) { return n.modelId === '100G1'; })[0];
    expect(main.y).toBe(0);
    expect(main.h).toBe(230);
    expect(g1).toBeDefined();
    expect(g1.y).toBe(230);
    expect(g1.h).toBe(280 - 230 - 4);
    expect(g1.x).toBe(50);
    expect(g1.w).toBe(100);
    var topClose = out.filter(function(n) {
      return n.type === 'trim' && n.x === 50 && n.y === 280 - 4 && n.h === 4 && n.w === 100;
    });
    expect(topClose.length).toBe(1);
  });

  it('high wall, 50cm cabinet: G1 modelId is 50G1', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 260,
      modules: [{ type: 'b', width: 50, wallX: 100 }],
      depth: DEPTH
    });
    var g1 = out.filter(function(n) { return n.type==='cabinet' && n.modelId==='50G1'; });
    expect(g1.length).toBe(1);
    expect(g1[0].h).toBe(260 - 230 - 4);
  });

  it('boundary: wallHeight=247 triggers high wall logic (G1 cabinet emitted)', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 247,
      modules: [{ type: 'a', width: 100, wallX: 50 }],
      depth: 60
    });
    var g1 = out.filter(function(n) { return n.type==='cabinet' && n.modelId==='100G1'; });
    expect(g1.length).toBe(1);
    expect(g1[0].h).toBe(247 - 230 - 4);
  });

  it('high wall: no full-wall 2cm top bar', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 280, modules: [], depth: 60
    });
    var topBar = out.filter(function(n) {
      return n.type === 'trim' && n.x === SK_VAL() && n.y === 278 && n.h === 2;
    });
    expect(topBar.length).toBe(0);
  });

  it('high wall, empty wall: SK columns span full height in two pieces', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 280, modules: [], depth: 60
    });
    var leftMain  = out.filter(function(n) { return n.type==='trim' && n.x===0 && n.y===0   && n.h===230 && n.w===2; });
    var leftUpper = out.filter(function(n) { return n.type==='trim' && n.x===0 && n.y===230 && n.h===50  && n.w===2; });
    expect(leftMain.length).toBe(1);
    expect(leftUpper.length).toBe(1);
  });

  function SK_VAL() { return 2; }
});
