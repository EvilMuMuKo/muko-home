import { test, expect } from "@playwright/test";
import * as THREE from "three";
import original from "../src/model.js";
import { createStorageDesign, type DesignInput } from "../src/storage-design";
import { createAtmosphereDesign } from "../src/atmosphere-design";
import { createSalonDesign } from "../src/salon-design";
import { createHomeDesign } from "../src/home-design";
import {
  applyHomeMotion,
  buildHomeFurniture,
  createHomeMotion,
} from "../src/home-mesh";

function v8Model() {
  return createSalonDesign(
    createAtmosphereDesign(
      createStorageDesign(original as unknown as DesignInput),
    ),
  );
}

function v9Model() {
  return createHomeDesign(v8Model());
}

test("V9 keeps the V8 input intact and records concept-only bay-window and hatch geometry", () => {
  const base = v8Model(),
    before = structuredClone(base),
    next = createHomeDesign(base);
  expect(next.version).toBe("9.0.0");
  expect(base).toEqual(before);
  expect(next.homeDesign.bayWindows).toEqual([
    expect.objectContaining({
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
    }),
    expect.objectContaining({
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
    }),
  ]);
  expect(next.homeDesign.hatch).toMatchObject({
    id: "hall-gate",
    spanM: 0.9,
    depthM: 0.5,
    thicknessM: 0.03,
    heightM: 0.95,
    hinge: { x: 5.15, y: 0.95, z: 7.39 },
    hingeRevealM: 0.035,
    hardware: "concept_recessed_bronze_hinge",
    xBounds: [4.9, 5.4],
    openAngleDeg: 95,
    operation: "flip_up",
    status: "concept",
  });
});

test("mobile media layout keeps full seating and peripheral cabinet geometry", () => {
  const base = v8Model(),
    oldConsole = base.objects.find(
      (object) => object.id === "living-tv-console",
    )!,
    firstPart = structuredClone(oldConsole.collisionParts![0]),
    next = createHomeDesign(base),
    tv = next.objects.find((object) => object.id === "living-tv")!,
    console = next.objects.find((object) => object.id === "living-tv-console")!,
    sofa = next.objects.find((object) => object.id === "living-sofa")!,
    ps5 = next.objects.find((object) => object.id === "ps5")!;
  expect(next.homeDesign.selectedLivingLayout).toBe("mobile-tv-flexible");
  expect(tv).toMatchObject({ x: 9.4, z: 8.9, rotation: 180, w: 1.65, h: 1.73 });
  expect(console).toMatchObject({ x: 9.4, z: 4.7, rotation: 180, w: 2.6 });
  expect(console.x - console.w / 2).toBeCloseTo(8.1);
  expect(console.x - console.w / 2).toBeGreaterThan(8.04);
  expect(sofa).toMatchObject({
    x: 9.3,
    z: 6.6,
    rotation: 180,
    w: 2.55,
    d: 1.05,
  });
  expect(ps5).toMatchObject({ x: 9.4, z: 8.99 });
  expect(console.collisionParts![0].x).toBeCloseTo(
    9.4 + (firstPart.x - oldConsole.x),
  );
  expect(console.collisionParts![0].z).toBeCloseTo(
    4.7 + (firstPart.z - oldConsole.z),
  );
  expect(console.collisionParts![0].rotation).toBe(firstPart.rotation);
  expect(
    next.objects.some((object) => object.id === "salon-coffee-table"),
  ).toBe(false);
  expect(
    next.objects.some(
      (object) => object.room === "living" && object.type === "coffee_table",
    ),
  ).toBe(false);
  const chosen = next.homeDesign.layoutComparison.alternatives.find(
    (layout) => layout.id === next.homeDesign.selectedLivingLayout,
  );
  expect(chosen.balconyRoute.radiusM).toBe(0.45);
  expect(chosen.balconyRoute.evidenceLevel).toBe("static_candidate");
  expect(chosen.balconyRoute.points).toEqual([
    [7.5, 5.4],
    [11.15, 5.4],
    [11.15, 7.45],
    [12.1, 7.45],
  ]);
  expect(
    chosen.balconyRoute.measuredClearances.map((item) => item.clearanceM),
  ).toEqual([0.675, 0.575, 0.5]);
  const retainedMediaStorage = next.objects.find(
      (object) => object.id === "upper-living-media",
    )!,
    screenBias = next.lighting.fixtures.find(
      (fixture) => fixture.id === "living-screen-bias",
    )!,
    readingLight = next.lighting.fixtures.find(
      (fixture) => fixture.id === "living-reading-lamp",
    )!;
  expect(retainedMediaStorage).toBeTruthy();
  expect(next.objects.some((object) => object.id === "upper-living-rear")).toBe(
    false,
  );
  expect(screenBias.position).toEqual([9.4, 1.265, 8.99]);
  expect(readingLight.position).toEqual([10.95, 1.265, 8.85]);
  expect(next.homeDesign.layoutComparison.alternatives[1].sofa.w).toBe(2.55);
  expect(
    next.lighting.fixtures.some(
      (fixture) =>
        fixture.id === "salon-bar-wash" ||
        fixture.anchor === "salon:bar-portal",
    ),
  ).toBe(false);
  for (const [momentId, viewId] of [
    ["day-public", "salon-living-seat"],
    ["two-person-dining", "salon-bar-seat"],
    ["dual-workstations", "master-work"],
    ["night-navigation", "hall-view"],
    ["aperitif", "salon-bar-seat"],
    ["game", "salon-living-seat"],
    ["cinema", "salon-cinema-vault"],
  ]) {
    expect(
      next.lighting.scenes.find((scene) => scene.id === momentId)?.viewId,
    ).toBe(viewId);
  }
  expect(
    next.lighting.scenes.find((scene) => scene.id === "aperitif"),
  ).toMatchObject({ ambientIntensity: 0.48, environmentIntensity: 0.2 });
  expect(
    next.lighting.scenes.find((scene) => scene.id === "game"),
  ).toMatchObject({ ambientIntensity: 0.48, environmentIntensity: 0.2 });
  expect(
    next.lighting.scenes.find((scene) => scene.id === "cinema"),
  ).toMatchObject({ ambientIntensity: 0.52, environmentIntensity: 0.18 });
});

