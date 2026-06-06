// 新家物品清单管理 —— 单元测试 + 集成测试
// Mock 在 setupFiles (wx-mock.js) 和 __mocks__ 中配置

jest.mock('../utils/assets.js');

// 捕获 Page 配置并创建可测试的上下文
var pageConfig = null;

function loadPageConfig() {
  global._pageConfigs = [];
  Page.mockClear();
  jest.isolateModules(function () {
    require('../pages/knowledge/checklist/checklist');
  });
  pageConfig = global._pageConfigs[global._pageConfigs.length - 1];
  if (!pageConfig) throw new Error('Page 配置未捕获');
}

function createPageContext() {
  var ctx = {
    data: JSON.parse(JSON.stringify(pageConfig.data || {}))
  };
  ctx.setData = jest.fn(function (obj) {
    Object.keys(obj).forEach(function (key) {
      if (key.indexOf('.') >= 0) {
        // 支持 'itemStates.c0_1' 路径
        var parts = key.split('.');
        var target = ctx.data;
        for (var i = 0; i < parts.length - 1; i++) {
          target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = obj[key];
      } else {
        ctx.data[key] = obj[key];
      }
    });
  });
  Object.keys(pageConfig).forEach(function (key) {
    if (typeof pageConfig[key] === 'function') {
      ctx[key] = pageConfig[key].bind(ctx);
    }
  });
  return ctx;
}

describe('checklist 数据完整性（单元测试）', function () {
  beforeAll(function () {
    loadPageConfig();
  });

  it('应有 8 个分类', function () {
    var allStats = pageConfig._computeAllCategoryStats({});
    expect(allStats.length).toBe(8);
  });

  it('总计 106 项物品', function () {
    var allStats = pageConfig._computeAllCategoryStats({});
    var total = allStats.reduce(function (sum, s) { return sum + s.total; }, 0);
    expect(total).toBe(106);
  });

  it('每个分类物品数量正确', function () {
    var allStats = pageConfig._computeAllCategoryStats({});
    var counts = allStats.map(function (s) { return s.total; });
    expect(counts).toEqual([11, 8, 35, 18, 4, 7, 13, 10]);
  });

  it('每件物品结构完整', function () {
    var allStats = pageConfig._computeAllCategoryStats({});
    allStats.forEach(function (stats, idx) {
      // 通过 _computeCategoryStats 验证每个分类能正常遍历
      var catStats = pageConfig._computeCategoryStats(idx, {});
      expect(catStats.total).toBeGreaterThan(0);
      expect(catStats.unowned).toBe(catStats.total); // 空状态 = 全部未拥有
    });
  });
});

describe('_computeCategoryStats（单元测试）', function () {
  beforeAll(function () {
    loadPageConfig();
  });

  it('空状态 → 所有物品为 unowned', function () {
    var stats = pageConfig._computeCategoryStats(0, {}); // 玄关
    expect(stats.total).toBe(11);
    expect(stats.owned).toBe(0);
    expect(stats.unowned).toBe(11);
    expect(stats.purchased).toBe(0);
    expect(stats.received).toBe(0);
    expect(stats.completionRate).toBe(0);
  });

  it('混合状态 → 各状态计数正确', function () {
    var itemStates = {
      'c0_1': 'owned',
      'c0_2': 'owned',
      'c0_3': 'purchased',
      'c0_4': 'purchased',
      'c0_5': 'received',
      'c0_6': 'received',
      // c0_7 ~ c0_11 未设置 → unowned
    };
    var stats = pageConfig._computeCategoryStats(0, itemStates);
    expect(stats.total).toBe(11);
    expect(stats.owned).toBe(2);
    expect(stats.purchased).toBe(2);
    expect(stats.received).toBe(2);
    expect(stats.unowned).toBe(5);
  });

  it('全部已拥有 → completionRate 为 100', function () {
    var itemStates = {};
    for (var i = 1; i <= 11; i++) {
      itemStates['c0_' + i] = 'owned';
    }
    var stats = pageConfig._computeCategoryStats(0, itemStates);
    expect(stats.owned).toBe(11);
    expect(stats.completionRate).toBe(100);
  });

  it('completionRate = (owned + received) / total × 100', function () {
    var itemStates = { 'c0_1': 'owned', 'c0_2': 'received' };
    var stats = pageConfig._computeCategoryStats(0, itemStates);
    // 2 out of 11 = 18%
    expect(stats.completionRate).toBe(Math.round(2 / 11 * 100));
  });

  it('所有 8 个分类的计算均返回有效对象', function () {
    for (var i = 0; i < 8; i++) {
      var stats = pageConfig._computeCategoryStats(i, {});
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.owned + stats.unowned + stats.purchased + stats.received).toBe(stats.total);
    }
  });
});

