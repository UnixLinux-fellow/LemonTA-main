# PD2D 保存方案：唯一性校验、合成预览图、跳转 cost 页

**日期**：2026-06-11
**作者**：xiongsiqiang（与 Claude 协作）
**目标分支**：`feature/photo-perspective`
**适用页面**：`pages/knowledge/pd2d/pd2d`、`pages/knowledge/pd2dList/pd2dList`

## 背景

PD2D 页面允许用户上传一张墙面照片，标定四角透视，放置 3D 衣柜模型，最后保存方案到本地存储。当前流程缺三件事：

1. 用户在第一屏输入空间名称时，没有跟已保存方案做重名检查，事后在列表里会出现两个 “客厅”，无法区分。
2. 保存方案时只持久化了原始照片，没有保存「照片 + 衣柜叠加」的合成图。这意味着后续 cost 页拿到的 `previewImage` 只能是空墙照片，看不到布置结果。
3. 保存成功后只 Toast 了「已保存」，没有进入下一步成本计算页。用户必须手动返回到 pd2dList 再点卡片才能进 cost 页，路径冗长。

本期改动解决这三件事，且**只动前端，不引云端**。复用现有 `pd2dStorage` / `pd2dList → cost` 桥接机制。

## 需求

### 功能性需求
- F1：用户在 PD2D 第一屏点 **【确认】** 时，对 trim 后的 `spaceName` 与本地已保存方案做重名校验，重名则停留在第一屏并提示。
- F2：保存方案时，把当前画布上的「照片背景 + WebGL 衣柜叠加」合成为一张 PNG，连同原有数据一起持久化。
- F3：保存成功后自动跳到 cost 页（透视预览用合成图），用户不需要手动二次跳转。
- F4：cost 页返回时落在 `pd2dList`，能看到刚保存的方案。

### 非功能性需求
- N1：尽量复用现有逻辑，本期改动局部化，不引入新依赖、不改云端、不改 `cost.js`。
- N2：合成图失败不阻断保存流程（降级到无合成图，cost 页 fallback 到原照片）。
- N3：保存中防重入，连点【保存方案】只产生一条记录。
- N4：所有改动可被现有 Jest 测试体系覆盖（`__tests__/`），新增 util 必须有单测。

### 范围外（YAGNI）
- 编辑已有方案的改名场景（目前没有“编辑”入口）。
- 同名时自动追加序号建议名。
- 合成图分辨率自适应或服务器端渲染。

## 架构

### 文件清单

| 文件 | 操作 | 职责变化 |
| --- | --- | --- |
| `pages/knowledge/pd2d/pd2d.js` | 修改 | `onConfirmSpace` 增加重名校验；`_confirmLayout` 改流程：去掉二次改名弹窗 → 调合成图工具 → 调 storage 保存 → `redirectTo` 列表页带 `openCostId` |
| `utils/pd2dStorage.js` | 修改 | 新增 `isNameUnique(name, excludeId?)`；`saveLayout` 接受可选 `compositePath` 字段并 `wx.saveFile` 持久化 |
| `pages/knowledge/pd2dList/pd2dList.js` | 修改 | `onLoad` 检测 query 参数 `openCostId`，命中后自动跳 cost 页；将 `openLayout` 中桥接 cost 的逻辑抽成内部 `_navigateToCost(rec)` |
| `utils/pd2dComposite.js` | 新增 | 唯一职责：把 `pd2dCanvas`（背景照片）和 `pd2dOverlay`（webgl 衣柜）的当前画面叠加成 PNG，返回 `Promise<tempFilePath>` |
| `__tests__/pd2dStorage.test.js` | 新增 | 单测覆盖 `isNameUnique` 和 `saveLayout` 的新字段 |

### 单元依赖图

```
pd2d.js  ──┬─→ pd2dComposite.js  (composePreview)
           ├─→ pd2dStorage.js    (isNameUnique, saveLayout)
           └─→ wx.redirectTo     ('/pages/knowledge/pd2dList/pd2dList?openCostId=...')

pd2dList.js ──┬─→ pd2dStorage.js  (loadLayout, listLayouts)
              └─→ wx.navigateTo   ('/packageDesign/cost/cost?id=...')
```

