## Summary

  - 在知识库新增「空间布置 (PD3D)」入口，进入独立 3D 房间布置页面
  - 上传墙面照片（贴在背墙）+ 输入墙宽×高×深，渲染矩形 3D 房间
  - 沿背墙依次摆放 GLB 柜子模型（50/100cm 标准柜 + 末位非标柜 + 4cm 收口），柜子三轴比例可调但板材厚度保持
  - 多套布置方案保存在本地（wx.setStorageSync + wx.saveFile），支持加载/删除

  ## 实现拆分

  | 模块 | 职责 | 测试 |
  |---|---|---|
  | utils/cabinetCatalog.js | 本地 GLB 模型清单 | 5 |
  | utils/cabinetLayout.js | 柜子布置纯函数算法 | 10 |
  | utils/cabinetMeshScaler.js | 板材厚度保持的非均匀缩放 | 6 |
  | utils/pd3dStorage.js | 方案 CRUD（storage + saveFile） | 8 |
  | utils/pd3dSceneManager.js | Three.js 场景：房间 + 柜子 + 相机 | (Three.js, 无单元测试) |
  | pages/knowledge/pd3d/* | 页面控制器 + WXML/WXSS | (UI, 手动 smoke test) |

  新增 29 个 Jest 单元测试，全部通过（共 93 个）。

  ## 设计文档

  - 设计规范: `docs/superpowers/specs/2026-06-07-pd3d-3d-cabinet-layout-design.md`
  - 实施计划: `docs/superpowers/plans/2026-06-07-pd3d-3d-cabinet-layout.md`

  ## Test plan

  - [x] `npx jest` — 93/93 通过
  - [ ] 微信开发者工具 smoke test：
    - [ ] 知识库 → 「空间布置 (PD3D)」入口出现，点击进入
    - [ ] 输入墙尺寸 + 上传照片 → 3D 房间渲染（背墙带照片纹理 + 浅绿色放置带）
    - [ ] 添加 50cm + 100cm 标准柜 → 柜子贴墙依次排列
    - [ ] 完成布置 → 末位非标柜自动生成
    - [ ] 选中柜子 + 拖动比例 slider → 视觉变化但板材厚度保持
    - [ ] 保存方案 + 重新加载 → 完整还原
    - [ ] 删除方案 → 列表更新

  ## 注意

  - 不采用 xr-frame，沿用现有 `threejs-miniprogram` + `GLTFLoader` 方案
  - 与现有 PD2D 页面平级共存，不替换
  - GLB 板材识别基于 mesh 命名（Left/Right/Top/Bottom/Back/Door），未命名 mesh 走 bounding-box 最薄边兜底
