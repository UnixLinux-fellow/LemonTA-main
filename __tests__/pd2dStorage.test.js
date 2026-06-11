require('./helpers/wx-mock.js');
var storage = require('../utils/pd2dStorage.js');

beforeEach(function() {
  global._wxStorage.clear();
});

describe('pd2dStorage.isNameUnique', function() {
  it('returns true when storage is empty', function() {
    expect(storage.isNameUnique('客厅')).toBe(true);
  });

  it('returns false when name already exists', function(done) {
    storage.saveLayout({
      name: '客厅', photoPath: '',
      wall: { width: 300, height: 260 }, modules: []
    }).then(function() {
      expect(storage.isNameUnique('客厅')).toBe(false);
      done();
    });
  });

  it('trims both sides before compare ("客厅 " equals "客厅")', function(done) {
    storage.saveLayout({
      name: '客厅', photoPath: '',
      wall: { width: 300, height: 260 }, modules: []
    }).then(function() {
      expect(storage.isNameUnique('客厅 ')).toBe(false);
      expect(storage.isNameUnique(' 客厅')).toBe(false);
      done();
    });
  });

  it('returns true when excludeId matches the only same-name record', function(done) {
    storage.saveLayout({
      name: '客厅', photoPath: '',
      wall: { width: 300, height: 260 }, modules: []
    }).then(function(saved) {
      expect(storage.isNameUnique('客厅', saved.id)).toBe(true);
      done();
    });
  });
});

describe('pd2dStorage.saveLayout compositePath', function() {
  it('persists compositePath via wx.saveFile when provided', function(done) {
    storage.saveLayout({
      name: '客厅', photoPath: '',
      compositePath: 'wxfile://temp_composite_xyz',
      wall: { width: 300, height: 260 }, modules: []
    }).then(function(saved) {
      expect(saved.compositePath).toMatch(/^wxfile:\/\/saved_/);
      var loaded = storage.loadLayout(saved.id);
      expect(loaded.compositePath).toBe(saved.compositePath);
      done();
    });
  });

  it('defaults compositePath to empty string when not provided', function(done) {
    storage.saveLayout({
      name: '卧室', photoPath: '',
      wall: { width: 300, height: 260 }, modules: []
    }).then(function(saved) {
      expect(saved.compositePath).toBe('');
      var loaded = storage.loadLayout(saved.id);
      expect(loaded.compositePath).toBe('');
      done();
    });
  });
});