describe('_computeOverallStats（单元测试）', function () {
  beforeAll(function () {
    loadPageConfig();
  });

  it('空状态 → 106 项全部 unowned', function () {
    var allStats = pageConfig._computeAllCategoryStats({});
    var overall = pageConfig._computeOverallStats(allStats);
    expect(overall.total).toBe(106);
    expect(overall.unowned).toBe(106);
    expect(overall.owned).toBe(0);
    expect(overall.purchased).toBe(0);
    expect(overall.received).toBe(0);
    expect(overall.completionRate).toBe(0);
  });

  it('汇总各分类统计无误', function () {
    var mockStats = [
      { total: 10, owned: 2, unowned: 5, purchased: 2, received: 1, completionRate: 30 },
      { total: 20, owned: 10, unowned: 5, purchased: 3, received: 2, completionRate: 60 }
    ];
    var overall = pageConfig._computeOverallStats(mockStats);
    expect(overall.total).toBe(30);
    expect(overall.owned).toBe(12);
    expect(overall.unowned).toBe(10);
    expect(overall.purchased).toBe(5);
    expect(overall.received).toBe(3);
    expect(overall.completionRate).toBe(50); // (12+3)/30 = 50%
  });
});

describe('_recomputeStats（单元测试）', function () {
  beforeAll(function () {
    loadPageConfig();
  });

  it('更新单个分类后重新汇总', function () {
    var page = createPageContext();
    // 先初始化 stats
    page.data.itemStates = {};
    page.data.categoryStats = page._computeAllCategoryStats({});
    page.data.overallStats = page._computeOverallStats(page.data.categoryStats);

    // 模拟 toggle：将玄关前 3 项标记为 owned
    page.data.itemStates['c0_1'] = 'owned';
    page.data.itemStates['c0_2'] = 'owned';
    page.data.itemStates['c0_3'] = 'owned';

    page._recomputeStats(0);

    expect(page.data.categoryStats[0].owned).toBe(3);
    expect(page.data.overallStats.owned).toBe(3);
    expect(page.data.overallStats.unowned).toBe(103);
  });
});

describe('getStatusLabel（单元测试）', function () {
  beforeAll(function () {
    loadPageConfig();
  });

  it('返回正确的中文标签', function () {
    expect(pageConfig.getStatusLabel('unowned')).toBe('未拥有');
    expect(pageConfig.getStatusLabel('purchased')).toBe('已购买');
    expect(pageConfig.getStatusLabel('received')).toBe('已签收');
    expect(pageConfig.getStatusLabel('owned')).toBe('已拥有');
  });

  it('未知状态默认返回"未拥有"', function () {
    expect(pageConfig.getStatusLabel('unknown')).toBe('未拥有');
    expect(pageConfig.getStatusLabel(undefined)).toBe('未拥有');
  });
});

// ========== 集成测试 ==========

describe('onLoad（集成测试）', function () {
  beforeEach(function () {
    _resetWxMock();
    loadPageConfig();
  });

  afterEach(function () {
    _resetWxMock();
  });

  it('无缓存 → 初始化空状态，106 项全部未拥有', function () {
    var page = createPageContext();
    page.onLoad();

    expect(page.data.categories.length).toBe(8);
    expect(page.data.currentCategory).toBe(-1);
    expect(page.data.itemStates).toEqual({});
    expect(page.data.overallStats.total).toBe(106);
    expect(page.data.overallStats.unowned).toBe(106);
    expect(page.data.categoryStats.length).toBe(8);
  });

  it('有缓存 → 恢复已保存的状态', function () {
    var saved = { 'c0_1': 'owned', 'c0_2': 'purchased', 'c3_5': 'received' };
    wx.getStorageSync.mockReturnValue(saved);

    var page = createPageContext();
    page.onLoad();

    expect(page.data.itemStates).toEqual(saved);
    expect(page.data.overallStats.owned).toBe(1);
    expect(page.data.overallStats.purchased).toBe(1);
    expect(page.data.overallStats.received).toBe(1);
    expect(page.data.overallStats.unowned).toBe(103);
  });
});

