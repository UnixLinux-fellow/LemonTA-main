Page({
  data: {
    id: '',
    title: '',
    type: 'article',
    statusBarHeight: 20,
    navBarHeight: 44
  },

  onLoad: function(options) {
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

    var title = decodeURIComponent(options.title || '');
    var type = options.type || 'article';
    var articleContent = '该知识库文章内容将由后台管理员编辑维护。\n\n您可以在此查看与' + title + '相关的详细指南和专业建议。\n\n如有疑问，请通过"我的-联系我们"进行咨询。';
    this.setData({
      id: options.id,
      title: title,
      type: type,
      articleContent: articleContent
    });
  },

  goBack: function() {
    wx.navigateBack({
      fail: function() {
        wx.switchTab({ url: '/pages/knowledge/knowledge' });
      }
    });
  },

  onDownload: function() {
    wx.showToast({ title: '文件将发送至您的邮箱', icon: 'none', duration: 2000 });
  },

  /** 转发到聊天：带当前文章标题，方便点开直达原文 */
  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('knowledgeDetail', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('knowledgeDetail', this);
  }
});
