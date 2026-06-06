var app = getApp();

// 预算分类数据（基于Excel"装前预算"表）
var BUDGET_CATEGORIES = [
  {
    name: '设计费',
    desc: '设计师的时间费用+三套图纸费用',
    ratio: 0.035,
    color: '#A8D8EA',
    items: [
      { name: '设计服务', ratio: 0.02, ref: '200-800元', unit: '/m²' },
      { name: '平面图', ratio: 0.002, ref: '200-500元', unit: '/张' },
      { name: '效果图', ratio: 0.006, ref: '200-800元', unit: '/张' },
      { name: '施工图', ratio: 0.007, ref: '20元', unit: '/m²' }
    ],
    tips: '不要忽略设计服务费，好的设计师会跟进项目半年甚至一两年，设计师能经常去工地很重要'
  },
  {
    name: '拆改',
    desc: '精装/旧房拆回毛坯房的费用',
    ratio: 0.015,
    color: '#F9C5D1',
    items: [
      { name: '墙体拆除', ratio: 0.005, ref: '30-80元', unit: '/m²' },
      { name: '地砖拆除', ratio: 0.002, ref: '40元', unit: '/m²' },
      { name: '木门拆除', ratio: 0.001, ref: '70元', unit: '/套' },
      { name: '吊顶拆除', ratio: 0.001, ref: '20元', unit: '/m²' },
      { name: '墙皮拆除', ratio: 0.001, ref: '10元', unit: '/m²' },
      { name: '其它拆除', ratio: 0.002, ref: '', unit: '' },
      { name: '垃圾清运', ratio: 0.003, ref: '600-1k元', unit: '/车' }
    ],
    tips: '轻质砖会比红砖便宜，但能用红砖尽量用红砖\n已含工地管理费\n上下浮动10%很正常\n大城市垃圾清运1k/车'
  },
  {
    name: '水电',
    desc: '水电改造施工',
    ratio: 0.07,
    color: '#FFE5A0',
    items: [
      { name: '新建墙体', ratio: 0.01, ref: '100-140元', unit: '/m²' },
      { name: '水电改造', ratio: 0.03, ref: '100-140元', unit: '/m²' },
      { name: '防水施工', ratio: 0.005, ref: '80元', unit: '/m²' },
      { name: '包管道', ratio: 0.005, ref: '100元', unit: '/根' },
      { name: '辅料', ratio: 0.02, ref: '', unit: '' }
    ],
    tips: '含网线改造\n已含工地管理费\n上下浮动10%很正常\n辅料为新国标品牌辅料'
  },
  {
    name: '泥工',
    desc: '泥工施工',
    ratio: 0.056,
    color: '#C5E1A5',
    items: [
      { name: '地面找平', ratio: 0.008, ref: '30-50元', unit: '/m²' },
      { name: '地砖铺设', ratio: 0.012, ref: '40-60元', unit: '/m²' },
      { name: '墙砖铺设', ratio: 0.006, ref: '40-70元', unit: '/m²' },
      { name: '美缝施工', ratio: 0.01, ref: '15-35元', unit: '/m²' },
      { name: '辅料', ratio: 0.02, ref: '', unit: '' }
    ],
    tips: '含门槛石+踢脚线\n100㎡满铺约300米美缝\n已含工地管理费\n辅料为新国标品牌辅料+磁砖/木地板'
  },
  {
    name: '木工',
    desc: '木工施工',
    ratio: 0.05,
    color: '#D1C4E9',
    items: [
      { name: '吊顶施工', ratio: 0.015, ref: '150-300元', unit: '/m²' },
      { name: '木饰面', ratio: 0.01, ref: '200-600元', unit: '/m²' },
      { name: '木质窗套', ratio: 0.005, ref: '200-400元', unit: '/米' },
      { name: '定制家具', ratio: 0.01, ref: '800-1500元', unit: '/m²' },
      { name: '辅料', ratio: 0.01, ref: '', unit: '' }
    ],
    tips: '已含工地管理费\n上下浮动10%很正常\n辅料为新国标品牌辅料'
  },
  {
    name: '油工',
    desc: '油工施工',
    ratio: 0.06,
    color: '#FFCCBC',
    items: [
      { name: '墙面处理', ratio: 0.015, ref: '15-40元', unit: '/m²' },
      { name: '乳胶漆', ratio: 0.015, ref: '15-40元', unit: '/m²' },
      { name: '木器漆', ratio: 0.005, ref: '60-100元', unit: '/m²' },
      { name: '墙纸/墙布', ratio: 0.01, ref: '20-80元', unit: '/m²' },
      { name: '辅料', ratio: 0.015, ref: '', unit: '' }
    ],
    tips: '已含工地管理费\n上下浮动10%很正常\n辅料为新国标品牌辅料'
  },
  {
    name: '机电',
    desc: '机电设备',
    ratio: 0.106,
    color: '#B3E5FC',
    items: [
      { name: '中央空调', ratio: 0.06, ref: '2-6w', unit: '/套' },
      { name: '风管机/壁挂', ratio: 0.01, ref: '3-8k', unit: '/台' },
      { name: '新风系统', ratio: 0.015, ref: '1.5-3w', unit: '/套' },
      { name: '地暖/暖气', ratio: 0.016, ref: '100-250元', unit: '/m²' },
      { name: '辅料', ratio: 0.005, ref: '', unit: '' }
    ],
    tips: '空调地暖建议找大经销商\n壁挂机+风管机组合比全屋中央空调便宜很多\n辅料为新国标品牌辅料'
  },
  {
    name: '净水',
    desc: '净水系统',
    ratio: 0.018,
    color: '#80DEEA',
    items: [
      { name: '前置过滤', ratio: 0.003, ref: '500-2k', unit: '/台' },
      { name: '中央净水', ratio: 0.005, ref: '2k-8k', unit: '/台' },
      { name: '中央软水', ratio: 0.005, ref: '3k-10k', unit: '/台' },
      { name: '末端净水器', ratio: 0.005, ref: '1k-5k', unit: '/台' }
    ],
    tips: '前置过滤器是基础配置\n按需选配净水/软水设备'
  },
  {
    name: '智能灯光',
    desc: '灯光照明系统',
    ratio: 0.09,
    color: '#FFE082',
    items: [
      { name: '筒射灯', ratio: 0.015, ref: '50-300元', unit: '/个' },
      { name: '灯带', ratio: 0.01, ref: '20-80元', unit: '/米' },
      { name: '主灯', ratio: 0.01, ref: '200-5k', unit: '/个' },
      { name: '轨道灯', ratio: 0.005, ref: '80-300元', unit: '/个' },
      { name: '智能网关', ratio: 0.005, ref: '500-2k', unit: '/套' },
      { name: '智能面板', ratio: 0.015, ref: '200-800元', unit: '/个' },
      { name: '智能窗帘', ratio: 0.015, ref: '1k-5k', unit: '/套' },
      { name: '传感器套装', ratio: 0.015, ref: '500-3k', unit: '/套' }
    ],
    tips: '无主灯方案比传统灯具贵\n智能化可以后期逐步添加\n灯光设计建议请设计师规划'
  },
  {
    name: '门窗',
    desc: '门窗工程',
    ratio: 0.08,
    color: '#CE93D8',
    items: [
      { name: '入户门', ratio: 0.01, ref: '3k-2w', unit: '/套' },
      { name: '室内门', ratio: 0.02, ref: '1k-8k', unit: '/套' },
      { name: '窗户', ratio: 0.03, ref: '800-2k', unit: '/m²' },
      { name: '阳台推拉门', ratio: 0.01, ref: '800-1.5k', unit: '/m²' },
      { name: '门锁五金', ratio: 0.01, ref: '200-2k', unit: '/套' }
    ],
    tips: '门窗需要提前测量\n断桥铝窗户性价比高\n门锁建议用指纹锁'
  },
  {
    name: '卫生间',
    desc: '卫浴洁具',
    ratio: 0.06,
    color: '#90CAF9',
    items: [
      { name: '马桶', ratio: 0.008, ref: '1k-8k', unit: '/个' },
      { name: '花洒套装', ratio: 0.006, ref: '500-5k', unit: '/套' },
      { name: '浴室柜', ratio: 0.01, ref: '1k-8k', unit: '/套' },
      { name: '淋浴房', ratio: 0.008, ref: '2k-10k', unit: '/套' },
      { name: '浴霸/风暖', ratio: 0.005, ref: '500-3k', unit: '/台' },
      { name: '五金挂件', ratio: 0.003, ref: '300-2k', unit: '/套' },
      { name: '镜柜', ratio: 0.005, ref: '500-3k', unit: '/个' },
      { name: '地漏', ratio: 0.002, ref: '50-300元', unit: '/个' },
      { name: '其它', ratio: 0.003, ref: '', unit: '' },
      { name: '毛巾架', ratio: 0.005, ref: '100-500元', unit: '/个' },
      { name: '卫生间门', ratio: 0.005, ref: '800-3k', unit: '/套' }
    ],
    tips: '智能马桶建议选品牌\n五金件不要省\n浴室柜建议落地式好打理'
  },
  {
    name: '餐厨家政',
    desc: '厨房+餐厅+家政区',
    ratio: 0.14,
    color: '#EF9A9A',
    items: [
      { name: '橱柜', ratio: 0.035, ref: '1k-20k', unit: '/米' },
      { name: '西厨/餐边柜', ratio: 0.015, ref: '800-15k', unit: '/米' },
      { name: '橱柜台面', ratio: 0.011, ref: '200-5k', unit: '/m²' },
      { name: '厨房水槽', ratio: 0.002, ref: '300-4k', unit: '/个' },
      { name: '厨房龙头', ratio: 0.0015, ref: '200-3k', unit: '/个' },
      { name: '垃圾处理器', ratio: 0.0015, ref: '500-3k', unit: '/个' },
      { name: '嵌入洗碗机', ratio: 0.008, ref: '4k-10k', unit: '/台' },
      { name: '嵌入冰箱', ratio: 0.01, ref: '5k-20k', unit: '/台' },
      { name: '油烟灶具', ratio: 0.008, ref: '2k-10k', unit: '/套' },
      { name: '餐桌', ratio: 0.01, ref: '2k-20k', unit: '/张' },
      { name: '餐椅', ratio: 0.005, ref: '300-5k', unit: '/把' },
      { name: '蒸烤一体机', ratio: 0.006, ref: '3k-10k', unit: '/个' },
      { name: '功能五金', ratio: 0.012, ref: '', unit: '' },
      { name: '洗烘套装', ratio: 0.015, ref: '6k-20k', unit: '/套' }
    ],
    tips: '功能五金包含各种拉多功能拉篮、电动五金、太空舱、联动柜等，合理使用功能五金可以大大提升厨房的实用性和收纳\n不要买洗烘一体机，基本烘干不了，优先选择热泵式洗烘套装\n厨房多做「抽屉」'
  },
  {
    name: '卧室',
    desc: '卧室家具',
    ratio: 0.095,
    color: '#9FA8DA',
    items: [
      { name: '定制衣柜', ratio: 0.04, ref: '800-8k', unit: '/米' },
      { name: '书桌', ratio: 0.01, ref: '2k-5k', unit: '/张' },
      { name: '卧室椅', ratio: 0.008, ref: '500-5k', unit: '/把' },
      { name: '床头柜', ratio: 0.007, ref: '300-1k', unit: '/个' },
      { name: '床架', ratio: 0.01, ref: '1k-10k', unit: '/张' },
      { name: '床垫', ratio: 0.01, ref: '1k-10k', unit: '/张' }
    ],
    tips: '衣柜建议用多层实木\n床垫建议去实体店体验后购买'
  },
  {
    name: '公区',
    desc: '客厅+公共区域',
    ratio: 0.052,
    color: '#A5D6A7',
    items: [
      { name: '沙发', ratio: 0.02, ref: '3k-100k', unit: '/套' },
      { name: '电视', ratio: 0.007, ref: '2k-15k', unit: '/台' },
      { name: '茶几', ratio: 0.007, ref: '2k-10k', unit: '/张' },
      { name: '边几', ratio: 0.003, ref: '500-5k', unit: '/张' },
      { name: '玄关鞋柜', ratio: 0.015, ref: '600-5k', unit: '/米' }
    ],
    tips: '沙发建议选可拆洗面料\n电视看预算选配'
  },
  {
    name: '其它',
    desc: '装饰+灯具+清洁',
    ratio: 0.026,
    color: '#FFF59D',
    items: [
      { name: '室内装饰', ratio: 0.01, ref: '', unit: '' },
      { name: '移动灯具', ratio: 0.01, ref: '', unit: '' },
      { name: '清洁工具', ratio: 0.006, ref: '', unit: '' }
    ],
    tips: '装饰品可以慢慢添置'
  },
  {
    name: '备用金',
    desc: '预留应急资金',
    ratio: 0.035,
    color: '#FFAB91',
    items: [],
    tips: '建议预留3-5%的备用金，装修过程中总会有意料之外的支出'
  }
];

