import { test, expect } from "@playwright/test";

async function ready(page) {
  await page.goto("/?renderer=webgl");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  await page.waitForFunction(
    () => window.homePresentation.getPerformance().renders > 0,
  );
}

test("V10 household controls expose version 10 and complete reversible travel", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);

  const initial = await page.evaluate(() => {
    const api = window.homePresentation;
    return {
      state: api.getState(),
      design: api.getHomeDesign(),
      model: api.getModel(),
      performance: api.getPerformance(),
    };
  });
  expect(initial.state.version).toBe("10.0.0");
  expect(initial.design.version).toBe(1);
  expect(initial.design.selectedLivingLayout).toBe("mobile-tv-flexible");
  expect(initial.model.version).toBe("10.0.0");
  expect(initial.model.homeDesign.version).toBe(initial.design.version);
  expect(initial.state.renderer).toBe("WebGL2");
  expect(initial.performance.drawCalls).toBeGreaterThan(0);
  expect(initial.performance.triangles).toBeGreaterThan(0);
  expect(initial.performance.qualityProfile.mobile).toBe(true);
  expect(initial.design.dining.defaultState).toBe("stowed");
  expect(initial.state.diningProgress).toBe(0);
  // The counter starts concealed in the cabinet, leaving the passage open.
  expect(initial.state.hatchProgress).toBe(1);
  expect(initial.state.dishwasherProgress).toBe(0);
  expect(
    initial.model.objects.some(
      (object) => object.room === "living" && object.type === "coffee_table",
    ),
  ).toBe(false);
  const diningChairs = initial.model.objects.filter(
    (object) => object.type === "folding_chair",
  );
  expect(diningChairs).toHaveLength(2);
  const diningTable = initial.model.objects.find((object) => object.id === "dining-table");
  expect(diningTable).toMatchObject({
    type: "folding_table",
    room: "living",
    shape: "rectangle",
    x: 11.0,
    z: 9.06,
    w: 1.1,
    d: 0.7,
    h: 0.74,
    rotation: 0,
  });
  expect(initial.design.dining.role).toBe("living_normal_height_daily_dining");
  expect(initial.design.dining.stateEnvelopes.deployed).toMatchObject({
    shape: "rectangle",
    w: 1.1,
    d: 0.7,
    h: 0.74,
  });
  expect(initial.design.dining.stateEnvelopes.folded.shape).toBe("upright_folded_table");
  expect(diningChairs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "dining-chair-left",
        room: "living",
        x: 8.27,
        z: 8.78,
        w: 0.5,
        d: 0.55,
        h: 0.88,
        rotation: 0,
      }),
      expect.objectContaining({
        id: "dining-chair-right",
        room: "living",
        x: 8.27,
        z: 9.03,
        w: 0.5,
        d: 0.55,
        h: 0.88,
        rotation: 0,
      }),
    ]),
  );
  const records = initial.model.objects.find((object) => object.id === "reading-records");
  expect(records).toMatchObject({
    type: "record_console",
    room: "bar",
    placement: "below_bar_window",
    x: 0.29,
    z: 6.5,
    w: 1.2,
    d: 0.34,
    h: 0.68,
    windowSillM: 0.9,
    highestEquipmentTopM: 0.765,
  });
  expect(records.h).toBeLessThanOrEqual(records.windowSillM);
  expect(records.highestEquipmentTopM).toBeLessThanOrEqual(records.windowSillM);
  expect(initial.design.readingNook).toMatchObject({
    recordsId: "reading-records",
    mainDining: false,
    windowUncovered: true,
    recordsUnderWindow: true,
  });
  const fridge = initial.model.objects.find((object) => object.id === "kitchen-fridge");
  const kitchen = initial.model.rooms.find((room) => room.id === "kitchen");
  expect(fridge).toMatchObject({
    room: "hall",
    x: 4.045,
    z: 4.05,
    w: 0.91,
    d: 0.75,
    rotation: 90,
    accessFace: "+x",
  });
  expect(initial.design.lifeRevision.kitchen.externalFridge).toBe(true);
  const fridgeAngle = (fridge.rotation * Math.PI) / 180;
  const fridgeHalfX =
    (Math.abs(Math.cos(fridgeAngle)) * fridge.w +
      Math.abs(Math.sin(fridgeAngle)) * fridge.d) /
    2;
  expect(fridge.x - fridgeHalfX).toBeGreaterThan(
    Math.max(...kitchen.polygon.map((point) => point[0])),
  );
  expect(initial.model.objects.find((object) => object.id === "living-tv")?.type).toBe("mobile_tv");
  expect(initial.design.mobileTV.poses).toHaveLength(2);
  const sofa = initial.model.objects.find((object) => object.id === "living-sofa");
  expect(
    initial.model.objects.filter((object) => object.type === "modular_sofa"),
  ).toHaveLength(1); // One two-module sofa assembly; modules are represented by paired poses/bounds.
  expect(sofa).toMatchObject({ type: "modular_sofa", w: 2.55, d: 1.05, h: 0.76 });
  expect(initial.design.modularSofa).toMatchObject({
    moduleDimensions: { w: 1.275, d: 1.05, h: 0.76 },
    middleArmrest: false,
  });
  expect(initial.design.modularSofa.combined).toHaveLength(2);
  expect(initial.design.modularSofa.separated).toHaveLength(2);

  await page.evaluate(() => window.homePresentation.setDiningOpen(true));
  await page.waitForFunction(
    () => window.homePresentation.getState().diningProgress >= 0.999,
  );
  const deployedDining = await page.evaluate(() => {
    const design = window.homePresentation.getHomeDesign();
    return {
      frames: window.homePresentation.getObjectFrames(),
      bounds: design.motionBounds.filter((item) =>
        ["dining-table", "dining-chair-left", "dining-chair-right"].includes(item.id),
      ),
      locations: {
        table: design.dining.table.use,
        chairs: design.dining.chairs.map((chair) => chair.use),
      },
    };
  });
  const center = (item, axis: "x" | "z") =>
    (item.min[axis === "x" ? 0 : 2] + item.max[axis === "x" ? 0 : 2]) / 2;
  const tableBounds = deployedDining.bounds.find((item) => item.id === "dining-table")!;
  expect(center(tableBounds, "x")).toBeCloseTo(deployedDining.locations.table.x, 1);
  expect(center(tableBounds, "z")).toBeCloseTo(deployedDining.locations.table.z, 1);
  expect(tableBounds.max[0] - tableBounds.min[0]).toBeCloseTo(1.1, 1);
  expect(tableBounds.max[2] - tableBounds.min[2]).toBeCloseTo(0.7, 1);
  for (const [index, chair] of deployedDining.locations.chairs.entries()) {
    const bounds = deployedDining.bounds.find(
      (item) =>
        item.id ===
        (index === 0 ? "dining-chair-left" : "dining-chair-right"),
    )!;
    const frame=deployedDining.frames.find(row=>row[0]===bounds.id)!;
    // Chair origin is asymmetric to its visible AABB; verify the actual root.
    expect(frame[1][0]).toBeCloseTo(chair.x, 3);
    expect(frame[1][2]).toBeCloseTo(chair.z, 3);
  }
  await page.evaluate(() => window.homePresentation.setDiningOpen(false));
  await page.waitForFunction(
    () => window.homePresentation.getState().diningProgress <= 0.001,
  );
  const foldedTable = await page.evaluate(
    () => window.homePresentation.getHomeDesign().motionBounds.find((item) => item.id === "dining-table"),
  );
  expect(center(foldedTable, "x")).toBeCloseTo(
    initial.design.dining.table.parkedEnvelope.x,
    1,
  );
  expect(center(foldedTable, "z")).toBeCloseTo(
    initial.design.dining.table.parkedEnvelope.z,
    1,
  );
  expect(foldedTable.max[2] - foldedTable.min[2]).toBeLessThanOrEqual(0.2);

  const transitions = [
    { name: "hatch", setter: "setHatchOpen", state: "hatchProgress" },
    {
      name: "dishwasher",
      setter: "setDishwasherOpen",
      state: "dishwasherProgress",
    },
  ] as const;
  for (const transition of transitions) {
    if (transition.name === "hatch") {
      await page.evaluate(() => window.homePresentation.setHatchOpen(false));
      await page.waitForFunction(
        () => window.homePresentation.getState().hatchProgress <= 0.001,
      );
    }
    await page.evaluate((setter) => window.homePresentation[setter](true), transition.setter);
    await page.waitForFunction(
      (key) => window.homePresentation.getState()[key] >= 0.999,
      transition.state,
    );
    if (transition.name === "hatch") {
      const counter = await page.evaluate(() => ({
        angle: window.homePresentation.getState().gateAngle,
        design: window.homePresentation.getHomeDesign().hatch,
        bounds: window.homePresentation.getHomeDesign().motionBounds.find(item => item.id === "opening:hall-gate"),
      }));
      expect(counter.angle).toBe(0); // No horizontal or upward gate remains.
      expect(counter.design.kind).toBe("two_leaf_drawer_pullout");
      expect(counter.design.depthM).toBeCloseTo(0.405, 3);
      expect(counter.bounds.min[2]).toBeGreaterThanOrEqual(counter.design.drawerFrontZ - 0.04);
      expect(counter.bounds.max[2]).toBeLessThanOrEqual(counter.design.drawerFrontZ + counter.design.cabinetClearDepthM + 0.02);
    } else {
      const open = await page.evaluate(
        () => window.homePresentation.getHomeDesign().motionBounds.find((item) => item.id === "kitchen-dishwasher"),
      );
      const closed = initial.design.motionBounds.find((item) => item.id === "kitchen-dishwasher");
      expect(open.max).not.toEqual(closed.max);
      expect(open.max[2] - closed.max[2]).toBeGreaterThan(0.5);
    }
    await page.evaluate((setter) => window.homePresentation[setter](false), transition.setter);
    await page.waitForFunction(
      (key) => window.homePresentation.getState()[key] <= 0.001,
      transition.state,
    );
  }

  const initialTV = initial.design.motionBounds.find((item) => item.id === "living-tv");
  await page.evaluate(() => window.homePresentation.setMobileTVAlternative(true));
  await page.waitForFunction(() => window.homePresentation.getState().tvProgress >= 0.999);
  const alternateTV = await page.evaluate(
    () => window.homePresentation.getHomeDesign().motionBounds.find((item) => item.id === "living-tv"),
  );
  expect(alternateTV.min).not.toEqual(initialTV.min);
  expect(alternateTV.max).not.toEqual(initialTV.max);
  await page.evaluate(() => window.homePresentation.setMobileTVAlternative(false));
  await page.waitForFunction(() => window.homePresentation.getState().tvProgress <= 0.001);
  const restoredTV = await page.evaluate(
    () => window.homePresentation.getHomeDesign().motionBounds.find((item) => item.id === "living-tv"),
  );
  expect(restoredTV.min).toEqual(initialTV.min);
  expect(restoredTV.max).toEqual(initialTV.max);

  const initialSofa = initial.design.motionBounds.filter((item) =>
    ["sofa-module-1", "sofa-module-2"].includes(item.id),
  );
  await page.evaluate(() => window.homePresentation.setSofaSeparated(true));
  await page.waitForFunction(() => window.homePresentation.getState().sofaProgress >= 0.999);
  const separatedSofa = await page.evaluate(() =>
    window.homePresentation.getHomeDesign().motionBounds.filter((item) =>
      ["sofa-module-1", "sofa-module-2"].includes(item.id),
    ),
  );
  expect(separatedSofa).toHaveLength(2);
  expect(separatedSofa.map((item) => item.min)).not.toEqual(initialSofa.map((item) => item.min));
  await page.evaluate(() => window.homePresentation.setSofaSeparated(false));
  await page.waitForFunction(() => window.homePresentation.getState().sofaProgress <= 0.001);
  const restoredSofa = await page.evaluate(() =>
    window.homePresentation.getHomeDesign().motionBounds.filter((item) =>
      ["sofa-module-1", "sofa-module-2"].includes(item.id),
    ),
  );
  expect(restoredSofa.map((item) => item.min)).toEqual(initialSofa.map((item) => item.min));
  expect(restoredSofa.map((item) => item.max)).toEqual(initialSofa.map((item) => item.max));

  await expect(page.locator("#scene")).toBeVisible();
  expect(errors).toEqual([]);
});

test("V10 operating states remain renderable and capture clean screenshots", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);

  for (const [view, light] of [
    ["salon-bar-seat", "aperitif"],
    ["living-lounge", "game"],
    ["cinema-seat", "cinema"],
  ]) {
    await page.evaluate(
      ({ viewId, lighting }) => {
        const api = window.homePresentation;
        api.setLightingScene(lighting);
        api.setInteriorView(viewId);
      },
      { viewId: view, lighting: light },
    );
    await page.waitForTimeout(250);
    const report = await page.evaluate(() => ({
      state: window.homePresentation.getState(),
      performance: window.homePresentation.getPerformance(),
      camera: window.homePresentation.getCamera(),
    }));
    expect(report.state.version).toBe("10.0.0");
    expect(report.performance.drawCalls).toBeGreaterThan(0);
    expect(report.performance.triangles).toBeGreaterThan(0);
    expect(report.camera.verticalFov).toBeGreaterThan(0);
    expect(report.camera.verticalFov).toBeLessThan(90);
    await page.screenshot({
      path: test.info().outputPath(`v9-${view}-${light}.png`),
      animations: "disabled",
    });
  }
  expect(errors).toEqual([]);
});
