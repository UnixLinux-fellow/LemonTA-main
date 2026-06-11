var nodes = require('../utils/cabinetSceneNodes.js');

describe('buildSceneNodes', function() {
  var DEPTH = 60;

  it('empty wall: 5 trim nodes (2 main SK + 2 upper SK + top bar) when gap>0', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 260, modules: [], depth: DEPTH
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
      wallWidth: 300, wallHeight: 260,
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
      wallWidth: 300, wallHeight: 280,
      modules: [{ type: 'b', width: 50, wallX: 100 }],
      depth: DEPTH
    });
    var fillers = out.filter(function(n) {
      return n.type === 'trim' && n.y === 230 && n.x === 100;
    });
    expect(fillers.length).toBe(1);
    expect(fillers[0].w).toBe(50);
    expect(fillers[0].h).toBe(48);
    expect(fillers[0].d).toBe(DEPTH);
  });

  it('top bar spans full inner width', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 260, modules: [], depth: DEPTH
    });
    var top = out.filter(function(n) {
      return n.type === 'trim' && n.h === 2 && n.y === 258;
    });
    expect(top.length).toBe(1);
    expect(top[0].x).toBe(2);
    expect(top[0].w).toBe(296);
  });

  it('side SK columns at x=0 and x=wallWidth-2', function() {
    var out = nodes.buildSceneNodes({
      wallWidth: 300, wallHeight: 260, modules: [], depth: DEPTH
    });
    var leftMain  = out.filter(function(n) { return n.type==='trim' && n.x===0   && n.y===0   && n.h===230; });
    var rightMain = out.filter(function(n) { return n.type==='trim' && n.x===298 && n.y===0   && n.h===230; });
    var leftUpper = out.filter(function(n) { return n.type==='trim' && n.x===0   && n.y===230 && n.h===28; });
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

  it('trailing < 30cm: emits a single closing trim spanning full trailing width', function() {
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

  it('30 <= trailing < 50cm: emits scaled 50A + 4cm closing trim against right SK', function() {
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

  it('auto-fill respects wall gap: emits upper-SK fragments above scaled cabinet and closing panel', function() {
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
});
