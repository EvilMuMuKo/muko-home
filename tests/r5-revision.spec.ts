import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?renderer=webgl");
  await page.waitForFunction(
    () => window.homePresentation?.getState().ready,
    undefined,
    { timeout: 120_000 },
  );
});

test("R5 A9 default TV uses the specified 85-inch body, stand and diagonal pose", async ({ page }) => {
  const result = await page.evaluate(() => {
    const api = window.homePresentation;
    const model = api.getModel();
    return {
      revision: api.getR5Revision(),
      tv: model.objects.find((o: any) => o.id === "living-tv"),
      layout: model.homeDesign.livingTV85,
    };
  });
  expect(result.revision).toBeTruthy();
  expect(result.tv).toMatchObject({
    x: 10.2,
    z: 8.6,
    rotation: 155,
    screen: { w: 1.895, h: 1.087, centerHeightM: 1.3 },
    stand: { w: 1.1, d: 0.66 },
  });
  expect(result.layout.bodyM.slice(0, 2)).toEqual([1.895, 1.087]);
  expect(result.layout.centerHeightM).toBe(1.3);
});

test("R5 A9 keeps two full-size sofa modules at distinct centers", async ({ page }) => {
  const result = await page.evaluate(() => {
    const model = window.homePresentation.getModel();
    return { sofa: model.homeDesign.modularSofa, object: model.objects.find((o: any) => o.id === "living-sofa") };
  });
  const sofa = result.sofa;
  expect(sofa.moduleDimensions).toMatchObject({ w: 1.275, d: 1.05 });
  expect(sofa.combined).toHaveLength(2);
  for (const part of result.object.collisionParts)
    expect(part).toMatchObject({ w: 1.275, d: 1.05, rotation: 155 });
  for (const module of sofa.combined) expect(module.rotation).toBe(155);
  expect(Math.hypot(sofa.combined[0].x - sofa.combined[1].x, sofa.combined[0].z - sofa.combined[1].z)).toBeGreaterThan(1);
});

test("R5 activity mode parks the TV at its rear stop and leaves the central activity lane clear", async ({ page }) => {
  await page.evaluate(() => window.homePresentation.setLivingMode("activity"));
  await page.waitForFunction(() => window.homePresentation.getState().activityProgress > 0.99, undefined, { timeout: 15_000 });
  const result = await page.evaluate(() => ({
    tv: window.homePresentation.getObjectFrames().find((o: any) => o[0] === "living-tv"),
    modules: window.homePresentation.getModel().homeDesign.modularSofa.activity,
  }));
  expect(result.tv?.[1][0]).toBeCloseTo(10.2, 2);
  expect(result.tv?.[1][2]).toBeCloseTo(8.83, 2);
  expect(Math.abs(Math.abs(result.tv?.[2] ?? 0) - Math.PI)).toBeLessThan(0.08);
  // The two parked modules and the rear-stopped TV sit outside the central 2.0 x 1.1m activity patch.
  const clearPatch = { x0: 8.6, x1: 10.6, z0: 6.1, z1: 7.2 };
  for (const module of result.modules) {
    expect(module.z + 1.05 / 2).toBeLessThanOrEqual(clearPatch.z0 + 0.001);
  }
  expect(result.tv?.[1][2]).toBeGreaterThan(clearPatch.z1);
});

test("R5 A8 replaces the fixed guest TV with the correctly sized mobile TV and keeps the original large bed", async ({ page }) => {
  const result = await page.evaluate(() => {
    const model = window.homePresentation.getModel();
    return {
      tv: model.objects.find((o: any) => o.id === "guest-tv"),
      cinema: model.homeDesign.cinemaTV,
      largeBed: model.objects.find((o: any) => o.id === "guest-sofa-bed"),
      retired: model.homeDesign.retiredObjects,
    };
  });
  expect(result.tv).toMatchObject({ type: "mobile_tv", x: 2.05, z: 2.84, w: 1.895, h: 1.087, rotation: 180, stand: { w: 1.086, d: 0.849 } });
  expect(result.cinema).toMatchObject({ bodyM: [1.895, 1.087, 0.06], centerHeightM: 1.3, baseM: [1.086, 0.849], poses: { far: [2.05, 2.84, 180], near: [2.05, 2.44, 180] } });
  expect(result.largeBed).toMatchObject({ id: "guest-sofa-bed", type: "sofa_bed" });
  expect(result.retired).toContain("guest-tv-fixed-mount");
});

