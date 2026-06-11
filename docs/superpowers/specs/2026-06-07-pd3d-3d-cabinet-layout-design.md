# PD3D 3D 空间柜子布置 — 设计文档

**日期**：2026-06-07
**作者**：xiongsiqiang
**状态**：设计已批准，待写实施计划

## 1. 背景与目标

LemonTA 现有 PD2D 页面（`pages/knowledge/pd2d/pd2d`）采用 2D Canvas + 透视贴合方案：用户上传照片，调整 4 个角点把"墙面平面"映射到照片上，柜子以平面图形式叠加。这种方式在表达空间深度、调整柜子比例方面有局限。

新功能"PD3D 空间布置"在知识库栏目里新增一个独立页面，使用真正的 3D 渲染：

- 上传一张墙面照片，用户输入墙宽 / 墙高 / 进深
- 渲染一个矩形 3D 房间（背墙贴照片纹理、左右侧墙、地板、天花板）
- 在房间内沿背墙依次摆放柜子模型（GLB 模型）
- 柜子可以调整三轴比例，并保持每块板材的厚度不变
- 多套布置方案保存在本地，可上传多张照片，每张照片独立保存方案
- 不采用 xr-frame，沿用项目现有的 `threejs-miniprogram` 方案

**与现有 PD2D 的关系**：PD3D 是新建独立页面，不替换 PD2D；两者通过知识库主页平级入口共存。

## 2. 用户故事

1. 我打开"空间布置"页面，看到三个输入框（默认 150 / 260 / 60）和一个"上传照片并开始"按钮
2. 我输入我家墙的尺寸，上传一张拍好的墙面照片，点开始
3. 系统渲染出一个 3D 房间，背墙是我刚上传的照片，地板有一片半透明浅绿色高亮区表示放置区
4. 我从模型清单选 100G1 柜子，点"添加 50cm 标准柜"，系统在墙左侧放第一个 50cm 柜
5. 我再点"添加 100cm 标准柜"，紧贴第一个柜的右边再放一个 100cm 柜
6. 我点"完成布置"，系统自动在末尾追加一个非标柜（宽度 = 墙宽 - 已用宽度 - 4cm 收口）
7. 我点击其中一个柜子选中（橙色高亮），拉动比例 slider 把它的高度调高一点 —— 视觉变化但板材厚度保持
8. 我手指拖动 / 双指捏合调整相机视角，从不同角度查看效果
9. 我点保存，输入方案名"客厅版本 1"，方案保存到本地
10. 我点"方案列表"，看到刚才保存的方案；再上传新照片，做新方案"卧室版本 1"
11. 我重启小程序，点进任意一个方案，3D 房间和柜子原样还原

## 3. 架构

### 3.1 模块拆分

```
pages/knowledge/pd3d/
  pd3d.js            页面控制器：UI 状态、用户交互编排
  pd3d.wxml          模板：Canvas + 底部控制栏 + 方案列表抽屉
  pd3d.wxss          样式
  pd3d.json          页面配置

utils/
  pd3dSceneManager.js     Three.js 场景管理：房间 + 多柜子 + 相机/触摸 + 选中/高亮
  cabinetMeshScaler.js    GLB 板材识别 + "保持厚度的非均匀缩放"算法
  cabinetCatalog.js       本地 GLB 模型清单
  pd3dStorage.js          方案 CRUD（wx.setStorageSync + wx.saveFile）
```

### 3.2 模块依赖关系

```
pd3d.js ──→ pd3dSceneManager ──→ cabinetMeshScaler
   │                          ↓
   │                       three.js / GLTFLoader
   ├──→ cabinetCatalog
   └──→ pd3dStorage
```

每个模块单一职责、对外接口清晰：

- **`pd3dSceneManager`**：addCabinet / removeCabinet / selectCabinet / setCabinetScale / resetCamera 等高层方法。three.js 实现细节对调用者透明
- **`cabinetMeshScaler`**：preprocess(group) + applyScale(group, scale) 两个方法
- **`pd3dStorage`**：saveLayout / listLayouts / loadLayout / deleteLayout
- **`cabinetCatalog`**：listModels / getModelPath(modelId)

