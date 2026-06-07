var catalog = require('../utils/cabinetCatalog.js');

describe('cabinetCatalog', function() {
  it('listModels returns at least one entry', function() {
    var list = catalog.listModels();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('each entry has id, label, path', function() {
    var list = catalog.listModels();
    for (var i = 0; i < list.length; i++) {
      expect(typeof list[i].id).toBe('string');
      expect(typeof list[i].label).toBe('string');
      expect(typeof list[i].path).toBe('string');
      expect(list[i].path.indexOf('.glb')).toBeGreaterThan(0);
    }
  });

  it('includes 100G1 with utils path', function() {
    var list = catalog.listModels();
    var found = list.filter(function(m) { return m.id === '100G1'; });
    expect(found.length).toBe(1);
    expect(found[0].path).toBe('utils/100G1.glb');
  });

  it('getModelPath returns path by id', function() {
    expect(catalog.getModelPath('100G1')).toBe('utils/100G1.glb');
  });

  it('getModelPath returns null for unknown id', function() {
    expect(catalog.getModelPath('NOT_REAL')).toBeNull();
  });
});