describe('toggleStatus（集成测试）', function () {
  beforeEach(function () {
    _resetWxMock();
    jest.useFakeTimers();
    loadPageConfig();
  });

  afterEach(function () {
    jest.useRealTimers();
    _resetWxMock();
  });

  it('unowned → purchased → received → owned → unowned 循环', function () {
    var page = createPageContext();
    page.onLoad();

    var event = { currentTarget: { dataset: { catIndex: 0, itemId: 1 } } };

    // 1: unowned → purchased
    page.toggleStatus(event);
    expect(page.data.itemStates['c0_1']).toBe('purchased');

    // 2: purchased → received
    page.toggleStatus(event);
    expect(page.data.itemStates['c0_1']).toBe('received');

    // 3: received → owned
    page.toggleStatus(event);
    expect(page.data.itemStates['c0_1']).toBe('owned');

    // 4: owned → unowned
    page.toggleStatus(event);
    expect(page.data.itemStates['c0_1']).toBe('unowned');
  });

  it('切换状态后统计同步更新', function () {
    var page = createPageContext();
    page.onLoad();

    var event = { currentTarget: { dataset: { catIndex: 0, itemId: 1 } } };
    page.toggleStatus(event); // unowned → purchased
    expect(page.data.overallStats.purchased).toBe(1);

    page.toggleStatus(event); // purchased → received
    expect(page.data.overallStats.purchased).toBe(0);
    expect(page.data.overallStats.received).toBe(1);

    page.toggleStatus(event); // received → owned
    expect(page.data.overallStats.received).toBe(0);
    expect(page.data.overallStats.owned).toBe(1);
  });

  it('防抖保存 → 500ms 后只存非 unowned 的键', function () {
    var page = createPageContext();
    page.onLoad();

    var event = { currentTarget: { dataset: { catIndex: 0, itemId: 1 } } };
    page.toggleStatus(event); // → purchased
    page.toggleStatus(event); // → received
    page.toggleStatus(event); // → owned

    // 尚未保存
    expect(wx.setStorageSync).not.toHaveBeenCalled();

    // 快进 500ms
    jest.advanceTimersByTime(500);

    var saved = wx.setStorageSync.mock.calls[0][1];
    expect(saved).toEqual({ 'c0_1': 'owned' });
    // unowned 状态的键不应被保存
    expect(Object.keys(saved).length).toBe(1);
  });

  it('多次快速点击 → 仅最后一次生效并保存', function () {
    var page = createPageContext();
    page.onLoad();

    var event = { currentTarget: { dataset: { catIndex: 2, itemId: 10 } } };
    // unowned → purchased → received (2 次点击)
    page.toggleStatus(event);
    page.toggleStatus(event);

    jest.advanceTimersByTime(500);

    expect(wx.setStorageSync).toHaveBeenCalledTimes(1);
    var saved = wx.setStorageSync.mock.calls[0][1];
    expect(saved['c2_10']).toBe('received');
  });

  it('减保存时跳过 unowned 状态的键', function () {
    var page = createPageContext();
    page.onLoad();
    page.data.itemStates = { 'c0_2': 'owned' };
    wx.setStorageSync.mockClear();

    var event = { currentTarget: { dataset: { catIndex: 0, itemId: 1 } } };
    page.toggleStatus(event); // → purchased

    jest.advanceTimersByTime(500);

    var saved = wx.setStorageSync.mock.calls[0][1];
    // c0_1: purchased, c0_2: owned — 两者都应保存
    expect(saved['c0_1']).toBe('purchased');
    expect(saved['c0_2']).toBe('owned');
    expect(Object.keys(saved).length).toBe(2);
  });
});

