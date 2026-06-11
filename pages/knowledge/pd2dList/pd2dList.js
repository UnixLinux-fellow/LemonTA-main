/**
 * pages/knowledge/pd2dList/pd2dList.js
 *
 * PD2D 已保存方案列表页 —— 视觉与 pages/design/design 保持一致。
 *
 * 数据来源：utils/pd2dStorage.js（wx.setStorageSync('pd2d_layouts')）。
 * 与 pages/design/design 的差异：
 *   - 不依赖云端登录；直接从本地存储读
 *   - 顶部「开始新设计」跳到 PD2D 页面（pages/knowledge/pd2d/pd2d），而非 preset
 *   - 点击方案卡片时，把本地方案桥接到 app.globalData.designs（构造一个 _id），
 *     然后跳到现有 cost.js（packageDesign/cost/cost）—— cost 页只认 _id，
 *     桥接后便可直接复用，无需修改 cost.js
 */
var app = getApp();
var storage = require('../../../utils/pd2dStorage.js');

var BRIDGE_PREFIX = 'pd2dlocal:'; // 桥接到 cost 页的合成 _id 前缀

Page({
  data: {
    layouts: [],
    statusBarHeight: 20,
    navBarHeight: 44,
    showDeleteModal: false,
    pendingDeleteId: ''
  },

  onLoad: function(options) {
    try {
      var sysInfo = wx.getWindowInfo();
      var menuBtn = wx.getMenuButtonBoundingClientRect();
      var sb = sysInfo.statusBarHeight || 20;
      var nb = (menuBtn.top - sb) * 2 + menuBtn.height;
      this.setData({ statusBarHeight: sb, navBarHeight: nb });
    } catch (e) {}

    if (options && options.openCostId) {
      var raw = decodeURIComponent(options.openCostId);
      var realId = raw.indexOf(BRIDGE_PREFIX) === 0
        ? raw.substring(BRIDGE_PREFIX.length)
        : raw;
      this._refresh();
      var rec = storage.loadLayout(realId);
      if (rec) {
        var self = this;
        setTimeout(function() { self._navigateToCost(rec); }, 50);
      }
    }
  },

  onShow: function() {
    this._refresh();
  },

  _refresh: function() {
    var list = storage.listLayouts();
    // 转成卡片数据：name + 描述
    var cards = list.map(function(l) {
      var w = (l.wall && l.wall.width) || 0;
      var h = (l.wall && l.wall.height) || 0;
      return {
        id: l.id,
        name: l.name,
        desc: '墙面 ' + w + '×' + h + 'cm · ' + (l.moduleCount || 0) + ' 个柜体'
      };
    });
    this.setData({ layouts: cards });
  },

  goNewDesign: function() {
    wx.navigateTo({
      url: '/pages/knowledge/pd2d/pd2d',
      fail: function() { wx.showToast({ title: '跳转失败', icon: 'none' }); }
    });
  },

  // 把本地方案桥接到 globalData.designs 并 navigateTo cost 页
  _navigateToCost: function(rec) {
    if (!rec) return;
    var bridgeId = BRIDGE_PREFIX + rec.id;
    var preview = rec.compositePath || rec.photoPath || '';
    var design = {
      _id: bridgeId,
      name: rec.name,
      wallWidth: (rec.wall && rec.wall.width) || 0,
      wallHeight: (rec.wall && rec.wall.height) || 0,
      modules: rec.modules || [],
      previewImage: preview,
      cornerType: 'none',
      createTime: rec.createdAt
    };
    if (!app.globalData.designs) app.globalData.designs = [];
    var existing = app.globalData.designs;
    var found = false;
    for (var i = 0; i < existing.length; i++) {
      if (existing[i]._id === bridgeId) { existing[i] = design; found = true; break; }
    }
    if (!found) existing.push(design);
    app.globalData.currentDesignPreview = preview;
    wx.navigateTo({
      url: '/packageDesign/cost/cost?id=' + encodeURIComponent(bridgeId),
      fail: function() { wx.showToast({ title: '跳转失败', icon: 'none' }); }
    });
  },

  openLayout: function(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    var rec = storage.loadLayout(id);
    if (!rec) {
      wx.showToast({ title: '方案不存在', icon: 'none' });
      this._refresh();
      return;
    }
    this._navigateToCost(rec);
  },

  onDeleteTap: function(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    this.setData({ showDeleteModal: true, pendingDeleteId: id });
  },

  cancelDelete: function() {
    this.setData({ showDeleteModal: false, pendingDeleteId: '' });
  },

  confirmDelete: function() {
    var id = this.data.pendingDeleteId;
    if (id) {
      try { storage.deleteLayout(id); } catch (e) {}
    }
    this.setData({ showDeleteModal: false, pendingDeleteId: '' });
    this._refresh();
  },

  goBack: function() { wx.navigateBack({ delta: 1 }); },

  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('pd2d', this, res);
  },
  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('pd2d', this);
  }
});
