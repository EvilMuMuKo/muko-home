# MuKo Home R7 · 包豪斯 × 日本现代外观（17.0.0）

R7 包在 R6 16.0.0 外面。R6 的 16 组墙开关、43 个灯具光品质指标、三对双控和弱电拓扑保持原样。柱、床、窗、开间、家具外尺寸和移动电视 / 模块沙发没有改。本版是可浏览的概念模型，不是施工、五金承载或燃气密闭验收。真机性能本轮 NOT RUN。

## 行为

- 水吧仍是 3510×750×2700，五列分工不变。精酿 800 模块底格改为 y=0..0.915、门洞敞开，落地设备高 850；其余格保留 90 踢脚。台面支承还在。台底到设备顶约 65mm 只是几何预算，不声明散热通过。
- 550 上部展示改为可开的细黑玻璃门，仍走原来的收纳门交互，透明门关上时三层层板与陈列物仍持续可见；普通不透明门保持关门隐藏内部的优化。水吧只保留两颗红 / 蓝球拉手，装在对应门页上。
- 出品窗不再使用四扇横移玻璃。侧门 `kitchen-door` 仍是原来的三扇滑门。新品窗是两组双折，每片长 700，铰链在 y=2.35，关闭时下沿 0.95。运动跟现有 `an.kitchen`，没有新按钮。全开时上下片在厚度上错开。右侧 1220 为固定玻璃，上方 2.35..2.70 是固定眉梁。
- 人物正在漫步且站在 x0.09..2.70、z5.85..6.55 的动作区内时，开合会被拒绝，原因 `walker-in-pass-sweep`。按钮、漫步目标、`setKitchenOpen` 及诊断用的中态保持接口走同一人物范围判断。
- MuKo’s Bar 牌改到眉梁厨房侧，x=1.395，z=5.83，y=2.40，高 200。朝 +z，不再用吊杆。仍用 `r2-bar-sign-light`。镜头 id `r4-bar-from-living` 仍有效，目标改到新牌。
- 出品柜外侧 100mm 灰蓝釉面小方砖（`r7Tile`）、底部浅色踢脚与 30×150 深木台边（`r7-pass-lip`，x=0.09..3.92，全宽 3.83m）从左端贯通至右侧玻璃门框，右侧胡桃木端板完整收口，同时保留厨房侧 900mm 滑门通行净空。
- 厨房地面采用 45° 斜向暖黄与奶油棋盘格（`r7KitchenChecker`），北墙与侧窗防溅面铺设同系灰蓝小方砖，全屋橱柜统一奶油门板（`r7Pale`）与暖胡桃木柜体（`r7NicheWood`）。
- 阅读椅用芥末黄（`r7Mustard`），窗下唱片柜配置成对胡桃木书架音箱与透明防尘盖；入户岛台铺设条纹短桌旗、芥末黄餐垫与黄铜小台灯，入户左墙增设胡桃木护墙收口。
- 客厅双模块沙发统一为哑光黑皮（`r7BlackLeather`）配芥末黄针织搭毯；影音室取消独立办公转椅可见网格（由并排森林绿小沙发床 `r7ForestGreen` 兼作窗边工位坐席），东墙增设黑胶陈列架与复古几何地毯（`r7CinemaRug`）；主卧采用暖暗橄榄棕墙面、咖啡格纹床品（`r7PlaidBedding`）与床头木框挂画。

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

招牌字是透明暖白纹理，不再用浅色底盖住木板。550 展示门有窄黑框，玻璃内缩并跟门页转动。玻璃展示格的层板在门关着时也留在场景里，普通实心门内胆仍随开门才显示。折窗、眉梁、釉砖和木台边尺寸读最终模型。截图改由 `scripts/r7-visual-audit.mjs` 负责，不进 CI 分片。

