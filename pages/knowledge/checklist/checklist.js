var app = getApp();

// 新家物品清单完整数据 —— 来自《物品验收清单.xlsx》
var checklistData = [
  {
    id: 1,
    category: '玄关',
    icon: '🚪',
    items: [
      { id: 1, name: '入户地垫', keywords: '丝圈地垫 弹力网 镂空 加厚', description: '优选加厚加粗弹力网，镂空设计利于漏沙除尘、易水洗。底部选橡胶 / PVC 全覆防滑底，防滑不移位。门外选防晒防水款，室内选薄款防卡门，避开薄软易塌、异味重的低价款。' },
      { id: 2, name: '拖鞋', keywords: '拖鞋 EVA 防滑 Ag银离子抑菌', description: '主力选高密度 EVA 一体成型，轻便回弹、不易开裂；坚决避开廉价 PVC，易发黄、有异味、材质偏硬。抗菌选择：认准基材添加银离子（耐用），拒绝表面喷涂款；附带国标抗菌检测报告，标注抑菌率达标。' },
      { id: 3, name: '一次性拖鞋', keywords: '一次性拖鞋 加厚防滑 独立包装 软膜袋 无纺布', description: '选独立密封包装、加厚防滑底，EVA / 无纺布材质卫生舒适；薄款易破、无异味优先，散装不卫生。' },
      { id: 4, name: '玄关托盘', keywords: '玄关托盘 皮质/不锈钢 防水 钥匙盘', description: '优选不锈钢/皮质，带防滑底、边缘挡边。' },
      { id: 5, name: '雨伞', keywords: '雨伞 UPF50+ 8骨抗风 黑胶涂层 晴雨两用 折叠便携', description: 'UPF50 + 黑胶能阻隔紫外线，8 根加粗伞骨结构更稳，大风不易外翻；伞骨越少抗风越差，薄涂层很快失效。' },
      { id: 6, name: '快递剪刀', keywords: '快递刀 特氟龙涂氟 防粘防锈 圆头安全', description: '特氟龙涂层不粘胶带胶渍，圆头防止误割物品，磁吸方便归位；普通钢刀易粘胶生锈，尖头存在安全隐患。' },
      { id: 7, name: '玄关感应灯', keywords: '感应灯 双感应 充电 暖光 长续航', description: '双感应避免白天常亮耗电，充电款不用改电路，暖光柔和不刺眼；单感应容易误触发，劣质电池续航很短。有多余插座的可以选择插电款，插电款优于充电款。' },
      { id: 8, name: '遮阳伞', keywords: '遮阳伞 UPF50+ 8骨抗风 黑胶涂层 晴雨两用 折叠便携', description: 'UPF50 + 黑胶能阻隔紫外线，8 根加粗伞骨结构更稳，大风不易外翻；伞骨越少抗风越差，薄涂层很快失效。' },
      { id: 9, name: '防晒喷雾', keywords: '防晒喷雾 SPF50+ PA++++ 防水防汗 无酒精 物化结合', description: '高倍指数适配户外，防水配方不易因出汗失效，无酒精减少刺激；玄关放喷雾优于乳液。' },
      { id: 10, name: '手帕纸', keywords: '手帕纸 原生木浆 4层加厚 无香 可湿水', description: '买四层加厚大品牌即可。' },
      { id: 11, name: '湿纸巾', keywords: '湿纸巾 盒装 水刺无纺布 RO纯水 无香精酒精 带密封盖', description: '回家擦手擦脸必备，选水刺布厚实不掉絮，RO 纯水温和亲肤，密封盖防止水分蒸发。' }
    ]
  },
  {
    id: 2,
    category: '客厅',
    icon: '🛋️',
    items: [
      { id: 1, name: '遥控器收纳筒', keywords: '遥控器收纳筒 桌面', description: '别买那种圆点贴墙上的，不会站起来去墙上拿遥控器，也不会按完再吸回去。' },
      { id: 2, name: '香氛', keywords: '无火香氛 芬美意/奇华顿 天然植物精油', description: '只选进口品牌香精 / 精油（如德国 Oshadhi、法国芬美意 / 奇华顿、美国 PF），原料纯度高、调香专业、气味高级不刺鼻、留香稳定。' },
      { id: 3, name: '沙发', keywords: '', description: '' },
      { id: 4, name: '茶几', keywords: '', description: '' },
      { id: 5, name: '边几', keywords: '', description: '' },
      { id: 6, name: '地毯', keywords: '', description: '' },
      { id: 7, name: '电视', keywords: '', description: '' },
      { id: 8, name: '电视柜', keywords: '', description: '' }
    ]
  },
  {
    id: 3,
    category: '厨房',
    icon: '🍳',
    items: [
      { id: 1, name: '厨房专用垃圾桶', keywords: '垃圾桶 圆形敞口无盖 15-20L 加厚 PP 锁扣', description: '无盖通风避免厨余闷味发酵，圆形更适配角落摆放，锁扣固定垃圾袋不易滑落；带盖款异味重，方形边角易藏污。' },
      { id: 2, name: '骨碟', keywords: '骨碟 加厚PP 防摔 带底座 耐高温 可机洗', description: '食品级PP材质是核心，认准"5号"和"食品接触用"标识，无毒耐温（-20℃~120℃），可进洗碗机和微波炉。' },
      { id: 3, name: '隔热垫', keywords: '隔热垫 硅胶 整张防水 防烫防滑', description: '防水防油一擦即净，保护餐桌漆面与木质桌面；布艺款渗油难清洗，纸质款不耐用，软木易发霉。' },
      { id: 4, name: '沥水碗架', keywords: '沥水碗架 铝合金 一体式抽拉沥水盘 带筷勺笼 带刀架', description: '铝合金天生防锈（比不锈钢更耐腐蚀）、轻量强韧（承重稳）、易清洁；抽拉式沥水盘（直接导水入水槽，不积水），带独立筷笼 / 刀槽，底部防滑静音脚垫，开放式通风不闷霉。' },
      { id: 5, name: '杯垫', keywords: '杯垫 加厚硅胶 一体成型 防水防油 耐高温 易清洗 防滑', description: '硅胶耐高低温、不吸水、油污一擦即净，适配热杯、饮品杯；底部防滑不移位。' },
      { id: 6, name: '蔬果架', keywords: '蔬果架 双层 台面 沥水 开放式', description: '厨房蔬果架双层镂空，铝合金管+PP篮，防锈轻便、通风不闷烂；必须带沥水盘（接住清洗后滴水，不脏台面）；上层放干货/根茎菜，下层放水果/易出水蔬菜；开放式设计比封闭筐透气，减少发芽发霉。' },
      { id: 7, name: '隔热手套', keywords: '隔热手套 加厚硅胶 耐高温 防滑纹理 食品级 可机洗', description: '硅胶材质耐高温、不吸油不藏污，清洗方便；表面防滑拿取稳固。棉布款易渗热、吸油污难清洁，薄款防护不足。' },
      { id: 8, name: '一次性铝箔碗', keywords: '铝箔碗 GB 4806.9认证 加厚 耐高温230℃ 加固卷边', description: '买加厚、带国标、尺寸匹配的专用铝箔碗；酸性食物（番茄/柠檬/醋）尽量不用锡纸，改用硅油纸碗。' },
      { id: 9, name: '杯刷', keywords: '杯刷 长柄 去污不留痕 一体成型 L型 软刷头 尼龙毛', description: 'L 型就是为破壁机、保温杯、油壶、茶壶这类深口/窄口容器设计的，能直抵杯底死角，手不沾污、不刮涂层。' },
      { id: 10, name: '洗洁精', keywords: '洗洁精 A类 食品级 可洗果蔬 去油快 易漂洗 温和', description: '认准GB 14930.1-2022 A 类国标，优先可洗果蔬配方；重油污选强力型，敏感肌/母婴选温和无添加款。' },
      { id: 11, name: '洗洁精按压盒', keywords: '洗洁精按压盒 食品级 PP 定量按压 沥水收纳', description: '单手操作、定量防浪费、沥水收纳、防漏易清洁、材质安全、百洁布和洗洁精的完美匹配。' },
      { id: 12, name: '周抛抹布', keywords: '周抛抹布 抽取式 食品可接触级 抗菌', description: '盒装抽取取用便捷，食品级材质可直接擦拭餐具食材，抗菌设计一周使用不易滋生细菌、产生异味。' },
      { id: 13, name: '百洁布', keywords: '百洁布 双面海绵 无砂 抗菌 食品级 不掉渣', description: '硬面去焦渍、软面起泡快；食品级抗菌款，不粘锅/玻璃/铁锅分用，干净不伤锅。' },
      { id: 14, name: '银丝抹布', keywords: '银丝抹布 银丝编织 不伤涂层 抽取式', description: '替代钢丝球，银丝面去重油污、棉纱面吸水抛光；比钢丝球温和、不掉丝，不粘锅/玻璃/铁锅通用，不易发霉发臭。' },
      { id: 15, name: '厨房纸', keywords: '厨房纸 挂墙 食品级 4-5层加厚 强吸油 可水洗', description: '挂墙不占地、底部抽纸超顺手；食品级加厚原生木浆，干湿两用、不掉屑，擦灶台/吸食材油/擦餐具都安心。（最好要配双牛角挂钩）' },
      { id: 16, name: '油壶', keywords: '油壶 玻璃 喷倒一体 食品级 不挂油 密封防漏', description: '按喷/斜倒一键切换；高硼硅玻璃安全耐高温，雾化细腻 + 倒油顺畅不挂油，减脂控量、炒菜炝锅都好用。' },
      { id: 17, name: '盐瓶', keywords: '盐瓶 玻璃 定量0.5g 密封防潮 按压 可撒可倒', description: '按 0.5 克，控盐不手抖；玻璃可视、密封不结块，炒菜/凉拌/烘焙精准控量，健康减盐。' },
      { id: 18, name: '一次性手套', keywords: '一次性手套 食品级 TPE 加厚', description: 'TPE 材质贴合手型、韧性强不易破，食品接触安全，处理食材、清洁都适用。' },
      { id: 19, name: '食品密封袋', keywords: '食品密封袋 食品级 PE 拉链式 加厚 防漏耐低温', description: '拉链开合顺滑，密封严实不串味，冷藏冷冻、食材分装都好用。' },
      { id: 20, name: '旋转挂钩', keywords: '厨房挂钩 六爪旋转 免打孔 承重强', description: '六爪分区收纳，旋转取放顺手，防锈耐用，锅铲汤勺分类摆放更整洁。' },
      { id: 21, name: '独立挂钩', keywords: '厨房挂钩 3M无痕胶 免打孔', description: '免打孔不伤墙、防水耐油污、可移除无残胶、胶条替换复用、安装简单。' },
      { id: 22, name: '保鲜膜套罩', keywords: '保鲜膜套罩 PE 弹性通用 加厚 抽取式', description: '弹力适配各类碗盘，套取快捷，防尘保鲜，替代传统保鲜膜更省事。' },
      { id: 23, name: '瓜刨', keywords: '瓜刨 陶瓷刀头 食品级 防生锈 防滑柄', description: '陶瓷刃锋利持久、永不生锈，削皮顺滑，食材不留金属味。' },
      { id: 24, name: '牛排夹', keywords: '牛排夹 316不锈钢 加长柄 防滑齿', description: '夹取稳固不打滑，耐高温适配煎烤，翻转食材、夹取食材实用又顺手。' },
      { id: 25, name: '米桶', keywords: '米桶 12KG 定量出米 防潮防虫 密封', description: '12KG 适配家用囤米，定量款可精准控米量，密封结构能防潮防蛀，选带独立储米仓 + 分格款更实用。' },
      { id: 26, name: '砧板', keywords: '砧板套装 分色分类 抗菌防滑 易清洗', description: '套装多按生熟/果蔬分色分区，抗菌材质更卫生，适配日常切配使用。' },
      { id: 27, name: '刀具', keywords: '', description: '' },
      { id: 28, name: '锅具', keywords: '', description: '' },
      { id: 29, name: '餐具', keywords: '', description: '' },
      { id: 30, name: '冰箱', keywords: '', description: '' },
      { id: 31, name: '微波炉', keywords: '', description: '' },
      { id: 32, name: '空气炸锅', keywords: '', description: '' },
      { id: 33, name: '电饭煲', keywords: '', description: '' },
      { id: 34, name: '电烤箱', keywords: '', description: '' },
      { id: 35, name: '电蒸锅', keywords: '', description: '' }
    ]
  },
  {
    id: 4,
    category: '卫生间',
    icon: '🛁',
    items: [
      { id: 1, name: '湿厕纸', keywords: '湿厕纸 EDI纯水 可冲散 pH弱酸性 可丢马桶', description: '采用纯水制作无刺激，基材可直接冲入马桶不易堵塞，厚实柔韧不掉屑，如厕清洁更舒适。' },
      { id: 2, name: '干厕纸', keywords: '抽取式干厕纸 可溶解 原生木浆 易降解 不堵管道', description: '遇水快速分解，材质环保易降解，投入马桶不会造成堵塞，使用更安心。' },
      { id: 3, name: '厕纸盒', keywords: '卫生间厕纸盒 抽取式 免打孔 双层', description: '免钉安装不伤墙面，双层可分放两种纸巾，出纸顺滑，防水设计适配潮湿卫浴环境。' },
      { id: 4, name: '吹风筒支架', keywords: '吹风筒支架 免打孔 一体支架 通用 含杯架 含杯', description: '免钉安装适配墙面，兼具置物杯架，承托稳固，厨卫潮湿环境也不易生锈。' },
      { id: 5, name: '洗手液', keywords: '洗手液 泡沫出液 弱酸性 母婴可用', description: 'pH 值贴合肌肤，按压出细腻泡沫，成分温和安全，大人孩子都能放心使用。' },
      { id: 6, name: '擦手布', keywords: '擦手布 抗菌 加厚绒面', description: '绒面厚实触感柔软，自带抗菌效果，吸水能力出众，反复清洗也不易掉毛变形。' },
      { id: 7, name: '马桶刷', keywords: '一次性马桶刷 刷头可抛 自带清洁剂', description: '刷头内含清洁成分，用完直接丢弃，长柄设计避免沾手，轻松清洁马桶污渍。' },
      { id: 8, name: '垃圾袋', keywords: '厕所一次性抽拉式垃圾袋 加厚 拉绳 悬挂', description: '自带拉绳可快速收口提拿，袋身厚实不易破损渗漏，用完即弃，收纳垃圾便捷卫生。' },
      { id: 9, name: '浴室地垫', keywords: '浴室地垫 硅藻土/软硅藻泥 防滑 可裁剪', description: '吸水速度快，表面防滑防摔，支持自由裁剪适配尺寸，材质干爽不易滋生潮气，脏了就丢。' },
      { id: 10, name: '台盆刷', keywords: '洗碗刷 长柄 悬挂', description: '洗碗刷的刷毛适配台盆缝隙与曲面，防水不易损坏。' },
      { id: 11, name: '吹风筒', keywords: '', description: '' },
      { id: 12, name: '牙刷', keywords: '', description: '' },
      { id: 13, name: '牙膏', keywords: '', description: '' },
      { id: 14, name: '洗面奶', keywords: '', description: '' },
      { id: 15, name: '沐浴露', keywords: '', description: '' },
      { id: 16, name: '洗发露', keywords: '', description: '' },
      { id: 17, name: '毛巾', keywords: '', description: '' },
      { id: 18, name: '浴巾', keywords: '', description: '' }
    ]
  },
  {
    id: 5,
    category: '餐厅',
    icon: '🍽️',
    items: [
      { id: 1, name: '餐桌', keywords: '', description: '' },
      { id: 2, name: '餐椅', keywords: '', description: '' },
      { id: 3, name: '咖啡机', keywords: '', description: '' },
      { id: 4, name: '水吧机', keywords: '', description: '' }
    ]
  },
  {
    id: 6,
    category: '阳台',
    icon: '🌿',
    items: [
      { id: 1, name: '洗衣机', keywords: '', description: '' },
      { id: 2, name: '烘干机', keywords: '', description: '' },
      { id: 3, name: '脏衣篓', keywords: '脏衣篓 加厚牛津布 防水 分区', description: '加厚牛津布 / 原生 PP：耐磨抗老化，耐水汽、不易发霉，适配卫浴潮湿环境。' },
      { id: 4, name: '洗衣液', keywords: '洗衣液 APG植物基表活 复合生物酶 0荧光/0磷', description: 'QB/T 5827-2023 婴标、APG 植物基表活、复合生物酶、0 荧光/0 磷/0MIT、pH6.0-7.5 中性、低泡易漂、SGS/CMA 认证。' },
      { id: 5, name: '柔顺剂', keywords: '柔顺剂 弱酸性配方 植物柔顺因子 生物降解 抗静电', description: '选用弱酸性植物配方，无香精色素与有害防腐剂，亲肤低敏。兼具柔顺、抗静电效果，成分易降解，适配母婴衣物使用。' },
      { id: 6, name: '消毒液', keywords: '消毒液 季铵盐类 无醇无氯 低残留', description: '优选双链季铵盐配方，不含氯、酒精，无刺鼻气味，温和不伤织物与肌肤，低残留抑菌持久，适合母婴家庭全屋及衣物消杀。' },
      { id: 7, name: '晾衣杆', keywords: '晾衣杆 铝合金 防滑防风', description: '铝合金质轻高强度，阳极氧化层防锈抗刮，防潮适配阳台环境。一体结构稳固不变形，防滑静音，长期使用不易生锈老化。' }
    ]
  },
  {
    id: 7,
    category: '通用',
    icon: '🔧',
    items: [
      { id: 1, name: '工具箱套装', keywords: '家用工具套装 含电动螺丝刀 电动 全套', description: '' },
      { id: 2, name: '手电筒', keywords: '手电筒 充电式 锂电续航 防水等级IPX4', description: '' },
      { id: 3, name: '卷尺', keywords: '卷尺 高碳钢尺带 自锁卡扣 耐磨尺壳', description: '' },
      { id: 4, name: '剪刀美工刀', keywords: '涂氟剪刀 美工刀二合一', description: '' },
      { id: 5, name: '垃圾袋', keywords: '垃圾袋 加厚8丝 拉绳式', description: '' },
      { id: 6, name: '马克笔', keywords: '马克笔 防水油墨 速干', description: '' },
      { id: 7, name: '排插', keywords: '排插 新国标 阻燃壳体 过载保护', description: '' },
      { id: 8, name: '棉签', keywords: '棉签 纸质杆 双头设计', description: '' },
      { id: 9, name: '纸巾', keywords: '纸巾 原生木浆 四层加厚 湿水不破', description: '' },
      { id: 10, name: '电池', keywords: '电池 5号7号套装 无汞环保', description: '' },
      { id: 11, name: '一次性杯', keywords: '一次性杯 加厚杯壁 耐热', description: '' },
      { id: 12, name: '粘毛器', keywords: '可水洗粘毛器 硅胶粘性', description: '' },
      { id: 13, name: '分类桶', keywords: '', description: '' }
    ]
  },
  {
    id: 8,
    category: '清洁用品',
    icon: '🧹',
    items: [
      { id: 1, name: '扫把套装', keywords: '扫把套装 PET软毛 折叠收纳 防粘毛 折叠', description: '可折叠扫把套装主打小户型省空间，核心看刷毛防缠、簸箕贴地、折叠卡扣，日常家用选铝合金杆 + PET 软毛 + 带梳齿簸箕最实用。' },
      { id: 2, name: '拖把套装', keywords: '平板拖把套装 免手洗 快速脱水 可拆', description: '平板免手洗：拖地贴合地面，水渍少，适合瓷砖、木地板，刮水式清洗，居家百搭。' },
      { id: 3, name: '除胶剂', keywords: '柑橘配方 温和不伤面 喷雾型 全屋通用', description: '新房开荒选柑橘油基环保型最安全，重点清保护膜、标签、双面胶、装修残胶。' },
      { id: 4, name: '玻璃刷', keywords: '玻璃刷 可调磁 防坠绳 双面擦', description: '磁吸玻璃刷（擦窗器）靠强磁双面同步擦，高层/落地窗必备，选可调磁 + 防坠绳最安全。' },
      { id: 5, name: '刮水器', keywords: '刮水器 手持 橡胶', description: '分手持、长杆两款，适配玻璃、地面、淋浴房，无水痕、刮水高效。' },
      { id: 6, name: '大抹布', keywords: '大抹布 大尺寸 吸水强', description: '新房开荒/日常拖地、擦墙面、裹长杆使用，大抹布优先选加厚款，按区域分色更卫生。' },
      { id: 7, name: '瓷砖清洁剂', keywords: '瓷砖清洁剂 中性 不伤釉面 泡沫', description: '泡沫瓷砖清洁剂靠厚泡沫挂壁久、渗透强，优先选中性、无腐蚀、多场景通用款。' },
      { id: 8, name: '地板清洁剂', keywords: '地板清洁剂 中性 速干 APG 母婴', description: '选地板清洁剂核心是中性配方不伤材、速干不留痕、抑菌安全，适配瓷砖/木地板/大理石，开荒 + 日常都能用。' },
      { id: 9, name: '活性炭包', keywords: '活性炭包 高碘值 颗粒炭 矿晶', description: '优先碘值≥800mg/g，吸附能力强，低价低碘值基本无效。颗粒炭＞粉末炭，透气不结块；选独立小分包，摆放更灵活。' },
      { id: 10, name: '水桶', keywords: '清洁水桶 45cm PP 加厚 防滑', description: '优选全新 PP 塑料，壁厚≥2mm，按压不变形、耐摔耐酸碱。' }
    ]
  }
];

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    categories: [],
    currentCategory: -1,
    currentCategoryData: null,
    itemStates: {},
    searchQuery: '',
    searchResults: null,
    filteredItems: null,
    overallStats: { total: 0, owned: 0, unowned: 0, purchased: 0, received: 0, completionRate: 0 },
    categoryStats: [],
    expandedItems: {}
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

    var itemStates = wx.getStorageSync('checklist_states') || {};

    var categories = checklistData.map(function(cat) {
      return { id: cat.id, category: cat.category, icon: cat.icon, count: cat.items.length };
    });

    var categoryStats = this._computeAllCategoryStats(itemStates);
    var overallStats = this._computeOverallStats(categoryStats);

    this.setData({
      categories: categories,
      itemStates: itemStates,
      categoryStats: categoryStats,
      overallStats: overallStats
    });
  },

  goBack: function() {
    if (this.data.currentCategory >= 0) {
      this.setData({
        currentCategory: -1,
        currentCategoryData: null,
        searchQuery: '',
        searchResults: null,
        filteredItems: null
      });
    } else {
      wx.navigateBack();
    }
  },

  selectCategory: function(e) {
    var index = e.currentTarget.dataset.index;
    var data = checklistData[index];
    this.setData({
      currentCategory: index,
      currentCategoryData: data,
      searchQuery: '',
      filteredItems: null
    });
  },

  toggleStatus: function(e) {
    var catIndex = e.currentTarget.dataset.catIndex;
    var itemId = e.currentTarget.dataset.itemId;
    var key = 'c' + catIndex + '_' + itemId;
    var currentStatus = this.data.itemStates[key] || 'unowned';
    var cycle = ['unowned', 'purchased', 'received', 'owned'];
    var currentIdx = cycle.indexOf(currentStatus);
    var nextStatus = cycle[(currentIdx + 1) % cycle.length];

    var dataPath = 'itemStates.' + key;
    this.setData({ [dataPath]: nextStatus });

    this._recomputeStats(catIndex);

    var self = this;
    if (self._saveTimer) clearTimeout(self._saveTimer);
    self._saveTimer = setTimeout(function() {
      var sparse = {};
      Object.keys(self.data.itemStates).forEach(function(k) {
        if (self.data.itemStates[k] !== 'unowned') {
          sparse[k] = self.data.itemStates[k];
        }
      });
      wx.setStorageSync('checklist_states', sparse);
    }, 500);
  },

  showStatusSheet: function(e) {
    var self = this;
    var catIndex = e.currentTarget.dataset.catIndex;
    var itemId = e.currentTarget.dataset.itemId;
    var key = 'c' + catIndex + '_' + itemId;
    var currentStatus = this.data.itemStates[key] || 'unowned';

    var labels = ['未拥有', '已购买', '已签收', '已拥有'];
    var statuses = ['unowned', 'purchased', 'received', 'owned'];
    var currentLabel = labels[statuses.indexOf(currentStatus)];

    wx.showActionSheet({
      itemList: labels.map(function(l, i) {
        return l + (statuses[i] === currentStatus ? ' ✓' : '');
      }),
      success: function(res) {
        var selectedStatus = statuses[res.tapIndex];
        if (selectedStatus !== currentStatus) {
          var dataPath = 'itemStates.' + key;
          self.setData({ [dataPath]: selectedStatus });
          self._recomputeStats(catIndex);
          if (self._saveTimer) clearTimeout(self._saveTimer);
          self._saveTimer = setTimeout(function() {
            var sparse = {};
            Object.keys(self.data.itemStates).forEach(function(k) {
              if (self.data.itemStates[k] !== 'unowned') {
                sparse[k] = self.data.itemStates[k];
              }
            });
            wx.setStorageSync('checklist_states', sparse);
          }, 500);
        }
      }
    });
  },

  copyKeywords: function(e) {
    var keywords = e.currentTarget.dataset.keywords;
    if (!keywords) return;
    wx.setClipboardData({
      data: keywords,
      success: function() {
        wx.showToast({ title: '已复制选购关键词', icon: 'success', duration: 1500 });
      }
    });
  },

  toggleDescription: function(e) {
    var catIndex = e.currentTarget.dataset.catIndex;
    var itemId = e.currentTarget.dataset.itemId;
    var expKey = 'c' + catIndex + '_' + itemId;
    var dataPath = 'expandedItems.' + expKey;
    var newVal = !this.data.expandedItems[expKey];
    this.setData({ [dataPath]: newVal });
  },

  onSearchInput: function(e) {
    var query = e.detail.value.trim();
    this.setData({ searchQuery: query });

    if (!query) {
      this.setData({ searchResults: null, filteredItems: null });
      return;
    }

    var self = this;
    if (self._searchTimer) clearTimeout(self._searchTimer);
    self._searchTimer = setTimeout(function() {
      var itemStates = self.data.itemStates;

      if (self.data.currentCategory < 0) {
        // 总览视图：跨分类搜索
        var results = [];
        checklistData.forEach(function(cat, catIndex) {
          cat.items.forEach(function(item) {
            if (item.name.indexOf(query) >= 0 ||
                (item.keywords && item.keywords.indexOf(query) >= 0)) {
              results.push({
                catIndex: catIndex,
                category: cat.category,
                id: item.id,
                name: item.name,
                keywords: item.keywords,
                description: item.description,
                status: itemStates['c' + catIndex + '_' + item.id] || 'unowned'
              });
            }
          });
        });
        self.setData({ searchResults: results });
      } else {
        // 详情视图：当前分类内搜索
        var catIndex = self.data.currentCategory;
        var cat = checklistData[catIndex];
        var filtered = cat.items.filter(function(item) {
          return item.name.indexOf(query) >= 0 ||
                 (item.keywords && item.keywords.indexOf(query) >= 0);
        });
        self.setData({ filteredItems: filtered.length < cat.items.length ? filtered : null });
      }
    }, 300);
  },

  clearSearch: function() {
    this.setData({
      searchQuery: '',
      searchResults: null,
      filteredItems: null
    });
  },

  resetCurrentCategory: function() {
    var self = this;
    var catIndex = this.data.currentCategory;
    var data = checklistData[catIndex];
    if (!data) return;

    wx.showModal({
      title: '重置确认',
      content: '确定要重置「' + data.category + '」的所有物品状态吗？',
      confirmColor: '#FC9700',
      success: function(res) {
        if (res.confirm) {
          var itemStates = self.data.itemStates;
          data.items.forEach(function(item) {
            var key = 'c' + catIndex + '_' + item.id;
            delete itemStates[key];
          });
          self.setData({ itemStates: itemStates });
          self._recomputeStats(catIndex);
          wx.setStorageSync('checklist_states', itemStates);
          wx.showToast({ title: '已重置', icon: 'success' });
        }
      }
    });
  },

  _computeAllCategoryStats: function(itemStates) {
    var self = this;
    return checklistData.map(function(cat, catIndex) {
      return self._computeCategoryStats(catIndex, itemStates);
    });
  },

  _computeCategoryStats: function(catIndex, itemStates) {
    var cat = checklistData[catIndex];
    var stats = { total: cat.items.length, owned: 0, unowned: 0, purchased: 0, received: 0 };
    cat.items.forEach(function(item) {
      var key = 'c' + catIndex + '_' + item.id;
      var state = itemStates[key] || 'unowned';
      stats[state] = (stats[state] || 0) + 1;
    });
    stats.completionRate = stats.total > 0
      ? Math.round((stats.owned + stats.received) / stats.total * 100)
      : 0;
    return stats;
  },

  _computeOverallStats: function(categoryStats) {
    var total = { total: 0, owned: 0, unowned: 0, purchased: 0, received: 0 };
    categoryStats.forEach(function(s) {
      total.total += s.total;
      total.owned += s.owned;
      total.unowned += s.unowned;
      total.purchased += s.purchased;
      total.received += s.received;
    });
    total.completionRate = total.total > 0
      ? Math.round((total.owned + total.received) / total.total * 100)
      : 0;
    return total;
  },

  _recomputeStats: function(catIndex) {
    var itemStates = this.data.itemStates;
    var categoryStats = this.data.categoryStats.slice();
    categoryStats[catIndex] = this._computeCategoryStats(catIndex, itemStates);
    var overallStats = this._computeOverallStats(categoryStats);
    this.setData({
      categoryStats: categoryStats,
      overallStats: overallStats
    });
  },

  getStatusLabel: function(status) {
    var labels = { unowned: '未拥有', purchased: '已购买', received: '已签收', owned: '已拥有' };
    return labels[status] || '未拥有';
  },

  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('checklist', this, res);
  },

  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('checklist', this);
  }
});
