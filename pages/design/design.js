var app = getApp();

Page({
  data: {
    isLoggedIn: false,
    designs: [],
    loading: false,
    showDeleteModal: false,
    deleteIndex: -1,
    deleteId: '',
    statusBarHeight: 20,
    navBarHeight: 44
  },

  onLoad: function() {
    // 获取系统信息设置导航栏高度
    try {
      var sysInfo = wx.getWindowInfo();
      var menuBtn = wx.getMenuButtonBoundingClientRect();
      var statusBarHeight = sysInfo.statusBarHeight || 20;
      var navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
      this.setData({ statusBarHeight: statusBarHeight, navBarHeight: navBarHeight });
    } catch (e) {
      this.setData({ statusBarHeight: 20, navBarHeight: 44 });
    }
    this.checkLogin();
  },

  onShow: function() {
    this.checkLogin();
    this.loadDesigns();
  },

  checkLogin: function() {
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn
    });
  },

  loadDesigns: function() {
    var self = this;
    var memList = app.globalData.designs || [];
    // 内存有就先直接显示，保证切页回来无闪烁
    if (memList.length) {
      self.setData({ designs: memList });
    }

    // 性能优化：短时间内（2s）重复进入本页（tab 来回切）不再打云请求
    var now = Date.now();
    if (self._lastRefreshAt && (now - self._lastRefreshAt) < 2000) {
      return;
    }
    self._lastRefreshAt = now;

    // 后台再拉一次云端最新列表，覆盖显示
    // 注意：不显示 loading 遮罩，避免首次有缓存的情况下出现无意义转圈
    if (memList.length === 0) {
      self.setData({ loading: true });
    }
    app.refreshDesigns().then(function(list) {
      self.setData({ designs: list || [], loading: false });
    });
  },

  goRegister: function() {
    wx.navigateTo({ url: '/packageDesign/register/register' });
  },

  startNewDesign: function() {
    if (this.data.designs.length >= 30) {
      wx.showModal({
        title: '提示',
        content: '设计库已满30条，需删除部分设计后新建',
        showCancel: false
      });
      return;
    }
    wx.navigateTo({ url: '/packageDesign/preset/preset' });
  },

  openDesign: function(e) {
    // 云端数据按 _id 打开，避免因列表排序/刷新导致 index 失效
    var id = e.currentTarget.dataset.id;
    if (!id) {
      // 兼容老结构仍传 index 的情况
      var index = e.currentTarget.dataset.index;
      wx.navigateTo({ url: '/packageDesign/cost/cost?index=' + index });
      return;
    }
    wx.navigateTo({ url: '/packageDesign/cost/cost?id=' + id });
  },

  deleteDesign: function(e) {
    var id = e.currentTarget.dataset.id;
    var index = e.currentTarget.dataset.index;
    this.setData({
      showDeleteModal: true,
      deleteId: id || '',
      deleteIndex: index !== undefined ? index : -1
    });
  },

  cancelDelete: function() {
    this.setData({ showDeleteModal: false, deleteIndex: -1, deleteId: '' });
  },

  confirmDelete: function() {
    var self = this;
    var id = this.data.deleteId;
    if (!id) {
      self.setData({ showDeleteModal: false, deleteIndex: -1, deleteId: '' });
      return;
    }
    wx.showLoading({ title: '删除中...', mask: true });
    app.deleteDesignById(id).then(function(res) {
      wx.hideLoading();
      self.setData({ showDeleteModal: false, deleteIndex: -1, deleteId: '' });
      if (res.success) {
        self.loadDesigns();
      } else {
        wx.showToast({ title: '删除失败', icon: 'none' });
      }
    });
  },

  /** 转发到聊天 */
  onShareAppMessage: function(res) {
    return require('../../utils/share.js').onShare('design', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../utils/share.js').onTimeline('design', this);
  }
});
