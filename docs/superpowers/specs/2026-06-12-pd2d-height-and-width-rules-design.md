# PD2D 墙高分级 + 柜位放置规则

日期：2026-06-12
范围：`pages/knowledge/pd2d/pd2d` 衣柜布置页
作者：xiongsiqiang

## 背景

当前 PD2D 页面的柜位渲染逻辑在 `utils/cabinetSceneNodes.js`：每个手放柜统一渲染为「主柜 230cm + 同色 trim 填上方 gap」，加一条全墙 2cm 顶梁。`buildSceneNodes` 不区分墙高，也不区分柜宽是否超出剩余墙宽。trailing filler（剩余 < 50cm 的右侧空间）只有两种处理：< 30cm 纯 trim、≥ 30cm 用 50A 缩放 + 4cm 收口。

新增两组规则会修改竖向（按墙高分级）和横向（按剩余墙宽分级）的渲染与放置交互。

## 规则

### A 墙高分级（每个柜位独立判断）

| wallHeight | 该柜位从下到上的层叠 | 全墙顶梁 |
|---|---|---|
| < 247cm | 主柜 230cm → 同色 trim 填 `(wallHeight − 230 − 2)` | 画 2cm |
| ≥ 247cm | 主柜 230cm → G1 柜 `(wallHeight − 230 − 4)` → 4cm 同色收口 | 不画 |

阈值 247 的来由：230(主柜) + 13(G1 最小有意义高度) + 4(收口) = 247。

G1 模板按主柜的 baseW 选择：50A/B/C/D → `50G1`，100A/B/C/D → `100G1`。e 型变宽柜（50–100）取最近标准宽对应的 G1，由 `cabinetSceneOverlay.js:184` 已有的 `clone.scale.x *= (desc.w / baseW)` 横向缩放机制承担。SK 立柱（line 73-79）保留原样 — 这是墙边封边，与柜位逻辑独立。

### B 柜位放置规则（横向，trailing 处理）

```
trailing = wallWidth − SK*2 − Σ(已放柜.width)
```

| trailing | 行为 |
|---|---|
| < 30cm | 纯同色 trim 填满（保留现状）；用户无法再放 |
| 30 ≤ trailing < 100cm | **禁止用户再放任何柜**；自动补 (trailing − 4)cm 缩小 100A 柜 + 4cm 右收口；可点击补柜位换其他 100cm 型号 |
| trailing = 100cm | 等同 < 100：补 96cm 缩小 100A + 4cm 收口；不允许直接放 100cm 整柜 |
| 100 < trailing ≤ 150cm | 只允许放 50cm 柜；用户放完 50 后 trailing 落到 (50, 100]，触发上一行规则 |
| trailing > 150cm | 正常路径，所有宽度（50/100/e）均可放 |

### C 补柜数据语义

补上的「缩小 100A 柜」作为独立模块加入 `data.modules`，与用户手放柜同等：

```js
{
  type: 'a',
  width: trailing - 4,
  wallX: <靠墙最右一柜的右沿>,
  isStandard: false,
  autoFilled: true   // 标记 UI 区分
}
```

- 在场景节点生成时按主柜走规则 A（即墙高 ≥ 247 时此柜位上方也加 G1 + 4cm 收口）
- 用户点该柜位 → 弹 100cm 型号选择器（A/B/C/D）→ 改 `module.type`，`width` 不变
- 在 `cost.js` 成本计算时按 100A/B/C/D 价格计算（料件按 100 系列），即使实际 width 小于 100
- 4cm 右收口生成为一条 trim cuboid，紧贴补柜右侧、左侧贴 SK 立柱内沿

### D UI 行为

- 50cm / 100cm / e 型宽度按钮按 trailing 动态启用：
  - trailing ≤ 100 → 禁用所有放置（已自动补满）
  - 100 < trailing ≤ 150 → 仅启用 50cm
  - trailing > 150 → 全启用
- 补柜插入后立即将 `isWallFull = true`
- 「上一个柜（prevBlock）」操作要把补柜与其前面用户柜一并撤回到用户上次手放后的状态（即撤回最后一次手放，连带清掉因之触发的补柜）

