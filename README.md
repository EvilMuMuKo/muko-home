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

`src/index.html` 是入口，`src/model.js` 保留建筑基底；V6/V7/V8 覆盖层保留历史数据。`src/home-design.ts` 保留 V9 基础，`src/life-design.ts` 生成 V10 最终布局与生活状态，`src/home-mesh.ts` 生成真实活动部件，`src/daylight.ts` 定义日照概念参数。`src/scene.js` 负责统一渲染与交互。详见 [V10 设计与验证范围](docs/life-v10.md)。

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

[纹理来源及许可](licenses/polyhaven-textures.md) · [V10 实施说明](docs/life-v10.md)

旧版设计说明保留于 `docs/` 供追溯，不代表 V10 当前柜数、容量或布局。

渲染主体由锁定的 Three.js 0.186.0、TypeScript 与 WASM 几何内核组成；不因本次调整升级依赖。材质为本地 PBR 贴图与独立的程序微表面，钢与墙面不共用肌理。固定画质档在转向和静止时维持相同像素尺寸；高性能桌面 WebGPU 使用 4x MSAA、空间 SMAA 及受限泛光，移动端保留原生抗锯齿，继续不加载全屏 AO/Bloom。

启动采用渐进材质加载：先建立可漫步的场景，再将完整贴图更新到原有共享纹理；局部反射等待贴图完成和首屏显示，启动只预编译一次实际渲染通道。完整材质、阴影、碰撞与分辨率预算不因加载优化而删减。本机 Chrome 冷 HTTP 缓存的一次同模型对照为旧启动顺序约 7.1 秒、新版约 4.1 秒；这不是公网或真实手机耗时保证。[启动记录](docs/life-v10/startup-load.json)包含测量范围和重复样本，`whenVisualReady()` 可等待完整视觉准备。

持续转向的本机测试中，横屏手机尺寸仿真约 60fps；桌面高画质首次遍历约 34fps、P95 约 50ms，**未达到桌面 60fps 目标**，仍有首次着色器与效果切换卡顿。两种配置的像素预算不同于旧版，不能将其视为同画质性能比较。详见[性能记录](docs/life-v10/performance.json)；真实手机硬件仍为 NOT RUN。

`src/exterior-world.ts` 提供各窗共享的概念住宅绿景与日夜天空。`src/room-radiance.ts` 按房间延迟生成局部反射，并在捕获时暂停主渲染，避免把暂时隐藏的家具误当成通路。反射目标延迟保留至页面释放，不在漫步时销毁仍可能被 WebGPU 引用的纹理。浴室两片镜柜使用独立、有限分辨率的平面反射和 4x MSAA。

`src/generated-diffuse.json` 是通过 `node scripts/bake-diffuse.mjs` 离线生成的七房间日夜间接光；更新建筑、材质或照明后需重新生成并构建。运行时不自动烘焙，探针省略可移动家具。它是低阶近似，WebGPU 体积边缘与 WebGL 回退均有跨空间漏光限制，没有光线追踪。本轮不宣称达到 3A 成品游戏美术或现场光照验收。

回归脚本：`scripts/life-release-audit.mjs`（固定像素尺寸、视角、状态、实际截图）、`scripts/whole-home-walk-audit.mjs`（连续按键与摇杆漫步）、`scripts/life-performance.mjs`（同机基线比较）。`playwright.native.config.ts` 用本机 Chrome GPU 验证；默认配置保留 SwiftShader 兼容回归，二者都不能替代真实手机硬件验收。完整测试数与精确提交 CI 以最终记录为准。

浏览器图标与手机收藏图标来自 `public/favicon.svg`，可用 `node scripts/build-icons.mjs` 重新生成 PNG。用户于本轮明确授权将《最高设计纲领》及有效修改决定同步到仓库；参见 [需求基准](docs/requirements/README.md)。原始户型附件、私人标注图片及交接包仍不随发布上传。

启动兼容性：标准 `GPUAdapterInfo.isFallbackAdapter` 标记为软件适配器时直接使用 WebGL；GPU 初始化或预编译超时、设备丢失时进入一次有界恢复。普通网络/着色器验证错误仍正常报告。原生 GPU 与软件渲染分开验证，GitHub CI 使用四个分片执行完整测试范围。

手机运行策略已进一步调整为稳定30Hz预算：手机默认不再暂停漫步去捕获整屋反射，使用共享环境与固定的房间平均SH探针；贴图分批上传，碰撞与互动减少重复扫描。固定手机DPR最高1.5，转向时不改变；桌面保留局部反射与实时镜面。具体取舍、复跑方法和真机边界见[手机漫步修订](docs/mobile-runtime.md)。

## YAN’s Home · 独立初稿

新户型源代码、设计任务书和逐房截图位于 [projects/yans-home](projects/yans-home/README.md)。其独立发布产物位于 `yans-home/`，合并并发布后可从 [YAN’s Home](https://evilmumuko.github.io/muko-home/yans-home/) 验收。原首页继续使用现有模型。
