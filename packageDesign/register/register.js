var app = getApp();

Page({
  data: {
    loading: false,
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
  },

  goBack: function() {
    wx.navigateBack({
      fail: function() {
        wx.switchTab({ url: '/pages/design/design' });
      }
    });
  },

  /**
   * 方案A登录：直接调 app.ensureLogin() 拿 openid
   * - app 启动时其实已经静默拿过一次 openid，这里通常是"确认登录态"的快速路径
   * - 同一个微信用户 openid 永久不变，下次打开小程序自动命中本地缓存的 userInfo
   * - 云数据库按 _openid 隔离数据，登录成功后历史设计会自动出现在"我的设计"里
   */
  onLogin: function() {
    var self = this;
    if (self.data.loading) return;
    self.setData({ loading: true });

    app.ensureLogin().then(function(openid) {
      // 标记一下注册时间（仅首次），便于以后做统计
      var userInfo = app.globalData.userInfo || {};
      if (!userInfo.registerTime) {
        app.saveUserInfo({
          openid: openid,
          registerTime: new Date().toISOString()
        });
      }
      // 登录成功后拉一次云端设计，保证返回设计页立刻能看到历史数据
      return app.refreshDesigns().then(function() { return openid; });
    }).then(function() {
      self.setData({ loading: false });
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(function() {
        wx.navigateBack({
          fail: function() {
            wx.switchTab({ url: '/pages/design/design' });
          }
        });
      }, 800);
    }).catch(function(err) {
      console.error('[register] 登录失败:', err);
      self.setData({ loading: false });
      wx.showToast({
        title: (err && (err.errMsg || err.message)) || '登录失败，请重试',
        icon: 'none'
      });
    });
  },

  /** 转发到聊天 */
  onShareAppMessage: function(res) {
    return require('../../utils/share.js').onShare('register', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../utils/share.js').onTimeline('register', this);
  }
});
