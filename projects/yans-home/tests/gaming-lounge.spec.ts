import { test, expect, type Page } from "@playwright/test";
import { furniture, gamingSofa } from "../src/plan";

async function ready(page: Page) {
  await page.goto("/");
  await page.waitForFunction(
    () => (window as any).homePresentation?.getState().ready,
  );
  await page.evaluate(() => (window as any).homePresentation.whenVisualReady());
  await page.evaluate(() => (window as any).homePresentation.setRoom("gaming"));
  await settled(page);
}
async function settled(page: Page) {
  await page.waitForFunction(
    () => !(window as any).homePresentation.getPerformance().pending,
  );
}
async function cycle(page: Page) {
  await page.evaluate(() =>
    (window as any).homePresentation.interact("gaming-sofa-bed"),
  );
  await settled(page);
}

test("retailer dimensions distinguish external bed length from sleeping length and keep useful full-height storage", () => {
  const sofa = furniture.find((f) => f.id === "gaming-sofa-bed")!;
  expect([sofa.w, sofa.d, sofa.h]).toEqual([1.25, 0.8, 0.85]);
  expect(gamingSofa.depths[2]).toBe(1.92);
  expect(gamingSofa.sleepLength).toBe(1.82);
  expect(gamingSofa.innerWidth).toBe(1.2);
  expect(gamingSofa.seatHeight).toBe(0.4);
  expect(gamingSofa.recliningDepthVerified).toBe(false);
  const tower = furniture.find((f) => f.id === "gaming-library")!;
  expect([tower.w, tower.d, tower.h]).toEqual([0.65, 0.3, 2.76]);
  expect(furniture.find((f) => f.id === "gaming-desk")!.w).toBe(2.82);
});

test("real furniture, door sweep and occupied-station circulation fit all three sofa states", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  const result = [];
  for (let state = 0; state < 3; state++) {
    if (state) await cycle(page);
    result.push(
      await page.evaluate(() => {
        const a = (window as any).homePresentation;
        const cs = a
          .getColliders()
          .filter((c: any) => c.max[1] >= 0.24 && c.min[1] <= 1.75);
        // Block the entire occupied chair/pullback reserve, not just its rendered base.
        cs.push({
          id: "occupied-station",
          min: [8.045, 0, 2.53],
          max: [9.045, 1.75, 3.33],
        });
        const clear = (x: number, z: number) =>
          cs.every(
            (c: any) =>
              Math.hypot(
                Math.max(c.min[0] - x, 0, x - c.max[0]),
                Math.max(c.min[2] - z, 0, z - c.max[2]),
              ) >=
              0.3 - 1e-7,
          );
        const step = 0.02,
          nx = 150,
          nz = 148,
          origin = [6.83, 0.53],
          start = [30, 132];
        const grid = new Uint8Array(nx * nz);
        for (let z = 0; z < nz; z++)
          for (let x = 0; x < nx; x++)
            grid[z * nx + x] = Number(
              clear(origin[0] + x * step, origin[1] + z * step),
            );
        const startId = start[1] * nx + start[0],
          seen = new Set([startId]),
          q = [startId];
        for (let head = 0; head < q.length; head++) {
          const id = q[head],
            x = id % nx,
            z = Math.floor(id / nx);
          for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const xx = x + dx,
              zz = z + dz,
              k = zz * nx + xx;
            if (
              xx >= 0 &&
              xx < nx &&
              zz >= 0 &&
              zz < nz &&
              grid[k] &&
              !seen.has(k)
            ) {
              seen.add(k);
              q.push(k);
            }
          }
        }
        const reachable = (x: number, z: number) => {
          const ix = Math.round(x / step),
            iz = Math.round(z / step);
          return grid[iz * nx + ix] === 1 && seen.has(iz * nx + ix);
        };
        const sofa = cs.find((c: any) => c.id === "gaming-sofa-bed"),
          desk = cs.find((c: any) => c.id === "gaming-desk");
        return {
          state: a
            .getState()
            .actions.find((b: any) => b.id === "gaming-sofa-bed").state,
          width: sofa.max[2] - sofa.min[2],
          depth: sofa.max[0] - sofa.min[0],
          gap: desk.min[0] - sofa.max[0],
          window: reachable(1.84, 0.5),
          side: reachable(0.7, 1.76),
          startedClear: !!grid[startId],
        };
      }),
    );
  }
  expect(result.map((r) => r.state)).toEqual(["坐姿", "躺靠", "睡眠"]);
  for (const r of result) {
    expect(r.width).toBeCloseTo(1.25);
    expect(r.side).toBe(true);
    expect(r.startedClear).toBe(true);
  }
  expect(result.map((r) => r.window)).toEqual([true, true, false]);
  expect(result[0].depth).toBeCloseTo(0.8);
  expect(result[1].depth).toBeCloseTo(1.36);
  expect(result[2].depth).toBeCloseTo(1.92);
  expect(result[0].gap).toBeCloseTo(1.315);
  expect(result[2].gap).toBeCloseTo(0.195);
  // Sample real animated door AABBs through a full closing and opening cycle.
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() =>
      (window as any).homePresentation.interact("gaming-door"),
    );
    const hits = await page.evaluate(async () => {
      const a = (window as any).homePresentation,
        hits: string[] = [];
      do {
        const cs = a.getColliders(),
          door = cs.find((c: any) => c.id === "gaming-door");
        if (!door) throw new Error("Door collider missing");
        for (const c of cs.filter((c: any) =>
          c.id.startsWith("gaming-library"),
        ))
          if (
            door.min[0] < c.max[0] &&
            door.max[0] > c.min[0] &&
            door.min[2] < c.max[2] &&
            door.max[2] > c.min[2]
          )
            hits.push(c.id);
        await new Promise(requestAnimationFrame);
      } while (a.getPerformance().pending);
      return hits;
    });
    expect(hits).toEqual([]);
  }
});

