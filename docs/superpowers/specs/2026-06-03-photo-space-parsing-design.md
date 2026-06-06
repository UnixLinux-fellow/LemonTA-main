# Photo Space Parsing — 拍照解析空间

## Overview

在 GLB 模型预览页面（`pages/knowledge/glbviewer/glbviewer`）新增「拍照解析空间」模式：用户拍摄/选取房间照片，在照片上手动标记墙角位置（2~4 个点），程序实时绘制房间俯视轮廓，自动判断转角类型，用户输入实际尺寸后跳转到衣柜设计 preset 页面。

纯前端实现，无后端 API 调用。

## Feature Flow

```
glbviewer idle → 点击"拍照解析空间"
  → wx.chooseMedia 拍照/选图
  → 全屏展示照片（可缩放/平移）
  → 用户在照片上标记墙角点（2~4个）
  → Canvas 实时绘制俯视轮廓
  → 自动判断转角类型
  → 用户输入墙宽/墙高
  → 点击"开始设计" → navigateTo preset（传参：width, height, corner, source=photo）
```

## Architecture

### 模式切换

`glbviewer.js` 新增 `data.mode` 字段：
- `'glb'` — 原有 GLB 模型查看模式（现有功能不变）
- `'space'` — 新增空间解析模式

两种模式互斥。进入 space 模式时，xr-frame 不渲染（通过 `wx:if` 控制）。

### New Data Fields

```javascript
data: {
  mode: 'glb',              // 'glb' | 'space'

  // 空间解析模式
  photoPath: '',            // wx.chooseMedia 返回的临时路径
  photoWidth: 0,            // 图片实际宽度
  photoHeight: 0,           // 图片实际高度
  markers: [],              // [{ x, y }] — 0~4 个墙角标记点（相对图片坐标）
  wallWidth: '',            // 用户输入的墙宽 (cm)
  wallHeight: '',           // 用户输入的墙高 (cm)
  cornerCount: 0,           // 已标记点数
  cornerType: 'none',       // 自动判断：none | left | right | both
  draggingIndex: -1,        // 当前拖拽中的标记点索引
}
```

### Page Structure (space mode)

```
┌─────────────────────────┐
│  导航栏（返回，标题"拍照解析空间"）│
├─────────────────────────┤
│                         │
│  照片区域（movable-view）  │
│  - 双指缩放/平移           │
│  - 墙角标记点叠加层         │
│  - 支持点击加点、拖拽微调    │
│                         │
├─────────────────────────┤
│  俯视轮廓预览（Canvas 2D）  │
│  - 按标记点顺序连线         │
│  - 自动适配 Canvas 尺寸    │
├─────────────────────────┤
│  转角类型：◻无 ◻左 ◻右 ◻双侧 │  (自动判断，只读展示)
│  墙宽：[___] cm           │
│  墙高：[___] cm           │
│  [  开始设计  ]            │
│  [  重新选图  ]            │
└─────────────────────────┘
```

## Interaction Details

### 标记点操作

- **点击加点**：在照片区域内点击，添加一个标记点。超过 4 个点时 toast 提示"最多标记4个墙角"
- **长按拖拽**：`longpress` 事件激活拖拽模式，手指移动时更新点坐标，手指抬起时结束拖拽
- **点击删除**：点击已存在的标记点（距点击位置 < 30rpx），弹出确认 → 删除该点
- **视觉反馈**：每个标记点显示彩色编号圆点 ① ② ③ ④（橙蓝绿红色），当前拖拽中的点放大 + 发光

### 俯视轮廓 Canvas

- 取标记点坐标，计算包围盒
- 按标记顺序（用户点击顺序）连线
- 若点数 >= 3，自动闭合
- 保持长宽比，适配 Canvas 尺寸（320x240rpx）
- 四个方向显示墙段编号

### 转角类型自动判断

- 从标记点连线计算相邻边夹角
- 标记点按 x 坐标排序后，检查中间是否存在拐点（方向变化 > 30°）
- 逻辑：
  - 2 点 → `none`
  - 3 点 → `left` 或 `right`（由拐点位置决定）
  - 4 点 → `both`

### 尺寸输入

- 墙宽：44–1000 cm（与 preset 约束一致）
- 墙高：232–400 cm（与 preset 约束一致）
- 输入验证在点击"开始设计"时执行

## Files Changed

| File | Change |
|------|--------|
| `pages/knowledge/glbviewer/glbviewer.js` | 新增 space 模式逻辑：图片选择、标记点管理、Canvas 绘制、跳转预设 |
| `pages/knowledge/glbviewer/glbviewer.wxml` | 新增 space 模式 UI：照片区、标记覆盖层、Canvas、尺寸输入、按钮 |
| `pages/knowledge/glbviewer/glbviewer.wxss` | 新增 space 模式样式：标记点、Canvas 区、输入组 |
| `packageDesign/preset/preset.js` | `onLoad` 支持接收 URL 参数 `width`、`height`、`corner`，自动填入表单 |

## Edge Cases

- 图片加载失败 → toast 提示，返回 idle
- 标记点不足 2 个时点击"开始设计" → toast "请至少标记2个墙角"
- 标记点超过 4 个 → toast "最多标记4个墙角"
- 用户取消选图 → 不做任何操作，保持在 idle
- 重复点击同一位置 → 忽略（距任意已有点 < 20rpx 时视为重复）
- preset 接收参数后仍需用户确认 → 参数填入表单，不自动提交

## Testing

- 测试拍照选图 → 标记 2/3/4 个点 → 轮廓更新 → 输入尺寸 → 跳转 preset
- 测试拖拽微调标记点 → 轮廓实时更新
- 测试点击删除标记点 → 轮廓实时更新
- 测试边界输入（宽高超出范围）→ 错误提示
- 测试 preset 页面接收 URL 参数后正确填入
