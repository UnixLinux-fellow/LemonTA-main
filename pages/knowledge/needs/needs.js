var app = getApp();

// 所有STEP数据定义
var STEPS_DATA = [
  {
    key: 'step1',
    title: 'STEP1. 基础与健康',
    questions: [
      { id: 's1q1', label: '1. 对上一套房子最遗憾的地方？或不希望再出现的问题。', type: 'textarea', placeholder: '包括但不限于工程质量/外观/设计/收纳/厨房等，越多越好' },
      { id: 's1q2', label: '2. 有没有信仰/宗教？', type: 'select', options: ['有', '无'] },
      { id: 's1q2a', label: '宗教名称', type: 'input', placeholder: '请填写宗教名称', showIf: { id: 's1q2', value: '有' } },
      { id: 's1q2b', label: '是否设教坛？', type: 'select', options: ['是', '否'], showIf: { id: 's1q2', value: '有' } },
      { id: 's1q2c', label: '信仰相关备注', type: 'textarea', placeholder: '请补充信仰相关要求', showIf: { id: 's1q2', value: '有' } },
      { id: 's1q3', label: '3. 是否注重风水？', type: 'select', options: ['是', '否'] },
      { id: 's1q3a', label: '风水相关备注', type: 'textarea', placeholder: '请填写风水相关要求', showIf: { id: 's1q3', value: '是' } },
      { id: 's1q4', label: '4. 装修设计有没有禁忌/特殊要求？', type: 'textarea', placeholder: '包括但不限于色彩/材质/灯光等方面是否有特殊要求\n如：要有门槛，装修工人不能踩门槛' },
      { id: 's1q5', label: '5. 家里有没有养宠物？', type: 'select', options: ['有', '无'] },
      { id: 's1q5a', label: '哪种宠物？', type: 'input', placeholder: '请填写宠物种类', showIf: { id: 's1q5', value: '有' } },
      { id: 's1q5b', label: '宠物相关需求', type: 'textarea', placeholder: '包括但不限于宠物的要求/宠物设备/宠物空间/宠物饲养环境要求', showIf: { id: 's1q5', value: '有' } },
      { id: 's1q6', label: '6. 是否有贵重收藏品？', type: 'select', options: ['有', '无'] },
      { id: 's1q6a', label: '收藏品详情', type: 'textarea', placeholder: '包括但不限于奢侈品/古董/雪茄/酒类/运动类/手办等', showIf: { id: 's1q6', value: '有' } },
      { id: 's1q7', label: '7. 有无旧家具或特殊物品、乐器设备的安置？', type: 'textarea', placeholder: '需上门测量尺寸并登记' },
      { id: 's1q8', label: '8. 这次装修后，预期更换/翻新周期大概是多长时间？', type: 'select', options: ['10年', '15年', '25年', '更久'] },
      { id: 's1q8a', label: '更换/更新可能的原因', type: 'textarea', placeholder: '请填写可能的更换原因' },
      { id: 's1q9', label: '9. 是否有坚决不允许使用的材料？', type: 'textarea', placeholder: '如镜面/奢石/竹类/红砖/墙纸等' },
      { id: 's1q10', label: '10. 家人中是否患有需特殊环境的疾病？', type: 'textarea', placeholder: '如鼻炎/粉尘过敏/关节炎/腿脚不便等' },
      { id: 's1q11', label: '11. 对声音或气味是否敏感？', type: 'textarea', placeholder: '如长辈睡眠质量较低，需要全遮光无声环境' },
      { id: 's1q12', label: '12. 不同家人的睡眠习惯？', type: 'textarea', placeholder: '早期早睡/晚期晚睡/早起晚睡/晚起早睡' },
      { id: 's1q13', label: '13. 不同家人睡觉环境？', type: 'textarea', placeholder: '是否开窗/关窗/开门/关门' },
      { id: 's1q14', label: '备注', type: 'textarea', placeholder: '如：是否安装扫拖机器人等' }
    ]
  },
  {
    key: 'step2',
    title: 'STEP2. 空间要求-玄关',
    questions: [
      { id: 's2q1', label: '1. 是否需要玄关镜？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's2q2', label: '2. 是否有运动设备要放置？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's2q3', label: '3. 是否需有充电设备？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's2q4', label: '4. 估计大概要放多少双鞋子？', type: 'input', placeholder: '请输入数量', hasRemark: true },
      { id: 's2q5', label: '5. 是否要夜间常亮或感应灯？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's2q6', label: '6. 进门后是否要挂衣服？', type: 'select', options: ['柜外', '柜内', '否'], hasRemark: true },
      { id: 's2q7', label: '7. 进出门是否有钥匙等物品放在玄关？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's2q8', label: '8. 入户门是否安装指纹锁？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's2q9', label: '9. 入户门是否安装摄像头？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's2q10', label: '10. 是否有鞋子需要与其它鞋隔离放置？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's2q11', label: '11. 是否需要换鞋凳？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's2q12', label: '备注', type: 'textarea', placeholder: '玄关其他需求补充' }
    ]
  },
  {
    key: 'step3',
    title: 'STEP3. 空间要求-客厅',
    questions: [
      { id: 's3q1', label: '1. 客厅会客几率每月大概几次？', type: 'input', placeholder: '请输入次数', hasRemark: true },
      { id: 's3q2', label: '2. 客人来访，是否保持一定距离？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's3q3', label: '3. 是否铺设地毯？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's3q4', label: '4. 是否需要展示功能？如展示柜', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's3q5', label: '5. 是否会在家举办派对或大聚会？', type: 'select', options: ['是', '否'], remarkPlaceholder: '频率' },
      { id: 's3q6', label: '6. 是否需要安装有线电话？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's3q7', label: '7. 是否需要安装有线电视？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's3q8', label: '8. 是否需要装饰壁炉？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's3q9', label: '9. 是否希望客厅有大面积储物功能？', type: 'select', options: ['是', '否'], remarkPlaceholder: '物品/书籍' },
      { id: 's3q10', label: '备注', type: 'textarea', placeholder: '客厅其他需求补充' }
    ]
  },
  {
    key: 'step4',
    title: 'STEP4. 空间要求-餐厅与厨房',
    questions: [
      { id: 's4q1', label: '1. 是否经常在家做饭？', type: 'select', options: ['是', '否'], remarkPlaceholder: '频率' },
      { id: 's4q2', label: '2. 家中一般谁做饭？', type: 'input', placeholder: '请填写主厨', hasRemark: true },
      { id: 's4q3', label: '3. 做饭偏清淡或浓郁？', type: 'select', options: ['清淡', '浓郁'], remarkPlaceholder: '油烟是否较多' },
      { id: 's4q4', label: '4. 喜欢用大单槽还是双槽？', type: 'select', options: ['单槽', '双槽'], hasRemark: true },
      { id: 's4q5', label: '5. 是否设立西厨区？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's4q6', label: '6. 是否接受开放式厨房/半开放式厨房？', type: 'select', options: ['开放式', '半开放式', '否'], remarkPlaceholder: '偏向哪一种' },
      { id: 's4q7', label: '7. 是否经常宴请客人？', type: 'select', options: ['是', '否'], remarkPlaceholder: '频率' },
      { id: 's4q8', label: '8. 餐厅最多需要同时容纳几人用餐？', type: 'input', placeholder: '请输入人数', hasRemark: true },
      { id: 's4q9', label: '9. 是否喜欢岛台（中岛）？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's4q10', label: '10. 是否有吃火锅的情况？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's4q11', label: '11. 是否选择全嵌入式电器？', type: 'select', options: ['是', '否'], remarkPlaceholder: '预算控制' },
      { id: 's4q12', label: '12. 是否有烘焙的兴趣？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's4q13', label: '13. 食育：是否希望让小朋友参与厨房？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's4q14', label: '备注', type: 'textarea', placeholder: '先居住的房子厨房储物情况（柜内情况需拍照）\n现居住的房子所使用电器需拍照\n常用电器如微波炉/蒸蛋器/空气炸锅/电饭煲等需测量尺寸' }
    ]
  },
  {
    key: 'step5',
    title: 'STEP5. 空间要求-公卫',
    questions: [
      { id: 's5q1', label: '1. 是否会采用蹲便器？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's5q2', label: '2. 是否会采用自动冲水小便器？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's5q3', label: '3. 是否安装手部烘干机？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's5q4', label: '4. 是否安装擦手布五金？', type: 'select', options: ['单杆', '双杆'], hasRemark: true },
      { id: 's5q5', label: '5. 面盆龙头是否有偏好品牌/样式？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's5q6', label: '6. 公卫是否需要储物功能？', type: 'select', options: ['是', '否'], remarkPlaceholder: '卷纸/卫生间备品' },
      { id: 's5q7', label: '7. 公卫是否设立淋浴功能？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's5q8', label: '8. 是否设置无障碍进入？', type: 'select', options: ['是', '否'], remarkPlaceholder: '轮椅可进入' },
      { id: 's5q9', label: '9. 是否考虑防滑地板？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's5q10', label: '备注', type: 'textarea', placeholder: '公卫较小且需要淋浴功能，则可能设立开放式盥洗区\n是否有婴儿/儿童卫浴需求' }
    ]
  },
  {
    key: 'step6',
    title: 'STEP6. 空间要求-客卫或其它卫生间',
    questions: [
      { id: 's6q1', label: '1. 面盆龙头是否有偏好样式/品牌？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's6q2', label: '2. 花洒是否有偏好样式/品牌？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's6q3', label: '3. 马桶偏好样式/品牌？', type: 'select', options: ['是', '否'], remarkPlaceholder: '功能需求' },
      { id: 's6q4', label: '4. 玻璃淋浴房采用平开/推拉？', type: 'select', options: ['平开', '推拉'], hasRemark: true },
      { id: 's6q5', label: '5. 是否需要电热毛巾架？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's6q6', label: '6. 地漏样式采用常规/定制线形？', type: 'select', options: ['常规', '线型'], hasRemark: true },
      { id: 's6q7', label: '7. 是否有浴缸泡澡需求？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's6q8', label: '8. 是否安装卫生间干燥机？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's6q9', label: '9. 是否需要无障碍进入？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's6q10', label: '10. 是否接受开放式盥洗区？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's6q11', label: '11. 是否考虑防滑地板？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's6q12', label: '备注', type: 'textarea', placeholder: '需明确使用者情况&特殊需求' }
    ]
  },
  {
    key: 'step7',
    title: 'STEP7. 空间要求-主卫',
    questions: [
      { id: 's7q1', label: '1. 面盆龙头是否有偏好样式/品牌？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's7q2', label: '2. 花洒是否有偏好样式/品牌？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's7q3', label: '3. 马桶偏好样式/品牌？', type: 'select', options: ['是', '否'], remarkPlaceholder: '功能需求' },
      { id: 's7q4', label: '4. 玻璃淋浴房采用平开/推拉？', type: 'select', options: ['平开', '推拉'], hasRemark: true },
      { id: 's7q5', label: '5. 是否需要电热毛巾架？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's7q6', label: '6. 地漏样式采用常规/定制线形？', type: 'select', options: ['常规', '线型'], hasRemark: true },
      { id: 's7q7', label: '7. 是否有浴缸泡澡需求？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's7q8', label: '8. 是否安装卫生间干燥机？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's7q9', label: '9. 是否需要无障碍进入？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's7q10', label: '10. 是否接受开放式盥洗区？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's7q11', label: '11. 是否考虑防滑地板？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's7q12', label: '12. 主卫五金洁具是否选择高定产品？', type: 'select', options: ['是', '否'], remarkPlaceholder: '预算控制' },
      { id: 's7q13', label: '备注', type: 'textarea', placeholder: '需明确使用者情况&特殊需求' }
    ]
  },
  {
    key: 'step8',
    title: 'STEP8. 空间要求-主卧',
    questions: [
      { id: 's8q1', label: '1. 床头柜需要满足多少设备充电？', type: 'input', placeholder: '请输入数量', hasRemark: true },
      { id: 's8q2', label: '2. 主卧化妆桌是否有偏好/品牌？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's8q3', label: '3. 窗帘样式是否有偏好？', type: 'select', options: ['开合帘', '日夜帘', '罗马帘', '香格里拉帘', '无偏好'], hasRemark: true },
      { id: 's8q4', label: '4. 是否有特大床[2.2/2.5m]需求？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's8q5', label: '5. 是否有软包床需求？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's8q6', label: '6. 飘窗是否具备特殊功能？', type: 'select', options: ['是', '否'], remarkPlaceholder: '打坐/茶台等' },
      { id: 's8q7', label: '7. 是否需要书柜/包柜/展示柜？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's8q8', label: '8. 床下是否应该具备收纳功能？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's8q9', label: '9. 除妆桌外是否需要书桌？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's8q10', label: '10. 是否配置电视/投影？', type: 'select', options: ['电视', '投影', '否'], hasRemark: true },
      { id: 's8q11', label: '11. 是否配置懒人沙发/按摩椅？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's8q12', label: '备注', type: 'textarea', placeholder: '需明确使用者情况&特殊需求' }
    ]
  },
  {
    key: 'step9',
    title: 'STEP9. 空间要求-儿童房',
    questions: [
      { id: 's9q1', label: '1. 该房间的功能规划是否固定？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's9q2', label: '2. 小朋友的年龄？', type: 'input', placeholder: '请输入年龄', hasRemark: false },
      { id: 's9q2a', label: '小朋友的性别？', type: 'select', options: ['男', '女'], hasRemark: false },
      { id: 's9q3', label: '3. 小朋友有什么爱好？', type: 'textarea', placeholder: '请列举爱好（多个）' },
      { id: 's9q4', label: '4. 儿童房内是否铺设地毯？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's9q5', label: '5. 是否根据性别进行室内颜色设计？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's9q6', label: '6. 墙面材质偏向？', type: 'select', options: ['乳胶漆', '墙纸', '墙板', '都可以'], hasRemark: true },
      { id: 's9q7', label: '7. 是否需要学习灯？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's9q8', label: '8. 是否为可移动成长学习桌？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's9q9', label: '9. 窗帘样式是否有偏好？', type: 'select', options: ['开合帘', '日夜帘', '罗马帘', '香格里拉帘', '无偏好'], hasRemark: true },
      { id: 's9q10', label: '10. 是否接受全移动家具[蒙氏儿童房]？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's9q11', label: '11. 是否配置桌面屏幕/电脑？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's9q12', label: '12. 是否使用全圆弧/软包收边？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's9q13', label: '备注', type: 'textarea', placeholder: '需明确家长需求，如有些家中会希望做一个内窗，有些会希望安装可对话摄像头' }
    ]
  },
  {
    key: 'step10',
    title: 'STEP10. 空间要求-其它卧室',
    questions: [
      { id: 's10q1', label: '1. 窗帘样式是否有偏好？', type: 'select', options: ['开合帘', '日夜帘', '罗马帘', '香格里拉帘', '无偏好'], hasRemark: true },
      { id: 's10q2', label: '2. 该房间的功能规划是否固定？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's10q3', label: '3. 该房间常用居住人为？', type: 'input', placeholder: '请填写常住人', hasRemark: true },
      { id: 's10q4', label: '4. 飘窗是否具备特殊功能？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's10q5', label: '5. 是否会作为临时储藏间？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's10q6', label: '6. 床下是否应该具备收纳功能？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's10q7', label: '7. 是否配置书桌？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's10q8', label: '8. 是否配置电视？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's10q9', label: '备注', type: 'textarea', placeholder: '需明确常住使用者情况&特殊需求' }
    ]
  },
  {
    key: 'step11',
    title: 'STEP11. 空间要求-衣帽间',
    questions: [
      { id: 's11q1', label: '1. 家中谁的衣服多？比例为多少？', type: 'input', placeholder: '请填写主人及比例', hasRemark: true },
      { id: 's11q2', label: '2. 是否接受开放式衣帽间？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's11q3', label: '3. 大衣及长裙的数量，大概需要几米？', type: 'input', placeholder: '请输入数量/米数', hasRemark: true },
      { id: 's11q4', label: '4. 是否希望在衣帽间熨烫衣物？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's11q5', label: '5. 是否需要安装时控排风？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's11q6', label: '6. 是否希望化妆桌在衣帽间？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's11q7', label: '7. 是否考虑首饰柜，大概需要几层？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's11q8', label: '8. 是否需要保险箱，是否隐藏？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's11q9', label: '9. 是否需要配置冷光源？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's11q10', label: '10. 衣帽间是否存放行李箱？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's11q11', label: '备注', type: 'textarea', placeholder: '家中现有衣物需要拍照确认' }
    ]
  },
  {
    key: 'step12',
    title: 'STEP12. 空间要求-书房/茶室',
    questions: [
      { id: 's12q1', label: '1. 书房的主要使用者是谁？', type: 'input', placeholder: '请填写使用者', hasRemark: true },
      { id: 's12q2', label: '2. 书房的主要用途为？', type: 'select', options: ['工作', '接待', '谈事情', '茶室', '游戏', '综合'], hasRemark: true },
      { id: 's12q3', label: '3. 书房的功能是否长期固定？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's12q4', label: '4. 电脑是笔记本还是台式机？', type: 'select', options: ['笔记本', '台式机', '都有'], hasRemark: true },
      { id: 's12q5', label: '5. 是否有多个屏幕？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's12q6', label: '6. 喜欢书桌靠墙还是椅背靠墙？', type: 'select', options: ['书桌靠墙', '椅背靠墙'], hasRemark: true },
      { id: 's12q7', label: '7. 茶室是否需要大板茶台？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's12q8', label: '8. 茶室偏正式还是休闲？', type: 'select', options: ['正式', '休闲'], hasRemark: true },
      { id: 's12q9', label: '9. 茶室是否需要具备展示功能？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's12q10', label: '10. 是否会在书房进行其他活动？', type: 'input', placeholder: '如练琴等', hasRemark: true },
      { id: 's12q11', label: '备注', type: 'textarea', placeholder: '确认书房活动需求，如字画，弹琴等' }
    ]
  },
  {
    key: 'step13',
    title: 'STEP13. 空间要求-影音室/健身房/棋牌室',
    questions: [
      { id: 's13q1', label: '1. 影音室偏行影院还是专业音响房？', type: 'select', options: ['行影院', '专业音响房', '不需要'], hasRemark: true },
      { id: 's13q2', label: '2. 影音室是否具备KTV功能？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's13q3', label: '3. 影音室使用频率大概为？', type: 'input', placeholder: '请填写频率', hasRemark: true },
      { id: 's13q4', label: '4. 健身房计划采购哪些设备？', type: 'textarea', placeholder: '请列举设备类型' },
      { id: 's13q5', label: '5. 健身房使用频率？', type: 'input', placeholder: '请填写频率', hasRemark: true },
      { id: 's13q6', label: '6. 健身房是否配备冲凉区？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's13q7', label: '7. 棋牌室的主要设备有哪些？', type: 'select', options: ['桌游', '麻将', '都有', '不需要'], hasRemark: true },
      { id: 's13q8', label: '8. 棋牌室使用频率？', type: 'input', placeholder: '请填写频率', hasRemark: true },
      { id: 's13q9', label: '备注', type: 'textarea', placeholder: '其他特殊需求' }
    ]
  },
  {
    key: 'step14',
    title: 'STEP14. 生活阳台/家政间/储物间/设备间/车库',
    questions: [
      { id: 's14q1', label: '1. 是否封阳台？是否需要半室外空间？', type: 'select', options: ['封阳台', '半室外空间', '否'], hasRemark: true },
      { id: 's14q2', label: '2. 是否配置烘干机？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's14q3', label: '3. 是否配置衣物护理机？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's14q4', label: '4. 是否需要拖布池？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's14q5', label: '5. 是否配置电动晾衣杆？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's14q6', label: '6. 储物间是否设置活动层板？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's14q7', label: '7. 储物间是否需要柜门？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's14q8', label: '8. 设备间是否交由设计师规划？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's14q9', label: '备注', type: 'textarea', placeholder: '设备间放置设备一般包括：空调外机/空气能热泵/净水器/软水器/水箱等' }
    ]
  },
  {
    key: 'step15',
    title: 'STEP15. 水电设备/全屋智能/门窗',
    questions: [
      { id: 's15q1', label: '1. 是否全屋覆盖WIFI？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's15q2', label: '2. 全屋WIFI采用哪种形式？', type: 'select', options: ['MESH组网', '光纤入户', 'AC+AP'], hasRemark: true },
      { id: 's15q3', label: '3. 厨房插座需求？', type: 'select', options: ['普通插座', '开关插座', '轨道插座'], hasRemark: true },
      { id: 's15q4', label: '4. 水处理设备？', type: 'select', options: ['中央软水', '全屋净水', '厨下净水', '暂不考虑'], hasRemark: true },
      { id: 's15q5', label: '5. 哪些房间需要接管线机？', type: 'input', placeholder: '请填写房间', hasRemark: true },
      { id: 's15q6', label: '6. 是否需要新风？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's15q7', label: '7. 新风采用什么形式实现？', type: 'select', options: ['新风空调', '壁挂机', '中央新风', '暂不考虑'], hasRemark: true },
      { id: 's15q8', label: '8. 热水器采用什么类型？', type: 'select', options: ['燃气炉', '空气能', '太阳能', '电加热'], hasRemark: true },
      { id: 's15q9', label: '9. 是否安装全屋零冷水？', type: 'select', options: ['是', '否'], remarkPlaceholder: '局部循环请注意循环的厨卫空间' },
      { id: 's15q10', label: '10. 取暖采用什么形式？', type: 'select', options: ['取暖器', '分体空调', '中央空调', '地暖'], hasRemark: true },
      { id: 's15q11', label: '11. 需要取暖的房间为哪些？', type: 'input', placeholder: '请填写房间', hasRemark: true },
      { id: 's15q12', label: '12. 制冷采用什么形式？', type: 'select', options: ['壁挂空调', '风管机', '中央空调', '全空气'], hasRemark: true },
      { id: 's15q13', label: '13. 是否使用全屋智能系统？', type: 'select', options: ['是', '否'], hasRemark: true },
      { id: 's15q14', label: '14. 需要全屋智能实现哪些功能？', type: 'textarea', placeholder: '安防/传感器系统/背景音乐/智能灯光/智能开关/智能窗帘/智能空调等', showIf: { id: 's15q13', value: '是' } },
      { id: 's15q15', label: '15. 全屋智能选用哪个系统？', type: 'select', options: ['苹果HomeKit', '华为', '米家', '其他'], showIf: { id: 's15q13', value: '是' }, hasRemark: true },
      { id: 's15q16', label: '16. 全屋门窗是否更换？', type: 'select', options: ['是', '否'], remarkPlaceholder: '预算控制' },
      { id: 's15q17', label: '备注', type: 'textarea', placeholder: '全屋智能必备功能包括：安防/传感器系统/背景音乐/智能灯光/智能开关/智能窗帘/智能空调等\n车库门是否更换，采用哪一类型（预算控制）' }
    ]
  }
];

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    steps: [],
    formData: {},
    saved: false
  },

  onLoad: function () {
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

    // 处理steps数据用于渲染
    var steps = [];
    for (var i = 0; i < STEPS_DATA.length; i++) {
      var step = STEPS_DATA[i];
      var questions = [];
      for (var j = 0; j < step.questions.length; j++) {
        var q = step.questions[j];
        questions.push({
          id: q.id,
          label: q.label,
          type: q.type,
          options: q.options || [],
          placeholder: q.placeholder || '',
          hasRemark: q.hasRemark || false,
          remarkPlaceholder: q.remarkPlaceholder || '备注',
          showIf: q.showIf || null,
          visible: q.showIf ? false : true
        });
      }
      steps.push({
        key: step.key,
        title: step.title,
        questions: questions
      });
    }

    // 从本地存储加载已保存的数据
    var savedData = wx.getStorageSync('needsFormData');
    var formData = savedData || {};

    // 设置条件显示的题目可见性
    steps = this._updateVisibility(steps, formData);

    this.setData({
      steps: steps,
      formData: formData,
      saved: !!savedData
    });
  },

  // 更新条件显示的题目可见性
  _updateVisibility: function (steps, formData) {
    for (var i = 0; i < steps.length; i++) {
      for (var j = 0; j < steps[i].questions.length; j++) {
        var q = steps[i].questions[j];
        if (q.showIf) {
          var depVal = formData[q.showIf.id] || '';
          q.visible = depVal === q.showIf.value;
        }
      }
    }
    return steps;
  },

  // 选项点击
  onSelectOption: function (e) {
    var qid = e.currentTarget.dataset.qid;
    var option = e.currentTarget.dataset.option;
    var currentVal = this.data.formData[qid];
    // 如果点击已选中的选项，则取消选择
    var newVal = (currentVal === option) ? '' : option;

    // 使用路径更新 formData，避免整体替换大对象
    var updateData = {};
    updateData['formData.' + qid] = newVal;

    // 需要更新条件显示时，先局部修改再计算
    var formDataCopy = {};
    var keys = Object.keys(this.data.formData);
    for (var i = 0; i < keys.length; i++) {
      formDataCopy[keys[i]] = this.data.formData[keys[i]];
    }
    formDataCopy[qid] = newVal;
    var steps = this._updateVisibility(this.data.steps, formDataCopy);
    updateData.steps = steps;

    this.setData(updateData);
    this._autoSave();
  },

  // 输入变化
  onInputChange: function (e) {
    var qid = e.currentTarget.dataset.qid;
    var val = e.detail.value;
    var key = 'formData.' + qid;
    this.setData({
      [key]: val
    });
    this._autoSave();
  },

  // 备注输入变化
  onRemarkChange: function (e) {
    var qid = e.currentTarget.dataset.qid;
    var val = e.detail.value;
    var key = 'formData.' + qid + '_remark';
    this.setData({
      [key]: val
    });
    this._autoSave();
  },

  // 自动保存（防抖）
  _autoSave: function () {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
    }
    var self = this;
    this._saveTimer = setTimeout(function () {
      wx.setStorageSync('needsFormData', self.data.formData);
      self.setData({ saved: true });
    }, 800);
  },

  // 手动保存
  onSave: function () {
    wx.setStorageSync('needsFormData', this.data.formData);
    this.setData({ saved: true });
    wx.showToast({
      title: '已保存',
      icon: 'success',
      duration: 1500
    });
  },

  // 返回上一页
  goBack: function () {
    wx.navigateBack();
  },

  // 重置表单
  onReset: function () {
    var self = this;
    wx.showModal({
      title: '确认重置',
      content: '确定要清空所有已填写的内容吗？此操作不可恢复。',
      confirmColor: '#FC9700',
      success: function (res) {
        if (res.confirm) {
          var steps = self._updateVisibility(self.data.steps, {});
          self.setData({
            formData: {},
            steps: steps,
            saved: false
          });
          wx.removeStorageSync('needsFormData');
          wx.showToast({
            title: '已重置',
            icon: 'success',
            duration: 1500
          });
          // 滚动到顶部
          wx.pageScrollTo({ scrollTop: 0, duration: 300 });
        }
      }
    });
  },

  /** 转发到聊天 */
  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('needs', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('needs', this);
  }
});
