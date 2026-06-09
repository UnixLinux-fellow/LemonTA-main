var h2c = require('../utils/homographyToCamera.js');

function makeCmCorners(W, H) {
  return [{x:0,y:H},{x:W,y:H},{x:W,y:0},{x:0,y:0}];
}

describe('homographyToCamera', function() {
  it('returns null when pxCorners is not convex', function() {
    var W = 300, Hh = 260;
    var px = [{x:10,y:10},{x:200,y:50},{x:50,y:200},{x:200,y:200}]; // self-intersecting
    var out = h2c.homographyToCamera({
      cmCorners: makeCmCorners(W, Hh),
      pxCorners: px,
      canvasWidth: 360,
      canvasHeight: 300
    });
    expect(out).toBeNull();
  });

  it('returns finite numeric fields for a valid frontal projection', function() {
    var W = 300, Hh = 260;
    var px = [{x:60,y:40},{x:300,y:40},{x:300,y:260},{x:60,y:260}];
    var out = h2c.homographyToCamera({
      cmCorners: makeCmCorners(W, Hh),
      pxCorners: px,
      canvasWidth: 360,
      canvasHeight: 300
    });
    expect(out).not.toBeNull();
    expect(Number.isFinite(out.position[0])).toBe(true);
    expect(Number.isFinite(out.position[1])).toBe(true);
    expect(Number.isFinite(out.position[2])).toBe(true);
    expect(Number.isFinite(out.lookAt[0])).toBe(true);
    expect(out.fov).toBe(60);
    expect(out.aspect).toBeCloseTo(360/300, 5);
  });

  it('round-trips: project corners through recovered camera within 2px', function() {
    var W = 300, Hh = 260;
    var fovDeg = 60, cw = 360, ch = 300;
    var f = ch / (2 * Math.tan(fovDeg*Math.PI/180/2));
    var cx = cw/2, cy = ch/2;
    var camWorld = [W/2, 130, 400];
    var target   = [W/2, Hh/2, 0];
    function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
    function nrm(v){var n=Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);return [v[0]/n,v[1]/n,v[2]/n];}
    function crs(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
    var fwd = nrm(sub(target, camWorld));
    var worldUp = [0,1,0];
    var right = nrm(crs(fwd, worldUp));
    var up = crs(right, fwd);
    function projectToPx(P) {
      var d = sub(P, camWorld);
      var xc =  right[0]*d[0] + right[1]*d[1] + right[2]*d[2];
      var yc = -(up[0]*d[0] + up[1]*d[1] + up[2]*d[2]);
      var zc = -(fwd[0]*d[0] + fwd[1]*d[1] + fwd[2]*d[2]);
      return { x: cx + f*xc/zc, y: cy + f*yc/zc };
    }
    var cmCorners = [{x:0,y:Hh},{x:W,y:Hh},{x:W,y:0},{x:0,y:0}];
    var pxCorners = [
      projectToPx([0, Hh, 0]),
      projectToPx([W, Hh, 0]),
      projectToPx([W, 0,  0]),
      projectToPx([0, 0,  0])
    ];
    var out = h2c.homographyToCamera({
      cmCorners: cmCorners, pxCorners: pxCorners,
      canvasWidth: cw, canvasHeight: ch, fovDegrees: fovDeg
    });
    expect(out).not.toBeNull();
    var fwd2 = nrm(sub(out.lookAt, out.position));
    var right2 = nrm(crs(fwd2, out.up));
    var up2 = crs(right2, fwd2);
    function reproj(P) {
      var d = sub(P, out.position);
      var xc =  right2[0]*d[0] + right2[1]*d[1] + right2[2]*d[2];
      var yc = -(up2[0]*d[0] + up2[1]*d[1] + up2[2]*d[2]);
      var zc = -(fwd2[0]*d[0] + fwd2[1]*d[1] + fwd2[2]*d[2]);
      return { x: cx + f*xc/zc, y: cy + f*yc/zc };
    }
    var cm3d = [[0,Hh,0],[W,Hh,0],[W,0,0],[0,0,0]];
    for (var i = 0; i < 4; i++) {
      var rp = reproj(cm3d[i]);
      expect(Math.abs(rp.x - pxCorners[i].x)).toBeLessThan(2);
      expect(Math.abs(rp.y - pxCorners[i].y)).toBeLessThan(2);
    }
  });
});