`pd2dComposite.js` 不知道 storage、不知道页面路由；`pd2dStorage.js` 不知道 canvas、不知道页面路由。和现有 PD2D 模块「全本地、各 util 互不耦合」的哲学一致。

## 接口签名

### `utils/pd2dStorage.js`

新增：
```js
// 判断方案名是否唯一
isNameUnique(name, excludeId)
//   name:      string，函数内部对入参和已存方案 name 都做 trim 后比较（防御性，调用方也建议 trim）
//   excludeId: string | undefined，编辑场景下排除自己（本期不调用）
//   return:    boolean
```

修改 `saveLayout` 签名：
```js
saveLayout({
  // ...原有字段
  compositePath: string  // 新增可选；与 photoPath 一样走 wx.saveFile 持久化
})
//   return: Promise<{ id, photoPath, compositePath }>
```

### `utils/pd2dComposite.js`（新增）

```js
composePreview({
  photoCanvas,    // 2d canvas（pd2d.js 的 this._canvas）
  overlayCanvas,  // webgl canvas（pd2d.js 的 this._overlayCanvas）
  width,          // CSS px，与 canvasWidth 一致
  height,         // CSS px，与 canvasHeight 一致
  dpr             // 设备像素比，决定输出 PNG 分辨率
})
//   return: Promise<string>  // 临时文件路径（wxfile://...），失败 reject
```

实现要点：
1. `wx.createOffscreenCanvas({ type: '2d', width: width * dpr, height: height * dpr })` 新建离屏 2d canvas。
2. `ctx.drawImage(photoCanvas, 0, 0, width * dpr, height * dpr)` 画照片。
3. `ctx.drawImage(overlayCanvas, 0, 0, width * dpr, height * dpr)` 叠加 WebGL 衣柜。
4. `wx.canvasToTempFilePath({ canvas: offscreen, ... })` 输出 PNG 临时路径。

## 数据流

### 保存方案的完整链路

```
[墙满 → 用户点【保存方案】触发 _confirmLayout]
   │
   ▼
1. 二次确认弹窗（"保存方案到《XX》？" 仅确认/取消，无输入框）
   │ 确认
   ▼
2. this._saving 防重入检查；置 _saving=true
   │
   ▼
3. wx.showLoading('保存中...', mask: true)
   │
   ▼
4. composePreview({photoCanvas, overlayCanvas, width, height, dpr})
   │ 失败 → catch 后 compositePath='' 继续，不阻断
   ▼
5. pd2dStorage.saveLayout({ ...原有字段, compositePath })
   │     - persistPhoto(photoPath)         → wxfile://saved_xxx
   │     - persistPhoto(compositePath)     → wxfile://saved_yyy
   │     - 写 wx.setStorageSync('pd2d_layouts')
   │ 失败 → wx.hideLoading + Toast '保存失败'，_saving=false，停在原页面
   ▼
6. wx.hideLoading + Toast '已保存'（短）
   │
   ▼
7. wx.redirectTo('/pages/knowledge/pd2dList/pd2dList?openCostId=<bridgeId>')
   bridgeId = 'pd2dlocal:' + savedLayoutId
```

### pd2dList 自动跳 cost 的链路

```
pd2dList.onLoad(options)
   │
   ▼
   读 options.openCostId
   │
   ├─ 无 → 走原流程
   │
   └─ 有 →  this._refresh()                            // 列表卡片就绪（用户回退能看到）
            const realId = options.openCostId.replace('pd2dlocal:', '')
            const rec = storage.loadLayout(realId)
            if (rec) this._navigateToCost(rec)         // 复用抽出的桥接逻辑
```

`_navigateToCost(rec)` 是把 `openLayout` 中「构造 design → 写 globalData → navigateTo cost」那段抽成的内部方法。`openLayout` 也调用它。

### 重名校验链路

```
onSpaceNameInput → setData({ spaceName })  // 输入时不校验，避免抖动
onConfirmSpace:
   trim(name) → 空？ Toast '请输入空间名称'
   校验墙宽高（原有逻辑）
   storage.isNameUnique(trimmed) ?
     否 → Toast '该空间名称已存在'，return（保留输入框内容让用户改）
     是 → setData spaceConfirmed=true 进入画布（原有逻辑）
```