### 3.3 入口

知识库主页 `pages/knowledge/knowledge.wxml` 增加一张入口卡片"空间布置"，与现有 PD2D 卡片平级。

`app.json` 的 `pages` 数组中追加 `pages/knowledge/pd3d/pd3d`。

## 4. 数据模型与数据流

### 4.1 核心数据结构

**柜子实例**（场景中的一次放置）：

```js
{
  instanceId: 'cab_<timestamp>_<rand>',
  modelId: '100G1',
  positionIndex: 0,                  // 沿墙宽方向的顺序索引（从左到右 0,1,2,...）
  isCustom: false,                   // 是否末位非标柜
  widthCm: 50,                       // 标准柜宽度档位 (50/100) 或非标柜的实际宽度
  scale: { x: 1.0, y: 1.0, z: 1.0 } // 三轴比例（视觉调节，不改变 widthCm 的逻辑空间）
}
```

**方案**（一条 storage 记录）：

```js
{
  id: 'layout_<timestamp>',
  name: '客厅方案 1',
  createdAt: 1234567890,
  updatedAt: 1234567890,
  photoPath: 'wxfile://store_xxx',          // wx.saveFile 持久化路径
  wall: { width: 150, height: 260, depth: 60 },  // cm
  cabinets: [ /* 上面那种结构的数组，已含末位非标柜 */ ]
}
```

storage key: `pd3d_layouts`，值为方案数组。

### 4.2 单位约定

- 用户输入与 storage 保存：cm
- Three.js 内部：m（`xM = xCm / 100`）
- 单位转换只在 `pd3dSceneManager` 接收输入时发生一次

### 4.3 关键数据流

**新建方案**：

```
上传照片 → wx.chooseMedia → 临时路径
输入墙宽×高×深（默认 150 / 260 / 60）
→ pd3d.js 调用 sceneManager.init(wall, photoTempPath)
→ sceneManager 构建房间 + 半透明绿色放置区
→ 用户依次添加标准柜 → sceneManager.addCabinet(modelId, widthCm)
  → cabinetMeshScaler 加载 GLB、识别板材、初始化默认比例
  → 柜子贴前一个柜子右侧
→ 用户点"完成布置" → sceneManager 自动追加末位非标柜
→ 选中柜子调比例 slider → sceneManager.setCabinetScale(instanceId, scale)
  → scaler 应用"保持板材厚度的非均匀缩放"
→ 保存方案 → pd3dStorage.saveLayout(layoutData)
  → wx.saveFile 持久化照片 → 拼装方案对象 → wx.setStorageSync 写回
```

**加载方案**：

```
方案列表 → pd3dStorage.listLayouts() → 渲染列表
点击某条 → pd3dStorage.loadLayout(id) → 完整方案
→ pd3d.js 调用 sceneManager.init(wall, layout.photoPath)
→ 遍历 layout.cabinets 依次调 sceneManager.addCabinet 还原（带 scale 与 isCustom 标志）
```

### 4.4 保存的数据 vs 不保存的数据

- **保存**：墙尺寸、照片持久化路径、柜子的 modelId / widthCm / isCustom / positionIndex / scale
- **不保存**：相机姿态、当前选中状态、UI 临时状态（这些是会话级状态）

## 5. 板材识别与厚度保持的非均匀缩放算法

`cabinetMeshScaler.js` 是这个功能里唯一全新的核心算法。

### 5.1 问题本质

直接对整个 GLB 组调用 `group.scale.set(sx, sy, sz)` 会让所有板材的厚度也按相应方向缩放（例如 sx=2 时，左右侧板的厚度也会变 2 倍）。我们要的是：柜子整体在三轴方向"看起来变宽 / 变高 / 变深"，但每块板材的厚度保持不变。

### 5.2 GLB 已知 mesh 结构

通过解析 `utils/100G1.glb`，已确认 6 个关键板材有命名节点：

