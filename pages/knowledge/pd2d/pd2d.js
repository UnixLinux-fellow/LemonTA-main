var perspective = require('../../../utils/perspective.js');

Page({
  _canvas: null,
  _ctx: null,
  _dpr: 2,
  _photoImg: null,
  _canvasRetry: 0,

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
    draggingCorner: -1
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
      self.setData({ hasPhoto: true });
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
    this.setData({ hasPhoto: false, draggingCorner: -1 });
    this._drawFrame();
  },

  resetCorners() {
    this._initDefaultCorners();
    this._drawFrame();
  },

  onCanvasTouchStart(e) {
    if (!this.data.hasPhoto) return;
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

    if (perspective.isConvexQuad(corners)) {
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
