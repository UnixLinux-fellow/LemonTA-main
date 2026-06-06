var assets = require('./utils/assets.js');

App({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    openid: '',       // 方案A登录：openid 即用户唯一身份，由云函数 login 返回
    phone: '',        // 保留字段兼容旧页面引用，当前方案不收集手机号
    email: '',        // 同上，保留兼容
    avatarFileID: '', // 用户头像（云存储 cloud:// fileID），可空
    nickName: '',     // 用户昵称，可空
    designs: [], // 用户保存的设计列表，最多30条
    currentDesignPreview: '', // 最近一次"确认布局"生成的整体渲染图路径（cost 页优先使用）
    // 全局可配置项（来自云数据库 config 集合，启动时拉取一次）
    // 改链接 / 文案不需要重新提审小程序，只改云数据库即可
    appConfig: {
      downloadUrl: 'https://pan.baidu.com/s/14hTB_JKE53ABqnxqLSmKGQ?pwd=45q3'  // 一键下载用的网盘链接（兜底默认值）
    },
    tutorials: [
      {
        id: 1,
        title: '设计指南',
        bgImage: assets.bg('T1'),
        sections: [
          {
            title: '1  新建设计，输入墙面的 长度 / 高度\n输入是否有 左/右/双侧转角柜',
            content: '',
            gif: ''
          },
          {
            title: '2  点击 🍋 选择对应位置的 衣柜布局\n点击已放置柜子 可更换布局配置',
            content: '',
            gif: ''
          },
          {
            title: '3  全部摆放完毕后点击 确认布局\n点击 确认 以 保存设计',
            content: '',
            gif: ''
          },
          {
            title: '4  在已保存设计中更换配置/加工需求\n点击确认，可查看 成本透视表\n点击 一键下载，获得 全套图纸+配件表',
            content: '',
            gif: ''
          }
        ]
      },
      {
        id: 2,
        title: '知识库指南',
        bgImage: assets.bg('T2'),
        sections: [
          {
            title: '1  知识库以 标签 进行内容分类，\n选择对应标签，点击打开 对应内容',
            content: '',
            gif: ''
          },
          {
            title: '2  即可 在线查看\n后缀带有【下载】的条目，含可下载模\n型与成本、拆单文件或合同模板',
            content: '',
            gif: ''
          }
        ]
      }
    ],
    // 知识库文章（分组）
    knowledgeGroups: [
      {
        label: '常用工具',
        items: [
          { id: 0, title: '柠檬塔快速预算', subtitle: '输入面积，一键测算全屋成本', type: 'budget' },
          { id: 10, title: '柠檬塔需求匹配表', subtitle: '场景化需求梳理 · 精准落地', type: 'needs' },
          { id: 12, title: '快速验收', subtitle: '清单式验收 · 零遗漏', type: 'inspect' },
          { id: 13, title: '全屋水路设备图', subtitle: '净水系统 · 走管参考图', type: 'image', imageUrl: 'cloud://cloud1-5gbuna7d27dafeba.636c-cloud1-5gbuna7d27dafeba-1417087823/downloads/全屋净水-水路设备图.png' },
          { id: 14, title: '搬家核对清单', subtitle: '从准备到入住 · 逐项核对零遗漏', type: 'move' },
          { id: 15, title: '新家物品清单', subtitle: '106项物品核对 · 采购与签收跟踪', type: 'checklist' },
          { id: 16, title: 'GLB 模型预览', subtitle: '快速渲染三维模型 · 支持 glb/gltf', type: 'glbviewer' }
        ]
      }
    ]
  },

  onLaunch() {
    // 初始化云开发环境
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-5gbuna7d27dafeba',
        traceUser: true
      });
    }

    // 读取本地缓存的用户信息（老用户刷新小程序后仍能立即渲染账号卡）
    var userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.openid) {
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = true;
      this.globalData.openid = userInfo.openid;
      this.globalData.phone = userInfo.phone || '';
      this.globalData.email = userInfo.email || '';
      this.globalData.avatarFileID = userInfo.avatarFileID || '';
      this.globalData.nickName = userInfo.nickName || '';
    }

    // 启动时静默拉取 openid → 拉取用户资料 → 刷新设计列表
    var self = this;
    this.ensureLogin().then(function() {
      self.loadUserProfile();          // 云端拉取头像昵称
      self.loadAppConfig();            // 云端拉取全局可配置项（网盘链接等）
      return self.refreshDesigns();    // 云端拉取设计列表
    }).catch(function() {
      // 拿不到 openid 也尝试刷新一次（离线/网络问题下页面仍能渲染空态）
      if (wx.cloud) {
        self.loadAppConfig();
        self.refreshDesigns();
      }
    });

    // 加载 HarmonyOS Sans SC 字体（Thin / Regular / Black 三个字重）
    this._loadHarmonyFonts();
  },

  /**
   * 确保已拿到 openid - 返回 Promise<openid>
   * 方案A核心：唯一登录动作 = 调 login 云函数拿 openid
   * - 内存已有：直接 resolve
   * - 内存没有：去云函数拿，并写入 globalData + 本地缓存
   * - 并发场景：多个页面同时调用只会触发一次真实云函数请求
   */
  ensureLogin: function() {
    var self = this;
    if (self.globalData.openid) {
      return Promise.resolve(self.globalData.openid);
    }
    if (self._loginPromise) {
      return self._loginPromise;
    }
    if (!wx.cloud) {
      return Promise.reject(new Error('wx.cloud 未初始化'));
    }
    self._loginPromise = wx.cloud.callFunction({ name: 'login' })
      .then(function(res) {
        var openid = res && res.result && res.result.openid;
        if (!openid) {
          throw new Error('login 云函数未返回 openid');
        }
        self.globalData.openid = openid;
        self.globalData.isLoggedIn = true;
        // 合并到 userInfo 缓存；若本地原无 userInfo 也建一个最小对象
        var merged = Object.assign({}, self.globalData.userInfo || {}, {
          openid: openid,
          loginTime: new Date().toISOString()
        });
        self.globalData.userInfo = merged;
        try {
          wx.setStorageSync('userInfo', merged);
        } catch (e) {
          console.error('[login] 缓存用户信息失败:', e);
        }
        return openid;
      })
      .catch(function(err) {
        console.error('[login] 获取 openid 失败:', err);
        self._loginPromise = null; // 失败后允许下次重试
        throw err;
      });
    return self._loginPromise;
  },

  /**
   * 从云数据库 users 集合拉取当前用户资料（头像 / 昵称）
   * 查询按 _openid 自动隔离；无记录是正常情况（未完善资料）
   * @returns {Promise<{avatarFileID:string, nickName:string} | null>}
   */
  loadUserProfile: function() {
    var self = this;
    if (!wx.cloud) return Promise.resolve(null);
    var db = wx.cloud.database();
    return db.collection('users').limit(1).get().then(function(res) {
      var doc = (res.data || [])[0];
      if (!doc) return null;
      self.globalData.avatarFileID = doc.avatarFileID || '';
      self.globalData.nickName = doc.nickName || '';
      // 同步写回本地缓存
      var merged = Object.assign({}, self.globalData.userInfo || {}, {
        avatarFileID: self.globalData.avatarFileID,
        nickName: self.globalData.nickName
      });
      self.globalData.userInfo = merged;
      wx.setStorageSync('userInfo', merged);
      return { avatarFileID: self.globalData.avatarFileID, nickName: self.globalData.nickName };
    }).catch(function(err) {
      // 集合不存在或权限问题：不阻塞流程
      console.warn('[cloud] 拉取 users 资料失败（集合未建也会走这里）:', err);
      return null;
    });
  },

  /**
   * 从云数据库 config 集合拉取全局可配置项（如网盘下载链接）
   *
   * 集合：config（权限须设为"所有用户可读，仅创建者可读写"）
   * 文档：唯一一条，建议 _id = "app"，字段含 downloadUrl 等
   *
   * 失败（集合不存在 / 权限不足 / 网络异常）时静默回退到 globalData.appConfig 默认值，
   * 不阻塞任何业务流程。
   */
  loadAppConfig: function() {
    var self = this;
    if (!wx.cloud) return Promise.resolve(null);
    var db = wx.cloud.database();
    return db.collection('config').limit(1).get().then(function(res) {
      var doc = (res.data || [])[0];
      if (!doc) return null;
      // 合并到 globalData.appConfig，未在云端配置的字段保留默认值
      var merged = Object.assign({}, self.globalData.appConfig || {});
      if (doc.downloadUrl) merged.downloadUrl = doc.downloadUrl;
      self.globalData.appConfig = merged;
      return merged;
    }).catch(function(err) {
      console.warn('[cloud] 拉取 config 失败（集合未建/权限/网络）:', err && err.errMsg);
      return null;
    });
  },

  /**
   * 保存/更新用户资料（头像 fileID + 昵称）到云数据库 users 集合
   * 每个 openid 只保留一条记录（存在则更新，不存在则新增）
   * @param {{avatarFileID?:string, nickName?:string}} patch
   * @returns {Promise<{success:boolean, msg?:string}>}
   */
  saveUserProfile: function(patch) {
    var self = this;
    if (!wx.cloud) return Promise.resolve({ success: false, msg: '云开发未初始化' });
    return self.ensureLogin().then(function() {
      var db = wx.cloud.database();
      return db.collection('users').limit(1).get().then(function(res) {
        var existing = (res.data || [])[0];
        var now = db.serverDate();
        if (existing) {
          return db.collection('users').doc(existing._id).update({
            data: Object.assign({}, patch, { updateTime: now })
          });
        } else {
          return db.collection('users').add({
            data: Object.assign({
              avatarFileID: '',
              nickName: ''
            }, patch, { createTime: now, updateTime: now })
          });
        }
      });
    }).then(function() {
      // 成功后同步内存 + 本地缓存
      if (typeof patch.avatarFileID === 'string') {
        self.globalData.avatarFileID = patch.avatarFileID;
      }
      if (typeof patch.nickName === 'string') {
        self.globalData.nickName = patch.nickName;
      }
      var merged = Object.assign({}, self.globalData.userInfo || {}, {
        avatarFileID: self.globalData.avatarFileID,
        nickName: self.globalData.nickName
      });
      self.globalData.userInfo = merged;
      wx.setStorageSync('userInfo', merged);
      return { success: true };
    }).catch(function(err) {
      console.error('[cloud] 保存用户资料失败:', err);
      return { success: false, msg: (err && err.errMsg) || '保存失败' };
    });
  },

  /**
   * 加载 HarmonyOS Sans SC 字体（全局生效）
   * 方案：把包内 /assets/fonts/*.ttf 先拷到用户目录，拿到 wxfile:// 路径再交给 loadFontFace。
   *       这样完全避开域名白名单和 downloadFile 的 ERR_CACHE_MISS 问题。
   * 字体为子集版（仅保留首页所需字符），Thin/Black 各约 8KB，加载瞬时。
   */
  _loadHarmonyFonts() {
    if (!wx.loadFontFace) return;
    var fm = wx.getFileSystemManager();
    var USER = wx.env.USER_DATA_PATH;
    var tasks = [
      { weight: '100', pkgPath: '/assets/fonts/HarmonyOS_Sans_SC_Thin.ttf',  dst: USER + '/HarmonyOS_Sans_SC_Thin.ttf' },
      { weight: '900', pkgPath: '/assets/fonts/HarmonyOS_Sans_SC_Black.ttf', dst: USER + '/HarmonyOS_Sans_SC_Black.ttf' }
    ];
    tasks.forEach(function(t) {
      var registerFromWxfile = function() {
        wx.loadFontFace({
          global: true,
          scopes: ['webview', 'native'],
          family: 'HarmonyOS Sans SC',
          source: 'url("' + t.dst + '")',
          desc: { style: 'normal', weight: t.weight },
          success: function() { /* loaded */ },
          fail: function(err) {
            console.warn('[font] loadFontFace(' + t.weight + ') fail:', err && err.errMsg);
          }
        });
      };
      // 若已拷贝过，直接用；否则从包内拷到本地用户目录
      try {
        fm.accessSync(t.dst);
        registerFromWxfile();
      } catch (e) {
        fm.copyFile({
          srcPath: t.pkgPath,
          destPath: t.dst,
          success: registerFromWxfile,
          fail: function(err) {
            console.warn('[font] copyFile(' + t.weight + ') fail:', err && err.errMsg);
          }
        });
      }
    });
  },

  // 保存/合并用户信息到本地（不覆盖已有 openid / 头像 / 昵称）
  saveUserInfo(info) {
    var merged = Object.assign({}, this.globalData.userInfo || {}, info || {});
    this.globalData.userInfo = merged;
    this.globalData.isLoggedIn = true;
    this.globalData.openid = merged.openid || this.globalData.openid || '';
    this.globalData.phone = merged.phone || '';
    this.globalData.email = merged.email || '';
    this.globalData.avatarFileID = merged.avatarFileID || this.globalData.avatarFileID || '';
    this.globalData.nickName = merged.nickName || this.globalData.nickName || '';
    wx.setStorageSync('userInfo', merged);
  },

  // ===================== 云数据库：设计方案 =====================

  /**
   * 从云端拉取当前用户的设计列表（按 createTime 倒序）
   * 结果同步到 globalData.designs，供各页直接使用
   * @returns {Promise<Array>}
   */
  refreshDesigns() {
    var self = this;
    if (!wx.cloud) {
      return Promise.resolve([]);
    }
    // 确保先拿到 openid 再查数据库
    // 云开发的数据库权限为"仅创建者可读写"，查询会自动按 _openid 过滤，
    // 所以不需要我们手动 where({ _openid: ... })
    return self.ensureLogin().catch(function() {
      // 拿不到 openid 也允许查询（云函数偶发失败不应阻塞页面）
      return null;
    }).then(function() {
      var db = wx.cloud.database();
      return db.collection('designs')
        .orderBy('createTime', 'desc')
        .limit(30)
        .get();
    }).then(function(res) {
      self.globalData.designs = res.data || [];
      return self.globalData.designs;
    }).catch(function(err) {
      console.error('[cloud] 拉取设计列表失败:', err);
      self.globalData.designs = [];
      return [];
    });
  },

  /**
   * 保存设计方案到云端
   * @param {object} design - 不含 _id、_openid、createTime（由云端自动补）
   * @returns {Promise<{success:boolean, _id?:string, msg?:string}>}
   */
  saveDesign(design) {
    var self = this;
    if (!wx.cloud) {
      return Promise.resolve({ success: false, msg: '云开发未初始化' });
    }
    if ((self.globalData.designs || []).length >= 30) {
      return Promise.resolve({ success: false, msg: '设计库已满30条，需删除部分设计后新建' });
    }
    var db = wx.cloud.database();
    // 补时间戳（用服务端时间更准，但客户端时间也够用）
    var doc = Object.assign({}, design, {
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    });
    return db.collection('designs').add({ data: doc }).then(function(res) {
      // 把新文档拼到内存缓存头部（orderBy createTime desc，所以在最前）
      var newDoc = Object.assign({}, doc, {
        _id: res._id,
        createTime: new Date(), // serverDate 只能回写到云端，这里用本地时间占位
        updateTime: new Date()
      });
      self.globalData.designs = [newDoc].concat(self.globalData.designs || []);
      return { success: true, _id: res._id };
    }).catch(function(err) {
      console.error('[cloud] 保存设计失败:', err);
      return { success: false, msg: '保存失败，请检查网络' };
    });
  },

  /**
   * 根据 _id 删除云端设计方案，同时清理云存储里的预览图
   * @param {string} id
   * @returns {Promise<{success:boolean}>}
   */
  deleteDesignById(id) {
    var self = this;
    if (!wx.cloud || !id) {
      return Promise.resolve({ success: false });
    }
    var db = wx.cloud.database();
    var target = (self.globalData.designs || []).filter(function(d) {
      return d._id === id;
    })[0];

    // 先尝试删除云存储里的预览图（失败不影响主流程）
    var cleanupFile = Promise.resolve();
    if (target && target.previewFileID) {
      cleanupFile = wx.cloud.deleteFile({ fileList: [target.previewFileID] })
        .catch(function(err) { console.warn('[cloud] 删除预览图失败:', err); });
    }

    return cleanupFile.then(function() {
      return db.collection('designs').doc(id).remove();
    }).then(function() {
      self.globalData.designs = (self.globalData.designs || []).filter(function(d) {
        return d._id !== id;
      });
      return { success: true };
    }).catch(function(err) {
      console.error('[cloud] 删除设计失败:', err);
      return { success: false };
    });
  },

  /**
   * 根据 _id 从内存缓存获取 design（通常够用；如果缓存没命中需先 refreshDesigns）
   */
  getDesignById(id) {
    var list = this.globalData.designs || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i]._id === id) return list[i];
    }
    return null;
  }
});
