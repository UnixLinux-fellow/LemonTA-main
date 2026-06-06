var app = getApp();

// 验收清单完整数据 —— 来自《施工快速验收清单.xlsx》
var inspectData = [
  {
    step: 1,
    title: '全屋拆除（拆旧）验收',
    icon: '🔨',
    items: [
      { id: 1, desc: '腻子：铲除是否干净，墙面要铲到水泥基层，注意各边角死角处，重点检查客厅，走廊，玄关处' },
      { id: 2, desc: '地砖：是否拆除干净，地砖基层是否存在松动情况' },
      { id: 3, desc: '地板：部分木地板有，地钉是否完全拆除干净\n（地板龙骨下都有地钉，很难拔除，很容易漏掉，有些工人会敲平，也不通过）' },
      { id: 4, desc: '吊顶：吊顶是否拆除了，吊顶龙骨是否已完全拆除' },
      { id: 5, desc: '垂直平整度：检查墙面垂直平整度是否在合同约定内' },
      { id: 6, desc: '卫生间：检查防水层是否拆除干净' },
      { id: 7, desc: '水管：检查是否被误伤，是否堵漏' },
      { id: 8, desc: '总阀门：是否漏水' },
      { id: 9, desc: '烟道：是否被误伤，是否有破损' },
      { id: 10, desc: '阳台：保温层是否拆除干净，没敢干净后期封窗会漏水，且新墙体与旧墙体无法衔接' },
      { id: 11, desc: '垃圾：垃圾是否已完全运走，是否存在临时堆放没有拉走' }
    ],
    notes: '1. 原木地板：除非很新或准备保留，否则建议拆除后重新铺设\n2. 交底：务必让设计师/工长共同进行拆除交底，所有拆除会在墙面马克笔画出，交底后拆除前拍照保留\n3. 地暖层高：安装地暖但是层高不够，要拆到水泥砂浆层才合理\n4. 原家具电器回收：比较好的原家具电器可以先拆下来发挂咸鱼或直接找家电回收上门拉走，避免被工人拉走卖钱',
    contract: '注意：务必签订合同，全屋拆除合同范本请点击这里!'
  },
  {
    step: 2,
    title: '新建墙体（泥工）验收',
    icon: '🧱',
    items: [
      { id: 1, desc: '阴阳角是否顺直' },
      { id: 2, desc: '毛墙垂直度≤5mm' },
      { id: 3, desc: '毛墙平整度≤5mm' },
      { id: 4, desc: '面层与基层连接无空鼓/裂纹/脱皮/表面无孔洞' },
      { id: 5, desc: '门洞高度是否一致，是否按照设计要求预留' },
      { id: 6, desc: '水平夹缝≤10mm，灰缝均匀饱满，上下错缝，转角搭接' }
    ],
    notes: '1. 新老墙体交接处最容易开裂，不能直接批灰，要把老墙墙体剥离一部分，用水泥盖住接缝，再一起批灰\n2. 砌墙完成后进行批灰封水泥，需要用湿水养护（水泥干太快会裂开）',
    contract: '注意：务必签订合同，泥工合同范本请点击这里!'
  },
  {
    step: 3,
    title: '水电验收',
    icon: '🔌',
    items: [
      { id: 1, desc: '定位检查：对照水电定位图纸依次检查水电位是否遗漏' },
      { id: 2, desc: '电线平方数：核对家用电线平方数\n（电线皮上有写）' },
      { id: 3, desc: '强弱电交叉处是否用锡箔纸/金属管包裹，防止信号干扰' },
      { id: 4, desc: '墙面开槽：大部分竖槽，横槽是否过长\n*混泥土墙面横槽不超过30cm\n*非混泥土墙面横槽不超过50cm' },
      { id: 5, desc: '网线：所有AP面板位置是否预留一根六类网线' },
      { id: 6, desc: '智能开关：是否预留火线+零线，大部分智能开关和智能升降晾衣架、智能嵌入式音箱等都需要预留零线' },
      { id: 7, desc: '水管：左冷右热水管间距15cm，开槽刷防水' },
      { id: 8, desc: '扫地机器人：定位位置预留机器人电位，上下水，最好做墙排，方便打扫卫生' },
      { id: 9, desc: '热水管：走顶包裹保温棉，吊卡固定，拐角处增加吊卡' },
      { id: 10, desc: '打压测试：水路打压10KG/30分钟，掉压≤0.5KG合格', errorRef: '', correctRef: '找专业人士' }
    ],
    notes: '1. 材料采买货比三家，注意线管要20的，一根线管不超过3根线，线管转弯走大圆弧或者双45°角，不要直接急转弯，底盒必须用锁扣扣紧，否则电线易老化\n2. 下水口要做存水弯，做顺水三通，主要下水口与存水弯是否在同一水路，否则容易反臭\n3. 打压服务只要是买品牌的水管都会送的，提前和商家约好上门\n4. 前期回路设计，一根空调一根回路，厨房卫生间各一个回路，冰箱、摄像头、路由器一个回路一个独立空气开关，照明一个回路，普通插座一个回路，强电箱必须装漏电保护器\n5. 看不懂没关系，签在合同里然后和工长/水电工重复一遍就行，最好贴在墙上',
    contract: '注意：务必签订合同，水电施工合同范本请点击这里!'
  },
  {
    step: 4,
    title: '瓦工验收',
    icon: '🏗️',
    items: [
      { id: 1, desc: '瓷砖表面：纹路一致，无划痕，无色差，不缺角，对花拼接正确无错位' },
      { id: 2, desc: '瓷砖阴阳角：拼接方正，误差不超过2mm，最多不要超过3mm，否则柜子装不平' },
      { id: 3, desc: '瓷砖空鼓：单块地面瓷砖与墙面瓷砖空鼓率不超过5%' },
      { id: 4, desc: '瓷砖缝隙：缝隙宽1mm，不超过2mm' },
      { id: 5, desc: '瓷砖烟道口：必须用整块切割，不能两块拼接，不然后期烟气会露' },
      { id: 6, desc: '瓷砖水电标识贴：贴好水电标识，避免家具安装打穿水电路' },
      { id: 7, desc: '卫生间瓷砖泄水：从墙角边缘到地漏，与地漏结合牢固，每1m距离下降1cm高，用水宝宝或者乒乓球测试（不要用弹珠，测试的时候不要用力丢）' },
      { id: 8, desc: '瓷砖拆除反工：拆除瓷砖的位置需要补涂防水层' },
      { id: 9, desc: '木地板：平整，接头位置错开，踩过无声响，逆光无划痕' },
      { id: 10, desc: '木地板颜色：颜色，木纹协调一致，色泽一致，无侧擦，擦软蜡均匀不露底，不能有胶痕\n（有些品类的木地板会有自然色差，这时需要排好色差再安装，让色差变得自然）' },
      { id: 11, desc: '木地板拼缝：伸缩缝1mm，版面平直误差＜2mm' },
      { id: 12, desc: '墙地面找平：平整度≤3mm', errorRef: '', correctRef: '找专业人士' },
      { id: 13, desc: '窗台石：窗台石出墙不超过2cm，边缘打磨光滑' },
      { id: 14, desc: '防水：淋浴墙1.8米以上，非淋浴30cm，墙面2层，地面3层' },
      { id: 15, desc: '蓄水测试：找专业评估做一次卫生间蓄水测试' }
    ],
    notes: '1. 贴瓷砖前需要把砖用水泡1-2h，晾干后铺装\n2. 铺贴时需要准备好地漏，注意一定要提前购买好地漏给师傅安装\n3. 刷各种材料之前，必须洒水湿润墙体，防止墙体吸收材料出现问题（如果墙面防水层上很多气泡，就说明出问题）\n4. 厨卫地面要用水泥或堵漏王找平，要细腻平整，不能坑坑洼洼\n5. 厨房卫生间等湿气重的地方，相邻墙面也要外刷10cm防水\n6. 排砖的时候，能看见的地方用整砖，走廊过道必须整块通铺，橱柜下方看不到的地方用碎砖省钱',
    contract: '注意：务必签订合同，瓦工贴砖合同范本请点击这里!'
  },
  {
    step: 5,
    title: '木工（吊顶）验收',
    icon: '🪵',
    items: [
      { id: 1, desc: '吊顶核对：结合施工图或交底弹线标注，核对吊顶样式/下吊高度/筒灯+射灯+吸顶AP+电动晾衣杆数量位置/吊顶深度等所有尺寸' },
      { id: 2, desc: '吊顶钉帽防锈防火：检查石膏板吊顶钉帽有没有刷防锈，龙骨有没有刷防火层' },
      { id: 3, desc: '吊顶表面：表面平整，接缝处顺畅严密，无歪斜\n*重点检查转角处是否为整版，是否开裂' },
      { id: 4, desc: '吊顶缝隙：石膏板衔接处预留3-5mm伸缩缝' },
      { id: 5, desc: '窗帘盒：欧松板打底，单层15cm/双层20cm/电动25cm' },
      { id: 6, desc: '吊顶预埋：检查磁吸/线性轨道灯等是否预埋固定件，电动晾衣杆很多也需要预埋，请注意' },
      { id: 7, desc: '吊顶检修口：检修口是否平整，最好采用预制检修口，检修口是否够大，灯线检修口25*25，新风检修口75*75' }
    ],
    notes: '1. 打柜子：2025年了，就不要在想着让师傅手工打柜子了，既不标准也不省钱也不环保，除了你可以观摩打制过程外其它没有什么优点，好的木工师傅很多现在也在木作工厂里了，因此此部分木工基本就是吊顶的活\n2. 空调出风口必须让空调厂商与木工师傅交底后文字标注墙上，验收约空调厂家共同验收\n3. 窗帘盒必须加固，加底板保证稳定，超薄吊顶房间需要预埋隐形窗帘轨道，要提前沟通\n4. 材料按照师傅开单尺寸，自选大品牌材料，主要要采购防锈钉，胶也注意自采',
    contract: '注意：务必签订合同，木工贴砖合同范本请点击这里!'
  },
  {
    step: 6,
    title: '油工验收',
    icon: '🎨',
    items: [
      { id: 1, desc: '颜色核对：在白天有阳光的情况下，参照留样色卡，校对颜色、光泽。光泽基本均匀，表面光滑不刮手\n*选购油漆的时候要和商家要色卡留样，这时候就用上了' },
      { id: 2, desc: '表面刷纹：乳胶漆要确保表面无刷纹，艺术漆要确保实际效果与大色卡效果一致' },
      { id: 3, desc: '相接处：与其它材料的相接处吻合，界面清晰' },
      { id: 4, desc: '喷涂：表面均匀，无起皮、气泡、皱皮、流坠\n*特别注意边角处是否有颗粒、开裂等' },
      { id: 5, desc: '踢脚线：最低点是否符合踢脚线安装高度，2/4/5/6cm' },
      { id: 6, desc: '溅射：喷涂是否溅射到其它家具上，前期保护没有做好的话，很容易导致油工喷溅到其它家具上' },
      { id: 7, desc: '纹理艺术漆：纹路是否舒畅连续，不会杂乱，艺术漆纹理一旦杂乱就纯纯完犊子\n*艺术漆最好由商家提供服务，要留带纹理大色卡作为验收标准' }
    ],
    notes: '1. 在施工前要检查全屋墙面，确保墙面全部铲到基层，没有钉子，柔性防水层等\n2. 施工顺序：①清浮灰→②刷墙固→③石膏板&石膏填缝→④PVC阴阳角保护条→⑤接缝处挂网→⑥第一遍腻子→⑦第二遍腻子→⑧打磨墙面平整→⑨刷底漆/喷底漆→⑩石膏收口→⑪第一遍面漆→⑫第二遍面漆→⑬家具进场后入住前修补\n3. 顺平/垂平/冲筋找平工艺：全屋除家具/踢脚线位置做垂平工艺外，其它做顺平工艺即可，冲筋找平工艺费用高还会占墙低高度，不太适合普通家装\n*如果有大面积洗墙灯的灯光设计，最好也做冲筋找平，确保墙面灯光可以出氛围\n*规方：比冲筋找平要求更高的工艺，做到全屋方正，天地阴阳角为90°，横竖误差不超过2cm，只有在全屋通铺/全屋极窄踢脚线/木作无收边条/大面积瓷砖上墙薄贴等高难度工艺要求的情况下才做',
    contract: '注意：务必签订合同，油工合同范本请点击这里!'
  },
  {
    step: 7,
    title: '木作（含橱柜）验收',
    icon: '🗄️',
    items: [
      { id: 1, desc: '颜色检查：在白天有阳光的情况下，参照留样色卡，校对到货木作颜色与样品颜色是否一致\n*此步骤在木作到场后，木作安装前' },
      { id: 2, desc: '设计检查：检查柜子外观&功能与效果图是否一致' },
      { id: 3, desc: '表面检查：撕掉保护膜，撕掉标签后检查表面是否有磕碰、划痕、气泡。如有要让商家及时更换' },
      { id: 4, desc: '门扇检查：看所有柜门、抽屉门是否齐平，对开柜门是否在同一水平线，开关是否对碰，是否晃动，是否有异响，铰链是否装歪，所有柜门是否全平无突起' },
      { id: 5, desc: '检查封边：看所有板材的侧边有没有封边，是否溢胶突起' },
      { id: 6, desc: '五金检查：核对五金品牌，全屋五金循环使用3-5次以上' },
      { id: 7, desc: '按压检查：按压所有柜体看是否有晃动' },
      { id: 8, desc: '打胶检查：检查柜子和墙体/顶面/地面是否都有打胶' },
      { id: 9, desc: '灯带检查：检查所有灯带安装是否隐藏且美观，极易翻车' }
    ],
    notes: '1. 大部分品牌的全屋定制都是厂家发货，但是很有可能商家会下错货和尺寸等等，因此所有的尺寸和颜色都需要签署到合同内\n2. EVA封边是能用的，不要被商家的各种造词给忽悠了，EVA封边、PUR封边、激光封边三者的差别主要是外观的不同，激光封边可以做到看不出来封边，PUR封边过渡比较光滑，EVA封边较明显，如何选择看个人和预算\n3. 板材的选择：板材的环保等级不会印在表面，我们只能拿到厂家"自己送检"的检测报告，因此贵的便宜的都能说自己是什么F五星、ENF级别等等，所以对环保有要求，选择板材一定要选择带板材品牌logo和防伪的板材\n*能用激光封边和好的封边条，理论上来说板材也不会差',
    contract: '注意：务必签订合同，合同以商家合同+验收要求+材料五金清单+设计图为准'
  }
];

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    steps: [],
    // 当前选中的STEP索引，-1表示未选中（显示选择页）
    currentStep: -1,
    currentData: null,
    // 验收勾选状态
    checkStates: {}
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

    // 构造步骤列表
    var steps = inspectData.map(function(item) {
      return {
        step: item.step,
        title: item.title,
        icon: item.icon,
        count: item.items.length
      };
    });

    // 读取已保存的验收勾选状态
    var checkStates = wx.getStorageSync('inspect_checks') || {};

    this.setData({
      steps: steps,
      checkStates: checkStates
    });
  },

  // 返回步骤选择页
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

  // 选择某个STEP
  selectStep: function(e) {
    var index = e.currentTarget.dataset.index;
    var data = inspectData[index];
    this.setData({
      currentStep: index,
      currentData: data
    });
  },

  // 切换验收项勾选状态
  toggleCheck: function(e) {
    var step = e.currentTarget.dataset.step;
    var itemId = e.currentTarget.dataset.id;
    var key = 'step' + step + '_' + itemId;
    var dataPath = 'checkStates.' + key;
    var newVal = !this.data.checkStates[key];

    // 路径更新，只传输变化的字段而非整个 checkStates
    this.setData({ [dataPath]: newVal });

    // 防抖保存到本地（500ms 内多次点击只写一次 Storage）
    var self = this;
    if (self._saveTimer) clearTimeout(self._saveTimer);
    self._saveTimer = setTimeout(function() {
      wx.setStorageSync('inspect_checks', self.data.checkStates);
    }, 500);
  },

  // 计算某个STEP已完成数
  getStepProgress: function(stepNum) {
    var checkStates = this.data.checkStates;
    var stepData = inspectData[stepNum - 1];
    if (!stepData) return 0;
    var count = 0;
    stepData.items.forEach(function(item) {
      if (checkStates['step' + stepNum + '_' + item.id]) {
        count++;
      }
    });
    return count;
  },

  // 重置当前STEP的验收状态
  resetCurrentStep: function() {
    var self = this;
    var data = this.data.currentData;
    if (!data) return;

    wx.showModal({
      title: '重置确认',
      content: '确定要重置「' + data.title + '」的所有验收项吗？',
      confirmColor: '#FC9700',
      success: function(res) {
        if (res.confirm) {
          var checkStates = self.data.checkStates;
          data.items.forEach(function(item) {
            var key = 'step' + data.step + '_' + item.id;
            delete checkStates[key];
          });
          self.setData({ checkStates: checkStates });
          wx.setStorageSync('inspect_checks', checkStates);
          wx.showToast({ title: '已重置', icon: 'success' });
        }
      }
    });
  },

  /** 转发到聊天 */
  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('inspect', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('inspect', this);
  }
});
