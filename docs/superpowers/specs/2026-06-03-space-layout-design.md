# Space Layout — 空间解析 + 柜子摆放

## Overview

在 glbviewer 的 space 模式中，标记墙角解析空间后，进入布局阶段：自动填充推荐柜子排列，用户可在 Canvas 俯视图上选中/替换/增删柜子模块，底部选择器提供宽度、类型、颜色切换，完成后跳转 cost 算价。

## Feature Flow

```
拍照/选图 → 标记墙角(2~4点) → 输入宽高 → "确认空间"
  → 自动填充柜子(autoFill)
  → Canvas 全高展开 + 底部选择器
  → 点击选中柜子 → 切换类型/宽度/颜色
  → 点击空白墙段添加柜子
  → 长按删除柜子
  → "算价" → 跳转 cost 页面
```

## Architecture

### 新建文件

#### `utils/layoutCompute.js`

从 layout.js 提取三个纯函数，供 layout.js 和 glbviewer 共用：

**`computeParams(wallWidth, cornerType)`**
- 输入：墙宽(cm)，转角类型(WZJ/ZZJ/YZJ/ZYZJ)
- 输出：`{ standardWidth, customWidth, cornerCount }`
- 逻辑：与 layout.js onLoad 第 89-109 行一致

**`autoFill(standardWidth, customWidth, cornerCount)`**
- 输出模块列表，优先 100cm 填 standardWidth（余数用 50cm），customWidth 生成一个非标 e-type 模块，转角处放转角柜
- 返回：`[{ width, type, isCorner?, isCustom? }]`

**`getAvailableModules(selectedWidth, customWidth)`**
- 和 layout.js `updateAvailableModules` 等价
- 返回当前宽度下可选模块列表 `[{ type, label, image }]`

### 改动文件

#### `packageDesign/layout/layout.js`

- `onLoad` 中 `standardWidth`/`customWidth`/`cornerCount` 的计算改为调用 `computeParams()`
- `updateAvailableModules` 改为调用 `getAvailableModules()`

#### `pages/knowledge/glbviewer/glbviewer.js`

新增字段和方法：

**Data 新增：**
```javascript
spaceStage: 'marking',       // 'marking' | 'layout'
wallWidthNum: 0,             // 确认后的墙宽数值
wallHeightNum: 0,            // 确认后的墙高数值
layoutModules: [],           // 当前已放置的模块列表
selectedWidth: 50,           // 当前选中模块宽度
selectedType: 'a',           // 当前选中模块类型
selectedColor: 'white',      // 当前选中颜色
isCustomModule: false,       // 是否选中非标模块
selectedModuleIndex: -1,     // 当前选中的柜子索引，-1 表示无
```

**Methods 新增：**
- `confirmSpace()` — 验证尺寸 → 调 computeParams + autoFill → 切换 spaceStage='layout'
- `onSelectWidth(e)` — 选中宽度(50/100/custom)
- `onSelectType(e)` — 选中类型(a/b/c/d)
- `onSelectColor(e)` — 选中颜色(white/cream/other)
- `onCanvasTap(e)` — Canvas 点击：点击柜子选中/点击空白加柜子
- `onModuleLongPress(e)` — 长按删除
- `_updateSelectedModule()` — 将选中柜子替换为当前选择器的宽/型/色
- `_canAddModule(width)` — 检查剩余空间是否足够
- `_drawLayout()` — Canvas 绘制完整布局（轮廓 + 柜子 + 选中态）
- `goCost()` — 验证 → 跳转 cost 页面

#### `pages/knowledge/glbviewer/glbviewer.wxml`

**marking 阶段**（现有 UI，微调）：
- "确认空间"按钮替换原来的"开始设计"
- 点击确认后进入 layout 阶段

**layout 阶段**（新增 block）：
- 照片缩略图（可点击展开回 marking）
- Canvas 全高展开
- 底部模块选择器：
  - 宽度选择：[50] [100] [非标] + 非标宽度值显示
  - 类型选择：[A型] [B型] [C型] [D型]
  - 颜色选择：[白色] [奶油] [其他]
- "算价"按钮

#### `pages/knowledge/glbviewer/glbviewer.wxss`

新增 layout 阶段样式：选择器栏、选中态按钮、缩略图等。

## Interaction Details

### Canvas 绘制（layout 阶段）

- 墙体轮廓线：灰色背景
- 转角柜：固定 110cm 宽度，橙色圆角块，标注"转角柜"
- 标准柜：按宽度比例矩形色块，颜色随 selectedColor，块内标注"100 A"
- 非标柜：比标准柜稍窄，用浅色表示
- 选中态：橙色加粗边框
- 空位：虚线边框表示"可放置"

### 点击柜子

- 根据点击坐标反算对应模块 → 选中（selectedModuleIndex）
- 底部选择器同步：宽度/类型/颜色按钮全部更新为该柜子的属性
- Canvas 重绘

### 选中后切换属性

- 用户点击底部宽度/类型/颜色 → 当前选中柜子实时替换
- Canvas 重绘

### 点击空白墙段

- 反算点击位置在哪段墙体空白处
- 检查该段剩余空间是否 ≥ 当前选中宽度
- 是 → 插入新模块（当前选择器的宽/型/色）
- 否 → toast "空间不足，请调整模块宽度"

### 长按柜子

- `wx.showModal` 确认删除
- 确认后从 layoutModules 移除
- 转角柜不可删除（toast提示）
- Canvas 重绘

### 算价跳转

- 检查 totalWidth ≤ wallWidth
- 跳转：`/packageDesign/cost/cost?id={designId}&...&modules={JSON}`

## Files Summary

| File | Change |
|------|--------|
| `utils/layoutCompute.js` | **新建** — computeParams, autoFill, getAvailableModules |
| `packageDesign/layout/layout.js` | 引用 utils/layoutCompute，替换内联计算 |
| `pages/knowledge/glbviewer/glbviewer.js` | 新增 spaceStage 管理 + 布局交互方法 |
| `pages/knowledge/glbviewer/glbviewer.wxml` | 新增 layout 阶段 UI |
| `pages/knowledge/glbviewer/glbviewer.wxss` | 新增 layout 阶段样式 |

## Edge Cases

- customWidth < 45 → 无非标模块
- cornerCount = 0 → 无转角柜，墙体全为标准+非标
- 所有柜子被删除 → toast "请至少保留一个模块"，不允许删除最后一个
- 用户回到 marking 修改墙角 → 清空 layoutModules，重新自动填充
- 非标模块只有 type='a' 的变体（e/a-{width}-230）