厨房外立面釉砖是 100mm 冷灰，带轻微起伏和细白缝。客厅展开餐桌的正上方，关节灯从 2.68m 天花接出三段相接的银杆和奶油罩，不另加光源。餐桌收起时灯罩底高于 2.0m。红色圆角三角钟、浅架和圆拱菜单装在水吧通顶柜东侧端板上，朝公共区约 120mm。厨房西墙被整高开口切空，不能当安装面。桌布挂在 `buildHomeFurniture` 造出的 `motion.table.top` 上，只在餐桌展开时显示，并随桌面倾倒和平移。客厅地毯是橙色织物纹理。客厅地面只使用 `materials.floor`，颜色、法线和粗糙度都是 `scripts/r7-herringbone.py` 用仓库橡木三张贴图离线生成的同一人字拼：`r7-herringbone-color.webp`、`r7-herringbone-normal.webp`、`r7-herringbone-roughness.webp`，均为 1024×1024，铺贴尺度 1.7 m。手机和桌面请求同一张，不再请求 `floor-*-desktop` 或旧的直铺 `floor-roughness`。十二张纹理请求数不变。颜色仍是 sRGB，法线和粗糙度仍是无色彩空间。失败记录仍用 `floor-color` 这类键，并另有 `failedSources` 写出真实 URL。厨房、卫浴和阳台继续用石材，这张人字拼不赋给家具。水吧座前有一小块旋转过的黄白棋盘，不抬高地面。客厅浅柜是银色模块柜，中间开敞格外沿有一圈细铬管和角上的球，另有一块黄托盘。灯罩宽端朝下，只有餐桌完全展开后才下降，下降后的罩影落在桌面内。这些是可浏览的概念模型，不是 3A 成片，也不是真机或现场验收。

## 这轮实测

2026-10-21：`npm run build` 通过，模型 17.0.0。入口脚本是 `assets/index-D_j1Oevz.js`，样式仍是 `assets/index-Cq-AD4mh.css`。人字拼三张 WebP 在 `public/materials/` 与 `dist/materials/`。

Playwright 复用 `http://localhost:4173`，原生 Chrome。`tests/r7-geometry.spec.ts` 与 `tests/progressive-materials.spec.ts` 共 9 项通过（1.4 分钟）。十二个纹理请求里地板三通道是 `r7-herringbone-{color,normal,roughness}.webp`，没有 `floor-*`。桌布父级是真实折叠桌面，收起时隐藏，展开时世界位置跟着桌面转。灯链几何断言没有改。真机 NOT RUN。

`scripts/gpu-visual-audit.mjs` 写到 `outputs/r7-implementation/final-style-native/webgpu-visual-audit.json`。地板断言对齐 `src/material-detail.ts`：三通道宽高都是 1024，`family` 为 `floor`，铺贴 `[1.7, 1.7]`，并且各有一条状态 200 的 `r7-herringbone-{color,normal,roughness}.webp`，没有 `floor-*`。WebGPU、WASM、4xMSAA 和页面 / 控制台 / 失败资源检查仍在。2026-10-21 对 `http://localhost:4173/` 重跑：状态 PASS，版本 17.0.0，渲染器 WebGPU，adapter vendor apple、architecture metal-3、非 fallback，碰撞后端 wasm，页面错误、控制台错误、失败资源都是 0，6 张有效帧是 `bar-day.png`、`bar-night.png`、`living-night.png`、`master-day.png`、`master-night.png`、`master-work.png`（各 1440×900）。同目录早先的 `floor-herringbone.png` 与 `bar-end.png` 不计入这 6 张。先前那次 2048 断言的 FAIL 不是这次结果。这不是 3A，也不是真机或现场验收。真机 NOT RUN。

`scripts/r7-visual-audit.mjs` 对 `http://localhost:4173/?renderer=webgl` 通过，16 张，页面错误为空。夜间先设灯光再设机位：`sign-night` 为 `r4-bar-from-living` / `aperitif`。折窗中态在 `no-preference` 下取到 `kitchenProgress` 0.210 并保持，闭合为 0，全开为 1。记录在 `outputs/r7-implementation/screenshots/r7-visual-audit.json`。

`scripts/gpu-visual-audit.mjs` 另补了实际渲染帧、目标视角和灯光场景的等待条件，防止截到切换前的旧画面。用最终构建重跑到 `outputs/r7-implementation/native-reviewed`：状态 PASS，版本 17.0.0，渲染器 WebGPU，adapter vendor apple、architecture metal-3、非 fallback，碰撞后端 wasm，控制台错误为空，6 张。这是桌面 Chrome 的原生画面，不是施工验收。真机 NOT RUN。

透明展示格已补关→开→关的运行时可见性断言，以及普通实门柜的对照；受影响的 R7 与 R2 交互共 8 项通过，另保存 18 张原生地址截图（含新增展示柜正面开闭近景）。

## 运行复核

下面是更早一轮的命令备忘。2026-10-21 的结果以上一节为准。

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
