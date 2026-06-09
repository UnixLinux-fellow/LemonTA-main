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
});
