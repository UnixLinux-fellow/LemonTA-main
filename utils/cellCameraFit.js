/**
 * Compute orbit-camera radius so an AABB-sized model fits inside a cell viewport
 * with margin on both axes. Pure function, unit-tested.
 *
 * Geometry: PerspectiveCamera with vertical FOV looking at the model from
 * radius away. Vertical half-extent that fits = radius * tan(fovV/2).
 * Horizontal half-extent = radius * tan(fovV/2) * aspect.
 *
 * To fit width sx with margin m and height sy with margin m we need:
 *   radius >= (sx/2) / (tan(fovV/2) * aspect * m)
 *   radius >= (sy/2) / (tan(fovV/2) * m)
 * Take the larger.
 */
function computeCellCameraRadius(size, cellW, cellH, fovDegrees, fillFraction) {
  var sx = (size && size.x) || 0;
  var sy = (size && size.y) || 0;
  var sz = (size && size.z) || 0;

  var fov = fovDegrees > 0 ? fovDegrees : 45;
  var fill = fillFraction > 0 && fillFraction <= 1 ? fillFraction : 0.7;
  var w = cellW > 0 ? cellW : 1;
  var h = cellH > 0 ? cellH : 1;
  var aspect = w / h;

  var tanHalfFov = Math.tan((fov * Math.PI) / 360);
  if (tanHalfFov < 1e-6) tanHalfFov = 1e-6;

  // Project AABB along view direction (theta=PI, phi=PI/24): camera looks
  // approximately at -Z, so on-screen extents come primarily from sx (horiz)
  // and sy (vert). Depth (sz) doesn't affect framing, only foreshortens.
  var halfW = sx / 2;
  var halfH = sy / 2;

  var rByWidth = halfW / (tanHalfFov * aspect * fill);
  var rByHeight = halfH / (tanHalfFov * fill);
  var radius = Math.max(rByWidth, rByHeight);

  // Floor at maxDim*1.2 so depth-dominant (sz>>sx,sy) models still get a
  // sane camera distance and lights look reasonable.
  var maxDim = Math.max(sx, sy, sz, 0.01);
  var minRadius = maxDim * 1.2;
  if (radius < minRadius) radius = minRadius;

  return radius;
}

module.exports = {
  computeCellCameraRadius: computeCellCameraRadius,
  computeBatchCameraRadius: computeBatchCameraRadius
};

/**
 * Compute a single radius that fits the largest model in a batch into a cell,
 * so all cells share the same camera distance and visual scale matches across
 * different model sizes (e.g. 50cm and 100cm cabinets render at the same on-screen height).
 */
function computeBatchCameraRadius(sizes, cellW, cellH, fovDegrees, fillFraction) {
  if (!sizes || sizes.length === 0) {
    return computeCellCameraRadius({ x: 100, y: 100, z: 100 }, cellW, cellH, fovDegrees, fillFraction);
  }
  var maxR = 0;
  for (var i = 0; i < sizes.length; i++) {
    var r = computeCellCameraRadius(sizes[i], cellW, cellH, fovDegrees, fillFraction);
    if (r > maxR) maxR = r;
  }
  return maxR;
}
