var perspective = require('../utils/perspective.js');

describe('computeHomography', function() {
  it('identity: 4 corners of a unit square mapped to themselves', function() {
    var src = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
    var dst = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
    var H = perspective.computeHomography(src, dst);

    var result = perspective.transformPoint(H, {x: 0.5, y: 0.5});
    expect(result.x).toBeCloseTo(0.5, 5);
    expect(result.y).toBeCloseTo(0.5, 5);
  });

  it('uniform scale: map unit square to 2x square', function() {
    var src = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
    var dst = [{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2}];
    var H = perspective.computeHomography(src, dst);

    var result = perspective.transformPoint(H, {x: 1, y: 1});
    expect(result.x).toBeCloseTo(2, 5);
    expect(result.y).toBeCloseTo(2, 5);
  });

  it('translation: map unit square to offset position', function() {
    var src = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
    var dst = [{x:10,y:20},{x:11,y:20},{x:11,y:21},{x:10,y:21}];
    var H = perspective.computeHomography(src, dst);

    var result = perspective.transformPoint(H, {x: 0.5, y: 0.5});
    expect(result.x).toBeCloseTo(10.5, 5);
    expect(result.y).toBeCloseTo(20.5, 5);
  });

  it('perspective: trapezoid transform', function() {
    var src = [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
    var dst = [{x:30,y:0},{x:70,y:0},{x:80,y:100},{x:20,y:100}];
    var H = perspective.computeHomography(src, dst);

    var topMid = perspective.transformPoint(H, {x: 50, y: 0});
    expect(topMid.x).toBeCloseTo(50, 5);
    expect(topMid.y).toBeCloseTo(0, 5);

    var botMid = perspective.transformPoint(H, {x: 50, y: 100});
    expect(botMid.x).toBeCloseTo(50, 5);
    expect(botMid.y).toBeCloseTo(100, 5);
  });

  it('returns null for degenerate collinear points', function() {
    var src = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
    var dst = [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
    var H = perspective.computeHomography(src, dst);
    expect(H).toBeNull();
  });
});

describe('transformPoint', function() {
  it('maps origin through identity-ish matrix', function() {
    var H = [[1, 0, 10], [0, 1, 20], [0, 0, 1]];
    var result = perspective.transformPoint(H, {x: 5, y: 3});
    expect(result.x).toBeCloseTo(15, 5);
    expect(result.y).toBeCloseTo(23, 5);
  });
});

describe('isConvexQuad', function() {
  it('returns true for a rectangle', function() {
    var rect = [{x:0,y:0},{x:100,y:0},{x:100,y:80},{x:0,y:80}];
    expect(perspective.isConvexQuad(rect)).toBe(true);
  });

  it('returns true for a trapezoid', function() {
    var trap = [{x:20,y:0},{x:80,y:0},{x:90,y:100},{x:10,y:100}];
    expect(perspective.isConvexQuad(trap)).toBe(true);
  });

  it('returns false for a crossed/bowtie quad', function() {
    var crossed = [{x:0,y:0},{x:100,y:0},{x:0,y:80},{x:100,y:80}];
    expect(perspective.isConvexQuad(crossed)).toBe(false);
  });
});
