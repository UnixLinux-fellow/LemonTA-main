/**
 * 成本计算页面 - 基于 calculate.xlsx 公式引擎
 * 
 * 配置项(5个)：
 *   - board: 板材品牌 (C2)
 *   - doorMaterial: 门板材质 (E2)
 *   - doorCraft: 门板工艺 (F2)
 *   - hardware: 五金品牌 (G2)
 *   - lighting: 照明 (I2)
 *
 * 每个模块参数：
 *   - type: 结构类型 a/b/c/d/g (E3)
 *   - width: 宽度 cm (G3)
 *   - height: 高度 cm (I3, 默认230)
 */

var app = getApp();
var assets = require('../../utils/assets.js');

// ============ 数据库 (来自 Excel "数据库" sheet) ============

// 板材单价 (元/m²) - Excel数据库 B1:C5
var BOARD_PRICES = {
  'E2国产板': 80,
  '兔宝宝': 120,
  '克诺斯帮': 115,
  '德国克诺斯邦': 155,
  '爱格': 195
};

// 门板材质加价 (元/m²) - Excel数据库 B7:C13
var DOOR_MATERIAL_SURCHARGE = {
  '柜体相同': 0,
  '钢琴烤漆': 200,
  '肤感烤漆': 250,
  '铝框AG玻璃': 270,
  '实木贴皮': 300,
  '橡胶实木': 480,
  '白蜡实木': 830
};

// 门板工艺加价 (元/m²) - Excel数据库 B15:C18
var DOOR_CRAFT_SURCHARGE = {
  '无': 0,
  '骨骼线': 75,
  '欧式': 148,
  '格栅门': 300
};

// 五金-铰链 详细价格 - Excel数据库 E1:G9
var HINGE_PRICES = {
  '中国品牌': {
    items: [
      { name: 'DTC东泰 C81全盖铰链（铰杯螺丝孔间距调整为48mm）', price: 4 },
      { name: 'DTC东泰 C81一字底座', price: 1.2 },
      { name: 'DTC东泰 铰链装饰盖', price: 0.5 },
      { name: 'DTC东泰 铰杯装饰盖', price: 0.5 }
    ]
  },
  '海外品牌': {
    items: [
      { name: 'B1um百隆175H3100 MB快装集成阻尼 110°全盖', price: 20 },
      { name: 'B1um百隆175H3100 快装铰链一字底座 偏心螺丝', price: 5 },
      { name: 'Blum百隆70.1503. 铰链装饰盖全盖镀镍', price: 1 },
      { name: 'Blum百隆 TO-AB 铰杯装饰盖（大开口）', price: 1 }
    ]
  }
};

// 五金-挂衣杆 - Excel数据库 E11:G15
var ROD_PRICES = {
  '中国品牌': {
    rod: { name: '加厚铝合金静音条挂衣杆 /cm', price: 0.35 },
    flange: { name: '挂衣杆双侧法兰 /对', price: 5 }
  },
  '海外品牌': {
    rod: { name: 'Häfele海福乐 801.73.503 衣杆带顶部静音条 高级灰 /㎝', price: 0.72 },
    flange: { name: 'Häfele海福乐 801.73.503 衣杆托 侧装/顶装 高级灰 /对', price: 50 }
  }
};

// 五金-反弹器 - Excel数据库 E17:G19
var BOUNCE_PRICES = {
  '中国品牌': { name: '悍高 重型反弹器 L=70mm', price: 2.2 },
  '海外品牌': { name: 'Häfele海福乐 反弹器带橡胶缓冲器 M-PUSH L=80mm', price: 22 }
};

// 五金-上翻门支臂 - Excel数据库 E21:G23
var FLAP_PRICES = {
  '中国品牌': { name: 'H-03A任意停支撑杆', price: 14.5 },
  '海外品牌': { name: 'Häfele海福乐 重载型任意停上翻铰链', price: 97 }
};

// 五金-三合一 - Excel数据库 E35:G37
var TRI_CONNECT_PRICES = {
  '中国品牌': { name: '常规三合一', price: 0.2 },
  '海外品牌': { name: 'Häfele 抽屉三合一连接件', price: 0.8 }
};

// 照明价格 - Excel数据库 E25:G33
var LIGHTING_PRICES_CN = [
  { name: 'Led 超薄1010带边灯槽 /米', price: 4.4 },
  { name: '12V 4000K LED灯带 60珠 8mm /米', price: 15 },
  { name: '12V 36瓦变压器', price: 85 },
  { name: '12V 双头门碰感应器', price: 47 }
];

var LIGHTING_PRICES_OVERSEAS = [
  { name: 'Häfele Loox5 内嵌式型材1101，聚碳酸酯 /米', price: 13.86 },
  { name: 'Häfele Loox LED 2042，24V灯带 120珠 4000K /米', price: 40 },
  { name: 'Häfele Loox5 24 V 恒压，配电源线40W+多开关分控盒V2', price: 200 },
  { name: 'Loox5模块化门感应模块+导线（开孔调整为12mm）', price: 49.39 }
];

// 各类型模块的层板数量 - Excel 数据库 A20:B25
var LAYER_COUNT = { a: 2, b: 2, c: 2, d: 3, g: 0 };

// 各类型模块的A抽数量 - Excel 数据库 A27:B32
var DRAWER_A_COUNT = { a: 0, b: 0, c: 2, d: 2, g: 0 };

// 各类型模块的B抽数量 - Excel 数据库 A34:B39
var DRAWER_B_COUNT = { a: 0, b: 0, c: 0, d: 1, g: 0 };

// 铰链数量 (固定8个 for standard types)
var HINGE_COUNT = 8;

/**
 * 获取最接近的非标宽度
 */
function getNearestEWidth(w) {
  var available = [45, 55, 65, 75, 85, 95, 105, 115];
  var nearest = 75;
  var minDiff = Infinity;
  for (var i = 0; i < available.length; i++) {
    var diff = Math.abs(available[i] - w);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = available[i];
    }
  }
  return nearest;
}

/**
 * 获取模块缩略图路径
 */
function getModuleThumb(mod) {
  var type = mod.type || 'a';
  var w = mod.width;
  if (mod.isCustom) {
    var ew = getNearestEWidth(w);
    return assets.picture('e/' + type + '-' + ew + '-230');
  } else {
    return assets.picture(w + '/' + type + '-' + w + '-230');
  }
}

