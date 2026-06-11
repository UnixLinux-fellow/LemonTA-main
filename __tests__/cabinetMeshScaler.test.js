var scaler = require('../utils/cabinetMeshScaler.js');

function mockMesh(name, center, size) {
  return {
    isMesh: true,
    name: name,
    position: { x: center.x, y: center.y, z: center.z,
                set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    scale: { x: 1, y: 1, z: 1,
             set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    geometry: {
      boundingBox: {
        min: { x: -size.x / 2, y: -size.y / 2, z: -size.z / 2 },
        max: { x: size.x / 2, y: size.y / 2, z: size.z / 2 }
      }
    },
    parent: null
  };
}

function mockGroup(meshes) {
  return {
    userData: {},
    children: meshes,
    traverse: function(fn) {
      fn(this);
      for (var i = 0; i < this.children.length; i++) fn(this.children[i]);
    }
  };
}

describe('cabinetMeshScaler.preprocess', function() {
  it('records mesh meta with name-based thickness axis', function() {
    var meshes = [
      mockMesh('Left', { x: -0.3, y: 1.0, z: 0.3 }, { x: 0.018, y: 2.0, z: 0.6 }),
      mockMesh('Right', { x: 0.3, y: 1.0, z: 0.3 }, { x: 0.018, y: 2.0, z: 0.6 }),
      mockMesh('Top', { x: 0, y: 2.0, z: 0.3 }, { x: 0.6, y: 0.018, z: 0.6 }),
      mockMesh('Bottom', { x: 0, y: 0.05, z: 0.3 }, { x: 0.6, y: 0.018, z: 0.6 }),
      mockMesh('Back', { x: 0, y: 1.0, z: 0.01 }, { x: 0.6, y: 2.0, z: 0.005 }),
      mockMesh('Door', { x: 0, y: 1.0, z: 0.6 }, { x: 0.6, y: 2.0, z: 0.018 })
    ];
    var g = mockGroup(meshes);
    scaler.preprocess(g);
    expect(g.userData.scalerMeta).toBeDefined();
    var metaList = g.userData.scalerMeta.meshes;
    var byName = {};
    for (var i = 0; i < metaList.length; i++) byName[metaList[i].node.name] = metaList[i];
    expect(byName['Left'].thicknessAxis).toBe('x');
    expect(byName['Right'].thicknessAxis).toBe('x');
    expect(byName['Top'].thicknessAxis).toBe('y');
    expect(byName['Bottom'].thicknessAxis).toBe('y');
    expect(byName['Back'].thicknessAxis).toBe('z');
    expect(byName['Door'].thicknessAxis).toBe('z');
  });

  it('falls back to thinnest axis for unnamed mesh', function() {
    var meshes = [
      mockMesh('Geom3D', { x: 0, y: 0.5, z: 0.3 }, { x: 0.5, y: 0.018, z: 0.5 })
    ];
    var g = mockGroup(meshes);
    scaler.preprocess(g);
    expect(g.userData.scalerMeta.meshes[0].thicknessAxis).toBe('y');
  });

  it('falls back to thinnest axis when name does not match known panels', function() {
    var meshes = [
      mockMesh('PushLatch', { x: 0.1, y: 1.0, z: 0.6 }, { x: 0.05, y: 0.05, z: 0.02 })
    ];
    var g = mockGroup(meshes);
    scaler.preprocess(g);
    expect(g.userData.scalerMeta.meshes[0].thicknessAxis).toBe('z');
  });
});

describe('cabinetMeshScaler.applyScale', function() {
  it('keeps thickness axis at 1 and scales other axes for Left panel', function() {
    var leftMesh = mockMesh('Left', { x: -0.3, y: 1.0, z: 0.3 },
                             { x: 0.018, y: 2.0, z: 0.6 });
    var g = mockGroup([leftMesh]);
    scaler.preprocess(g);
    scaler.applyScale(g, { x: 2, y: 1.5, z: 1 });
    expect(leftMesh.scale.x).toBe(1);
    expect(leftMesh.scale.y).toBe(1.5);
    expect(leftMesh.scale.z).toBe(1);
    expect(leftMesh.position.x).toBeCloseTo(-0.6, 5);
    expect(leftMesh.position.y).toBeCloseTo(1.5, 5);
    expect(leftMesh.position.z).toBeCloseTo(0.3, 5);
  });

  it('keeps thickness axis at 1 and scales other axes for Top panel', function() {
    var topMesh = mockMesh('Top', { x: 0, y: 2.0, z: 0.3 },
                            { x: 0.6, y: 0.018, z: 0.6 });
    var g = mockGroup([topMesh]);
    scaler.preprocess(g);
    scaler.applyScale(g, { x: 2, y: 1.5, z: 1.2 });
    expect(topMesh.scale.x).toBe(2);
    expect(topMesh.scale.y).toBe(1);
    expect(topMesh.scale.z).toBe(1.2);
    expect(topMesh.position.y).toBeCloseTo(3.0, 5);
  });

  it('exposes SCALE_RANGE bounds', function() {
    expect(scaler.SCALE_RANGE.min).toBe(0.5);
    expect(scaler.SCALE_RANGE.max).toBe(2.0);
  });
});
