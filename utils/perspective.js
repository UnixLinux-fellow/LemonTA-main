/**
 * 透视几何工具模块
 *
 * 三点透视算法：从照片上的3个墙角锚点反推透视矩阵，实现照片→3D纹理的无畸变换。
 *
 * 核心算法：
 *   1. 四个点 → 单应矩阵 H (DLT直接线性变换)
 *   2. 逆单应 H⁻¹ → 透视图像变形（网格细分+仿射近似）
 *   3. 地板区域估算（基于背墙透视的深度外推）
 */

// ---- 第四点推导 (平行四边形近似) ----

function computeFourthPoint(p1, p2, p3) {
  // p1, p2, p3 分别是 BL, BR, TL
  // 第4点 TR = BR + TL - BL
  return {
    x: p2.x + p3.x - p1.x,
    y: p2.y + p3.y - p1.y
  };
}

// ---- 3×3 矩阵运算 ----

function det3x3(M) {
  return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
       - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
       + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
}

function invertMatrix3x3(M) {
  var det = det3x3(M);
  if (Math.abs(det) < 1e-12) return null;
  var invDet = 1 / det;
  return [
    [
      (M[1][1] * M[2][2] - M[1][2] * M[2][1]) * invDet,
      (M[0][2] * M[2][1] - M[0][1] * M[2][2]) * invDet,
      (M[0][1] * M[1][2] - M[0][2] * M[1][1]) * invDet
    ],
    [
      (M[1][2] * M[2][0] - M[1][0] * M[2][2]) * invDet,
      (M[0][0] * M[2][2] - M[0][2] * M[2][0]) * invDet,
      (M[0][2] * M[1][0] - M[0][0] * M[1][2]) * invDet
    ],
    [
      (M[1][0] * M[2][1] - M[1][1] * M[2][0]) * invDet,
      (M[0][1] * M[2][0] - M[0][0] * M[2][1]) * invDet,
      (M[0][0] * M[1][1] - M[0][1] * M[1][0]) * invDet
    ]
  ];
}

// ---- 高斯消元（解 8×8 线性系统） ----

function solveLinear8(M, b) {
  // 增广矩阵 [M|b] 8×9
  var n = 8;
  var A = [];
  for (var i = 0; i < n; i++) {
    A[i] = [];
    for (var j = 0; j < n; j++) A[i][j] = M[i][j];
    A[i][n] = b[i];
  }

  // 消元
  for (var col = 0; col < n; col++) {
    // 选主元
    var maxRow = col;
    var maxVal = Math.abs(A[col][col]);
    for (var row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > maxVal) {
        maxVal = Math.abs(A[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-14) return null;

    // 交换行
    if (maxRow !== col) {
      var tmp = A[col];
      A[col] = A[maxRow];
      A[maxRow] = tmp;
    }

    // 消去下方
    for (var row = col + 1; row < n; row++) {
      var factor = A[row][col] / A[col][col];
      for (var j = col; j <= n; j++) {
        A[row][j] -= factor * A[col][j];
      }
    }
  }

  // 回代
  var x = [];
  for (var i = n - 1; i >= 0; i--) {
    x[i] = A[i][n];
    for (var j = i + 1; j < n; j++) {
      x[i] -= A[i][j] * x[j];
    }
    x[i] /= A[i][i];
  }
  return x;
}

// ---- 单应矩阵计算 (4点 DLT) ----

function computeHomography(srcPts, dstPts) {
  // srcPts: [{x,y},...] 照片中的4个点
  // dstPts: [{x,y},...] 目标纹理中的4个点
  // 返回 3×3 单应矩阵 (行优先)

  var M = []; // 8×8
  var b = []; // 8×1

  for (var i = 0; i < 4; i++) {
    var x = srcPts[i].x;
    var y = srcPts[i].y;
    var u = dstPts[i].x;
    var v = dstPts[i].y;

    // 每个点贡献两行（设 h[8] = 1）
    var r1 = [-x, -y, -1, 0, 0, 0, x * u, y * u];
    var r2 = [0, 0, 0, -x, -y, -1, x * v, y * v];

    M.push(r1);
    b.push(-u);
    M.push(r2);
    b.push(-v);
  }

  var h8 = solveLinear8(M, b);
  if (!h8) return null;

  // h = [h0..h7, 1]
  return [
    [h8[0], h8[1], h8[2]],
    [h8[3], h8[4], h8[5]],
    [h8[6], h8[7], 1]
  ];
}

// ---- 单应变换 ----

function transformPoint(H, x, y) {
  var w = H[2][0] * x + H[2][1] * y + H[2][2];
  if (Math.abs(w) < 1e-10) w = 1e-10;
  return {
    x: (H[0][0] * x + H[0][1] * y + H[0][2]) / w,
    y: (H[1][0] * x + H[1][1] * y + H[1][2]) / w
  };
}

// ---- 透视图像变形（网格细分 + 仿射近似） ----

function warpPerspective(ctx, img, srcQuad, outW, outH) {
  // srcQuad: 照片中的4个源角点 [{x,y},...] 顺序: BL, BR, TR, TL
  // outW, outH: 输出纹理尺寸
  // 直接在 ctx 绑定的 canvas 上绘制

  if (outW <= 0 || outH <= 0) return false;

  var dstQuad = [
    { x: 0, y: outH },       // BL
    { x: outW, y: outH },    // BR
    { x: outW, y: 0 },       // TR
    { x: 0, y: 0 }           // TL
  ];

  var H = computeHomography(dstQuad, srcQuad); // 输出→源映射
  if (!H) return false;

  var invH = invertMatrix3x3(H);
  if (!invH) return false;

  // 先清空
  ctx.fillStyle = '#333333';
  ctx.fillRect(0, 0, outW, outH);

  // 网格细分
  var cellSize = 32;
  var cols = Math.ceil(outW / cellSize);
  var rows = Math.ceil(outH / cellSize);

  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var dx = c * cellSize;
      var dy = r * cellSize;
      var cw = Math.min(cellSize, outW - dx);
      var ch = Math.min(cellSize, outH - dy);
      if (cw <= 0 || ch <= 0) continue;

      // 该输出cell的4个角
      var corners = [
        transformPoint(invH, dx, dy + ch),     // 输出BL → 源
        transformPoint(invH, dx + cw, dy + ch), // 输出BR → 源
        transformPoint(invH, dx + cw, dy),      // 输出TR → 源
        transformPoint(invH, dx, dy)            // 输出TL → 源
      ];

      // 计算源四边形在照片中的包围盒
      var sxMin = Infinity, syMin = Infinity;
      var sxMax = -Infinity, syMax = -Infinity;
      for (var k = 0; k < 4; k++) {
        if (corners[k].x < sxMin) sxMin = corners[k].x;
        if (corners[k].x > sxMax) sxMax = corners[k].x;
        if (corners[k].y < syMin) syMin = corners[k].y;
        if (corners[k].y > syMax) syMax = corners[k].y;
      }

      var sx = Math.max(0, Math.floor(sxMin));
      var sy = Math.max(0, Math.floor(syMin));
      var sw = Math.ceil(sxMax) - sx;
      var sh = Math.ceil(syMax) - sy;

      if (sw > 0 && sh > 0 && sx < img.width && sy < img.height) {
        try {
          ctx.drawImage(img, sx, sy, sw, sh, dx, dy, cw, ch);
        } catch (e) {
          // 跳过越界绘制
        }
      }
    }
  }
  return true;
}