### cost 页 previewImage 优先级（不变）
1. `app.globalData.currentDesignPreview`（pd2dList `_navigateToCost` 写入合成图路径）
2. `design.previewFileID`（云存储路径，本流程不产生）
3. `design.previewImage`（pd2dList 桥接 design 时写入合成图路径）

`_navigateToCost(rec)` 写 `currentDesignPreview` 和 `design.previewImage` 时，**优先用 `compositePath`，否则降级到 `photoPath`**。

## 错误处理与边界

### A. 重名校验
| 情形 | 处理 |
| --- | --- |
| 输入框为空 / 全空格 | Toast `请输入空间名称`，return |
| trim 后与现有方案重名（大小写敏感） | Toast `该空间名称已存在`，输入框内容保留 |
| 读 storage 抛错 | catch 后视为「非重名」，让流程继续；存储真坏了在保存阶段会再次失败 |

### B. 合成预览图
| 情形 | 处理 |
| --- | --- |
| `_canvas` 或 `_overlayCanvas` 为 null | 跳过合成，`compositePath=''`，继续保存 |
| 离屏 canvas 创建失败 / drawImage 抛错 | 同上 |
| `wx.canvasToTempFilePath` 失败 | 同上 |
| `wx.saveFile` 持久化合成图失败 | `compositePath` 留空（沿用 `persistPhoto` 失败 fallback） |

### C. 保存阶段
| 情形 | 处理 |
| --- | --- |
| `wx.setStorageSync` 抛错 | reject Promise，pd2d.js catch → hideLoading + Toast `保存失败`，**不跳转**，停留 |
| `wx.saveFile` 照片持久化失败 | 现有行为：`photoPath=''` 但记录仍写入；保留 |
| 保存中途异常 | 已持久化的孤儿文件接受存在；列表/cost 页都不会引用 |

### D. 跳转
| 情形 | 处理 |
| --- | --- |
| `wx.redirectTo` 失败 | catch 后 fallback 调 `wx.navigateTo`（栈深一层，但仍能到 pd2dList） |
| pd2dList `onLoad` 收到 `openCostId` 但 `loadLayout` 找不到记录 | 静默忽略，停在列表 |
| `_navigateToCost` 内 `wx.navigateTo` 失败 | 复用现有 `fail: Toast '跳转失败'` |

### E. 用户行为
| 情形 | 处理 |
| --- | --- |
| 保存中点返回键 | `showLoading mask:true` 屏蔽点击；返回键不影响异步保存 |
| 连续点【保存方案】 | `this._saving` 标志位拦截重入 |

## 测试与验证

### 单元测试（自动化）

`__tests__/pd2dStorage.test.js`（新增）—— 把 `wx.getStorageSync / setStorageSync` mock 成内存 Map，`wx.saveFile` mock 成原样返回路径。

| 用例 | 验证点 |
| --- | --- |
| `isNameUnique('客厅')` 空 storage 返回 true | 边界 |
| 已有同名记录返回 false | 主路径 |
| `'客厅 '` 与 `'客厅'` 等效（trim 由调用方负责，此用例验证比较时不再 trim） | 输入约定 |
| `isNameUnique('客厅', excludeId)` 排除自己后返回 true | 编辑接口预留 |
| `saveLayout({ ..., compositePath })` 后 `loadLayout` 能读出 `compositePath` | 持久化新字段 |
| `saveLayout` 不传 `compositePath` 时 record 的 `compositePath` 为 `''` | 默认值 |

**不写单测的部分**：`pd2dComposite.composePreview`（依赖小程序 canvas 上下文，mock 成本高且测的是壳）；页面交互（`onConfirmSpace` / `_confirmLayout` 重名分支、跳转）。这些靠手测覆盖。

### 手测清单（在 WeChat Developer Tools）

**A. 重名校验**
- [ ] 第一次输入「客厅」→ 确认 → 进入画布；返回再进 PD2D，再输入「客厅」→ Toast `该空间名称已存在`
- [ ] 输入「客厅 」（尾部空格）和已有「客厅」 → 同样判重名
- [ ] 输入「客厅2」（未存过）→ 顺利进入画布
- [ ] 输入空格 → Toast `请输入空间名称`（原有逻辑未坏）

