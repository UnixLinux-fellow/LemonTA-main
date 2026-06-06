Page({
  data: {
    downloads: [],
    statusBarHeight: 20,
    navBarHeight: 44
  },

  onLoad: function() {
    try {
      var sysInfo = wx.getWindowInfo();
      var menuBtn = wx.getMenuButtonBoundingClientRect();
      var statusBarHeight = sysInfo.statusBarHeight || 20;
      var navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
      this.setData({ statusBarHeight: statusBarHeight, navBarHeight: navBarHeight });
    } catch (e) {
      this.setData({ statusBarHeight: 20, navBarHeight: 44 });
    }
    // 从本地存储加载下载记录
    var downloads = wx.getStorageSync('downloads') || [];
    this.setData({ downloads: downloads });
  },

  goBack: function() {
    wx.navigateBack({
      fail: function() { wx.switchTab({ url: '/pages/profile/profile' }); }
    });
  },

  /** 转发到聊天 */
  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('downloads', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('downloads', this);
  }
});