describe('goBack（集成测试）', function () {
  beforeEach(function () {
    _resetWxMock();
    loadPageConfig();
  });

  afterEach(function () {
    _resetWxMock();
  });

  it('在详情视图 → 返回总览', function () {
    var page = createPageContext();
    page.onLoad();
    page.selectCategory({ currentTarget: { dataset: { index: 0 } } });
    expect(page.data.currentCategory).toBe(0);

    page.goBack();
    expect(page.data.currentCategory).toBe(-1);
    expect(page.data.searchQuery).toBe('');
    expect(wx.navigateBack).not.toHaveBeenCalled();
  });

  it('在总览视图 → 调用 navigateBack', function () {
    var page = createPageContext();
    page.onLoad();
    expect(page.data.currentCategory).toBe(-1);

    page.goBack();
    expect(wx.navigateBack).toHaveBeenCalled();
  });
});

describe('selectCategory（集成测试）', function () {
  beforeEach(function () {
    _resetWxMock();
    loadPageConfig();
  });

  it('进入分类详情，清空搜索状态', function () {
    var page = createPageContext();
    page.onLoad();
    page.data.searchQuery = 'test';
    page.data.filteredItems = [{ id: 1 }];

    page.selectCategory({ currentTarget: { dataset: { index: 3 } } });
    expect(page.data.currentCategory).toBe(3);
    expect(page.data.currentCategoryData.category).toBe('卫生间');
    expect(page.data.searchQuery).toBe('');
    expect(page.data.filteredItems).toBeNull();
  });
});

describe('onSearchInput（集成测试）', function () {
  beforeEach(function () {
    _resetWxMock();
    jest.useFakeTimers();
    loadPageConfig();
  });

  afterEach(function () {
    jest.useRealTimers();
    _resetWxMock();
  });

  it('空查询 → 清空搜索结果', function () {
    var page = createPageContext();
    page.onLoad();

    page.onSearchInput({ detail: { value: '' } });
    expect(page.data.searchResults).toBeNull();
    expect(page.data.filteredItems).toBeNull();
  });

  it('总览视图 → 跨分类搜索匹配名称', function () {
    var page = createPageContext();
    page.onLoad();

    page.onSearchInput({ detail: { value: '扫把' } });
    jest.advanceTimersByTime(300);

    expect(page.data.searchResults.length).toBeGreaterThan(0);
    var names = page.data.searchResults.map(function (r) { return r.name; });
    expect(names).toContain('扫把套装');
  });

  it('总览视图 → 跨分类搜索匹配关键词', function () {
    var page = createPageContext();
    page.onLoad();

    page.onSearchInput({ detail: { value: '316不锈钢' } });
    jest.advanceTimersByTime(300);

    expect(page.data.searchResults.length).toBe(1);
    expect(page.data.searchResults[0].name).toBe('牛排夹');
  });

  it('总览视图 → 无匹配返回空结果', function () {
    var page = createPageContext();
    page.onLoad();

    page.onSearchInput({ detail: { value: '不存在的物品xyz' } });
    jest.advanceTimersByTime(300);

    expect(page.data.searchResults).toEqual([]);
  });

  it('详情视图 → 当前分类内搜索', function () {
    var page = createPageContext();
    page.onLoad();
    page.selectCategory({ currentTarget: { dataset: { index: 0 } } }); // 玄关

    page.onSearchInput({ detail: { value: '拖鞋' } });
    jest.advanceTimersByTime(300);

    expect(page.data.filteredItems.length).toBe(2); // 拖鞋 + 一次性拖鞋
  });

  it('详情视图 → 部分匹配时返回过滤后的数组', function () {
    var page = createPageContext();
    page.onLoad();
    page.selectCategory({ currentTarget: { dataset: { index: 4 } } }); // 餐厅 4 items

    page.onSearchInput({ detail: { value: '餐' } });
    jest.advanceTimersByTime(300);

    // 餐厅里"餐"字匹配餐桌、餐椅，2/4 → 返回过滤数组
    expect(page.data.filteredItems.length).toBe(2);
  });

  it('详情视图 → 无匹配时返回空数组', function () {
    var page = createPageContext();
    page.onLoad();
    page.selectCategory({ currentTarget: { dataset: { index: 4 } } }); // 餐厅 4 items

    page.onSearchInput({ detail: { value: 'xyz不匹配' } });
    jest.advanceTimersByTime(300);

    expect(page.data.filteredItems).toEqual([]);
  });

  it('搜索防抖 → 300ms 内多次输入只触发最后一次', function () {
    var page = createPageContext();
    page.onLoad();

    page.onSearchInput({ detail: { value: 'a' } });
    page.onSearchInput({ detail: { value: 'ab' } });
    page.onSearchInput({ detail: { value: '扫把套装' } }); // 最终值

    jest.advanceTimersByTime(300);

    expect(page.data.searchResults.length).toBe(1);
    expect(page.data.searchResults[0].name).toBe('扫把套装');
  });
});