/**
 * 获取加高模块（g型）的缩略图路径
 * 注意：加高尺寸可用值与 layout.js getNearestGapHeight 保持一致
 */
function getGapModuleThumb(mod, gapH) {
  var w = mod.width;
  // 取最接近的加高尺寸 (与 layout.js 中 getNearestGapHeight 一致)
  var available = [25, 35, 45, 55, 65, 75, 85, 95];
  var nearH = 25;
  var minDiff = Infinity;
  for (var i = 0; i < available.length; i++) {
    var diff = Math.abs(available[i] - gapH);
    if (diff < minDiff) { minDiff = diff; nearH = available[i]; }
  }
  var thumbPath;
  if (mod.isCustom) {
    var ew = getNearestEWidth(w);
    thumbPath = assets.picture('e/g/g-' + ew + '-' + nearH);
  } else {
    thumbPath = assets.picture(w + '/g-' + w + '-' + nearH);
  }
  console.log('[cost] getGapModuleThumb: width=' + w + ', gapH=' + gapH + ', nearH=' + nearH + ', isCustom=' + mod.isCustom + ', path=' + thumbPath);
  return thumbPath;
}

// ============ 计算引擎 ============

/**
 * 四舍五入保留2位小数
 */
function r2(v) {
  return Math.round(v * 100) / 100;
}

/**
 * 计算单个模块的板材费用
 * 严格对应 Excel rows 6-24 公式
 * 
 * Excel公式结构:
 *   G(面积) = 长*宽/10000*数量  (对于层板等G列包含F的行，面积是总面积)
 *   I(费用) = 数量 * 面积 * 单价  (即 F * G * H)
 *   运费 = SUMPRODUCT(F6:F24, G6:G24) * 15
 *   安装费 = SUMPRODUCT(F6:F24, G6:G24) * 20
 * 
 * 注意: 对于G列中包含F的行(如层板、左右侧板等), 面积G已经是总面积,
 *       费用 = F * G * H = 数量 * 总面积 * 单价 = 数量² * 单片面积 * 单价
 *       SUMPRODUCT贡献 = F * G = 数量 * 总面积 = 数量² * 单片面积
 */
