import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
test("real home walk has proximity interaction, fixed eye height, idle suspension and reversible exit", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?renderer=webgl");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  await page.evaluate(() =>
    window.homePresentation.startGhostWalk({
      position: [5.15, 1.74, 4.05],
      target: [4.045, 1.15, 4.05],
    }),
  );
  await expect(page.locator(".ghost-joystick:not(.ghost-look-joystick)")).toBeVisible();
  await expect(page.locator(".ghost-interact")).toHaveAttribute(
    "data-target-id",
    "walk-fridge",
  );
  expect(
    (await page.evaluate(() => window.homePresentation.getGhostWalkState()))
      .position[1],
  ).toBe(1.74);
  expect(
    await page.evaluate(
      () => window.homePresentation.getState().ceilingVisible,
    ),
  ).toBe(true);
  await page.locator(".ghost-interact").click();
  await page.waitForFunction(
    () => Math.abs(window.homePresentation.getState().fridgeAngle) > 0.5,
  );
  await page.locator(".ghost-interact").click();
  await page.waitForFunction(
    () => Math.abs(window.homePresentation.getState().fridgeAngle) < 0.01,
  );
  const before = await page.evaluate(
    () => window.homePresentation.getCamera().position,
  );
  await page.keyboard.down("s");
  try {
    await expect
      .poll(
        async () => {
          const after = await page.evaluate(
            () => window.homePresentation.getCamera().position,
          );
          return Math.hypot(after[0] - before[0], after[2] - before[2]);
        },
        { timeout: 5_000, intervals: [100, 200, 400] },
      )
      .toBeGreaterThan(0.15);
  } finally {
    await page.keyboard.up("s");
  }
  const after = await page.evaluate(
    () => window.homePresentation.getCamera().position,
  );
  expect(
    Math.hypot(after[0] - before[0], after[2] - before[2]),
  ).toBeGreaterThan(0.15);
  await page.waitForFunction(
    () => !window.homePresentation.getPerformance().pending,
  );
  const renders = await page.evaluate(
    () => window.homePresentation.getPerformance().renders,
  );
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => window.homePresentation.getPerformance().renders),
  ).toBe(renders);
  await page.locator(".ghost-exit").click();
  await expect(page.locator(".ghost-joystick:not(.ghost-look-joystick)")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => window.homePresentation.getGhostWalkState().active,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});
test("whole-model geometry inventory has no missing object or nonfinite data", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  const report = await page.evaluate(() =>
    window.homePresentation.getModelAudit(),
  );
  expect(report.issues).toEqual([]);
  expect(report.objects.filter((o) => o.missing)).toEqual([]);
  expect(report.checkedGeometryCount).toBeGreaterThan(100);
  expect(
    report.objects.find((o) => o.id === "s02-entry-return").accessFace,
  ).toBe("+x");
  await writeFile(
    test.info().outputPath("whole-model-audit.json"),
    JSON.stringify(report, null, 2),
  );
});
test("visible lighting choices preserve the current hatch and dining furniture state", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl");
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  await page.evaluate(() => {
    const a = window.homePresentation;
    a.setDiningOpen(true);
  });
  await page.waitForFunction(
    () => window.homePresentation.getState().diningProgress > 0.99,
  );
  await page.evaluate(() => window.homePresentation.setHatchOpen(false));
  await page.waitForFunction(() => window.homePresentation.getState().hatchProgress < .01);
  for (const scene of ["aperitif", "cinema", "day-public"]) {
    await page.evaluate(
      (s) => window.homePresentation.setLightingScene(s),
      scene,
    );
    const state = await page.evaluate(() => window.homePresentation.getState());
    expect(state.diningProgress).toBeCloseTo(1);
    expect(state.hatchProgress).toBeCloseTo(0);
  }
});

