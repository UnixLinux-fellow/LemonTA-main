var app = getApp();

Page({
  data: {
    // ===== 登录/身份 =====
    isLoggedIn: false,
    openidTail: '',       // openid 最后 6 位，用作用户可见的 ID
    avatarUrl: '',        // 云存储 fileID（<image> 可直接渲染，SDK 自动换临时 URL）
    nickName: '',         // 昵称，可空

    // ===== 编辑弹窗 =====
    editVisible: false,
    editAvatarUrl: '',    // 弹窗中展示的已保存头像
    editAvatarTemp: '',   // 用户刚从 chooseAvatar 选择的临时路径（未上传）
    editNickName: '',     // 弹窗中昵称输入值
    saving: false,

    // ===== 导航栏 =====
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

  onShow: function() {
    this._syncLoginState();
    // 从别处登录回来时，补拉一次云端用户资料（头像昵称）
    var self = this;
    if (this.data.isLoggedIn && !this.data.avatarUrl && !this.data.nickName) {
      app.loadUserProfile().then(function() {
        self._syncLoginState();
      });
    }
  },

  /**
   * 将 app.globalData 的登录/资料信息同步到本页 data
   * 这是"唯一真相源读取处"，不在别处直接读 globalData 渲染
   */
  _syncLoginState: function() {
    var openid = app.globalData.openid || '';
    this.setData({
      isLoggedIn: !!openid,
      openidTail: openid ? openid.slice(-6) : '',
      avatarUrl: app.globalData.avatarFileID || '',
      nickName: app.globalData.nickName || ''
    });
  },

  // 账户卡点击：未登录则跳转登录页；已登录时不响应（编辑按钮用 catchtap 独立）
  onCardTap: function() {
    if (this.data.isLoggedIn) return;
    wx.navigateTo({ url: '/packageDesign/register/register' });
  },

  // ========== 编辑资料弹窗 ==========

  openEditModal: function() {
    this.setData({
      editVisible: true,
      editAvatarUrl: this.data.avatarUrl,
      editAvatarTemp: '',
      editNickName: this.data.nickName || '',
      saving: false
    });
  },

  closeEditModal: function() {
    if (this.data.saving) return;
    this.setData({ editVisible: false, editAvatarTemp: '' });
  },

  // 阻止弹窗内部冒泡到遮罩（遮罩点击会关闭）
  noop: function() {},

  /**
   * 选择头像回调
   * 微信新规范：e.detail.avatarUrl 是一个临时文件路径（wxfile://）
   * 仅保存到 data 做预览；真正上传在 saveProfile 里做（避免每次选都上传浪费存储）
   */
  onChooseAvatar: function(e) {
    var avatarUrl = e.detail && e.detail.avatarUrl;
    if (!avatarUrl) return;
    this.setData({ editAvatarTemp: avatarUrl });
  },

  onNickInput: function(e) {
    this.setData({ editNickName: e.detail.value });
  },

  // type="nickname" 的 input 在失焦时才会把微信昵称填进来，这里也接收一次
  onNickBlur: function(e) {
    this.setData({ editNickName: e.detail.value });
  },

  /**
   * 保存资料：
   * 1) 如果有临时头像 → 先上传到云存储拿 fileID
   * 2) 带上 nickName 调 app.saveUserProfile 写入云数据库 users 集合
   * 3) 成功后刷新本页显示
   */
  saveProfile: function() {
    var self = this;
    if (self.data.saving) return;
    self.setData({ saving: true });

    var tempAvatar = self.data.editAvatarTemp;
    var nickName = (self.data.editNickName || '').trim();

    // 第 1 步：上传头像（可选）
    var uploadStep;
    if (tempAvatar) {
      // 用 openid + 时间戳做文件名，避免冲突
      var openid = app.globalData.openid || 'anon';
      // 从临时路径里提取一个后缀；fallback jpg
      var ext = 'jpg';
      var m = tempAvatar.match(/\.([a-zA-Z0-9]+)$/);
      if (m) ext = m[1].toLowerCase();
      var cloudPath = 'avatars/' + openid + '_' + Date.now() + '.' + ext;
      uploadStep = wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempAvatar
      }).then(function(res) {
        return res.fileID;
      });
    } else {
      uploadStep = Promise.resolve(self.data.editAvatarUrl || '');
    }

    uploadStep.then(function(avatarFileID) {
      // 第 2 步：写入云数据库
      return app.saveUserProfile({
        avatarFileID: avatarFileID || '',
        nickName: nickName
      });
    }).then(function(res) {
      self.setData({ saving: false });
      if (res && res.success) {
        wx.showToast({ title: '已保存', icon: 'success' });
        self.setData({ editVisible: false, editAvatarTemp: '' });
        self._syncLoginState();
      } else {
        wx.showToast({
          title: (res && res.msg) || '保存失败',
          icon: 'none'
        });
      }
    }).catch(function(err) {
      console.error('[profile] saveProfile 失败:', err);
      self.setData({ saving: false });
      wx.showToast({
        title: (err && err.errMsg) || '保存失败',
        icon: 'none'
      });
    });
  },

  // ========== 菜单跳转 ==========

  goContact: function() {
    wx.navigateTo({ url: '/pages/profile/contact/contact' });
  },

  /** 转发到聊天：个人页转发统一回首页，避免落到别人的"我的" */
  onShareAppMessage: function(res) {
    return require('../../utils/share.js').onShare('profile', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../utils/share.js').onTimeline('profile', this);
  }
});
