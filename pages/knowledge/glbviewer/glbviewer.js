var app = getApp();
var layoutCompute = require('../../../utils/layoutCompute.js');
var assets = require('../../../utils/assets.js');

function formatSize(bytes) {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '';
  if (bytesPerSec < 1024) return bytesPerSec.toFixed(0) + ' B/s';
  if (bytesPerSec < 1024 * 1024) return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
  return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
}

Page({
  _downloadTask: null,
  _progressStart: 0,
  _lastDownloaded: 0,
  _speedSamples: [],

  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    glbUrl: '',
    loadStage: 'idle',
    progressPercent: 0,
    downloadedSize: '',
    totalSize: '',
    downloadSpeed: '',
    fileName: '',
    hasError: false,
    errorMsg: '',
    showUrlInput: false,
    inputUrl: '',

    mode: 'glb',
    photoPath: '',
    photoWidth: 0,
    photoHeight: 0,
    markers: [],
    wallWidth: '1300',
    wallHeight: '2500',
    roomDepth: '550',
    cornerType: 'none',
    draggingIndex: -1,

    spaceStage: 'marking',
    wallWidthNum: 0,
    wallHeightNum: 0,
    customWidth: 0,
    layoutModules: [],
    availableModules: [],
    availableModulesCustom: [],
    selectedWidth: 50,
    selectedType: 'a',
    selectedColor: 'white',
    isCustomModule: false,
    selectedModuleIndex: -1,

    modelList: [],
    // GLB scale controls
    scaleMode: 'uniform',
    uniformScalePercent: 100,
    uniformScaleText: '1.00x',
    axisMin: { x: 30, y: 30, z: 30 },
    axisMax: { x: 300, y: 300, z: 300 },
    axisValue: { x: 100, y: 100, z: 100 },
    axisDisplay: { x: '0cm', y: '0cm', z: '0cm' },
    origSizeCm: { x: 0, y: 0, z: 0 },
  },

  onLoad: function(options) {
    this.setData({ modelList: assets.modelCatalog() });
    try {
      var sysInfo = wx.getWindowInfo();
      var menuBtn = wx.getMenuButtonBoundingClientRect();
      var statusBarHeight = sysInfo.statusBarHeight || 20;
      var navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
      this.setData({ statusBarHeight: statusBarHeight, navBarHeight: navBarHeight });
    } catch (e) {
      this.setData({ statusBarHeight: 20, navBarHeight: 44 });
    }

    if (options.url) {
      this._loadGlb(decodeURIComponent(options.url), '');
    }
  },

  onUnload: function() {
    this._abortDownload();
    if (this._glbManager) {
      try { this._glbManager.dispose(); } catch (e) {}
      this._glbManager = null;
      this._glbTHREE = null;
    }
    if (this._sceneManager) {
      try { this._sceneManager.dispose(); } catch (e) {}
      this._sceneManager = null;
      this._THREE = null;
    }
  },

  _abortDownload: function() {
    if (this._downloadTask) {
      try { this._downloadTask.abort(); } catch (e) {}
      this._downloadTask = null;
    }
  },

  startSpaceMode: function() {
    var self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        var tempPath = res.tempFiles[0].tempFilePath;
        self.setData({
          mode: 'space',
          spaceStage: 'marking',
          photoPath: tempPath,
          markers: [],
          wallWidth: '1300',
          wallHeight: '2500',
          cornerType: 'none',
          draggingIndex: -1,
          glbUrl: ''
        });
      }
    });
  },

  onPhotoLoad: function(e) {
    this.setData({
      photoWidth: e.detail.width,
      photoHeight: e.detail.height
    });
  },

  reselectPhoto: function() {
    this.startSpaceMode();
  },

  resetMarkers: function() {
    this.setData({ markers: [], cornerType: 'none' });
  },

  confirmSpace: function() {
    var markers = this.data.markers;
    if (markers.length < 3) {
      wx.showToast({ title: '请标记至少3个墙角', icon: 'none' });
      return;
    }

    var wallWidth = parseInt(this.data.wallWidth);
    var wallHeight = parseInt(this.data.wallHeight);
    var roomDepth = parseInt(this.data.roomDepth);

    if (!wallWidth || wallWidth < 80) {
      wx.showToast({ title: '墙宽需 >= 80mm', icon: 'none' });
      return;
    }
    if (wallWidth > 10000) {
      wx.showToast({ title: '墙宽需 <= 10000mm', icon: 'none' });
      return;
    }
    if (!wallHeight || wallHeight < 1000) {
      wx.showToast({ title: '墙高需 >= 1000mm', icon: 'none' });
      return;
    }
    if (wallHeight > 10000) {
      wx.showToast({ title: '墙高需 <= 10000mm', icon: 'none' });
      return;
    }
    if (!roomDepth || roomDepth < 150) {
      wx.showToast({ title: '进深需 >= 150mm', icon: 'none' });
      return;
    }
    if (roomDepth > 1000) {
      wx.showToast({ title: '进深需 <= 1000mm', icon: 'none' });
      return;
    }

    var cornerMap = { none: 'WZJ', left: 'ZZJ', right: 'YZJ', both: 'ZYZJ' };
    var cornerType = cornerMap[this.data.cornerType] || 'WZJ';

    var wallWidthCm = Math.round(wallWidth / 10);
    var params = layoutCompute.computeParams(wallWidthCm, cornerType);
    var availStd = layoutCompute.getAvailableModules(50, params.customWidth, false, assets.picture);
    var availCustom = layoutCompute.getAvailableModules(50, params.customWidth, true, assets.picture);

    var firstWidth = wallWidthCm >= 50 ? 50 : (wallWidthCm - 4);
    var firstIsCustom = wallWidthCm < 50;
    var firstModule = { width: firstWidth, type: 'a', color: 'white', isCustom: firstIsCustom };
    this.setData({
      mode: 'space3d',
      wallWidthNum: wallWidth,
      wallHeightNum: wallHeight,
      roomDepthNum: roomDepth,
      standardWidth: params.standardWidth,
      customWidth: params.customWidth,
      layoutModules: [firstModule],
      availableModules: availStd,
      availableModulesCustom: availCustom,
      selectedModuleIndex: 0,
      selectedWidth: 50,
      selectedType: 'a',
      selectedColor: 'white',
      isCustomModule: false
    });

    var self = this;
    self._space3dRetry = 0;
    setTimeout(function() { self._initSpace3d(); }, 500);
  },

  // ===== Photo + Cabinet Overlay Canvas (2D API) =====

  _initPhotoLayoutCanvas: function() {
    var self = this;
    var query = wx.createSelectorQuery().in(this);
    query.select('#photoLayoutCanvas')
      .fields({ node: true, size: true })
      .exec(function(res) {
        if (!res || !res[0] || !res[0].node) {
          if (self._layoutCanvasRetry >= 4) return;
          self._layoutCanvasRetry = (self._layoutCanvasRetry || 0) + 1;
          setTimeout(function() { self._initPhotoLayoutCanvas(); }, 250);
          return;
        }
        var canvas = res[0].node;
        var ctx = canvas.getContext('2d');
        var dpr = 1;
        try { dpr = wx.getWindowInfo().pixelRatio || 2; } catch(e) {}

        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        self._layoutCanvas = canvas;
        self._layoutCtx = ctx;
        self._layoutCw = res[0].width;
        self._layoutCh = res[0].height;

        self._loadPhotoImage();
      });
  },

  _loadPhotoImage: function() {
    var self = this;
    var img = self._layoutCanvas.createImage();
    img.onload = function() {
      self._photoImg = img;
      self._renderPhotoLayout();
    };
    img.onerror = function() {
      self._photoImg = null;
      self._renderPhotoLayout();
    };
    img.src = self.data.photoPath;
  },

  _renderPhotoLayout: function() {
    var ctx = this._layoutCtx;
    var cw = this._layoutCw;
    var ch = this._layoutCh;
    if (!ctx) return;

    ctx.clearRect(0, 0, cw, ch);

    // 1. Draw photo as background (aspectFit)
    var photoRect = null;
    if (this._photoImg) {
      var iw = this._photoImg.width;
      var ih = this._photoImg.height;
      var s = Math.min(cw / iw, ch / ih);
      var dw = iw * s;
      var dh = ih * s;
      var dx = (cw - dw) / 2;
      var dy = (ch - dh) / 2;
      ctx.drawImage(this._photoImg, dx, dy, dw, dh);
      photoRect = { x: dx, y: dy, w: dw, h: dh };
    } else {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, cw, ch);
    }

    // 2. Calculate wall region from markers
    var wall = this._calcWallRegion(photoRect);
    if (!wall) return;
    this._wallRegion = wall;

    // 3. Draw wall highlight
    ctx.fillStyle = 'rgba(252, 151, 0, 0.10)';
    ctx.fillRect(wall.left, wall.top, wall.width, wall.height);
    ctx.strokeStyle = 'rgba(252, 151, 0, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(wall.left, wall.top, wall.width, wall.height);
    ctx.setLineDash([]);

    // Wall dimension label
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      this.data.wallWidthNum + ' x ' + this.data.wallHeightNum + ' mm',
      wall.left + wall.width / 2,
      Math.max(wall.top - 6, 12)
    );
    ctx.textAlign = 'start';

    // 4. Draw floor shadow line
    ctx.strokeStyle = 'rgba(0,0,0,0.30)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wall.left, wall.bottom);
    ctx.lineTo(wall.right, wall.bottom);
    ctx.stroke();

    // 5. Draw cabinets
    this._drawCabinetsOnWall(ctx, wall);
  },

  _calcWallRegion: function(photoRect) {
    var markers = this.data.markers;
    if (!photoRect || markers.length < 2) return null;

    var pts = [];
    for (var i = 0; i < markers.length; i++) {
      pts.push({
        x: photoRect.x + markers[i].x * photoRect.w,
        y: photoRect.y + markers[i].y * photoRect.h
      });
    }
    pts.sort(function(a, b) { return a.x - b.x; });

    var wallW = this.data.wallWidthNum;
    var wallH = this.data.wallHeightNum;

    var left = pts[0].x;
    var right = pts[pts.length - 1].x;
    var wallPxW = right - left;
    if (wallPxW < 40) wallPxW = 40;

    var avgY = 0;
    for (var j = 0; j < pts.length; j++) avgY += pts[j].y;
    avgY /= pts.length;

    var wallPxH = wallPxW * (wallH / wallW);
    var top = Math.max(photoRect.y, avgY - wallPxH);
    var actualPxH = avgY - top;

    return {
      left: left,
      right: right,
      bottom: avgY,
      top: top,
      width: wallPxW,
      height: actualPxH,
      scale: wallPxW / wallW
    };
  },

  _drawCabinetsOnWall: function(ctx, wall) {
    var modules = this.data.layoutModules;
    var selectedIdx = this.data.selectedModuleIndex;
    var scale = wall.scale;

    var cx = wall.left;
    var cabH = 230 * scale;
    var cabY = wall.bottom - cabH;
    if (cabY < wall.top) cabY = wall.top;

    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      var cw = m.width * scale;
      var isSelected = (i === selectedIdx);
      this._drawOneCabinet(ctx, m, cx, cabY, cw, cabH, isSelected);
      cx += cw;
    }

    // Remaining space
    var endX = wall.left + wall.width;
    if (cx < endX - 2) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.20)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx, cabY, endX - cx, cabH);
      ctx.setLineDash([]);
    }
  },

  _drawOneCabinet: function(ctx, m, x, y, w, h, isSelected) {
    if (w < 2) return;

    // Fill color
    if (m.isCorner) {
      ctx.fillStyle = 'rgba(252, 151, 0, 0.40)';
    } else if (m.color === 'cream') {
      ctx.fillStyle = 'rgba(255, 248, 220, 0.38)';
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    }
    ctx.fillRect(x, y, w, h);

    // Border
    ctx.strokeStyle = isSelected ? '#FC9700' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = isSelected ? 2.5 : 1;
    ctx.strokeRect(x, y, w, h);

    // Label
    var label = m.isCorner ? '转角' : (m.width + '' + (m.type || 'A').toUpperCase());
    var fontSize = w > 35 ? 11 : (w > 20 ? 9 : 7);
    ctx.fillStyle = '#fff';
    ctx.font = fontSize + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h / 2 + fontSize / 3);
    ctx.textAlign = 'start';

    // Crosshatch for custom
    if (m.isCustom && w > 18) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.5;
      for (var d = 0; d < w; d += 7) {
        ctx.beginPath();
        ctx.moveTo(x + d, y);
        ctx.lineTo(x + d + 4, y + h);
        ctx.stroke();
      }
    }
  },

  // ===== Photo Canvas Touch Handlers =====

  onPhotoLayoutTap: function(e) {
    var self = this;
    var wall = self._wallRegion;
    if (!wall) return;

    var x = e.detail.x;
    var y = e.detail.y;
    var modules = self.data.layoutModules.slice();
    var scale = wall.scale;

    // Only respond to taps within wall area
    if (x < wall.left - 10 || x > wall.right + 10 ||
        y < wall.top - 10 || y > wall.bottom + 10) return;

    var relX = x - wall.left;
    var posCm = relX / scale;

    // Find tapped cabinet
    var accCm = 0;
    var hitIdx = -1;
    for (var i = 0; i < modules.length; i++) {
      var mEnd = accCm + modules[i].width;
      if (posCm >= accCm && posCm <= mEnd) {
        hitIdx = i;
        break;
      }
      accCm = mEnd;
    }

    if (hitIdx >= 0) {
      var m = modules[hitIdx];
      self.setData({
        selectedModuleIndex: hitIdx,
        selectedWidth: m.isCorner ? 50 : m.width,
        selectedType: m.isCorner ? 'a' : (m.type || 'a'),
        selectedColor: m.color || 'white',
        isCustomModule: !!m.isCustom
      });
      self._renderPhotoLayout();
      return;
    }

    // Add new cabinet
    var newW = self.data.selectedWidth;
    if (!newW) newW = 50;

    var totalW = 0;
    for (var j = 0; j < modules.length; j++) totalW += modules[j].width;
    if ((totalW + newW) * 10 > self.data.wallWidthNum) {
      wx.showToast({ title: '空间不足', icon: 'none' });
      return;
    }

    var insertIdx = modules.length;
    var acc = 0;
    for (var k = 0; k < modules.length; k++) {
      if (posCm < acc + modules[k].width) {
        insertIdx = k;
        break;
      }
      acc += modules[k].width;
    }

    modules.splice(insertIdx, 0, {
      width: newW,
      type: self.data.selectedType,
      color: self.data.selectedColor,
      isCustom: self.data.isCustomModule
    });

    self.setData({ layoutModules: modules, selectedModuleIndex: insertIdx });
    self._renderPhotoLayout();
  },

  onPhotoLayoutLongPress: function(e) {
    var self = this;
    var wall = self._wallRegion;
    if (!wall) return;

    var modules = self.data.layoutModules.slice();
    if (modules.length <= 1) {
      wx.showToast({ title: '至少保留一个模块', icon: 'none' });
      return;
    }

    var x = e.detail.x;
    var scale = wall.scale;
    var posCm = (x - wall.left) / scale;

    var accCm = 0;
    var hitIdx = -1;
    for (var i = 0; i < modules.length; i++) {
      var mEnd = accCm + modules[i].width;
      if (posCm >= accCm && posCm <= mEnd) {
        hitIdx = i;
        break;
      }
      accCm = mEnd;
    }

    if (hitIdx < 0) return;
    if (modules[hitIdx].isCorner) {
      wx.showToast({ title: '转角柜不可删除', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '删除模块',
      content: '确定删除该模块吗？',
      success: function(res) {
        if (res.confirm) {
          modules.splice(hitIdx, 1);
          self.setData({ layoutModules: modules, selectedModuleIndex: -1 });
          self._renderPhotoLayout();
        }
      }
    });
  },

  updateAvailableModules: function() {
    var data = this.data;
    var modules = layoutCompute.getAvailableModules(
      data.selectedWidth,
      data.customWidth,
      data.isCustomModule,
      assets.picture
    );
    if (data.isCustomModule) {
      this.setData({ availableModulesCustom: modules });
    } else {
      this.setData({ availableModules: modules });
    }
  },

  onSelectWidth: function(e) {
    var val = e.currentTarget.dataset.width;
    if (val === 'custom') {
      this.setData({
        selectedWidth: this.data.customWidth || 75,
        isCustomModule: true
      });
    } else {
      this.setData({
        selectedWidth: parseInt(val),
        isCustomModule: false
      });
    }
    this.updateAvailableModules();
    this._updateSelectedModule();
  },

  onSelectType: function(e) {
    var val = e.currentTarget.dataset.type;
    this.setData({ selectedType: val });
    this._updateSelectedModule();
  },

  onSelectColor: function(e) {
    var val = e.currentTarget.dataset.color;
    this.setData({ selectedColor: val });
    this._updateSelectedModule();
  },

  _updateSelectedModule: function() {
    var idx = this.data.selectedModuleIndex;
    if (idx < 0) return;
    var modules = this.data.layoutModules.slice();
    var m = modules[idx];
    if (m.isCorner) return;
    m.type = this.data.selectedType;
    if (!m.isCustom) {
      m.width = this.data.selectedWidth;
    }
    m.color = this.data.selectedColor;
    this.setData({ layoutModules: modules });
    if (this._sceneManager) {
      this._sceneManager.refreshCabinets(modules);
      this._sceneManager.highlightCabinet(idx);
    } else {
      this._renderPhotoLayout();
    }
  },

  goBackToMarking: function() {
    // 清理 3D 场景
    if (this._sceneManager) {
      try { this._sceneManager.dispose(); } catch (e) {}
      this._sceneManager = null;
      this._THREE = null;
    }
    // 清理 2D Canvas
    this._layoutCanvas = null;
    this._layoutCtx = null;
    this._photoImg = null;
    this._wallRegion = null;
    this.setData({
      mode: 'space',
      spaceStage: 'marking',
      layoutModules: [],
      selectedModuleIndex: -1
    });
  },

  // ===== 3D 实景匹配模式 =====

  _initSpace3d: function() {
    var self = this;
    var query = wx.createSelectorQuery().in(this);
    query.select('#space3dCanvas')
      .fields({ node: true, size: true })
      .exec(function(res) {
        if (!res || !res[0] || !res[0].node) {
          if ((self._space3dRetry = (self._space3dRetry || 0) + 1) < 5) {
            setTimeout(function() { self._initSpace3d(); }, 300);
          } else {
            wx.showToast({ title: '3D 初始化失败，请重试', icon: 'none' });
            self.goBackToMarking();
          }
          return;
        }
        var canvas = res[0].node;
        canvas.width = res[0].width;
        canvas.height = res[0].height;

        self._prepareWallTexture(function(textureCanvas) {
          try {
            var scopedThree = require('../../../utils/threejs-miniprogram.js').createScopedThreejs(canvas);
            if (!scopedThree || !scopedThree.WebGLRenderer) {
              throw new Error('threejs-miniprogram load failed');
            }
            var mgr = require('../../../utils/threeScene.js').createSceneManager(canvas, scopedThree);
            mgr.init(
              self.data.wallWidthNum,
              self.data.wallHeightNum,
              textureCanvas,
              self.data.cornerType,
              self.data.layoutModules
            );
            self._sceneManager = mgr;
            self._THREE = scopedThree;
            mgr.animate();
          } catch (err) {
            console.error('[space3d] init error:', err);
            wx.showToast({ title: '3D 引擎启动失败', icon: 'none' });
            self.goBackToMarking();
          }
        });
      });
  },

  _prepareWallTexture: function(callback) {
    var self = this;
    var query = wx.createSelectorQuery().in(this);
    query.select('#texturePrepCanvas')
      .fields({ node: true, size: true })
      .exec(function(res) {
        if (!res || !res[0] || !res[0].node) {
          callback(null);
          return;
        }
        var prepCanvas = res[0].node;
        var outW = 512;
        var outH = 512;
        prepCanvas.width = outW;
        prepCanvas.height = outH;
        var ctx = prepCanvas.getContext('2d');

        var img = prepCanvas.createImage();
        img.onload = function() {
          var pw = img.width;
          var ph = img.height;

          if (pw > 0 && ph > 0) {
            // 原照片完整贴到背墙
            ctx.drawImage(img, 0, 0, pw, ph, 0, 0, outW, outH);
          } else {
            ctx.fillStyle = '#555555';
            ctx.fillRect(0, 0, outW, outH);
          }
          callback(prepCanvas);
        };
        img.onerror = function() {
          ctx.fillStyle = '#555555';
          ctx.fillRect(0, 0, outW, outH);
          callback(prepCanvas);
        };
        img.src = self.data.photoPath;
      });
  },

  onSpace3dTouch: function(e) {
    var mgr = this._sceneManager;
    if (!mgr) return;

    if (e.type === 'touchstart') {
      this._space3dStartX = (e.touches && e.touches[0]) ? e.touches[0].x : 0;
      this._space3dStartY = (e.touches && e.touches[0]) ? e.touches[0].y : 0;
      this._space3dMoved = false;
      mgr.handleTouchStart(e.touches);
    } else if (e.type === 'touchmove') {
      if (e.touches && e.touches[0]) {
        var dx = e.touches[0].x - (this._space3dStartX || 0);
        var dy = e.touches[0].y - (this._space3dStartY || 0);
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          this._space3dMoved = true;
        }
      }
      mgr.handleTouchMove(e.touches);
    } else if (e.type === 'touchend') {
      var wasTap = mgr.handleTouchEnd(e.touches);
      if (!this._space3dMoved && wasTap && e.changedTouches && e.changedTouches[0]) {
        this._handleSpace3dTap(e.changedTouches[0]);
      }
    }
  },

  _handleSpace3dTap: function(touch) {
    var mgr = this._sceneManager;
    if (!mgr) return;

    var result = mgr.hitTest(touch.x, touch.y);
    if (!result) return;

    var self = this;
    var modules = self.data.layoutModules.slice();

    if (result.hitType === 'cabinet') {
      var idx = result.moduleIndex;
      // 点击已选中的柜子 → 弹窗删除
      if (idx === self.data.selectedModuleIndex) {
        if (modules.length <= 1) {
          wx.showToast({ title: '至少保留一个模块', icon: 'none' });
          return;
        }
        wx.showModal({
          title: '删除模块',
          content: '确定删除该模块吗？',
          success: function(modalRes) {
            if (modalRes.confirm) {
              var mods = self.data.layoutModules.slice();
              mods.splice(idx, 1);
              self.setData({ layoutModules: mods, selectedModuleIndex: -1 });
              mgr.clearHighlight();
              mgr.refreshCabinets(mods);
            }
          }
        });
        return;
      }
      // 点击已有柜子 → 选中
      var m = modules[idx];
      self.setData({
        selectedModuleIndex: idx,
        selectedWidth: m.isCorner ? 50 : m.width,
        selectedType: m.isCorner ? 'a' : (m.type || 'a'),
        selectedColor: m.color || 'white',
        isCustomModule: !!m.isCustom
      });
      mgr.highlightCabinet(idx);
      return;
    }

    // 点击墙面空白处 → 添加柜子
    var newW = self.data.selectedWidth;
    if (!newW) newW = 50;

    var totalW = 0;
    for (var j = 0; j < modules.length; j++) totalW += modules[j].width;
    if ((totalW + newW) * 10 > self.data.wallWidthNum) {
      wx.showToast({ title: '空间不足', icon: 'none' });
      return;
    }

    // 找到插入位置（按点击位置 cm）
    var posCm = result.posCm;
    var insertIdx = modules.length;
    var acc = 0;
    for (var k = 0; k < modules.length; k++) {
      if (posCm < acc + modules[k].width / 2) {
        insertIdx = k;
        break;
      }
      acc += modules[k].width;
    }

    modules.splice(insertIdx, 0, {
      width: newW,
      type: self.data.selectedType,
      color: self.data.selectedColor,
      isCustom: self.data.isCustomModule
    });

    self.setData({ layoutModules: modules, selectedModuleIndex: insertIdx });
    mgr.refreshCabinets(modules);
    mgr.highlightCabinet(insertIdx);
  },

  onNextModule: function() {
    var modules = this.data.layoutModules.slice();
    var wallWidthCm = Math.round(this.data.wallWidthNum / 10);

    var totalW = 0;
    for (var i = 0; i < modules.length; i++) totalW += modules[i].width;
    var remaining = wallWidthCm - totalW;

    if (remaining < 8) {
      wx.showToast({ title: '空间已用完', icon: 'none' });
      return;
    }

    var nextModule;
    if (remaining >= 50) {
      nextModule = {
        width: 50,
        type: this.data.selectedType,
        color: this.data.selectedColor,
        isCustom: false
      };
    } else {
      var customW = remaining - 4;
      nextModule = {
        width: customW,
        type: this.data.selectedType,
        color: this.data.selectedColor,
        isCustom: true
      };
    }

    modules.push(nextModule);
    var newIdx = modules.length - 1;
    this.setData({
      layoutModules: modules,
      selectedModuleIndex: -1,
      selectedWidth: 50,
      selectedType: 'a',
      selectedColor: 'white',
      isCustomModule: false
    });

    if (this._sceneManager) {
      this._sceneManager.refreshCabinets(modules);
      this._sceneManager.highlightCabinet(newIdx);
    }

    totalW += nextModule.width;
    remaining = wallWidthCm - totalW;
    if (remaining < 8) {
      wx.showToast({ title: '所有模块已添加完成', icon: 'success' });
    }
  },

  resetCamera3d: function() {
    if (this._sceneManager) {
      this._sceneManager.resetCamera();
    }
  },

  goCost: function() {
    var modules = this.data.layoutModules;
    if (modules.length === 0) {
      wx.showToast({ title: '请至少添加一个模块', icon: 'none' });
      return;
    }

    var self = this;
    app.ensureLogin().then(function() {
      var now = new Date();
      var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
      var designId = '' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate())
        + pad(now.getHours()) + pad(now.getMinutes());

      var cornerMap = { none: 'WZJ', left: 'ZZJ', right: 'YZJ', both: 'ZYZJ' };
      var cornerType = cornerMap[self.data.cornerType] || 'WZJ';
      var cornerLabels = { WZJ: '无转角柜', ZZJ: '左转角', YZJ: '右转角', ZYZJ: '双侧转角' };

      var design = {
        id: designId,
        name: '拍照设计_' + pad(now.getMonth() + 1) + pad(now.getDate()),
        cornerType: cornerType,
        cornerLabel: cornerLabels[cornerType],
        wallWidth: Math.round(self.data.wallWidthNum / 10),
        wallHeight: Math.round(self.data.wallHeightNum / 10),
        modules: modules,
        source: 'photo'
      };

      wx.showLoading({ title: '保存中...' });
      app.saveDesign(design).then(function(result) {
        wx.hideLoading();
        if (result.success) {
          wx.showToast({ title: '保存成功', icon: 'success' });
          setTimeout(function() {
            wx.navigateTo({ url: '/packageDesign/cost/cost?id=' + result._id });
          }, 800);
        } else {
          wx.showModal({
            title: '保存失败',
            content: result.msg || '请检查网络后重试',
            showCancel: false
          });
        }
      });
    }).catch(function(err) {
      wx.showToast({ title: '请先登录', icon: 'none' });
    });
  },

  onSpaceWidthInput: function(e) {
    this.setData({ wallWidth: e.detail.value });
  },

  onSpaceHeightInput: function(e) {
    this.setData({ wallHeight: e.detail.value });
  },

  onSpaceDepthInput: function(e) {
    this.setData({ roomDepth: e.detail.value });
  },

  goDesign: function() {
    var markers = this.data.markers;
    if (markers.length < 2) {
      wx.showToast({ title: '请至少标记2个墙角', icon: 'none' });
      return;
    }

    var wallWidth = parseInt(this.data.wallWidth);
    var wallHeight = parseInt(this.data.wallHeight);

    if (!wallWidth || wallWidth < 80) {
      wx.showToast({ title: '墙宽需 >= 80mm', icon: 'none' });
      return;
    }
    if (wallWidth > 10000) {
      wx.showToast({ title: '墙宽需 <= 10000mm', icon: 'none' });
      return;
    }
    if (!wallHeight || wallHeight < 1000) {
      wx.showToast({ title: '墙高需 >= 1000mm', icon: 'none' });
      return;
    }
    if (wallHeight > 10000) {
      wx.showToast({ title: '墙高需 <= 10000mm', icon: 'none' });
      return;
    }

    var cornerMap = { none: 'WZJ', left: 'ZZJ', right: 'YZJ', both: 'ZYZJ' };
    var corner = cornerMap[this.data.cornerType] || 'WZJ';

    var url = '/packageDesign/preset/preset'
      + '?width=' + Math.round(wallWidth / 10)
      + '&height=' + Math.round(wallHeight / 10)
      + '&corner=' + corner;

    wx.navigateTo({ url: url });
  },

  _updateCornerType: function() {
    var markers = this.data.markers;
    var n = markers.length;
    var type = 'none';

    if (n === 2) {
      type = 'none';
    } else if (n === 3) {
      var a = markers[0];
      var b = markers[1];
      var c = markers[2];
      var v1x = b.x - a.x;
      var v1y = b.y - a.y;
      var v2x = c.x - b.x;
      var v2y = c.y - b.y;
      var cross = v1x * v2y - v1y * v2x;
      type = cross > 0 ? 'left' : 'right';
    } else if (n === 4) {
      type = 'both';
    }

    this.setData({ cornerType: type });
  },

  _drawTopView: function() {
    var markers = this.data.markers;
    if (markers.length < 2) return;

    var self = this;
    var query = wx.createSelectorQuery().in(this);
    query.select('.topview-canvas').boundingClientRect(function(rect) {
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      self._doDrawTopView(rect.width, rect.height);
    }).exec();
  },

  _doDrawTopView: function(w, h) {
    var markers = this.data.markers;
    var ctx = wx.createCanvasContext('topviewCanvas', this);
    var pad = 16;

    var minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (var i = 0; i < markers.length; i++) {
      if (markers[i].x < minX) minX = markers[i].x;
      if (markers[i].x > maxX) maxX = markers[i].x;
      if (markers[i].y < minY) minY = markers[i].y;
      if (markers[i].y > maxY) maxY = markers[i].y;
    }

    var bw = maxX - minX || 0.01;
    var bh = maxY - minY || 0.01;
    var scaleX = (w - pad * 2) / bw;
    var scaleY = (h - pad * 2) / bh;
    var scale = Math.min(scaleX, scaleY);

    var drawW = bw * scale;
    var drawH = bh * scale;
    var offX = pad + (w - pad * 2 - drawW) / 2;
    var offY = pad + (h - pad * 2 - drawH) / 2;

    function tx(vx) { return offX + (vx - minX) * scale; }
    function ty(vy) { return offY + (vy - minY) * scale; }

    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.moveTo(tx(markers[0].x), ty(markers[0].y));
    for (var i = 1; i < markers.length; i++) {
      ctx.lineTo(tx(markers[i].x), ty(markers[i].y));
    }
    ctx.closePath();
    ctx.setFillStyle('rgba(252, 151, 0, 0.08)');
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(tx(markers[0].x), ty(markers[0].y));
    for (var i = 1; i < markers.length; i++) {
      ctx.lineTo(tx(markers[i].x), ty(markers[i].y));
    }
    ctx.closePath();
    ctx.setStrokeStyle('rgba(252, 151, 0, 0.7)');
    ctx.setLineWidth(2);
    ctx.stroke();

    var colors = ['#FF6B35', '#4A90D9', '#50C878', '#E74C3C'];
    for (var i = 0; i < markers.length; i++) {
      var px = tx(markers[i].x);
      var py = ty(markers[i].y);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.setFillStyle(colors[i]);
      ctx.fill();
    }

    ctx.draw();
  },

  onPhotoTap: function(e) {
    var markers = this.data.markers.slice();
    var x = e.detail.x;
    var y = e.detail.y;

    var self = this;
    var query = wx.createSelectorQuery().in(this);
    query.select('.markers-layer').boundingClientRect(function(rect) {
      if (!rect) return;
      var rx = (x - rect.left) / rect.width;
      var ry = (y - rect.top) / rect.height;

      var hitIndex = -1;
      for (var i = 0; i < markers.length; i++) {
        var dx = markers[i].x - rx;
        var dy = markers[i].y - ry;
        if (Math.sqrt(dx * dx + dy * dy) < 0.06) {
          hitIndex = i;
          break;
        }
      }

      if (hitIndex >= 0) {
        wx.showModal({
          title: '删除标记',
          content: '确定要删除标记点 ' + (hitIndex + 1) + ' 吗？',
          success: function(modalRes) {
            if (modalRes.confirm) {
              markers.splice(hitIndex, 1);
              self.setData({ markers: markers, draggingIndex: -1 });
              self._updateCornerType();
              self._drawTopView();
            }
          }
        });
      } else if (markers.length >= 4) {
        wx.showToast({ title: '最多标记4个墙角', icon: 'none' });
      } else {
        markers.push({ x: rx, y: ry });
        self.setData({ markers: markers });
        self._updateCornerType();
        self._drawTopView();
      }
    }).exec();
  },

  onMarkerLongPress: function(e) {
    var index = e.currentTarget.dataset.index;
    wx.vibrateShort({ type: 'light' });
    this.setData({ draggingIndex: index });
  },

  onMarkerDrag: function(e) {
    var index = this.data.draggingIndex;
    if (index < 0) return;

    var touch = e.touches[0];
    var query = wx.createSelectorQuery().in(this);
    var self = this;

    query.select('.markers-layer').boundingClientRect(function(rect) {
      if (!rect) return;
      var rx = (touch.pageX - rect.left) / rect.width;
      var ry = (touch.pageY - rect.top) / rect.height;
      rx = Math.max(0, Math.min(1, rx));
      ry = Math.max(0, Math.min(1, ry));

      var markers = self.data.markers.slice();
      markers[index] = { x: rx, y: ry };
      self.setData({ markers: markers });
    }).exec();
  },

  onMarkerDragEnd: function() {
    this.setData({ draggingIndex: -1 });
    this._updateCornerType();
    this._drawTopView();
  },

  _loadGlb: function(url, fileName) {
    var self = this;
    if (!url) return;

    self._abortDownload();
    self.setData({
      loadStage: 'resolving',
      progressPercent: 0,
      downloadedSize: '',
      totalSize: '',
      downloadSpeed: '',
      fileName: fileName || '',
      hasError: false,
      errorMsg: '',
      glbUrl: ''
    });

    // Local file: wxfile://, http://usr, or project-relative paths (non-URL)
    var isURL = url.indexOf('http://') === 0 || url.indexOf('https://') === 0;
    if (url.indexOf('wxfile://') === 0 || url.indexOf('http://usr') === 0 || (!isURL && url.indexOf('cloud://') !== 0)) {
      self.setData({ loadStage: 'parsing', progressPercent: 100, glbUrl: url }, function() {
        setTimeout(function() { self._initGLBScene(); }, 200);
      });
      return;
    }

    if (url.indexOf('cloud://') === 0) {
      wx.cloud.getTempFileURL({
        fileList: [url],
        success: function(res) {
          var tempUrl = res.fileList && res.fileList[0] && res.fileList[0].tempFileURL;
          if (tempUrl) {
            self._startDownload(tempUrl);
          } else {
            self.setData({ loadStage: 'error', hasError: true, errorMsg: '无法获取云存储下载链接' });
          }
        },
        fail: function() {
          self.setData({ loadStage: 'error', hasError: true, errorMsg: '云存储链接解析失败' });
        }
      });
      return;
    }

    self._startDownload(url);
  },

  _startDownload: function(url) {
    var self = this;
    self._progressStart = Date.now();
    self._lastDownloaded = 0;
    self._speedSamples = [];

    self.setData({ loadStage: 'downloading', progressPercent: 0 });

    self._downloadTask = wx.downloadFile({
      url: url,
      success: function(res) {
        self._downloadTask = null;
        if (res.statusCode === 200 && res.tempFilePath) {
          self.setData({ loadStage: 'parsing', progressPercent: 100, downloadSpeed: '' });
          self.setData({ glbUrl: res.tempFilePath }, function() {
            setTimeout(function() { self._initGLBScene(); }, 200);
          });
        } else {
          self.setData({
            loadStage: 'error', hasError: true,
            errorMsg: '下载失败 (HTTP ' + (res.statusCode || '?') + ')'
          });
        }
      },
      fail: function(err) {
        self._downloadTask = null;
        if (err.errMsg && err.errMsg.indexOf('abort') !== -1) return;
        self.setData({
          loadStage: 'error', hasError: true,
          errorMsg: '下载失败: ' + (err.errMsg || '网络错误')
        });
      }
    });

    if (self._downloadTask && self._downloadTask.onProgressUpdate) {
      self._downloadTask.onProgressUpdate(function(progress) {
        var now = Date.now();
        var pct = progress.progress;
        var total = progress.totalBytesExpectedToWrite;
        var downloaded = progress.totalBytesWritten;

        var elapsed = (now - self._progressStart) / 1000;
        var speed = 0;
        if (elapsed > 0.3 && downloaded > 0) {
          self._speedSamples.push({ t: now, b: downloaded });
          var cutoff = now - 3000;
          while (self._speedSamples.length > 1 && self._speedSamples[0].t < cutoff) {
            self._speedSamples.shift();
          }
          var first = self._speedSamples[0];
          var last = self._speedSamples[self._speedSamples.length - 1];
          var dt = (last.t - first.t) / 1000;
          if (dt > 0.1) {
            speed = (last.b - first.b) / dt;
          }
        }

        self.setData({
          progressPercent: pct,
          downloadedSize: formatSize(downloaded),
          totalSize: formatSize(total),
          downloadSpeed: formatSpeed(speed)
        });
        self._lastDownloaded = downloaded;
      });
    }
  },

  cancelDownload: function() {
    this._abortDownload();
    this.setData({
      loadStage: 'idle',
      progressPercent: 0,
      downloadedSize: '',
      totalSize: '',
      downloadSpeed: ''
    });
  },

  chooseFile: function() {
    var self = this;
    self.setData({ fileName: '100G1.glb' });
    self._loadGlb('utils/100G1.glb', '100G1.glb');
  },

  toggleUrlInput: function() {
    this.setData({ showUrlInput: !this.data.showUrlInput });
  },

  onInputUrl: function(e) {
    this.setData({ inputUrl: e.detail.value });
  },

  confirmUrl: function() {
    var url = this.data.inputUrl.trim();
    if (!url) {
      wx.showToast({ title: '请输入模型 URL', icon: 'none' });
      return;
    }
    var name = '';
    try {
      var parts = url.split('?')[0].split('/');
      name = parts[parts.length - 1] || '';
    } catch (e) {}
    this.setData({ showUrlInput: false, inputUrl: '', fileName: name });
    this._loadGlb(url, name);
  },

  // ---- Three.js GLB Scene ----

  _initGLBScene: function() {
    var self = this;
    var query = wx.createSelectorQuery().in(this);
    query.select('#glbCanvas')
      .fields({ node: true, size: true })
      .exec(function(res) {
        if (!res || !res[0] || !res[0].node) {
          if ((self._glbInitRetry = (self._glbInitRetry || 0) + 1) < 5) {
            setTimeout(function() { self._initGLBScene(); }, 300);
          } else {
            self.setData({ loadStage: 'error', hasError: true, errorMsg: '3D 初始化失败' });
          }
          return;
        }
        var canvas = res[0].node;
        canvas.width = res[0].width;
        canvas.height = res[0].height;

        try {
          var scopedThree = require('../../../utils/threejs-miniprogram.js').createScopedThreejs(canvas);
          if (!scopedThree || !scopedThree.WebGLRenderer) {
            throw new Error('threejs-miniprogram 加载失败');
          }
          require('../../../utils/GLTFLoader.js')(scopedThree);

          var mgr = require('../../../utils/glbSceneManager.js').createGLBSceneManager(canvas, scopedThree);
          mgr.init();
          self._glbManager = mgr;
          self._glbTHREE = scopedThree;
          mgr.animate();

          var glbUrl = self.data.glbUrl;
          if (glbUrl) {
            mgr.loadGLB(glbUrl).then(function(origSizeCm) {
              self.setData({
                loadStage: 'done',
                origSizeCm: origSizeCm,
                uniformScalePercent: 100,
                uniformScaleText: '1.00x',
                axisMin: {
                  x: Math.max(1, Math.round(origSizeCm.x * 0.3)),
                  y: Math.max(1, Math.round(origSizeCm.y * 0.3)),
                  z: Math.max(1, Math.round(origSizeCm.z * 0.3))
                },
                axisMax: {
                  x: Math.round(origSizeCm.x * 3),
                  y: Math.round(origSizeCm.y * 3),
                  z: Math.round(origSizeCm.z * 3)
                },
                axisValue: { x: origSizeCm.x, y: origSizeCm.y, z: origSizeCm.z },
                axisDisplay: {
                  x: origSizeCm.x + 'cm',
                  y: origSizeCm.y + 'cm',
                  z: origSizeCm.z + 'cm'
                }
              });
            }).catch(function(err) {
              console.error('[glb] load error:', err);
              self.setData({ loadStage: 'error', hasError: true, errorMsg: '模型解析失败: ' + (err.message || '') });
            });
          }
        } catch (err) {
          console.error('[glb] init error:', err);
          self.setData({ loadStage: 'error', hasError: true, errorMsg: '3D 引擎启动失败' });
        }
      });
  },

  onGLBTouch: function(e) {
    var mgr = this._glbManager;
    if (!mgr) return;
    if (e.type === 'touchstart') {
      mgr.handleTouchStart(e.touches);
    } else if (e.type === 'touchmove') {
      mgr.handleTouchMove(e.touches);
    } else if (e.type === 'touchend') {
      mgr.handleTouchEnd();
    }
  },

  switchScaleMode: function(e) {
    this.setData({ scaleMode: e.currentTarget.dataset.mode });
  },

  onUniformScaleChange: function(e) {
    var pct = e.detail.value;
    var s = pct / 100;
    this.setData({
      uniformScalePercent: pct,
      uniformScaleText: s.toFixed(2) + 'x'
    });
    if (this._glbManager) {
      this._glbManager.setUniformScale(s);
      var sc = this._glbManager.getCurrentScale();
      var orig = this.data.origSizeCm;
      this.setData({
        axisValue: {
          x: Math.round(orig.x * sc.x),
          y: Math.round(orig.y * sc.y),
          z: Math.round(orig.z * sc.z)
        },
        axisDisplay: {
          x: Math.round(orig.x * sc.x) + 'cm',
          y: Math.round(orig.y * sc.y) + 'cm',
          z: Math.round(orig.z * sc.z) + 'cm'
        }
      });
    }
  },

  onAxisScaleXChange: function(e) {
    this._applyAxisScale('x', e.detail.value);
  },
  onAxisScaleYChange: function(e) {
    this._applyAxisScale('y', e.detail.value);
  },
  onAxisScaleZChange: function(e) {
    this._applyAxisScale('z', e.detail.value);
  },

  _applyAxisScale: function(axis, cmVal) {
    var orig = this.data.origSizeCm;
    if (orig[axis] <= 0) return;
    var scaleVal = cmVal / orig[axis];
    var cur = this._glbManager ? this._glbManager.getCurrentScale() : { x: 1, y: 1, z: 1 };
    cur[axis] = scaleVal;

    var update = {};
    update['axisValue.' + axis] = cmVal;
    update['axisDisplay.' + axis] = cmVal + 'cm';
    this.setData(update);
    if (this._glbManager) {
      this._glbManager.setAxisScale(cur.x, cur.y, cur.z);
    }
  },

  resetGLBScale: function() {
    if (this._glbManager) {
      this._glbManager.resetScale();
    }
    var orig = this.data.origSizeCm;
    this.setData({
      scaleMode: 'uniform',
      uniformScalePercent: 100,
      uniformScaleText: '1.00x',
      axisValue: { x: orig.x, y: orig.y, z: orig.z },
      axisDisplay: { x: orig.x + 'cm', y: orig.y + 'cm', z: orig.z + 'cm' }
    });
  },

  confirmGLBSize: function() {
    var sc = this._glbManager ? this._glbManager.getCurrentScale() : { x: 1, y: 1, z: 1 };
    var orig = this.data.origSizeCm;
    wx.showModal({
      title: '当前尺寸',
      content: 'X(宽): ' + Math.round(orig.x * sc.x) + 'cm\n' +
               'Y(高): ' + Math.round(orig.y * sc.y) + 'cm\n' +
               'Z(深): ' + Math.round(orig.z * sc.z) + 'cm',
      showCancel: false
    });
  },

  loadCabinetModel: function(e) {
    var url = e.currentTarget.dataset.url;
    var name = e.currentTarget.dataset.name || '';
    if (!url) return;
    this.setData({ mode: 'glb', spaceStage: 'marking', photoPath: '', markers: [] });
    this._loadGlb(url, name + '.glb');
  },

  clearModel: function() {
    this._abortDownload();
    if (this._glbManager) {
      try { this._glbManager.dispose(); } catch (e) {}
      this._glbManager = null;
      this._glbTHREE = null;
    }
    if (this._sceneManager) {
      try { this._sceneManager.dispose(); } catch (e) {}
      this._sceneManager = null;
      this._THREE = null;
    }
    this.setData({
      glbUrl: '',
      loadStage: 'idle',
      progressPercent: 0,
      downloadedSize: '',
      totalSize: '',
      downloadSpeed: '',
      fileName: '',
      hasError: false,
      errorMsg: '',
      mode: 'glb',
      photoPath: '',
      markers: [],
      wallWidth: '1300',
      wallHeight: '2500',
      cornerType: 'none',
      draggingIndex: -1,
      scaleMode: 'uniform',
      uniformScalePercent: 100,
      uniformScaleText: '1.00x',
      origSizeCm: { x: 0, y: 0, z: 0 }
    });
  },

  goBack: function() {
    wx.navigateBack({ delta: 1 });
  },

  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('knowledge', this, res);
  },

  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('knowledge', this);
  }
});
