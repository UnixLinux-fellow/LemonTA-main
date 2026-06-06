var app = getApp();

Page({
  data: {
    currentEmail: '',
    newEmail: '',
    errorMsg: '',
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
    this.setData({ currentEmail: app.globalData.email || '' });
  },

  goBack: function() {
    wx.navigateBack({
      fail: function() { wx.switchTab({ url: '/pages/profile/profile' }); }
    });
  },

  onInput: function(e) {
    this.setData({ newEmail: e.detail.value, errorMsg: '' });
  },

  onSave: function() {
    var newEmail = this.data.newEmail;
    var emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!newEmail || !emailRegex.test(newEmail)) {
      this.setData({ errorMsg: '邮箱格式错误，请重新填写' });
      return;
    }

    var userInfo = app.globalData.userInfo || {};
    userInfo.email = newEmail;
    app.saveUserInfo(userInfo);

    wx.showToast({ title: '邮箱已更新', icon: 'success' });
    setTimeout(function() {
      wx.navigateBack({
        fail: function() { wx.switchTab({ url: '/pages/profile/profile' }); }
      });
    }, 1000);
  },

  /** 转发到聊天 */
  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('email', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('email', this);
  }
});