test("entry island and hatch share the unchanged column's exact finished-width edges", () => {
  const base = v8Model(),
    next = v9Model(),
    baseColumn = base.objects.find(
      (object) => object.id === "column-handdrawn",
    )!,
    column = next.objects.find((object) => object.id === "column-handdrawn")!,
    entryReturn = next.objects.find(
      (object) => object.id === "s02-entry-return",
    )!;
  expect(column).toEqual(baseColumn);
  expect(next.homeDesign.sharedColumnFinishedWidthM).toBe(baseColumn.w);
  expect(entryReturn).toMatchObject({
    x: baseColumn.x,
    z: 7.875,
    w: baseColumn.w,
    d: 0.9,
  });
  const islandBounds = entryReturn.collisionParts!.map((part) => [
    part.x - part.w / 2,
    part.x + part.w / 2,
  ]);
  expect(Math.min(...islandBounds.map(([minX]) => minX))).toBeCloseTo(
    baseColumn.x - baseColumn.w / 2,
  );
  expect(Math.max(...islandBounds.map(([, maxX]) => maxX))).toBeCloseTo(
    baseColumn.x + baseColumn.w / 2,
  );
  expect(
    next.objects.some((object) => object.id === "s02-gate-end-panel"),
  ).toBe(false);
  expect(next.homeDesign.entryIsland).toMatchObject({
    crossSectionWidthM: 0.5,
    xBounds: [4.9, 5.4],
  });
  expect(next.homeDesign.hatch).toMatchObject({
    depthM: 0.5,
    xBounds: [4.9, 5.4],
    hinge: { x: 5.15, z: 7.39 },
    hingeRevealM: 0.035,
  });
});