| 节点名 | 含义 | 厚度方向 |
| --- | --- | --- |
| Left, Geom3D_Left | 左侧板 | X |
| Right, Geom3D_Right | 右侧板 | X |
| Top, Geom3D_Top | 顶板 | Y |
| Bottom, Geom3D_Bottom | 底板 | Y |
| Back, Geom3D_Back | 后板 | Z |
| Door, Geom3D_Door | 门板 | Z |
| PushLatch, Geom3D_PushLatch | 反弹器（硬件） | 自动检测 |

另有 21 个未命名 `Geom3D` mesh（隔板、合页等），按"最薄边即厚度方向"启发式自动推断。

### 5.3 算法

**预处理**（GLB 加载完成后调用一次）：

1. 遍历 GLB 所有 mesh 节点，对每个 mesh 记录：
   - 名称（用于命名匹配）
   - 局部 bounding box（mesh 自身坐标系）
   - 在柜子根坐标系下的中心位置
2. 推断每个 mesh 的厚度方向：
   - 命名匹配优先：节点名（或所属父节点名）含 `Left` / `Right` → X；含 `Top` / `Bottom` → Y；含 `Back` / `Door` → Z
   - 兜底：bounding box 三个方向中"最薄"的一个
3. 把 meta 信息存到 `group.userData.scalerMeta`

**应用比例 `applyScale(group, scale)`**（用户拖 slider 时调用）：

对每个 mesh：
- 自身 scale：厚度方向保持 1，其他两个方向按整体比例
- 自身 position：相对柜子根的中心位置按整体比例缩放（让板材移到正确位置而不变厚）

### 5.4 伪代码

```js
function preprocess(group) {
  var meta = { meshes: [] };
  group.traverse(function(node) {
    if (!node.isMesh) return;
    var thicknessAxis = inferThicknessAxis(node);
    var localBox = computeLocalBox(node);
    var origCenter = computeRelativeCenter(node, group);
    meta.meshes.push({ node: node, thicknessAxis: thicknessAxis,
                       localBox: localBox, origCenter: origCenter });
  });
  group.userData.scalerMeta = meta;
}

function applyScale(group, scale) {
  var meta = group.userData.scalerMeta;
  for (var i = 0; i < meta.meshes.length; i++) {
    var m = meta.meshes[i];
    var s = { x: scale.x, y: scale.y, z: scale.z };
    s[m.thicknessAxis] = 1;
    m.node.scale.set(s.x, s.y, s.z);
    m.node.position.set(
      m.origCenter.x * scale.x,
      m.origCenter.y * scale.y,
      m.origCenter.z * scale.z
    );
  }
}
```

### 5.5 容错

未命名 mesh 用启发式判断厚度方向时可能误判（例如某些 L 形隔板、复杂硬件）。这种情况下视觉上会有轻微变形，但不会几何崩溃。后续如发现问题，可在 GLB 建模时给隔板加 `Shelf_*` 等命名，并在算法的命名映射表里加新条目。

### 5.6 接口

```js
// utils/cabinetMeshScaler.js
exports.preprocess = function(group) { ... };
exports.applyScale = function(group, scale) { ... };
exports.SCALE_RANGE = { min: 0.5, max: 2.0 };
```

`pd3dSceneManager` 在加载完一个柜子 GLB 后调用 `preprocess(group)`，之后每次 setCabinetScale 内部调 `applyScale`。

## 6. 房间渲染、放置区与相机/触摸

### 6.1 房间构建

沿用 `threeScene.js` 已验证的模式：

| 元素 | 几何 | 材质 |
| --- | --- | --- |
| 背墙 | `PlaneGeometry(wallW, wallH)` | `CanvasTexture`（上传照片预处理） |
| 左侧墙 | `PlaneGeometry(roomDepth, wallH)` | 颜色 `0xd4c8b8`（暖灰） |
| 右侧墙 | `PlaneGeometry(roomDepth, wallH)` | 颜色 `0xd4c8b8` |
| 地板 | `PlaneGeometry(wallW, roomDepth)` | 颜色 `0x3a3530` |
| 天花板 | `PlaneGeometry(wallW, roomDepth)` | 颜色 `0xf0ece6` |

