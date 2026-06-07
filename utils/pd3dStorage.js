/**
 * PD3D 方案本地存储
 *
 * 通过 wx.setStorageSync 保存方案元数据 + cabinets，
 * 通过 wx.saveFile 持久化方案对应的照片。
 */

var STORAGE_KEY = 'pd3d_layouts';

function readAll() {
  var raw = wx.getStorageSync(STORAGE_KEY);
  if (!raw || !Array.isArray(raw)) return [];
  return raw;
}

function writeAll(list) {
  wx.setStorageSync(STORAGE_KEY, list);
}

function genId() {
  return 'layout_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

function persistPhoto(tempPath) {
  return new Promise(function(resolve, reject) {
    if (!tempPath) {
      resolve('');
      return;
    }
    if (tempPath.indexOf('wxfile://saved_') === 0 ||
        tempPath.indexOf('http://usr/') === 0 ||
        tempPath.indexOf('store_') >= 0) {
      resolve(tempPath);
      return;
    }
    wx.saveFile({
      tempFilePath: tempPath,
      success: function(res) { resolve(res.savedFilePath); },
      fail: function(err) { reject(err); }
    });
  });
}

function saveLayout(layout) {
  return persistPhoto(layout.photoPath).then(function(savedPath) {
    var all = readAll();
    var now = Date.now();
    var id = layout.id || genId();
    var record = {
      id: id,
      name: layout.name || '未命名方案',
      createdAt: layout.createdAt || now,
      updatedAt: now,
      photoPath: savedPath,
      wall: {
        width: layout.wall.width,
        height: layout.wall.height,
        depth: layout.wall.depth
      },
      cabinets: layout.cabinets || []
    };
    var existingIdx = -1;
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) { existingIdx = i; break; }
    }
    if (existingIdx >= 0) {
      record.createdAt = all[existingIdx].createdAt;
      all[existingIdx] = record;
    } else {
      all.push(record);
    }
    writeAll(all);
    return { id: record.id, photoPath: record.photoPath };
  });
}

function listLayouts() {
  var all = readAll();
  var summaries = all.map(function(l) {
    return {
      id: l.id,
      name: l.name,
      photoPath: l.photoPath,
      wall: l.wall,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      cabinetCount: (l.cabinets || []).length
    };
  });
  summaries.sort(function(a, b) { return b.createdAt - a.createdAt; });
  return summaries;
}

function loadLayout(id) {
  var all = readAll();
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) return all[i];
  }
  return null;
}

function deleteLayout(id) {
  var all = readAll();
  var photoPath = null;
  var kept = [];
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) {
      photoPath = all[i].photoPath;
    } else {
      kept.push(all[i]);
    }
  }
  writeAll(kept);
  if (photoPath && photoPath.indexOf('wxfile://') === 0) {
    try {
      wx.removeSavedFile({ filePath: photoPath, success: function() {}, fail: function() {} });
    } catch (e) {}
  }
}

module.exports = {
  saveLayout: saveLayout,
  listLayouts: listLayouts,
  loadLayout: loadLayout,
  deleteLayout: deleteLayout,
  STORAGE_KEY: STORAGE_KEY
};