test("daily dining is parked by default and stores a physical envelope, while use coordinates stay explicit", () => {
  const model = v9Model(),
    table = model.objects.find((object) => object.id === "dining-table")!,
    chairs = model.objects.filter((object) =>
      object.id.startsWith("dining-chair-"),
    );
  expect(model.homeDesign.dining).toMatchObject({
    role: "daily_main_table",
    defaultState: "stowed",
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
      },
      provenance:
        expect.stringContaining("not manufacturer CAD"),
    },
    usePositions: {
      table: { x: 2.35, z: 6.45, rotation: 0 },
      chairs: [
        { id: "dining-chair-left", x: 1.61, z: 6.45, rotation: 90 },
        { id: "dining-chair-right", x: 3.09, z: 6.45, rotation: -90 },
      ],
    },
  });
  expect(model.homeDesign.defaultState).toBe("stowed");
  expect(model.objects.some((object) => object.id === "plant-bar")).toBe(false);
  expect(model.homeDesign.dining.temporarySeatAvailable).toBe(false);
  expect(model.homeDesign.dining.sequence.tablePath).toEqual([
    [0.95, 5.58],
    [2.35, 5.58],
    [2.35, 6.45],
  ]);
  expect(table).toMatchObject({
    type: "folding_table",
    state: "stowed",
    x: 0.95,
    z: 5.58,
    w: 0.96,
    d: 0.96,
    h: 0.74,
  });
  expect(chairs).toHaveLength(2);
  expect(chairs.every((chair) => chair.type === "folding_chair")).toBe(true);
  expect(chairs[0].z).not.toBe(chairs[1].z);
  expect(chairs[0]).toMatchObject({ x: 1.25, z: 6.55, w: 0.43, d: 0.43 });
  expect(chairs[1]).toMatchObject({ x: 1.25, z: 6, w: 0.43, d: 0.43 });
  expect(
    model.homeDesign.dining.chairs.map((chair) => chair.park.foldedDepthM),
  ).toEqual([0.43, 0.43]);
  const windowWorktop = model.objects.find(
      (object) => object.id === "bar-window-worktop",
    )!,
    connector = model.objects.find(
      (object) => object.id === "bar-window-worktop-connector",
    )!;
  expect(windowWorktop).toMatchObject({
    x: 0.29,
    z: 6.55,
    w: 0.4,
    d: 1.5,
    h: 0.85,
  });
  expect(connector).toMatchObject({
    x: 0.29,
    z: 7.4875,
    w: 0.4,
    d: 0.375,
    h: 0.85,
  });
  for (const worktop of [windowWorktop, connector]) {
    const tops = worktop.collisionParts!.filter(
        (part) => part.material === "barStone",
      ),
      supports = worktop.collisionParts!.filter(
        (part) => part.material === "oak",
      );
    for (const top of tops) expect(top.y + top.h).toBeCloseTo(0.85);
    for (const support of supports) {
      expect(support.y).toBe(0);
      expect(support.y + support.h).toBeCloseTo(0.8);
    }
  }
  expect(model.homeDesign.barOperationCounter).toMatchObject({
    role: "preparation_surface",
    basin: false,
    evidenceLevel: "static_candidate",
    noHighEquipmentAtWindow: true,
  });
  expect(
    model.openings.find((opening) => opening.id === "bar-window"),
  ).toMatchObject({ sill: 0.9 });
});