test("R5 A8 study bed and bay-spanning desk preserve the clear 1.10m leg opening", async ({ page }) => {
  const model = await page.evaluate(() => window.homePresentation.getModel());
  const bed = model.objects.find((o: any) => o.id === "study-sofa-bed");
  const desk = model.objects.find((o: any) => o.id === "study-desk");
  expect(bed.mechanism).toMatchObject({ outerWidthM: 1.05, outerLengthM: 1.92 });
  expect(desk).toMatchObject({ w: 1.96, d: 0.6, rotation: 0 });
  const legs = desk.collisionParts.filter((p: any) => p.h > 0.6);
  expect(legs).toHaveLength(4);
  const leftmostRightLeg = Math.min(...legs.filter((p: any) => p.x > 0.5).map((p: any) => p.x - p.w / 2));
  const rightmostLeftLeg = Math.max(...legs.filter((p: any) => p.x < 0.5).map((p: any) => p.x + p.w / 2));
  expect(leftmostRightLeg - rightmostLeftLeg).toBeCloseTo(1.1, 6);
});

test("R5 study state parks the chair when the small bed opens and prevents incompatible large-bed and near-TV states", async ({ page }) => {
  const openSmall = await page.evaluate(() => window.homePresentation.setStudyBedOpen(true));
  expect(openSmall.accepted).toBe(true);
  await page.waitForFunction(() => window.homePresentation.getStudyState().smallBedOpen === true);
  const study = await page.evaluate(() => window.homePresentation.getStudyState());
  expect(study.chairPosition[0]).toBeCloseTo(2.9, 3);
  expect(study.chairPosition[2]).toBeCloseTo(1.8, 3);
  expect((await page.evaluate(() => window.homePresentation.setCinemaTVNear(true))).accepted).toBe(false);
  expect((await page.evaluate(() => window.homePresentation.setGuestBedOpen(true))).accepted).toBe(false);
  expect((await page.evaluate(() => window.homePresentation.setStudyBedOpen(false))).accepted).toBe(true);
  expect((await page.evaluate(() => window.homePresentation.setCinemaTVNear(true))).accepted).toBe(true);
  expect((await page.evaluate(() => window.homePresentation.setCinemaTVNear(false))).accepted).toBe(true);
  expect((await page.evaluate(() => window.homePresentation.setGuestBedOpen(true))).accepted).toBe(true);
  const nearDenied = await page.evaluate(() => window.homePresentation.setCinemaTVNear(true));
  expect(nearDenied.accepted).toBe(false);
  expect(nearDenied.reason).toBeTruthy();
});

test("R5 A10 keeps 48 electrical points, separates the furniture power strip and excludes conditional points from rendering", async ({ page }) => {
  const result = await page.evaluate(() => {
    const plan = window.homePresentation.getElectricalPlan();
    const conditionalIds = plan.plan.points.filter((p: any) => p.status === "CONDITIONAL").map((p: any) => p.id);
    return { plan: plan.plan, rendering: plan.rendering, conditionalIds };
  });
  expect(result.plan.points).toHaveLength(48);
  const strip = result.plan.points.find((p: any) => p.kind === "furniture_pdu");
  expect(strip).toBeTruthy();
  expect(strip.kind).not.toBe("socket");
  expect(result.rendering).toBeTruthy();
  expect(result.rendering.conditionalOmitted).toEqual(expect.arrayContaining(result.conditionalIds));
  const renderedIds = result.rendering.groups.map((group: any) => group.id);
  for (const id of result.conditionalIds) expect(renderedIds).not.toContain(id);
});
