/** R7 applies the confirmed A12 Bauhaus × Japanese-modern finish on the R6 model. */
export function createR7Design<T extends Record<string, any>>(base: T): T {
  const m: any = structuredClone(base);
  m.version = "17.0.0";
  const obj = (id: string) => {
    const found = m.objects.find((o: any) => o.id === id);
    if (!found) throw new Error(`R7 missing ${id}`);
    return found;
  };

  const water = obj("r2-waterbar");
  water.r2Cabinet.frameMaterial = "r7Pale";
  water.r2Cabinet.frontMaterial = "r7Pale";
  water.r2Cabinet.backMaterial = "r7NicheWood";
  water.r2Cabinet.r7PullPolicy = "two-balls";
  water.r2Cabinet.r7BallPulls = [
    { bay: 0, segment: 0, leaf: 0, color: "#b23a3a" },
    { bay: 12, segment: 0, leaf: 0, color: "#2f4f86" },
  ];
  for (const bay of water.r2Cabinet.bays) {
    if (bay.purpose === "beer" && bay.y <= 0.09) {
      bay.y = 0;
      bay.h = 0.915;
      bay.door = "open";
    }
    if (bay.purpose === "display" && bay.door === "open" && (bay.shelves?.length ?? 0) >= 3 && Math.abs(bay.w - 0.55) < 0.02 && bay.y >= 1.6) {
      bay.door = "solid";
      bay.material = "r7BlackGlass";
    }
    if (bay.door === "open" && bay.purpose !== "display") bay.material = "r7NicheWood";
  }
  const keg = obj("kegerator");
  keg.y = 0;
  keg.h = 0.85;
  if (keg.collisionParts) for (const p of keg.collisionParts) if (p.y < 0.2) p.y = 0;

  const pass = m.openings.find((o: any) => o.id === "kitchen-pass-window");
  if (!pass) throw new Error("R7 missing kitchen-pass-window");
  delete pass.r2Glazing;
  delete pass.panelClosedCenter;
  delete pass.travel;
  Object.assign(pass, {
    type: "sliding_door",
    r7Fold: true,
    center: [1.395, 5.85],
    width: 2.61,
    height: 1.4,
    sill: 0.95,
    head: 2.35,
    leafLength: 0.7,
    groups: 2,
    groupWidth: 1.305,
    x0: 0.09,
    x1: 2.7,
    fixedGlass: { x0: 2.7, x1: 3.92 },
    header: { y0: 2.35, y1: 2.7, depth: 0.04, localZ: -0.06, reveal: { x0: 0.735, x1: 2.055, y0: 2.4, y1: 2.6 } },
    frameM: 0.025,
    planeZ: 5.85,
    sweep: { x0: 0.09, x1: 2.7, z0: 5.85, z1: 6.55, y0: 0.95, y1: 2.35 },
    hardwareStatus: "concept_fold_demo_not_hardware_or_gas_seal_acceptance",
  });

  m.objects.push({
    id: "r7-pass-lip",
    type: "cabinet_frame",
    room: "kitchen",
    x: 1.395,
    z: 5.925,
    y: 0.92,
    w: 2.61,
    d: 0.15,
    h: 0.03,
    rotation: 0,
    material: "r7LipWood",
    r7Role: "outer-counter-edge",
    note: "30mm timber edge, 150mm overhang on the bar face only; not an equipment back panel",
    collisionParts: [{ x: 1.395, z: 5.925, y: 0.92, w: 2.61, d: 0.15, h: 0.03, material: "r7LipWood" }],
  });

  const sign = obj("r2-bar-sign");
  Object.assign(sign, {
    x: 1.395, z: 5.83, y: 2.4, w: 1.32, h: 0.2, d: 0.035, rotation: 0,
    r7HeaderMounted: true, material: "r7NicheWood",
  });
  sign.presentation = {
    primaryAudience: "bar",
    mount: "kitchen-side recess in the fixed header; faces +z",
    clearanceBasis: "sign max z stays below the fold plane z=5.85; concept, not installation acceptance",
  };
  const lamp = m.lighting.fixtures.find((f: any) => f.id === "r2-bar-sign-light");
  if (lamp) Object.assign(lamp, {
    position: [1.395, 2.55, 6.12],
    target: [1.395, 2.5, 5.83],
    anchor: "r2-bar-sign",
    kelvin: 2700,
    lumens: 140,
  });
  for (const view of m.presentation.interiorViews) {
    if (view.id === "r4-bar-from-living") Object.assign(view, {
      position: [4.6, 1.7, 7.15],
      target: [1.395, 2.5, 5.85],
    });
  }
  m.presentation.interiorViews.push({
    id: "r7-display-front",
    roomId: "bar",
    label: "550玻璃展示正面",
    position: [2.015, 1.72, 6.2],
    target: [2.015, 2.15, 7.61],
    horizontalFov: 42,
  });

  const shallow = obj("r2-living-shallow");
  shallow.r2Cabinet.frameMaterial = "r7Pale";
  shallow.r2Cabinet.frontMaterial = "r7Pale";
  for (const bay of shallow.r2Cabinet.bays) {
    if (bay.door === "open") bay.material = "r7NicheWood";
  }
  const entry = obj("r2-entry");
  entry.r2Cabinet.frameMaterial = "r7Pale";
  entry.r2Cabinet.frontMaterial = "r7Pale";
  for (const bay of entry.r2Cabinet.bays) {
    if (bay.door === "open" && bay.purpose !== "bench") bay.material = "r7NicheWood";
  }

  const chair = obj("reading-chair");
  chair.material = "r7Mustard";
  const peninsula = obj("r2-kitchen-peninsula");
  const tileH = peninsula.h - 0.09;
  m.homeDesign.r7Tiles = {
    parentId: peninsula.id,
    w: 2.61,
    h: tileH,
    t: 0.008,
    x: 0,
    y: 0.09 + tileH / 2,
    z: peninsula.d / 2 + 0.004,
  };

  m.homeDesign.r7Revision = {
    sources: ["A12 Bauhaus × Japanese modern, applied on the unchanged R6 plan"],
    structureChanged: false,
    keepsR6: { switchPoints: m.homeDesign.r6Revision?.switchPoints, lightingCriteria: m.homeDesign.r6Revision?.lightingCriteria },
    pass: pass.sweep,
    passId: "kitchen-pass-window",
    sign: { id: "r2-bar-sign", x: sign.x, z: sign.z, y: sign.y, w: sign.w, h: sign.h, d: sign.d },
    beerBay: { y0: 0, y1: 0.915, equipmentY0: 0, equipmentH: 0.85, counterSupportKept: true, coolingClaim: false },
    materials: ["r7Pale", "r7NicheWood", "r7BlackGlass", "r7Tile", "r7Brushed", "r7Mustard", "r7LipWood"],
    scope: "finish, fold pass and sign mount; not a site survey, hardware acceptance or gas seal",
  };
  return m;
}
