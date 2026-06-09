var perspective = require('../../../utils/perspective.js');
var cabinetCatalog = require('../../../utils/cabinetCatalog.js');
var cabinetModelPreview = require('../../../utils/cabinetModelPreview.js');
var cabinetSceneOverlay = require('../../../utils/cabinetSceneOverlay.js');

Page({
  _canvas: null,
  _ctx: null,
  _dpr: 2,
  _photoImg: null,
  _canvasRetry: 0,
  _overlay: null,
  _overlayCanvas: null,
  _overlayInitialized: false,
  _overlayPendingFrame: false,

  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    canvasReady: false,
    canvasWidth: 360,
    canvasHeight: 300,
    hasPhoto: false,
    corners: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 }
    ],
    draggingCorner: -1,
    doorVisible: false,
    isWallFull: false,
    wallWidth: 300,
    wallHeight: 260,
    modules: [],
    spaceName: '',
    spaceConfirmed: false,
    selectedType: 'a',
    selectedWidth: 50,
    selectedModelId: '50A',
    modelPreviewReady: false,
    hasDoor: false
  },

  onLoad() {
    try {
      var sysInfo = wx.getWindowInfo();
      var menuBtn = wx.getMenuButtonBoundingClientRect();
      var statusBarHeight = sysInfo.statusBarHeight || 20;
      var navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
      this.setData({ statusBarHeight: statusBarHeight, navBarHeight: navBarHeight });
    } catch (e) {
      this.setData({ statusBarHeight: 20, navBarHeight: 44 });
    }
  },

  onReady() {
    this._canvasRetry = 0;
    this.initCanvas();
  },

  initCanvas() {
    var self = this;
    var query = self.createSelectorQuery();
    query.select('#pd2dCanvas')
      .fields({ node: true, size: true })
      .exec(function(res) {
        if (!res || !res[0] || !res[0].node) {
          self._retryCanvas();
          return;
        }
        var canvas = res[0].node;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          self._retryCanvas();
          return;
        }
        var renderWidth = res[0].width;
        var renderHeight = res[0].height;
        var canvasWidth = renderWidth || 360;
        var canvasHeight = renderHeight || 300;

        var dpr = 2;
        try { dpr = wx.getWindowInfo().pixelRatio || 2; } catch (e) {}

        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
        ctx.scale(dpr, dpr);

        self._canvas = canvas;
        self._ctx = ctx;
        self._dpr = dpr;

        self.setData({
          canvasReady: true,
          canvasWidth: canvasWidth,
          canvasHeight: canvasHeight
        });

        if (self.data.spaceConfirmed && !self._photoImg) {
          var m = 24;
          self.setData({
            corners: [
              { x: m, y: m },
              { x: canvasWidth - m, y: m },
              { x: canvasWidth - m, y: canvasHeight - m },
              { x: m, y: canvasHeight - m }
            ]
          });
        } else {
          self._initDefaultCorners();
        }
        self._drawFrame();
      });
  },

  _retryCanvas() {
    var self = this;
    self._canvasRetry++;
    if (self._canvasRetry < 8) {
      var delay = self._canvasRetry <= 3 ? 150 : 300;
      setTimeout(function() { self.initCanvas(); }, delay);
    } else {
      setTimeout(function() { self._canvasRetry = 0; self.initCanvas(); }, 1500);
    }
  },

  _initDefaultCorners() {
    var cw = this.data.canvasWidth;
    var ch = this.data.canvasHeight;
    this.setData({
      corners: [
        { x: cw * 0.2, y: ch * 0.2 },
        { x: cw * 0.8, y: ch * 0.2 },
        { x: cw * 0.8, y: ch * 0.8 },
        { x: cw * 0.2, y: ch * 0.8 }
      ]
    });
  },

  // ========== 空间配置 ==========

  onSpaceNameInput(e) {
    this.setData({ spaceName: e.detail.value });
  },

  onConfirmSpace() {
    var name = (this.data.spaceName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入空间名称', icon: 'none' });
      return;
    }
    var w = parseInt(this.data.wallWidth, 10);
    var h = parseInt(this.data.wallHeight, 10);
    if (isNaN(w) || w < 44 || w > 1000) {
      wx.showToast({ title: '墙宽需在44-1000cm', icon: 'none' });
      return;
    }
    if (isNaN(h) || h < 232 || h > 400) {
      wx.showToast({ title: '墙高需在232-400cm', icon: 'none' });
      return;
    }
    this.setData({
      spaceName: name, wallWidth: w, wallHeight: h,
      spaceConfirmed: true, modules: [],
      isWallFull: false, doorVisible: false
    });
    // wx:if 切换会重建 canvas，延迟重新初始化
    var self = this;
    self._canvas = null;
    self._ctx = null;
    setTimeout(function() {
      self.initCanvas();
      self._initModelPreview();
      self._initOverlay();
    }, 120);
  },

  // ========== 照片操作 ==========

  choosePhoto() {
    var self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        var files = res.tempFiles || [];
        var tempPath = files[0] && files[0].tempFilePath;
        if (!tempPath) return;
        self._loadPhoto(tempPath);
      },
      fail: function(err) {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') >= 0) return;
        wx.showToast({ title: '选择照片失败', icon: 'none' });
      }
    });
  },

  _loadPhoto(tempPath) {
    var self = this;
    if (!self._canvas) return;
    var img = self._canvas.createImage();
    img.onload = function() {
      self._photoImg = img;
      self.setData({ hasPhoto: true, modules: [], spaceConfirmed: false });
      self._drawFrame();
    };
    img.onerror = function() {
      wx.showToast({ title: '照片加载失败', icon: 'none' });
    };
    img.src = tempPath;
  },

  // ========== 墙面尺寸输入 ==========

  onWallWidthInput(e) {
    var v = parseInt(e.detail.value, 10);
    if (v >= 44 && v <= 1000) this.setData({ wallWidth: v });
  },

  onWallHeightInput(e) {
    var v = parseInt(e.detail.value, 10);
    if (v >= 232 && v <= 400) this.setData({ wallHeight: v });
  },

  // ========== 柜体宽度选择 ==========

  selectWidth(e) {
    var w = parseInt(e.currentTarget.dataset.width, 10);
    this.setData({ selectedWidth: w });
    this._initModelPreview();
  },

  // ========== 积木导航按钮 ==========

  prevBlock() {
    if (this.data.modules.length === 0) {
      wx.showToast({ title: '已无柜体', icon: 'none' });
      return;
    }
    var modules = this.data.modules.slice(0, -1);
    this.setData({ modules: modules, isWallFull: false });
    this._drawFrame();
    this._scheduleOverlayUpdate();
    this._recomputeIsWallFull();
  },

  nextBlock() {
    if (this.data.isWallFull) {
      this._confirmLayout();
      return;
    }
    var wallX = this._findNextWallPosition();
    if (wallX < 0) {
      wx.showToast({ title: '墙面已满', icon: 'none' });
      this.setData({ isWallFull: true });
      return;
    }
    this._placeModule(wallX);
    this._recomputeIsWallFull();
  },

  resetWall() {
    // 重置角点 + 清空模块
    this.setData({ modules: [], isWallFull: false, draggingCorner: -1 });
    if (this._photoImg) {
      this._initDefaultCorners();
    }
    this._drawFrame();
    this._scheduleOverlayUpdate();
  },

  toggleDoor() {
    var newVisible = !this.data.doorVisible;
    this.setData({ doorVisible: newVisible });
    if (this._modelPreview) {
      try { this._modelPreview.setDoorVisible(newVisible); } catch (e) {}
    }
    if (this._overlay) {
      try { this._overlay.setDoorVisible(newVisible); } catch (e) {}
    }
  },

  _findNextWallPosition() {
    var skW = 2;
    var sw = this.data.selectedWidth;
    var pos = skW;
    var modules = this.data.modules;
    for (var i = 0; i < modules.length; i++) {
      if (pos + sw <= modules[i].wallX) {
        return pos;
      }
      pos = modules[i].wallX + modules[i].width;
    }
    if (pos + sw <= this.data.wallWidth - skW) {
      return pos;
    }
    return -1;
  },

  _recomputeIsWallFull() {
    var skW = 2;
    var usedWidth = skW * 2;
    var modules = this.data.modules;
    for (var i = 0; i < modules.length; i++) {
      usedWidth += modules[i].width;
    }
    var remaining = this.data.wallWidth - usedWidth;
    this.setData({ isWallFull: remaining < this.data.selectedWidth + 4 });
  },

  _confirmLayout() {
    // TODO: 确认布局，跳转到报价页或保存方案
    wx.showToast({ title: '布局已确认', icon: 'success' });
  },

  // ========== 模型预览 (3D GLB thumbnails) ==========

  _getModelIdsForWidth: function(widthCm) {
    var all = cabinetCatalog.listModels();
    var ids = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].width === widthCm) {
        ids.push(all[i].id);
      }
    }
    return ids;
  },

  _initModelPreview: function() {
    var self = this;
    var widthCm = self.data.selectedWidth;
    var modelIds = self._getModelIdsForWidth(widthCm);
    if (modelIds.length === 0) return;

    if (self._modelPreview) {
      self._modelPreview.setModels(modelIds, function(err) {
        if (err) { console.error('[pd2d] setModels error:', err); return; }
        try { self._modelPreview.setDoorVisible(self.data.doorVisible); } catch (e) {}
        self._modelPreview.selectModel(0);
        self._modelPreview.renderAll();
        self._syncSelectedFromPreview(0);
      });
      return;
    }

    setTimeout(function() {
      var query = wx.createSelectorQuery().in(self);
      query.select('#modelPreviewCanvas')
        .fields({ node: true, size: true })
        .exec(function(res) {
          if (!res || !res[0] || !res[0].node) return;
          var canvas = res[0].node;
          canvas.width = res[0].width;
          canvas.height = res[0].height;
          var preview = cabinetModelPreview.createPreview(canvas);
          preview.init(modelIds, function(err) {
            if (err) { console.error('[pd2d] model preview init error:', err); return; }
            self._modelPreview = preview;
            try { preview.setDoorVisible(false); } catch (e) {}
            self.setData({
              modelPreviewReady: true,
              hasDoor: preview.hasDoorMeshes(),
              doorVisible: false
            });
            preview.selectModel(0);
            preview.renderAll();
            self._syncSelectedFromPreview(0);
          });
        });
    }, 200);
  },

  _syncSelectedFromPreview: function(idx) {
    if (!this._modelPreview) return;
    var modelId = this._modelPreview.getModelIdAt(idx);
    if (!modelId) return;
    var models = require('../../../utils/cabinetCatalog.js').listModels();
    for (var j = 0; j < models.length; j++) {
      if (models[j].id === modelId) {
        this.setData({
          selectedModelId: modelId,
          selectedType: models[j].type.toLowerCase(),
          selectedWidth: models[j].width
        });
        return;
      }
    }
  },

  _destroyModelPreview: function() {
    if (this._modelPreview) {
      try { this._modelPreview.dispose(); } catch (e) {}
      this._modelPreview = null;
      this.setData({ modelPreviewReady: false });
    }
  },

  _initOverlay: function() {
    var self = this;
    if (self._overlayInitialized) return;
    var query = wx.createSelectorQuery().in(self);
    query.select('#pd2dOverlay')
      .fields({ node: true, size: true })
      .exec(function(res) {
        if (!res || !res[0] || !res[0].node) {
          setTimeout(function() {
            if (!self._overlayInitialized) self._initOverlay();
          }, 200);
          return;
        }
        var canvas = res[0].node;
        var w = res[0].width;
        var h = res[0].height;
        if (!w || !h) {
          setTimeout(function() {
            if (!self._overlayInitialized) self._initOverlay();
          }, 200);
          return;
        }
        var overlay = cabinetSceneOverlay.createOverlay(canvas);
        var ok = overlay.init({ canvasWidth: w, canvasHeight: h, dpr: self._dpr || 2 });
        if (!ok) {
          console.error('[pd2d] overlay init failed; falling back to no-3D mode');
          return;
        }
        self._overlay = overlay;
        self._overlayCanvas = canvas;
        self._overlayInitialized = true;
        self._scheduleOverlayUpdate();
      });
  },

  _scheduleOverlayUpdate: function() {
    var self = this;
    if (!self._overlay) return;
    if (self._overlayPendingFrame) return;
    self._overlayPendingFrame = true;
    var raf = (self._canvas && self._canvas.requestAnimationFrame) || function(cb){ setTimeout(cb, 16); };
    raf(function() {
      self._overlayPendingFrame = false;
      if (!self._overlay) return;
      self._overlay.update({
        corners: self.data.corners,
        wallWidth: self.data.wallWidth,
        wallHeight: self.data.wallHeight,
        modules: self.data.modules
      });
    });
  },

  onModelPreviewTouch: function(e) {
    var preview = this._modelPreview;
    if (!preview) return;
    if (e.type !== 'touchstart') return;
    var touch = e.touches[0];
    if (!touch) return;
    var idx = preview.hitTest(touch.x, touch.y);
    if (idx < 0) return;
    preview.selectModel(idx);
    this._syncSelectedFromPreview(idx);
  },

  // ========== 触摸处理（角点拖拽） ==========

  onCanvasTouchStart(e) {
    if (!this.data.spaceConfirmed) return;

    var touches = e.touches;
    if (!touches || touches.length === 0) return;
    var touch = touches[0];
    var corners = this.data.corners;
    var hitRadius = 24;
    var hitIndex = -1;
    var minDist = Infinity;
    for (var i = 0; i < 4; i++) {
      var dx = touch.x - corners[i].x;
      var dy = touch.y - corners[i].y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < hitRadius && dist < minDist) {
        hitIndex = i;
        minDist = dist;
      }
    }
    if (hitIndex >= 0) {
      this.setData({ draggingCorner: hitIndex });
    }
  },

  onCanvasTouchMove(e) {
    if (!this.data.spaceConfirmed || this.data.draggingCorner < 0) return;
    var touches = e.touches;
    if (!touches || touches.length === 0) return;
    var touch = touches[0];
    var idx = this.data.draggingCorner;
    var corners = this.data.corners.slice();
    corners[idx] = {
      x: Math.max(5, Math.min(this.data.canvasWidth - 5, touch.x)),
      y: Math.max(5, Math.min(this.data.canvasHeight - 5, touch.y))
    };
    this.setData({ corners: corners });
    this._drawFrame();
    this._scheduleOverlayUpdate();
  },

  onCanvasTouchEnd() {
    if (this.data.draggingCorner >= 0) {
      this.setData({ draggingCorner: -1 });
    }
  },

  // ========== 柜体放置 ==========

  _placeModule(wallX) {
    var modules = this.data.modules.slice();
    modules.push({
      type: this.data.selectedType,
      width: this.data.selectedWidth,
      wallX: wallX,
      isStandard: true
    });
    modules.sort(function(a, b) { return a.wallX - b.wallX; });
    this.setData({ modules: modules });
    this._drawFrame();
    this._scheduleOverlayUpdate();
  },

  // ========== 主绘制 ==========

  _drawFrame() {
    var ctx = this._ctx;
    var data = this.data;
    if (!ctx) return;

    var cw = data.canvasWidth;
    var ch = data.canvasHeight;
    ctx.clearRect(0, 0, cw, ch);

    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, cw, ch);

    if (this._photoImg) {
      ctx.drawImage(this._photoImg, 0, 0, cw, ch);
    } else if (data.spaceConfirmed) {
      var margin = 24;
      var wallX = margin;
      var wallY = margin;
      var wallW = cw - margin * 2;
      var wallH = ch - margin * 2;
      ctx.fillStyle = '#3a3835';
      ctx.fillRect(wallX, wallY, wallW, wallH);
      ctx.strokeStyle = 'rgba(252, 151, 0, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(wallX, wallY, wallW, wallH);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(data.wallWidth + ' × ' + data.wallHeight + ' cm', cw / 2, wallY - 8);
      ctx.textAlign = 'start';
    } else {
      ctx.fillStyle = '#555';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('上传照片或直接确认', cw / 2, ch / 2);
      ctx.textAlign = 'start';
      return;
    }

    var corners = data.corners;
    var isConvex = perspective.isConvexQuad(corners);

    // 四边形连线
    ctx.strokeStyle = 'rgba(252, 151, 0, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (var i = 1; i < 4; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // 角标圆点
    for (var j = 0; j < 4; j++) {
      var isDragging = (j === data.draggingCorner);
      var r = isDragging ? 10 : 7;
      ctx.fillStyle = isDragging ? '#E08000' : '#FC9700';
      ctx.beginPath();
      ctx.arc(corners[j].x, corners[j].y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 透视网格线
    if (isConvex) {
      ctx.strokeStyle = 'rgba(252, 151, 0, 0.2)';
      ctx.lineWidth = 0.8;
      for (var k = 1; k < 10; k++) {
        var t = k / 10;
        var leftX = corners[3].x + (corners[0].x - corners[3].x) * t;
        var leftY = corners[3].y + (corners[0].y - corners[3].y) * t;
        var rightX = corners[2].x + (corners[1].x - corners[2].x) * t;
        var rightY = corners[2].y + (corners[1].y - corners[2].y) * t;
        ctx.beginPath();
        ctx.moveTo(leftX, leftY);
        ctx.lineTo(rightX, rightY);
        ctx.stroke();
      }
      for (var m = 1; m < 10; m++) {
        var u = m / 10;
        var topX = corners[0].x + (corners[1].x - corners[0].x) * u;
        var topY = corners[0].y + (corners[1].y - corners[0].y) * u;
        var botX = corners[3].x + (corners[2].x - corners[3].x) * u;
        var botY = corners[3].y + (corners[2].y - corners[3].y) * u;
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(botX, botY);
        ctx.stroke();
      }
    }

    // 模块计数
    if (data.modules.length > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(data.modules.length + ' 个柜体', cw - 12, 18);
      ctx.textAlign = 'start';
    }
  },

  onUnload() {
    this._destroyModelPreview();
    if (this._overlay) {
      try { this._overlay.dispose(); } catch (e) {}
      this._overlay = null;
      this._overlayInitialized = false;
    }
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('knowledge', this, res);
  },

  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('knowledge', this);
  }
});