function calcBoardCost(mod, boardPrice, doorSurcharge, craftSurcharge, lighting) {
  var w = mod.width;   // cm (G3)
  var h = mod.height;  // cm (I3)
  var type = mod.type || 'a';

  // 门板单价 = 板材基价 + 门板材质加价 + 门板工艺加价
  var doorPrice = boardPrice + doorSurcharge + craftSurcharge;

  // 板材明细数组
  // areaG = Excel G列值 (含数量的总面积, = 长*宽/10000*数量)
  // cost = Excel I列值 (= 数量 * areaG * 单价)
  // sumProd = Excel SUMPRODUCT贡献 (= 数量 * areaG)
  var details = [];

  // 左侧板: 长=I3-6, 宽=60-2, 厚=1.8, 数量=1
  var leftL = h - 6, leftW = 60 - 2;
  var leftQty = 1;
  var leftAreaG = leftL * leftW / 10000 * leftQty;  // G列: 含数量
  var leftCost = leftQty * leftAreaG * boardPrice;    // I列: F*G*H
  details.push({ name: '左侧板', l: leftL, w: leftW, thick: 1.8, qty: leftQty, area: r2(leftAreaG), unitPrice: boardPrice, cost: r2(leftCost), sumProd: leftQty * leftAreaG });

  // 右侧板: 同左侧板
  var rightL = h - 6, rightW = 60 - 2;
  var rightQty = 1;
  var rightAreaG = rightL * rightW / 10000 * rightQty;
  var rightCost = rightQty * rightAreaG * boardPrice;
  details.push({ name: '右侧板', l: rightL, w: rightW, thick: 1.8, qty: rightQty, area: r2(rightAreaG), unitPrice: boardPrice, cost: r2(rightCost), sumProd: rightQty * rightAreaG });

  // 顶板: 长=G3-(1.8*2), 宽=60-2, 厚=1.8, 数量=1
  var topL = w - (1.8 * 2), topW = 60 - 2;
  var topQty = 1;
  var topAreaG = topL * topW / 10000 * topQty;
  var topCost = topQty * topAreaG * boardPrice;
  details.push({ name: '顶板', l: r2(topL), w: topW, thick: 1.8, qty: topQty, area: r2(topAreaG), unitPrice: boardPrice, cost: r2(topCost), sumProd: topQty * topAreaG });

  // 底板: 同顶板
  var botL = w - (1.8 * 2), botW = 60 - 2;
  var botQty = 1;
  var botAreaG = botL * botW / 10000 * botQty;
  var botCost = botQty * botAreaG * boardPrice;
  details.push({ name: '底板', l: r2(botL), w: botW, thick: 1.8, qty: botQty, area: r2(botAreaG), unitPrice: boardPrice, cost: r2(botCost), sumProd: botQty * botAreaG });

  // 厚背板: 长=I3-1.8-1.8-6, 宽=G3-(1.8*2), 厚=1.8, 数量=1
  var backL = h - 1.8 - 1.8 - 6, backW = w - (1.8 * 2);
  var backQty = 1;
  var backAreaG = backL * backW / 10000 * backQty;
  var backCost = backQty * backAreaG * boardPrice;
  details.push({ name: '厚背板', l: r2(backL), w: r2(backW), thick: 1.8, qty: backQty, area: r2(backAreaG), unitPrice: boardPrice, cost: r2(backCost), sumProd: backQty * backAreaG });

  // 层板: 长=G3-(1.8*2), 宽=60-2-1.8, 数量=VLOOKUP(类型)+(g型且h>=51时+1)
  // Excel: G11=C*D/10000*F(面积含数量), I11=F*G*H(数量*总面积*单价)
  var layerL = w - (1.8 * 2), layerW = 60 - 2 - 1.8;
  var layerQty = LAYER_COUNT[type] || 0;
  if (type === 'g' && h >= 51) layerQty += 1;
  var layerAreaG = layerL * layerW / 10000 * layerQty;  // G列: 含数量的总面积
  var layerCost = layerQty * layerAreaG * boardPrice;     // I列: F*G*H
  details.push({ name: '层板', l: r2(layerL), w: r2(layerW), thick: 1.8, qty: layerQty, area: r2(layerAreaG), unitPrice: boardPrice, cost: r2(layerCost), sumProd: layerQty * layerAreaG });

  // 门板: 长=I3-6-0.44, 宽=G3-0.6, 厚=1.8, 数量=1
  // Excel: G12=C*D/10000 (不含F), I12=F*G*H
  var doorL = h - 6 - 0.44, doorW = w - 0.6;
  var doorQty = 1;
  var doorAreaG = doorL * doorW / 10000;  // G列: 不含数量
  var doorCost = doorQty * doorAreaG * doorPrice;
  details.push({ name: '门板', l: r2(doorL), w: r2(doorW), thick: 1.8, qty: doorQty, area: r2(doorAreaG), unitPrice: doorPrice, cost: r2(doorCost), sumProd: doorQty * doorAreaG });

  // 检修口: 长=19.8, 宽=G3-1.8-1.8-0.4, 数量=IF(g型或照明无,0,1)
  // Excel: G13=C*D/10000 (不含F), I13=F*G*H
  var inspL = 19.8, inspW = w - 1.8 - 1.8 - 0.4;
  var inspQty = (type === 'g' || lighting === '无') ? 0 : 1;
  var inspAreaG = inspL * inspW / 10000;
  var inspCost = inspQty * inspAreaG * boardPrice;
  details.push({ name: '检修口', l: inspL, w: r2(inspW), thick: 1.8, qty: inspQty, area: r2(inspAreaG), unitPrice: boardPrice, cost: r2(inspCost), sumProd: inspQty * inspAreaG });

  // A抽屉部件 (G列不含F)
  var drawerACount = DRAWER_A_COUNT[type] || 0;
  // A抽面: 长=G3-4, 宽=16
  var aFaceL = w - 4, aFaceW = 16;
  var aFaceAreaG = aFaceL * aFaceW / 10000;
  var aFaceCost = drawerACount * aFaceAreaG * boardPrice;
  details.push({ name: 'A抽面', l: r2(aFaceL), w: aFaceW, thick: 1.8, qty: drawerACount, area: r2(aFaceAreaG), unitPrice: boardPrice, cost: r2(aFaceCost), sumProd: drawerACount * aFaceAreaG });

  // A左抽帮: 长=49, 宽=12
  var aLSideAreaG = 49 * 12 / 10000;
  var aLSideCost = drawerACount * aLSideAreaG * boardPrice;
  details.push({ name: 'A左抽帮', l: 49, w: 12, thick: 1.8, qty: drawerACount, area: r2(aLSideAreaG), unitPrice: boardPrice, cost: r2(aLSideCost), sumProd: drawerACount * aLSideAreaG });

  // A右抽帮: 同左
  var aRSideAreaG = 49 * 12 / 10000;
  var aRSideCost = drawerACount * aRSideAreaG * boardPrice;
  details.push({ name: 'A右抽帮', l: 49, w: 12, thick: 1.8, qty: drawerACount, area: r2(aRSideAreaG), unitPrice: boardPrice, cost: r2(aRSideCost), sumProd: drawerACount * aRSideAreaG });

  // A后抽堵: 长=G3-8.5, 宽=10.7
  var aBackL = w - 8.5;
  var aBackAreaG = aBackL * 10.7 / 10000;
  var aBackCost = drawerACount * aBackAreaG * boardPrice;
  details.push({ name: 'A后抽堵', l: r2(aBackL), w: 10.7, thick: 1.8, qty: drawerACount, area: r2(aBackAreaG), unitPrice: boardPrice, cost: r2(aBackCost), sumProd: drawerACount * aBackAreaG });

  // A抽底: 长=G3-8.5, 宽=47.2
  var aBottomL = w - 8.5;
  var aBottomAreaG = aBottomL * 47.2 / 10000;
  var aBottomCost = drawerACount * aBottomAreaG * boardPrice;
  details.push({ name: 'A抽底', l: r2(aBottomL), w: 47.2, thick: 1.8, qty: drawerACount, area: r2(aBottomAreaG), unitPrice: boardPrice, cost: r2(aBottomCost), sumProd: drawerACount * aBottomAreaG });

  // B抽屉部件 (G列不含F)
  var drawerBCount = DRAWER_B_COUNT[type] || 0;
  // B抽面: 长=G3-4, 宽=5
  var bFaceL = w - 4, bFaceW = 5;
  var bFaceAreaG = bFaceL * bFaceW / 10000;
  var bFaceCost = drawerBCount * bFaceAreaG * boardPrice;
  details.push({ name: 'B抽面', l: r2(bFaceL), w: bFaceW, thick: 1.8, qty: drawerBCount, area: r2(bFaceAreaG), unitPrice: boardPrice, cost: r2(bFaceCost), sumProd: drawerBCount * bFaceAreaG });

  // B左抽帮: 长=49, 宽=5
  var bLSideAreaG = 49 * 5 / 10000;
  var bLSideCost = drawerBCount * bLSideAreaG * boardPrice;
  details.push({ name: 'B左抽帮', l: 49, w: 5, thick: 1.8, qty: drawerBCount, area: r2(bLSideAreaG), unitPrice: boardPrice, cost: r2(bLSideCost), sumProd: drawerBCount * bLSideAreaG });

  // B右抽帮
  var bRSideAreaG = 49 * 5 / 10000;
  var bRSideCost = drawerBCount * bRSideAreaG * boardPrice;
  details.push({ name: 'B右抽帮', l: 49, w: 5, thick: 1.8, qty: drawerBCount, area: r2(bRSideAreaG), unitPrice: boardPrice, cost: r2(bRSideCost), sumProd: drawerBCount * bRSideAreaG });

  // B后抽堵: 长=G3-8.5, 宽=4.2
  var bBackL = w - 8.5;
  var bBackAreaG = bBackL * 4.2 / 10000;
  var bBackCost = drawerBCount * bBackAreaG * boardPrice;
  details.push({ name: 'B后抽堵', l: r2(bBackL), w: 4.2, thick: 1.8, qty: drawerBCount, area: r2(bBackAreaG), unitPrice: boardPrice, cost: r2(bBackCost), sumProd: drawerBCount * bBackAreaG });

  // B抽底: 长=G3-8.5, 宽=47.2
  var bBottomL = w - 8.5;
  var bBottomAreaG = bBottomL * 47.2 / 10000;
  var bBottomCost = drawerBCount * bBottomAreaG * boardPrice;
  details.push({ name: 'B抽底', l: r2(bBottomL), w: 47.2, thick: 1.8, qty: drawerBCount, area: r2(bBottomAreaG), unitPrice: boardPrice, cost: r2(bBottomCost), sumProd: drawerBCount * bBottomAreaG });

  // 踢脚线: 长=G3+45, 宽=5.5, 数量=IF(g型,0,1)
  // Excel: G24=C*D/10000 (不含F), I24=F*G*H
  var kickL = w + 45, kickW = 5.5;
  var kickQty = (type === 'g') ? 0 : 1;
  var kickAreaG = kickL * kickW / 10000;
  var kickCost = kickQty * kickAreaG * boardPrice;
  details.push({ name: '踢脚线', l: r2(kickL), w: kickW, thick: 1.8, qty: kickQty, area: r2(kickAreaG), unitPrice: boardPrice, cost: r2(kickCost), sumProd: kickQty * kickAreaG });

  // 计算总板材费用 = SUM(I6:I24)
  var totalBoardCost = 0;
  // 计算 SUMPRODUCT(F6:F24, G6:G24) 用于运费安装费
  var sumQtyArea = 0;
  for (var i = 0; i < details.length; i++) {
    totalBoardCost += details[i].cost;
    sumQtyArea += details[i].sumProd;
  }

  return {
    details: details,
    total: r2(totalBoardCost),
    sumQtyArea: sumQtyArea  // SUMPRODUCT(F, G) 用于运费/安装费计算
  };
}