## 数据流

```
用户点 nextBlock
  ↓
pd2d.js _findNextWallPosition + _placeModule
  ↓ 检查 trailing 落入哪档
  ├─ trailing > 150 → 正常 _placeModule
  ├─ 100 < trailing ≤ 150 → 仅 50cm 通过；放完后 _maybeAutoFillTrailing
  └─ trailing ≤ 100 → 拦截放置；若由 _placeModule 触发的"下次再放"路径走到这里，调 _maybeAutoFillTrailing
       ↓
       _maybeAutoFillTrailing：插入 autoFilled=true 的 100A 模块到 modules，4cm 收口由 cabinetSceneNodes 渲染时生成
  ↓
setData modules → _drawFrame + _scheduleOverlayUpdate
  ↓
cabinetSceneOverlay.update → cabinetSceneNodes.buildSceneNodes
  ↓ 每个 module 走 _emitCabinetWithLevel(wallHeight)
       ├─ wallHeight < 247 → 主柜 + 同色 gap trim
       └─ wallHeight ≥ 247 → 主柜 + G1 + 4cm 收口
  ↓ 末尾若有 autoFilled 模块在最右，紧跟一个 4cm trim 收口节点
  ↓ wallHeight < 247 时附加全墙 2cm 顶梁；≥247 不附加
```

## 受影响文件

1. **`utils/cabinetSceneNodes.js`** — 主修改
   - `_emitCabinetWithGap` → `_emitCabinetWithLevel(nodes, modelId, baseW, x, w, wallHeight, d)`：内部分支墙高
   - `buildSceneNodes(opts)` 主循环：调用上面新方法；遍历 modules 时若末位是 autoFilled，其右侧加 4cm trim
   - 删除原 trailing 自动补 50A 的逻辑（line 55-71）— 那是渲染期补的，新规则把"补柜"上提到 pd2d.js 放置期
   - 全墙顶梁（line 81-87）按 wallHeight 分支：< 247 才画

2. **`pages/knowledge/pd2d/pd2d.js`**
   - `nextBlock` / `_findNextWallPosition`：按 trailing 拦截
   - 新增 `_maybeAutoFillTrailing()`：trailing 落入 30–100 时自动 push 一条 autoFilled 模块
   - 新增 `_onAutoFilledTap(idx)`：点补柜位弹型号选择器，改 `module.type`
   - `prevBlock`：撤回最后一次用户手放，连带清掉之后的 autoFilled
   - 新增 wxml 数据 `canPlace50` / `canPlace100`，绑定按钮 `disabled`

3. **`pages/knowledge/pd2d/pd2d.wxml`**
   - 50/100 宽度按钮加 `disabled="{{!canPlace50}}"` / `disabled="{{!canPlace100}}"`
   - autoFilled 模块在 canvas 上加点击命中区（绑定 `onAutoFilledTap`），或复用 overlay 触摸命中

4. **`packageDesign/cost/cost.js`**（若实际成本要计入）
   - 计算时检查 module.autoFilled 与 width，按 100A/B/C/D 价格走

## 不在范围

- 已保存方案的迁移：旧方案 modules 里没有 autoFilled 字段，按原逻辑渲染（不会被新规则拦截）
- pd2d 之外（pd3d/preset）的衣柜布置不受影响
- 顶梁颜色 / 收口材质：复用现有 trimMaterial（`#F5F1E8`）

## 测试要点

- 墙高 232（最小）/ 246 / 247 / 280 / 400（最大）的渲染分档
- 墙宽 100 / 150 / 200 / 250 / 300 触发各 trailing 分档
- 50cm 柜放到 trailing=100 边界：拦截后自动补 96A + 4cm 收口
- 点补柜位 → 选 100B → modules 中 type 改成 'b'，width 仍是 96
- prevBlock 反复撤回直到清空：autoFilled 也被清掉
- 墙高 ≥ 247 + 末位补柜：补柜位也长出 G1 + 4cm 收口
- 保存方案 → 跳 cost：modules 含 autoFilled 模块，cost 按 100 系列计价
