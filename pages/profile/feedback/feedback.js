Page({
  data: {
    content: '',
    image: '',
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

  onInput: function(e) {
    this.setData({ content: e.detail.value });
  },

  chooseImage: function() {
    var self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        self.setData({ image: res.tempFiles[0].tempFilePath });
      }
    });
  },

  onSubmit: function() {
    if (!this.data.content || !this.data.content.replace(/\s/g, '')) {
      wx.showToast({ title: '请输入反馈内容', icon: 'none' });
      return;
    }
    wx.showToast({ title: '感谢您的反馈', icon: 'success' });
    var self = this;
    setTimeout(function() {
      wx.navigateBack({
        fail: function() { wx.switchTab({ url: '/pages/profile/profile' }); }
      });
    }, 1500);
  },

  /** 转发到聊天 */
  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('feedback', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('feedback', this);
  }
});
