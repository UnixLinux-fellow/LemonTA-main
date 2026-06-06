/**
 * 布局计算公共模块
 * layout.js 和 glbviewer/space-mode 共用
 */

/**
 * 计算布局核心参数
 * @param {number} wallWidth - 墙宽 (cm)
 * @param {string} cornerType - WZJ|ZZJ|YZJ|ZYZJ
 * @returns {{ standardWidth: number, customWidth: number, cornerCount: number }}
 */
function computeParams(wallWidth, cornerType) {
  var w = wallWidth;
  var cornerCount = cornerType === 'ZYZJ' ? 2 : (cornerType === 'WZJ' ? 0 : 1);

  var minX = w - 124 - (cornerCount * 110);
  var maxX = w - 44 - (cornerCount * 110);

  var standardWidth = 0;
  for (var x = Math.ceil(minX / 50) * 50; x <= maxX; x += 50) {
    if (x >= minX && x <= maxX) {
      standardWidth = x;
      break;
    }
  }
  if (standardWidth < 50) standardWidth = 50;

  var customWidth = w - 4 - (cornerCount * 110) - standardWidth;

  return {
    standardWidth: standardWidth,
    customWidth: customWidth,
    cornerCount: cornerCount
  };
}

/**
 * 自动填充推荐模块列表
 * 优先用 100cm 填 standardWidth，余数用 50cm
 * @param {number} standardWidth
 * @param {number} customWidth
 * @param {number} cornerCount - 0|1|2
 * @param {string} cornerType - WZJ|ZZJ|YZJ|ZYZJ
 * @returns {Array<{width: number, type: string, isCorner?: boolean, isCustom?: boolean}>}
 */
function autoFill(standardWidth, customWidth, cornerCount, cornerType) {
  var modules = [];
  var hasLeftCorner = (cornerType === 'ZZJ' || cornerType === 'ZYZJ');
  var hasRightCorner = (cornerType === 'YZJ' || cornerType === 'ZYZJ');

  // 左转角柜（ZZJ / ZYZJ）
  if (hasLeftCorner) {
    modules.push({ width: 110, type: 'a', isCorner: true });
  }

  // 标准模块：优先 100cm
  var remaining = standardWidth;
  while (remaining >= 100) {
    modules.push({ width: 100, type: 'a', isCorner: false });
    remaining -= 100;
  }
  if (remaining >= 50) {
    modules.push({ width: 50, type: 'a', isCorner: false });
    remaining -= 50;
  }

  // 非标模块
  if (customWidth >= 45) {
    modules.push({ width: customWidth, type: 'a', isCustom: true });
  }

  // 右转角柜（YZJ / ZYZJ）
  if (hasRightCorner) {
    modules.push({ width: 110, type: 'a', isCorner: true });
  }

  return modules;
}

/**
 * 获取最接近的可用非标宽度
 * @param {number} w
 * @returns {number}
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
 * 获取当前宽度下可选模块列表
 * @param {number} selectedWidth - 50|100 或其他
 * @param {number} customWidth
 * @param {boolean} isCustomModule
 * @param {function} pictureFn - assets.picture 函数引用
 * @returns {Array<{type: string, label: string, image: string}>}
 */
function getAvailableModules(selectedWidth, customWidth, isCustomModule, pictureFn) {
  var modules = [];
  if (isCustomModule) {
    var ew = getNearestEWidth(customWidth);
    modules = [
      { type: 'a', label: 'A型', image: pictureFn('e/a-' + ew + '-230') },
      { type: 'b', label: 'B型', image: pictureFn('e/b-' + ew + '-230') },
      { type: 'c', label: 'C型', image: pictureFn('e/c-' + ew + '-230') },
      { type: 'd', label: 'D型', image: pictureFn('e/d-' + ew + '-230') }
    ];
  } else {
    var w = selectedWidth;
    modules = [
      { type: 'a', label: 'A型', image: pictureFn(w + '/a-' + w + '-230') },
      { type: 'b', label: 'B型', image: pictureFn(w + '/b-' + w + '-230') },
      { type: 'c', label: 'C型', image: pictureFn(w + '/c-' + w + '-230') },
      { type: 'd', label: 'D型', image: pictureFn(w + '/d-' + w + '-230') }
    ];
  }
  return modules;
}

module.exports = {
  computeParams: computeParams,
  autoFill: autoFill,
  getNearestEWidth: getNearestEWidth,
  getAvailableModules: getAvailableModules
};
