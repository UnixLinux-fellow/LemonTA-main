# 照片上传 + 2D透视投影摆放设计文档

**日期**: 2026-06-07
**状态**: 设计完成，待实现

## 概述

在柠檬塔小程序的 layout（摆放模块）页面增加"实拍照片"模式：用户上传房间墙面照片，将柜体模块以透视投影方式叠加到照片上，让设计效果更直观。

## 设计决策

| 决策 | 选择 |
|------|------|
| 透视方案 | 四点透视映射（单应性变换） |
| 功能位置 | 增强现有 layout 摆放页 |
| 参数关系 | 保留 preset 墙面参数输入，照片为可选背景 |
| 角点标记 | 先显示默认矩形框，再拖拽微调四角 |
| 照片来源 | wx.chooseImage（拍照 + 相册） |
| 效果图保存 | 仅本地预览，不存云端 |

## 文件变更

### 新增文件

- `utils/perspective.js` — 单应性矩阵计算、点映射、透视分条渲染

### 修改文件

- `packageDesign/layout/layout.js` — 照片模式状态、上传、Canvas 渲染、触摸交互
- `packageDesign/layout/layout.wxml` — 上传/移除照片按钮、角点标记
- `packageDesign/layout/layout.wxss` — 照片模式相关样式

### 不修改

- `preset/preset.js`、`cost/cost.js`、`app.js` — 不变

## 核心算法

### 单应性矩阵

用户标记的 4 个角点定义"墙面坐标 (cm) → 照片坐标 (px)"映射：

```
(0, 0)       → 左上角
(wallW, 0)   → 右上角
(wallW,wallH)→ 右下角
(0, wallH)   → 左下角
```

用 DLT（直接线性变换）求解 3×3 单应性矩阵 H。给定柜体在墙面坐标系中的矩形位置，通过 H 映射为照片中的四边形。

### 分条透视渲染

Canvas 2D 不支持原生透视变换。采用水平分条逼近：

1. 目标四边形按 y 轴等分 N 条（N≈150）
2. 每条为小梯形，用其上下边几何参数反算源图对应矩形条
3. `drawImage(srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH)` 逐条绘制
4. 柜体间按墙面 x 坐标自然排序（近大远小自动满足）

性能预估：每个柜体 ~150 次 drawImage，4-6 模块 < 1000 次调用，约 10-20ms。

## 数据流

### layout.js data 新增字段

```javascript
photoMode: false,         // 是否处于照片模式
photoPath: '',            // 照片临时路径
photoCorners: [           // 4个角点 (Canvas坐标系)
  {x:0,y:0}, {x:0,y:0}, {x:0,y:0}, {x:0,y:0}
],
photoHomography: null,    // 缓存的单应性矩阵
draggingCorner: -1,       // 拖拽角点索引
```

### 主要流程

```
上传照片 → wx.chooseImage → 显示在Canvas → 默认矩形框
→ 用户调整角点 → 实时重算H矩阵 → 透视重绘柜体
→ 摆放模块(现有流程不变, 渲染走透视路径)
→ 移除照片 → 恢复抽象3D视图
```

## UI 布局

```
┌──────────────────────────┐
│     Canvas 区域           │
│  (照片背景 or 抽象背景)    │
│  (透视柜体渲染)           │
│  [橙色角标 ×4, 仅照片模式] │
├──────────────────────────┤
│ [📷上传照片] [移除]       │ ← 新增
├──────────────────────────┤
│ 重设墙面 | 显示柜门       │ ← 现有
├──────────────────────────┤
│ 框架编辑器 (不变)          │ ← 现有
└──────────────────────────┘
```

### 默认角点初始化

照片首次加载后，4 个角点的默认位置为 Canvas 可视区域向内缩进 20% 的矩形：

```
左上: (canvasW*0.2, canvasH*0.2)
右上: (canvasW*0.8, canvasH*0.2)  
右下: (canvasW*0.8, canvasH*0.8)
左下: (canvasW*0.2, canvasH*0.8)
```

### perspective.js 导出 API

```javascript
// 从4对点计算3x3单应性矩阵
computeHomography(srcPoints, dstPoints) → [[a,b,c],[d,e,f],[g,h,1]]
// 用矩阵映射单点
transformPoint(H, {x, y}) → {x, y}
// 四边形是否凸
isConvexQuad(corners) → boolean
// 分条渲染：在ctx上以透视方式绘制img
drawPerspectiveImage(ctx, img, quad, strips)
```

### 触摸交互

- `touchstart`：检测触点是否命中某个角标（命中半径 20px），设置 `draggingCorner`
- `touchmove`：更新对应角点坐标，重算 H 矩阵，调用 `_scheduleDraw()`
- `touchend`：清除 `draggingCorner`
- 角标渲染在 Canvas 上层用 WXML `movable-view` 实现（原生组件支持拖拽），避免 Canvas touch 事件与模块选择冲突

## 错误处理

- 照片选择取消：不做任何状态变更
- 角点形成非凸四边形：不绘制柜体，提示用户调整
- 照片加载失败：toast 提示，回退到抽象视图
- Canvas 未就绪：跳过照片绘制，等待 onReady

## 测试策略

- `perspective.js` 纯函数：单元测试矩阵计算、点映射精度
- layout 页面：手动测试拍照/选图 → 调角点 → 摆放 → 移除
- 边界：极小墙面(44cm)、极大墙面(1000cm)、转角柜透视
- 兼容：iOS/Android 微信不同版本 Canvas 2D 行为
