var app = getApp();
var assets = require('../../utils/assets.js');
var layoutCompute = require('../../utils/layoutCompute.js');
var perspective = require('../../utils/perspective.js');

// ====== 性能优化：日志开关 ======
// 生产环境关闭调试日志；需排查问题时临时改为 true 即可。
// layout.js 原有 57 处 console.log 集中在 Canvas 绘制热路径上，
// 频繁 IPC 传输+真机控制台渲染会显著拖慢帧率。
var DEBUG = false;
var log = DEBUG ? console.log.bind(console) : function() {};
var logWarn = DEBUG ? console.warn.bind(console) : function() {};

Page({
  data: {
    // 设计基础信息
    designId: '',
    designName: '',
    cornerType: 'WZJ',
    cornerLabel: '',
    wallWidth: 0,
    wallHeight: 0,

    // 布局计算结果
    standardWidth: 0,    // x: 标准模块可摆放总宽度
    customWidth: 0,      // e: 非标模块宽度
    cornerCount: 0,      // z: 转角柜数量
    remainingStdWidth: 0, // 剩余标准宽度

    // 当前状态
    modules: [],          // 已放置的模块列表
    currentStep: 0,       // 当前步骤索引
    totalSteps: 0,        // 总步骤数
    selectedWidth: 50,
    selectedModule: 'a',
    selectedColor: 'white',  // 当前选中颜色: 'white' | 'cream' | 'other'
    showDoor: false,
    isCustomModule: false,
    isLastModule: false,
    canSelect50: true,
    canSelect100: true,

    // 可选模块（标准）
    availableModules: [],

    // 弹窗
    showResetModal: false,
    showSaveModal: false,

    // 保存状态（一次 layout 只能保存一次，保存成功后从 cost 页返回时锁死按钮）
    hasSaved: false,

    // Canvas
    canvasReady: false,
    canvasWidth: 360,
    canvasHeight: 300,
    previewImagePath: '',  // Canvas截图路径（弹窗时用图片替代Canvas避免遮挡）

    // 照片透视模式
    photoMode: false,
    photoPath: '',
    photoCorners: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 }
    ],
    draggingCorner: -1,

    // 导航栏
    statusBarHeight: 20,
    navBarHeight: 44
  },

  // 图片缓存
  _imageCache: {},
  _photoImg: null,
  _canvas: null,
  _ctx: null,
  _canvasRetry: 0,

  onLoad(options) {
    log('[Layout] onLoad 触发, options:', JSON.stringify(options));
    // 获取系统信息设置导航栏高度
    var statusBarHeight = 20;
    var navBarHeight = 44;
    try {
      var sysInfo = wx.getWindowInfo();
      var menuBtn = wx.getMenuButtonBoundingClientRect();
      statusBarHeight = sysInfo.statusBarHeight || 20;
      navBarHeight = (menuBtn.top - statusBarHeight) * 2 + menuBtn.height;
    } catch (e) {
      // 使用默认值
    }

    var id = options.id;
    var name = options.name;
    var corner = options.corner;
    var width = options.width;
    var height = options.height;
    var cornerLabel = options.cornerLabel;
    
    var w = parseInt(width);
    var h = parseInt(height);
    var params = layoutCompute.computeParams(w, corner);
    var cornerCount = params.cornerCount;
    var standardWidth = params.standardWidth;
    var customWidth = params.customWidth;

    // 合并为一次 setData，减少渲染通信开销
    this.setData({
      statusBarHeight: statusBarHeight,
      navBarHeight: navBarHeight,
      designId: id,
      designName: decodeURIComponent(name),
      cornerType: corner,
      cornerLabel: decodeURIComponent(cornerLabel),
      wallWidth: w,
      wallHeight: h,
      standardWidth: standardWidth,
      customWidth: customWidth,
      cornerCount: cornerCount,
      remainingStdWidth: standardWidth
    });

    log('[Layout] 数据初始化完成:', JSON.stringify({
      designId: id, cornerType: corner, wallWidth: w, wallHeight: h,
      standardWidth: standardWidth, customWidth: customWidth, cornerCount: cornerCount
    }));
    this.initModules();
  },

  onReady: function() {
    // onReady 确保 WXML 已经渲染完毕，此时初始化 Canvas
    log('[Canvas] onReady 触发，准备初始化 Canvas');
    var self = this;
    self._canvasRetry = 0;
    self._hasEverReady = true;
    // 先尝试立即初始化
    self.initCanvas();
  },

  onShow: function() {
    // 页面从 cost 返回时（navigateBack）会触发 onShow，但 onReady 不会再触发。
    // 此时 Canvas 2D 上下文因页面 hide 已失效，modules 数据还在 data 里，
    // 复用 _reinitCanvasAfterModal（清旧引用 → 延时 initCanvas → preloadAndDraw）重绘。
    // 首次进入页面：onLoad → onShow → onReady，此时 _hasEverReady 还没置位，跳过即可，
    // 由 onReady 负责首次初始化。
    if (this._hasEverReady) {
      log('[Canvas] onShow 触发（返回场景），重新初始化 Canvas 并重绘');
      this._reinitCanvasAfterModal();
    }
  },

  /**
   * 选择照片（拍照或相册）
   */
  choosePhoto() {
    var self = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        var tempPath = res.tempFilePaths[0];
        if (!tempPath) return;
        self._loadPhotoToCanvas(tempPath);
      },
      fail: function(err) {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '选择照片失败', icon: 'none' });
        }
      }
    });
  },

  /**
   * 将照片加载到 Canvas Image 对象中
   */
  _loadPhotoToCanvas(tempPath) {
    var self = this;
    if (!self._canvas) {
      wx.showToast({ title: 'Canvas 未就绪，请稍后重试', icon: 'none' });
      return;
    }
    var img = self._canvas.createImage();
    img.onload = function() {
      self._photoImg = img;
      self._initDefaultCorners();
      self.setData({
        photoMode: true,
        photoPath: tempPath
      });
      self._scheduleDraw();
    };
    img.onerror = function() {
      wx.showToast({ title: '照片加载失败', icon: 'none' });
    };
    img.src = tempPath;
  },

  /**
   * 初始化默认角点：Canvas 区域向内缩进 20%
   */
  _initDefaultCorners() {
    var cw = this.data.canvasWidth;
    var ch = this.data.canvasHeight;
    this.setData({
      photoCorners: [
        { x: cw * 0.2, y: ch * 0.2 },
        { x: cw * 0.8, y: ch * 0.2 },
        { x: cw * 0.8, y: ch * 0.8 },
        { x: cw * 0.2, y: ch * 0.8 }
      ]
    });
  },

  /**
   * 移除照片，回到抽象 3D 视图
   */
  removePhoto() {
    this._photoImg = null;
    this.setData({
      photoMode: false,
      photoPath: '',
      draggingCorner: -1
    });
    this._scheduleDraw();
  },

  /**
   * Canvas touchstart — 检测是否命中角标
   */
  onCanvasTouchStart(e) {
    if (!this.data.photoMode) return;
    var touches = e.touches;
    if (!touches || touches.length === 0) return;

    var touch = touches[0];
    var corners = this.data.photoCorners;
    var hitRadius = 20;
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

  /**
   * Canvas touchmove — 拖拽角标
   */
  onCanvasTouchMove(e) {
    if (!this.data.photoMode || this.data.draggingCorner < 0) return;
    var touches = e.touches;
    if (!touches || touches.length === 0) return;

    var touch = touches[0];
    var idx = this.data.draggingCorner;
    var corners = this.data.photoCorners.slice();

    // 限制在 Canvas 范围内
    corners[idx] = {
      x: Math.max(5, Math.min(this.data.canvasWidth - 5, touch.x)),
      y: Math.max(5, Math.min(this.data.canvasHeight - 5, touch.y))
    };

    this.setData({ photoCorners: corners });
    this._scheduleDraw();
  },

  /**
   * Canvas touchend — 结束拖拽
   */
  onCanvasTouchEnd() {
    if (this.data.draggingCorner >= 0) {
      this.setData({ draggingCorner: -1 });
    }
  },

  initModules() {
    // 初始化模块为标准模块选择，更新可选模块列表
    this.updateAvailableModules();
    this.updateWidthOptions();
  },

  goBack() {
    wx.navigateBack({
      fail: function() {
        wx.switchTab({ url: '/pages/design/design' });
      }
    });
  },

  updateAvailableModules() {
    var data = this.data;
    var modules = layoutCompute.getAvailableModules(
      data.selectedWidth,
      data.customWidth,
      data.isCustomModule,
      assets.picture
    );
    this.setData({ availableModules: modules });
  },

  getNearestEWidth(w) {
    return layoutCompute.getNearestEWidth(w);
  },

  /**
   * 获取加高模块最接近的可用高度
   * 标准模块(50/100): 可用 25,35,45,55,65,75,85,95
   * 非标模块(e): 可用 25,35,45,55,65,75,85,95
   * 转角柜(z/y): 可用 25,55,75
   */
  getNearestGapHeight(gapH, isCorner) {
    var available;
    if (isCorner) {
      available = [25, 55, 75];
    } else {
      available = [25, 35, 45, 55, 65, 75, 85, 95];
    }
    var nearest = available[0];
    var minDiff = Infinity;
    for (var i = 0; i < available.length; i++) {
      var diff = Math.abs(available[i] - gapH);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = available[i];
      }
    }
    return nearest;
  },

  updateWidthOptions() {
    var remainingStdWidth = this.data.remainingStdWidth;
    var canSelect50 = remainingStdWidth >= 50;
    var canSelect100 = remainingStdWidth >= 100;
    
    if (remainingStdWidth === 50) {
      canSelect100 = false;
    }

    var selectedWidth = this.data.selectedWidth;
    if (!canSelect100 && selectedWidth === 100) {
      selectedWidth = 50;
    }

    this.setData({ canSelect50: canSelect50, canSelect100: canSelect100, selectedWidth: selectedWidth });
    this.updateAvailableModules();
  },

  selectWidth(e) {
    var width = parseInt(e.currentTarget.dataset.width);
    this.setData({ selectedWidth: width });
    this.updateAvailableModules();
    this.drawPreview();
  },

  selectModule(e) {
    var type = e.currentTarget.dataset.type;
    this.setData({ selectedModule: type });
    this.drawPreview();
  },

  selectColor(e) {
    var color = e.currentTarget.dataset.color;
    if (color === 'other') {
      // "其它颜色"打开联系客服提示
      wx.showModal({
        title: '定制颜色',
        content: '其它颜色需联系客服定制，请前往「我的」页面联系我们。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    this.setData({ selectedColor: color });
    // 颜色切换后预加载颜色图片并重新绘制
    this.preloadAndDraw();
  },

  prevModule() {
    var modules = this.data.modules;
    if (modules.length === 0) return;
    
    var removed = modules.pop();
    
    var remainingStdWidth = this.data.remainingStdWidth;
    if (removed.isStandard) {
      remainingStdWidth += removed.width;
    }

    var isCustomModule = remainingStdWidth <= 0;
    var isLastModule = isCustomModule;

    this.setData({ 
      modules: modules, 
      remainingStdWidth: remainingStdWidth,
      isCustomModule: isCustomModule,
      isLastModule: isLastModule
    });
    
    this.updateWidthOptions();
    this.preloadAndDraw();
  },

  nextModule() {
    var data = this.data;
    // 已保存过的布局不再允许二次确认，避免产生重复设计
    if (data.hasSaved) {
      wx.showToast({
        title: '该布局已保存，如需修改请返回重新创建',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    var isLastModule = data.isLastModule;
    var isCustomModule = data.isCustomModule;
    var selectedModule = data.selectedModule;
    var selectedWidth = data.selectedWidth;
    var customWidth = data.customWidth;
    var modules = data.modules;
    var remainingStdWidth = data.remainingStdWidth;
    var wallHeight = data.wallHeight;

    var moduleWidth = isCustomModule ? customWidth : selectedWidth;
    var gapHeight = wallHeight - 230 - 2;

    if (isLastModule) {
      // 最后一个模块也要加入 modules 数组，否则保存时会丢失
      var lastModule = {
        type: selectedModule,
        width: moduleWidth,
        height: 230,
        gapHeight: gapHeight,
        isStandard: !isCustomModule,
        isCustom: isCustomModule
      };
      modules.push(lastModule);
      // 同时标记所有模块已放置完毕，避免预览逻辑干扰最终绘制
      this.setData({ 
        modules: modules,
        isLastModule: true,
        isCustomModule: isCustomModule
      });
      // 等图片全部加载完成后再绘制并截图，避免加高/收口条图片未加载导致上方缺失
      var self = this;
      var paths = self.collectImagePaths();
      self.loadImages(paths).then(function() {
        self._doDrawPreview();
        // 确保绘制完成后再截图
        setTimeout(function() {
          self._captureCanvasAndShowModal('showSaveModal');
        }, 150);
      }).catch(function() {
        // 即使部分图片加载失败也尝试绘制
        self._doDrawPreview();
        setTimeout(function() {
          self._captureCanvasAndShowModal('showSaveModal');
        }, 150);
      });
      return;
    }

    var newModule = {
      type: selectedModule,
      width: moduleWidth,
      height: 230,
      gapHeight: gapHeight,
      isStandard: !isCustomModule,
      isCustom: isCustomModule
    };
    
    modules.push(newModule);

    var newRemaining = remainingStdWidth;
    if (!isCustomModule) {
      newRemaining -= selectedWidth;
    }

    var nextIsCustom = newRemaining <= 0;
    var nextIsLast = nextIsCustom;

    this.setData({
      modules: modules,
      remainingStdWidth: newRemaining,
      isCustomModule: nextIsCustom,
      isLastModule: nextIsLast,
      selectedModule: 'a'
    });

    this.updateWidthOptions();
    this.preloadAndDraw();
  },

  toggleDoor() {
    this.setData({ showDoor: !this.data.showDoor });
    this.preloadAndDraw();
  },

  resetWall() {
    this._captureCanvasAndShowModal('showResetModal');
  },

  cancelReset() {
    this.setData({ showResetModal: false, previewImagePath: '' });
    // 弹窗关闭后 Canvas DOM 会重新创建，需要重新初始化
    this._reinitCanvasAfterModal();
  },

  confirmReset() {
    this.setData({ showResetModal: false, previewImagePath: '' });
    wx.redirectTo({ url: '/packageDesign/preset/preset' });
  },

  cancelSave() {
    this.setData({ showSaveModal: false, previewImagePath: '' });
    // 弹窗关闭后 Canvas DOM 会重新创建，需要重新初始化
    this._reinitCanvasAfterModal();
  },

  confirmSave() {
    var self = this;
    var data = this.data;

    var design = {
      id: data.designId,
      name: data.designName,
      cornerType: data.cornerType,
      cornerLabel: data.cornerLabel,
      wallWidth: data.wallWidth,
      wallHeight: data.wallHeight,
      customWidth: data.customWidth,
      selectedColor: data.selectedColor,
      modules: data.modules.map(function(m) {
        return {
          type: m.type,
          width: m.width,
          height: m.height,
          gapHeight: m.gapHeight,
          isStandard: m.isStandard,
          isCustom: m.isCustom
        };
      })
    };

    wx.showLoading({ title: '保存中...', mask: true });

    // 最终保存到云数据库并跳转
    var writeToCloudAndNavigate = function(fileID) {
      design.previewFileID = fileID || '';
      // 全局内存保留本次预览图，cost 页首屏可立即显示（免去再拉 fileID 转 https 的延迟）
      app.globalData.currentDesignPreview = fileID || data.previewImagePath || '';

      app.saveDesign(design).then(function(result) {
        wx.hideLoading();
        if (result.success) {
          // 标记已保存，防止从 cost 返回后再次点击"确认布局"生成重复设计
          self.setData({ showSaveModal: false, previewImagePath: '', hasSaved: true });
          wx.showToast({ title: '保存成功', icon: 'success' });
          setTimeout(function() {
            wx.navigateTo({ url: '/packageDesign/cost/cost?id=' + result._id });
          }, 1000);
        } else {
          wx.showModal({
            title: '提示',
            content: result.msg || '保存失败',
            showCancel: false
          });
        }
      });
    };

    // 把 tempFilePath 上传到云存储，拿到 fileID；失败则用空串兜底
    var uploadToCloud = function(tempPath) {
      if (!tempPath || !wx.cloud) {
        writeToCloudAndNavigate('');
        return;
      }
      var cloudPath = 'designs/' + (design.id || Date.now()) + '_' + Date.now() + '.png';
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempPath,
        success: function(res) {
          log('[confirmSave] 云存储上传成功:', res.fileID);
          writeToCloudAndNavigate(res.fileID);
        },
        fail: function(err) {
          logWarn('[confirmSave] 云存储上传失败:', err);
          writeToCloudAndNavigate('');
        }
      });
    };

    /**
     * 关键：弹窗打开时 Canvas DOM 已被 wx:if 销毁，self._canvas 失效，
     * 此时再调 canvasToTempFilePath 会失败。
     * 正确做法是复用 _captureCanvasAndShowModal 在弹窗打开前已截好的
     * data.previewImagePath（也就是用户此刻在弹窗里看到的那张整体渲染图）。
     */
    var existingTempPath = data.previewImagePath;
    if (existingTempPath) {
      log('[confirmSave] 复用弹窗前已截的临时图:', existingTempPath);
      uploadToCloud(existingTempPath);
    } else if (self._canvas) {
      // 兜底：临时图不存在，则尝试用当前 canvas 再截一次（可能失败）
      try {
        wx.canvasToTempFilePath({
          canvas: self._canvas,
          success: function(res) {
            log('[confirmSave] Canvas 截图成功:', res.tempFilePath);
            uploadToCloud(res.tempFilePath);
          },
          fail: function(err) {
            logWarn('[confirmSave] Canvas 截图失败:', err);
            writeToCloudAndNavigate('');
          }
        });
      } catch (e) {
        logWarn('[confirmSave] Canvas 截图异常:', e);
        writeToCloudAndNavigate('');
      }
    } else {
      writeToCloudAndNavigate('');
    }
  },

  /**
   * 截图Canvas并显示弹窗
   * 微信小程序Canvas是原生组件，层级最高会遮挡弹窗
   * 通过截图后隐藏Canvas，用image替代显示来解决
   */
  _captureCanvasAndShowModal(modalField) {
    var self = this;
    if (!self._canvas) {
      // Canvas不可用时直接显示弹窗
      var obj = {};
      obj[modalField] = true;
      self.setData(obj);
      return;
    }

    try {
      wx.canvasToTempFilePath({
        canvas: self._canvas,
        success: function(res) {
          var obj = { previewImagePath: res.tempFilePath };
          obj[modalField] = true;
          self.setData(obj);
        },
        fail: function() {
          // 截图失败时仍然显示弹窗
          var obj = {};
          obj[modalField] = true;
          self.setData(obj);
        }
      });
    } catch (e) {
      var obj = {};
      obj[modalField] = true;
      self.setData(obj);
    }
  },

  /**
   * 弹窗关闭后重新初始化 Canvas
   * 由于 wx:if 条件渲染，弹窗显示时 Canvas DOM 被销毁，
   * 关闭弹窗后 Canvas DOM 重新创建，旧的 _canvas/_ctx 引用已失效，
   * 需要延时等待新 DOM 渲染完成后重新初始化。
   */
  _reinitCanvasAfterModal() {
    var self = this;
    // 清除旧引用
    self._canvas = null;
    self._ctx = null;
    self._canvasRetry = 0;
    self.setData({ canvasReady: false });
    // 等待 setData 和 DOM 更新完成后再初始化
    setTimeout(function() {
      log('[Canvas] 弹窗关闭，重新初始化 Canvas');
      self.initCanvas();
    }, 300);
  },

  // ===================== Canvas 图片渲染引擎 =====================

  /**
   * 初始化 Canvas 2D（带重试机制）
   */
  initCanvas() {
    var self = this;
    log('[Canvas] 开始初始化, 第' + (self._canvasRetry + 1) + '次尝试');
    
    // 使用 this.createSelectorQuery() —— 微信官方推荐写法
    var query = self.createSelectorQuery();
    query.select('#previewCanvas')
      .fields({ node: true, size: true })
      .exec(function(res) {
        log('[Canvas] SelectorQuery exec 回调');
        log('[Canvas] res 类型:', typeof res, ', 是否数组:', Array.isArray(res));
        
        if (!res) {
          console.error('[Canvas] res 为 null/undefined');
          self._retryCanvas();
          return;
        }
        
        log('[Canvas] res 长度:', res.length);
        log('[Canvas] res[0]:', JSON.stringify(res[0]));
        
        if (!res[0]) {
          console.error('[Canvas] res[0] 为空');
          self._retryCanvas();
          return;
        }
        
        if (!res[0].node) {
          console.error('[Canvas] res[0].node 不存在, keys:', Object.keys(res[0]).join(','));
          self._retryCanvas();
          return;
        }
        
        var canvas = res[0].node;
        log('[Canvas] 获取到 canvas node, 类型:', typeof canvas);
        
        var ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.error('[Canvas] getContext("2d") 返回 null');
          self._retryCanvas();
          return;
        }
        
        // 获取 Canvas 在页面中的实际渲染尺寸
        var renderWidth = res[0].width;
        var renderHeight = res[0].height;
        log('[Canvas] 渲染尺寸 from SelectorQuery:', renderWidth, 'x', renderHeight);
        
        // 如果获取不到实际尺寸，使用 data 中的默认值
        var canvasWidth = renderWidth || self.data.canvasWidth || 360;
        var canvasHeight = renderHeight || self.data.canvasHeight || 300;
        
        // 获取设备像素比
        var dpr = 2;
        try {
          dpr = wx.getWindowInfo().pixelRatio || 2;
        } catch(e) {
          try {
            dpr = wx.getSystemInfoSync().pixelRatio || 2;
          } catch(e2) {
            dpr = 2;
          }
        }

        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
        ctx.scale(dpr, dpr);
        
        self._canvas = canvas;
        self._ctx = ctx;
        self._dpr = dpr;
        self._imageCache = {};
        
        self.setData({ 
          canvasReady: true,
          canvasWidth: canvasWidth,
          canvasHeight: canvasHeight
        });

        log('[Canvas] 初始化成功! 逻辑尺寸:', canvasWidth, 'x', canvasHeight, ', DPR:', dpr, ', 物理像素:', canvas.width, 'x', canvas.height);

        // 测试绘制：画一个背景确认 Canvas 可用
        ctx.fillStyle = '#F4F2EB';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Canvas 初始化成功，正在加载...', canvasWidth / 2, canvasHeight / 2);
        ctx.textAlign = 'start';
        log('[Canvas] 测试绘制完成');

        // 先绘制3D背景，不等图片加载
        self._doDrawPreview();
        // 然后异步预加载图片并重绘
        self.preloadAndDraw();
      });
  },

  _retryCanvas() {
    var self = this;
    self._canvasRetry++;
    if (self._canvasRetry < 8) {
      // 性能优化：前几次快速重试，从 500ms 起步太长，真机上首屏会明显发白
      var delay = self._canvasRetry <= 3 ? 150 : 300;
      log('[Canvas] 将在 ' + delay + 'ms 后重试(第' + self._canvasRetry + '次)');
      setTimeout(function() {
        self.initCanvas();
      }, delay);
    } else {
      console.error('[Canvas] 初始化失败，已达到最大重试次数(8次)');
      // 最终兜底: 1.5秒后再试一次
      setTimeout(function() {
        self._canvasRetry = 0;
        self.initCanvas();
      }, 1500);
    }
  },

  /**
   * 在 Canvas 上加载一张图片
   * cloud:// 协议的图片需要先通过 wx.cloud.getTempFileURL 转为临时HTTP URL
   * Canvas 2D 的 createImage 不能直接使用 cloud:// 协议
   */
  loadImage(src) {
    var self = this;
    return new Promise(function(resolve, reject) {
      if (self._imageCache[src]) {
        resolve(self._imageCache[src]);
        return;
      }
      if (!self._canvas) {
        logWarn('[loadImage] Canvas 未初始化, 跳过:', src);
        reject(new Error('Canvas 未初始化'));
        return;
      }

      // cloud:// 协议需要先转为临时HTTP链接
      if (src.indexOf('cloud://') === 0) {
        // 先检查是否已有缓存的临时URL
        if (self._tempUrlCache && self._tempUrlCache[src]) {
          self._loadImageToCanvas(self._tempUrlCache[src], src, resolve, reject);
          return;
        }
        wx.cloud.getTempFileURL({
          fileList: [src],
          success: function(res) {
            if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
              var tempUrl = res.fileList[0].tempFileURL;
              if (!self._tempUrlCache) self._tempUrlCache = {};
              self._tempUrlCache[src] = tempUrl;
              self._loadImageToCanvas(tempUrl, src, resolve, reject);
            } else {
              logWarn('[loadImage] getTempFileURL 返回为空:', src);
              reject(new Error('getTempFileURL 失败'));
            }
          },
          fail: function(err) {
            logWarn('[loadImage] getTempFileURL 失败:', src, err);
            reject(err);
          }
        });
      } else {
        self._loadImageToCanvas(src, src, resolve, reject);
      }
    });
  },

  /**
   * 实际将图片加载到 Canvas Image 对象
   * @param {string} actualSrc - 实际加载的URL（HTTP链接）
   * @param {string} cacheKey - 缓存使用的key（原始cloud://路径）
   */
  _loadImageToCanvas(actualSrc, cacheKey, resolve, reject) {
    var self = this;
    var img = self._canvas.createImage();
    img.onload = function() {
      self._imageCache[cacheKey] = img;
      resolve(img);
    };
    img.onerror = function(err) {
      logWarn('[_loadImageToCanvas] 图片加载失败:', cacheKey.substring(cacheKey.lastIndexOf('/') + 1), ', actualSrc:', actualSrc);
      reject(err);
    };
    img.src = actualSrc;
  },

  /**
   * 批量加载图片
   * 对 cloud:// 路径先批量获取临时URL，再分批加载到Canvas
   */
  loadImages(srcs) {
    var self = this;
    var results = {};

    // 分离 cloud:// 路径和普通路径
    var cloudSrcs = [];
    var normalSrcs = [];
    for (var i = 0; i < srcs.length; i++) {
      if (self._imageCache[srcs[i]]) {
        results[srcs[i]] = self._imageCache[srcs[i]];
      } else if (srcs[i].indexOf('cloud://') === 0) {
        // 检查是否已有缓存的临时URL
        if (self._tempUrlCache && self._tempUrlCache[srcs[i]]) {
          normalSrcs.push(srcs[i]);
        } else {
          cloudSrcs.push(srcs[i]);
        }
      } else {
        normalSrcs.push(srcs[i]);
      }
    }

    // 批量获取 cloud:// 的临时URL
    var tempUrlPromise;
    if (cloudSrcs.length > 0) {
      tempUrlPromise = new Promise(function(resolve) {
        // getTempFileURL 最多支持50个文件，分批处理
        var batches = [];
        for (var b = 0; b < cloudSrcs.length; b += 50) {
          batches.push(cloudSrcs.slice(b, b + 50));
        }
        var chain = Promise.resolve();
        batches.forEach(function(batch) {
          chain = chain.then(function() {
            return new Promise(function(batchResolve) {
              wx.cloud.getTempFileURL({
                fileList: batch,
                success: function(res) {
                  if (!self._tempUrlCache) self._tempUrlCache = {};
                  if (res.fileList) {
                    for (var j = 0; j < res.fileList.length; j++) {
                      var item = res.fileList[j];
                      if (item.tempFileURL) {
                        self._tempUrlCache[item.fileID] = item.tempFileURL;
                        normalSrcs.push(item.fileID);
                      } else {
                        logWarn('[loadImages] 临时URL为空! fileID:', item.fileID, ', status:', item.status, ', errMsg:', item.errMsg);
                      }
                    }
                  }
                  batchResolve();
                },
                fail: function(err) {
                  logWarn('[loadImages] 批量获取临时URL失败:', err);
                  batchResolve();
                }
              });
            });
          });
        });
        chain.then(resolve);
      });
    } else {
      tempUrlPromise = Promise.resolve();
    }

    return tempUrlPromise.then(function() {
      // 分批加载图片到 Canvas
      var chain = Promise.resolve();
      var batchSize = 5;
      var loadBatches = [];
      for (var i = 0; i < normalSrcs.length; i += batchSize) {
        loadBatches.push(normalSrcs.slice(i, i + batchSize));
      }
      loadBatches.forEach(function(batch) {
        chain = chain.then(function() {
          var promises = batch.map(function(src) {
            return self.loadImage(src)
              .then(function(img) { results[src] = img; })
              .catch(function() { results[src] = null; });
          });
          return Promise.all(promises);
        });
      });
      return chain.then(function() {
        return results;
      });
    });
  },

  /**
   * 收集当前设计需要的所有图片路径
   */
  collectImagePaths() {
    var data = this.data;
    var cornerType = data.cornerType;
    var modules = data.modules;
    var wallHeight = data.wallHeight;
    var showDoor = data.showDoor;
    var customWidth = data.customWidth;
    var selectedModule = data.selectedModule;
    var selectedWidth = data.selectedWidth;
    var isCustomModule = data.isCustomModule;
    var isLastModule = data.isLastModule;
    
    var paths = [];
    var gapH = wallHeight - 230 - 2;

    // 颜色叠层图片（米色时需要加载 MI.png）
    if (data.selectedColor === 'cream') {
      paths.push(assets.color('MI'));
    }

    // 收口条
    paths.push(assets.picture('SK/SK-2-230'));
    paths.push(assets.picture('SK/SK-300-2'));

    // 左转角柜
    if (cornerType === 'ZZJ' || cornerType === 'ZYZJ') {
      paths.push(assets.picture('z/z-110-230'));
      if (showDoor) paths.push(assets.picture('z/z-110-230G'));
      if (gapH > 0) {
        var nearestGH = this.getNearestGapHeight(gapH, true);
        paths.push(assets.picture('z/zg-110-' + nearestGH));
        if (showDoor) paths.push(assets.picture('z/zg-110-' + nearestGH + 'G'));
      }
    }

    // 右转角柜
    if (cornerType === 'YZJ' || cornerType === 'ZYZJ') {
      paths.push(assets.picture('y/y-110-230'));
      if (showDoor) paths.push(assets.picture('y/y-110-230G'));
      if (gapH > 0) {
        var nearestGHy = this.getNearestGapHeight(gapH, true);
        paths.push(assets.picture('y/yg-110-' + nearestGHy));
        if (showDoor) paths.push(assets.picture('y/yg-110-' + nearestGHy + 'G'));
      }
    }

    // 已放置的模块
    for (var i = 0; i < modules.length; i++) {
      this._collectModulePaths(paths, modules[i], gapH, showDoor);
    }

    // 当前选择的模块预览（条件与 _doDrawPreview 中 allModulesPlaced 保持一致）
    var customModules = [];
    for (var j = 0; j < modules.length; j++) {
      if (modules[j].isCustom) customModules.push(modules[j]);
    }
    var allModulesPlacedForPaths = isLastModule && isCustomModule && customModules.length > 0;
    if (!allModulesPlacedForPaths) {
      var previewModule = {
        type: selectedModule,
        width: isCustomModule ? customWidth : selectedWidth,
        isStandard: !isCustomModule,
        isCustom: isCustomModule
      };
      this._collectModulePaths(paths, previewModule, gapH, showDoor);
    }

    // 去重
    var unique = [];
    var seen = {};
    for (var k = 0; k < paths.length; k++) {
      if (!seen[paths[k]]) {
        seen[paths[k]] = true;
        unique.push(paths[k]);
      }
    }
    return unique;
  },

  /**
   * 收集单个模块的图片路径
   */
  _collectModulePaths(paths, m, gapH, showDoor) {
    if (m.isStandard) {
      paths.push(assets.picture(m.width + '/' + m.type + '-' + m.width + '-230'));
      if (showDoor) {
        paths.push(assets.picture(m.width + '/m-' + m.width + '-230G'));
      }
      if (gapH > 0) {
        var nearestGH = this.getNearestGapHeight(gapH, false);
        paths.push(assets.picture(m.width + '/g-' + m.width + '-' + nearestGH));
        if (showDoor) {
          paths.push(assets.picture(m.width + '/gm-' + m.width + '-30'));
        }
      }
    } else {
      var ew = this.getNearestEWidth(m.width);
      paths.push(assets.picture('e/' + m.type + '-' + ew + '-230'));
      if (showDoor) {
        var doorW = m.width > 75 ? 100 : 50;
        paths.push(assets.picture('e/m-' + doorW + '-230G'));
      }
      if (gapH > 0) {
        var nearGH = this.getNearestGapHeight(gapH, false);
        paths.push(assets.picture('e/g/g-' + ew + '-' + nearGH));
        if (showDoor) {
          var gmW = m.width > 75 ? 100 : 50;
          paths.push(assets.picture('e/g/gm-' + gmW + '-' + (gmW === 100 ? 60 : 30)));
        }
      }
    }
  },

  /**
   * 预加载图片并绘制
   * 性能优化：
   * 1) 只加载"尚未缓存"的新图片，避免重复请求已加载模块的高清图
   * 2) 绘制走节流（rAF 合并），短时间多次点击只绘一次
   */
  preloadAndDraw() {
    var self = this;
    if (!self._canvas || !self._ctx) {
      logWarn('[preloadAndDraw] Canvas 未就绪，跳过绘制');
      return;
    }
    var paths = self.collectImagePaths();
    var needLoad = [];
    for (var i = 0; i < paths.length; i++) {
      if (!self._imageCache[paths[i]]) {
        needLoad.push(paths[i]);
      }
    }
    if (needLoad.length === 0) {
      self._scheduleDraw();
      return;
    }
    self.loadImages(needLoad).then(function() {
      self._scheduleDraw();
    }).catch(function(err) {
      console.error('[preloadAndDraw] 加载失败:', err);
      self._scheduleDraw(); // 即使部分失败也尝试绘制
    });
  },

  /**
   * drawPreview - 外部调用入口（选择模块/宽度时触发）
   */
  drawPreview() {
    var self = this;
    if (!self._ctx || !self._canvas) {
      logWarn('[drawPreview] Canvas 未就绪');
      return;
    }
    // 检查是否有未加载的图片
    var paths = self.collectImagePaths();
    var needLoad = [];
    for (var i = 0; i < paths.length; i++) {
      if (!self._imageCache[paths[i]]) {
        needLoad.push(paths[i]);
      }
    }
    if (needLoad.length > 0) {
      self.loadImages(needLoad).then(function() {
        self._scheduleDraw();
      });
    } else {
      self._scheduleDraw();
    }
  },

  /**
   * 帧调度：合并一次 tick 内的多次重绘请求
   * 用户连续点击 selectWidth / selectModule / selectColor 时
   * 原本会各自触发一次 _doDrawPreview（含几百次 ctx 调用），
   * 合并后只在下一帧画一次。
   */
  _scheduleDraw() {
    var self = this;
    if (self._drawScheduled) return;
    self._drawScheduled = true;
    var run = function() {
      self._drawScheduled = false;
      self._doDrawPreview();
    };
    // 优先用 Canvas 的 requestAnimationFrame（微信 Canvas 2D 原生支持）
    if (self._canvas && typeof self._canvas.requestAnimationFrame === 'function') {
      self._canvas.requestAnimationFrame(run);
    } else {
      setTimeout(run, 16);
    }
  },

  /**
   * 主绘制方法 - 使用真实图片渲染3D透视效果
   */
  _doDrawPreview() {
    if (!this._ctx || !this._canvas) {
      logWarn('[draw] Canvas 未就绪, _ctx:', !!this._ctx, ', _canvas:', !!this._canvas);
      return;
    }

    var ctx = this._ctx;
    var data = this.data;
    var wallWidth = data.wallWidth;
    var wallHeight = data.wallHeight;

    // 重置合成模式为默认值，防止上次绘制的 multiply 模式残留
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    
    log('[draw] 开始绘制, wallWidth:', wallWidth, ', wallHeight:', wallHeight, ', canvasWidth:', data.canvasWidth, ', canvasHeight:', data.canvasHeight);
    
    // 数据校验：确保墙面尺寸有效
    if (!wallWidth || !wallHeight || wallWidth <= 0 || wallHeight <= 0) {
      console.error('[draw] 墙面尺寸无效! wallWidth:', wallWidth, ', wallHeight:', wallHeight);
      // 仍然绘制基础背景，让用户知道 Canvas 是可用的
      ctx.clearRect(0, 0, data.canvasWidth || 360, data.canvasHeight || 300);
      ctx.fillStyle = '#F4F2EB';
      ctx.fillRect(0, 0, data.canvasWidth || 360, data.canvasHeight || 300);
      ctx.fillStyle = '#999';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('墙面数据未就绪', (data.canvasWidth || 360) / 2, (data.canvasHeight || 300) / 2);
      ctx.textAlign = 'start';
      return;
    }
    var cornerType = data.cornerType;
    var modules = data.modules;
    var showDoor = data.showDoor;
    var customWidth = data.customWidth;
    var selectedModule = data.selectedModule;
    var selectedWidth = data.selectedWidth;
    var isCustomModule = data.isCustomModule;
    var isLastModule = data.isLastModule;
    var remainingStdWidth = data.remainingStdWidth;

    var canvasW = data.canvasWidth;
    var canvasH = data.canvasHeight;
    var gapH = wallHeight - 230 - 2; // 加高区域高度（cm）

    // 清空画布
    ctx.clearRect(0, 0, canvasW, canvasH);

    // === 绘制白色背景 ===
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // === 计算墙面矩形 ===
    var bgW = canvasW;      // 360
    var bgH = 260;          // 白色背景区高度

    // 墙面区域留边距，保持比例
    var wallMarginTop = 30, wallMarginBottom = 30, wallMarginLeft = 30, wallMarginRight = 30;
    var availW = bgW - wallMarginLeft - wallMarginRight;
    var availH = bgH - wallMarginTop - wallMarginBottom;

    // 保持真实比例缩放
    var scale = Math.min(availW / wallWidth, availH / wallHeight);
    var wallRectW = wallWidth * scale;
    var wallRectH = wallHeight * scale;

    // 墙面矩形居中
    var wallX = (bgW - wallRectW) / 2;
    var wallY = wallMarginTop + (availH - wallRectH) / 2;

    log('[draw] 墙面尺寸:', wallWidth, 'x', wallHeight, 'cm, 缩放:', scale.toFixed(4), ', 画布位置:', wallX.toFixed(1), wallY.toFixed(1));

    // === 绘制3D透视效果 ===
    // 1. 顶面三角形透视线
    ctx.fillStyle = '#F5F3EE';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(wallX, wallY);
    ctx.lineTo(wallX + wallRectW, wallY);
    ctx.lineTo(bgW, 0);
    ctx.closePath();
    ctx.fill();

    // 透视线
    ctx.strokeStyle = '#E8E5DE';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(wallX, wallY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bgW, 0);
    ctx.lineTo(wallX + wallRectW, wallY);
    ctx.stroke();

    // 2. 墙面矩形
    ctx.fillStyle = '#F4F2EB';
    ctx.fillRect(wallX, wallY, wallRectW, wallRectH);

    // 3. 地面梯形
    var floorTopY = wallY + wallRectH;
    var floorBottomY = bgH;
    ctx.fillStyle = '#D9D9D9';
    ctx.beginPath();
    ctx.moveTo(wallX, floorTopY);
    ctx.lineTo(wallX + wallRectW, floorTopY);
    ctx.lineTo(bgW, floorBottomY);
    ctx.lineTo(0, floorBottomY);
    ctx.closePath();
    ctx.fill();

    // 地面边线
    ctx.strokeStyle = '#CCCAC3';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(wallX, floorTopY);
    ctx.lineTo(0, floorBottomY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wallX + wallRectW, floorTopY);
    ctx.lineTo(bgW, floorBottomY);
    ctx.stroke();

    // === 在墙面区域内绘制衣柜 ===
    var skTopH = 2 * scale;
    var moduleH = 230 * scale;
    var gapPxH = gapH > 0 ? gapH * scale : 0;
    var skSideW = 2 * scale;

    var drawX = wallX;
    var moduleBaseY = wallY + skTopH + gapPxH;
    var gapBaseY = wallY + skTopH;
    var skTopY = wallY;

    var arrowX = drawX;
    var arrowPlaced = false;

    // 1. 左侧收口条（主体 + 加高 + 顶部收口条）
    this.drawImageOnCanvas(ctx, assets.picture('SK/SK-2-230'),
      drawX, moduleBaseY, skSideW, moduleH);
    this._applyColorOverlay(ctx, drawX, moduleBaseY, skSideW, moduleH);
    if (gapPxH > 0) {
      this.drawImageOnCanvas(ctx, assets.picture('SK/SK-2-230'),
        drawX, gapBaseY, skSideW, gapPxH);
      this._applyColorOverlay(ctx, drawX, gapBaseY, skSideW, gapPxH);
    }
    // 左侧收口条顶部收口条
    this.drawImageOnCanvas(ctx, assets.picture('SK/SK-300-2'),
      drawX, skTopY, skSideW, skTopH);
    this._applyColorOverlay(ctx, drawX, skTopY, skSideW, skTopH);
    drawX += skSideW;

    // 2. 左转角柜
    if (cornerType === 'ZZJ' || cornerType === 'ZYZJ') {
      var zW = 110 * scale;
      var zImgSrc = showDoor ? assets.picture('z/z-110-230G') : assets.picture('z/z-110-230');
      this.drawImageOnCanvas(ctx, zImgSrc, drawX, moduleBaseY, zW, moduleH);
      this._applyColorOverlay(ctx, drawX, moduleBaseY, zW, moduleH);
      if (gapH > 0) {
        var nearGH = this.getNearestGapHeight(gapH, true);
        var zgSrc = showDoor
          ? assets.picture('z/zg-110-' + nearGH + 'G')
          : assets.picture('z/zg-110-' + nearGH);
        this.drawImageOnCanvas(ctx, zgSrc, drawX, gapBaseY, zW, gapPxH);
        this._applyColorOverlay(ctx, drawX, gapBaseY, zW, gapPxH);
      }
      this.drawImageOnCanvas(ctx, assets.picture('SK/SK-300-2'),
        drawX, skTopY, zW, skTopH);
      this._applyColorOverlay(ctx, drawX, skTopY, zW, skTopH);
      drawX += zW;
    }

    // 3. 已放置的标准/非标模块
    log('[draw] 已放置模块数:', modules.length, ', gapH:', gapH, ', gapPxH:', gapPxH, ', scale:', scale);
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      var mW = m.width * scale;
      log('[draw] 绘制已放置模块[' + i + ']: type=' + m.type + ', width=' + m.width + ', isStandard=' + m.isStandard + ', isCustom=' + m.isCustom + ', mW=' + mW);
      this._drawModule(ctx, m, drawX, moduleBaseY, gapBaseY, skTopY, mW, moduleH, gapPxH, skTopH, gapH, showDoor);
      drawX += mW;
    }

    // 4. 当前选择的模块预览（实时预览效果）
    var customModules = [];
    for (var j = 0; j < modules.length; j++) {
      if (modules[j].isCustom) customModules.push(modules[j]);
    }
    var allModulesPlaced = isLastModule && isCustomModule && customModules.length > 0;
    log('[draw] 预览判断: isLastModule=' + isLastModule + ', isCustomModule=' + isCustomModule + ', customModules.length=' + customModules.length + ', allModulesPlaced=' + allModulesPlaced);
    
    if (!allModulesPlaced) {
      var previewWidth = isCustomModule ? customWidth : selectedWidth;
      var previewW = previewWidth * scale;
      
      var previewModule = {
        type: selectedModule,
        width: previewWidth,
        isStandard: !isCustomModule,
        isCustom: isCustomModule
      };
      
      log('[draw] 绘制预览模块: type=' + selectedModule + ', width=' + previewWidth + ', isStandard=' + !isCustomModule + ', isCustom=' + isCustomModule + ', previewW=' + previewW);
      ctx.save();
      ctx.globalAlpha = 0.7;
      this._drawModule(ctx, previewModule, drawX, moduleBaseY, gapBaseY, skTopY, previewW, moduleH, gapPxH, skTopH, gapH, showDoor);
      ctx.restore();

      arrowX = drawX + previewW / 2;
      arrowPlaced = true;

      if (!isCustomModule && remainingStdWidth > previewWidth) {
        var restW = (remainingStdWidth - previewWidth) * scale;
        this.drawPlaceholder(ctx, drawX + previewW, moduleBaseY, restW, moduleH, '');
      }
    } else {
      log('[draw] 所有模块已放置，不绘制预览');
    }

    // 5. 右转角柜
    if (cornerType === 'YZJ' || cornerType === 'ZYZJ') {
      var yW = 110 * scale;
      var yX = wallX + wallRectW - skSideW - yW;
      var ySrc = showDoor ? assets.picture('y/y-110-230G') : assets.picture('y/y-110-230');
      this.drawImageOnCanvas(ctx, ySrc, yX, moduleBaseY, yW, moduleH);
      this._applyColorOverlay(ctx, yX, moduleBaseY, yW, moduleH);
      if (gapH > 0) {
        var nearGHy = this.getNearestGapHeight(gapH, true);
        var ygSrc = showDoor
          ? assets.picture('y/yg-110-' + nearGHy + 'G')
          : assets.picture('y/yg-110-' + nearGHy);
        this.drawImageOnCanvas(ctx, ygSrc, yX, gapBaseY, yW, gapPxH);
        this._applyColorOverlay(ctx, yX, gapBaseY, yW, gapPxH);
      }
      this.drawImageOnCanvas(ctx, assets.picture('SK/SK-300-2'),
        yX, skTopY, yW, skTopH);
      this._applyColorOverlay(ctx, yX, skTopY, yW, skTopH);
    }

    // 6. 右侧收口条（主体 + 加高 + 顶部收口条）
    var rightSkX = wallX + wallRectW - skSideW;
    this.drawImageOnCanvas(ctx, assets.picture('SK/SK-2-230'),
      rightSkX, moduleBaseY, skSideW, moduleH);
    this._applyColorOverlay(ctx, rightSkX, moduleBaseY, skSideW, moduleH);
    if (gapPxH > 0) {
      this.drawImageOnCanvas(ctx, assets.picture('SK/SK-2-230'),
        rightSkX, gapBaseY, skSideW, gapPxH);
      this._applyColorOverlay(ctx, rightSkX, gapBaseY, skSideW, gapPxH);
    }
    // 右侧收口条顶部收口条
    this.drawImageOnCanvas(ctx, assets.picture('SK/SK-300-2'),
      rightSkX, skTopY, skSideW, skTopH);
    this._applyColorOverlay(ctx, rightSkX, skTopY, skSideW, skTopH);

    // 7. 顶部收口条
    var hasLeftCorner = (cornerType === 'ZZJ' || cornerType === 'ZYZJ');
    var hasRightCorner = (cornerType === 'YZJ' || cornerType === 'ZYZJ');
    var topSkStartX = wallX + skSideW + (hasLeftCorner ? 110 * scale : 0);
    var topSkEndX = wallX + wallRectW - skSideW - (hasRightCorner ? 110 * scale : 0);
    var topSkWidth = topSkEndX - topSkStartX;
    if (topSkWidth > 0) {
      this.drawImageOnCanvas(ctx, assets.picture('SK/SK-300-2'),
        topSkStartX, skTopY, topSkWidth, skTopH);
      this._applyColorOverlay(ctx, topSkStartX, skTopY, topSkWidth, skTopH);
    }

    // === 绘制箭头指示器 ===
    if (arrowPlaced && !allModulesPlaced) {
      this.drawArrowIndicator(ctx, arrowX, floorTopY + 2);
    } else if (modules.length === 0) {
      var firstX = wallX + skSideW;
      if (hasLeftCorner) firstX += 110 * scale;
      arrowX = firstX + (isCustomModule ? customWidth : selectedWidth) * scale / 2;
      this.drawArrowIndicator(ctx, arrowX, floorTopY + 2);
    }

    // === 初始引导 ===
    if (modules.length === 0 && !arrowPlaced) {
      var leftOffset = hasLeftCorner ? 110 * scale : 0;
      var rightOffset = hasRightCorner ? 110 * scale : 0;
      var phW = wallRectW - skSideW * 2 - leftOffset - rightOffset;
      this.drawInitialGuide(ctx, wallX + skSideW + leftOffset, moduleBaseY, phW, moduleH);
    }

    log('[draw] 绘制完成, 已放置模块:', modules.length);
  },

  /**
   * 绘制单个模块（主体+门板+加高+加高门板+顶部收口条）
   */
  _drawModule(ctx, m, drawX, moduleBaseY, gapBaseY, skTopY, mW, moduleH, gapPxH, skTopH, gapH, showDoor) {
    log('[_drawModule] type:', m.type, 'width:', m.width, 'isStandard:', m.isStandard, 'isCustom:', m.isCustom, 'gapH:', gapH, 'gapPxH:', gapPxH, 'drawX:', drawX);
    if (m.isStandard) {
      // 标准主模块图片
      var mainSrc = assets.picture(m.width + '/' + m.type + '-' + m.width + '-230');
      log('[_drawModule][标准] mainSrc:', mainSrc, 'cached:', !!this._imageCache[mainSrc]);
      this.drawImageOnCanvas(ctx, mainSrc, drawX, moduleBaseY, mW, moduleH);

      // 标准门板
      if (showDoor) {
        var doorSrc = assets.picture(m.width + '/m-' + m.width + '-230G');
        this.drawImageOnCanvas(ctx, doorSrc, drawX, moduleBaseY, mW, moduleH);
      }

      // 对主体区域叠底着色
      this._applyColorOverlay(ctx, drawX, moduleBaseY, mW, moduleH);

      // 标准加高模块
      if (gapH > 0) {
        var nearGH = this.getNearestGapHeight(gapH, false);
        var gSrc = assets.picture(m.width + '/g-' + m.width + '-' + nearGH);
        log('[_drawModule][标准加高] gSrc:', gSrc, 'cached:', !!this._imageCache[gSrc], 'nearGH:', nearGH);
        this.drawImageOnCanvas(ctx, gSrc, drawX, gapBaseY, mW, gapPxH);
        if (showDoor) {
          var gmSrc = assets.picture(m.width + '/gm-' + m.width + '-30');
          this.drawImageOnCanvas(ctx, gmSrc, drawX, gapBaseY, mW, gapPxH);
        }
        // 对加高区域叠底着色
        this._applyColorOverlay(ctx, drawX, gapBaseY, mW, gapPxH);
      } else {
        log('[_drawModule][标准] gapH<=0, 不绘制加高');
      }

      // 顶部收口条
      this.drawImageOnCanvas(ctx, assets.picture('SK/SK-300-2'),
        drawX, skTopY, mW, skTopH);
      this._applyColorOverlay(ctx, drawX, skTopY, mW, skTopH);

    } else {
      // 非标模块
      var ew = this.getNearestEWidth(m.width);
      var eMainSrc = assets.picture('e/' + m.type + '-' + ew + '-230');
      log('[_drawModule][非标] eMainSrc:', eMainSrc, 'cached:', !!this._imageCache[eMainSrc], 'ew:', ew);
      this.drawImageOnCanvas(ctx, eMainSrc, drawX, moduleBaseY, mW, moduleH);

      // 非标门板
      if (showDoor) {
        var eDoorW = m.width > 75 ? 100 : 50;
        var eDoorSrc = assets.picture('e/m-' + eDoorW + '-230G');
        this.drawImageOnCanvas(ctx, eDoorSrc, drawX, moduleBaseY, mW, moduleH);
      }

      // 对主体区域叠底着色
      this._applyColorOverlay(ctx, drawX, moduleBaseY, mW, moduleH);

      // 非标加高
      if (gapH > 0) {
        var eNearGH = this.getNearestGapHeight(gapH, false);
        var egSrc = assets.picture('e/g/g-' + ew + '-' + eNearGH);
        log('[_drawModule][非标加高] egSrc:', egSrc, 'cached:', !!this._imageCache[egSrc], 'eNearGH:', eNearGH);
        this.drawImageOnCanvas(ctx, egSrc, drawX, gapBaseY, mW, gapPxH);
        if (showDoor) {
          var gmW = m.width > 75 ? 100 : 50;
          var gmFile = gmW === 100 ? 'gm-100-60' : 'gm-50-30';
          var egmSrc = assets.picture('e/g/' + gmFile);
          log('[_drawModule][非标加高门] egmSrc:', egmSrc, 'cached:', !!this._imageCache[egmSrc]);
          this.drawImageOnCanvas(ctx, egmSrc, drawX, gapBaseY, mW, gapPxH);
        }
        // 对加高区域叠底着色
        this._applyColorOverlay(ctx, drawX, gapBaseY, mW, gapPxH);
      } else {
        log('[_drawModule][非标] gapH<=0, 不绘制加高');
      }

      // 顶部收口条
      this.drawImageOnCanvas(ctx, assets.picture('SK/SK-300-2'),
        drawX, skTopY, mW, skTopH);
      this._applyColorOverlay(ctx, drawX, skTopY, mW, skTopH);
    }
  },

  /**
   * 绘制箭头指示器（向下箭头，标识当前模块位置）
   */
  drawArrowIndicator(ctx, x, y) {
    var arrowSize = 12;
    var arrowY = y + 6;
    
    // 箭头背景圆
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.arc(x, arrowY + arrowSize / 2, arrowSize, 0, Math.PI * 2);
    ctx.fill();

    // 箭头图标（向下）
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 竖线
    ctx.beginPath();
    ctx.moveTo(x, arrowY);
    ctx.lineTo(x, arrowY + arrowSize);
    ctx.stroke();
    
    // 箭头头部
    ctx.beginPath();
    ctx.moveTo(x - 4, arrowY + arrowSize - 4);
    ctx.lineTo(x, arrowY + arrowSize);
    ctx.lineTo(x + 4, arrowY + arrowSize - 4);
    ctx.stroke();

    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
  },

  /**
   * 对指定区域应用米色正片叠底（仅 cream 颜色时生效）
   */
  _applyColorOverlay(ctx, x, y, w, h) {
    if (this.data.selectedColor !== 'cream') return;
    var colorSrc = assets.color('MI');
    var colorImg = this._imageCache[colorSrc];
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    if (colorImg) {
      ctx.drawImage(colorImg, x, y, w, h);
    } else {
      ctx.fillStyle = '#EBE4DD';
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  },

  /**
   * 在 Canvas 上绘制图片，如果图片未加载则画色块占位
   * 同时异步触发补加载，加载完成后自动重绘，保证最终渲染完整
   */
  drawImageOnCanvas(ctx, src, x, y, w, h) {
    var img = this._imageCache[src];
    if (img) {
      try {
        ctx.drawImage(img, x, y, w, h);
      } catch (e) {
        this.drawFallbackRect(ctx, x, y, w, h, src);
      }
    } else {
      this.drawFallbackRect(ctx, x, y, w, h, src);
      // 异步补加载：避免预加载漏项或 cloud 临时URL失败造成的永久空白
      this._scheduleMissingImageReload(src);
    }
  },

  /**
   * 调度缺失图片的补加载，加载完成后统一触发一次重绘
   */
  _scheduleMissingImageReload(src) {
    var self = this;
    if (!src) return;
    if (!self._missingImages) self._missingImages = {};
    if (!self._missingImageAttempts) self._missingImageAttempts = {};
    // 同一张图最多尝试 2 次，避免死循环
    var attempts = self._missingImageAttempts[src] || 0;
    if (attempts >= 2) return;
    if (self._missingImages[src]) return; // 已在队列中
    self._missingImages[src] = true;
    self._missingImageAttempts[src] = attempts + 1;

    // 防抖：多个缺失图合并到一次加载 + 重绘
    if (self._missingReloadTimer) return;
    self._missingReloadTimer = setTimeout(function() {
      self._missingReloadTimer = null;
      var list = Object.keys(self._missingImages || {});
      self._missingImages = {};
      if (list.length === 0) return;
      log('[_scheduleMissingImageReload] 补加载缺失图片:', list.length, '张');
      self.loadImages(list).then(function() {
        log('[_scheduleMissingImageReload] 补加载完成，重绘');
        self._doDrawPreview();
      }).catch(function(err) {
        logWarn('[_scheduleMissingImageReload] 补加载失败:', err);
      });
    }, 80);
  },

  /**
   * 图片加载失败时的色块回退
   */
  drawFallbackRect(ctx, x, y, w, h, src) {
    logWarn('[drawFallback] 图片未缓存，走回退色块: src=' + src + ', pos=(' + x.toFixed(1) + ',' + y.toFixed(1) + '), size=(' + w.toFixed(1) + ',' + h.toFixed(1) + ')');
    var fillColor = '#f0ece2';
    if (src.indexOf('/z/') >= 0 || src.indexOf('/y/') >= 0) {
      fillColor = '#e8e3d8';
    } else if (src.indexOf('/SK/') >= 0) {
      fillColor = '#ddd9cf';
    } else if (src.indexOf('/g') >= 0 || src.indexOf('zg-') >= 0 || src.indexOf('yg-') >= 0) {
      fillColor = '#ebe7dc';
    } else if (src.indexOf('G.png') >= 0) {
      fillColor = 'rgba(230, 225, 215, 0.6)';
    }
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#d8d4ca';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, w, h);
  },

  /**
   * 绘制待选择模块的虚线框占位
   */
  drawPlaceholder(ctx, x, y, w, h, label) {
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(244, 242, 235, 0.3)';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

    if (label) {
      ctx.fillStyle = '#bbb';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + w / 2, y + h / 2 + 3);
      ctx.textAlign = 'start';
    }
  },

  /**
   * 初始引导：还没有放置任何模块时
   */
  drawInitialGuide(ctx, x, y, w, h) {
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
    ctx.setLineDash([]);

    ctx.fillStyle = '#bbb';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('请在下方选择模块', x + w / 2, y + h / 2 - 6);
    ctx.fillText('点击「下一模块」添加', x + w / 2, y + h / 2 + 10);
    ctx.textAlign = 'start';
  },

  /** 转发到聊天 */
  onShareAppMessage: function(res) {
    return require('../../utils/share.js').onShare('layout', this, res);
  },

  /** 转发到朋友圈 */
  onShareTimeline: function() {
    return require('../../utils/share.js').onTimeline('layout', this);
  }
});