**B. 保存 + 合成图 + 跳转**
- [ ] 上传照片、放置柜体、墙满 → 点【保存方案】→ 二次确认弹窗（无输入框）→ 确认
- [ ] Loading 出现 → 消失 → Toast `已保存` → 自动到 pd2dList，卡片含新方案
- [ ] pd2dList 检测到 `openCostId` → 自动 `navigateTo` 到 cost 页
- [ ] cost 页 `previewImage` 显示**含柜体的合成图**而非纯背景照片
- [ ] cost 页点返回 → 落在 pd2dList，**而非 pd2d 画布**

**C. 未上传照片场景**
- [ ] 不上传照片直接确认空间 → 进画布（仅墙面草绘）→ 放柜体 → 保存 → 合成图无照片但有柜体；cost 页能显示

**D. 合成图降级**
- [ ] 临时把 `composePreview` 改成 reject → 保存仍成功，cost 页 `previewImage` 退化为照片本身

**E. 回归**
- [ ] 从 pd2dList 点已有方案卡片 → 仍正常打开 cost 页（`_navigateToCost` 抽方法没坏）
- [ ] 从 pd2dList【开始新设计】→ 跳到 pd2d 第一屏正常
- [ ] 从知识库直接进 PD2D 仍正常工作（`onLoad` 没有 `openCostId`）

**F. 多次保存防重入**
- [ ] 同一画布快速点两次保存（连点确认按钮）→ 只保存一次

### 通过判据
1. `npm test` 全绿（含新增 `pd2dStorage.test.js`）
2. 上述 A–F 手测清单全部勾选
3. `git status` 无遗留调试 console.log

## 实施序列与代码改动量

按风险从低到高、复用最大化排序。

### 步骤
1. **`utils/pd2dStorage.js` 增量扩展**：新增 `isNameUnique`；`saveLayout` 接受 `compositePath`（复用 `persistPhoto`）。**约 +15 行**。
2. **新增 `utils/pd2dComposite.js`**：单一函数 `composePreview`。**约 +40 行**。
3. **修改 `pd2d.js#onConfirmSpace`**：在墙宽高校验后加 `isNameUnique` 调用。**约 +5 行**。
4. **修改 `pd2d.js#_confirmLayout`**：删 `wx.showModal` 的 editable/placeholderText/content 三字段；加 `_saving` 标志位；调 `composePreview`（catch 后置空继续）；把 `compositePath` 传 `saveLayout`；成功后 `wx.redirectTo`。**净 +25 行（增 +30 / 删 -15）**。
5. **修改 `pd2dList.js`**：抽 `_navigateToCost(rec)`；`openLayout` 改为调它；`onLoad` 末尾处理 `openCostId`。**约 +20 行（含搬动）**。
6. **新增 `__tests__/pd2dStorage.test.js`**：6 用例。**约 +80 行**。

**合计：净增 ≈ 160 行，删除 ≈ 25 行。**

### 复用清单

| 已有能力 | 复用方式 |
| --- | --- |
| `pd2dStorage.persistPhoto` | 合成图持久化直接走它，不写新逻辑 |
| `pd2dList.openLayout` 桥接 cost 的代码 | 抽成 `_navigateToCost`，新旧两入口共享 |
| `app.globalData.currentDesignPreview` | 仍是 cost 页吃 preview 的入口，不动 |
| `wx.showLoading / Toast / showModal` 链路 | 沿用现有交互模式 |
| `_canvas` / `_overlayCanvas` 引用 | pd2d.js 已持有，合成图直接用 |

### 上线节奏
- 步骤 1 + 6 一起合：纯新增，立刻可在测试里验证。
- 步骤 2 可与步骤 1 并行。
- 步骤 3 + 4 一起改：集中改 pd2d.js，避免反复编辑。
- 步骤 5 最后改：依赖步骤 4 产生的 `openCostId` 参数。

## 验收标准
- 单测全绿；A–F 手测清单全过
- 不引入新的云端依赖
- 不修改 `packageDesign/cost/cost.js`
- pd2d.js 净增 ≤ 50 行；pd2dList.js 净增 ≤ 25 行
