var catalog = require('../../../utils/cabinetCatalog.js');
var layoutAlgo = require('../../../utils/cabinetLayout.js');
var storage = require('../../../utils/pd3dStorage.js');

Page({
  _canvas: null,
  _sceneManager: null,
  _THREE: null,
  _photoTempPath: '',
  _initRetry: 0,

  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    mode: 'init',
    wallWidth: 150,
    wallHeight: 260,
    wallDepth: 60,
    modelList: [],
    selectedModelId: '100G1',
    selectedWidthCm: 50,
    cabinets: [],
    selectedInstanceId: '',
    selScale: { x: '1.00', y: '1.00', z: '1.00' },
    selScalePct: { x: 100, y: 100, z: 100 },
    drawerOpen: false,
    savedLayouts: [],
    currentLayoutId: ''
  },

  onLoad: function() {
    try {
      var sysInfo = wx.getWindowInfo();
      var menuBtn = wx.getMenuButtonBoundingClientRect();
      var statusBarHeight = sysInfo.statusBarHeight || 20;
      var navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
      this.setData({ statusBarHeight: statusBarHeight, navBarHeight: navBarHeight });
    } catch (e) {
      this.setData({ statusBarHeight: 20, navBarHeight: 44 });
    }
    this.setData({ modelList: catalog.listModels() });
  },

  onUnload: function() {
    this._teardownScene();
  },

  _teardownScene: function() {
    if (this._sceneManager) {
      try { this._sceneManager.dispose(); } catch (e) {}
      this._sceneManager = null;
      this._THREE = null;
    }
    this._canvas = null;
  },

  onWallWidthInput: function(e) { this.setData({ wallWidth: e.detail.value }); },
  onWallHeightInput: function(e) { this.setData({ wallHeight: e.detail.value }); },
  onWallDepthInput: function(e) { this.setData({ wallDepth: e.detail.value }); },

  onWallWidthBlur: function(e) {
    var v = parseInt(e.detail.value, 10);
    if (isNaN(v)) v = 150;
    v = Math.max(30, Math.min(1000, v));
    this.setData({ wallWidth: v });
  },
  onWallHeightBlur: function(e) {
    var v = parseInt(e.detail.value, 10);
    if (isNaN(v)) v = 260;
    v = Math.max(100, Math.min(1000, v));
    this.setData({ wallHeight: v });
  },
  onWallDepthBlur: function(e) {
    var v = parseInt(e.detail.value, 10);
    if (isNaN(v)) v = 60;
    v = Math.max(10, Math.min(150, v));
    this.setData({ wallDepth: v });
  },

  onUploadAndStart: function() {
    var self = this;
    var w = parseInt(self.data.wallWidth, 10);
    var h = parseInt(self.data.wallHeight, 10);
    var d = parseInt(self.data.wallDepth, 10);
    if (!layoutAlgo.canFitWall(w)) {
      wx.showToast({ title: '墙宽过小', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        var temp = res.tempFiles[0].tempFilePath;
        self._photoTempPath = temp;
        self.setData({ mode: 'placing', cabinets: [], wallWidth: w, wallHeight: h, wallDepth: d });
        self._initRetry = 0;
        setTimeout(function() { self._initScene(); }, 200);
      }
    });
  },

  _initScene: function() {
    var self = this;
    var query = wx.createSelectorQuery().in(self);
    query.select('#pd3dCanvas').fields({ node: true, size: true }).exec(function(res) {
      if (!res || !res[0] || !res[0].node) {
        if ((self._initRetry = (self._initRetry || 0) + 1) < 8) {
          var delay = self._initRetry <= 3 ? 150 : 300;
          setTimeout(function() { self._initScene(); }, delay);
        } else {
          wx.showToast({ title: '3D 初始化失败', icon: 'none' });
          self.setData({ mode: 'init' });
        }
        return;
      }
      var canvas = res[0].node;
      canvas.width = res[0].width;
      canvas.height = res[0].height;
      self._canvas = canvas;
      self._prepareTextureCanvas(function(textureCanvas) {
        try {
          var scopedThree = require('../../../utils/threejs-miniprogram.js').createScopedThreejs(canvas);
          require('../../../utils/GLTFLoader.js')(scopedThree);
          self._THREE = scopedThree;
          var mgr = require('../../../utils/pd3dSceneManager.js').createSceneManager(canvas, scopedThree);
          mgr.init({
            width: parseInt(self.data.wallWidth, 10),
            height: parseInt(self.data.wallHeight, 10),
            depth: parseInt(self.data.wallDepth, 10)
          }, textureCanvas);
          self._sceneManager = mgr;
          mgr.animate();
        } catch (err) {
          console.error('[pd3d] init error', err);
          wx.showToast({ title: '3D 引擎启动失败', icon: 'none' });
          self.setData({ mode: 'init' });
        }
      });
    });
  },

  _prepareTextureCanvas: function(cb) {
    var self = this;
    var query = wx.createSelectorQuery().in(self);
    query.select('#texturePrepCanvas').fields({ node: true, size: true }).exec(function(res) {
      if (!res || !res[0] || !res[0].node) { cb(null); return; }
      var prep = res[0].node;
      prep.width = 1024;
      prep.height = 1024;
      var ctx = prep.getContext('2d');
      var img = prep.createImage();
      img.onload = function() {
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, prep.width, prep.height);
        cb(prep);
      };
      img.onerror = function() {
        ctx.fillStyle = '#555'; ctx.fillRect(0, 0, prep.width, prep.height);
        cb(prep);
      };
      img.src = self._photoTempPath || '';
    });
  },

  onSelectModel: function(e) { this.setData({ selectedModelId: e.currentTarget.dataset.id }); },
  onSelectWidth: function(e) {
    this.setData({ selectedWidthCm: parseInt(e.currentTarget.dataset.w, 10) });
  },

  onAddCabinet: function() {
    var self = this;
    if (!self._sceneManager) return;
    var wallW = parseInt(self.data.wallWidth, 10);
    var widthCm = self.data.selectedWidthCm;
    var modelId = self.data.selectedModelId;
    var path = catalog.getModelPath(modelId);
    if (!path) { wx.showToast({ title: '模型不存在', icon: 'none' }); return; }

    var result = layoutAlgo.addStandard(self.data.cabinets, widthCm, wallW);
    if (!result.added) {
      var msg = result.error === 'finalized' ? '已完成布置，无法再加' : '空间不足';
      wx.showToast({ title: msg, icon: 'none' });
      return;
    }
    var newSpec = result.list[result.list.length - 1];
    wx.showLoading({ title: '加载柜子...' });
    self._sceneManager.addCabinet({
      modelId: modelId,
      modelPath: path,
      widthCm: newSpec.widthCm,
      wallStartCm: newSpec.wallStartCm,
      isCustom: newSpec.isCustom,
      scale: newSpec.scale
    }).then(function(instanceId) {
      wx.hideLoading();
      newSpec.instanceId = instanceId;
      self.setData({ cabinets: result.list });
    }).catch(function(err) {
      wx.hideLoading();
      console.error(err);
      wx.showToast({ title: '柜子加载失败', icon: 'none' });
    });
  },

  onFinalize: function() {
    var self = this;
    if (!self._sceneManager) return;
    var wallW = parseInt(self.data.wallWidth, 10);
    var result = layoutAlgo.finalize(self.data.cabinets, wallW);
    if (!result.list) {
      wx.showToast({ title: '剩余空间过小', icon: 'none' });
      return;
    }
    var oldList = self.data.cabinets;
    var newList = result.list;
    var oldHadCustom = oldList.length > 0 && oldList[oldList.length - 1].isCustom;
    if (oldHadCustom) {
      var oldCustom = oldList[oldList.length - 1];
      if (oldCustom.instanceId) {
        self._sceneManager.removeCabinetByInstanceId(oldCustom.instanceId);
      }
    }
    var newCustom = newList[newList.length - 1];
    var path = catalog.getModelPath(self.data.selectedModelId);
    wx.showLoading({ title: '生成非标柜...' });
    self._sceneManager.addCabinet({
      modelId: self.data.selectedModelId,
      modelPath: path,
      widthCm: newCustom.widthCm,
      wallStartCm: newCustom.wallStartCm,
      isCustom: true,
      scale: newCustom.scale
    }).then(function(instanceId) {
      wx.hideLoading();
      newCustom.instanceId = instanceId;
      for (var i = 0; i < newList.length - 1; i++) {
        if (oldList[i] && oldList[i].instanceId) {
          newList[i].instanceId = oldList[i].instanceId;
        }
      }
      self.setData({ cabinets: newList });
    }).catch(function(err) {
      wx.hideLoading();
      console.error(err);
      wx.showToast({ title: '生成失败', icon: 'none' });
    });
  },

  onCanvasTouchStart: function(e) {
    if (!this._sceneManager) return;
    this._touchStartXY = e.touches[0] ? { x: e.touches[0].x, y: e.touches[0].y } : null;
    this._touchMoved = false;
    this._sceneManager.handleTouchStart(e.touches);
  },
  onCanvasTouchMove: function(e) {
    if (!this._sceneManager) return;
    if (e.touches[0] && this._touchStartXY) {
      var dx = e.touches[0].x - this._touchStartXY.x;
      var dy = e.touches[0].y - this._touchStartXY.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this._touchMoved = true;
    }
    this._sceneManager.handleTouchMove(e.touches);
  },
  onCanvasTouchEnd: function(e) {
    if (!this._sceneManager) return;
    this._sceneManager.handleTouchEnd();
    if (!this._touchMoved && e.changedTouches[0]) {
      var hit = this._sceneManager.hitTest(e.changedTouches[0].x, e.changedTouches[0].y);
      if (hit) {
        this._selectInstance(hit.instanceId);
      } else if (this.data.mode === 'selected') {
        this._cancelSelection();
      }
    }
  },

  _selectInstance: function(instanceId) {
    var c = null;
    for (var i = 0; i < this.data.cabinets.length; i++) {
      if (this.data.cabinets[i].instanceId === instanceId) { c = this.data.cabinets[i]; break; }
    }
    if (!c) return;
    this._sceneManager.selectCabinetByInstanceId(instanceId);
    this.setData({
      mode: 'selected',
      selectedInstanceId: instanceId,
      selScale: { x: c.scale.x.toFixed(2), y: c.scale.y.toFixed(2), z: c.scale.z.toFixed(2) },
      selScalePct: {
        x: Math.round(c.scale.x * 100),
        y: Math.round(c.scale.y * 100),
        z: Math.round(c.scale.z * 100)
      }
    });
  },

  _cancelSelection: function() {
    if (this._sceneManager) this._sceneManager.clearSelection();
    this.setData({ mode: 'placing', selectedInstanceId: '' });
  },

  onCancelSelection: function() { this._cancelSelection(); },

  onScaleX: function(e) { this._applyScaleAxis('x', e.detail.value); },
  onScaleY: function(e) { this._applyScaleAxis('y', e.detail.value); },
  onScaleZ: function(e) { this._applyScaleAxis('z', e.detail.value); },

  _applyScaleAxis: function(axis, pct) {
    var id = this.data.selectedInstanceId;
    if (!id) return;
    var list = this.data.cabinets.slice();
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].instanceId === id) { idx = i; break; }
    if (idx < 0) return;
    var s = {
      x: list[idx].scale.x, y: list[idx].scale.y, z: list[idx].scale.z
    };
    s[axis] = pct / 100;
    list[idx] = {
      instanceId: list[idx].instanceId, modelId: list[idx].modelId,
      widthCm: list[idx].widthCm, isCustom: list[idx].isCustom,
      wallStartCm: list[idx].wallStartCm, scale: s
    };
    this._sceneManager.setCabinetScale(id, s);
    this._sceneManager.selectCabinetByInstanceId(id);
    var newPct = {
      x: this.data.selScalePct.x, y: this.data.selScalePct.y, z: this.data.selScalePct.z
    };
    newPct[axis] = pct;
    var newScale = {
      x: this.data.selScale.x, y: this.data.selScale.y, z: this.data.selScale.z
    };
    newScale[axis] = (pct / 100).toFixed(2);
    this.setData({ cabinets: list, selScalePct: newPct, selScale: newScale });
  },

  onDeleteSelected: function() {
    var self = this;
    var id = self.data.selectedInstanceId;
    if (!id) return;
    var idx = -1;
    var list = self.data.cabinets;
    for (var i = 0; i < list.length; i++) if (list[i].instanceId === id) { idx = i; break; }
    if (idx < 0) return;
    wx.showModal({
      title: '删除柜子', content: '确定删除这个柜子？',
      success: function(modal) {
        if (!modal.confirm) return;
        var wallW = parseInt(self.data.wallWidth, 10);
        var oldList = self.data.cabinets;
        var oldCustom = oldList.length > 0 && oldList[oldList.length - 1].isCustom
          ? oldList[oldList.length - 1] : null;
        var result = layoutAlgo.removeAt(oldList, idx, wallW);
        self._sceneManager.removeCabinetByInstanceId(id);
        var newCustom = result.list.length > 0 && result.list[result.list.length - 1].isCustom
          ? result.list[result.list.length - 1] : null;
        if (oldCustom && oldCustom.instanceId !== id && newCustom &&
            newCustom.widthCm !== oldCustom.widthCm) {
          self._sceneManager.removeCabinetByInstanceId(oldCustom.instanceId);
          var path = catalog.getModelPath(self.data.selectedModelId);
          self._sceneManager.addCabinet({
            modelId: self.data.selectedModelId,
            modelPath: path,
            widthCm: newCustom.widthCm,
            wallStartCm: newCustom.wallStartCm,
            isCustom: true,
            scale: newCustom.scale
          }).then(function(newId) {
            newCustom.instanceId = newId;
            self._repositionRemaining(result.list);
            self.setData({ cabinets: result.list, mode: 'placing', selectedInstanceId: '' });
            self._sceneManager.clearSelection();
          });
          return;
        }
        var oldById = {};
        for (var j = 0; j < oldList.length; j++) oldById[oldList[j].instanceId] = oldList[j];
        for (var k = 0; k < result.list.length; k++) {
          var entry = result.list[k];
          for (var n = 0; n < oldList.length; n++) {
            var ol = oldList[n];
            if (ol.instanceId === id) continue;
            if (oldById[ol.instanceId] === ol &&
                ol.widthCm === entry.widthCm && ol.isCustom === entry.isCustom &&
                !entry.instanceId) {
              entry.instanceId = ol.instanceId;
              delete oldById[ol.instanceId];
              break;
            }
          }
        }
        self._repositionRemaining(result.list);
        self.setData({ cabinets: result.list, mode: 'placing', selectedInstanceId: '' });
        self._sceneManager.clearSelection();
      }
    });
  },

  _repositionRemaining: function(list) {
    if (!this._sceneManager) return;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.instanceId) {
        this._sceneManager.repositionCabinet(c.instanceId, c.wallStartCm, c.widthCm, c.isCustom);
      }
    }
  },

  onResetCamera: function() {
    if (this._sceneManager) this._sceneManager.resetCamera();
  },

  onSaveLayout: function() {
    var self = this;
    if (self.data.cabinets.length === 0) {
      wx.showToast({ title: '请先添加柜子', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '保存方案', editable: true, placeholderText: '方案名',
      success: function(modal) {
        if (!modal.confirm) return;
        var name = (modal.content || '').trim() || '未命名方案';
        wx.showLoading({ title: '保存中...' });
        var serialCabinets = self.data.cabinets.map(function(c) {
          return {
            widthCm: c.widthCm, isCustom: c.isCustom,
            wallStartCm: c.wallStartCm,
            scale: { x: c.scale.x, y: c.scale.y, z: c.scale.z },
            modelId: c.modelId
          };
        });
        storage.saveLayout({
          id: self.data.currentLayoutId || null,
          name: name,
          photoPath: self._photoTempPath,
          wall: {
            width: parseInt(self.data.wallWidth, 10),
            height: parseInt(self.data.wallHeight, 10),
            depth: parseInt(self.data.wallDepth, 10)
          },
          cabinets: serialCabinets
        }).then(function(saved) {
          wx.hideLoading();
          self._photoTempPath = saved.photoPath;
          self.setData({ currentLayoutId: saved.id });
          wx.showToast({ title: '已保存', icon: 'success' });
        }).catch(function(err) {
          wx.hideLoading();
          console.error(err);
          wx.showToast({ title: '保存失败', icon: 'none' });
        });
      }
    });
  },

  openLayoutDrawer: function() {
    this.setData({ drawerOpen: true, savedLayouts: storage.listLayouts() });
  },
  closeLayoutDrawer: function() { this.setData({ drawerOpen: false }); },

  onLoadLayout: function(e) {
    var self = this;
    var id = e.currentTarget.dataset.id;
    var l = storage.loadLayout(id);
    if (!l) { wx.showToast({ title: '方案不存在', icon: 'none' }); return; }
    self._teardownScene();
    self._photoTempPath = l.photoPath;
    self.setData({
      mode: 'placing', drawerOpen: false,
      wallWidth: l.wall.width, wallHeight: l.wall.height, wallDepth: l.wall.depth,
      cabinets: [], currentLayoutId: l.id,
      selectedInstanceId: ''
    });
    self._initRetry = 0;
    setTimeout(function() {
      self._initScene();
      setTimeout(function() { self._restoreCabinetsFrom(l.cabinets); }, 700);
    }, 200);
  },

  _restoreCabinetsFrom: function(cabSpecs) {
    var self = this;
    if (!self._sceneManager) return;
    var added = [];
    function addNext(idx) {
      if (idx >= cabSpecs.length) {
        self.setData({ cabinets: added });
        return;
      }
      var c = cabSpecs[idx];
      var path = catalog.getModelPath(c.modelId || '100G1');
      self._sceneManager.addCabinet({
        modelId: c.modelId || '100G1',
        modelPath: path,
        widthCm: c.widthCm,
        wallStartCm: c.wallStartCm,
        isCustom: c.isCustom,
        scale: c.scale
      }).then(function(instanceId) {
        added.push({
          instanceId: instanceId, modelId: c.modelId || '100G1',
          widthCm: c.widthCm, isCustom: c.isCustom,
          wallStartCm: c.wallStartCm,
          scale: { x: c.scale.x, y: c.scale.y, z: c.scale.z }
        });
        addNext(idx + 1);
      }).catch(function() { addNext(idx + 1); });
    }
    addNext(0);
  },

  onDeleteLayout: function(e) {
    var self = this;
    var id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除方案', content: '确定删除该方案？',
      success: function(modal) {
        if (!modal.confirm) return;
        storage.deleteLayout(id);
        self.setData({ savedLayouts: storage.listLayouts() });
        if (self.data.currentLayoutId === id) {
          self.setData({ currentLayoutId: '' });
        }
      }
    });
  },

  goBack: function() { wx.navigateBack({ delta: 1 }); },

  onShareAppMessage: function(res) {
    return require('../../../utils/share.js').onShare('pd3d', this, res);
  },
  onShareTimeline: function() {
    return require('../../../utils/share.js').onTimeline('pd3d', this);
  }
});
