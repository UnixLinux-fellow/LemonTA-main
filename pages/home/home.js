Page({
  data: {
    windowHeight: 667
  },

  onLoad: function() {
    // 使用同步API获取窗口高度（替代废弃的wx.getSystemInfo）
    try {
      var sysInfo = wx.getWindowInfo();
      var windowHeight = sysInfo.windowHeight || 667;
      this.setData({ windowHeight: windowHeight });
    } catch (e) {
      this.setData({ windowHeight: 667 });
    }
  },

  // 点击"开始设计"跳转到设计tab
  goToDesign: function() {
    wx.switchTab({
      url: '/pages/design/design'
    });
  },

  /** 转发到聊天（必须在 Page 对象上声明，微信才会启用右上角"转发"按钮） */
  onShareAppMessage: function(res) {
    return require('../../utils/share.js').onShare('home', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../utils/share.js').onTimeline('home', this);
  }
});