**坐标系约定**：背墙 z=0，房间向 +z 方向延伸；柜子背面贴 z=0；y=0 是地板；x 沿墙宽方向 0 居中（-wallW/2 到 +wallW/2）。

**光照**：环境光 0.6 + 主方向光 0.9 + 补光 0.3（与 `threeScene.js` 一致）。

### 6.2 半透明浅绿色"放置区"

- 一个独立 `PlaneGeometry(wallW, CABINET_DEPTH_CM/100)` 铺在地板上 1mm 处避免 z-fighting，沿背墙铺一条带状区域
- `CABINET_DEPTH_CM = 60`（项目固定柜子深度常量，与 `threeScene.js` 中 `CABINET_DEPTH_M = 0.60` 保持一致）
- 材质：`MeshBasicMaterial({ color: 0x90ee90, transparent: true, opacity: 0.25, depthWrite: false })`
- 始终可见，让用户清楚"这片区域是柜子放置范围"

### 6.3 相机控制

- `PerspectiveCamera(45, aspect, 0.1, 100)`
- 轨道控制：theta（水平绕 Y 轴）+ phi（俯仰）+ radius（距离）+ target（注视点）
- 初始：`theta=0.3, phi=π/4, radius=max(wallW,wallH)*1.6`，target = 房间中心
- 单指拖动旋转、双指捏合缩放（与 `threeScene.js`/`glbSceneManager.js` 完全一致）
- "重置相机"按钮回到初始位置

### 6.4 触摸事件分流

```
touchstart:
  raycast 命中柜子 → 待定（可能是选中也可能是开始旋转）
  否则 → 进入"相机模式"

touchmove:
  位移 ≥ 5px → 进入"相机模式"（旋转/缩放）
  位移 < 5px → 维持待定

touchend:
  待定 + 命中过柜子 → 选中该柜子
  其他 → 不做特殊处理
```

不支持自由拖动柜子（柜子位置由布置算法决定，不由用户拖）。

### 6.5 选中/删除/调比例

- 单击柜子 → 选中（橙色边框高亮 + 底部弹出 3 个比例 slider 和"删除"按钮）
- 长按柜子 → 弹确认对话框删除
- 单击空白 → 取消选中
- 比例 slider：宽 / 高 / 深 三个独立滑块，范围 0.5–2.0，默认 1.0
- 删除任一柜子 → 后面的柜子向左收拢 → 末位非标柜重新计算宽度

## 7. 柜子布置算法

### 7.1 规则

- 柜子沿背墙方向（X 轴）从左到右**依次贴墙排列**
- 柜子之间无缝相邻，不可叠加，不可中间留空
- 标准柜两个档位：50cm、100cm
- **末位柜（非标柜）**：宽度 = `墙宽 - 已放置标准柜总宽 - 4cm`
- **4cm 收口**：墙宽末端预留给收口条（不渲染为柜子，只是空间预留）

### 7.2 操作流程

```
用户点"加 50cm 标准柜" → 第 1 个柜：x=0~50
用户点"加 100cm 标准柜" → 第 2 个柜：x=50~150
用户点"完成布置" → 系统自动追加末位非标柜
  墙宽 200 → 非标柜：x=150~196，右侧 196~200 是收口
```

### 7.3 边界情况

- 用户点"完成布置"时若已用宽度 + 50（最小标准） + 4 > 墙宽：直接把剩余宽度做成末位非标柜
- 已用宽度 + 4 ≥ 墙宽：toast"墙宽不足"，不允许再加新柜
- 墙宽 < 54cm（最小标准 50 + 收口 4）：不允许进入布置流程，提示"墙宽过小"

### 7.4 比例调节的语义

