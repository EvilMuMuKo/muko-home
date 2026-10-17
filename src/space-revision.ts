/** V11 spatial revision. Coordinates stay virtual concept values, not a survey. */
export function createSpaceRevision<T extends Record<string, any>>(base: T): T {
  const model: any = structuredClone(base);
  const get = (id: string) => model.objects.find((object: any) => object.id === id);
  const requireObject = (id: string) => {
    const object = get(id);
    if (!object) throw new Error(`Missing spatial object: ${id}`);
    return object;
  };
  const translateParts = (object: any, dx: number, dz: number) => {
    if (!object.collisionParts?.length || (dx === 0 && dz === 0)) return;
    object.collisionParts = object.collisionParts.map((part: any) => ({
      ...part,
      x: part.x + dx,
      z: part.z + dz,
    }));
  };
  const move = (id: string, patch: Record<string, any>) => {
    const object = requireObject(id);
    const dx = (patch.x ?? object.x) - object.x;
    const dz = (patch.z ?? object.z) - object.z;
    translateParts(object, dx, dz);
    if (object.useEnvelope && patch.useEnvelope === undefined && (dx !== 0 || dz !== 0)) {
      object.useEnvelope = {
        ...object.useEnvelope,
        x: object.useEnvelope.x + dx,
        z: object.useEnvelope.z + dz,
      };
    }
    Object.assign(object, patch);
    return object;
  };
  const panel = (
    x: number,
    z: number,
    w: number,
    d: number,
    y: number,
    h: number,
    material: string,
    rotation = 0,
  ) => ({
    x,
    z,
    w,
    d,
    y,
    h,
    material,
    ...(rotation ? { rotation } : {}),
  });
  const worldOf = (cx: number, cz: number, rotation: number, lx: number, lz: number) => {
    const radians = (rotation * Math.PI) / 180;
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    return { x: cx + c * lx - s * lz, z: cz + s * lx + c * lz };
  };

  model.version = "11.0.0";

  const bearing = model.walls.find((wall: any) => wall.id === "master-bearing");
  const bearingTopZ = bearing.a[1] - bearing.thickness / 2;
  const column = requireObject("column-handdrawn");
  const columnZ = bearingTopZ + column.d / 2;
  move("column-handdrawn", { z: columnZ });
  column.spatialRevision = {
    userConfirmedRelation: "column -z face meets master-bearing top face, wall.a[1] - thickness/2",
    bearingTopZ,
    virtualCenterZ: columnZ,
    coordinateStatus: "virtual_derived_not_surveyed",
  };

  // Compare end-wall positions against a full refrigerator operator envelope,
  // not only an empty corridor. Occupied side-pass is a concept budget.
  const hallInnerFaceX = 6.9 - 0.09;
  const kitchenCandidates = [4.2,4.5,4.8].map(x=>({x,
    closedFridgePassM:hallInnerFaceX-(x+0.5+0.375),
    occupiedFridgePassM:hallInnerFaceX-(x+0.5+0.905+0.45)}));
  const feasible = kitchenCandidates.filter(c=>c.closedFridgePassM>=0.9 && c.occupiedFridgePassM>=0.7);
  if (!feasible.length) throw new Error("No kitchen end-wall candidate meets the concept circulation budgets");
  const kitchenSideX = feasible[feasible.length-1].x;
  const kitchenSide = model.walls.find((wall: any) => wall.id === "kitchen-side");
  kitchenSide.a = [kitchenSideX, 3.4];
  kitchenSide.b = [kitchenSideX, 5.68];
  kitchenSide.candidate = {
    selectedX: kitchenSideX,
    jambReferenceX: 4.8,
    status: "concept_safe_candidate_pending_photo_survey",
  };
  const kitchenWest = model.walls.find((wall: any) => wall.id === "kitchen-west");
  kitchenWest.a = [kitchenSideX, 5.68];
  kitchenWest.b = [0, 5.68];
  model.rooms.find((room: any) => room.id === "kitchen").polygon = [
    [0, 3.4],
    [kitchenSideX, 3.4],
    [kitchenSideX, 5.68],
    [0, 5.68],
  ];
  model.rooms.find((room: any) => room.id === "hall").polygon = [
    [4.8, 2],
    [6.9, 2],
    [6.9, 4.4],
    [11.65, 4.4],
    [11.65, 9.35],
    [7.95, 9.35],
    [7.95, 8.45],
    [4.8, 8.45],
    [4.8, 5.68],
    [kitchenSideX, 5.68],
    [kitchenSideX, 3.4],
    [4.8, 3.4],
  ];
  for (const id of ["kitchen-prep-return", "kitchen-oven", "kitchen-airfryer", "kitchen-prep-board"]) {
    const object = requireObject(id);
    move(id, { x: object.x + kitchenSideX - 3.5 });
  }

  const fridgeDx = kitchenSideX + 0.5 - requireObject("kitchen-fridge").x;
  const fridgeDz = 3.7 - requireObject("kitchen-fridge").z;
  move("kitchen-fridge", { x: kitchenSideX + 0.5, z: 3.7, rotation: 90, accessFace: "+x" });
  move("fridge-surround", {
    x: requireObject("fridge-surround").x + fridgeDx,
    z: requireObject("fridge-surround").z + fridgeDz,
  });
  move("upper-fridge", {
    x: requireObject("upper-fridge").x + fridgeDx,
    z: requireObject("upper-fridge").z + fridgeDz,
  });

  const islandRearZ = 8.325;
  const islandLength = 1.6;
  const islandCenterZ = islandRearZ - islandLength / 2;
  const island = move("s02-entry-return", {
    x: 5.15,
    z: islandCenterZ,
    w: column.w,
    d: islandLength,
    h: 0.95,
    rotation: 0,
  });
  const counterT = 0.035;
  const supportT = 0.018;
  const kneeDepth = 0.32;
  const islandMinX = island.x - island.w / 2;
  const supportW = island.w - kneeDepth;
  const supportX = island.x + island.w / 2 - supportW / 2;
  island.collisionParts = [
    panel(island.x, islandCenterZ, island.w, islandLength, island.h - counterT, counterT, "barStone"),
    panel(supportX, islandRearZ - supportT / 2, supportW, supportT, 0, island.h - counterT, "oak"),
    panel(
      supportX,
      islandRearZ - islandLength + supportT / 2,
      supportW,
      supportT,
      0,
      island.h - counterT,
      "oak",
    ),
  ];
  island.diningFace = "-x";
  island.kneeVoid = {
    fromFace: "-x",
    faceX: islandMinX,
    depthM: kneeDepth,
    continuous: true,
    collision: false,
  };
  island.useEnvelope = {
    x: islandMinX - 0.3,
    z: islandCenterZ,
    w: 0.6,
    d: islandLength,
    y: 0,
    h: island.h,
    source: "concept_bar_side_dining_reach_not_entry_corridor",
  };
  delete island.accessFrom;
  island.accessFace = "-x";
  model.objects = model.objects.filter(
    (object: any) => !["s02-bar-service", "upper-bar-service", "hall-gate-panel", "s02-gate-end-panel", "plant-guest"].includes(object.id),
  );
  model.objects.push(
    {
      id: "entry-counter-stool-0",
      type: "counter_stool",
      room: "bar",
      x: 4.35,
      z: 7.075,
      y: 0,
      w: 0.46,
      d: 0.46,
      h: 0.91,
      seatHeight: 0.65,
      rotation: 0,
      material: "oak",
    },
    {
      id: "entry-counter-stool-1",
      type: "counter_stool",
      room: "bar",
      x: 4.35,
      z: 7.775,
      y: 0,
      w: 0.46,
      d: 0.46,
      h: 0.91,
      seatHeight: 0.65,
      rotation: 0,
      material: "oak",
    },
  );
  const storageW = 0.25;
  const storage = move("s02-bar-storage", { x: 3.45, w: storageW });
  const storageMaxX = storage.x + storageW / 2;
  storage.collisionParts = [
    panel(storage.x - storageW / 2 + supportT / 2, storage.z, supportT, storage.d, 0.08, 0.87, "oak"),
    panel(storage.x + storageW / 2 - supportT / 2, storage.z, supportT, storage.d, 0.08, 0.87, "oak"),
    panel(storage.x, storage.z + storage.d / 2 - supportT / 2, storageW - supportT * 2, supportT, 0.08, 0.87, "oak"),
    panel(storage.x, storage.z, storageW - supportT * 2, storage.d - supportT * 2, 0.08, supportT, "oak"),
    panel(storage.x, storage.z, storageW, storage.d, storage.h - counterT, counterT, "barStone"),
    panel(storage.x, storage.z - storage.d / 2 + supportT / 2, storageW - supportT * 2, supportT, 0.1, 0.78, "cabinetPaint"),
  ];
  move("upper-bar-display", { x: 3.65 });

  model.openings = model.openings.filter((opening: any) => opening.id !== "hall-gate");
  const hatch = model.homeDesign.hatch;
  hatch.enabled = false;
  hatch.kind = "none";
  hatch.status = "retired_open_passage";

  const corridorWallFaceZ = 5.68 + 0.09;
  const lengthCandidates = [1.6, 1.8, 2.0].map((length) => {
    const minZ = islandRearZ - length;
    const clearM = minZ - corridorWallFaceZ;
    return {
      lengthM: length,
      islandMinZ: minZ,
      corridorClearM: clearM,
      requiredClearM: 0.9,
      selected: length === 1.6,
      coordinateStatus: "virtual_only",
    };
  });
  model.homeDesign.entryIsland = {
    ...model.homeDesign.entryIsland,
    id: "s02-entry-return",
    center: [island.x, islandCenterZ],
    crossSectionWidthM: island.w,
    lengthM: islandLength,
    heightM: island.h,
    counterThicknessM: counterT,
    xBounds: [island.x - island.w / 2, island.x + island.w / 2],
    zBounds: [islandRearZ - islandLength, islandRearZ],
    rearEndZ: islandRearZ,
    alignedWithColumnId: "column-handdrawn",
    diningFace: "-x",
    entryCorridorConsumed: false,
    kneeVoidDepthM: kneeDepth,
    status: "virtual_final_candidate_not_surveyed",
  };
  model.homeDesign.entryIslandDining = {
    seatCount: 2,
    pullbackM: 0.4,
    pullbackDirection: "-x",
    seats: [
      { id: "entry-counter-stool-0", center: [4.35, 7.075], pulledCenter: [3.95, 7.075], pulledWestMinX: 3.72 },
      { id: "entry-counter-stool-1", center: [4.35, 7.775], pulledCenter: [3.95, 7.775], pulledWestMinX: 3.72 },
    ],
    rearBarMaxX: storageMaxX,
    stoolClearOfRearBar: storageMaxX < 3.72,
    routingCorridor: { minZ: corridorWallFaceZ, maxZ: islandRearZ - islandLength, clearM: 0.955, nominal: true },
    lengthCandidates,
    selectedLengthM: 1.6,
    coordinateStatus: "virtual_only",
    seatAndKneeValidation: "deferred_to_main",
  };

  const masterDoor = model.openings.find((opening: any) => opening.id === "master-door");
  masterDoor.center = [6.9, 3.65];
  masterDoor.hinge = [6.9, 4.09];
  masterDoor.rotation = -90;
  masterDoor.openAngle = 90;
  masterDoor.width = 0.88;
  masterDoor.spatialNote = "existing_master_door_restored_not_a_new_bearing_opening";
  move("master-door-leaf", { x: 6.9, z: 4.09 });

  const wardrobe = requireObject("master-wardrobe");
  wardrobe.d = 2.6;
  wardrobe.z = 1.46;
  const wt = 0.018;
  const halfW = wardrobe.w / 2;
  const halfD = wardrobe.d / 2;
  const frontX = wardrobe.x + halfW - wt / 2;
  const leafD = (wardrobe.d - wt * 2) / 2;
  wardrobe.collisionParts = [
    panel(wardrobe.x, wardrobe.z - halfD + wt / 2, wardrobe.w, wt, 0, wardrobe.h, "oak"),
    panel(wardrobe.x, wardrobe.z + halfD - wt / 2, wardrobe.w, wt, 0, wardrobe.h, "oak"),
    panel(wardrobe.x - halfW + wt / 2, wardrobe.z, wt, wardrobe.d - wt * 2, 0, wardrobe.h, "oak"),
    panel(wardrobe.x, wardrobe.z, wardrobe.w - wt * 2, wardrobe.d - wt * 2, 0, wt, "oak"),
    panel(wardrobe.x, wardrobe.z, wardrobe.w - wt * 2, wardrobe.d - wt * 2, wardrobe.h - wt, wt, "oak"),
    panel(frontX, wardrobe.z - leafD / 2, wt, leafD, 0.02, wardrobe.h - 0.04, "cabinetPaint"),
    panel(frontX, wardrobe.z + leafD / 2, wt, leafD, 0.02, wardrobe.h - 0.04, "cabinetPaint"),
  ];
  wardrobe.frontFace = "+x";
  move("upper-master-wardrobe", { x: wardrobe.x, z: wardrobe.z, w: wardrobe.d, d: wardrobe.w });

  const bathZ = 2;
  const bathSide = model.walls.find((wall: any) => wall.id === "bath-side");
  bathSide.b = [6.9, bathZ];
  const bathWest = model.walls.find((wall: any) => wall.id === "bath-west");
  bathWest.a = [4.8, bathZ];
  bathWest.b = [6.9, bathZ];
  const masterSide = model.walls.find((wall: any) => wall.id === "master-side");
  masterSide.a = [6.9, bathZ];
  model.rooms.find((room: any) => room.id === "bath").polygon = [
    [4.8, 0],
    [6.9, 0],
    [6.9, bathZ],
    [4.8, bathZ],
  ];
  const bathDoor = model.openings.find((opening: any) => opening.id === "bath-door");
  bathDoor.center = [bathDoor.center[0], bathZ];
  bathDoor.hinge = [bathDoor.hinge[0], bathZ];

  const vanity = move("vanity", { x: 6.58, z: 1.45, rotation: -90, w: 0.65, d: 0.42 });
  const vanityT = 0.018;
  const vanityRot = -90;
  const sideLocal = vanity.w / 2 - vanityT / 2;
  const backLocal = vanity.d / 2 - vanityT / 2;
  const sideA = worldOf(vanity.x, vanity.z, vanityRot, -sideLocal, 0);
  const sideB = worldOf(vanity.x, vanity.z, vanityRot, sideLocal, 0);
  const back = worldOf(vanity.x, vanity.z, vanityRot, 0, backLocal);
  const doorA = worldOf(vanity.x, vanity.z, vanityRot, -vanity.w / 4, -backLocal);
  const doorB = worldOf(vanity.x, vanity.z, vanityRot, vanity.w / 4, -backLocal);
  vanity.collisionParts = [
    { ...sideA, w: vanityT, d: vanity.d, y: 0.08, h: 0.745, material: "oak", rotation: vanityRot },
    { ...sideB, w: vanityT, d: vanity.d, y: 0.08, h: 0.745, material: "oak", rotation: vanityRot },
    { ...back, w: vanity.w - vanityT * 2, d: vanityT, y: 0.08, h: 0.745, material: "oak", rotation: vanityRot },
    panel(vanity.x, vanity.z, vanity.w - vanityT * 2, vanity.d - vanityT * 2, 0.2, 0.022, "oak", vanityRot),
    panel(vanity.x, vanity.z, vanity.w, vanity.d, 0.825, 0.035, "barStone", vanityRot),
    { ...doorA, w: vanity.w / 2 - vanityT, d: vanityT, y: 0.1, h: 0.71, material: "cabinetPaint", rotation: vanityRot },
    { ...doorB, w: vanity.w / 2 - vanityT, d: vanityT, y: 0.1, h: 0.71, material: "cabinetPaint", rotation: vanityRot },
  ];
  move("s02-vanity-basin", { x: vanity.x, z: vanity.z, rotation: vanity.rotation });
  move("upper-bath-mirror", { x: vanity.x - 0.11, z: vanity.z, rotation: vanity.rotation });
  move("toilet", { x: 5.2, z: 1.4, rotation: 90 });
  const shower = move("shower", { x: 5.4, z: 0.66, w: 0.9, d: 1.05 });
  const toiletUpper = requireObject("upper-bath-toilet");
  const showerMaxZ = shower.z + shower.d / 2;
  const upperHalfDepth = toiletUpper.w / 2;
  if (toiletUpper.z - upperHalfDepth < showerMaxZ) {
    move("upper-bath-toilet", { x: 5.2, z: Math.max(1.5, showerMaxZ + upperHalfDepth + 0.02), rotation: 90 });
  }

  for (const bay of model.homeDesign.bayWindows) {
    bay.widthM = 2.1;
    bay.projectionM = 0.75;
    bay.sillHeightM = 0.6;
    bay.headHeightM = 2.35;
    bay.coordinateStatus = "virtual_generic_not_measured";
    bay.retainedWalkingPolygon = true;
    const window = model.openings.find((opening: any) => opening.id === bay.windowId);
    window.width = 2.1;
    window.sill = 0.6;
    window.height = 1.75;
    window.coordinateStatus = "virtual_generic_not_measured";
  }

  const bayAssumption = model.homeDesign.assumptions.find((item: any) => item.id === "bay-window-envelope");
  if (bayAssumption) {
    bayAssumption.statement = "飘窗宽2.1m、外凸0.75m、 sill 0.6m 为虚拟通用值，未测量，未计入可走地面";
  }
  // Complete the photographed topology without copying existing decoration.
  if (!model.openings.some((o:any)=>o.id === "kitchen-window"))
    model.openings.push({id:"kitchen-window",type:"window",wallId:"north",center:[0,4.7],width:1.25,height:1.35,sill:0.95,
      coordinateStatus:"concept_window_relation_confirmed_dimensions_unmeasured"});
  move("upper-kitchen-sink",{x:kitchenSideX-0.25,z:4.66,rotation:-90,label:"端墙备餐吊柜"});
  for (const stool of model.objects.filter((o:any)=>o.type === "counter_stool")) stool.rotation = 90;
  island.collisionParts.push(panel(5.36,island.z,0.03,island.d-0.04,0.86,0.04,"steel"));
  move("toilet",{x:5.24});
  move("upper-bath-toilet",{x:5.0,z:1.5});
  move("upper-bath-mirror",{x:6.70,z:1.45,w:0.65,rotation:-90});
  move("upper-bar-display",{x:3.30,w:0.70});
  for (const fixture of model.lighting.fixtures) {
    if (fixture.anchor === "upper-kitchen-sink") {
      fixture.position=[0.55,2.52,4.7];fixture.target=[0.45,0.93,4.7];fixture.type="spot";fixture.length=0.1;
      fixture.installation="ceiling task fitting leaves the sink window clear";fixture.anchor="kitchen-sink";
    }
    if (fixture.id.startsWith("display-level")) {
      fixture.position[0]=3.30; fixture.target[0]=3.30; fixture.length=0.56;
    }
    if (fixture.id.startsWith("bath-mirror-side")) {
      const z=fixture.id.endsWith("1")?1.08:1.82;
      fixture.position=[6.57,1.72,z];fixture.target=[6.1,1.5,z];
    }
    if (fixture.roomId === "kitchen" && fixture.anchor === "kitchen-prep-return") {
      fixture.position[0]+=kitchenSideX-3.5;fixture.target[0]+=kitchenSideX-3.5;
    }
  }
  model.lighting.fixtures.push({id:"entry-island-dining-task",roomId:"bar",spaceIds:["bar","hall"],position:[5.15,2.58,7.5],
    target:[5.1,0.95,7.5],group:"task",kelvin:3000,lumens:330,type:"line",length:1.1,axis:"z",beamAngle:85,range:2.0,shadowPriority:0,
    installation:"shielded linear task light over counter, never across passage",dimensionStatus:"concept_not_photometric_acceptance"});
  model.homeDesign.dining.role="occasional_backup_table";
  model.homeDesign.dining.barRole="entry_island_two_person_dining; rear_bar_preparation_and_storage";
  model.homeDesign.assumptions=model.homeDesign.assumptions.filter((a:any)=>a.id!=="daily-living-meals");
  model.homeDesign.assumptions.push({id:"entry-island-meals",statement:"入口高台与匹配高坐凳承担两人餐位；客厅折叠桌为低频备用；全部尺寸待测",status:"concept"});
  for (const v of model.presentation.interiorViews) {
    if(v.id==="two-entries") v.label="水吧开放通口";
    if(v.id==="dining-seated") v.label="入口岛台餐位";
    if(v.id==="entry-view") Object.assign(v,{position:[5.775,1.74,8.17],target:[3.5,1.15,6.7]});
    if(v.id==="hall-view") Object.assign(v,{label:"客厅通往水吧",position:[6.65,1.7,6.15],target:[3.6,1.15,6.15]});
    if(v.id==="kitchen-main") Object.assign(v,{position:[3.0,1.65,5.24],target:[0.3,1.05,4.7]});
    if(v.id==="bath-main") Object.assign(v,{position:[5.83,1.65,2.65],target:[5.85,0.95,0.85],horizontalFov:92});
    if(v.id==="salon-bar-seat") Object.assign(v,{label:"咖啡水吧与入口餐位",position:[3.5,1.6,6.55],target:[5.15,1.0,7.55]});
  }
  model.homeDesign.spatialRevision = {
    version: "11.0.0",
    coordinateStatus: "virtual_concept_not_survey",
    kitchenCandidates,
    selectedKitchenSideX:kitchenSideX,
    occupiedSidePassBudgetM:0.7,
    userConfirmedRelations: [
      "column-handdrawn -z face aligns with master-bearing top face (wall.a[1] - thickness/2)",
    ],
    virtualOnly: [
      "column center z derived as 4.56",
      "kitchen-side selected among 4.2/4.5/4.8 using combined refrigerator use; jamb reference awaits survey",
      "entry island length 1.6 chosen from virtual corridor clears 0.955 / 0.755 / 0.555",
      "bay width 2.1, projection 0.75, sill 0.6",
      "bath boundary z 2.0 is a diagram concept",
    ],
    changes: [
      "kitchen extended toward the hall only",
      "fridge, surround, and upper cabinet translated outside the kitchen",
      "entry return rebuilt as a counter with end supports and a knee void",
      "bar service cabinet and hatch removed; rear bar shortened",
      "master door shifted on its existing wall; wardrobe lengthened",
      "bath boundary, vanity, toilet, and shower adjusted inside the same shell",
    ],
    masterDoor: "restoration of the existing master-side door, not a new opening in master-bearing",
    noPassClaims: true,
    validationDeferredToMain: ["entry seats and knees", "bath clearances", "wardrobe and vanity meshes"],
  };
  return model as T;
}