/**
 * 计算单个模块的五金费用
 * 严格对应 Excel rows 25-58 公式
 */
function calcHardwareCost(mod, hwBrand, lighting) {
  var type = mod.type || 'a';
  var w = mod.width;  // cm (G3)
  var h = mod.height; // cm (I3)

  var items = [];

  // === 柜体连接 ===
  // 数量 = G3*I3/320
  var connQty = r2(w * h / 320);
  items.push({ category: '柜体连接', name: 'SW4 6.3×50mm 白锌合金 沉头螺丝', qty: connQty, price: 0.1, cost: r2(connQty * 0.1) });
  items.push({ category: '柜体连接', name: '8×40mm 定位木销', qty: connQty, price: 0.1, cost: r2(connQty * 0.1) });

  // === 调整脚 ===
  // 数量 = IF(g型,0,4)
  var feetQty = (type === 'g') ? 0 : 4;
  items.push({ category: '调整脚', name: 'Häfele AXILO® 基座系统 53–70 mm', qty: feetQty, price: 4.27, cost: r2(feetQty * 4.27) });
  items.push({ category: '调整脚', name: 'Häfele AXILO® 压入式底座', qty: feetQty, price: 5.68, cost: r2(feetQty * 5.68) });

  // === 铰链 ===
  var hingeQty = HINGE_COUNT; // 固定8个
  var hingePrices = HINGE_PRICES[hwBrand] || HINGE_PRICES['中国品牌'];
  for (var hi = 0; hi < hingePrices.items.length; hi++) {
    var hp = hingePrices.items[hi];
    items.push({ category: '铰链', name: hp.name, qty: hingeQty, price: hp.price, cost: r2(hingeQty * hp.price) });
  }
  // 铰链辅料: 尼龙螺丝=铰链数*2, M4螺丝=铰链数*2, 防潮盖=铰链数
  items.push({ category: '铰链', name: 'Ø5mm×12mm 尼龙螺丝预埋颗粒', qty: hingeQty * 2, price: 0.141, cost: r2(hingeQty * 2 * 0.141) });
  items.push({ category: '铰链', name: 'M4×16 深螺纹镀镍螺丝', qty: hingeQty * 2, price: r2(9.6 / 300), cost: r2(hingeQty * 2 * 9.6 / 300) });
  items.push({ category: '铰链', name: 'Ø37mm×12.8mm深 37孔无介防潮盖', qty: hingeQty, price: 0.128, cost: r2(hingeQty * 0.128) });

  // === 照明 ===
  // 数量逻辑: IF(OR(照明="无",E3="g"),0,2.2) 对于灯槽和灯带
  // 变压器/感应器数量: IF(OR(照明="无",E3="g"),0,1)
  var lightQty = (lighting === '无' || type === 'g') ? 0 : 2.2;
  var lightDeviceQty = (lighting === '无' || type === 'g') ? 0 : 1;
  var lightPrices = (hwBrand === '海外品牌') ? LIGHTING_PRICES_OVERSEAS : LIGHTING_PRICES_CN;
  // 灯槽
  items.push({ category: '照明', name: lightPrices[0].name, qty: lightQty, price: lightPrices[0].price, cost: r2(lightQty * lightPrices[0].price) });
  // 灯带
  items.push({ category: '照明', name: lightPrices[1].name, qty: lightQty, price: lightPrices[1].price, cost: r2(lightQty * lightPrices[1].price) });
  // 变压器
  items.push({ category: '照明', name: lightPrices[2].name, qty: lightDeviceQty, price: lightPrices[2].price, cost: r2(lightDeviceQty * lightPrices[2].price) });
  // 感应器
  items.push({ category: '照明', name: lightPrices[3].name, qty: lightDeviceQty, price: lightPrices[3].price, cost: r2(lightDeviceQty * lightPrices[3].price) });

  // 照明辅料: PVC线槽 & 散热胶
  var lightAuxQty = (lighting === '无' || type === 'g') ? 0 : (w <= 60 ? 1.1 : 1.65);
  items.push({ category: '照明', name: '12mm×7mm 数据线/光纤PVC方形线槽', qty: lightAuxQty, price: r2(14 / 5), cost: r2(lightAuxQty * 14 / 5) });
  items.push({ category: '照明', name: '9mm宽×0.3mm厚 导热散热双面胶', qty: lightAuxQty, price: r2(7.92 / 10), cost: r2(lightAuxQty * 7.92 / 10) });
  // 折叠拉手（检修口用）
  var handleQty = (type === 'g' || lighting === '无') ? 0 : 1;
  items.push({ category: '照明', name: '6mm穿透折叠拉手（检修口用）', qty: handleQty, price: 7.67, cost: r2(handleQty * 7.67) });

  // === 挂衣杆 ===
  // 杆长: IF(g,0, IF(a,(G3-4.9)*2, IF(b/c/d, G3-4.9, 0)))
  var rodLength = 0;
  if (type === 'a') rodLength = (w - 4.9) * 2;
  else if (type === 'b' || type === 'c' || type === 'd') rodLength = w - 4.9;
  // g型=0

  var rodPrices = ROD_PRICES[hwBrand] || ROD_PRICES['中国品牌'];
  items.push({ category: '挂衣杆', name: rodPrices.rod.name, qty: r2(rodLength), price: rodPrices.rod.price, cost: r2(rodLength * rodPrices.rod.price) });

  // 法兰数量: IF(g,0, IF(a,2, IF(b/c/d,1, 0)))
  var flangeQty = 0;
  if (type === 'a') flangeQty = 2;
  else if (type === 'b' || type === 'c' || type === 'd') flangeQty = 1;

  items.push({ category: '挂衣杆', name: rodPrices.flange.name, qty: flangeQty, price: rodPrices.flange.price, cost: r2(flangeQty * rodPrices.flange.price) });

  // 挂衣杆辅料: 尼龙螺丝=法兰数*4, M4螺丝=同
  items.push({ category: '挂衣杆', name: 'Ø5mm×12mm 尼龙螺丝预埋颗粒', qty: flangeQty * 4, price: 0.141, cost: r2(flangeQty * 4 * 0.141) });
  items.push({ category: '挂衣杆', name: 'M4×16 深螺纹镀镍螺丝', qty: flangeQty * 4, price: r2(9.6 / 300), cost: r2(flangeQty * 4 * 9.6 / 300) });

  // === 抽屉 ===
  // 滑轨数量: IF(c,2,IF(d,3,0))
  var drawerSlideQty = 0;
  if (type === 'c') drawerSlideQty = 2;
  else if (type === 'd') drawerSlideQty = 3;

  items.push({ category: '抽屉', name: '海蒂诗 Quadro S全拉出阻尼滑轨 30KG 500mm /对', qty: drawerSlideQty, price: 60, cost: r2(drawerSlideQty * 60) });
  items.push({ category: '抽屉', name: 'Ø5mm×12mm 尼龙螺丝预埋颗粒', qty: drawerSlideQty * 8, price: 0.141, cost: r2(drawerSlideQty * 8 * 0.141) });
  items.push({ category: '抽屉', name: 'M4×16 深螺纹镀镍螺丝', qty: drawerSlideQty * 8, price: r2(9.6 / 300), cost: r2(drawerSlideQty * 8 * 9.6 / 300) });

  // 三合一: 数量=滑轨数*15
  var triPrices = TRI_CONNECT_PRICES[hwBrand] || TRI_CONNECT_PRICES['中国品牌'];
  items.push({ category: '抽屉', name: triPrices.name, qty: drawerSlideQty * 15, price: triPrices.price, cost: r2(drawerSlideQty * 15 * triPrices.price) });

  // === 其它 ===
  // 上翻门支臂: IF(AND(g型,h<=50), IF(w<=60,1,2), 0)
  var flapPrices = FLAP_PRICES[hwBrand] || FLAP_PRICES['中国品牌'];
  var flapQty = 0;
  if (type === 'g' && h <= 50) {
    flapQty = (w <= 60) ? 1 : 2;
  }
  items.push({ category: '其它', name: flapPrices.name, qty: flapQty, price: flapPrices.price, cost: r2(flapQty * flapPrices.price) });

  // 反弹器: 数量=IF(w<=60,1,2)
  var bouncePrices = BOUNCE_PRICES[hwBrand] || BOUNCE_PRICES['中国品牌'];
  var bounceQty = (w <= 60) ? 1 : 2;
  items.push({ category: '其它', name: bouncePrices.name, qty: bounceQty, price: bouncePrices.price, cost: r2(bounceQty * bouncePrices.price) });

  // 反弹器辅料: 尼龙螺丝=上翻门数*4, M4=同
  items.push({ category: '其它', name: 'Ø5mm×12mm 尼龙螺丝预埋颗粒', qty: flapQty * 4, price: 0.141, cost: r2(flapQty * 4 * 0.141) });
  items.push({ category: '其它', name: 'M4×16 深螺纹镀镍螺丝', qty: flapQty * 4, price: r2(9.6 / 300), cost: r2(flapQty * 4 * 9.6 / 300) });

  // 静音胶粒: 数量=IF(w<=60,2,4)
  var silentQty = (w <= 60) ? 2 : 4;
  items.push({ category: '其它', name: 'Ø5mm×6mm深 静音胶粒', qty: silentQty, price: r2(5.5 / 100), cost: r2(silentQty * 5.5 / 100) });

  // 免钉胶: 数量=静音胶粒*0.05
  var glueQty = r2(silentQty * 0.05);
  items.push({ category: '其它', name: '立邦MS免钉胶 50g', qty: glueQty, price: 15.9, cost: r2(glueQty * 15.9) });

  // 二合一连接件: 数量=IF(g型,0,2)
  var biConnQty = (type === 'g') ? 0 : 2;
  items.push({ category: '其它', name: '隐形二合一连接件（34mm自攻款）', qty: biConnQty, price: r2(8.8 / 50), cost: r2(biConnQty * 8.8 / 50) });

  // 防尘胶条: 数量=IF(g型,0,G3/100)
  var dustQty = (type === 'g') ? 0 : r2(w / 100);
  items.push({ category: '其它', name: 'T型-151 地面防尘胶条', qty: dustQty, price: 2, cost: r2(dustQty * 2) });

  // 计算总五金费用
  var totalHwCost = 0;
  for (var i = 0; i < items.length; i++) {
    totalHwCost += items[i].cost;
  }

  return {
    items: items,
    total: r2(totalHwCost)
  };
}

