// 微信小程序 wx.* API Mock
// 在 Jest setupFiles 中自动加载，模拟小程序运行环境

const storage = new Map();

global.wx = {
  cloud: {
    init: jest.fn(),
    callFunction: jest.fn()
  },

  getStorageSync: jest.fn(function (key) {
    return storage.get(key) || '';
  }),

  setStorageSync: jest.fn(function (key, value) {
    storage.set(key, value);
  }),

  removeStorageSync: jest.fn(function (key) {
    storage.delete(key);
  }),

  clearStorageSync: jest.fn(function () {
    storage.clear();
  }),

  // 文件保存 / 删除
  saveFile: jest.fn(function (opts) {
    var savedPath = 'wxfile://saved_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    if (opts && opts.success) {
      opts.success({ savedFilePath: savedPath });
    }
    return savedPath;
  }),

  removeSavedFile: jest.fn(function (opts) {
    if (opts && opts.success) {
      opts.success({});
    }
  }),

  // 系统信息
  getWindowInfo: jest.fn(function () {
    return { statusBarHeight: 44, windowHeight: 800, windowWidth: 375 };
  }),

  getMenuButtonBoundingClientRect: jest.fn(function () {
    return { top: 52, height: 32, width: 87 };
  }),

  // 导航
  navigateBack: jest.fn(),

  // UI 交互
  showActionSheet: jest.fn(),
  showToast: jest.fn(),
  showModal: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),

  // 剪贴板
  setClipboardData: jest.fn(),

  // 图片预览 (inspect/move 等页面使用)
  previewImage: jest.fn()
};

// 辅助：重置所有 mock 和 storage
global._resetWxMock = function () {
  storage.clear();
  Object.values(wx.cloud).forEach(function (fn) {
    if (typeof fn === 'function' && fn.mockReset) fn.mockReset();
  });
  Object.values(wx).forEach(function (fn) {
    if (typeof fn === 'function' && fn.mockReset) fn.mockReset();
  });
  global._appInstance = null;
  if (global.getApp && global.getApp.mockReset) global.getApp.mockReset();
};

// 清除 storage 辅助
global._wxStorage = storage;

// Mock App() 和 Page() —— 捕获配置对象供测试访问
global._appConfig = null;
global.App = jest.fn(function (config) {
  global._appConfig = config;
});

global._pageConfigs = [];
global.Page = jest.fn(function (config) {
  global._pageConfigs.push(config);
});

// getApp() 返回一个持有 globalData 的 mock 实例
global._appInstance = null;
global.getApp = jest.fn(function () {
  if (!global._appInstance) {
    global._appInstance = {
      globalData: (global._appConfig && global._appConfig.globalData)
        ? JSON.parse(JSON.stringify(global._appConfig.globalData))
        : {}
    };
  }
  return global._appInstance;
});
