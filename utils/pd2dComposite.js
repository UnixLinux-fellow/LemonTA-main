/**
 * PD2D 合成预览图工具
 *
 * 把 pd2d 页面的 2d 照片画布与 webgl 衣柜叠加画布合并成一张 PNG。
 * 失败时 reject——上层用 catch 降级为不存合成图。
 *
 * 唯一导出：
 *   composePreview({ photoCanvas, overlayCanvas, width, height, dpr })
 *     return Promise<string>  // wxfile://temp_xxx 临时路径
 */

function composePreview(opts) {
  return new Promise(function(resolve, reject) {
    if (!opts || !opts.photoCanvas || !opts.overlayCanvas) {
      reject(new Error('composePreview: missing canvases'));
      return;
    }
    var w = opts.width;
    var h = opts.height;
    var dpr = opts.dpr || 2;
    if (!w || !h) {
      reject(new Error('composePreview: invalid size'));
      return;
    }
    var pxW = Math.round(w * dpr);
    var pxH = Math.round(h * dpr);

    var off;
    try {
      off = wx.createOffscreenCanvas({ type: '2d', width: pxW, height: pxH });
    } catch (e) {
      reject(e);
      return;
    }
    if (!off) {
      reject(new Error('composePreview: createOffscreenCanvas returned null'));
      return;
    }
    var ctx = off.getContext('2d');
    if (!ctx) {
      reject(new Error('composePreview: getContext failed'));
      return;
    }

    try {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, pxW, pxH);
      ctx.drawImage(opts.photoCanvas, 0, 0, pxW, pxH);
      ctx.drawImage(opts.overlayCanvas, 0, 0, pxW, pxH);
    } catch (e) {
      reject(e);
      return;
    }

    wx.canvasToTempFilePath({
      canvas: off,
      fileType: 'png',
      success: function(res) {
        if (res && res.tempFilePath) {
          resolve(res.tempFilePath);
        } else {
          reject(new Error('composePreview: empty tempFilePath'));
        }
      },
      fail: function(err) {
        reject(err || new Error('composePreview: canvasToTempFilePath failed'));
      }
    });
  });
}

module.exports = {
  composePreview: composePreview
};
