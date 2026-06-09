# PD2D — 3D 柜体透视叠加层

**Date:** 2026-06-10
**Status:** Approved (design)
**Branch:** feature/photo-perspective

## 背景

PD2D (`pages/knowledge/pd2d/`) 让用户上传一张墙面照片、拖动 4 个角点定义墙面范围，然后通过下方的 3D 模型预览条选择柜体（50cm/100cm × A/B/C/D/G1/G2），点击"下一积木"把柜体逐个排在墙上。当前实现把 GLB 模型仅用于底部缩略图条，照片上的柜体是用 `utils/perspective.js` 的分条法把 2D PNG 透视贴到墙面四边形里。

要求：
1. 模型预览条按宽度过滤——选 50cm 时只显示 6 个 50cm 模型，选 100cm 时只显示 6 个 100cm 模型。**已实现**（`pd2d.js` 的 `_getModelIdsForWidth` + `selectWidth`），保持不变。
2. 点击"下一积木"时，被选中的 GLB 模型要以**真正的 3D 立体**形式（带阴影、光照、深度遮挡）渲染到照片上的墙面里，并与照片的透视对齐。**本设计的范围。**

## 总体架构

**双 canvas 叠加：**

```
┌─────────────────────────────────┐
│  pd2dCanvas    (type="2d")       │  照片 + 虚线四边形 + 角点 + 网格
│  pd2dOverlay   (type="webgl")    │  绝对定位、透明背景、同尺寸
│                                  │  three.js 渲染 3D 柜子 + 修边
└─────────────────────────────────┘
```

2D canvas 保留现在的职责：画照片、虚线、角点、透视网格。它**移除**所有柜体相关绘制（`_buildCabinetList`、`_drawCabinets`、`drawPerspectiveImage` 调用、`_cabinetImageCache`、`_pendingImages`、`_ensureCabinetImages`、`_loadCabinetImages`、`_loadImageToCache`）。

WebGL overlay 由新模块 **`utils/cabinetSceneOverlay.js`** 拥有；它把"4 个像素角点 + 墙面 cm 尺寸 + 已放置模块列表"渲染成一个透明的 3D 场景。

### 模块边界

| 模块 | 职责 | 依赖 |
|---|---|---|
| `pd2d.js`（页面） | UI 状态、`modules` 数组、角点位置、墙面尺寸、"下一积木"处理 | overlay 的 `init/update/dispose/setDoorVisible/resize` |
| `cabinetSceneOverlay.js`（新） | three.js 场景/渲染器/相机、GLB 缓存、修边 cuboid | `cabinetCatalog`、`homographyToCamera`、`threejs-miniprogram`、`GLTFLoader` |
| `homographyToCamera.js`（新） | 纯函数：4 cm 点 + 4 像素点 + canvas 尺寸 → `THREE.PerspectiveCamera` 参数 | 无（不依赖 three.js，直接返回数值） |
| `cabinetModelPreview.js`（已有） | 不变——下方的预览条 | `cabinetCatalog` |
| `cabinetCatalog.js`（已有） | 不变 | 无 |

理由：把 3D、GLB 加载、相机推导、修边几何都移出 `pd2d.js`（已 768 行）。`homographyToCamera` 是最微妙的一段数学，单独成纯函数才能写单元测试。

## 墙面坐标系

3D 平面：
- 原点在墙面**左下角**（与现有 `wallX/wallY` 约定一致）
- X：沿墙向右，单位 cm
- Y：沿墙向上，单位 cm
- Z：从墙面向外（朝向相机），单位 cm
- 墙面位于 `z=0`；柜体沿 +z 延伸 `depth = 60cm`

墙面在 cm 平面中的 4 个角（用于 homography）：
`TL=(0,wallH), TR=(wallW,wallH), BR=(wallW,0), BL=(0,0)`

— 注意 y 轴向上，所以 TL 是 `y=wallH`。这样 three.js 默认 +Y 向上的世界坐标系和我们的墙面坐标系直接吻合，少一次翻转。

像素端的 `corners[4]` 来自 `pd2d.js`，按 TL/TR/BR/BL 顺时针顺序，与 cm 端对应。

## 数据流

```
用户拖角 / 改宽度 / 点下一积木 / 改墙面尺寸
        │
        ▼
pd2d.js setData(...)
        │
        ├──► _drawFrame()      照片 + 四边形 + 角点 + 网格（不再画柜体）
        │
        └──► _scheduleOverlayUpdate()   rAF 合并多次调用，参考已有 _scheduleDraw
                │
                ▼
        overlay.update({ corners, wallWidth, wallHeight, modules })
                │
                ├─ 墙面尺寸变 → 重建修边 cuboid，重置场景
                ├─ modules 变  → 与场景 diff，增加/删除柜体 group
                │                 （按 modelId 缓存 GLB，复制时用 clone()）
                ├─ corners 变  → homographyToCamera 重算相机
                │
                └─ renderer.render(scene, camera)
```

