/** V9 room planning overlay. All measurements are concept-model values. */
type Point = [number, number];

type ObjectLike = {
  id: string;
  x?: number;
  z?: number;
  rotation?: number;
  collisionParts?: Record<string, any>[];
  [key: string]: any;
};

function angleDelta(from: number, to: number) {
  let delta = ((to - from + 540) % 360) - 180;
  if (delta === -180 && to - from > 0) delta = 180;
  return delta;
}

/** Apply an object pose change and transform its absolute collision parts too. */
function patchPose(object: ObjectLike, patch: Record<string, any>) {
  const oldX = Number(object.x ?? 0),
    oldZ = Number(object.z ?? 0),
    oldRotation = Number(object.rotation ?? 0),
    nextX = Number(patch.x ?? oldX),
    nextZ = Number(patch.z ?? oldZ),
    nextRotation = Number(patch.rotation ?? oldRotation),
    delta = angleDelta(oldRotation, nextRotation),
    radians = (delta * Math.PI) / 180,
    cos = Math.cos(radians),
    sin = Math.sin(radians);

  if (object.collisionParts?.length) {
    object.collisionParts = object.collisionParts.map((part) => {
      const relativeX = Number(part.x ?? oldX) - oldX,
        relativeZ = Number(part.z ?? oldZ) - oldZ;
      return {
        ...part,
        x: nextX + cos * relativeX + sin * relativeZ,
        z: nextZ - sin * relativeX + cos * relativeZ,
        ...(part.rotation === undefined
          ? {}
          : { rotation: Number(part.rotation) + delta }),
      };
    });
  }
  Object.assign(object, patch);
}

function objectById(objects: ObjectLike[], id: string) {
  const object = objects.find((candidate) => candidate.id === id);
  if (!object) throw new Error(`V9 expected V8 object ${id}`);
  return object;
}

function moveFixture(
  model: any,
  id: string,
  position: number[],
  target?: number[],
) {
  const fixture = model.lighting.fixtures.find(
    (candidate: any) => candidate.id === id,
  );
  if (!fixture) return;
  fixture.position = position;
  if (target) fixture.target = target;
}

