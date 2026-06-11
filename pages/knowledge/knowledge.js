var app = getApp();

Page({
  // 图片临时URL缓存（避免重复请求云存储）
  _tempUrlCache: {},

  data: {
    knowledgeGroups: [],
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

    this.setData({
      knowledgeGroups: app.globalData.knowledgeGroups || []
    });
  },

  openArticle: function(e) {
    var dataset = e.currentTarget.dataset;
    var id = dataset.id;
    var title = dataset.title;
    var type = dataset.type;

    // 快速预算跳转专用页面
    if (type === 'budget') {
      wx.navigateTo({
        url: '/pages/knowledge/budget/budget'
      });
      return;
    }

    // 需求匹配表跳转专用页面
    if (type === 'needs') {
      wx.navigateTo({
        url: '/pages/knowledge/needs/needs'
      });
      return;
    }

    // 甘特图下载：弹出确认弹窗
    if (type === 'gantt') {
      this._handleGanttDownload();
      return;
    }

    // 快速验收跳转专用页面
    if (type === 'inspect') {
      wx.navigateTo({
        url: '/pages/knowledge/inspect/inspect'
      });
      return;
    }

    // 搬家核对清单跳转专用页面
    if (type === 'move') {
      wx.navigateTo({
        url: '/pages/knowledge/move/move'
      });
      return;
    }

    // 新家物品清单跳转专用页面
    if (type === 'checklist') {
      wx.navigateTo({
        url: '/pages/knowledge/checklist/checklist'
      });
      return;
    }

    // GLB 模型预览跳转专用页面
    if (type === 'glbviewer') {
      wx.navigateTo({
        url: '/pages/knowledge/glbviewer/glbviewer'
      });
      return;
    }

    // PD2D 透视投影：先进列表页（开始新设计 / 打开已保存方案）
    if (type === 'pd2d') {
      wx.navigateTo({
        url: '/pages/knowledge/pd2dList/pd2dList'
      });
      return;
    }

    // 图片类型：预览大图（带缓存）
    if (type === 'image') {
      var imageUrl = dataset.imageurl || dataset.imageUrl;
      if (imageUrl) {
        var self = this;
        // 缓存命中则直接预览
        if (self._tempUrlCache[imageUrl]) {
          wx.previewImage({
            current: self._tempUrlCache[imageUrl],
            urls: [self._tempUrlCache[imageUrl]]
          });
          return;
        }
        wx.showLoading({ title: '加载中...' });
        wx.cloud.getTempFileURL({
          fileList: [imageUrl],
          success: function(res) {
            wx.hideLoading();
            if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
              var tempUrl = res.fileList[0].tempFileURL;
              // 缓存临时URL
              self._tempUrlCache[imageUrl] = tempUrl;
              wx.previewImage({
                current: tempUrl,
                urls: [tempUrl]
              });
            } else {
              wx.showToast({ title: '图片加载失败', icon: 'none' });
            }
          },
          fail: function() {
            wx.hideLoading();
            wx.showToast({ title: '图片加载失败', icon: 'none' });
          }
        });
      }
      return;
    }

    wx.navigateTo({
      url: '/pages/knowledge/detail/detail?id=' + id + '&title=' + encodeURIComponent(title) + '&type=' + type
    });
  },

  /** 转发到聊天 */
  onShareAppMessage: function(res) {
    return require('../../utils/share.js').onShare('knowledge', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../utils/share.js').onTimeline('knowledge', this);
  }
});