要点：
- overlay 持有长期 scene 状态，`update()` 做差量更新而不是重建。
- GLB 按 `modelId` 在 overlay 内部缓存（每种至多读一次文件、解析一次）。再次放置同型号时 `group.clone(true)`。
- 相机重算成本低（闭式分解），角点变就重算，不缓存。
- overlay canvas 的清屏色透明 (`alpha: true`, `clearAlpha: 0`)。
- 当 `canvasWidth/canvasHeight/dpr` 变化时，页面调用 `overlay.resize(w, h, dpr)`。

## Homography → 相机数学

最微妙的一段。设：
- `K`：相机内参矩阵；FOV 取 60° 垂直，主点在 canvas 中心。`f = canvasHeight / (2 * tan(30°))`
- `H`：从墙 cm 平面到像素的 homography，由 `perspective.computeHomography` 得到（源：cm 角点，目标：像素角点）

平面单应分解（Zhang 风格）：

```
H = K · [r1 | r2 | t]    其中 r1, r2 是旋转矩阵 R 的前两列, t 是平移
```

步骤：
1. `K_inv_h1 = K⁻¹ · h1`（h1 是 H 的第一列）
2. `λ = ‖K_inv_h1‖`
3. `r1 = K_inv_h1 / λ`
4. `r2 = (K⁻¹ · h2) / λ`
5. `t  = (K⁻¹ · h3) / λ`
6. `r3 = r1 × r2`
7. 用 SVD 把 `R = [r1|r2|r3]` 重新正交化（数值噪声修复）
8. 若 `det(R) < 0`，对 `r3` 取反（处理镜像）

得到的 `(R, t)` 是**墙面在相机坐标系下的姿态**。要给 three.js 的世界相机：

```
cameraPos_world = -Rᵀ · t
forward_world   =  Rᵀ · (0, 0, 1)   // 相机看向 +z
up_world        =  Rᵀ · (0,-1, 0)   // 像素 y 向下，所以世界 up 取 -y 方向再变换
```

构造：
```js
camera.position.set(...cameraPos_world);
camera.up.set(...up_world);
camera.lookAt(cameraPos_world + forward_world);
camera.fov    = 60;
camera.aspect = canvasWidth / canvasHeight;
camera.near   = max(1, ‖t‖ * 0.05);
camera.far    = max(2000, ‖t‖ * 10);
camera.updateProjectionMatrix();
```

`homographyToCamera.js` **不引用 three.js**——它返回 `{ position:[x,y,z], lookAt:[x,y,z], up:[x,y,z], fov, aspect, near, far }`。overlay 拿到对象后写到 `THREE.PerspectiveCamera`。这样数学层独立可测。

### 失败模式
- `corners` 不是凸四边形 → `perspective.isConvexQuad` 已经能判断；overlay 跳过本帧渲染（保留照片 + 网格可见）。
- `computeHomography` 返回 `null`（奇异） → 跳过本帧。
- 分解后 R/t 包含 `NaN/Inf` → 跳过本帧，控制台打印一次警告。

不重试——这些情况的解都是用户继续拖角点，不是定时器轮询。

## 柜体 & 修边 3D 内容

**柜体 GLB.** `utils/cabinet-model/` 里 12 个 GLB（`50A/B/C/D/G1/G2` 与 `100*` 同名）。overlay 第一次需要某 `modelId` 时通过 `wx.getFileSystemManager().readFileSync` 读取（参考 `cabinetModelPreview.js` 的 `_readGLB`），用 `THREE.GLTFLoader().parse` 解析，归一化为 `width × 230 × depth` 立方体范围（按 GLB 自身包围盒做 per-axis 缩放，使其严格贴合目录尺寸；高度 230，深度 60，宽度取 `catalog.width`），缓存为 `templateGroup`。后续放置该 modelId 时 `templateGroup.clone(true)` 并平移。

**门板可见性.** 沿用 `cabinetModelPreview.js` 的 `_isDoorMesh`（基于节点 name 的小写匹配 `door`/`_door`/`door_`）。在缓存 `templateGroup` 时把所有门板节点引用收进 `templateGroup.userData.doorMeshes`，clone 时通过遍历重新收集（因为 clone 节点是新对象）。`overlay.setDoorVisible(visible)` 遍历所有已放置 group 的门板节点设置 `visible`。页面已有 `data.doorVisible` 状态和 `toggleDoor`，挂上去即可。

**柜体在墙面上的位置.** 给定 `modules[i] = {type, width, wallX}` 与 `gapH = max(wallHeight - 230 - 2, 0)`（与现有 `_buildCabinetList` 算法等价；`-2` 是顶横条厚度）：
- 平移 `(wallX, 0, 0)` —— 柜体底贴 y=0（地面），顶在 y=230
- GLB 已经被归一化到原点对齐的 `width × 230 × depth` 立方体范围（min 在原点，max 在 `(width, 230, depth)`）

**SK 修边 + g-* 间隙填充作为程序化 cuboid.**

把现有 `_buildCabinetList` 的逻辑搬到 overlay 内的 `_buildSceneNodeList(wallW, wallH, modules)`。该函数与 2D 旧路径**几何完全等价**，仅坐标系从 y-down 翻转到 y-up：legacy `wallY` 对应 `wallH - wallY - wallH_local`。输入相同，输出 `{type:'cabinet'|'trim', modelId?, x, y, z, w, h, d}` 描述符数组（y-up 坐标系）：

