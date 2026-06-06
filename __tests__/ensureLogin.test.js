// 登录核心逻辑单元测试 —— ensureLogin() 及其相关方法
// Mock 在 setupFiles (wx-mock.js) 和 __mocks__ 中配置

jest.mock('../utils/assets.js');

// 辅助：获取 App 实例的 globalData 和 ensureLogin 方法
function getAppContext() {
  var config = global._appConfig;
  if (!config) {
    throw new Error('App 配置未捕获，检查 app.js 是否正确 require');
  }
  // 模拟 App 实例——bind config methods 到一个共享的 context
  var ctx = {
    globalData: JSON.parse(JSON.stringify(config.globalData || {})),
    _loginPromise: null
  };
  // 绑定所有方法到 ctx
  Object.keys(config).forEach(function (key) {
    if (typeof config[key] === 'function') {
      ctx[key] = config[key].bind(ctx);
    }
  });
  // 模拟 WeChat 运行时 onLaunch 中的同步缓存恢复
  // （不触发完整 onLaunch，避免 ensureLogin → loadUserProfile 链需要 cloud.database mock）
  var userInfo = wx.getStorageSync('userInfo');
  if (userInfo && userInfo.openid) {
    ctx.globalData.userInfo = userInfo;
    ctx.globalData.isLoggedIn = true;
    ctx.globalData.openid = userInfo.openid;
    ctx.globalData.avatarFileID = userInfo.avatarFileID || '';
    ctx.globalData.nickName = userInfo.nickName || '';
  }
  return ctx;
}

describe('ensureLogin()', function () {
  var app;

  beforeEach(function () {
    _resetWxMock();
    // 让 App 调用时捕获最新 config
    global._appConfig = null;
    App.mockClear();
    // 隔离模块以获取全新的 app.js 实例
    jest.isolateModules(function () {
      require('../app.js');
    });
    app = getAppContext();
  });

  afterEach(function () {
    _resetWxMock();
  });

  // ===== 场景 1：openid 已存在 =====
  it('openid 已存在 → 直接 resolve，不调用云函数', function () {
    app.globalData.openid = 'oxxx_existing';

    return app.ensureLogin().then(function (openid) {
      expect(openid).toBe('oxxx_existing');
      expect(wx.cloud.callFunction).not.toHaveBeenCalled();
    });
  });

  // ===== 场景 2：并发去重 =====
  it('_loginPromise 已存在 → 返回同一个 promise，不重复调用云函数', function () {
    wx.cloud.callFunction.mockResolvedValueOnce({
      result: { openid: 'oxxx_concurrent' }
    });

    var p1 = app.ensureLogin();
    var p2 = app.ensureLogin();

    expect(p1).toBe(p2); // 同一个 promise
    expect(wx.cloud.callFunction).toHaveBeenCalledTimes(1);

    return Promise.all([p1, p2]).then(function (results) {
      expect(results[0]).toBe('oxxx_concurrent');
      expect(results[1]).toBe('oxxx_concurrent');
    });
  });

  // ===== 场景 3：wx.cloud 未初始化 =====
  it('wx.cloud 未初始化 → reject', function () {
    var cloudRef = wx.cloud;
    wx.cloud = undefined;

    return app.ensureLogin().catch(function (err) {
      expect(err.message).toBe('wx.cloud 未初始化');
      wx.cloud = cloudRef; // 恢复
    });
  });

  // ===== 场景 4：正常成功路径 =====
  it('云函数返回 openid → 更新 globalData + 缓存 + resolve', function () {
    wx.cloud.callFunction.mockResolvedValueOnce({
      result: { openid: 'oxxx_success' }
    });

    return app.ensureLogin().then(function (openid) {
      expect(openid).toBe('oxxx_success');
      expect(app.globalData.openid).toBe('oxxx_success');
      expect(app.globalData.isLoggedIn).toBe(true);
      expect(wx.setStorageSync).toHaveBeenCalledWith(
        'userInfo',
        expect.objectContaining({ openid: 'oxxx_success' })
      );
      var stored = wx.setStorageSync.mock.calls[0][1];
      expect(stored.loginTime).toBeDefined();
    });
  });

  // ===== 场景 5：云函数返回空 openid =====
  it('云函数返回空 openid → reject', function () {
    wx.cloud.callFunction.mockResolvedValueOnce({
      result: {} // 无 openid
    });

    return app.ensureLogin().catch(function (err) {
      expect(err.message).toBe('login 云函数未返回 openid');
      expect(app.globalData.openid).toBe(''); // 未更新
    });
  });

  it('云函数返回 null result → reject', function () {
    wx.cloud.callFunction.mockResolvedValueOnce({
      result: null
    });

    return app.ensureLogin().catch(function (err) {
      expect(err.message).toBe('login 云函数未返回 openid');
    });
  });

  // ===== 场景 6：云函数网络失败 =====
  it('云函数网络失败 → reject，_loginPromise 重置为 null', function () {
    wx.cloud.callFunction.mockRejectedValueOnce(new Error('网络错误'));

    return app.ensureLogin().catch(function (err) {
      expect(err.message).toBe('网络错误');
      expect(app._loginPromise).toBeNull(); // 重置，允许重试
    });
  });

  // ===== 场景 7：失败后重试 =====
  it('第一次失败后重试 → 重新调用云函数', function () {
    wx.cloud.callFunction.mockRejectedValueOnce(new Error('超时'));
    wx.cloud.callFunction.mockResolvedValueOnce({
      result: { openid: 'oxxx_retry' }
    });

    return app.ensureLogin().catch(function () {
      // 第一次失败后 _loginPromise 应为 null
      expect(app._loginPromise).toBeNull();
      // 第二次调用
      return app.ensureLogin();
    }).then(function (openid) {
      expect(openid).toBe('oxxx_retry');
      expect(wx.cloud.callFunction).toHaveBeenCalledTimes(2);
    });
  });
});

