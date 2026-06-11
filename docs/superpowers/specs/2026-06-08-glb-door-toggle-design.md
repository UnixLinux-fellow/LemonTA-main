# GLB 模型预览 — 门板默认隐藏 + 显示切换按钮

## 背景

`pages/knowledge/glbviewer/` 是 GLB 模型预览页，用户加载柜子模型后想看清柜体内部结构（隔板、抽屉），门板会挡视线。需要：

1. 模型加载完成后，默认隐藏所有门板。
2. 提供一个按钮，点击在「显示门板」/「隐藏门板」之间切换。

仅作用于 glbviewer 页，不影响 pd3d 页面。

## 门板识别约定

项目里 `utils/cabinetMeshScaler.js` 已经按 mesh 命名识别板材厚度方向（`Door` 关键字 → z 轴）。本设计复用同一套命名规范：

mesh 名称满足以下任一条件即视为门板：
- `name === 'Door'`
- `name.indexOf('_Door') >= 0`
- `name.indexOf('Door_') >= 0`

如果模型里没有命中任何 Door mesh，按钮不显示。

## 架构

### `utils/glbSceneManager.js`

新增内部状态：
- `_doorMeshes`: Array，加载后收集到的门板 mesh 引用。

新增/修改的方法：
- `loadGLB(url)`：解析完成、`modelGroup.add(gltf.scene)` 之后，遍历 `gltf.scene` 收集门板 mesh 到 `_doorMeshes`，并把每个门板的 `visible` 设为 `false`。
- `setDoorVisible(visible)`：遍历 `_doorMeshes`，统一设置 `visible`，调用 `renderer.render(scene, camera)` 重渲染一次。
- `hasDoorMeshes()`：返回 `_doorMeshes.length > 0`。
- `_clearModelGroup()`：清空 `_doorMeshes = []`，确保重新加载模型时复位。
- `dispose()`：清空 `_doorMeshes`。

模块导出新增：`setDoorVisible`、`hasDoorMeshes`。

### `pages/knowledge/glbviewer/glbviewer.js`

`data` 新增字段：
- `doorVisible: false`
- `hasDoor: false`

修改：
- `_initGLBScene` 中 `loadGLB(...).then(...)` 回调里，调用 `mgr.hasDoorMeshes()`，把结果连同其他字段一起 setData 到 `hasDoor`，并把 `doorVisible: false` 一并写入。
- 新增 `toggleDoor()`：取反 `data.doorVisible`，setData 后调用 `_glbManager.setDoorVisible(newValue)`。
- `clearModel()` 重置 `doorVisible: false, hasDoor: false`。
- `onUnload` 不需要改动（dispose 已覆盖）。

### `pages/knowledge/glbviewer/glbviewer.wxml`

在 `<view class="scale-panel" wx:if="{{loadStage === 'done'}}">` 内的最顶部（`scale-tabs` 之前）插入一个按钮行：

```xml
<view class="door-toggle-row" wx:if="{{hasDoor}}">
  <view class="door-toggle-btn" bindtap="toggleDoor">
    <text>{{doorVisible ? '隐藏门板' : '显示门板'}}</text>
  </view>
</view>
```

### `pages/knowledge/glbviewer/glbviewer.wxss`

新增样式（与现有 `.scale-tab` / `#FC9700` 主题色一致）：

```css
.door-toggle-row {
  display: flex;
  justify-content: center;
  margin-bottom: 16rpx;
}
.door-toggle-btn {
  padding: 14rpx 40rpx;
  border-radius: 24rpx;
  border: 1rpx solid #FC9700;
  color: #FC9700;
  font-size: 26rpx;
}
.door-toggle-btn:active {
  background: rgba(252, 151, 0, 0.15);
}
```

## 数据流

1. 用户选模型 → `_loadGlb` → `_initGLBScene` → `mgr.loadGLB(glbUrl)`
2. `loadGLB` 内部解析 gltf → 收集门板 mesh → 全部隐藏 → resolve 返回尺寸
3. then 回调 → `setData({ loadStage: 'done', hasDoor: mgr.hasDoorMeshes(), doorVisible: false, ... })`
4. 用户点按钮 → `toggleDoor` → 取反 `doorVisible` → `mgr.setDoorVisible(true/false)` → 重渲染
5. 用户点「清除」/重选模型 → `clearModel` 或新一轮 `loadGLB` → `_doorMeshes` 清空 → `hasDoor` 重新判断

## 错误处理

- 模型不含 Door 命名 mesh：`hasDoor === false`，按钮 wx:if 条件不成立，不渲染。
- 多次加载/切换模型：`_clearModelGroup` 已会清空 `_doorMeshes`，`loadGLB` 重新填充。
- `setDoorVisible` 在 `_doorMeshes` 为空时是 no-op，不会报错。

## 测试方式

手动在微信开发者工具里：
1. 加载 utils/100G1.glb，确认进入 done 状态后门板不可见、按钮显示「显示门板」。
2. 点按钮，门板出现，文字变「隐藏门板」。
3. 再点按钮，门板恢复隐藏。
4. 点「重置」缩放后门板状态保持（resetGLBScale 不应影响门板可见性）。
5. 点「清除」按钮，回到 idle 状态后再加载模型，doorVisible 重置为 false。

## 不做的事

- 不动 pd3d 页面（pd3dSceneManager 加载柜子时不需要默认隐藏门板，那是设计页，门板应该可见）。
- 不修改 `cabinetMeshScaler.js`，不动 GLB 文件本身。
- 不持久化 doorVisible 状态到 storage。
- 不为非 Door 命名的 mesh 提供别的回退（YAGNI；后续如有第三方上传场景再加）。