// ---- 地板区域估算 ----

function estimateFloorQuad(backWallQuad, photoW, photoH, roomDepthM, roomWidthM) {
  // backWallQuad: [BL, BR, TR, TL] 照片像素坐标
  // 返回地板在照片中的4个角 [BL, BR, TR, TL]（地面在前）

  var bl = backWallQuad[0];
  var br = backWallQuad[1];

  // 背墙底边
  var bottomY = Math.max(bl.y, br.y);

  // 深度方向：从顶边中点→底边中点的方向即Z轴在影像中的投影
  var tl = backWallQuad[3];
  var tr = backWallQuad[2];
  var topMidX = (tl.x + tr.x) / 2;
  var topMidY = (tl.y + tr.y) / 2;
  var botMidX = (bl.x + br.x) / 2;
  var botMidY = (bl.y + br.y) / 2;

  // 深度消失方向（向下延伸）
  var depthDx = botMidX - topMidX;
  var depthDy = botMidY - topMidY;
  var depthLen = Math.sqrt(depthDx * depthDx + depthDy * depthDy);
  if (depthLen < 1) { depthDx = 0; depthDy = 1; depthLen = 1; }
  depthDx /= depthLen;
  depthDy /= depthLen;

  // 估算相机到背墙的距离比例
  // 用背墙底边与照片底边的距离来估算
  var wallHeightInPhoto = Math.abs(bl.y - tl.y) + Math.abs(br.y - tr.y);
  var distToBottom = photoH - bottomY;
  var perspFactor = Math.max(0.3, Math.min(2.5, distToBottom / Math.max(wallHeightInPhoto * 0.5, 1)));

  // 地板深度在照片中的像素延伸量
  var depthPx = distToBottom * Math.min(1.0, roomDepthM / Math.max(roomWidthM * 0.8, 0.1));

  // 地板前边角（照片底部方向）
  var fbl_x = bl.x - perspFactor * depthDx * depthPx * 0.6;
  var fbl_y = Math.min(photoH, bottomY + depthDy * depthPx);
  var fbr_x = br.x + perspFactor * depthDx * depthPx * 0.6;
  var fbr_y = Math.min(photoH, bottomY + depthDy * depthPx);

  // 确保不超出照片边界
  fbl_x = Math.max(0, fbl_x);
  fbr_x = Math.min(photoW, fbr_x);
  fbl_y = Math.max(bottomY + 5, Math.min(photoH, fbl_y));
  fbr_y = Math.max(bottomY + 5, Math.min(photoH, fbr_y));

  return [
    { x: fbl_x, y: fbl_y },  // 地板前左 (BL)
    { x: fbr_x, y: fbr_y },  // 地板前右 (BR)
    { x: br.x, y: br.y },    // 地板后右 = 背墙底右 (TR)
    { x: bl.x, y: bl.y }     // 地板后左 = 背墙底左 (TL)
  ];
}

module.exports = {
  computeFourthPoint: computeFourthPoint,
  computeHomography: computeHomography,
  invertMatrix3x3: invertMatrix3x3,
  transformPoint: transformPoint,
  warpPerspective: warpPerspective,
  estimateFloorQuad: estimateFloorQuad
};
