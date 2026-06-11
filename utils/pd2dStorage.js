/**
 * PD2D 方案本地存储
 *
 * 通过 wx.setStorageSync 保存方案元数据 + 模块布置 + 角点 + 墙面尺寸；
 * 通过 wx.saveFile 持久化对应的墙面照片，使临时路径升级为可长期访问。
 *
 * 数据结构：
 *   {
 *     id, name, createdAt, updatedAt,
 *     photoPath,         // 持久化后的本地路径，可能为空（用户未上传照片）
 *     wall: { width, height },
 *     corners: [{x,y}*4],    // 透视四角（CSS px，相对 canvas）
 *     spaceName,
 *     selectedWidth, selectedType, selectedModelId,
 *     doorVisible,
 *     modules: [{ type, width, wallX, isStandard }, ...]
 *   }
 */
var STORAGE_KEY = 'pd2d_layouts';

function readAll() {
  var raw = wx.getStorageSync(STORAGE_KEY);
  if (!raw || !Array.isArray(raw)) return [];
  return raw;
}

function writeAll(list) { wx.setStorageSync(STORAGE_KEY, list); }

function genId() {
  return 'pd2d_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

function persistPhoto(tempPath) {
  return new Promise(function(resolve) {
    if (!tempPath) { resolve(''); return; }
    // 已经是持久化路径
    if (tempPath.indexOf('wxfile://saved_') === 0 ||
        tempPath.indexOf('http://usr/') === 0 ||
        tempPath.indexOf('store_') >= 0) {
      resolve(tempPath); return;
    }
    wx.saveFile({
      tempFilePath: tempPath,
      success: function(res) { resolve(res.savedFilePath); },
      fail: function() { resolve(''); } // 持久化失败时丢弃路径，避免下次读取报错
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
      wall: { width: layout.wall.width, height: layout.wall.height },
      spaceName: layout.spaceName || '',
      corners: (layout.corners || []).map(function(c){ return { x: c.x, y: c.y }; }),
      selectedWidth: layout.selectedWidth,
      selectedType: layout.selectedType,
      selectedModelId: layout.selectedModelId,
      doorVisible: !!layout.doorVisible,
      modules: (layout.modules || []).map(function(m) {
        return {
          type: m.type, width: m.width,
          wallX: m.wallX, isStandard: m.isStandard !== false
        };
      })
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
      moduleCount: (l.modules || []).length
    };
  });
  summaries.sort(function(a, b) { return b.createdAt - a.createdAt; });
  return summaries;
}

function loadLayout(id) {
  var all = readAll();
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return null;
}

function deleteLayout(id) {
  var all = readAll();
  var photoPath = null;
  var kept = [];
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) photoPath = all[i].photoPath;
    else kept.push(all[i]);
  }
  writeAll(kept);
  if (photoPath && photoPath.indexOf('wxfile://') === 0) {
    try { wx.removeSavedFile({ filePath: photoPath, success: function(){}, fail: function(){} }); } catch (e) {}
  }
}

function isNameUnique(name, excludeId) {
  var target = (name || '').trim();
  if (!target) return true;
  var all = readAll();
  for (var i = 0; i < all.length; i++) {
    if (excludeId && all[i].id === excludeId) continue;
    var existing = (all[i].name || '').trim();
    if (existing === target) return false;
  }
  return true;
}

module.exports = {
  saveLayout: saveLayout,
  isNameUnique: isNameUnique,
  listLayouts: listLayouts,
  loadLayout: loadLayout,
  deleteLayout: deleteLayout,
  STORAGE_KEY: STORAGE_KEY
};
