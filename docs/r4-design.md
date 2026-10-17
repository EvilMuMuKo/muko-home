# MuKo Home R4 / 14.0.0

基线：R3 `d332cba`。本稿为日系温馨方向的材质、细节、照明和招牌深化，未扩大房屋、移动柱墙或改变家具外廓。最终模型由 R4 层一次生成，继承 R3 的完整门叶、500mm岛台、两人餐位、厨房和玻璃、移动电视与双模块沙发。

## 已实施

- 招牌移至 `(2.40, 6.60)`、底标高2.18m、1320×340×40mm，模型旋转-65°，主展示面朝客厅。保留单行 `MuKo’s Bar`，去掉远处不可读的小字；使用原材质族与现有洗光，不新增发光后期。整个牌体位于厨房玻璃终端平面南侧100mm以外。坐姿、站姿、入户三方向投影角及正面程度分别检查，实际遮挡另用截图检查。
- 主卧墙面使用低饱和暖深色与细腻织物，水吧北墙降低黄调。晚饮仅调整水吧任务/环境/展示层次，任务光3000K，不抬高全屋曝光。
- 植物茎叶撤下从布料继承的全部贴图；保持不透明薄叶、连续弯曲叶柄和收尖轮廓，保留几何缓存及原物件包络。UV缺失原因由代码链与浏览器警告对照确认。
- 原两只咖啡杯补杯沿、底圈、杯底和咖啡面；唱机补唱片标签、中心轴、支脚和唱头，保留唱机靠窗原位置。
- 修正卫浴预设镜头被内开门遮挡、冰箱预设过近的问题。日照阴影使用原PCF采样数与原贴图尺寸，扩大过滤半径（桌面2、手机1.25），缓和近景阶梯边缘，不提高DPR或增加阴影通道。
- 修复模块沙发嵌套座垫漏缝线；双工位在工作场景显示共享原创屏幕图，熄屏场景保持关闭。纸质书封不再使用布料法线纹理。
- 细节使用自建几何与轻量标准材质（咖啡面采用独立深色非金属材质），无外部字体、素材请求或新依赖。没有手机全屏AO/Bloom、景深、运动模糊、动态DPR或全屋实时反射。Three 0.186.0 / TypeScript / WASM 保持锁定。

## 可复跑与接口

`npm ci && npm run build` 生成同一最终模型、WASM及Pages产物。`npm test` 为全套回归；本机硬件用 `npx playwright test -c playwright.native.config.ts`。新增 `tests/r4-presentation.spec.ts` 覆盖招牌几何/视角、材质UV诊断及浏览器最终场景。

保持 `window.homePresentation` 兼容，新增 `getR4Revision()` 与 `getSurfaceAudit()`。后者按请求遍历几何/材质组合，不在动画帧运行；报告缺UV的带纹理网格。不能代替模型轮廓、UV质量或材质视觉检查。

截图：`node scripts/r4-release-audit.mjs URL OUTPUT_DIR`。全屋漫步：`node scripts/whole-home-walk-audit.mjs --base-url=URL --output-dir=DIR`。性能：`node scripts/r4-performance.mjs URL OUTPUT.json`，同设备/视口/档位，清HTTP缓存但不清GPU着色器缓存，12秒持续转向及20轮启停。离线间接光：`node scripts/bake-diffuse.mjs URL` 后重建。

## 设计调研的采用与取舍

- [Kinuta Terrace / Norm Architects](https://normcph.com/project/kinuta-terrace/)：借鉴光、木和留空的联系；不复制双层高度、面积或家具。
- [Hiroo Residence / Keiji Ashizawa Design](https://keijidesign.com/works/hiroo-residence/)：借鉴木作、灰泥与小尺度细节的一致性；不增加装饰体量。
- [Azabu Residence / Norm Architects](https://normcph.com/project/azabu-residence/)：仅借鉴水吧/主卧局部深色、木石与织物，不采用全屋深暗。
- [Three颜色管理](https://threejs.org/manual/pages/color-management.html)、[PBR材质](https://threejs.org/docs/pages/MeshStandardMaterial.html)：保持颜色贴图sRGB、数据贴图线性；材料区别来自几何、粗糙度、纹理尺度与光照。未因升级名义而增加昂贵特效。

## 已知限制与补测

R3岛台封闭浅柜深200mm，只计小物；餐位侧300mm膝部悬挑。门把手与台边约11mm名义X余量，退凳后无背后通道，两人离席需绕行。以上仍需完成面、五金与实体放样确认，不因软件测试通过变为舒适或施工通过。

玻璃北向停靠轨、止摆、固定与烟密闭合、吊柜和招牌锚固、岛台支撑、窗扇/帘/飘窗承载、实体设备散热与管线均 BLOCKED。真实手机硬件性能 NOT RUN。此稿提高部分建模与材质的一致性，仍是概念模型，不宣称达到3A游戏画质或现场适配。

## 验证

最终软件/截图/性能及发布证据见 `docs/r4/validation.json`；未完成项目不预填PASS。原始私人照片和个人上下文档案不进入本仓库。