test("arrival is directly walkable and real wall/closed door block while an opened door permits passage", async ({page}) => {
  // Software-rendered CI can take seconds per frame. Keep an actual renderer,
  // but use a small landscape viewport and allow the required simulation steps.
  await page.setViewportSize({width:640,height:360});
  const errors: string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/?renderer=webgl");
  await page.waitForFunction(()=>window.homePresentation?.getState().ready);
  expect(await page.evaluate(()=>window.homePresentation.getGhostWalkState().active)).toBe(true);
  await expect(page.locator(".ghost-look-joystick")).toBeVisible();
  const audit=await page.evaluate(()=>window.homePresentation.getWalkCollisionAudit());
  expect(audit.missingGroups).toEqual([]);
  expect(audit.staticGroups).toEqual(expect.arrayContaining(["column-handdrawn","living-sofa","living-tv","dining-table"]));
  await page.evaluate(()=>window.homePresentation.startGhostWalk({position:[6.35,1.74,3.2],target:[8,1.74,3.2]}));
  await page.keyboard.down("w");
  try { await expect.poll(async()=> (await page.evaluate(()=>window.homePresentation.getCamera().position))[0],{timeout:60000}).toBeGreaterThan(6.4); } finally { await page.keyboard.up("w"); }
  const wall=await page.evaluate(()=>window.homePresentation.getCamera().position);
  expect(wall[0]).toBeLessThanOrEqual(6.591);
  expect(wall[0]).toBeGreaterThan(6.4);
  await page.evaluate(()=>window.homePresentation.setWalkDoorOpen("master-door",false));
  await page.waitForFunction(()=>Math.abs(window.homePresentation.getWalkDoorStates()["master-door"]+Math.PI/2)<.001);
  await page.evaluate(()=>window.homePresentation.startGhostWalk({position:[6.35,1.74,2.325],target:[8,1.74,2.325]}));
  await page.keyboard.down("w");await page.waitForTimeout(1600);await page.keyboard.up("w");
  expect((await page.evaluate(()=>window.homePresentation.getCamera().position))[0]).toBeLessThan(6.75);
  await page.evaluate(()=>window.homePresentation.setWalkDoorOpen("master-door",true));
  await page.waitForFunction(()=>Math.abs(window.homePresentation.getWalkDoorStates()["master-door"])<.001);
  // Opening a leaf while pressed against it can legitimately push the body
  // sideways out of the doorway. Compare open/closed travel from the same
  // centered approach, independently of that frame-dependent push direction.
  const afterDoorSwing = await page.evaluate(()=>({
    position: window.homePresentation.getCamera().position,
    frames: window.homePresentation.getPerformance().frames,
    door: window.homePresentation.getWalkDoorStates()["master-door"],
  }));
  await page.evaluate(()=>window.homePresentation.startGhostWalk({position:[6.35,1.74,2.325],target:[8,1.74,2.325]}));
  await page.keyboard.down("w");
  try {
    await expect.poll(async()=> (await page.evaluate(()=>window.homePresentation.getCamera().position))[0],{timeout:60000}).toBeGreaterThan(7.05);
  } finally {
    await page.keyboard.up("w");
    const afterPassage = await page.evaluate(()=>({
      position: window.homePresentation.getCamera().position,
      frames: window.homePresentation.getPerformance().frames,
      door: window.homePresentation.getWalkDoorStates()["master-door"],
    }));
    await writeFile(test.info().outputPath("door-swing-position.json"), JSON.stringify({afterDoorSwing,afterPassage}));
    console.info("REAL_DOOR_PASSAGE", JSON.stringify({afterDoorSwing,afterPassage}));
  }
  expect(errors).toEqual([]);
});

test("portrait keeps the landscape gate and rotating restores both walk sticks", async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/?renderer=webgl");
  await page.waitForFunction(()=>window.homePresentation?.getState().ready);
  await expect(page.locator("#orientation-gate")).toBeVisible();
  await expect(page.locator(".ghost-walk-controls")).toBeHidden();
  await page.setViewportSize({width:844,height:390});
  await expect(page.locator("#orientation-gate")).toBeHidden();
  await expect(page.locator(".ghost-joystick:not(.ghost-look-joystick)")).toBeVisible();
  await expect(page.locator(".ghost-look-joystick")).toBeVisible();
  expect(await page.evaluate(()=>window.homePresentation.getGhostWalkState().active)).toBe(true);
});
