/** R3: approved short entry notch, inward doors and closed daily-dining island.
 * All lengths are adjustable concept budgets; photographs establish relationships, not survey dimensions.
 */
export function createR3Design<T extends Record<string, any>>(base: T): T {
  const m: any = structuredClone(base);
  m.version = "13.0.0";
  const get = (id: string) => {
    const o = m.objects.find((o: any) => o.id === id);
    if (!o) throw new Error(`R3 missing ${id}`);
    return o;
  };
  const bay = (
    x: number,
    w: number,
    y: number,
    h: number,
    door: "solid" | "open",
    purpose: string,
    shelves: number[] = [],
  ) => ({ x, w, y, h, door, purpose, shelves });
  const resizeCabinet = (id: string, patch: any, bays: any[]) => {
    const o = get(id);
    Object.assign(o, patch);
    o.r2Cabinet = { ...o.r2Cabinet, bays };
    return o;
  };

  // Only the entry notch is revised. Column, bearing wall and bedroom dimensions remain intact.
  const notchX = 7.1;
  m.shell = m.shell.map((p: number[]) => [p[0] === 7.95 ? notchX : p[0], p[1]]);
  for (const id of ["balcony-west", "step", "west-right"]) {
    const w = m.walls.find((w: any) => w.id === id);
    if (!w) throw new Error(`R3 missing wall ${id}`);
    for (const key of ["a", "b"])
      if (w[key][0] === 7.95) w[key] = [notchX, w[key][1]];
  }
  for (const r of m.rooms.filter((r: any) => ["hall", "living"].includes(r.id)))
    r.polygon = r.polygon.map((p: number[]) => [
      p[0] === 7.95 ? notchX : p[0],
      p[1],
    ]);
  for (const [id, openAngle] of [
    ["entry-door", 90],
    ["guest-door", -90],
    ["bath-door", 90],
  ] as const) {
    const o = m.openings.find((o: any) => o.id === id);
    o.openAngle = openAngle;
    o.swingNote =
      "R3 inward swing; same full leaf width; concept clearances checked independently";
  }

  // Keep the 1100mm entry leaf. Move the 500mm top 200mm west instead of shrinking the door or stools.
  const island = get("s02-entry-return");
  Object.assign(island, {
    x: 4.95,
    w: 0.5,
    d: 1.6,
    z: 7.525,
    h: 0.95,
    y: 0,
    accessFace: "-x",
    label: "两人日常餐位 · 封闭浅柜",
    collisionParts: [
      {
        x: 4.95,
        z: 7.525,
        w: 0.5,
        d: 1.6,
        y: 0.915,
        h: 0.035,
        material: "barStone",
      },
    ],
  });
  const closedBase = {
    id: "r3-entry-island-base",
    type: "wall_storage",
    room: "bar",
    x: 5.1,
    z: 7.525,
    y: 0,
    w: 1.6,
    d: 0.2,
    h: 0.915,
    rotation: 90,
    label: "岛台封闭浅储物",
    material: "cabinetPaint",
    caseMaterial: "oak",
    insideMaterial: "cabinetInterior",
    accessFace: "+x",
    fronts: ["solid", "solid"],
    shelves: [],
    purpose: "small-items",
    access: "daily",
    r2Cabinet: {
      frameMaterial: "oak",
      frontMaterial: "cabinetPaint",
      backMaterial: "cabinetInterior",
      bays: [
        bay(-0.4, 0.8, 0.09, 0.825, "solid", "small-items", [0.3, 0.6]),
        bay(0.4, 0.8, 0.09, 0.825, "solid", "small-items", [0.3, 0.6]),
      ],
    },
    coordinateStatus: "R3_virtual_budget_not_surveyed",
  };
  m.objects.push(closedBase);
  const dining = m.homeDesign.entryIslandDining;
  dining.pullbackM = 0.4;
  dining.historicalLengthCandidates = {revision:"V11", active:false, candidates:dining.lengthCandidates};
  delete dining.lengthCandidates;
  dining.kitchenToIslandLongitudinalBudgetM = .875;
  dining.mainPassageNote = "route bends around peninsula corner; .875 is a longitudinal budget, not route clear width";
  for (const seat of dining.seats) {
    const o = get(seat.id);
    o.x = 4.4;
    seat.center = [o.x, o.z];
    seat.pulledCenter = [o.x - dining.pullbackM, o.z];
    seat.pulledWestMinX = seat.pulledCenter[0] - 0.23;
  }
  Object.assign(dining, {
    dailyMainDining: true,
    stoolClearOfRearBar: true,
    seatAndKneeValidation:
      "R3 300mm knee overhang, real 460mm stools; no through-aisle behind occupied seats claimed",
    routeValidation: "R3 final geometry; independent door and joint-use audit",
    rearBarMaxX: 3.6,
  });
  Object.assign(m.homeDesign.entryIsland, {
    center: [island.x, island.z],
    crossSectionWidthM: 0.5,
    lengthM: 1.6,
    xBounds: [4.7, 5.2],
    zBounds: [6.725, 8.325],
    kneeVoidDepthM: 0.3,
    closedStorageDepthM: 0.2,
    storageId: closedBase.id,
    alignment:
      "same 500mm finished width as unchanged column; center shifted 200mm west for full inward entry leaf",
    status: "R3_virtual_daily_dining_with_closed_shallow_storage",
  });
  m.homeDesign.dining.role = "backup_normal_height_table";
  m.homeDesign.dining.barRole =
    "entry island is daily two-person dining; service wall and kitchen peninsula remain preparation";
  m.homeDesign.entryHatch = {
    ...m.homeDesign.entryHatch,
    enabled: false,
    available: false,
    retired: "R3 open main passage; fixed daily island retained",
  };

  // A real one-person 560mm shoe bench replaces the overlong 1410mm entry cabinet.
  resizeCabinet(
    "r2-entry",
    {
      x: 6.73,
      z: 8.085,
      w: 0.56,
      d: 0.55,
      h: 2.7,
      label: "单人换鞋 · 鞋与少量次净衣",
    },
    [
      bay(0, 0.56, 0.09, 0.35, "open", "bench"),
      bay(0, 0.56, 0.44, 1.61, "open", "pegboard"),
      bay(0, 0.56, 2.05, 0.65, "solid", "seasonal"),
    ],
  );
  Object.assign(get("entry-pegboard"), {
    x: 6.73,
    z: 8.27,
    w: 0.46,
    y: 0.95,
    h: 0.85,
  });
  // TV-side storage is suspended. Folded table/chairs remain real removable furniture underneath.
  resizeCabinet(
    "r2-living-deep",
    {
      y: 1.4,
      z: 9.085,
      h: 1.3,
      d: 0.35,
      label: "电视侧悬空收纳 · 下方可移动桌椅停靠",
    },
    [
      bay(-0.3, 0.6, 0.09, 1.21, "solid", "small-items", [0.38, 0.78]),
      bay(0.3, 0.6, 0.09, 1.21, "solid", "linen", [0.38, 0.78]),
    ],
  );
  m.homeDesign.dining.table.foldedPositionStatus =
    "R3 removable furniture beneath suspended cabinet; no floor-fixed tall cabinet";
  m.homeDesign.dining.sequence.description =
    "从悬空柜下取出直立折叠桌椅，再展开；下方区域随桌椅移动释放";
  m.homeDesign.entryStorage = {
    benchWidthM: 0.56,
    seatHeightM: 0.44,
    fullHeightWardrobe: false,
    wornClothes:
      "small pegboard hooks for one change; bulk clothing in bedrooms",
    tvSideStorage:
      "suspended cabinet underside 1.40m; removable folded furniture max height 1.24m",
  };

  // The inward guest leaf must permit walking around its free end, not just avoid cabinet intersection.
  // Keep the 650mm drinks-fridge bay at the same real world position; shorten only the linen bay by 250mm.
  resizeCabinet(
    "r2-guest-wardrobe",
    { z: 1.075, w: 1.65, label: "客房床品与饮料冰箱 · 内开门回转留空" },
    [
      bay(
        -0.325,
        1.0,
        0.09,
        2.16,
        "solid",
        "linen",
        [0.35, 0.7, 1.05, 1.4, 1.75],
      ),
      bay(0.5, 0.65, 0.09, 0.91, "open", "appliance"),
      bay(0.5, 0.65, 1, 1.25, "solid", "wardrobe"),
      bay(0, 1.65, 2.25, 0.45, "solid", "seasonal"),
    ],
  );

  // Diagonal reading chair opens toward the room, leaving kitchen-front circulation free.
  Object.assign(get("reading-chair"), { x: 1.1, z: 6.73, rotation: -135 });
  Object.assign(get("reading-side"), { x: 1.85, z: 6.9 });

  const side = m.openings.find((o: any) => o.id === "kitchen-door");
  side.r3Corner = {
    trackDirection: 1,
    firstTrackOffsetM: 0.015,
    railOffsetM: 0.054,
    railThicknessM: 0.104,
    startPostOffsetM: 0.013,
    endPostOffsetM: 0.069,
    handleSide: -1,
    parkOutside: true,
    omitStartPost: true,
  };
  const counter = m.openings.find((o: any) => o.id === "kitchen-pass-window");
  Object.assign(counter, {
    width: 3.989,
    center: [1.9945, 5.85],
    r3Corner: { omitEndPost: true },
  });
  for (const b of m.homeDesign.bayWindows)
    b.r3Use = {
      sideSign: b.roomId === "master" ? -1 : 1,
      label:
        b.roomId === "master"
          ? "主卧窗边薄垫、托盘与侧向书架"
          : "影音客房日间阅读与客住置物",
      role: "raised_ledge_perch",
      components: {
        bookCount: b.roomId === "master" ? 3 : 2,
        tray: b.roomId === "master" ? { zOffset: 0.85 } : { zOffset: -0.9 },
      },
    };

  // Keep lighting, use envelopes and accessory ownership attached to their revised geometry.
  for (const f of m.lighting.fixtures)
    if (f.anchor === "r2-entry") {
      f.position = [6.73, 0.12, 7.83];
      f.target = [6.73, 0.02, 7.55];
    }
  for (const o of m.objects.filter((o: any) => o.r2Cabinet)) {
    const n = (
      { 0: [0, -1], 90: [1, 0], 180: [0, 1], "-90": [-1, 0] } as Record<
        string,
        number[]
      >
    )[o.rotation];
    o.accessFace = ({ 0: "-z", 90: "+x", 180: "+z", "-90": "-x" } as any)[
      o.rotation
    ];
    o.useEnvelope = {
      x: o.x + n[0] * (o.d / 2 + 0.3),
      z: o.z + n[1] * (o.d / 2 + 0.3),
      w: o.w,
      d: 0.6,
      h: 1.88,
      y: 0,
      rotation: o.rotation,
      coordinateFrame: "oriented_world",
      source: "R3_operator_budget_not_joint_acceptance",
    };
  }
  m.homeDesign.r3Revision = {
    version: 13,
    source:
      "user-approved proportion and inward-door/closed-island requirements",
    unmeasured: true,
    entryNotchX: notchX,
    previousNotchX: 7.95,
    island: {
      widthM: 0.5,
      lengthM: 1.6,
      topHeightM: 0.95,
      kneeOverhangM: 0.3,
      closedCaseDepthM: 0.2,
      dailySeats: 2,
    },
    doors: "all four inward; full original widths retained",
    mobileControls: "floating_dual_sticks",
    glazing:
      "outward tracks, kitchen-facing handle and shared corner post; selected hardware pending",
    conditions: [
      "notch and jamb endpoint survey",
      "500mm counter depth and 188cm user ergonomic mock-up",
      "shallow cabinet anchorage and countertop support",
      "bay structural capacity and child/window safety",
      "sliding glass seals and smoke control",
      "real mobile hardware performance",
    ],
  };
  return m;
}
