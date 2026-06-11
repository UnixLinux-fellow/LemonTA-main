var fit = require('../utils/cellCameraFit.js');

// fovV = 45° → tan(22.5°) ≈ 0.4142
// fill = 0.7 (default)
// For a cell at 60×264 (cellW/cellH ≈ 0.227 — typical 6-cell layout on phone):
//   tanHalf*aspect*fill ≈ 0.4142 * 0.227 * 0.7 ≈ 0.0658
//   tanHalf*fill         ≈ 0.4142 * 0.7         ≈ 0.290

describe('computeCellCameraRadius', function() {
  var FOV = 45;
  var FILL = 0.7;

  it('100A (sx=57.6) on 60×264 cell: width-bound radius keeps model within 70%', function() {
    var size = { x: 57.638, y: 22.835, z: 88.189 };
    var r = fit.computeCellCameraRadius(size, 60, 264, FOV, FILL);
    // half-X projects to: (sx/2) / r should be <= tanHalf*aspect*fill
    var tanHalf = Math.tan((FOV * Math.PI) / 360);
    var halfWidthExtent = r * tanHalf * (60 / 264);
    expect(halfWidthExtent).toBeGreaterThanOrEqual(size.x / 2 / FILL * 0.999);
  });

  it('100A radius is significantly larger than maxDim*1.2 (width-bound, not floor-bound)', function() {
    var size = { x: 57.638, y: 22.835, z: 88.189 };
    var r = fit.computeCellCameraRadius(size, 60, 264, FOV, FILL);
    var minRadius = Math.max(size.x, size.y, size.z) * 1.2;
    expect(r).toBeGreaterThan(minRadius);
  });

  it('50A (sx=19.7) on 60×264 narrow cell: width-bound (cell aspect ≈ 0.23 forces width to dominate)', function() {
    var size = { x: 19.685, y: 23.327, z: 88.681 };
    var r = fit.computeCellCameraRadius(size, 60, 264, FOV, FILL);
    var tanHalf = Math.tan((FOV * Math.PI) / 360);
    var fullWidthExtent = 2 * r * tanHalf * (60 / 264);
    expect(size.x / fullWidthExtent).toBeLessThanOrEqual(FILL + 1e-3);
  });

  it('50A on 200×200 square cell: depth-bound, hits min radius floor', function() {
    var size = { x: 19.685, y: 23.327, z: 88.681 };
    var r = fit.computeCellCameraRadius(size, 200, 200, FOV, FILL);
    var minRadius = Math.max(size.x, size.y, size.z) * 1.2;
    expect(r).toBe(minRadius);
  });

  it('100G2 (sx=57.5, sz=23.6) on 60×264 cell: width-bound', function() {
    var size = { x: 57.520, y: 22.835, z: 23.622 };
    var r = fit.computeCellCameraRadius(size, 60, 264, FOV, FILL);
    var tanHalf = Math.tan((FOV * Math.PI) / 360);
    var widthExtent = 2 * r * tanHalf * (60 / 264);
    // Model width should fit within fill fraction of horizontal extent.
    expect(size.x / widthExtent).toBeLessThanOrEqual(FILL + 1e-3);
  });

  it('handles zero/invalid inputs without NaN', function() {
    var r = fit.computeCellCameraRadius({ x: 0, y: 0, z: 0 }, 60, 264, FOV, FILL);
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThan(0);
  });

  it('uses default FILL=0.7 when not provided', function() {
    var size = { x: 57.638, y: 22.835, z: 88.189 };
    var rDefault = fit.computeCellCameraRadius(size, 60, 264, FOV);
    var rExplicit = fit.computeCellCameraRadius(size, 60, 264, FOV, 0.7);
    expect(rDefault).toBe(rExplicit);
  });

  it('two adjacent cells of 100A do not visually overlap', function() {
    // Adjacent cells with the same model: at half-width extent each cell shows
    // the model occupying at most FILL fraction; gap between adjacent cells
    // is at least 2*(1-FILL) of cell width worth of empty space.
    var size = { x: 57.638, y: 22.835, z: 88.189 };
    var r = fit.computeCellCameraRadius(size, 60, 264, FOV, FILL);
    var tanHalf = Math.tan((FOV * Math.PI) / 360);
    var fullWidthExtent = 2 * r * tanHalf * (60 / 264);
    var modelOccupiesFraction = size.x / fullWidthExtent;
    expect(modelOccupiesFraction).toBeLessThanOrEqual(FILL + 1e-3);
  });
});

describe('computeBatchCameraRadius', function() {
  var FOV = 45;
  var FILL = 0.7;

  it('returns a single radius that fits the widest model in the batch', function() {
    var sizes = [
      { x: 19.685, y: 23.327, z: 88.681 }, // 50A
      { x: 57.638, y: 22.835, z: 88.189 }, // 100A (widest)
      { x: 39.370, y: 23.327, z: 88.681 }  // 100B
    ];
    var r = fit.computeBatchCameraRadius(sizes, 200, 200, FOV, FILL);
    var rIndividual = sizes.map(function(s) {
      return fit.computeCellCameraRadius(s, 200, 200, FOV, FILL);
    });
    expect(r).toBe(Math.max.apply(null, rIndividual));
  });

  it('all 50cm models share the same radius (driven by deepest member, not widest)', function() {
    var sizes = [
      { x: 19.685, y: 23.327, z: 88.681 }, // 50A — deep, hits minRadius floor
      { x: 19.528, y: 22.835, z: 23.465 }, // 50G1
      { x: 37.795, y: 22.835, z: 23.622 }  // 50G2 — wide but shallow
    ];
    var r = fit.computeBatchCameraRadius(sizes, 200, 264, FOV, FILL);
    var rIndividual = sizes.map(function(s) {
      return fit.computeCellCameraRadius(s, 200, 264, FOV, FILL);
    });
    expect(r).toBe(Math.max.apply(null, rIndividual));
  });

  it('empty array returns a positive default radius', function() {
    var r = fit.computeBatchCameraRadius([], 200, 200, FOV, FILL);
    expect(Number.isFinite(r) && r > 0).toBe(true);
  });

  it('null/undefined input handled gracefully', function() {
    var r = fit.computeBatchCameraRadius(null, 200, 200, FOV, FILL);
    expect(Number.isFinite(r) && r > 0).toBe(true);
  });
});
