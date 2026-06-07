require('./helpers/wx-mock.js');
var storage = require('../utils/pd3dStorage.js');

beforeEach(function() {
  // Don't reset the mock, just clear storage
  global._wxStorage.clear();
});

describe('pd3dStorage.saveLayout', function() {
  it('persists temp photo via wx.saveFile and stores layout', function(done) {
    storage.saveLayout({
      name: 'Layout A',
      photoPath: 'wxfile://temp_abc',
      wall: { width: 150, height: 260, depth: 60 },
      cabinets: [
        { widthCm: 50, isCustom: false, wallStartCm: 0,
          scale: { x: 1, y: 1, z: 1 } }
      ]
    }).then(function(saved) {
      expect(saved.id).toMatch(/^layout_/);
      expect(saved.photoPath).toMatch(/^wxfile:\/\/saved_/);
      var list = storage.listLayouts();
      expect(list.length).toBe(1);
      expect(list[0].name).toBe('Layout A');
      done();
    });
  });

  it('updates existing layout when id provided', function(done) {
    storage.saveLayout({
      name: 'A', photoPath: 'wxfile://t1',
      wall: { width: 150, height: 260, depth: 60 }, cabinets: []
    }).then(function(s1) {
      return storage.saveLayout({
        id: s1.id, name: 'A renamed',
        photoPath: s1.photoPath,
        wall: { width: 200, height: 260, depth: 60 }, cabinets: []
      });
    }).then(function(s2) {
      var list = storage.listLayouts();
      expect(list.length).toBe(1);
      expect(list[0].name).toBe('A renamed');
      expect(list[0].wall.width).toBe(200);
      done();
    });
  });

  it('does not re-save photo when path is already wxfile://saved_', function(done) {
    storage.saveLayout({
      name: 'A', photoPath: 'wxfile://saved_existing',
      wall: { width: 150, height: 260, depth: 60 }, cabinets: []
    }).then(function(s) {
      expect(s.photoPath).toBe('wxfile://saved_existing');
      done();
    });
  });
});

describe('pd3dStorage.listLayouts', function() {
  it('returns empty array when no layouts', function() {
    expect(storage.listLayouts()).toEqual([]);
  });

  it('returns summaries in createdAt desc order', function(done) {
    storage.saveLayout({
      name: 'older', photoPath: 'wxfile://t',
      wall: { width: 150, height: 260, depth: 60 }, cabinets: []
    }).then(function() {
      return new Promise(function(r) { setTimeout(r, 5); });
    }).then(function() {
      return storage.saveLayout({
        name: 'newer', photoPath: 'wxfile://t',
        wall: { width: 150, height: 260, depth: 60 }, cabinets: []
      });
    }).then(function() {
      var list = storage.listLayouts();
      expect(list[0].name).toBe('newer');
      expect(list[1].name).toBe('older');
      done();
    });
  });
});

describe('pd3dStorage.loadLayout', function() {
  it('returns full layout by id', function(done) {
    storage.saveLayout({
      name: 'A', photoPath: 'wxfile://t',
      wall: { width: 150, height: 260, depth: 60 },
      cabinets: [
        { widthCm: 50, isCustom: false, wallStartCm: 0,
          scale: { x: 1, y: 1, z: 1 } }
      ]
    }).then(function(saved) {
      var loaded = storage.loadLayout(saved.id);
      expect(loaded.name).toBe('A');
      expect(loaded.cabinets.length).toBe(1);
      done();
    });
  });

  it('returns null for unknown id', function() {
    expect(storage.loadLayout('layout_does_not_exist')).toBe(null);
  });
});

describe('pd3dStorage.deleteLayout', function() {
  it('removes layout and its photo', function(done) {
    storage.saveLayout({
      name: 'A', photoPath: 'wxfile://t',
      wall: { width: 150, height: 260, depth: 60 }, cabinets: []
    }).then(function(saved) {
      storage.deleteLayout(saved.id);
      expect(storage.listLayouts().length).toBe(0);
      expect(storage.loadLayout(saved.id)).toBe(null);
      done();
    });
  });
});