export function createHomeDesign<T extends Record<string, any>>(base: T): T {
  const model: any = structuredClone(base),
    objects = model.objects as ObjectLike[];
  model.version = "9.0.0";

  const column = objectById(objects, "column-handdrawn"),
    entryReturn = objectById(objects, "s02-entry-return"),
    sharedColumnFinishedWidthM = Number(column.w),
    oldIslandCenterX = Number(entryReturn.x),
    entryIslandXMin = Number(column.x) - sharedColumnFinishedWidthM / 2,
    entryIslandXMax = Number(column.x) + sharedColumnFinishedWidthM / 2;
  // The V8 return is 650 mm wide. Match its finished cross-section to the
  // unchanged 500 mm square structural column; length and z placement remain.
  patchPose(entryReturn, { x: column.x, w: sharedColumnFinishedWidthM });
  // Long open face looks into the entrance corridor (+x); hinge end is closed.
  const innerW = sharedColumnFinishedWidthM - 0.036,
    panel = 0.018;
  entryReturn.accessFace = "+x";
  entryReturn.accessFrom = "entry_left_corridor";
  entryReturn.collisionParts = [
    {
      x: entryIslandXMin + panel / 2,
      z: entryReturn.z,
      w: panel,
      d: entryReturn.d,
      y: 0.08,
      h: 0.835,
      material: "oak",
    },
    ...[-1, 1].map((sign) => ({
      x: column.x,
      z: Number(entryReturn.z) + sign * (entryReturn.d / 2 - panel / 2),
      w: innerW,
      d: panel,
      y: 0.08,
      h: 0.835,
      material: "oak",
    })),
    ...[0.08, 0.34, 0.62].map((y, index) => ({
      x: column.x,
      z: entryReturn.z,
      w: innerW,
      d: entryReturn.d - 0.036,
      y,
      h: index === 0 ? 0.025 : 0.018,
      material: "oak",
    })),
    {
      x: column.x,
      z: entryReturn.z,
      w: sharedColumnFinishedWidthM,
      d: entryReturn.d,
      y: 0.915,
      h: 0.035,
      material: "barStone",
    },
    ...[-1, 1].map((sign) => ({
      x: entryIslandXMax - panel / 2,
      z: Number(entryReturn.z) + sign * (entryReturn.d / 2 - 0.025),
      w: panel,
      d: 0.032,
      y: 0.08,
      h: 0.835,
      material: "oak",
    })),
  ];
  entryReturn.useEnvelope = {
    x: entryIslandXMax + 0.3,
    z: entryReturn.z,
    w: 0.6,
    d: 0.9,
    y: 0,
    h: 1.88,
    source: "concept_entry_reach_position",
  };
  const staleGatePanelIndex = objects.findIndex(
    (object) => object.id === "s02-gate-end-panel",
  );
  if (staleGatePanelIndex >= 0) objects.splice(staleGatePanelIndex, 1);
  // Remove the floor plant that was relocated into the only modeled north
  // route around the column; it leaves a 430 mm gap at the dining approach.
  const entryRoutePlantIndex = objects.findIndex(
    (object) => object.id === "plant-bar",
  );
  if (entryRoutePlantIndex >= 0) objects.splice(entryRoutePlantIndex, 1);

  // Daily-use dining remains separate from the working bar counter. The IDs
  // stay stable so model controls and saved references can identify the set.
  const table = objectById(objects, "dining-table"),
    leftChair = objectById(objects, "dining-chair-left"),
    rightChair = objectById(objects, "dining-chair-right");
  patchPose(table, {
    type: "folding_table",
    room: "bar",
    // Motion/scene integration reads x/z as the physical parked pose.
    // The folded table parks beside the short kitchen wall, outside the bar
    // cabinet footprint and clear of the sliding-door opening.
    x: 0.95,
    z: 5.58,
    w: 0.96,
    d: 0.96,
    h: 0.74,
    y: 0,
    rotation: 0,
    state: "stowed",
    defaultState: "stowed",
    material: "oak",
  });
  patchPose(leftChair, {
    type: "folding_chair",
    room: "bar",
    x: 1.25,
    z: 6.55,
    w: 0.43,
    d: 0.43,
    h: 0.87,
    y: 0,
    rotation: 90,
    state: "stowed",
    defaultState: "stowed",
    retreat: { x: 1.7, z: 6.45, distanceM: 0.35 },
    material: "sage",
  });
  patchPose(rightChair, {
    type: "folding_chair",
    room: "bar",
    x: 1.25,
    z: 6.0,
    w: 0.43,
    d: 0.43,
    h: 0.87,
    y: 0,
    rotation: -90,
    state: "stowed",
    defaultState: "stowed",
    retreat: { x: 3.0, z: 6.45, distanceM: 0.35 },
    material: "sage",
  });

  // Add an 850 mm high, 400 mm deep low preparation strip below the high sill
  // and a short connector to the existing L counter.
  if (!objects.some((object) => object.id === "bar-window-worktop"))
    objects.push({
      id: "bar-window-worktop",
      type: "cabinet_frame",
      room: "bar",
      x: 0.29,
      z: 6.55,
      w: 0.4,
      d: 1.5,
      h: 0.85,
      y: 0,
      rotation: 0,
      material: "oak",
      collisionParts: [
        {
          x: 0.29,
          z: 6.55,
          w: 0.4,
          d: 1.5,
          y: 0.8,
          h: 0.05,
          material: "barStone",
        },
        {
          x: 0.125,
          z: 6.55,
          w: 0.035,
          d: 1.38,
          y: 0,
          h: 0.8,
          material: "oak",
        },
        {
          x: 0.455,
          z: 6.55,
          w: 0.035,
          d: 1.38,
          y: 0,
          h: 0.8,
          material: "oak",
        },
      ],
    });
  if (!objects.some((object) => object.id === "bar-window-worktop-connector"))
    objects.push({
      id: "bar-window-worktop-connector",
      type: "cabinet_frame",
      room: "bar",
      x: 0.29,
      z: 7.4875,
      w: 0.4,
      d: 0.375,
      h: 0.85,
      y: 0,
      rotation: 0,
      material: "oak",
      collisionParts: [
        {
          x: 0.29,
          z: 7.4875,
          w: 0.4,
          d: 0.375,
          y: 0.8,
          h: 0.05,
          material: "barStone",
        },
        {
          x: 0.125,
          z: 7.4875,
          w: 0.035,
          d: 0.33,
          y: 0,
          h: 0.8,
          material: "oak",
        },
        {
          x: 0.455,
          z: 7.4875,
          w: 0.035,
          d: 0.33,
          y: 0,
          h: 0.8,
          material: "oak",
        },
      ],
    });

  // Reface the media wall onto the solid z=9.35 wall. The TV console's
  // absolute component coordinates follow its translated and rotated parent.
  patchPose(objectById(objects, "living-tv"), {
    x: 9.4,
    z: 9.2,
    rotation: 180,
  });
  patchPose(objectById(objects, "living-tv-console"), {
    x: 9.4,
    z: 9.02,
    rotation: 0,
  });
  patchPose(objectById(objects, "ps5"), {
    x: 10.2,
    z: 9.02,
    rotation: 180,
  });
  patchPose(objectById(objects, "living-sofa"), {
    x: 9.3,
    z: 6.6,
    w: 2.55,
    d: 1.05,
    rotation: 180,
  });
  patchPose(objectById(objects, "living-rug"), {
    x: 9.3,
    z: 6.6,
    w: 2.65,
    d: 2.35,
  });
  patchPose(objectById(objects, "side-table"), { x: 7.55, z: 6.6 });
  patchPose(objectById(objects, "living-lamp"), { x: 7.4, z: 8.05 });
  patchPose(objectById(objects, "plant-living"), { x: 10.95, z: 8.45 });
  objects.splice(
    0,
    objects.length,
    ...objects.filter(
      (object) =>
        !(object.type === "coffee_table" && object.room === "living") &&
        object.id !== "salon-coffee-table",
    ),
  );

  moveFixture(
    model,
    "living-screen-bias",
    [9.4, 1.265, 9.285],
    [9.4, 1.1, 9.34],
  );
  moveFixture(
    model,
    "living-reading-lamp",
    [7.4, 1.265, 8.05],
    [6.88, 0.6, 7.1],
  );
  moveFixture(model, "living-wall-cove", [9.4, 2.47, 9.16], [9.4, 2.61, 9.2]);
  const livingTask = model.lighting.fixtures.find(
    (candidate: any) => candidate.id === "storage-living-task",
  );
  if (livingTask) {
    livingTask.position = [9.6, 1.535, 4.8];
    livingTask.target = [9.6, 0.82, 4.6];
    livingTask.anchor = "upper-living-media";
  }

  // Keep the complete 1800 x 2000 mm bed, rotate it 90 degrees, and split the
  // workstations on the wall opposite the bed. This is a static candidate: it opens more
  // north-south clearance at the bed foot without changing either desk size.
  const oldBedCenter = { x: 9.5, z: 1.145 },
    newBedCenter = { x: 9.4, z: 1.15 };
  patchPose(objectById(objects, "master-bed"), {
    x: newBedCenter.x,
    z: newBedCenter.z,
    rotation: 90,
  });
  patchPose(objectById(objects, "master-mattress"), {
    x: newBedCenter.x,
    z: newBedCenter.z,
    rotation: 90,
  });
  for (const fixture of model.lighting.fixtures.filter(
    (candidate: any) => candidate.anchor === "master-bed",
  )) {
    for (const key of ["position", "target"] as const) {
      const point = fixture[key];
      if (!point) continue;
      const dx = point[0] - oldBedCenter.x,
        dz = point[2] - oldBedCenter.z;
      fixture[key] = [newBedCenter.x + dz, point[1], newBedCenter.z - dx];
    }
  }
  const pcDesk = objectById(objects, "pc-desk"),
    pcChair = objectById(objects, "pc-chair"),
    pcMonitor = objectById(objects, "pc-monitor"),
    pcTower = objectById(objects, "pc-tower"),
    macDesk = objectById(objects, "mac-desk"),
    macChair = objectById(objects, "mac-chair"),
    macbook = objectById(objects, "macbook");
  // Two full-depth desk zones align along one wall, as requested; no corner return.
  patchPose(pcDesk, { x: 8.6, z: 3.98 });
  patchPose(pcChair, { x: 8.6, z: 3.34 });
  pcChair.retreat = { x: 8.6, z: 2.99, distanceM: 0.35 };
  patchPose(pcMonitor, { z: 4.1 });
  patchPose(pcTower, { z: Number(pcTower.z) + 0.045 });
  patchPose(macDesk, { x: 9.9, z: 3.98, rotation: 0 });
  patchPose(macChair, { x: 9.9, z: 3.34, rotation: 180 });
  macChair.retreat = { x: 9.9, z: 2.99, distanceM: 0.35 };
  patchPose(macbook, { x: 9.9, z: 4.1, rotation: 0 });
  for (const [id, position, target] of [
    ["pc-desk-task", [8.45, 1.635, 4.065], [8.45, 0.78, 3.985]],
    ["mac-desk-task", [9.9, 1.635, 4.065], [9.9, 0.78, 3.985]],
  ] as [string, number[], number[]][]) {
    const fixture = model.lighting.fixtures.find(
      (candidate: any) => candidate.id === id,
    );
    if (fixture) {
      fixture.position = position;
      fixture.target = target;
    }
  }

  // Replace high bedside/laundry compartments with reachable, physical
  // storage locations. Keep seasonal wardrobe storage; lower bar shelves so
  // daily coffee items remain within a testable reach band for the 188 cm user.
  const removedStorage = new Set([
    "upper-master-bed-left",
    "upper-master-bed-right",
    "upper-laundry",
  ]);
  model.objects = (model.objects as ObjectLike[]).filter(
    (object) =>
      !(object.type === "wall_storage" && removedStorage.has(object.id)),
  );
  for (const id of [
    "upper-bar-coffee",
    "upper-bar-display",
    "upper-bar-service",
  ]) {
    const storage = objectById(model.objects as ObjectLike[], id);
    storage.y = Math.min(Number(storage.y), 1.52);
  }
  for (const id of ["display-level-1", "display-level-2", "display-level-3"]) {
    const fixture = model.lighting.fixtures.find(
      (candidate: any) => candidate.id === id,
    );
    if (fixture) {
      const level = id.endsWith("1") ? 1.84 : id.endsWith("2") ? 2.12 : 2.32;
      fixture.position = [fixture.position[0], level, fixture.position[2]];
    }
  }
  // The rotated bed moves its bedside surface to the window-side edge. This
  // remains below the sill and is not counted as a circulation surface.
  if (
    !model.objects.some((object: ObjectLike) => object.id === "nightstand-left")
  )
    model.objects.push({
      id: "nightstand-left",
      type: "cabinet_frame",
      room: "master",
      x: 10.7,
      z: 1.15,
      w: 0.42,
      d: 0.42,
      h: 0.5,
      y: 0,
      rotation: 0,
      material: "oak",
      collisionParts: [
        { x: 10.7, z: 0.949, w: 0.42, d: 0.018, y: 0.08, h: 0.42 },
        { x: 10.7, z: 1.351, w: 0.42, d: 0.018, y: 0.08, h: 0.42 },
        { x: 10.7, z: 1.15, w: 0.399, d: 0.384, y: 0.465, h: 0.035 },
      ],
    });

  // One low sorting/folding surface replaces the high laundry cabinet use;
  // the basket ID is removed because its position becomes a fixed worktop.
  model.objects = (model.objects as ObjectLike[]).filter(
    (object) => object.id !== "laundry-basket",
  );
  if (
    !model.objects.some(
      (object: ObjectLike) => object.id === "laundry-sort-fold",
    )
  )
    model.objects.push({
      id: "laundry-sort-fold",
      type: "cabinet_frame",
      room: "balcony",
      x: 12.25,
      z: 8.25,
      w: 0.58,
      d: 0.5,
      h: 0.9,
      y: 0,
      rotation: 0,
      material: "oak",
      collisionParts: [
        { x: 11.971, z: 8.25, w: 0.018, d: 0.5, y: 0.08, h: 0.82 },
        { x: 12.529, z: 8.25, w: 0.018, d: 0.5, y: 0.08, h: 0.82 },
        {
          x: 12.25,
          z: 8.25,
          w: 0.544,
          d: 0.464,
          y: 0.875,
          h: 0.05,
          material: "barStone",
        },
        { x: 12.25, z: 8.25, w: 0.544, d: 0.018, y: 0.08, h: 0.82 },
      ],
    });

  const routeA: Point[] = [
      [7.5, 5.4],
      [7.5, 8.05],
      [11.15, 8.05],
      [11.15, 7.45],
      [12.1, 7.45],
    ],
    routeB: Point[] = [
      [7.5, 5.4],
      [11.15, 5.4],
      [11.15, 7.45],
      [12.1, 7.45],
    ],
    scenarios = model.presentationScenarios as any[],
    ps5Route = scenarios.find((scenario) => scenario.id === "ps5-balcony");
  if (ps5Route) {
    ps5Route.people[0].points = routeB;
    ps5Route.geometryCheck =
      "V9 static layout candidate; avatar radius preserved at 0.45m; occupied-sofa and physical acceptance not verified";
  }

  model.homeDesign = {
    version: 1,
    defaultState: "stowed",
    sharedColumnFinishedWidthM,
    entryIsland: {
      id: "s02-entry-return",
      center: [Number(entryReturn.x), Number(entryReturn.z)],
      crossSectionWidthM: Number(entryReturn.w),
      lengthM: Number(entryReturn.d),
      xBounds: [entryIslandXMin, entryIslandXMax],
      alignedWithColumnId: "column-handdrawn",
      status: "concept_geometry_matches_modelled_column_width",
    },
    selectedLivingLayout: "tv-east-wall",
    layoutComparison: {
      preferred: "tv-east-wall",
      alternatives: [
        {
          id: "tv-east-wall",
          label: "电视移至 z=9.35 实墙，沙发翻面，阳台路由置于沙发后方",
          tv: {
            id: "living-tv",
            x: 9.4,
            y: 0.8,
            z: 9.2,
            w: 1.65,
            h: 0.93,
            d: 0.09,
            rotation: 180,
          },
          console: {
            id: "living-tv-console",
            x: 9.4,
            y: 0,
            z: 9.02,
            w: 2.6,
            h: 0.4,
            d: 0.4,
            rotation: 0,
            minX: 8.1,
          },
          sofa: {
            id: "living-sofa",
            x: 9.3,
            y: 0,
            z: 6.6,
            w: 2.55,
            h: 0.76,
            d: 1.05,
            rotation: 180,
          },
          coffeeTablesRemoved: true,
          balconyRoute: {
            points: routeB,
            radiusM: 0.45,
            measuredClearances: [
              {
                segment: "behind-sofa",
                clearanceM: 0.675,
                obstacle: "sofa rear envelope",
              },
              {
                segment: "sofa-east-side",
                clearanceM: 0.575,
                obstacle: "sofa east envelope",
              },
              {
                segment: "balcony-opening-approach",
                clearanceM: 0.5,
                obstacle: "opening west edge",
              },
            ],
            evidenceLevel: "static_candidate",
          },
          pros: ["阳台路由在沙发后方并从东侧入阳台", "屏幕与观看路径分离"],
          conflicts: [
            "z=9.35 外墙可否安装/供电尚未现场确认",
            "通道仅按静态家具包络核算",
          ],
        },
        {
          id: "tv-bearing-wall",
          label: "保留电视在 z=4.55 主卧承重墙侧，沙发朝向不变",
          tv: {
            id: "living-tv",
            x: 9.35,
            y: 0.8,
            z: 4.55,
            w: 1.65,
            h: 0.93,
            d: 0.09,
            rotation: 0,
          },
          console: {
            id: "living-tv-console",
            x: 9.35,
            y: 0,
            z: 4.7,
            w: 2.6,
            h: 0.4,
            d: 0.4,
            rotation: 180,
          },
          sofa: {
            id: "living-sofa",
            x: 9.25,
            y: 0,
            z: 7,
            w: 2.55,
            h: 0.76,
            d: 1.05,
            rotation: 0,
          },
          coffeeTablesRemoved: true,
          balconyRoute: {
            points: routeA,
            radiusM: 0.45,
            measuredClearances: [
              {
                segment: "west-end-turn",
                clearanceM: 0.475,
                obstacle: "sofa west envelope",
              },
              {
                segment: "behind-sofa",
                clearanceM: 0.525,
                obstacle: "sofa rear envelope",
              },
              {
                segment: "sofa-east-side",
                clearanceM: 0.625,
                obstacle: "sofa east envelope",
              },
              {
                segment: "balcony-opening-approach",
                clearanceM: 0.5,
                obstacle: "opening west edge",
              },
            ],
            evidenceLevel: "static_candidate",
          },
          pros: ["保留现有内墙电视位置", "观看距离与旧布局接近"],
          conflicts: [
            "需要绕沙发西端再走到沙发后方",
            "承重墙开孔/固定仍需结构确认",
          ],
        },
      ],
    },
    bayWindows: [
      {
        roomId: "guest",
        wallId: "north",
        windowId: "guest-window",
        center: [0, 1.5],
        outward: [-1, 0],
        widthM: 1.25,
        projectionM: 0.6,
        sillHeightM: 0.9,
        headHeightM: 2.35,
        ledgeUse: "ledge_only",
        retainedWalkingPolygon: true,
        status: "concept_adjustable",
      },
      {
        roomId: "master",
        wallId: "south-master",
        windowId: "master-window",
        center: [11.65, 2],
        outward: [1, 0],
        widthM: 1.55,
        projectionM: 0.6,
        sillHeightM: 0.9,
        headHeightM: 2.35,
        ledgeUse: "ledge_only",
        retainedWalkingPolygon: true,
        status: "concept_adjustable",
      },
    ],
    hatch: {
      id: "hall-gate",
      spanM: 0.9,
      depthM: sharedColumnFinishedWidthM,
      thicknessM: 0.03,
      heightM: 0.95,
      hinge: {
        x: Number(column.x),
        y: 0.95,
        z: Number(entryReturn.z) - Number(entryReturn.d) / 2 - 0.035,
      },
      hingeRevealM: 0.035,
      hardware: "concept_recessed_bronze_hinge",
      xBounds: [entryIslandXMin, entryIslandXMax],
      openAngleDeg: 95,
      operation: "flip_up",
      status: "concept",
      rendererOwner: "main-agent",
    },
    dining: {
      role: "daily_main_table",
      defaultState: "stowed",
      temporarySeatAvailable: false,
      barRole: "preparation_and_storage; not a two-person knee-seating counter",
      table: {
        id: "dining-table",
        type: "folding_table",
        use: { x: 2.35, z: 6.45, diameterM: 0.96, heightM: 0.74 },
        parkedEnvelope: {
          x: 0.95,
          z: 5.58,
          w: 1.05,
          d: 0.3,
          h: 1.35,
          rotation: 0,
          coordinateFrame: "world_aabb",
          localFoldedFootprint: { w: 1.05, d: 0.3 },
        },
        provenance:
          "Generic 960 mm folding-table concept; geometry, folded budget and support mechanism are not manufacturer CAD",
        foldedPositionStatus:
          "candidate; preserve kitchen-slider clear opening",
      },
      chairs: [
        {
          id: "dining-chair-left",
          type: "folding_chair",
          use: {
            x: 1.61,
            z: 6.45,
            w: 0.48,
            d: 0.52,
            pullbackM: 0.35,
            rotation: 90,
          },
          park: { x: 1.25, z: 6.55, rotation: 90, foldedDepthM: 0.43 },
        },
        {
          id: "dining-chair-right",
          type: "folding_chair",
          use: {
            x: 3.09,
            z: 6.45,
            w: 0.48,
            d: 0.52,
            pullbackM: 0.35,
            rotation: -90,
          },
          park: { x: 1.25, z: 6.0, rotation: -90, foldedDepthM: 0.43 },
        },
      ],
      usePositions: {
        table: { x: 2.35, z: 6.45, rotation: 0 },
        chairs: [
          { id: "dining-chair-left", x: 1.61, z: 6.45, rotation: 90 },
          { id: "dining-chair-right", x: 3.09, z: 6.45, rotation: -90 },
        ],
      },
      sequence: {
        tablePath: [
          [0.95, 5.58],
          [2.35, 5.58],
          [2.35, 6.45],
        ],
      },
      stateEnvelopes: {
        deployed: {
          shape: "round",
          diameterM: 0.96,
          heightM: 0.74,
          evidenceLevel: "static_candidate",
        },
        folded: {
          shape: "physical_budget_rectangular_table",
          w: 1.05,
          d: 0.3,
          h: 1.35,
          evidenceLevel: "concept_mechanism_not_cad",
        },
      },
      operationClearanceM: 0.35,
    },
    barOperationCounter: {
      id: "bar-window-worktop",
      position: { x: 0.29, z: 6.55 },
      dimensions: { lengthAlongWindowM: 1.5, depthM: 0.4, topHeightM: 0.85 },
      connectorId: "bar-window-worktop-connector",
      joinsExistingServiceLeg: true,
      basin: false,
      role: "preparation_surface",
      evidenceLevel: "static_candidate",
      noHighEquipmentAtWindow: true,
    },
    masterBedroom: {
      mattress: {
        id: "master-mattress",
        w: 1.8,
        d: 2.0,
        retained: true,
        rotationDeg: 90,
        center: [9.4, 1.15],
      },
      selectedLayout: "inline-opposite-bed",
      retainedDeskSizes: { pc: [1.4, 0.75], mac: [1.2, 0.75] },
      alternatives: [
        {
          id: "inline-side-by-side",
          status: "not_selected",
          geometry: {
            deskEdgeGapM: 0,
            pulledChairToBedFrameGapM: 0.435,
            chairCenterSpacingM: 1.3,
            chairPairClearWidthM: 0.63,
          },
          reason: "两桌边缘相接；椅后仅435mm，不能作为双人离席通道",
          evidenceLevel: "static_candidate",
        },
        {
          id: "L-workstations-fixed-bed",
          status: "not_selected",
          geometry: {
            pcChairToBedFrameGapM: 0.435,
            pcChairMacChairXGapM: 0.51,
          },
          reason: "桌椅相互错开但床脚前仍只有435mm",
          evidenceLevel: "static_candidate",
        },
        {
          id: "rotated-bed-plus-east-side-mac-desk",
          status: "selected_static_candidate",
          geometry: {
            bedBounds: { minX: 8.36, maxX: 10.44, minZ: 0.2, maxZ: 2.1 },
            wardrobeToBedGapM: 0.76,
            eastWallToBedGapM: 1.21,
            pcPulledChairToBedGapM: 0.565,
            macPulledChairToPcPulledChairXGapM: 0.51,
            deskFootprintsSeparated: true,
          },
          reason:
            "床转90度，PC保留北墙，Mac桌转至东侧；减少椅子与桌面包络冲突，但无人体/门扇/床品同步验收",
          evidenceLevel: "static_candidate",
        },
      ],
      geometry: {
        bedNorthEdgeZ: 2.1,
        pcChairSouthEdgeZAtPullback: 2.665,
        pcChairToBedFrameGapM: 0.565,
        macChairToPCChairGapM: 0.63,
        wardrobeToBedGapM: 0.76,
        eastWallToBedGapM: 1.21,
        evidenceLevel: "static_candidate",
      },
      qualification:
        "静态候选，非PASS；需同尺度人体、床品展开、衣柜开门、卧室门扇及两人同时离席/通行联合验证",
    },
    storage: {
      removedWallStorageIds: [...removedStorage],
      removedTvWallStorageIds: ["upper-living-rear"],
      addedObjects: ["nightstand-left", "laundry-sort-fold"],
      loweredBarStorageIds: [
        "upper-bar-coffee",
        "upper-bar-display",
        "upper-bar-service",
      ],
      userHeightCm: 188,
      accessStatus: "reach_envelope_requires_user_validation",
    },
    guestBed: {
      id: "guest-sofa-bed",
      foldedEnvelope: { x: 2.05, z: 0.67, w: 1.54, d: 1.03 },
      openEnvelope: { x: 2.05, z: 1.21, w: 1.54, d: 2.1 },
      mechanismNominalMattress: { w: 1.4, d: 2.0 },
      excludedBenchId: "guest-window-bench",
      simultaneousDoorStorageState: "not_verified",
    },
    assumptions: [
      {
        id: "concept-not-surveyed",
        statement: "模型坐标和开口均为概念值，未用作施工尺寸",
        status: "unverified",
      },
      {
        id: "living-east-wall",
        statement: "z=9.35墙体可否安装电视、走线和散热需现场确认",
        status: "unverified",
      },
      {
        id: "bay-window-envelope",
        statement: "飘窗外凸600mm为可调概念，未计入可走地面",
        status: "concept",
      },
      {
        id: "water-and-drain",
        statement: "水吧给排水仍待现场勘察和选择，保留干水吧条件",
        status: "unverified",
      },
      {
        id: "hatch-clearance",
        statement: "翻板打开/关闭及临时单席活动包络尚未做渲染和人体验证",
        status: "unverified",
      },
      {
        id: "daily-dining",
        statement:
          "餐桌椅默认收纳，双人用餐时展开；停车位、折叠机构及厨房门边操作需模型检查和现场确认",
        status: "concept",
      },
      {
        id: "human-use",
        statement: "多人同时做饭、工作、观影和通行未验收",
        status: "unverified",
      },
    ],
  };

  // The bench has been superseded by the adjustable bay-window ledge concept.
  model.objects = (model.objects as ObjectLike[]).filter(
    (object) =>
      object.id !== "guest-window-bench" && object.id !== "upper-living-rear",
  );

  // Keep the bar-seat camera aimed at daily dining and the preparation leg;
  // the living camera now shows the flipped sofa/media axis.
  model.presentation.defaultView = "entry-view";
  const views = model.presentation.interiorViews as any[];
  for (const view of views) {
    if (view.id === "entry-view") {
      view.position = [5.775, 1.74, 8.17];
      view.target = [4.1, 1.35, 6.55];
      view.horizontalFov = 92;
    }
    if (["living-main", "living-lounge"].includes(view.id)) {
      view.position = [10.95, 1.4, 6.05];
      view.target = [9.3, 1.15, 8.9];
      view.horizontalFov = 100;
    }
    if (["living-seated", "salon-living-seat"].includes(view.id)) {
      view.position = [9.3, 1.18, 6.75];
      view.target = [9.4, 1.25, 8.9];
      view.horizontalFov = 82;
    }
    if (view.id === "living-media") {
      view.position = [7.6, 1.45, 7.4];
      view.target = [9.4, 0.95, 8.9];
      view.horizontalFov = 85;
    }
    if (view.id === "living-storage") {
      view.label = "外围生活收纳";
      view.position = [8.0, 1.5, 6.0];
      view.target = [9.4, 0.8, 4.7];
      view.horizontalFov = 85;
    }
    if (view.id === "salon-bar-seat") {
      view.position = [3.75, 1.4, 7.2];
      view.target = [2.35, 1.0, 6.45];
    }
  }

  // Replace the V8 lighting presets that were tuned against the old view and
  // portal fixture. Keep the atmosphere package's current authored levels.
  model.lighting.fixtures = model.lighting.fixtures.filter(
    (fixture: any) =>
      fixture.id !== "salon-portal-glow" &&
      fixture.id !== "salon-bar-wash" &&
      fixture.anchor !== "salon:bar-portal",
  );
  const currentViews = new Set(views.map((view) => view.id)),
    momentViews: Record<string, string> = {
      "day-public": "salon-living-seat",
      "two-person-dining": "salon-bar-seat",
      "dual-workstations": "master-work",
      "work-focus": "master-work",
      "night-navigation": "hall-view",
      "night-walk": "hall-view",
      coffee: "salon-bar-seat",
      aperitif: "salon-bar-seat",
      game: "salon-living-seat",
      cinema: "salon-cinema-vault",
      "guest-stay": "salon-cinema-vault",
    };
  for (const moment of model.lighting.scenes as any[]) {
    const viewId = momentViews[moment.id];
    if (viewId && currentViews.has(viewId)) moment.viewId = viewId;
    if (moment.id === "aperitif") {
      moment.ambientIntensity = 0.48;
      moment.environmentIntensity = 0.2;
    }
    if (moment.id === "game") {
      moment.ambientIntensity = 0.48;
      moment.environmentIntensity = 0.2;
    }
    if (moment.id === "cinema") {
      moment.ambientIntensity = 0.52;
      moment.environmentIntensity = 0.18;
    }
  }
  // Latest brief: the screen belongs to a lockable wheeled stand, not a wall.
  const mobileScreen = objectById(model.objects, "living-tv");
  patchPose(mobileScreen, {
    type: "mobile_tv",
    x: 9.4,
    z: 8.9,
    y: 0,
    w: 1.65,
    d: 0.66,
    h: 1.73,
    rotation: 180,
  });
  patchPose(objectById(model.objects, "living-tv-console"), {
    x: 9.4,
    z: 4.7,
    rotation: 180,
  });
  patchPose(objectById(model.objects, "ps5"), {
    x: 9.4,
    z: 8.99,
    y: 0.53,
    rotation: 180,
  });
  patchPose(objectById(model.objects, "living-lamp"), { x: 7.4, z: 6.9 });
  patchPose(objectById(model.objects, "side-table"), { x: 7.55, z: 7.6 });
  patchPose(objectById(model.objects, "plant-living"), {
    x: 8.35,
    z: 4.7,
    y: 0.42,
    w: 0.2,
    d: 0.2,
    h: 0.32,
  });
  patchPose(objectById(model.objects, "plant-master"), { x: 11.15, z: 2.48 });
  model.homeDesign.selectedLivingLayout = "mobile-tv-flexible";
  model.homeDesign.mobileTV = {
    id: "living-tv",
    screen: { w: 1.65, h: 0.93, bottom: 0.8 },
    stand: { w: 0.88, d: 0.66, h: 1.48, casters: 4, locking: true },
    poses: [
      { x: 9.4, z: 8.9, rotation: 180, label: "日常停靠" },
      { x: 9.65, z: 8.65, rotation: 165, label: "斜向共享" },
    ],
    ps5TravelsOnShelf: true,
    cableManagement:
      "PS5与屏内短线随架；迁移前拔掉墙侧供电，停车后接电、锁轮；不画跨通道拖线",
    loading:
      "concept_trolley_not_selected_product; VESA/load/tip/plug compatibility pending",
  };
  model.homeDesign.layoutComparison.preferred = "mobile-tv-flexible";
  model.objects = model.objects.filter(
    (object: any) => object.id !== "living-rear-storage",
  );
  model.homeDesign.storage.removedForMobility = ["living-rear-storage"];
  model.homeDesign.dining.temporarySeatAvailable = false;
  model.objects = model.objects.filter(
    (object: any) =>
      !["laundry-sort-fold", "hall-gate-panel"].includes(object.id),
  );
  model.objects.push({
    id: "laundry-basket",
    type: "basket",
    room: "balcony",
    x: 12.12,
    z: 8.93,
    y: 0.12,
    w: 0.3,
    d: 0.5,
    h: 0.5,
    rotation: 0,
    material: "linen",
    accessFrom: "housekeeping_cabinet_left_bay",
  });
  model.homeDesign.storage.addedObjects = ["nightstand-left", "laundry-basket"];
  model.homeDesign.laundryWorkflow = {
    foldingSurface: "dining-table",
    fixedSortingTableRemoved: true,
    basketStoredIn: "housekeeping-cabinet",
    reason: "释放家政柜前取用站位，餐桌展开兼作干净叠衣面",
    cabinetDoorAndBasketRetrieval: "requires_joint_verification",
  };
  const modularSofa = objectById(model.objects, "living-sofa");
  modularSofa.type = "modular_sofa";
  model.objects = model.objects.filter(
    (o: any) => !["upper-entry-display", "bag-hooks"].includes(o.id),
  );
  model.objects.push(
    {
      id: "master-work-pegboard",
      type: "pegboard",
      room: "master",
      x: 9.2,
      z: 4.24,
      y: 0.97,
      w: 2.2,
      h: 0.56,
      d: 0.14,
      rotation: 0,
      material: "cream",
      purpose: "headphones_cables_stationery",
      accessFace: "-z",
    },
    {
      id: "entry-pegboard",
      type: "pegboard",
      room: "hall",
      x: 7.3,
      z: 8.29,
      y: 1.24,
      w: 0.82,
      h: 0.64,
      d: 0.14,
      rotation: 0,
      material: "sage",
      purpose: "keys_bag_daily_items",
      accessFace: "-z",
    },
  );
  model.homeDesign.masterBedroom.alternatives.forEach((candidate: any) => {
    candidate.status = "historical_comparison_not_selected";
  });
  model.homeDesign.masterBedroom.alternatives.push({
    id: "inline-opposite-bed",
    status: "selected_static_candidate",
    geometry: {
      deskRunWidthM: 2.6,
      deskDepthM: 0.75,
      chairCentersSpacingM: 1.3,
      chairPairClearWidthM: 0.63,
      pulledChairToBedFrameGapM: 0.565,
    },
    reason:
      "按最新偏好恢复床对面的一字工作台，保留完整床与两把正常电脑椅，不作转角延伸",
    evidenceLevel: "static_candidate",
  });
  model.homeDesign.masterBedroom.workbench = {
    xBounds: [7.9, 10.5],
    zBounds: [3.605, 4.355],
    heightM: 0.76,
    zones: [
      { id: "pc-desk", widthM: 1.4 },
      { id: "mac-desk", widthM: 1.2 },
    ],
    continuousInline: true,
    cornerReturn: false,
    windowExtension: false,
    reason: "窗侧保留飘窗与窗帘维护，不额外占用",
  };
  model.homeDesign.pegboards = {
    ids: ["master-work-pegboard", "entry-pegboard"],
    construction: "perforated_18mm_panel_25mm_standoff_removable_hooks",
    masterUse: "耳机、理线和文具，显示器后留空",
    entryUse: "钥匙、轻包及随身物件，替换原展示格和悬浮挂钩",
    notAdded: ["灶旁油污区", "水吧湿操作面", "阳台柜内设备检修区"],
    fixing:
      "wall substrate, fixing capacity and door/handle clearance pending survey",
  };
  model.lighting.fixtures.forEach((f: any) => {
    if (f.anchor === "upper-entry-display") f.anchor = "entry-pegboard";
  });
  const masterView = model.presentation.interiorViews.find(
    (v: any) => v.id === "master-work",
  );
  if (masterView)
    Object.assign(masterView, {
      position: [10.95, 1.58, 2.8],
      target: [9.2, 1.15, 4.05],
      horizontalFov: 94,
    });
  model.homeDesign.modularSofa = {
    id: "living-sofa",
    moduleDimensions: { w: 1.275, d: 1.05, h: 0.76 },
    combined: [
      { x: 8.6625, z: 6.6, rotation: 180 },
      { x: 9.9375, z: 6.6, rotation: 180 },
    ],
    separated: [
      { x: 7.85, z: 6.75, rotation: 170 },
      { x: 9.95, z: 6.75, rotation: 190 },
    ],
    connection:
      "releasable lower connectors; recessed feet with furniture glides; concept not selected product",
    middleArmrest: false,
  };
  model.homeDesign.layoutComparison.alternatives.unshift({
    ...structuredClone(model.homeDesign.layoutComparison.alternatives[0]),
    id: "mobile-tv-flexible",
    label: "可锁轮电视＋双模块可合并沙发；低柜回外围",
    tv: structuredClone(mobileScreen),
    console: structuredClone(objectById(model.objects, "living-tv-console")),
    noWallMountRequired: true,
    deviceSupport: "lockable mobile stand with PS5 shelf",
  });
  patchPose(objectById(model.objects, "living-lamp"), { x: 10.95, z: 8.85 });
  moveFixture(
    model,
    "living-reading-lamp",
    [10.95, 1.265, 8.85],
    [10.1, 0.7, 7.0],
  );
  moveFixture(model, "living-screen-bias", [9.4, 1.265, 8.99], [9.4, 1.1, 9.2]);
  for (const f of model.lighting.fixtures.filter(
    (f: any) => f.id === "living-screen-bias",
  ))
    f.intensity = 0;
  for (const scene of model.lighting.scenes)
    scene.fixtureLevels = { ...scene.fixtureLevels, "living-screen-bias": 0 };
  // Cinema lighting excludes task/cove sources rather than reusing the bright guest scene.
  const cinema = model.lighting.scenes.find(
    (scene: any) => scene.id === "cinema",
  );
  if (cinema)
    cinema.fixtureLevels = {
      ...cinema.fixtureLevels,
      "storage-guest-task": 0,
      "guest-wall-cove": 0,
    };
  model.homeDesign.dining.sequence = {
    description:
      "先移出并展开桌，再依次绕行搬出椅子；收起时逆序；非产品CAD机构",
    tablePath: [
      [0.95, 5.58],
      [2.35, 5.58],
      [2.35, 6.45],
    ],
    chairPaths: [
      [
        [leftChair.x, leftChair.z],
        [1.61, 6.45],
      ],
      [
        [rightChair.x, rightChair.z],
        [rightChair.x, 5.72],
        [3.06, 5.72],
        [3.06, 6.45],
        [3.09, 6.45],
      ],
    ],
    chairRetreatM: 0.35,
    temporarySeatAvailable: false,
  };
  for (const chair of model.homeDesign.dining.chairs) {
    const physical = model.objects.find((o: any) => o.id === chair.id);
    chair.park = {
      x: physical.x,
      z: physical.z,
      rotation: physical.rotation,
      foldedDepthM: 0.43,
    };
  }
  return model as T;
}