test("mobile furniture controls cycle all poses, slide cabinet leaves in place and stop rendering at rest", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage(),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  for (const label of ["躺靠", "睡眠", "坐姿"]) {
    await page.locator("#panel-toggle").tap();
    await page.locator('[data-tab="actions"]').tap();
    const button = page.locator('[data-action="gaming-sofa-bed"]');
    await expect(button).toContainText(`切换为${label}`);
    await button.tap();
    await page.locator("#panel-close").tap();
    await settled(page);
    expect(
      await page.evaluate(
        () =>
          (window as any).homePresentation
            .getState()
            .actions.find((a: any) => a.id === "gaming-sofa-bed").state,
      ),
    ).toBe(label);
  }
  const before = await page.evaluate(() =>
    (window as any).homePresentation
      .getColliders()
      .filter((c: any) => c.id.startsWith("gaming-library")),
  );
  for (const j of [0, 1])
    await page.evaluate(
      (j) => (window as any).homePresentation.interact(`gaming-library-${j}`),
      j,
    );
  await settled(page);
  const after = await page.evaluate(() =>
    (window as any).homePresentation
      .getColliders()
      .filter((c: any) => c.id.startsWith("gaming-library")),
  );
  for (let i = 0; i < before.length; i++) {
    expect(after[i].max[0]).toBeCloseTo(before[i].max[0]);
    expect(after[i].min[2]).toBeGreaterThanOrEqual(1.98 - 0.01);
    expect(after[i].max[2]).toBeLessThanOrEqual(2.63 + 0.01);
  }
  const p = await page.evaluate(() =>
    (window as any).homePresentation.getPerformance(),
  );
  expect(p.textures.loaded).toBe(12);
  expect(p.textures.failed).toEqual([]);
  expect(p.lighting.slots).toBeLessThanOrEqual(4);
  expect(p.canvas[0] * p.canvas[1]).toBeLessThanOrEqual(1_000_000);
  await page.waitForTimeout(400);
  expect(
    await page.evaluate(
      () => (window as any).homePresentation.getPerformance().renders,
    ),
  ).toBe(p.renders);
  expect(errors).toEqual([]);
  await context.close();
});