| 节点 | 位置 (x,y,z) | 尺寸 (w,h,d) |
|---|---|---|
| 柜体 | `(wallX, 0, 0)` | `(width, 230, depth)` |
| 左侧 SK 主立柱（柜体高度段） | `(0, 0, 0)` | `(2, 230, depth)` |
| 左侧 SK 上立柱（gapH>0 时） | `(0, 230, 0)` | `(2, gapH, depth)` |
| 右侧 SK 主立柱 | `(wallW-2, 0, 0)` | `(2, 230, depth)` |
| 右侧 SK 上立柱（gapH>0 时） | `(wallW-2, 230, 0)` | `(2, gapH, depth)` |
| 顶横条（贯通） | `(2, wallH-2, 0)` | `(wallW-4, 2, depth)` |
| 每个柜上方 g-* 填充（gapH>0 时） | `(wallX, 230, 0)` | `(width, gapH, depth)` |

g-* 高度直接用真实 `gapH`，不做 snap（程序化 cuboid 不需要离散化到 `[25,35,...,95]`；那是 PNG 资源命名约束）。

修边材质：单例 `MeshStandardMaterial({ color: 0xF5F1E8, roughness: 0.7, metalness: 0.0 })`，整个 overlay 共享一个实例。

**光照.** 复用 `cabinetModelPreview.js` 的灯光配方（环境光 2.5、主方向光 3.0 在 `(2,4,3)`、补光 1.2 在 `(-2,1,-2)`），但**主方向光开 shadow map** + 柜体/修边 mesh `castShadow=true, receiveShadow=true`。柜与柜之间会有浅接触阴影。shadow.mapSize 取 1024（性能与质量平衡）。

**遮挡.** three.js 默认深度测试就足够；相邻柜体彼此 +z 方向有 60cm 厚度，从相机角度看互相遮挡。

## 错误处理

| 失败 | 检测 | 行为 |
|---|---|---|
| 凹/退化四边形 | `perspective.isConvexQuad` | 跳过本帧 overlay 渲染 |
| Homography 奇异 | `computeHomography` 返回 `null` | 跳过本帧 |
| 相机分解 NaN/Inf | 检查 R、t 各分量 `isFinite` | 跳过本帧；console.warn 一次 |
| GLB 文件缺失 | `_readGLB` 返回 null | 该柜位为空（不画占位框）；console.warn |
| GLB 解析失败 | `GLTFLoader.parse` reject | 同上 |
| WebGL 上下文初始化失败 | `THREE.WebGLRenderer` 抛错 | 整个 overlay 禁用；2D 路径继续可用；console.error |
| Canvas 尺寸为 0（modal 生命周期） | selectorQuery 后 width/height === 0 | 跳过本帧；页面已有 `wx:if` 重建逻辑会再次触发 init |

无重试循环、无 toast 轰炸。WebGL 失败是设备级问题，重试无意义；2D 照片 + 网格仍可用作降级。

## 测试

1. **`utils/homographyToCamera.js` — Jest 单元测试（重点）.** 圆环测试：选定相机姿态（正面、左 30°、上 45°、低角度等），把墙面 4 角点正向投影到像素，再丢给 `homographyToCamera` 反推相机，再用反推出的相机正向投影 4 角，断言每个点误差 ≤ 1 像素。同时覆盖凸/凹/奇异的提前返回。
2. **`utils/cabinetSceneOverlay.js` — `_buildSceneNodeList` 纯函数子测试.** 给定 `wallWidth/wallHeight/modules[]`，断言：修边 cuboid 数量与位置、柜体 cm 坐标与 `_buildCabinetList` 完全一致（保证 2D 旧路径与 3D 新路径几何对齐）、`gapH > 0` 才生成 g-* 填充。
3. **GLB 加载与 WebGL 渲染 — 手动验证.** 按 `CLAUDE.md`，仅在微信开发者工具内可运行。在模拟器中：上传照片 → 拖角点到合理透视 → 选 50cm → 放 50A → 切到 100cm → 放 100A → 切换"显示柜门" → 重设墙面 → 检查相邻柜是否有正确接触阴影。
4. **既有逻辑回归.** `cabinetModelPreview`（预览条）、`cabinetCatalog`、`perspective.isConvexQuad`、`_findNextWallPosition`、`_recomputeIsWallFull` 均不动；现有测试 `__tests__/cabinetCatalog.test.js` 应继续通过。

## 范围外（明确不做）

- 柜体 GLB 的来源切换（仍读本地 `utils/cabinet-model/*.glb`）。
- 角柜（`packageDesign/layout` 里的 corner 拆分逻辑）。本页本来就没有角柜配置项，不引入。
- 报价/保存方案——`_confirmLayout()` 现有 TODO 不在本设计范围内。
- 模型预览条的视觉调整——按 commit 历史已经在 `30999a2` 收尾，不再动。
- 异步 GLB 加载期间的 loading UI——首次放置该型号时同步 `readFileSync`+`parse`，与 `cabinetModelPreview.js` 现有做法一致；耗时可接受。
