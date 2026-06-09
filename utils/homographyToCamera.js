var perspective = require('./perspective.js');

function _mat3MulVec(M, v) {
  return [
    M[0][0]*v[0] + M[0][1]*v[1] + M[0][2]*v[2],
    M[1][0]*v[0] + M[1][1]*v[1] + M[1][2]*v[2],
    M[2][0]*v[0] + M[2][1]*v[1] + M[2][2]*v[2]
  ];
}
function _norm3(v) { return Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]); }
function _scale3(v, s) { return [v[0]*s, v[1]*s, v[2]*s]; }
function _cross(a, b) {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function _det3(M) {
  return M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])
       - M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])
       + M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);
}
function _allFinite(arr) {
  for (var i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) return false;
  return true;
}

function homographyToCamera(opts) {
  var cmCorners = opts.cmCorners;
  var pxCorners = opts.pxCorners;
  var cw = opts.canvasWidth;
  var ch = opts.canvasHeight;
  var fovDeg = opts.fovDegrees != null ? opts.fovDegrees : 60;

  if (!perspective.isConvexQuad(pxCorners)) return null;

  var H = perspective.computeHomography(cmCorners, pxCorners);
  if (!H) return null;

  var fovRad = fovDeg * Math.PI / 180;
  var f = ch / (2 * Math.tan(fovRad / 2));
  var cx = cw / 2;
  var cy = ch / 2;
  var Kinv = [
    [1/f, 0,   -cx/f],
    [0,   1/f, -cy/f],
    [0,   0,   1]
  ];

  var h1 = [H[0][0], H[1][0], H[2][0]];
  var h2 = [H[0][1], H[1][1], H[2][1]];
  var h3 = [H[0][2], H[1][2], H[2][2]];

  var Kh1 = _mat3MulVec(Kinv, h1);
  var Kh2 = _mat3MulVec(Kinv, h2);
  var Kh3 = _mat3MulVec(Kinv, h3);

  var lambda = _norm3(Kh1);
  if (!Number.isFinite(lambda) || lambda < 1e-12) return null;
  var inv = 1 / lambda;
  var r1 = _scale3(Kh1, inv);
  var r2 = _scale3(Kh2, inv);
  var t  = _scale3(Kh3, inv);

  // Cheirality: pick lambda sign so the wall plane sits in front of the camera (t[2] > 0).
  if (t[2] < 0) {
    r1 = _scale3(r1, -1);
    r2 = _scale3(r2, -1);
    t  = _scale3(t, -1);
  }

  var r3 = _cross(r1, r2);

  var R = [
    [r1[0], r2[0], r3[0]],
    [r1[1], r2[1], r3[1]],
    [r1[2], r2[2], r3[2]]
  ];

  if (_det3(R) < 0) {
    r3 = [-r3[0], -r3[1], -r3[2]];
    R[0][2] = r3[0]; R[1][2] = r3[1]; R[2][2] = r3[2];
  }

  var camPos = [
    -(R[0][0]*t[0] + R[1][0]*t[1] + R[2][0]*t[2]),
    -(R[0][1]*t[0] + R[1][1]*t[1] + R[2][1]*t[2]),
    -(R[0][2]*t[0] + R[1][2]*t[1] + R[2][2]*t[2])
  ];
  var fwd = [R[2][0], R[2][1], R[2][2]];
  var up  = [R[1][0], R[1][1], R[1][2]];

  var lookAt = [camPos[0]+fwd[0], camPos[1]+fwd[1], camPos[2]+fwd[2]];

  if (!_allFinite(camPos.concat(lookAt).concat(up))) return null;

  var tNorm = _norm3(t);
  return {
    position: camPos,
    lookAt: lookAt,
    up: up,
    fov: fovDeg,
    aspect: cw / ch,
    near: Math.max(1, tNorm * 0.05),
    far:  Math.max(2000, tNorm * 10)
  };
}

module.exports = { homographyToCamera: homographyToCamera };
