# MuKo Home

[打开空间设计方案](https://evilmumuko.github.io/muko-home/)

自然、温暖、适度复古的双人住宅空间概念设计。支持空间切换、日夜照明、家具动作，以及可选的微风、水波和碰撞演示。空间与设备仍需现场复测，当前展示不作为施工图。

## 开发与发布

使用 Node.js 24：

```sh
npm ci
npm run dev
npm run build
npm test
npm run benchmark
```

`src/index.html` 是入口，`src/model.js` 保留 V5 住宅数据，`src/storage-design.ts` 和 `src/atmosphere-design.ts` 分别生成 V6 收纳与 V7 配色/生活场景覆盖层，`src/salon-design.ts` 与 `src/salon-mesh.ts` 叠加 V8 家具及空间构图，`src/scene.js` 是从原发布包还原的场景逻辑，暂保留原局部变量名。新增渲染、合批、几何、材质、布料和浅水模块使用 TypeScript。构建检查新增 TS 模块，不声称原场景已完成全量类型迁移。

`npm run build` 生成 WASM、检查类型、构建 `dist/`，再同步根目录 `index.html`、`assets/`、预览图、`materials/` 纹理和 WASM。提交时需一起提交生成文件。这样继续兼容现有 **GitHub Pages：main 分支根目录**，无需修改线上发布设置。GitHub Actions 检查构建可复现性和测试。

本地 Playwright 默认使用 `/usr/bin/chromium`，可通过 `CHROMIUM_PATH` 指定；CI 使用 Playwright 安装的浏览器。

## 使用

- 默认 WebGL2；桌面支持 PBR、环境反射、GTAO、4× MSAA 和轻微 HDR 泛光。
- 手机采用 PBR、环境反射、柔和接触阴影和受限实时阴影；自动限制像素数、灯光槽和模拟频率。
- 控制面板 → 空间 → **生活场景**：选择「早咖啡」「晚饮」「客厅 · 游戏与追剧」「私人影院」「影音室 · 客住」，联动视角、灯光和影音室家具状态。
- 动作面板可独立开关影音室隐蔽门。
- 控制面板 → **收纳**：逐房查看 24 组上部柜体、用途及容量估算，并可展开柜门。厨房、工作区与高位柜使用上翻门。
- 白橡木、木地板、亚麻使用自托管 CC0 PBR 纹理，按米制尺寸铺贴，保留手机按需渲染。
- 控制面板 → 动作 → **微风与水波**：加载可暂停的窗帘、厨房水槽模拟。
- **碰撞演示**：在当前观察方向释放小球；最多保留 8 个，小球休眠后停止绘制。
- `?renderer=webgpu` 或 `?renderer=auto`：尝试 WebGPU；无适配器时直接使用 WebGL。运行中设备丢失时自动重载到 WebGL，视角会复位。
- `?wasm=0`：使用 JavaScript 几何变换，便于对照。

WebGPU 是实验性可选路径，目前不包含桌面 WebGL 的 GTAO/泛光链。移动端是否流畅仍须真机测试，不能把云端软件 GPU 的结果解释为手机 FPS，也不能据此承诺达到 3A 游戏画质。

参见 [V8 沙龙空间与家具](docs/salon-v8.md)、[V7 墙色与生活场景](docs/atmospheres-v7.md)、[上部收纳与材质改造](docs/storage-v6.md)、[实现与验证说明](docs/implementation.md)及[纹理来源](licenses/polyhaven-textures.md)。

[桌面预览](docs/desktop-preview.png) · [移动端横屏预览](docs/mobile-preview.png)