describe('clearSearch（集成测试）', function () {
  beforeEach(function () {
    _resetWxMock();
    loadPageConfig();
  });

  it('清除搜索状态', function () {
    var page = createPageContext();
    page.onLoad();
    page.data.searchQuery = 'test';
    page.data.searchResults = [{ id: 1 }];
    page.data.filteredItems = [{ id: 1 }];

    page.clearSearch();
    expect(page.data.searchQuery).toBe('');
    expect(page.data.searchResults).toBeNull();
    expect(page.data.filteredItems).toBeNull();
  });
});

describe('copyKeywords（集成测试）', function () {
  beforeEach(function () {
    _resetWxMock();
    loadPageConfig();
  });

  it('复制关键词到剪贴板并提示', function () {
    var page = createPageContext();
    page.copyKeywords({ currentTarget: { dataset: { keywords: '扫把套装 PET软毛' } } });

    expect(wx.setClipboardData).toHaveBeenCalledWith(
      expect.objectContaining({ data: '扫把套装 PET软毛' })
    );
    // 成功回调触发 toast
    var callArgs = wx.setClipboardData.mock.calls[0][0];
    callArgs.success();
    expect(wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '已复制选购关键词' })
    );
  });

  it('空关键词不操作', function () {
    var page = createPageContext();
    wx.setClipboardData.mockClear();
    page.copyKeywords({ currentTarget: { dataset: { keywords: '' } } });
    expect(wx.setClipboardData).not.toHaveBeenCalled();
  });
});

describe('toggleDescription（集成测试）', function () {
  beforeEach(function () {
    _resetWxMock();
    loadPageConfig();
  });

  it('展开 → 收起来回切换', function () {
    var page = createPageContext();
    var event = { currentTarget: { dataset: { catIndex: 0, itemId: 1 } } };

    page.toggleDescription(event);
    expect(page.data.expandedItems['c0_1']).toBe(true);

    page.toggleDescription(event);
    expect(page.data.expandedItems['c0_1']).toBe(false);
  });
});

describe('resetCurrentCategory（集成测试）', function () {
  beforeEach(function () {
    _resetWxMock();
    loadPageConfig();
  });

  it('用户确认 → 清空该分类所有状态', function () {
    var page = createPageContext();
    page.onLoad();
    page.selectCategory({ currentTarget: { dataset: { index: 0 } } }); // 玄关
    page.data.itemStates = { 'c0_1': 'owned', 'c0_2': 'owned', 'c0_3': 'purchased', 'c2_5': 'owned' };

    page.resetCurrentCategory();

    // 取出 showModal 的回调并模拟确认
    var modalCall = wx.showModal.mock.calls[0][0];
    expect(modalCall.title).toBe('重置确认');
    modalCall.success({ confirm: true });

    expect(page.data.itemStates['c0_1']).toBeUndefined();
    expect(page.data.itemStates['c0_2']).toBeUndefined();
    expect(page.data.itemStates['c0_3']).toBeUndefined();
    // 其他分类不受影响
    expect(page.data.itemStates['c2_5']).toBe('owned');
    expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '已重置' }));
  });

  it('用户取消 → 状态不变', function () {
    var page = createPageContext();
    page.onLoad();
    page.selectCategory({ currentTarget: { dataset: { index: 0 } } });
    page.data.itemStates = { 'c0_1': 'owned' };

    page.resetCurrentCategory();

    var modalCall = wx.showModal.mock.calls[0][0];
    modalCall.success({ confirm: false });

    expect(page.data.itemStates['c0_1']).toBe('owned');
    expect(wx.showToast).not.toHaveBeenCalled();
  });
});

