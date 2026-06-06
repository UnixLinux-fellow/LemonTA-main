# GLB 模型导入显示 + 拉伸缩放

## 目标

GLB 文件导入后，通过 Three.js WebGL Canvas 渲染 3D 模型，支持：
- 双指捏合等比缩放
- 单轴（X/Y/Z）非等比拉伸（滑块控制）
- 单指轨道旋转、双指平移视角

## 范围

在现有 `pages/knowledge/glbviewer/` 页面基础上改造，仅影响 GLB 模式（mode === 'glb'），不影响 `space` / `space3d` 模式。

## 文件变更

### 新增

- `utils/glbSceneManager.js` — GLB 模型加载 + 场景管理 + 缩放控制。接口：
  - `init(canvas, THREE)` — 创建场景、相机、光照
  - `loadGLB(url)` → Promise — 下载并解析 GLB，返回原始尺寸
  - `setUniformScale(s)` — 等比缩放
  - `setAxisScale(x, y, z)` — 轴向拉伸
  - `getOriginalSize()` → {x, y, z} — 原始模型包围盒尺寸 (cm)
  - `getCurrentScale()` → {x, y, z}
  - `handleTouchStart/Move/End` — 轨道+捏合手势
  - `dispose()`

### 修改

- `pages/knowledge/glbviewer/glbviewer.wxml` — GLB 模式视口：
  - 用 `<canvas type="webgl" id="glbCanvas">` 替换 `<xr-frame>`
  - 加载完成后显示底部控制面板（等比/轴向滑块）
  - 空状态、进度面板、错误面板保持不变

- `pages/knowledge/glbviewer/glbviewer.js` — 新增：
  - `_initGLBScene()` — 初始化 Three.js 场景
  - `_onGLBLoaded()` — 加载完成后获取原始尺寸、初始化滑块范围
  - 滑块变更事件（等比/轴向）
  - 手势事件转发到 sceneManager
  - 清理逻辑（`onUnload` / `clearModel`）

- `pages/knowledge/glbviewer/glbviewer.wxss` — 控制面板样式

## 交互规格

### Canvas 手势

| 手势 | 效果 |
|------|------|
| 单指拖动 | 轨道旋转（theta/phi） |
| 双指捏合 | 模型等比缩放（非相机变焦） |
| 双指平移 | 视角平移 |

### 底部控制面板（模型加载成功后出现）

两个 tab：等比缩放 / 轴向拉伸

**等比缩放：** 单滑块，范围 0.3x ~ 3.0x，步进 0.01

**轴向拉伸（非等比）：** 三个滑块
- 原始尺寸从模型包围盒计算（GLB 的 bounding box）
- 范围：原始尺寸 × 0.3 ~ 原始尺寸 × 3.0
- 滑块值显示为实际 cm 尺寸
- 拖拽滑块实时更新模型

底部操作按钮：重置 / 确认尺寸

## 技术要点

- 复用 `threejs-miniprogram`（已在 node_modules 中）
- GLB 加载：`THREE.GLTFLoader` 配合微信文件系统路径
- 模型缩放通过 `modelGroup.scale.set(x, y, z)` 实现
- 原始尺寸通过 `THREE.Box3().setFromObject(model)` 获取
- 相机初始距离根据模型包围盒自动计算
- 材质保持 GLB 自带材质（MeshStandardMaterial），无需覆盖
- 场景背景：`0x1a1a1a`，环境光 + 方向光基础照明

## 不变项

- 文件选择 (`chooseFile`)、URL 输入 (`toggleUrlInput/confirmUrl`)、下载进度 (`_startDownload`) 逻辑不变
- `modelCatalog` 快捷入口不变
- `space` / `space3d` 模式完全不受影响
- 底部工具栏（加载完成后的三个按钮）可替换为新的控制面板
