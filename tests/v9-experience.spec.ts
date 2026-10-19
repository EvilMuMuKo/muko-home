import { test, expect } from "@playwright/test";

async function ready(page) {
  await page.goto("/?renderer=webgl");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  await page.waitForFunction(
    () => window.homePresentation.getPerformance().renders > 0,
  );
}

test("R3 household controls expose version 13 and complete reversible travel", async ({
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
  expect(initial.state.version).toBe("15.0.0");
  expect(initial.design.version).toBe(1);
  expect(initial.design.selectedLivingLayout).toBe("mobile-tv-flexible");
  expect(initial.model.version).toBe("15.0.0");
  expect(initial.model.shell).toContainEqual([7.1, 9.35]);
  const dailyIsland = initial.model.objects.find((object) => object.id === "s02-entry-return");
  expect(dailyIsland).toMatchObject({ x: 4.95, z: 7.525, w: 0.5, d: 1.6 });
  expect(initial.design.entryIslandDining).toMatchObject({ pullbackM: 0.4, dailyMainDining: true });
  expect(initial.design.entryIslandDining.seats.map((seat) => seat.center[0])).toEqual([4.4, 4.4]);
  const entryCabinet = initial.model.objects.find((object) => object.id === "r2-entry");
  expect(entryCabinet).toMatchObject({ x: 6.73, w: 0.56 });
  expect(entryCabinet.r2Cabinet.bays.find((bay) => bay.purpose === "bench").w).toBe(0.56);
  expect(initial.model.homeDesign.version).toBe(initial.design.version);
  expect(initial.state.renderer).toBe("WebGL2");
  expect(initial.performance.drawCalls).toBeGreaterThan(0);
  expect(initial.performance.triangles).toBeGreaterThan(0);
  expect(initial.performance.qualityProfile.mobile).toBe(true);
  expect(initial.design.dining.defaultState).toBe("stowed");
  expect(initial.state.diningProgress).toBe(0);
  // The counter starts concealed in the cabinet, leaving the passage open.
  expect(initial.state.hatchProgress).toBe(0);
  expect(initial.state.hatchAvailable).toBe(false);
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
    x: 8.64,
    z: 8.82,
    w: 1.1,
    d: 0.7,
    h: 0.74,
    rotation: 0,
  });
  expect(initial.design.dining.role).toBe("backup_normal_height_table");
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
        x: 8.64,
        z: 9.0,
        w: 0.5,
        d: 0.55,
        h: 0.88,
        rotation: 0,
      }),
      expect.objectContaining({
        id: "dining-chair-right",
        room: "living",
        x: 8.64,
        z: 9.16,
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
  expect(fridge).toMatchObject({
    room: "hall",
    x: 3.4,
    z: 3.935,
    w: 0.91,
    d: 0.75,
    rotation: 180,
    accessFace: "+z",
  });
  expect(initial.design.lifeRevision.kitchen.externalFridge).toBe(false);
  expect(fridge.x + fridge.w / 2).toBeLessThanOrEqual(3.855);
  expect(fridge.z - fridge.d / 2).toBeCloseTo(3.56, 2);
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
    {name:"dishwasher",setter:"setDishwasherOpen",state:"dishwasherProgress"},
  ] as const;
  for (const transition of transitions) {
    await page.evaluate((setter) => window.homePresentation[setter](true), transition.setter);
    await page.waitForFunction(
      (key) => window.homePresentation.getState()[key] >= 0.999,
      transition.state,
    );
    {

      const open = await page.evaluate(
        () => window.homePresentation.getHomeDesign().motionBounds.find((item) => item.id === "kitchen-dishwasher"),
      );
      const closed = initial.design.motionBounds.find((item) => item.id === "kitchen-dishwasher");
      expect(open.max).not.toEqual(closed.max);
      expect(closed.min[2] - open.min[2]).toBeGreaterThan(0.5);
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
    expect(report.state.version).toBe("15.0.0");
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