/**
 * 计算转角柜的成本
 * 转角柜由 a-100-230 和 a-50-230 两个子模块组成
 * 加高部分由 g-50-{gapH} 和 g-100-{gapH} 组成
 */
function calcCornerCost(position, gapH, boardPrice, doorSurcharge, craftSurcharge, hwBrand, lighting) {
  // 转角柜下模块: a-100-230 + a-50-230
  var sub1 = { type: 'a', width: 100, height: 230, isStandard: true, isCustom: false };
  var sub2 = { type: 'a', width: 50, height: 230, isStandard: true, isCustom: false };

  var board1 = calcBoardCost(sub1, boardPrice, doorSurcharge, craftSurcharge, lighting);
  var hw1 = calcHardwareCost(sub1, hwBrand, lighting);
  var board2 = calcBoardCost(sub2, boardPrice, doorSurcharge, craftSurcharge, lighting);
  var hw2 = calcHardwareCost(sub2, hwBrand, lighting);

  // 合并板材明细
  var mergedBoardDetails = [];
  for (var i = 0; i < board1.details.length; i++) {
    var d1 = board1.details[i];
    var d2 = board2.details[i];
    mergedBoardDetails.push({
      name: d1.name,
      l: d1.l + ' / ' + d2.l,
      w: d1.w + ' / ' + d2.w,
      thick: d1.thick,
      qty: d1.qty + d2.qty,
      area: r2(d1.area + d2.area),
      unitPrice: d1.unitPrice,
      cost: r2(d1.cost + d2.cost),
      sumProd: d1.sumProd + d2.sumProd
    });
  }

  // 合并五金明细
  var mergedHwItems = [];
  for (var j = 0; j < hw1.items.length; j++) {
    var h1 = hw1.items[j];
    var h2 = hw2.items[j];
    mergedHwItems.push({
      category: h1.category,
      name: h1.name,
      qty: r2(h1.qty + h2.qty),
      price: h1.price,
      cost: r2(h1.cost + h2.cost)
    });
  }

  var totalBoardCost = r2(board1.total + board2.total);
  var totalHwCost = r2(hw1.total + hw2.total);
  var sumQtyArea = board1.sumQtyArea + board2.sumQtyArea;
  var shipping = r2(sumQtyArea * 15);
  var installation = r2(sumQtyArea * 20);
  var totalCost = r2(totalBoardCost + totalHwCost + shipping + installation);

  var result = {
    lower: {
      name: position + '下1',
      type: 'z',
      width: 110,
      height: 230,
      isCustom: false,
      thumb: assets.picture('z/z-110-230'),
      boardCost: totalBoardCost,
      hardwareCost: totalHwCost,
      shipping: shipping,
      installation: installation,
      totalCost: totalCost,
      boardDetail: mergedBoardDetails,
      hardwareDetail: mergedHwItems
    }
  };

  // 如果有加高区域，计算转角柜加高模块成本
  if (gapH > 0) {
    var gSub1 = { type: 'g', width: 100, height: gapH, isStandard: true, isCustom: false };
    var gSub2 = { type: 'g', width: 50, height: gapH, isStandard: true, isCustom: false };

    var gBoard1 = calcBoardCost(gSub1, boardPrice, doorSurcharge, craftSurcharge, lighting);
    var gHw1 = calcHardwareCost(gSub1, hwBrand, lighting);
    var gBoard2 = calcBoardCost(gSub2, boardPrice, doorSurcharge, craftSurcharge, lighting);
    var gHw2 = calcHardwareCost(gSub2, hwBrand, lighting);

    var gMergedBoardDetails = [];
    for (var gi = 0; gi < gBoard1.details.length; gi++) {
      var gd1 = gBoard1.details[gi];
      var gd2 = gBoard2.details[gi];
      gMergedBoardDetails.push({
        name: gd1.name,
        l: gd1.l + ' / ' + gd2.l,
        w: gd1.w + ' / ' + gd2.w,
        thick: gd1.thick,
        qty: gd1.qty + gd2.qty,
        area: r2(gd1.area + gd2.area),
        unitPrice: gd1.unitPrice,
        cost: r2(gd1.cost + gd2.cost),
        sumProd: gd1.sumProd + gd2.sumProd
      });
    }

    var gMergedHwItems = [];
    for (var gj = 0; gj < gHw1.items.length; gj++) {
      var gh1 = gHw1.items[gj];
      var gh2 = gHw2.items[gj];
      gMergedHwItems.push({
        category: gh1.category,
        name: gh1.name,
        qty: r2(gh1.qty + gh2.qty),
        price: gh1.price,
        cost: r2(gh1.cost + gh2.cost)
      });
    }

    var gTotalBoardCost = r2(gBoard1.total + gBoard2.total);
    var gTotalHwCost = r2(gHw1.total + gHw2.total);
    var gSumQtyArea = gBoard1.sumQtyArea + gBoard2.sumQtyArea;
    var gShipping = r2(gSumQtyArea * 15);
    var gInstallation = r2(gSumQtyArea * 20);
    var gTotalCost = r2(gTotalBoardCost + gTotalHwCost + gShipping + gInstallation);

    result.upper = {
      name: position + '上1',
      type: 'g',
      width: 110,
      height: gapH,
      isCustom: false,
      thumb: assets.picture('z/zg-110-' + gapH),
      boardCost: gTotalBoardCost,
      hardwareCost: gTotalHwCost,
      shipping: gShipping,
      installation: gInstallation,
      totalCost: gTotalCost,
      boardDetail: gMergedBoardDetails,
      hardwareDetail: gMergedHwItems
    };
  }

  return result;
}

