var layout = require('../utils/cabinetLayout.js');

describe('cabinetLayout.addStandard', function() {
  it('adds first standard at wallStartCm 0', function() {
    var r = layout.addStandard([], 50, 150);
    expect(r.added).toBe(true);
    expect(r.list.length).toBe(1);
    expect(r.list[0]).toEqual({ widthCm: 50, isCustom: false, wallStartCm: 0,
                                scale: { x: 1, y: 1, z: 1 } });
  });

  it('adds second standard right after the first', function() {
    var list = [{ widthCm: 50, isCustom: false, wallStartCm: 0,
                  scale: { x: 1, y: 1, z: 1 } }];
    var r = layout.addStandard(list, 100, 200);
    expect(r.added).toBe(true);
    expect(r.list[1].widthCm).toBe(100);
    expect(r.list[1].wallStartCm).toBe(50);
  });

  it('refuses when adding would exceed wallWidth - filler', function() {
    var list = [{ widthCm: 100, isCustom: false, wallStartCm: 0,
                  scale: { x: 1, y: 1, z: 1 } }];
    var r = layout.addStandard(list, 50, 150);
    expect(r.added).toBe(false);
    expect(r.list.length).toBe(1);
  });

  it('refuses when a trailing custom already exists', function() {
    var list = [
      { widthCm: 50, isCustom: false, wallStartCm: 0,
        scale: { x: 1, y: 1, z: 1 } },
      { widthCm: 96, isCustom: true, wallStartCm: 50,
        scale: { x: 1, y: 1, z: 1 } }
    ];
    var r = layout.addStandard(list, 50, 200);
    expect(r.added).toBe(false);
  });
});

describe('cabinetLayout.finalize', function() {
  it('appends custom of remaining minus filler', function() {
    var list = [{ widthCm: 50, isCustom: false, wallStartCm: 0,
                  scale: { x: 1, y: 1, z: 1 } }];
    var r = layout.finalize(list, 150);
    expect(r.list.length).toBe(2);
    expect(r.list[1].widthCm).toBe(96);
    expect(r.list[1].isCustom).toBe(true);
    expect(r.list[1].wallStartCm).toBe(50);
  });

  it('replaces existing trailing custom with recomputed width', function() {
    var list = [
      { widthCm: 50, isCustom: false, wallStartCm: 0,
        scale: { x: 1, y: 1, z: 1 } },
      { widthCm: 96, isCustom: true, wallStartCm: 50,
        scale: { x: 1, y: 1, z: 1 } }
    ];
    var r = layout.finalize(list, 250);
    expect(r.list.length).toBe(2);
    expect(r.list[1].widthCm).toBe(196);
  });

  it('returns null when remaining < MIN_CUSTOM_WIDTH_CM', function() {
    var list = [{ widthCm: 100, isCustom: false, wallStartCm: 0,
                  scale: { x: 1, y: 1, z: 1 } }];
    var r = layout.finalize(list, 110);
    expect(r.list).toBe(null);
    expect(r.error).toBeDefined();
  });
});

describe('cabinetLayout.removeAt', function() {
  it('removes a standard and recomputes trailing custom', function() {
    var list = [
      { widthCm: 50, isCustom: false, wallStartCm: 0,
        scale: { x: 1, y: 1, z: 1 } },
      { widthCm: 100, isCustom: false, wallStartCm: 50,
        scale: { x: 1, y: 1, z: 1 } },
      { widthCm: 96, isCustom: true, wallStartCm: 150,
        scale: { x: 1, y: 1, z: 1 } }
    ];
    var r = layout.removeAt(list, 0, 250);
    expect(r.list.length).toBe(2);
    expect(r.list[0].widthCm).toBe(100);
    expect(r.list[0].wallStartCm).toBe(0);
    expect(r.list[1].isCustom).toBe(true);
    expect(r.list[1].widthCm).toBe(146);
  });

  it('removes trailing custom and leaves standards', function() {
    var list = [
      { widthCm: 50, isCustom: false, wallStartCm: 0,
        scale: { x: 1, y: 1, z: 1 } },
      { widthCm: 96, isCustom: true, wallStartCm: 50,
        scale: { x: 1, y: 1, z: 1 } }
    ];
    var r = layout.removeAt(list, 1, 150);
    expect(r.list.length).toBe(1);
    expect(r.list[0].widthCm).toBe(50);
  });
});

describe('cabinetLayout.canFitWall', function() {
  it('returns true when wall >= MIN_STD + END_FILLER', function() {
    expect(layout.canFitWall(54)).toBe(true);
    expect(layout.canFitWall(53)).toBe(false);
  });
});
