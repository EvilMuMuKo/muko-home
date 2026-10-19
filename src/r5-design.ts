/** R5 unifies the approved A8 study/cinema and A9 diagonal-living plans. */
import electricalLayout from "./electrical-layout.json";

export function createR5Design<T extends Record<string, any>>(base: T): T {
  const m: any = structuredClone(base);
  m.version = "15.0.0";
  const obj = (id: string) => {
    const found = m.objects.find((o: any) => o.id === id);
    if (!found) throw new Error(`R5 missing ${id}`);
    return found;
  };
  const put = (o: any) => {
    const i = m.objects.findIndex((x: any) => x.id === o.id);
    if (i < 0) m.objects.push(o); else m.objects[i] = o;
  };
  const transform = (cx: number, cz: number, x: number, z: number, yaw: number) => {
    const a = yaw * Math.PI / 180;
    return { x: cx + x * Math.cos(a) + z * Math.sin(a), z: cz - x * Math.sin(a) + z * Math.cos(a) };
  };

  // Keep the A9 two-position API stable. Activity is a third, separately named state.
  const tv = obj("living-tv");
  Object.assign(tv, { type: "mobile_tv", x: 10.2, z: 8.6, y: 0, w: 1.895, d: .06, h: 1.087, rotation: 155,
    screen: { w: 1.895, h: 1.087, centerHeightM: 1.3 }, stand: { w: 1.1, d: .66 }, accessoryRole: "PS5 and controllers travel on stand",
    collisionParts: [{ x: 10.2, z: 8.6, y: .7565, w: 1.895, d: .06, h: 1.087, rotation: 155, material: "black" },
      { x: 10.2, z: 8.6, y: 0, w: 1.1, d: .66, h: .12, rotation: 155, material: "cabinetPaint" }] });
  m.homeDesign.mobileTV.screen = { w: 1.895, h: 1.087, centerHeightM: 1.3, bottom: .7565, nominalInch: 85 };
  m.homeDesign.mobileTV.stand = { w: 1.1, d: .66, h: 1.1, casters: 4, locking: true };
  m.homeDesign.mobileTV.poses = [
    { x: 10.2, z: 8.6, rotation: 155, label: "斜向观影主位" },
    { x: 10.2, z: 8.6, rotation: 155, label: "兼容旧接口的同一主位" },
  ];
  m.homeDesign.mobileTV.activityPose = { x: 10.2, z: 8.83, rotation: 180, label: "活动模式后停", sofaMustBeMoved: true };
  m.homeDesign.mobileTV.noSidePose = true;
  m.homeDesign.mobileTV.planYawDegrees=205;
  const side = obj("side-table"); Object.assign(side, { x: 7.55, z: 7.6 });
  Object.assign(obj("living-lamp"), { x: 11.35, z: 4.75 });
  const lf = m.lighting.fixtures.find((f: any) => f.id === "living-reading-lamp");
  if (lf) Object.assign(lf, { position: [11.35, 1.6, 4.75], target: [10.4, .65, 5.2] });
  const ps5 = m.objects.find((o: any) => o.id === "ps5"); if (ps5) Object.assign(ps5, { x: 10.2, z: 8.6 });

  // Two full-size 1.275 x 1.05m modules with explicit state layouts from A9.
  const sofa = obj("living-sofa");
  Object.assign(sofa, { type: "modular_sofa", x: 9.3, z: 6.8, w: 2.55, d: 1.05, h: .76, rotation: 155, y: 0 });
  sofa.moduleOuterSigns=[-1,1];
  const combinedCenters = [-.6375, .6375].map(lx => transform(9.3, 6.8, lx, 0, 205));
  sofa.collisionParts = combinedCenters.map((p: any) => ({ ...p, w: 1.275, d: 1.05, h: .76, rotation: 155, material: "linen" }));
  m.homeDesign.modularSofa = {
    ...m.homeDesign.modularSofa,
    id: "living-sofa", moduleDimensions: { w: 1.275, d: 1.05, h: .76 },
    combined: combinedCenters.map((p: any, module: number) => ({ ...p, rotation: 155, module })),
    separated: [-.82, .82].map((lx, module) => ({ ...transform(9.3, 6.85, lx, 0, 205), rotation: 155, module })),
    meal: [{ x: 9.9375, z: 5.75, rotation: 180, module: 0 }, { x: 8.6625, z: 5.75, rotation: 180, module: 1 }],
    activity: [{ x: 9.9375, z: 5.575, rotation: 180, module: 0 }, { x: 8.6625, z: 5.575, rotation: 180, module: 1 }],
    selectedState: "combined", noFixedCoffeeTable: true,
    stateRules: { meal: "移动电视回主墙停位；备用餐桌展开", activity: "移动电视后停；模块沙发移至上侧，中央活动区清空" },
  };
  m.homeDesign.livingTV85 = { bodyM: [1.895, 1.087, .06], centerHeightM: 1.3, baseM: [1.1, .66], mainPose: [10.2, 8.6, 155], planYawDegrees:205, rotationConvention:"model clockwise; plane A9 is Three positive 205", activityPose: [10.2, 8.83, 180] };

  // Restore A9 folded furniture beneath suspended cabinet using its measured drawing coordinates.
  const table = obj("dining-table"); Object.assign(table, { x: 8.64, z: 8.82, y: .12 });
  table.parkedEnvelope = { x: 8.64, z: 8.82, w: 1.1, d: .18, h: 1.12, rotation: 0, coordinateFrame: "world_aabb" };
  const diningMeta = m.homeDesign.dining.table;
  diningMeta.parkedEnvelope = { ...diningMeta.parkedEnvelope, x: 8.64, z: 8.82, w: 1.1, d: .18, h: 1.12, rotation: 0, coordinateFrame: "world_aabb" };
  diningMeta.parked = { x: 8.64, z: 8.82, y: .12, rotation: 0, w: 1.1, d: .18, h: 1.12 };
  for (const [id, z] of [["dining-chair-left", 9.0], ["dining-chair-right", 9.16]] as const) {
    const c = obj(id); Object.assign(c, { x: 8.64, z, y: .12 });
    const meta = m.homeDesign.dining.chairs.find((v: any) => v.id === id); if (meta) meta.park = { ...meta.park, x: 8.64, z };
  }
  const deep = obj("r2-living-deep"); Object.assign(deep, { y: 1.4, z: 9.085, h: 1.3, d: .35, label: "电视侧悬空收纳 · 下方停靠折叠桌椅" });
  deep.r2Cabinet.bays=[-.3,.3].map(x=>({x,w:.6,y:.09,h:1.21,door:'solid',purpose:'supplies',shelves:[.4,.8]}));
  m.homeDesign.dining.table.foldedPositionStatus = "A9: stored vertically beneath suspended cabinet; removable furniture";
  m.homeDesign.dining.sequence = { ...m.homeDesign.dining.sequence,
    tablePath: [[8.64, 8.82], [8.64, 7.95], [9.3, 7.55]],
    // Unfold outside the tabletop first. applyHomeMotion then tucks to the real 8.5/10.1 use positions.
    chairPaths: [[[8.64, 9], [8.64, 7.85], [8.1, 7.55]], [[8.64, 9.16], [8.64, 7.85], [10.5, 7.85], [10.5, 7.55]]],
    foldedPark: [8.64, 8.82], foldedChairParks: [[8.64, 9], [8.64, 9.16]], describedBy: "A9" };

  // A8 study nook: the original large sofa-bed and linen cabinet remain unchanged.
  const small = {
    id: "study-sofa-bed", type: "study_sofa_bed", room: "guest", x: .69, z: .555, y: 0,
    w: 1.05, d: .8, h: .85, rotation: 0, material: "linen",
    collisionParts: [{ x: .69, z: .555, y: 0, w: 1.05, d: .8, h: .85, rotation: 0, material: "linen" }],
    opened: { x: .69, z: 1.115, w: 1.05, d: 1.92, h: .4, rotation: 0 },
    mechanism: { outerWidthM: 1.05, outerLengthM: 1.92, innerWidthM: 1, innerLengthM: 1.82, seatHeightM: .4, backHeightM: .85, extendTowardPositiveZ: true },
  };
  put(small);
  put({ id: "study-desk", type: "study_desk", room: "guest", x: .3, z: 1.975, y: 0, w: 1.96, d: .6, h: .74, rotation: 0, material: "oak", topThicknessM: .03,
    collisionParts: [
      { x: .3, z: 1.975, y: .71, w: 1.96, d: .6, h: .03, rotation: 0, material: "oak" },
      ...[[.125,1.715],[1.255,1.715],[.125,2.245],[1.255,2.245]].map(([x,z]) => ({ x, z, y: .0, w: .03, d: .03, h: .71, rotation: 0, material: "oak" })),
    ], legsCustomA8: true, clearUnderTopM: .68 });
  // A8 explicitly replaces only the left part of the old console with this rear cabinet.
  const console = obj("guest-tv-console"); Object.assign(console, { x: .69, z: 3.1, w: 1.18, d: .4, h: .45, y: 0, rotation: 0, label: "桌后小矮柜" });
  console.collisionParts = [{ x: .69, z: 3.1, y: 0, w: 1.18, d: .4, h: .45, rotation: 0, material: "oak" }];
  const gtv = obj("guest-tv"); Object.assign(gtv, { type: "mobile_tv", x: 2.05, z: 2.84, w: 1.895, d: .06, h: 1.087, y: 0, rotation: 180, material: "black",
    screen: { w: 1.895, h: 1.087, centerHeightM: 1.3 }, stand: { w: 1.086, d: .849 }, accessoryRole: "移动支架；远位默认、近位仅大床收起" });
  gtv.collisionParts = [
    { x: 2.05, z: 2.84, y: .7565, w: 1.895, d: .06, h: 1.087, rotation: 180, material: "black" },
    { x: 2.05, z: 2.84, y: 0, w: 1.086, d: .849, h: .12, rotation: 180, material: "cabinetPaint" },
  ];
  m.homeDesign.cinemaTV = { id: "guest-tv", bodyM: [1.895, 1.087, .06], centerHeightM: 1.3, baseM: [1.086, .849], poses: { far: [2.05, 2.84, 180], near: [2.05, 2.44, 180] },
    nearAllowedWhen: "both beds stored; workstation chair at desk", defaultPose: "far", nearPose: { x: 2.05, z: 2.44, rotation: 180 },
    orientationNote: "screen local +z faces toward smaller world z; Three model rotation is negative of this angle" };
  put({id:'cinema-subwoofer',type:'subwoofer',room:'guest',x:3.35,z:.45,y:.005,w:.31,d:.32,h:.35,rotation:0,material:'cinemaWood'});
  m.homeDesign.cinemaAudio={subwooferId:'cinema-subwoofer',soundbarParent:'guest-tv',wallSpeakerHeightM:1.4,
    removedFixedAccessories:['cinema:media-edge','cinema:media-head','old-soundbar-console-anchor','old-subwoofer-small-bed-footprint']};
  // Record chair and desk occupancy states without shrinking the actual 1.82m inner bed length.
  put({ id: "study-office-chair", type: "office_chair", room: "guest", x: .69, z: 1.4, y: 0, w: .75, d: .75, h: .9, rotation: 180, material: "sage",
    collisionParts: [{ x: .69, z: 1.4, y: 0, w: .75, d: .75, h: .9, rotation: 180, material: "sage" }] });
  put({ id: "study-computer", type: "pc", room: "guest", x: .36, z: 3.1, y: .45, w: .22, d: .42, h: .42, rotation: 90, material: "black",
    collisionParts: [{ x: .36, z: 3.1, y: .45, w: .22, d: .42, h: .42, rotation:90, material: "black" }], note: "真实尺寸主机横置于桌后矮柜顶；电源与数据线沿左侧固定引至桌面" });
  put({ id: "study-monitor", type: "monitor", room: "guest", x: .38, z: 1.94, y: .74, w: .62, d: .07, h: .39, rotation: 0, material: "black",
    collisionParts: [{ x: .38, z: 1.94, y: .74, w: .62, d: .07, h: .39, rotation: 0, material: "black" }] });
  for (const [id, x] of [["study-speaker-left", -.08], ["study-speaker-right", .84]]) put({ id, type: "speaker", room: "guest", x, z: 1.94, y: .74, w: .14, d: .16, h: .2, rotation: 0, material: "black",
    collisionParts: [{ x, z: 1.94, y: .74, w: .14, d: .16, h: .2, rotation: 0, material: "black" }] });
  m.homeDesign.studyNook = { sofaBedId: "study-sofa-bed", deskId: "study-desk", chairId: "study-office-chair", closedBounds: [.165, .155, 1.215, .955], openBounds: [.165, .155, 1.215, 2.075], innerOpenLengthM: 1.82,
    deskBounds: [-.68, 1.675, 1.28, 2.275], desktopHeightM: .74, topThicknessM: .03, apronMinY: .68,
    customLegBounds: { leftX: [.11, .14], rightX: [1.24, 1.27], frontZ: [1.7, 1.73], rearZ: [2.23, 2.26], gapToBedM: .025 },
    states: { deskUseChair: [.69, 1.4], smallBedOpenChairParking: [2.9, 1.8], largeBedOpen: "small sofa closed; workstation occupant exits first" },
    deskTopComputerEquipmentAtBaySide: false, computerTowerLocation: "rear-cabinet", bedFootMayEnterDeskUnderside: true, fullMovementValidation: "A8 two-dimensional audit only" };

  // Camera IDs remain stable; revise the living subject and seated viewpoint for the diagonal TV.
  for (const c of m.cameras) if (c.id === "living") c.target = [9.55, 6.95];
  for (const v of m.presentation.interiorViews) {
    if (v.id === "living-main") Object.assign(v, { position: [7.5, 1.62, 5.9], target: [9.7, 1.25, 7.6] });
    if (v.id === "living-seated") Object.assign(v, { position: [9.2, 1.18, 6.8], target: [10.2, 1.3, 8.6] });
    if (v.id === "living-media") Object.assign(v, { position: [9.2, 1.35, 6.8], target: [10.2, 1.3, 8.6] });
    if (v.id === "guest-seated") Object.assign(v, { position: [2.05, 1.18, .75], target: [2.05, 1.3, 2.84] });
  }
  m.presentation.interiorViews.push({id:"study-work",roomId:"guest",label:"飘窗单人工位",position:[.69,1.12,1.4],target:[.38,.97,1.94],horizontalFov:82});
  m.homeDesign.electrical = structuredClone(electricalLayout);
  const balconyRoute=m.presentationScenarios.find((s:any)=>s.id==='ps5-balcony');
  if(balconyRoute?.people?.[0])balconyRoute.people[0].points=[[8.1,5.30],[10.75,5.30],[11.45,5.70],[12.1,6.1]];
  m.homeDesign.retiredObjects = [...new Set([...(m.homeDesign.retiredObjects ?? []), "guest-tv-fixed-mount", "guest-tv-console-middle-right-media-segment"])];
  m.homeDesign.accessoryReconciliation.retiredObjects.push('cinema:media-edge','cinema:media-head');
  m.homeDesign.r5Revision = { sources: ["A8 影音室移动电视审计", "A9 客厅斜向电视平面", "A10 全屋插座平面"], structureChanged: false,
    scope: "unified virtual model; dimensions are concept budgets, not site survey" };
  return m;
}