describe('onLaunch 缓存恢复', function () {
  beforeEach(function () {
    _resetWxMock();
    global._appConfig = null;
    App.mockClear();
  });

  it('缓存有有效 openid → isLoggedIn = true，openid 恢复', function () {
    wx.getStorageSync.mockReturnValue({
      openid: 'oxxx_cached',
      avatarFileID: 'cloud://avatar.png',
      nickName: '测试用户'
    });

    jest.isolateModules(function () {
      require('../app.js');
    });
    var app = getAppContext();

    expect(app.globalData.isLoggedIn).toBe(true);
    expect(app.globalData.openid).toBe('oxxx_cached');
    expect(app.globalData.avatarFileID).toBe('cloud://avatar.png');
    expect(app.globalData.nickName).toBe('测试用户');
  });

  it('缓存无 openid 字段 → 不恢复 isLoggedIn', function () {
    wx.getStorageSync.mockReturnValue({
      nickName: '只有昵称，没 openid'
    });

    jest.isolateModules(function () {
      require('../app.js');
    });
    var app = getAppContext();

    expect(app.globalData.isLoggedIn).toBe(false);
    expect(app.globalData.openid).toBe('');
  });

  it('缓存为空字符串 openid → 不恢复 isLoggedIn', function () {
    wx.getStorageSync.mockReturnValue({
      openid: '',
      nickName: '损坏的缓存'
    });

    jest.isolateModules(function () {
      require('../app.js');
    });
    var app = getAppContext();

    expect(app.globalData.isLoggedIn).toBe(false);
  });

  it('无缓存 → isLoggedIn = false', function () {
    wx.getStorageSync.mockReturnValue(''); // 模拟无缓存

    jest.isolateModules(function () {
      require('../app.js');
    });
    var app = getAppContext();

    expect(app.globalData.isLoggedIn).toBe(false);
    expect(app.globalData.openid).toBe('');
  });
});
