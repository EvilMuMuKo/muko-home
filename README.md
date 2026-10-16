# MuKo Home

[打开空间设计方案](https://evilmumuko.github.io/muko-home/)

自然、温暖、适度复古的双人住宅空间概念设计。支持空间切换、日夜照明、家具动作和第一人称自由漫游。空间与设备仍需现场复测，当前展示不作为施工图。

## 开发与发布

使用 Node.js 24：

```sh
npm ci
npm run dev
npm run build
npm test
npm run benchmark
```

`src/index.html` 是入口，`src/model.js` 保留建筑基底；V6/V7/V8 覆盖层保留历史数据。`src/home-design.ts` 生成 V9 最终布局、飘窗和动作参数，`src/home-mesh.ts` 生成真实活动部件，`src/daylight.ts` 定义日照概念参数。`src/scene.js` 负责统一渲染与交互。详见 [V9 设计与验证范围](docs/home-v9.md)。

`npm run build` 生成 WASM、检查类型、构建 `dist/`，再同步根目录 `index.html`、`assets/`、预览图、`materials/` 纹理和 WASM。提交时需一起提交生成文件。这样继续兼容现有 **GitHub Pages：main 分支根目录**，无需修改线上发布设置。GitHub Actions 检查构建可复现性和测试。

本地 Playwright 默认使用 `/usr/bin/chromium`，可通过 `CHROMIUM_PATH` 指定；CI 使用 Playwright 安装的浏览器。

## 使用

- 横屏全画幅展示，初始位置在入户门内侧。短暂显示 welcome to MuKo’s home 与彩带，遵循减少动态效果设置；右上角打开或隐藏控制面板。
- **空间**：选择房间、用下拉框选择镜头，支持全屋概览、俯视/透视、复位和 PNG 导出。
- **漫游**：打开网站即从入户处进入。左侧加大摇杆或 WASD / 方向键移动，右侧摇杆或 IJKL 转头；鼠标拖动仍可辅助观察。两只摇杆可同时使用，松手、失焦或取消触控后停止。靠近并面向物件后出现一个对应交互按钮。Esc 或左上按钮退出至展示视角。墙、窗台、门扇、柱体及主要家具具有实时碰撞，门打开后按真实门洞通行；人物被限制在模型地面内。碰撞使用概念模型的圆形身体占地与可见网格包络，不替代现场通行或人体活动验收。
- **日夜**：仅保留日间、夜间、观影三档，不堆叠近似预设。日间定向阳光按窗洞与全高墙/屋顶遮光；缺少现场条件，不作为实测日照结论。
- **动作**：按当前房间显示抽拉台面、收纳餐桌、客床、柜门、家电门或工位退椅等相关动作。动线、碰撞演示和单独收纳目录不出现在客户页面。
- 入户岛台保留同柱宽；抽拉板采用用户接受的略窄规格，收进柜内；客厅采用锁轮移动电视与可拼合/分离的两个单人沙发模块，没有固定茶几；两间卧室有外凸飘窗。所有空间来自同一个模型。
- 主卧床恢复原朝向，床头灯恢复配套位置；床对面保留一字双工位，保留正常桌深与两把电脑椅；长桌上方和玄关用真实穿孔洞洞板收纳耳机、理线、钥匙及轻型随身物件。
- 手机保留材质纹理、柔和接触阴影、受限实时阴影和按需渲染，不新增手机全屏 AO/Bloom。
- 默认优先 WebGPU；无适配器/丢失设备时回退 WebGL，`?renderer=webgl` 可显式使用兼容渲染；`?wasm=0` 使用 JavaScript 几何后备。可选物理模块仅按 API 需求加载。

构建产物使用本地 HTTP 或 GitHub Pages 运行。直接 `file://` 打开 ES Modules 未获支持，请使用 `npm run preview`。当前不宣称真机手机帧率、施工精度、现场联合使用、五金承载或照度/眩光已验收。

[纹理来源及许可](licenses/polyhaven-textures.md) · [V9 实施说明](docs/home-v9.md)

旧版设计说明保留于 `docs/` 供追溯，不代表 V9 当前柜数、容量或布局。

渲染主体由 Three.js TypeScript 模块与 WASM 几何内核组成。本地 PBR 贴图为橡木、地板、亚麻、石膏；仅地板在非移动端加载 `*-desktop.webp`。石材是程序表面。地面有静态近接 AO，环境反射是通用 RoomEnvironment 的 PMREM，不是现场探针。灯光总槽为省电移动端 4、移动端 6、桌面 12；LTC 矩形灯占 1（移动端）或 2（桌面）槽，并替换同等数量的聚光灯。高性能桌面 WebGPU 使用克制的 TSL 泛光，WebGL 桌面使用 GTAO；移动端与省电设备不加载该后处理。没有光线追踪或全局光照。物理光照验收未运行。AAA 视觉质量未批准。仍缺定制布料、缝线贴图、局部反射或间接烘焙，以及现场日照采集。自动化回归共 90 项，最终执行状态以 [PR #6 的精确提交 CI](https://github.com/EvilMuMuKo/muko-home/pull/6/checks) 为准。原生桌面 WebGPU 六张重点视角与八空间连续漫游、42 张截图复核已完成。记录见 [图形发布说明](docs/graphics-release.md)。浏览器图标与手机收藏图标来自 `public/favicon.svg`，可用 `node scripts/build-icons.mjs` 重新生成 PNG。
