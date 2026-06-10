var pf = require('../utils/photoFit.js');

describe('computePhotoAreaHeight', function() {
  // Phone: 375 × 812 (iPhone X-ish)
  var W = 375, H = 812;
  var MIN = 0.25, MAX = 0.60;

  it('square photo (1:1) → height = screenW (clamped at maxVh)', function() {
    var r = pf.computePhotoAreaHeight(1000, 1000, W, H, MIN, MAX);
    // 375/1 = 375 px; max = 812*0.6 = 487. 375 in range, but min = 812*0.25 = 203 also in range.
    expect(r).toBe(375);
  });

  it('very wide photo (16:9) → height clamped at minVh', function() {
    // 375 / (16/9) = 375 * 9 / 16 = 210.94 (just above minVh*H = 203)
    var r = pf.computePhotoAreaHeight(1600, 900, W, H, MIN, MAX);
    expect(r).toBeCloseTo(210.94, 1);
  });

  it('extremely wide photo (3:1) → clamped to minVh', function() {
    // 375/3 = 125, below 203 → clamps to 203
    var r = pf.computePhotoAreaHeight(3000, 1000, W, H, MIN, MAX);
    expect(r).toBe(H * MIN);
  });

  it('tall photo (9:16) → clamped to maxVh', function() {
    // 375 / (9/16) = 666.67, above 487 → clamps to 487.2
    var r = pf.computePhotoAreaHeight(900, 1600, W, H, MIN, MAX);
    expect(r).toBe(H * MAX);
  });

  it('handles zero dims (defaults to 1:1)', function() {
    var r = pf.computePhotoAreaHeight(0, 0, W, H, MIN, MAX);
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThan(0);
  });
});

describe('computeContainRect', function() {
  it('matching aspect: rect fills canvas exactly', function() {
    var r = pf.computeContainRect(200, 100, 400, 200);
    expect(r).toEqual({ x: 0, y: 0, w: 400, h: 200 });
  });

  it('image wider than canvas: letterbox top/bottom', function() {
    var r = pf.computeContainRect(200, 100, 400, 400); // img 2:1, canvas 1:1
    expect(r.w).toBe(400);
    expect(r.h).toBe(200);
    expect(r.x).toBe(0);
    expect(r.y).toBe(100);
  });

  it('image taller than canvas: letterbox left/right', function() {
    var r = pf.computeContainRect(100, 200, 400, 400); // img 1:2, canvas 1:1
    expect(r.h).toBe(400);
    expect(r.w).toBe(200);
    expect(r.x).toBe(100);
    expect(r.y).toBe(0);
  });

  it('handles zero img dims', function() {
    var r = pf.computeContainRect(0, 0, 200, 100);
    expect(Number.isFinite(r.w) && r.w > 0).toBe(true);
  });
});