test("master bedroom compares three full-size layouts and selects only a static candidate", () => {
  const base = v8Model(),
    next = createHomeDesign(base),
    oldPc = base.objects.find((object) => object.id === "pc-desk")!,
    oldMac = base.objects.find((object) => object.id === "mac-desk")!,
    oldBed = base.objects.find((object) => object.id === "master-bed")!,
    bedPart = structuredClone(oldBed.collisionParts![0]),
    pc = next.objects.find((object) => object.id === "pc-desk")!,
    mac = next.objects.find((object) => object.id === "mac-desk")!,
    bed = next.objects.find((object) => object.id === "master-bed")!,
    mattress = next.objects.find((object) => object.id === "master-mattress")!,
    pcChair = next.objects.find((object) => object.id === "pc-chair")!,
    macChair = next.objects.find((object) => object.id === "mac-chair")!;
  expect(pc).toMatchObject({
    w: oldPc.w,
    d: oldPc.d,
    x: 8.6,
    z: 3.98,
    rotation: 0,
  });
  expect(mac).toMatchObject({
    w: oldMac.w,
    d: oldMac.d,
    x: 10.9,
    z: 3.45,
    rotation: 90,
  });
  expect(mattress).toMatchObject({
    w: 1.8,
    d: 2.0,
    x: 9.4,
    z: 1.15,
    rotation: 90,
  });
  expect(bed).toMatchObject({ x: 9.4, z: 1.15, rotation: 90, w: 1.9, d: 2.08 });
  expect(bed.collisionParts![0].x).toBeCloseTo(9.4 + bedPart.z - oldBed.z);
  expect(bed.collisionParts![0].z).toBeCloseTo(1.15 - (bedPart.x - oldBed.x));
  expect(bed.collisionParts![0].rotation).toBe(90);
  const headboardLight = next.lighting.fixtures.find(
    (fixture) => fixture.id === "master-headboard",
  )!;
  expect(headboardLight.position[0]).toBeCloseTo(9.4 + (0.185 - 1.145));
  expect(headboardLight.position[2]).toBeCloseTo(1.15);
  expect(pcChair.retreat.z).toBeCloseTo(2.99);
  expect(macChair).toMatchObject({ x: 10.12, z: 3.45, rotation: 90 });
  expect(macChair.retreat).toMatchObject({ x: 9.77, z: 3.45, distanceM: 0.35 });
  const bedNorthEdge = 1.15 + 1.9 / 2,
    pulledPcChairSouthEdge = pcChair.retreat.z - pcChair.d / 2,
    pcGap = pulledPcChairSouthEdge - bedNorthEdge;
  expect(pcGap).toBeCloseTo(0.565);
  expect(
    next.homeDesign.masterBedroom.geometry.pcChairToBedFrameGapM,
  ).toBeCloseTo(pcGap);
  expect(next.homeDesign.masterBedroom.alternatives).toHaveLength(3);
  expect(
    next.homeDesign.masterBedroom.alternatives.map(
      (candidate) => candidate.status,
    ),
  ).toEqual(["not_selected", "not_selected", "selected_static_candidate"]);
  expect(next.homeDesign.masterBedroom.geometry.evidenceLevel).toBe(
    "static_candidate",
  );
  expect(next.homeDesign.masterBedroom.qualification).toContain("非PASS");
});

test("replaces selected high storage with low bedside/laundry surfaces and preserves kitchen positions", () => {
  const base = v8Model(),
    next = createHomeDesign(base),
    object = (id: string, list = next.objects) =>
      list.find((item) => item.id === id)!;
  for (const id of [
    "upper-master-bed-left",
    "upper-master-bed-right",
    "upper-laundry",
  ])
    expect(next.objects.some((item) => item.id === id)).toBe(false);
  expect(object("guest-window-bench")).toBeUndefined();
  expect(object("nightstand-left")).toMatchObject({
    x: 10.7,
    z: 1.15,
    w: 0.42,
    d: 0.42,
    h: 0.5,
  });
  expect(object("laundry-sort-fold")).toBeUndefined();
  expect(next.homeDesign.laundryWorkflow.foldingSurface).toBe("dining-table");
  expect(object("laundry-basket")).toMatchObject({
    x: 12.12,
    z: 8.93,
    w: 0.3,
    d: 0.5,
    h: 0.5,
  });
  expect(object("kitchen-sink", base.objects)).toEqual(object("kitchen-sink"));
  expect(object("kitchen-hob", base.objects)).toEqual(object("kitchen-hob"));
  expect(next.homeDesign.storage.accessStatus).toBe(
    "reach_envelope_requires_user_validation",
  );
  expect(next.homeDesign.guestBed.simultaneousDoorStorageState).toBe(
    "not_verified",
  );
});