describe('showStatusSheet（集成测试）', function () {
  beforeEach(function () {
    _resetWxMock();
    jest.useFakeTimers();
    loadPageConfig();
  });

  afterEach(function () {
    jest.useRealTimers();
    _resetWxMock();
  });

  it('长按选状态 → 直接跳转到所选状态', function () {
    var page = createPageContext();
    page.onLoad();

    var event = { currentTarget: { dataset: { catIndex: 0, itemId: 1 } } };
    page.showStatusSheet(event);

    // 模拟选择第 3 项（received, index=2）
    var sheetCall = wx.showActionSheet.mock.calls[0][0];
    sheetCall.success({ tapIndex: 2 }); // received

    expect(page.data.itemStates['c0_1']).toBe('received');
  });

  it('选择当前状态 → 不变', function () {
    var page = createPageContext();
    page.onLoad();
    // 默认 unowned

    var event = { currentTarget: { dataset: { catIndex: 0, itemId: 1 } } };
    page.showStatusSheet(event);

    var sheetCall = wx.showActionSheet.mock.calls[0][0];
    sheetCall.success({ tapIndex: 0 }); // unowned = 不变

    expect(page.data.itemStates['c0_1']).toBeUndefined(); // 仍然是默认值
  });

  it('ActionSheet 列表包含当前选中标记', function () {
    var page = createPageContext();
    page.onLoad();
    page.data.itemStates['c0_3'] = 'received';

    var event = { currentTarget: { dataset: { catIndex: 0, itemId: 3 } } };
    page.showStatusSheet(event);

    var items = wx.showActionSheet.mock.calls[0][0].itemList;
    // received 在索引 2，应该有 ✓
    expect(items[0]).toBe('未拥有');
    expect(items[1]).toBe('已购买');
    expect(items[2]).toContain('✓');
    expect(items[3]).toBe('已拥有');
  });
});

describe('存储稳定性（集成测试）', function () {
  beforeEach(function () {
    _resetWxMock();
    jest.useFakeTimers();
    loadPageConfig();
  });

  afterEach(function () {
    jest.useRealTimers();
    _resetWxMock();
  });

  it('onLoad → 多次 toggle → 存储稀疏键 → re-onLoad 复原', function () {
    // 第一次会话
    var page = createPageContext();
    page.onLoad();

    page.toggleStatus({ currentTarget: { dataset: { catIndex: 0, itemId: 1 } } }); // purchased
    page.toggleStatus({ currentTarget: { dataset: { catIndex: 0, itemId: 1 } } }); // received
    page.toggleStatus({ currentTarget: { dataset: { catIndex: 1, itemId: 3 } } }); // purchased
    jest.advanceTimersByTime(500);

    // 验证保存的内容
    var saved = wx.setStorageSync.mock.calls[0][1];
    expect(Object.keys(saved).sort()).toEqual(['c0_1', 'c1_3']);

    // 模拟重新加载 → getStorageSync 返回保存内容
    _resetWxMock();
    loadPageConfig();
    wx.getStorageSync.mockReturnValue(saved);

    var page2 = createPageContext();
    page2.onLoad();

    expect(page2.data.itemStates['c0_1']).toBe('received');
    expect(page2.data.itemStates['c1_3']).toBe('purchased');
    expect(page2.data.itemStates['c2_1']).toBeUndefined(); // unowned 默认
    expect(page2.data.overallStats.received).toBe(1);
    expect(page2.data.overallStats.purchased).toBe(1);
  });
});

describe('视图切换一致性（集成测试）', function () {
  beforeEach(function () {
    _resetWxMock();
    loadPageConfig();
  });

  it('总览 → 详情 → 返回总览 → 状态保持', function () {
    var page = createPageContext();
    page.onLoad();

    // 标记一些物品
    page.data.itemStates = { 'c0_1': 'owned', 'c0_2': 'owned' };
    page._recomputeStats(0);

    var beforeOverall = page.data.overallStats.owned;

    // 进入玄关详情
    page.selectCategory({ currentTarget: { dataset: { index: 0 } } });
    expect(page.data.currentCategory).toBe(0);

    // 在详情内切换物品状态
    page.toggleStatus({ currentTarget: { dataset: { catIndex: 0, itemId: 3 } } });

    // 返回总览
    page.goBack();
    expect(page.data.currentCategory).toBe(-1);
    expect(page.data.searchQuery).toBe('');
    expect(page.data.searchResults).toBeNull();

    // 总览统计应反映详情内的修改
    expect(page.data.overallStats.owned).toBe(beforeOverall);
    expect(page.data.overallStats.purchased).toBe(1);
  });
});