- slider 调节只改变柜子的视觉比例（保持板材厚度），不改变 widthCm 的逻辑空间
- 柜子模型在 X 轴上的渲染中心仍位于该柜子在墙宽方向的中心（即 widthCm 槽位的中心 x 坐标）；scale.x=2.0 时模型沿中心向两侧"溢出"显得更宽，但布置算法分配给它的 widthCm 槽位不变（不挤压邻居）
- 这意味着相邻两个柜子的 scale.x 都 > 1.0 时，它们的 mesh 会在视觉上重叠 —— 这是设计接受的视觉效果（slider 主要用于调单个柜子的"显得宽窄"演示，不期望多个柜子同时拉到极端值）

## 8. UI、保存、错误处理

### 8.1 UI 布局

```
┌─ 顶部导航栏 ──────────────────────────┐
│  ‹ 返回    空间布置    [方案列表]       │
├──────────────────────────────────────┤
│                                      │
│         3D Canvas（占满剩余空间）       │
│                                      │
├─ 底部控制栏（按 mode 切换内容）─────────┤
│                                      │
└──────────────────────────────────────┘
```

底部栏内容由 `mode` 状态字段驱动：

| mode | 内容 |
| --- | --- |
| `init`（未上传照片） | 三个输入框（墙宽 / 墙高 / 进深）+ "上传照片并开始"按钮 |
| `placing`（布置中） | 模型清单 chip + 标准宽度 chip（50/100）+ "添加柜子" + "完成布置" + "保存方案" + 重置相机 |
| `selected`（选中柜子） | 三个 slider（宽 / 高 / 深 比例）+ "删除"+ "取消选中" |

**方案列表抽屉**：点顶部"方案列表"按钮从右侧滑入。每条记录显示方案名 + 缩略图 + 创建时间 + 删除按钮，点击加载该方案。

### 8.2 输入校验

| 输入 | 范围 | 默认 |
| --- | --- | --- |
| 墙宽 | 30 – 1000 cm | 150 |
| 墙高 | 100 – 1000 cm | 260 |
| 进深 | 10 – 150 cm | 60 |

输入框 onBlur 校验，超界自动夹回合法范围。

### 8.3 方案存储

`pd3dStorage.js` 接口：

```js
saveLayout(layout)        → Promise<{id, photoPath}>
listLayouts()             → Array<LayoutSummary>
loadLayout(id)            → Layout 完整对象 | null
deleteLayout(id)          → 同步操作
```

**存储边界**：
- 照片：`wx.saveFile` 持久化到文件系统，路径写入方案对象
- 方案数据：`wx.setStorageSync('pd3d_layouts', [...])`，每条 1–5KB
- storage 上限 10MB，文件系统 50MB

### 8.4 错误处理

| 失败点 | 处理 |
| --- | --- |
| Canvas 初始化失败 | 复用 `_retryCanvas` 模式（最多 8 次重试） |
| `threejs-miniprogram` 加载失败 | toast "3D 引擎启动失败"，退回 mode=init |
| GLB 文件读取失败 | toast "模型加载失败"，不阻塞其他操作 |
| 照片解析失败 | toast "照片加载失败，可重新上传" |
| 板材识别异常 | 兜底用整体均匀缩放（视觉略变形但不崩） |
| 输入墙尺寸超范围 | onBlur 夹回合法范围 |
| 保存方案失败（storage 超限） | toast "存储空间已满，请删除旧方案" |
| 加载方案时照片路径失效 | toast 提示，跳过照片渲染（背墙用纯色） |

**资源释放**：
- `onUnload` 调用 `sceneManager.dispose()`，清理所有 mesh/material/texture/renderer
- 切换方案时先 `dispose` 再 `init`，避免内存泄漏（与 `glbviewer.js` 一致）

### 8.5 测试要点

1. **板材识别命中率**：用 `100G1.glb` 验证 6 个命名板被正确识别为对应方向
2. **末位非标柜计算**：
   - 墙宽 150 + 一个 50 标 → 非标 96cm
   - 墙宽 200 + 两个 50 标 → 非标 96cm
   - 墙宽 100 → 退化为单个非标 96cm
3. **方案保存往返**：保存后重启 app，加载方案能完整还原
4. **多个方案管理**：保存 3 个方案，删除中间一个，列表顺序正确

