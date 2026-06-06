Page({
  data: {
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
  },

  goBack: function() {
    wx.navigateBack({
      fail: function() { wx.switchTab({ url: '/pages/profile/profile' }); }
    });
  },

  copyWechat: function() {
    wx.setClipboardData({
      data: 'LemonTA_Service',
      success: function() { wx.showToast({ title: '已复制微信号' }); }
    });
  },

  copyEmail: function() {
    wx.setClipboardData({
      data: 'lemonta@lemonta.cn',
      success: function() { wx.showToast({ title: '已复制邮箱' }); }
    });
  },

  /** 转发到聊天 */
  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('contact', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('contact', this);
  }
});