/**
 * 计算全部模块的总成本
 */
function calcTotalCost(design, config) {
  var boardPrice = BOARD_PRICES[config.board] || 80;
  var doorSurcharge = DOOR_MATERIAL_SURCHARGE[config.doorMaterial] || 0;
  var craftSurcharge = DOOR_CRAFT_SURCHARGE[config.doorCraft] || 0;
  var hwBrand = config.hardware || '中国品牌';
  var lighting = config.lighting || '无';

  var modules = design.modules || [];
  // autoFilled 模块（trailing gap-fill）实际 width 小于 100，但按 100 系列标准件计价
  var modulesForCost = modules.map(function(m) {
    if (m && m.autoFilled) {
      return Object.assign({}, m, { width: 100 });
    }
    return m;
  });
  var cornerType = design.cornerType || 'WZJ';
  var wallHeight = design.wallHeight || 260;
  var gapH = wallHeight - 230 - 2;
  if (gapH < 0) gapH = 0;

  var results = [];       // 成本列表（含上下层，用于详细成本展示）
  var thumbList = [];     // 缩略图列表（只含下层柜体，用于顶部缩略图区域）
  var totalBoard = 0;
  var totalHardware = 0;
  var totalShipping = 0;
  var totalInstallation = 0;

  // === 左转角柜 ===
  if (cornerType === 'ZZJ' || cornerType === 'ZYZJ') {
    var leftCorner = calcCornerCost('左', gapH, boardPrice, doorSurcharge, craftSurcharge, hwBrand, lighting);
    
    var lc = leftCorner.lower;
    lc.index = results.length + 1;
    results.push(lc);
    totalBoard += lc.boardCost;
    totalHardware += lc.hardwareCost;
    totalShipping += lc.shipping;
    totalInstallation += lc.installation;

    thumbList.push({
      index: thumbList.length + 1,
      thumb: lc.thumb,
      gapThumb: leftCorner.upper ? leftCorner.upper.thumb : '',
      hasGap: !!leftCorner.upper
    });

    if (leftCorner.upper) {
      var lu = leftCorner.upper;
      lu.index = results.length + 1;
      results.push(lu);
      totalBoard += lu.boardCost;
      totalHardware += lu.hardwareCost;
      totalShipping += lu.shipping;
      totalInstallation += lu.installation;
    }
  }

  // === 标准/非标模块 ===
  for (var i = 0; i < modulesForCost.length; i++) {
    var mod = modulesForCost[i];
    // 补充高度默认值
    if (!mod.height) mod.height = 230;

    var boardResult = calcBoardCost(mod, boardPrice, doorSurcharge, craftSurcharge, lighting);
    var hwResult = calcHardwareCost(mod, hwBrand, lighting);

    // 运费 = SUMPRODUCT(数量, 面积) * 15
    var shipping = r2(boardResult.sumQtyArea * 15);
    // 安装费 = SUMPRODUCT(数量, 面积) * 20
    var installation = r2(boardResult.sumQtyArea * 20);

    var moduleTotalCost = r2(boardResult.total + hwResult.total + shipping + installation);

    totalBoard += boardResult.total;
    totalHardware += hwResult.total;
    totalShipping += shipping;
    totalInstallation += installation;

    // 下层柜体编号
    var moduleNum = thumbList.length + 1;

    results.push({
      index: results.length + 1,
      name: '左下' + moduleNum,
      type: mod.type || 'a',
      width: mod.width,
      height: mod.height,
      isCustom: mod.isCustom || false,
      thumb: getModuleThumb(mod),
      boardCost: boardResult.total,
      hardwareCost: hwResult.total,
      shipping: shipping,
      installation: installation,
      totalCost: moduleTotalCost,
      boardDetail: boardResult.details,
      hardwareDetail: hwResult.items
    });

    // 如果该模块有加高区域，生成对应的 g 型上层模块
    var modGapH = mod.gapHeight || 0;

    // 缩略图配对：下层 + 上层（如果有加高）
    thumbList.push({
      index: moduleNum,
      thumb: getModuleThumb(mod),
      gapThumb: modGapH > 0 ? getGapModuleThumb(mod, modGapH) : '',
      hasGap: modGapH > 0
    });
    if (modGapH > 0) {
      var gMod = { type: 'g', width: mod.width, height: modGapH, isStandard: mod.isStandard, isCustom: mod.isCustom };
      var gBoardResult = calcBoardCost(gMod, boardPrice, doorSurcharge, craftSurcharge, lighting);
      var gHwResult = calcHardwareCost(gMod, hwBrand, lighting);
      var gShipping = r2(gBoardResult.sumQtyArea * 15);
      var gInstallation = r2(gBoardResult.sumQtyArea * 20);
      var gTotalCost = r2(gBoardResult.total + gHwResult.total + gShipping + gInstallation);

      totalBoard += gBoardResult.total;
      totalHardware += gHwResult.total;
      totalShipping += gShipping;
      totalInstallation += gInstallation;

      results.push({
        index: results.length + 1,
        name: '左上' + moduleNum,
        type: 'g',
        width: mod.width,
        height: modGapH,
        isCustom: mod.isCustom || false,
        thumb: getGapModuleThumb(mod, modGapH),
        boardCost: gBoardResult.total,
        hardwareCost: gHwResult.total,
        shipping: gShipping,
        installation: gInstallation,
        totalCost: gTotalCost,
        boardDetail: gBoardResult.details,
        hardwareDetail: gHwResult.items
      });
    }
  }

  // === 右转角柜 ===
  if (cornerType === 'YZJ' || cornerType === 'ZYZJ') {
    var rightCorner = calcCornerCost('右', gapH, boardPrice, doorSurcharge, craftSurcharge, hwBrand, lighting);
    
    var rc = rightCorner.lower;
    rc.index = results.length + 1;
    results.push(rc);
    totalBoard += rc.boardCost;
    totalHardware += rc.hardwareCost;
    totalShipping += rc.shipping;
    totalInstallation += rc.installation;

    thumbList.push({
      index: thumbList.length + 1,
      thumb: rc.thumb,
      gapThumb: rightCorner.upper ? rightCorner.upper.thumb : '',
      hasGap: !!rightCorner.upper
    });

    if (rightCorner.upper) {
      var ru = rightCorner.upper;
      ru.index = results.length + 1;
      results.push(ru);
      totalBoard += ru.boardCost;
      totalHardware += ru.hardwareCost;
      totalShipping += ru.shipping;
      totalInstallation += ru.installation;
    }
  }

  var grandTotal = r2(totalBoard + totalHardware + totalShipping + totalInstallation);

  return {
    modules: results,       // 成本列表（上下层都有）
    thumbModules: thumbList, // 缩略图列表（只有下层柜体）
    summary: {
      totalBoard: r2(totalBoard),
      totalHardware: r2(totalHardware),
      shipping: r2(totalShipping),
      installation: r2(totalInstallation),
      grandTotal: grandTotal
    }
  };
}