test("sofa extension yields to a walker and reserves its future footprint during motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await page.evaluate(() => {
    const a = (window as any).homePresentation;
    a.enterWalk();
    if (!a.setWalkPosition(8.25, 1.1)) throw new Error("Test start blocked");
    a.interact("gaming-sofa-bed");
  });
  expect(
    await page.evaluate(
      () =>
        (window as any).homePresentation
          .getState()
          .actions.find((a: any) => a.id === "gaming-sofa-bed").target,
    ),
  ).toBe(0);
  await expect(page.locator("#toast")).toContainText("先走到沙发侧面");
  await page.evaluate(() => {
    const a = (window as any).homePresentation;
    if (!a.setWalkPosition(7.55, 2.35))
      throw new Error("Bedside test start blocked");
    a.interact("gaming-sofa-bed");
  });
  expect(
    await page.evaluate(() =>
      (window as any).homePresentation.clearAt(8.25, 1.1),
    ),
  ).toBe(false);
  await settled(page);
  expect(
    await page.evaluate(
      () =>
        (window as any).homePresentation
          .getState()
          .actions.find((a: any) => a.id === "gaming-sofa-bed").value,
    ),
  ).toBe(0.5);
  await cycle(page);
  expect(
    await page.evaluate(() =>
      (window as any).homePresentation.clearAt(8.25, 1.1),
    ),
  ).toBe(false);
  await cycle(page);
  expect(
    await page.evaluate(() =>
      (window as any).homePresentation.clearAt(8.25, 1.1),
    ),
  ).toBe(true);
});

test("sofa-facing secondary display clamps to the desk and stows clear of the side window", async ({
  page,
}) => {
  await ready(page);
  const active = await page.evaluate(() => {
    const a = (window as any).homePresentation,
      cs = a.getColliders();
    return {
      screen: cs.find((c: any) => c.id === "gaming-lounge-monitor"),
      sofa: cs.find((c: any) => c.id === "gaming-sofa-bed"),
      desk: cs.find((c: any) => c.id === "gaming-desk"),
      desks: a.getModel().furniture.filter((f: any) => f.type === "desk")
        .length,
    };
  });
  expect(active.desks).toBe(1);
  expect((active.screen.min[2] + active.screen.max[2]) / 2).toBeCloseTo(
    (active.sofa.min[2] + active.sofa.max[2]) / 2,
  );
  expect(active.screen.min[0]).toBeGreaterThan(active.desk.min[0]);
  expect(active.screen.max[0]).toBeLessThan(active.desk.max[0]);
  expect(active.screen.min[1]).toBeGreaterThan(1.2);
  await page.locator("#panel-toggle").click();
  await page.locator('[data-tab="actions"]').click();
  const button = page.locator('[data-action="gaming-lounge-monitor"]');
  await expect(button).toContainText("收回到桌侧");
  await button.click();
  await settled(page);
  const parked = await page.evaluate(() =>
    (window as any).homePresentation
      .getColliders()
      .find((c: any) => c.id === "gaming-lounge-monitor"),
  );
  expect(parked.min[2]).toBeGreaterThan(1.47);
  expect(parked.min[1]).toBeGreaterThan(1.32);
  await expect(button).toContainText("转向沙发");
  await button.click();
  await settled(page);
  await cycle(page);
  await cycle(page);
  const foot = await page.evaluate(() => {
    const cs = (window as any).homePresentation.getColliders(),
      sofa = cs.find((c: any) => c.id === "gaming-sofa-bed"),
      desk = cs.find((c: any) => c.id === "gaming-desk"),
      screen = cs.find((c: any) => c.id === "gaming-lounge-monitor");
    return {
      desk: desk.min[0] - sofa.max[0],
      screen: screen.min[0] - sofa.max[0],
    };
  });
  expect(foot.desk).toBeCloseTo(0.195);
  expect(foot.screen).toBeGreaterThan(foot.desk);
});
