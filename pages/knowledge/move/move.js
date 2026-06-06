var app = getApp();

// 搬家核对清单完整数据
var moveData = [
  {
    step: 1,
    title: '搬家前准备',
    icon: '📋',
    items: [
      { id: 1, desc: '确认搬家日期，提前1-2个月开始规划' },
      { id: 2, desc: '测量新家各房间尺寸，确认大件家具能否进入（门宽、电梯尺寸、楼道转角）' },
      { id: 3, desc: '预约搬家公司，货比三家，确认报价是否含打包材料费/楼层费/超距费' },
      { id: 4, desc: '清理旧家具和家电：能卖的先挂闲鱼，不能卖的预约大件垃圾清运' },
      { id: 5, desc: '办理地址变更：身份证/户口本/驾驶证/银行卡/信用卡/保险/社保' },
      { id: 6, desc: '办理网络宽带迁移或新装，提前预约运营商上门（新小区至少提前1周）' },
      { id: 7, desc: '办理水电气过户/开户：联系物业或自行在App上申请' },
      { id: 8, desc: '通知重要机构：公司HR/学校/医院/快递代收点/物业' },
      { id: 9, desc: '清点贵重物品（首饰/证件/合同/存折）单独打包，搬家当天随身携带' },
      { id: 10, desc: '购买搬家保险：贵重物品较多的建议购买，确认保额和理赔条款' },
      { id: 11, desc: '预约新家保洁：搬家前至少做一次深度保洁，特别是厨房和卫生间' }
    ],
    notes: '1. 搬家日期尽量避开周末和月底，搬家公司报价更低且车辆更充足\n2. 旧家拍照留底：每个房间拍一组照片，退房/交房时对比，避免押金纠纷\n3. 新家拍照留底：入住前拍下每个空间的空置状态，方便后续软装规划\n4. 搬家公司的选择：正规公司比个人搬家贵但更有保障，建议选有营业执照和固定门店的',
    contract: '注意：与搬家公司签订合同前，务必确认费用明细和损坏赔偿条款!'
  },
  {
    step: 2,
    title: '打包整理',
    icon: '📦',
    items: [
      { id: 1, desc: '购买打包材料：纸箱（建议60*40*50cm标准箱）、气泡膜、胶带、记号笔、缠绕膜、真空压缩袋' },
      { id: 2, desc: '按房间分类打包：卧室/客厅/厨房/卫生间/阳台分别装箱，不要混装' },
      { id: 3, desc: '每个纸箱用记号笔标注：①房间名称 ②物品类别 ③易碎标记 ④编号（如：主卧-衣物-1/5）' },
      { id: 4, desc: '易碎物品：碗碟/杯子/镜子/相框用气泡膜包裹，箱内塞满缓冲物，箱外标注"易碎"' },
      { id: 5, desc: '衣物被褥：用真空压缩袋压缩体积，节省空间和运费' },
      { id: 6, desc: '电子产品：原包装最好，没有原包装的用气泡膜包裹后放入纸箱，缝隙填满' },
      { id: 7, desc: '书籍文件：用小号纸箱装（书太重），不超过15kg/箱，胶带封底加固' },
      { id: 8, desc: '液体类：洗护用品/调料瓶拧紧盖子，单独用防水袋密封后再装箱' },
      { id: 9, desc: '绿植盆栽：提前1天停止浇水，用塑料袋套住盆口防止泥土撒漏' },
      { id: 10, desc: '宠物用品：准备宠物航空箱/笼子，搬家当天宠物由家人或朋友暂时看管' },
      { id: 11, desc: '编制物品清单：每个房间列一份装箱明细（拍照+表格均可），方便新家核对' },
      { id: 12, desc: '准备"第一天必用箱"：洗漱用品/睡衣/充电器/卫生纸/毛巾/拖鞋单独装箱，标注"先拆"' }
    ],
    notes: '1. 纸箱底部加固：无论新箱旧箱，底部都要用胶带"王"字形封口，避免路上漏底\n2. 重不压轻：重物在下、轻物在上，箱内不要留空隙（空隙会导致挤压变形）\n3. 不要装太满：纸箱装到8-9分满即可，留一点缓冲空间\n4. 刀具/剪刀等尖锐物品用硬纸板包裹刀口，单独标注提醒工人注意\n5. 打包顺序：不常用物品先打包（装饰品/换季衣物），最后打包常用品（厨房/卫生间）',
    contract: ''
  },
  {
    step: 3,
    title: '搬家当天',
    icon: '🚛',
    items: [
      { id: 1, desc: '早起检查：出发前每个房间走一遍，确认没有遗漏物品（重点：柜子顶/床底/阳台/窗帘后面）' },
      { id: 2, desc: '贵重物品随身携带：证件/首饰/现金/合同/笔记本电脑/移动硬盘，不要交给搬运工' },
      { id: 3, desc: '现场监督装车：大件家具先上、小件后上，易碎品放在最上面或单独放置' },
      { id: 4, desc: '核对箱数：装车前清点纸箱总数，装车后和卸车后再各清点一次' },
      { id: 5, desc: '旧家确认：水电气阀门已关闭、门窗已锁好、钥匙已交给物业或房东' },
      { id: 6, desc: '旧家物业交接：结清物业费/水电气费，办理放行条，退还门禁卡/停车卡' },
      { id: 7, desc: '新家现场指挥：告知工人每个房间对应哪种标记的箱子，避免乱放' },
      { id: 8, desc: '大件家具定位：按提前规划好的位置摆放，不要临时决定（搬完再挪很麻烦）' },
      { id: 9, desc: '现场检查：大件家具/家电检查是否有磕碰损坏，有损坏当场拍照并联系搬家公司' },
      { id: 10, desc: '核对物品清单：对照打包时编制的清单逐项核对，确认无遗漏' },
      { id: 11, desc: '检查水电：打开总阀检查是否有漏水，测试所有插座是否通电' }
    ],
    notes: '1. 准备一些现金：虽然大部分搬家公司支持扫码支付，但备少量现金以防万一\n2. 给工人准备饮用水/饮料：搬家是体力活，友好的态度能让工人更小心对待你的物品\n3. 搬完给小费不是必须的，但如果工人特别细心负责，适当表示感谢是人之常情\n4. 发现物品损坏不要慌张：①拍照留证 ②联系搬家公司客服 ③按合同约定走理赔流程\n5. 搬家当天尽量有家人或朋友帮忙，一个人很难同时盯装车和看物品',
    contract: '注意：搬家完成后务必当场验收，发现问题立即拍照并让搬家公司签字确认!'
  },
  {
    step: 4,
    title: '新家入住',
    icon: '🏠',
    items: [
      { id: 1, desc: '安全检查：测试烟雾报警器/燃气报警器是否正常，确认灭火器位置' },
      { id: 2, desc: '门锁更换：入住后第一件事换锁芯或重置密码锁，前任住户可能有备用钥匙' },
      { id: 3, desc: '水电燃气确认：记录水电气初始读数，确认缴费方式和户号' },
      { id: 4, desc: '网络开通：测试所有房间WiFi信号强度，信号弱的位置加装AP面板或Mesh路由器' },
      { id: 5, desc: '家具安装：按"先大后小、先重后轻"的顺序拆包安装，大件家具最好让商家上门安装' },
      { id: 6, desc: '窗帘/百叶窗安装：优先安装卧室窗帘，确保入住当晚有隐私和遮光' },
      { id: 7, desc: '家电安装调试：冰箱静置2小时后通电，洗衣机/烘干机/热水器预约品牌售后上门安装' },
      { id: 8, desc: '厨房就位：锅碗瓢盆/调料/清洁用品归位，冰箱通电后至少2小时再放食材' },
      { id: 9, desc: '卫生间就位：马桶/淋浴/热水器测试，毛巾架/挂钩/置物架安装' },
      { id: 10, desc: '卧室就位：床优先安装好，铺上床品，确保当晚能好好休息' },
      { id: 11, desc: '办理小区门禁/停车位/快递柜注册等物业手续' },
      { id: 12, desc: '熟悉周边环境：菜市场/超市/药店/医院/地铁站位置记好' },
      { id: 13, desc: '纸箱回收：拆完的纸箱折叠捆绑好，联系物业或废品回收处理' }
    ],
    notes: '1. 入住第一周不要急着把所有东西都拆完，先拆生活必需品，其它慢慢整理\n2. 新家可能有异味或甲醛残留，多开窗通风，可以买一些活性炭包或空气净化器\n3. 邻里关系：入住后主动和邻居打个招呼，方便日后互相照应\n4. 记录维修电话：物业/水电气/宽带/开锁等常用电话存好，Emergency情况下不慌乱\n5. 拍一张"入住照"：新家第一天的照片，日后回头看会很有意义',
    contract: ''
  }
];

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    steps: [],
    currentStep: -1,
    currentData: null,
    checkStates: {}
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

    var steps = moveData.map(function(item) {
      return {
        step: item.step,
        title: item.title,
        icon: item.icon,
        count: item.items.length
      };
    });

    var checkStates = wx.getStorageSync('move_checks') || {};

    this.setData({
      steps: steps,
      checkStates: checkStates
    });
  },

  goBack: function() {
    if (this.data.currentStep >= 0) {
      this.setData({
        currentStep: -1,
        currentData: null
      });
    } else {
      wx.navigateBack();
    }
  },

  selectStep: function(e) {
    var index = e.currentTarget.dataset.index;
    var data = moveData[index];
    this.setData({
      currentStep: index,
      currentData: data
    });
  },

  toggleCheck: function(e) {
    var step = e.currentTarget.dataset.step;
    var itemId = e.currentTarget.dataset.id;
    var key = 'step' + step + '_' + itemId;
    var dataPath = 'checkStates.' + key;
    var newVal = !this.data.checkStates[key];

    this.setData({ [dataPath]: newVal });

    var self = this;
    if (self._saveTimer) clearTimeout(self._saveTimer);
    self._saveTimer = setTimeout(function() {
      wx.setStorageSync('move_checks', self.data.checkStates);
    }, 500);
  },

  resetCurrentStep: function() {
    var self = this;
    var data = this.data.currentData;
    if (!data) return;

    wx.showModal({
      title: '重置确认',
      content: '确定要重置「' + data.title + '」的所有检查项吗？',
      confirmColor: '#FC9700',
      success: function(res) {
        if (res.confirm) {
          var checkStates = self.data.checkStates;
          data.items.forEach(function(item) {
            var key = 'step' + data.step + '_' + item.id;
            delete checkStates[key];
          });
          self.setData({ checkStates: checkStates });
          wx.setStorageSync('move_checks', checkStates);
          wx.showToast({ title: '已重置', icon: 'success' });
        }
      }
    });
  },

  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('move', this, res);
  },

  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('move', this);
  }
});