// ============ Page ============

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    // 设计数据
    designIndex: -1,
    designId: '',
    designName: '',
    designInfo: '',
    previewImage: '',  // 设计效果完整渲染图路径
    // 当前步骤: config(配置选择) / result(成本结果)
    step: 'config',
    // 配置选项
    board: 'E2国产板',
    doorMaterial: '柜体相同',
    doorCraft: '无',
    hardware: '中国品牌',
    lighting: '无',
    // 配置选项列表
    boardOptions: ['E2国产板', '兔宝宝', '克诺斯帮', '德国克诺斯邦', '爱格'],
    doorMaterialOptions: ['柜体相同', '钢琴烤漆', '肤感烤漆', '铝框AG玻璃', '实木贴皮', '橡胶实木', '白蜡实木'],
    doorCraftOptions: ['无', '骨骼线', '欧式', '格栅门'],
    hardwareOptions: ['中国品牌', '海外品牌'],
    lightingOptions: ['无', '国产', '进口'],
    // 计算结果
    costResult: null,
    expandedModule: -1,  // 展开明细的模块索引
    // 下载弹窗 + 百度网盘分享链接
    // 链接优先从云数据库 config 集合读取（onLoad 时覆盖），
    // 若云端未配置则用此处的兜底默认值，便于后续运营改链接而无需重新提审小程序
    showDownloadModal: false,
    downloadUrl: 'https://pan.baidu.com/s/14hTB_JKE53ABqnxqLSmKGQ?pwd=45q3'
  },

  onLoad: function(options) {
    // 优先使用云端可配置的下载链接（启动时 app.loadAppConfig 已拉取）
    var cloudUrl = app.globalData.appConfig && app.globalData.appConfig.downloadUrl;
    if (cloudUrl) {
      this.setData({ downloadUrl: cloudUrl });
    }
    // 获取系统信息
    try {
      var sysInfo = wx.getWindowInfo();
      var menuBtn = wx.getMenuButtonBoundingClientRect();
      var statusBarHeight = sysInfo.statusBarHeight || 20;
      var navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
      this.setData({ statusBarHeight: statusBarHeight, navBarHeight: navBarHeight });
    } catch (e) {
      this.setData({ statusBarHeight: 20, navBarHeight: 44 });
    }

    // 兼容：?id=<_id>（云数据库方案，推荐）；?index=<数字> 老的数组下标（保留兜底）
    // 调用方用 encodeURIComponent 编码过 id（pd2dList 桥接 id 含冒号），这里必须解码
    var designId = options.id ? decodeURIComponent(options.id) : '';
    var designIndex = options.index !== undefined ? parseInt(options.index) : -1;

    var self = this;
    var applyDesign = function(design, indexInList) {
      if (!design) {
        wx.showToast({ title: '设计数据不存在', icon: 'none' });
        return;
      }
      var modules = design.modules || [];
      // 预览图来源优先级：
      // 1) 全局内存 currentDesignPreview（刚从 layout 确认布局跳过来，最新最准）
      // 2) design.previewFileID（云存储 fileID，image 组件原生支持 cloud:// 协议）
      // 3) design.previewImage（老数据兜底）
      var previewImage = app.globalData.currentDesignPreview
        || design.previewFileID
        || design.previewImage
        || '';

      self.setData({
        designIndex: indexInList,
        designId: design._id || '',
        designName: design.name || '未命名',
        designInfo: '墙面 ' + design.wallWidth + '×' + design.wallHeight + 'cm · ' + modules.length + '个模块',
        previewImage: previewImage
      });
    };

    var designs = app.globalData.designs || [];

    if (designId) {
      // 先查内存缓存
      var hit = null;
      for (var i = 0; i < designs.length; i++) {
        if (designs[i]._id === designId) { hit = designs[i]; applyDesign(hit, i); break; }
      }
      // 缓存没命中：重新从云端拉一次（异地登录 / 缓存未刷新场景）
      if (!hit) {
        app.refreshDesigns().then(function(list) {
          for (var j = 0; j < list.length; j++) {
            if (list[j]._id === designId) { applyDesign(list[j], j); return; }
          }
          wx.showToast({ title: '设计数据不存在', icon: 'none' });
        });
      }
    } else if (designIndex >= 0 && designIndex < designs.length) {
      applyDesign(designs[designIndex], designIndex);
    } else {
      wx.showToast({ title: '设计数据不存在', icon: 'none' });
    }
  },

  goBack: function() {
    wx.navigateBack();
  },

  selectConfig: function(e) {
    var field = e.currentTarget.dataset.field;
    var value = e.currentTarget.dataset.value;
    var obj = {};
    obj[field] = value;
    this.setData(obj);
  },

  confirmConfig: function() {
    var designs = app.globalData.designs || [];
    // 优先按 _id 查，避免因列表刷新导致 designIndex 错位
    var design = null;
    if (this.data.designId) {
      for (var i = 0; i < designs.length; i++) {
        if (designs[i]._id === this.data.designId) { design = designs[i]; break; }
      }
    }
    if (!design) {
      design = designs[this.data.designIndex];
    }
    if (!design) {
      wx.showToast({ title: '未找到设计数据', icon: 'none' });
      return;
    }

    var config = {
      board: this.data.board,
      doorMaterial: this.data.doorMaterial,
      doorCraft: this.data.doorCraft,
      hardware: this.data.hardware,
      lighting: this.data.lighting
    };

    // 性能优化：同一设计+同一配置的计算结果做一次结果缓存，
    // 避免用户在 config ↔ result 之间反复切换时重复跑 N 个模块
    // × (calcBoardCost + calcHardwareCost) 的全量计算。
    var cacheKey = (design._id || '') + '|' + config.board + '|' + config.doorMaterial +
      '|' + config.doorCraft + '|' + config.hardware + '|' + config.lighting;
    var result;
    if (this._costCache && this._costCache.key === cacheKey) {
      result = this._costCache.result;
    } else {
      result = calcTotalCost(design, config);
      this._costCache = { key: cacheKey, result: result };
    }

    this.setData({
      step: 'result',
      costResult: result
    });
  },

  backToConfig: function() {
    this.setData({ step: 'config', costResult: null, expandedModule: -1 });
  },

  toggleModule: function(e) {
    var idx = e.currentTarget.dataset.index;
    this.setData({
      expandedModule: this.data.expandedModule === idx ? -1 : idx
    });
  },

  closeDetail: function() {
    this.setData({ expandedModule: -1 });
  },

  /**
   * 点击"一键下载"按钮：弹出链接展示弹窗
   * （不立即复制，用户在弹窗内确认后再点"一键复制"才真正写入剪贴板）
   */
  downloadReport: function() {
    this.setData({ showDownloadModal: true });
  },

  /**
   * 弹窗内"一键复制"：把百度网盘链接写入剪贴板
   */
  copyDownloadUrl: function() {
    var self = this;
    var url = this.data.downloadUrl;
    if (!url) {
      wx.showToast({ title: '链接不存在', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: url,
      success: function() {
        // 微信自带"内容已复制" toast 会先出现，这里再自定义一条更明确的提示
        wx.showToast({ title: '已复制，请到百度网盘粘贴', icon: 'none', duration: 2000 });
        self.setData({ showDownloadModal: false });
      },
      fail: function(err) {
        wx.showToast({ title: '复制失败，请重试', icon: 'none' });
        console.warn('[cost] setClipboardData fail:', err && err.errMsg);
      }
    });
  },

  closeDownloadModal: function() {
    this.setData({ showDownloadModal: false });
  },

  /** 转发到聊天 */
  onShareAppMessage: function(res) {
    return require('../../utils/share.js').onShare('cost', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../utils/share.js').onTimeline('cost', this);
  }
});
