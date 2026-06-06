var perspective = require('../../../utils/perspective.js');
var assets = require('../../../utils/assets.js');

Page({
  _canvas: null,
  _ctx: null,
  _dpr: 2,
  _photoImg: null,
  _canvasRetry: 0,
  _cabinetImageCache: {},
  _pendingImages: {},

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
    mode: 'corners',
    wallWidth: 300,
    wallHeight: 260,
    modules: [],
    selectedType: 'a',
    selectedWidth: 50,
    showWallModal: false
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

        self._initDefaultCorners();
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

  // ========== 照片操作 ==========

  choosePhoto() {
    var self = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        var tempPath = res.tempFilePaths[0];
        if (!tempPath) return;
        self._loadPhoto(tempPath);
      }
    });
  },

  _loadPhoto(tempPath) {
    var self = this;
    if (!self._canvas) return;
    var img = self._canvas.createImage();
    img.onload = function() {
      self._photoImg = img;
      self.setData({ hasPhoto: true, modules: [], mode: 'corners' });
      self._initDefaultCorners();
      self._drawFrame();
    };
    img.onerror = function() {
      wx.showToast({ title: '照片加载失败', icon: 'none' });
    };
    img.src = tempPath;
  },

  removePhoto() {
    this._photoImg = null;
    this._cabinetImageCache = {};
    this._pendingImages = {};
    this.setData({ hasPhoto: false, draggingCorner: -1, modules: [], mode: 'corners' });
    this._drawFrame();
  },

  resetCorners() {
    this._initDefaultCorners();
    this._drawFrame();
  },

  // ========== 墙面尺寸弹窗 ==========

  openWallModal() {
    this.setData({ showWallModal: true });
  },

  closeWallModal() {
    this.setData({ showWallModal: false });
  },

  onWallWidthInput(e) {
    var v = parseInt(e.detail.value, 10);
    if (v >= 44 && v <= 1000) this.setData({ wallWidth: v });
  },

  onWallHeightInput(e) {
    var v = parseInt(e.detail.value, 10);
    if (v >= 232 && v <= 400) this.setData({ wallHeight: v });
  },

  // ========== 模式切换 ==========

  switchMode() {
    if (!this.data.hasPhoto) return;
    var newMode = this.data.mode === 'corners' ? 'place' : 'corners';
    this.setData({ mode: newMode, draggingCorner: -1 });
    this._drawFrame();
  },

  // ========== 柜体选择 ==========

  selectType(e) {
    this.setData({ selectedType: e.currentTarget.dataset.type });
  },

  selectWidth(e) {
    this.setData({ selectedWidth: parseInt(e.currentTarget.dataset.width, 10) });
  },

  // ========== 放置模式触摸处理 ==========

  onCanvasTouchStart(e) {
    if (!this.data.hasPhoto) return;

    if (this.data.mode === 'place') {
      this._handlePlaceTap(e);
      return;
    }

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

  _handlePlaceTap(e) {
    var touches = e.touches;
    if (!touches || touches.length === 0) return;
    var touch = touches[0];

    if (!perspective.isConvexQuad(this.data.corners)) {
      wx.showToast({ title: '请先调整角点为凸四边形', icon: 'none' });
      return;
    }

    var H = this._getHomography();
    if (!H) {
      wx.showToast({ title: '角点映射失败', icon: 'none' });
      return;
    }

    var wallPt = this._photoToWall(H, touch.x, touch.y);
    if (!wallPt) return;

    var sw = this.data.selectedWidth;
    var wallX = this._snapWallPos(wallPt.x, sw);
    if (wallX < 0 || wallX + sw > this.data.wallWidth) {
      wx.showToast({ title: '该位置无法放置柜体', icon: 'none' });
      return;
    }

    this._placeModule(wallX);
  },

  _getHomography() {
    var src = [
      { x: 0, y: 0 },
      { x: this.data.wallWidth, y: 0 },
      { x: this.data.wallWidth, y: this.data.wallHeight },
      { x: 0, y: this.data.wallHeight }
    ];
    return perspective.computeHomography(src, this.data.corners);
  },

  _photoToWall(H, px, py) {
    // 交换 src/dst 得到逆矩阵 photo→wall
    var dst = this.data.corners;
    var src = [
      { x: 0, y: 0 },
      { x: this.data.wallWidth, y: 0 },
      { x: this.data.wallWidth, y: this.data.wallHeight },
      { x: 0, y: this.data.wallHeight }
    ];
    var Hinv = perspective.computeHomography(dst, src);
    if (!Hinv) return null;
    return perspective.transformPoint(Hinv, { x: px, y: py });
  },

  _snapWallPos(wallX, modWidth) {
    wallX = Math.max(0, Math.min(this.data.wallWidth - modWidth, Math.round(wallX)));
    var modules = this.data.modules;
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      if (wallX + modWidth > m.wallX && wallX < m.wallX + m.width) {
        wallX = m.wallX + m.width;
      }
    }
    if (wallX + modWidth > this.data.wallWidth) return -1;
    return wallX;
  },

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
    this._ensureCabinetImages();
    this._drawFrame();
  },

  removeLastModule() {
    if (this.data.modules.length === 0) return;
    var modules = this.data.modules.slice(0, -1);
    this.setData({ modules: modules });
    this._drawFrame();
  },

  clearModules() {
    this.setData({ modules: [] });
    this._drawFrame();
  },

  onCanvasTouchMove(e) {
    if (!this.data.hasPhoto || this.data.draggingCorner < 0) return;
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
  },

  onCanvasTouchEnd() {
    if (this.data.draggingCorner >= 0) {
      this.setData({ draggingCorner: -1 });
    }
  },

  // ========== 柜体图片加载 ==========

  _ensureCabinetImages() {
    var self = this;
    var list = this._buildCabinetList();
    var keys = [];
    for (var i = 0; i < list.length; i++) {
      var key = list[i].imgKey;
      if (!self._cabinetImageCache[key] && !self._pendingImages[key]) {
        keys.push(key);
        self._pendingImages[key] = true;
      }
    }
    if (keys.length === 0) return;
    self._loadCabinetImages(keys);
  },

  _loadCabinetImages(keys) {
    var self = this;
    var urls = [];
    for (var i = 0; i < keys.length; i++) {
      urls.push(assets.picture(keys[i]));
    }

    if (urls[0] && urls[0].indexOf('cloud://') === 0) {
      wx.cloud.getTempFileURL({
        fileList: urls,
        success: function(res) {
          var fileList = res.fileList || [];
          for (var i = 0; i < fileList.length; i++) {
            var tempUrl = fileList[i].tempFileURL;
            if (tempUrl) {
              self._loadImageToCache(keys[i], tempUrl);
            }
          }
        },
        fail: function() {
          for (var i = 0; i < keys.length; i++) {
            delete self._pendingImages[keys[i]];
          }
        }
      });
    } else {
      for (var i = 0; i < keys.length; i++) {
        self._loadImageToCache(keys[i], urls[i]);
      }
    }
  },

  _loadImageToCache(key, src) {
    var self = this;
    if (!self._canvas) return;
    var img = self._canvas.createImage();
    img.onload = function() {
      self._cabinetImageCache[key] = img;
      delete self._pendingImages[key];
      self._drawFrame();
    };
    img.onerror = function() {
      delete self._pendingImages[key];
    };
    img.src = src;
  },

  // ========== 柜体渲染 ==========

  _buildCabinetList() {
    var list = [];
    var data = this.data;
    var skW = 2;
    var moduleH = 230;
    var gapH = data.wallHeight - moduleH - 2;
    if (gapH < 0) gapH = 0;

    // 左侧收口条
    list.push({ wallX: 0, wallY: gapH, wallW: skW, wallH: moduleH, imgKey: 'SK/SK-2-230' });
    if (gapH > 0) {
      list.push({ wallX: 0, wallY: 0, wallW: skW, wallH: gapH, imgKey: 'SK/SK-2-230' });
    }
    list.push({ wallX: 0, wallY: 0, wallW: skW, wallH: 2, imgKey: 'SK/SK-300-2' });

    // 已放置模块
    var modules = data.modules;
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      var key = m.width + '/' + m.type + '-' + m.width + '-230';
      list.push({ wallX: m.wallX, wallY: gapH, wallW: m.width, wallH: moduleH, imgKey: key, isModule: true });
      if (gapH > 0) {
        var nearGH = this._nearestGapHeight(gapH);
        list.push({ wallX: m.wallX, wallY: 0, wallW: m.width, wallH: gapH, imgKey: m.width + '/g-' + m.width + '-' + nearGH, isModule: true });
      }
      list.push({ wallX: m.wallX, wallY: 0, wallW: m.width, wallH: 2, imgKey: 'SK/SK-300-2' });
    }

    // 中间顶部收口条
    var topStartX = skW;
    var topEndX = data.wallWidth - skW;
    if (topEndX > topStartX) {
      list.push({ wallX: topStartX, wallY: 0, wallW: topEndX - topStartX, wallH: 2, imgKey: 'SK/SK-300-2' });
    }

    // 右侧收口条
    var rightSkX = data.wallWidth - skW;
    list.push({ wallX: rightSkX, wallY: gapH, wallW: skW, wallH: moduleH, imgKey: 'SK/SK-2-230' });
    if (gapH > 0) {
      list.push({ wallX: rightSkX, wallY: 0, wallW: skW, wallH: gapH, imgKey: 'SK/SK-2-230' });
    }
    list.push({ wallX: rightSkX, wallY: 0, wallW: skW, wallH: 2, imgKey: 'SK/SK-300-2' });

    list.sort(function(a, b) { return a.wallX - b.wallX; });
    return list;
  },

  _nearestGapHeight(gh) {
    var heights = [25, 35, 45, 55, 65, 75, 85, 95];
    var best = heights[0];
    for (var i = 1; i < heights.length; i++) {
      if (Math.abs(heights[i] - gh) < Math.abs(best - gh)) best = heights[i];
    }
    return best;
  },

  _computeQuad(H, wallX, wallY, wallW, wallH) {
    return [
      perspective.transformPoint(H, { x: wallX, y: wallY }),
      perspective.transformPoint(H, { x: wallX + wallW, y: wallY }),
      perspective.transformPoint(H, { x: wallX + wallW, y: wallY + wallH }),
      perspective.transformPoint(H, { x: wallX, y: wallY + wallH })
    ];
  },

  _drawCabinets(ctx, H) {
    var list = this._buildCabinetList();
    for (var i = 0; i < list.length; i++) {
      var cab = list[i];
      var quad = this._computeQuad(H, cab.wallX, cab.wallY, cab.wallW, cab.wallH);

      var img = this._cabinetImageCache[cab.imgKey];
      if (img) {
        perspective.drawPerspectiveImage(ctx, img, quad, 80);
      } else {
        ctx.fillStyle = cab.isModule ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(quad[0].x, quad[0].y);
        for (var j = 1; j < 4; j++) {
          ctx.lineTo(quad[j].x, quad[j].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = cab.isModule ? 'rgba(252, 151, 0, 0.6)' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
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
    } else {
      ctx.fillStyle = '#555';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('请上传照片', cw / 2, ch / 2);
      ctx.textAlign = 'start';
      return;
    }

    var corners = data.corners;
    var isConvex = perspective.isConvexQuad(corners);

    // 柜体渲染（在有照片、四边形凸且至少有一个模块时）
    if (isConvex && data.modules.length > 0) {
      var H = this._getHomography();
      if (H) {
        this._drawCabinets(ctx, H);
      }
    }

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

    // 放置模式提示
    if (data.hasPhoto && data.mode === 'place') {
      ctx.fillStyle = 'rgba(252, 151, 0, 0.9)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('点击照片放置' + data.selectedType.toUpperCase() + '型 ' + data.selectedWidth + 'cm 柜体', cw / 2, ch - 12);
      ctx.textAlign = 'start';

      // 高亮当前选中类型
      if (isConvex && data.modules.length > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(data.modules.length + ' 个柜体', cw - 12, 20);
        ctx.textAlign = 'start';
      }
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
