# MuKo Home R7 · 包豪斯 × 日本现代外观（17.0.0）

R7 包在 R6 16.0.0 外面。R6 的 16 组墙开关、43 个灯具光品质指标、三对双控和弱电拓扑保持原样。柱、床、窗、开间、家具外尺寸和移动电视 / 模块沙发没有改。本版是可浏览的概念模型，不是施工、五金承载或燃气密闭验收。真机性能本轮 NOT RUN。

## 行为

- 水吧仍是 3510×750×2700，五列分工不变。精酿 800 模块底格改为 y=0..0.915、门洞敞开，落地设备高 850；其余格保留 90 踢脚。台面支承还在。台底到设备顶约 65mm 只是几何预算，不声明散热通过。
- 550 上部展示改为可开的细黑玻璃门，仍走原来的收纳门交互，透明门关上时三层层板与陈列物仍持续可见；普通不透明门保持关门隐藏内部的优化。水吧只保留两颗红 / 蓝球拉手，装在对应门页上。
- 出品窗不再使用四扇横移玻璃。侧门 `kitchen-door` 仍是原来的三扇滑门。新品窗是两组双折，每片长 700，铰链在 y=2.35，关闭时下沿 0.95。运动跟现有 `an.kitchen`，没有新按钮。全开时上下片在厚度上错开。右侧 1220 为固定玻璃，上方 2.35..2.70 是固定眉梁。
- 人物正在漫步且站在 x0.09..2.70、z5.85..6.55 的动作区内时，开合会被拒绝，原因 `walker-in-pass-sweep`。按钮、漫步目标、`setKitchenOpen` 及诊断用的中态保持接口走同一人物范围判断。
- MuKo’s Bar 牌改到眉梁厨房侧，x=1.395，z=5.83，y=2.40，高 200。朝 +z，不再用吊杆。仍用 `r2-bar-sign-light`。镜头 id `r4-bar-from-living` 仍有效，目标改到新牌。
- 出品柜外侧是 100mm 概念银灰釉砖和 30×150 木台边，不封设备背面。阅读椅用少量芥末黄，客厅沙发模块不整组染色。

## 源码

- `src/r7-design.ts`：最后一层模型。`final-design.ts` 在 `createR6Design` 之外调用它。
- `src/r7-mesh.ts`：双折、固定玻璃、眉梁和外侧釉砖。`scene.js` 只在开窗分支、`bx` 和餐厨玻璃入口挂钩。
- `src/r7-finish.ts`：浅色、壁龛木、黑玻璃、拉丝钢、釉砖。釉砖贴图初始化时共享一套。`finishFurniture` 碰到带 `r7Role` 的材质会跳过。
- 诊断：`window.homePresentation.getR7Revision()` 与 `setKitchenOpen(open)`。页面上没有新的客户按钮。

## 本轮复核

- 出品窗根节点使用和侧滑门相同的 `tag(root, [kitchen, bar, hall], opening)`，房间勾选会隐藏或显示它。
- 眉梁改成浅色分块，留在招牌背面（世界 z≤5.81）。招牌正面朝吧区，不埋进实心梁。
- 折页有竖框、端横框和拉丝钢铰销。上下片厚度错开，避免叠合。
- 木台边顶面与 0.95 台面齐平，厚 30mm，外挑 150mm。
- 只有 550 宽、三层搁板的上部展示改成玻璃门。其余开放格保持开口。
- 釉砖贴图一张代表 100mm，重复 10 次/米。粗糙度贴图按绝对值使用，材质粗糙度为 1。法线由砖面和砖缝的高度差算出。拉丝钢只用在折页铰销。
- 折页世界坐标 A/B/C 在 0、0.25、0.5、0.75、1 与公式对照。侧滑门仍是 3 扇线性叶片。

招牌字是透明暖白纹理，不再用浅色底盖住木板。550 展示门有窄黑框，玻璃内缩并跟门页转动。折窗、眉梁、釉砖和木台边尺寸读最终模型。截图改由 `scripts/r7-visual-audit.mjs` 负责，不进 CI 分片。

## 这轮实测

`npm run build` 通过，最终模型 17.0.0，源码、统一模型快照与静态产物一同提交。Playwright 针对 R2 几何、R2 交互、R3、R4、R5、R6 开关、R7 几何共 29 项通过（1.6 分钟，日志 `outputs/r7-implementation/playwright.txt`）。几何与交互回归仍在测试目录，重截图不进 CI。

`scripts/r7-visual-audit.mjs` 对 `http://localhost:4173/?renderer=webgl` 通过，16 张，页面错误为空。夜间先设灯光再设机位：`sign-night` 为 `r4-bar-from-living` / `aperitif`。折窗中态在 `no-preference` 下取到 `kitchenProgress` 0.210 并保持，闭合为 0，全开为 1。记录在 `outputs/r7-implementation/screenshots/r7-visual-audit.json`。

`scripts/gpu-visual-audit.mjs` 另补了实际渲染帧、目标视角和灯光场景的等待条件，防止截到切换前的旧画面。用最终构建重跑到 `outputs/r7-implementation/native-reviewed`：状态 PASS，版本 17.0.0，渲染器 WebGPU，adapter vendor apple、architecture metal-3、非 fallback，碰撞后端 wasm，控制台错误为空，6 张。这是桌面 Chrome 的原生画面，不是施工验收。真机 NOT RUN。

透明展示格已补关→开→关的运行时可见性断言，以及普通实门柜的对照；受影响的 R7 与 R2 交互共 8 项通过，另保存 18 张原生地址截图（含新增展示柜正面开闭近景）。

## 运行复核

```sh
npm run build
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm test
node scripts/r7-visual-audit.mjs http://localhost:4173/ /tmp/muko-r7-visual
node scripts/gpu-visual-audit.mjs http://localhost:4173/ /tmp/muko-r7-gpu
```

后两个脚本需先运行 `npm run preview -- --port 4173`。截图必须等待欢迎动画结束；报告记录实际视角和灯光状态。桌面缩小视口仅覆盖界面适配，不能代替手机真机帧率验收。全量 CI 结果以当前 PR 的 Build and verify 为准。

## 待核

- 折页五金、黑框 25mm、玻璃密封、燃气与烟密闭均未验收。
- 精酿 65mm 顶隙不是散热结论。
- 釉砖、木色和日夜亮度是效果目标，要以实际截图再调。
- 入户岛台与玄关的原尺寸、11mm 名义待核冲突没有用造型抹掉。
