/**
 * Photo display geometry — pure functions for unit testing.
 *
 * computePhotoAreaHeight: choose the photo area's CSS height in px so it
 *   matches the photo's natural aspect when possible, clamped to [minVh, maxVh].
 *
 * computeContainRect: place the photo inside a (canvasW × canvasH) viewport
 *   without distortion, centered, with letterbox bars when aspect mismatches.
 */
function computePhotoAreaHeight(imgW, imgH, screenW, screenH, minVh, maxVh) {
  var w = imgW > 0 ? imgW : 1;
  var h = imgH > 0 ? imgH : 1;
  var aspect = w / h;
  var targetH = screenW / aspect;
  var minH = screenH * minVh;
  var maxH = screenH * maxVh;
  if (minH > maxH) { var t = minH; minH = maxH; maxH = t; }
  return Math.max(minH, Math.min(maxH, targetH));
}

function computeContainRect(imgW, imgH, canvasW, canvasH) {
  var iw = imgW > 0 ? imgW : 1;
  var ih = imgH > 0 ? imgH : 1;
  var cw = canvasW > 0 ? canvasW : 1;
  var ch = canvasH > 0 ? canvasH : 1;
  var imgA = iw / ih;
  var canvasA = cw / ch;
  var x, y, w, h;
  if (imgA > canvasA) {
    w = cw;
    h = cw / imgA;
    x = 0;
    y = (ch - h) / 2;
  } else {
    h = ch;
    w = ch * imgA;
    y = 0;
    x = (cw - w) / 2;
  }
  return { x: x, y: y, w: w, h: h };
}

function computeInsetContainRect(imgW, imgH, canvasW, canvasH, margin) {
  var m = margin > 0 ? margin : 0;
  var innerW = canvasW - 2 * m;
  var innerH = canvasH - 2 * m;
  if (innerW <= 0 || innerH <= 0) {
    return { x: canvasW / 2, y: canvasH / 2, w: 0, h: 0 };
  }
  var inner = computeContainRect(imgW, imgH, innerW, innerH);
  return { x: inner.x + m, y: inner.y + m, w: inner.w, h: inner.h };
}

module.exports = {
  computePhotoAreaHeight: computePhotoAreaHeight,
  computeContainRect: computeContainRect,
  computeInsetContainRect: computeInsetContainRect
};
