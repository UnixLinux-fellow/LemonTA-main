/**
 * 透视投影工具模块
 * 提供单应性矩阵计算、点映射、四边形验证、分条透视渲染
 */

/**
 * DLT 算法：从 4 对对应点计算 3x3 单应性矩阵
 * @param {Array<{x:number,y:number}>} srcPoints - 源平面 4 点（墙面坐标）
 * @param {Array<{x:number,y:number}>} dstPoints - 目标平面 4 点（照片坐标）
 * @returns {Array<Array<number>>} 3x3 矩阵 [[a,b,c],[d,e,f],[g,h,1]]
 */
function computeHomography(srcPoints, dstPoints) {
  var A = [];
  for (var i = 0; i < 4; i++) {
    var sx = srcPoints[i].x;
    var sy = srcPoints[i].y;
    var dx = dstPoints[i].x;
    var dy = dstPoints[i].y;
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
  }

  var b = [];
  for (var j = 0; j < 4; j++) {
    b.push(dstPoints[j].x);
    b.push(dstPoints[j].y);
  }

  var n = 8;
  var augmented = [];
  for (var r = 0; r < n; r++) {
    augmented[r] = [];
    for (var c = 0; c < n; c++) {
      augmented[r][c] = A[r][c];
    }
    augmented[r][n] = b[r];
  }

  for (var col = 0; col < n; col++) {
    var maxRow = col;
    var maxVal = Math.abs(augmented[col][col]);
    for (var row = col + 1; row < n; row++) {
      var absVal = Math.abs(augmented[row][col]);
      if (absVal > maxVal) {
        maxVal = absVal;
        maxRow = row;
      }
    }
    if (maxRow !== col) {
      var tmp = augmented[col];
      augmented[col] = augmented[maxRow];
      augmented[maxRow] = tmp;
    }
    var pivot = augmented[col][col];
    if (Math.abs(pivot) < 1e-12) return null;
    for (var row2 = 0; row2 < n; row2++) {
      if (row2 === col) continue;
      var factor = augmented[row2][col] / pivot;
      for (var c2 = col; c2 <= n; c2++) {
        augmented[row2][c2] -= factor * augmented[col][c2];
      }
    }
  }

  var h = [];
  for (var k = 0; k < n; k++) {
    var piv = augmented[k][k];
    h[k] = Math.abs(piv) < 1e-12 ? 0 : augmented[k][n] / piv;
  }

  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1]
  ];
}

/**
 * 用单应性矩阵映射一个点
 * @param {Array<Array<number>>} H - 3x3 矩阵
 * @param {{x:number,y:number}} p - 输入点
 * @returns {{x:number,y:number}} 映射后的点
 */
function transformPoint(H, p) {
  var x = H[0][0] * p.x + H[0][1] * p.y + H[0][2];
  var y = H[1][0] * p.x + H[1][1] * p.y + H[1][2];
  var w = H[2][0] * p.x + H[2][1] * p.y + H[2][2];
  if (Math.abs(w) < 1e-10) w = 1e-10;
  return { x: x / w, y: y / w };
}

/**
 * 判断四边形是否为凸
 * @param {Array<{x:number,y:number}>} corners - 4 个角点（顺时针或逆时针）
 * @returns {boolean}
 */
function isConvexQuad(corners) {
  var signs = [];
  for (var i = 0; i < 4; i++) {
    var p0 = corners[i];
    var p1 = corners[(i + 1) % 4];
    var p2 = corners[(i + 2) % 4];
    var cross = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
    if (Math.abs(cross) > 1e-10) {
      signs.push(cross > 0);
    }
  }
  if (signs.length < 2) return true;
  var first = signs[0];
  for (var j = 1; j < signs.length; j++) {
    if (signs[j] !== first) return false;
  }
  return true;
}

/**
 * 在 Canvas 2D 上用分条法绘制透视图片
 * 将 img 的完整内容映射到目标四边形 quad 中
 * @param {CanvasRenderingContext2D} ctx
 * @param {Image} img - Canvas Image 对象
 * @param {Array<{x:number,y:number}>} quad - 目标四边形 4 角点 [TL, TR, BR, BL]
 * @param {number} numStrips - 分条数量（默认 150）
 */
function drawPerspectiveImage(ctx, img, quad, numStrips) {
  if (!img || !img.width || !img.height) return;
  var strips = numStrips || 150;
  var imgW = img.width;
  var imgH = img.height;

  var tl = quad[0], tr = quad[1], br = quad[2], bl = quad[3];

  for (var i = 0; i < strips; i++) {
    var tTop = i / strips;
    var tBot = (i + 1) / strips;

    var srcY = tTop * imgH;
    var srcH = (tBot - tTop) * imgH;

    // 左侧边插值：TL (顶部) → BL (底部)
    var leftTopX = tl.x + (bl.x - tl.x) * tTop;
    var leftTopY = tl.y + (bl.y - tl.y) * tTop;
    var leftBotX = tl.x + (bl.x - tl.x) * tBot;
    var leftBotY = tl.y + (bl.y - tl.y) * tBot;

    // 右侧边插值：TR (顶部) → BR (底部)
    var rightTopX = tr.x + (br.x - tr.x) * tTop;
    var rightTopY = tr.y + (br.y - tr.y) * tTop;
    var rightBotX = tr.x + (br.x - tr.x) * tBot;
    var rightBotY = tr.y + (br.y - tr.y) * tBot;

    var dstX = (leftTopX + leftBotX) / 2;
    var dstW = ((rightTopX + rightBotX) - (leftTopX + leftBotX)) / 2;
    var dstY = (leftTopY + rightTopY) / 2;
    var dstH = ((leftBotY + rightBotY) - (leftTopY + rightTopY)) / 2;

    if (dstW < 0.5 || dstH < 0.5) continue;

    try {
      ctx.drawImage(img, 0, srcY, imgW, srcH, dstX, dstY, dstW, dstH);
    } catch (e) {
      // 跳过绘制失败的条
    }
  }
}

module.exports = {
  computeHomography: computeHomography,
  transformPoint: transformPoint,
  isConvexQuad: isConvexQuad,
  drawPerspectiveImage: drawPerspectiveImage
};