// 饼图颜色配置
var PIE_COLORS = [
  '#A8D8EA', '#F9C5D1', '#FFE5A0', '#C5E1A5', '#D1C4E9',
  '#FFCCBC', '#B3E5FC', '#80DEEA', '#FFE082', '#CE93D8',
  '#90CAF9', '#EF9A9A', '#9FA8DA', '#A5D6A7', '#FFF59D', '#FFAB91'
];

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    totalBudget: '',
    area: '',
    budgetPerSqm: 0,
    showResult: false,
    categories: [],
    expandedIndex: -1,
    showInput: true,
    hasSavedBudget: false,
    // 饼图数据
    pieData: [],
    pieGradient: ''
  },

  onLoad: function() {
    var that = this;
    // 设置导航栏高度
    try {
      var sysInfo = wx.getWindowInfo();
      var menuBtn = wx.getMenuButtonBoundingClientRect();
      var statusBarHeight = sysInfo.statusBarHeight || 20;
      var navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
      that.setData({
        statusBarHeight: statusBarHeight,
        navBarHeight: navBarHeight
      });
    } catch (e) {
      that.setData({ statusBarHeight: 20, navBarHeight: 44 });
    }

    // 检查本地是否已保存预算数据
    var savedBudget = wx.getStorageSync('budgetData');
    if (savedBudget && savedBudget.totalBudget && savedBudget.area) {
      that.setData({
        totalBudget: String(savedBudget.totalBudget),
        area: String(savedBudget.area),
        hasSavedBudget: true,
        showInput: false
      });
      that.calculateBudget();
    }
  },

  onInputBudget: function(e) {
    this.setData({ totalBudget: e.detail.value });
  },

  onInputArea: function(e) {
    this.setData({ area: e.detail.value });
  },

  onCalculate: function() {
    var budget = parseFloat(this.data.totalBudget);
    var area = parseFloat(this.data.area);

    if (!budget || budget <= 0) {
      wx.showToast({ title: '请输入有效的总预算', icon: 'none' });
      return;
    }
    if (!area || area <= 0) {
      wx.showToast({ title: '请输入有效的套内面积', icon: 'none' });
      return;
    }

    // 保存到本地存储
    wx.setStorageSync('budgetData', {
      totalBudget: budget,
      area: area
    });

    this.setData({ hasSavedBudget: true });
    this.calculateBudget();
  },

  calculateBudget: function() {
    var budget = parseFloat(this.data.totalBudget);
    var area = parseFloat(this.data.area);
    var perSqm = Math.round(budget / area);

    var categories = [];
    for (var i = 0; i < BUDGET_CATEGORIES.length; i++) {
      var cat = BUDGET_CATEGORIES[i];
      var catCost = Math.round(budget * cat.ratio);
      var ratioPercent = (cat.ratio * 100).toFixed(1);

      var items = [];
      for (var j = 0; j < cat.items.length; j++) {
        var item = cat.items[j];
        items.push({
          name: item.name,
          ratio: (item.ratio * 100).toFixed(2) + '%',
          cost: Math.round(budget * item.ratio),
          ref: item.ref,
          unit: item.unit
        });
      }

      categories.push({
        name: cat.name,
        desc: cat.desc,
        ratio: ratioPercent + '%',
        ratioNum: cat.ratio,
        cost: catCost,
        color: cat.color,
        items: items,
        tips: cat.tips
      });
    }

    // 饼图数据 + conic-gradient 字符串
    var pieData = [];
    var gradientParts = [];
    var accPercent = 0; // 累计百分比
    for (var k = 0; k < categories.length; k++) {
      pieData.push({
        name: categories[k].name,
        ratio: categories[k].ratioNum,
        percent: categories[k].ratio,
        color: categories[k].color
      });
      var startP = accPercent;
      accPercent += categories[k].ratioNum * 100;
      var endP = accPercent;
      gradientParts.push(categories[k].color + ' ' + startP.toFixed(3) + '% ' + endP.toFixed(3) + '%');
    }
    // 兜底：若总和不足 100%（理论上应为 100%），补一段透明/灰白
    if (accPercent < 99.99) {
      gradientParts.push('#f0f0f0 ' + accPercent.toFixed(3) + '% 100%');
    }
    var pieGradient = gradientParts.join(', ');

    this.setData({
      budgetPerSqm: perSqm,
      categories: categories,
      pieData: pieData,
      pieGradient: pieGradient,
      showResult: true,
      showInput: false
    });
  },

  toggleCategory: function(e) {
    var index = e.currentTarget.dataset.index;
    if (this.data.expandedIndex === index) {
      this.setData({ expandedIndex: -1 });
    } else {
      this.setData({ expandedIndex: index });
    }
  },

  onResetInput: function() {
    this.setData({
      showInput: true,
      showResult: false,
      expandedIndex: -1
    });
  },

  goBack: function() {
    wx.navigateBack();
  },

  formatMoney: function(num) {
    if (num >= 10000) {
      return (num / 10000).toFixed(2) + '万';
    }
    return num.toLocaleString ? num.toLocaleString() : String(num);
  },

  /** 转发到聊天 */
  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('budget', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('budget', this);
  }
});
