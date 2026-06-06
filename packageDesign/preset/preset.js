var app = getApp();

Page({
  data: {
    designName: '',
    cornerType: 'WZJ', // WZJ=无, ZZJ=左转角, YZJ=右转角, ZYZJ=双侧
    wallWidth: '',
    wallHeight: '',
    errorMsg: '',
    cornerHint: '',

    // 导航栏
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

    // 支持从拍照解析空间传参预填
    if (options && options.width) {
      this.setData({ wallWidth: options.width });
    }
    if (options && options.height) {
      this.setData({ wallHeight: options.height });
    }
    if (options && options.corner) {
      this.setData({ cornerType: options.corner });
      if (options.width) {
        this.validateCorner();
      }
    }
  },

  onNameInput: function(e) {
    this.setData({ designName: e.detail.value, errorMsg: '' });
  },

  setCorner: function(e) {
    var type = e.currentTarget.dataset.type;
    this.setData({ cornerType: type, errorMsg: '' });
    this.validateCorner();
  },

  onWidthInput: function(e) {
    this.setData({ wallWidth: e.detail.value, errorMsg: '' });
    this.validateCorner();
  },

  onHeightInput: function(e) {
    this.setData({ wallHeight: e.detail.value, errorMsg: '' });
  },

  validateCorner: function() {
    var cornerType = this.data.cornerType;
    var wallWidth = this.data.wallWidth;
    var w = parseInt(wallWidth);
    var hint = '';
    
    if (w && w < 114 && cornerType !== 'WZJ') {
      hint = '宽度小于114cm时，转角柜仅可选择"无"';
    } else if (w && w >= 114 && w < 224 && cornerType === 'ZYZJ') {
      hint = '宽度小于224cm时，不可选择双侧转角柜';
    }
    
    if (cornerType !== 'WZJ') {
      hint = hint || '如果相连另一侧墙面有转角柜，\n则墙面宽度需要~110cm';
    }
    
    this.setData({ cornerHint: hint });
  },

  onCancel: function() {
    wx.navigateBack({
      fail: function() {
        wx.switchTab({ url: '/pages/design/design' });
      }
    });
  },

  onConfirm: function() {
    var data = this.data;
    var designName = data.designName;
    var cornerType = data.cornerType;
    var wallWidth = data.wallWidth;
    var wallHeight = data.wallHeight;
    
    // 验证
    if (!designName || !designName.replace(/\s/g, '')) {
      this.setData({ errorMsg: '请输入设计名称' });
      return;
    }
    
    var w = parseInt(wallWidth);
    var h = parseInt(wallHeight);
    
    if (!w || w < 44) {
      this.setData({ errorMsg: '墙面宽度需大于等于44cm' });
      return;
    }
    
    if (w > 1000) {
      this.setData({ errorMsg: '墙面宽度不得大于1000cm' });
      return;
    }
    
    if (!h || h < 232) {
      this.setData({ errorMsg: '墙面高度需大于等于232cm' });
      return;
    }
    
    if (h > 400) {
      this.setData({ errorMsg: '墙面高度不得大于400cm' });
      return;
    }
    
    // 宽度与转角柜的兼容性验证
    if (w < 114 && cornerType !== 'WZJ') {
      this.setData({ errorMsg: '宽度小于114cm时，转角柜仅可选择"无"' });
      return;
    }
    
    if (w < 224 && cornerType === 'ZYZJ') {
      this.setData({ errorMsg: '宽度小于224cm时，不可选择双侧转角柜' });
      return;
    }

    // 生成设计ID
    var now = new Date();
    var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    var id = '' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + pad(now.getHours()) + pad(now.getMinutes());

    // 计算转角柜标签
    var cornerLabels = {
      'WZJ': '无转角柜',
      'ZZJ': '左转角',
      'YZJ': '右转角',
      'ZYZJ': '双侧转角'
    };

    // 跳转到布局设计页面
    var url = '/packageDesign/layout/layout?id=' + id
      + '&name=' + encodeURIComponent(designName)
      + '&corner=' + cornerType
      + '&width=' + w
      + '&height=' + h
      + '&cornerLabel=' + encodeURIComponent(cornerLabels[cornerType]);
    
    console.log('[preset] 跳转 layout, URL:', url);
    wx.redirectTo({ url: url });
  },

  /** 转发到聊天 */
  onShareAppMessage: function(res) {
    return require('../../utils/share.js').onShare('preset', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../utils/share.js').onTimeline('preset', this);
  }
});
