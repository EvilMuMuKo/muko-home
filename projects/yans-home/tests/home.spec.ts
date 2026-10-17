import { test, expect, type Page } from "@playwright/test";
import {
  model,
  furniture,
  rooms,
  walls,
  insideShell,
  cabinetBottom,
} from "../src/plan";
const api = (page: Page) =>
  page.evaluate(() => (window as any).homePresentation.getState());
async function ready(page: Page) {
  await page.goto("/");
  await page.waitForFunction(
    () => (window as any).homePresentation?.getState().ready,
  );
  await page.evaluate(() => (window as any).homePresentation.whenVisualReady());
  await page.waitForFunction(
    () => !(window as any).homePresentation.getPerformance().pending,
  );
}
test("new home uses confirmed room programme and one PC station, with no inherited console setup", () => {
  expect(model.name).toBe("YAN’s Home");
  expect(model.requirements.occupants).toBe(2);
  expect(model.requirements.consoleGaming).toBe(false);
  expect(furniture.filter((o) => o.type === "desk")).toHaveLength(1);
  expect(furniture.find((o) => o.type === "desk")!.room).toBe("gaming");
  expect(
    furniture
      .filter((o) => o.type === "bed")
      .map((o) => o.room)
      .sort(),
  ).toEqual(["guest", "master"]);
  expect(rooms.find((r) => r.id === "guest")!.rect[0]).toBe(0);
  expect(rooms.find((r) => r.id === "master")!.rect[0]).toBe(7.95);
});
test("extensions are incorporated and dimension discrepancy remains explicit", () => {
  for (const p of [
    [1.5, 11.2],
    [11.55, 9.3],
    [6, 12.1],
  ])
    expect(insideShell(...(p as [number, number]))).toBe(true);
  expect(insideShell(1, 4)).toBe(false);
  expect(model.assumptions[0].value).toContain("11850");
  expect(model.assumptions[0].status).toBe("PROVISIONAL");
  const wall = walls.find((w) => w.id === "guest-north")!;
  expect(wall.openings).toHaveLength(1);
  expect(wall.openings![0].at).toBe(0.87);
});
test("coffee island, full-height cabinetry and central sofa stay in the required zones", () => {
  const coffee = furniture.find((o) => o.id === "coffee-island")!,
    upper = furniture.find((o) => o.id === "coffee-upper")!,
    sofa = furniture.find((o) => o.id === "central-sofa")!;
  expect(coffee.x).toBeLessThan(4.8);
  expect(coffee.room).toBe("dining");
  expect(cabinetBottom(upper.id) + upper.h).toBeCloseTo(2.76);
  expect(sofa.x).toBeGreaterThan(5);
  expect(sofa.x).toBeLessThan(6.5);
  expect(
    furniture.filter((o) => o.room === "master" && o.type === "desk"),
  ).toHaveLength(0);
});
test("full PBR textures, WASM and idle suspension work in the real viewer", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  const p = await page.evaluate(() =>
    (window as any).homePresentation.getPerformance(),
  );
  expect(p.textures.loaded).toBe(12);
  expect(p.textures.failed).toEqual([]);
  expect(p.geometry.backend).toBe("wasm");
  expect(p.geometry.transformedVertices).toBeGreaterThan(0);
  expect(p.batching.reduced).toBeGreaterThan(200);
  await page.waitForTimeout(450);
  expect(
    (
      await page.evaluate(() =>
        (window as any).homePresentation.getPerformance(),
      )
    ).renders,
  ).toBe(p.renders);
  expect(errors).toEqual([]);
});
test("WebGPU and WASM failure recover independently without blocking the viewer", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", {
      value: { requestAdapter: async () => null },
    }),
  );
  await page.route("**/transform.wasm", (r) => r.abort());
  await ready(page);
  expect((await api(page)).renderer).toBe("WebGL2");
  expect(
    await page.evaluate(
      () => (window as any).homePresentation.getPerformance().geometry.backend,
    ),
  ).toBe("javascript");
  await expect(page.locator("#fallback")).toBeHidden();
});
test("old guest doorway is sealed and new guest door has stateful physical collision", async ({
  page,
}) => {
  await ready(page);
  expect(
    await page.evaluate(() =>
      (window as any).homePresentation.clearAt(2.35, 7.05),
    ),
  ).toBe(false);
  expect(
    await page.evaluate(() =>
      (window as any).homePresentation.clearAt(0.87, 7.05),
    ),
  ).toBe(true);
  await page.evaluate(() =>
    (window as any).homePresentation.interact("guest-door"),
  );
  await page.waitForFunction(
    () =>
      (window as any).homePresentation
        .getState()
        .actions.find((a: any) => a.id === "guest-door").value === 0,
  );
  expect(
    await page.evaluate(() =>
      (window as any).homePresentation.clearAt(0.87, 7.05),
    ),
  ).toBe(false);
});
test("all twelve areas are connected to the entrance with a 520mm walking body", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const a = (window as any).homePresentation,
      step = 0.08,
      nx = 151,
      nz = 160,
      clear = new Uint8Array(nx * nz);
    for (let iz = 0; iz < nz; iz++)
      for (let ix = 0; ix < nx; ix++)
        clear[iz * nx + ix] = Number(a.clearAt(ix * step, iz * step));
    const start = Math.round(4.45 / step) * nx + Math.round(2.55 / step),
      seen = new Set([start]),
      q = [start];
    for (let head = 0; head < q.length; head++) {
      const p = q[head],
        x = p % nx,
        z = Math.floor(p / nx);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const xx = x + dx,
          zz = z + dz,
          id = zz * nx + xx;
        if (
          xx >= 0 &&
          xx < nx &&
          zz >= 0 &&
          zz < nz &&
          clear[id] &&
          !seen.has(id)
        ) {
          seen.add(id);
          q.push(id);
        }
      }
    }
    return [
      ...a.getModel().rooms,
      { id: "guest-wardrobe-access", spawn: [2.0, 9.55] },
      { id: "guest-window-access", spawn: [1.2, 10.76] },
    ].map((r: any) => ({
      id: r.id,
      reachable: [...seen].some(
        (k) =>
          Math.hypot(
            (k % nx) * step - r.spawn[0],
            Math.floor(k / nx) * step - r.spawn[1],
          ) < 0.22,
      ),
    }));
  });
  expect(result.filter((r: any) => !r.reachable)).toEqual([]);
});
test("actual held keyboard movement stops at a solid wall and on key release", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    const a = (window as any).homePresentation;
    if (!a.setWalkPosition(2.7, 6.34))
      throw new Error("Blocked keyboard test start");
    a.facePoint(5, 6.34);
  });
  await page.keyboard.down("w");
  await page.waitForFunction(
    () => (window as any).homePresentation.getState().position[0] > 3.55,
    null,
    { timeout: 25000 },
  );
  await page.keyboard.up("w");
  const s = await api(page);
  expect(s.position[0]).toBeGreaterThan(2.8);
  expect(s.position[0]).toBeLessThan(3.64);
  await page.waitForTimeout(200);
  expect((await api(page)).position).toEqual(s.position);
});
test("floating dual touch sticks spawn at each touch, move independently and reset on cancel", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  await ready(page);
  const cdp = await context.newCDPSession(page);
  const send = (type: string, touchPoints: any[]) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  await send("touchStart", [
    { x: 130, y: 260, id: 1 },
    { x: 650, y: 240, id: 2 },
  ]);
  let s = await api(page);
  expect(s.sticks.move.origin).toEqual([130, 260]);
  expect(s.sticks.look.origin).toEqual([650, 240]);
  expect(s.sticks.move.visible && s.sticks.look.visible).toBe(true);
  const position = s.position;
  await send("touchMove", [
    { x: 130, y: 210, id: 1 },
    { x: 685, y: 220, id: 2 },
  ]);
  await page.waitForTimeout(450);
  s = await api(page);
  expect(s.sticks.move.vector[1]).toBeLessThan(-0.8);
  expect(s.sticks.look.vector[0]).toBeGreaterThan(0.4);
  expect(s.position).not.toEqual(position);
  await send("touchEnd", [{ x: 130, y: 210, id: 1 }]);
  await page.waitForFunction(
    () => !(window as any).homePresentation.getState().sticks.move.visible,
  );
  s = await api(page);
  expect(s.sticks.move.visible).toBe(false);
  expect(s.sticks.look.visible).toBe(true);
  await send("touchEnd", []);
  await send("touchStart", [
    { x: 280, y: 185, id: 3 },
    { x: 720, y: 280, id: 4 },
  ]);
  s = await api(page);
  expect(s.sticks.move.origin).toEqual([280, 185]);
  expect(s.sticks.look.origin).toEqual([720, 280]);
  await send("touchCancel", []);
  await page.waitForFunction(
    () =>
      !(window as any).homePresentation.getState().sticks.move.visible &&
      !(window as any).homePresentation.getState().sticks.look.visible,
  );
  s = await api(page);
  expect(s.sticks.move.visible || s.sticks.look.visible).toBe(false);
  expect(s.sticks.move.vector).toEqual([0, 0]);
  await page.locator("#panel-toggle").tap();
  s = await api(page);
  expect(s.sticks.move.visible || s.sticks.look.visible).toBe(false);
  await page.locator("#panel-close").tap();
  const before = (
    await page.evaluate(() => (window as any).homePresentation.getPerformance())
  ).canvas;
  await send("touchStart", [{ x: 650, y: 230, id: 5 }]);
  await send("touchMove", [{ x: 695, y: 230, id: 5 }]);
  await page.waitForTimeout(250);
  expect(
    (
      await page.evaluate(() =>
        (window as any).homePresentation.getPerformance(),
      )
    ).canvas,
  ).toEqual(before);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  expect((await api(page)).sticks.look.visible).toBe(false);
  await context.close();
});
test("room views, lighting and image export controls remain usable", async ({
  page,
}) => {
  await ready(page);
  await page.click("#panel-toggle");
  await page.click('[data-room="gaming"]');
  expect((await api(page)).room).toBe("gaming");
  await page.click("#panel-toggle");
  await page.click('[data-tab="light"]');
  await page.click('[data-light="evening"]');
  expect((await api(page)).lighting).toBe("evening");
  await page.click('[data-tab="rooms"]');
  const download = page.waitForEvent("download");
  await page.click("#export");
  expect((await download).suggestedFilename()).toBe("YANs-Home.png");
  await page.click("#panel-close");
  await page.click("#overview");
  expect((await api(page)).overview).toBe(true);
});

test("private elevator hall has full-height storage and a road bicycle display on its right wall", () => {
  const room = rooms.find((r) => r.id === "lift-lobby")!,
    bike = furniture.find((f) => f.id === "lobby-bike-wall")!;
  expect(model.requirements.wallMountedBike).toBe("road-bike-on-pegboard");
  expect(bike.room).toBe(room.id);
  expect(bike.h).toBe(2.76);
  expect(bike.x).toBeGreaterThan((room.rect[0] + room.rect[2]) / 2);
  expect(bike.type).toBe("bike-wall");
  expect(walls.find((w) => w.id === "entry-divider")!.openings![0].id).toBe(
    "entry-door",
  );
});

test("revision joins the gaming balcony, recesses entry storage and clears the laundry front", async ({
  page,
}) => {
  await ready(page);
  expect(rooms.find((r) => r.id === "gaming")!.rect[1]).toBe(0.45);
  expect(rooms.some((r) => r.name === "南向阳台")).toBe(false);
  expect(furniture.find((f) => f.id === "gaming-desk")!.w).toBeGreaterThan(2.7);
  expect(
    furniture.some((f) =>
      [
        "entry-coats",
        "entry-shoes",
        "guest-wardrobe",
        "laundry-worktop",
      ].includes(f.id),
    ),
  ).toBe(false);
  expect(furniture.find((f) => f.id === "entry-niche")!.room).toBe("entry");
  expect(rooms.find((r) => r.id === "guest")!.floorRects).toHaveLength(2);
  const actual = await page.evaluate(() => {
    const a = (window as any).homePresentation;
    return {
      clearAcrossFormerWall: a.clearAt(8.65, 1.65),
      cornerPosts: a
        .getColliders()
        .filter(
          (c: any) =>
            ["outer-7", "outer-8"].includes(c.id) &&
            c.max[1] > 1.0 &&
            c.min[0] <= 11.85 &&
            c.max[0] >= 11.77 &&
            c.min[2] <= 11.45 &&
            c.max[2] >= 11.37,
        ),
      staleBalconyDoor: a
        .getState()
        .actions.some((a: any) => a.id === "south-balcony-door"),
    };
  });
  expect(actual.clearAcrossFormerWall).toBe(true);
  expect(actual.cornerPosts).toEqual([]);
  expect(actual.staleBalconyDoor).toBe(false);
});

test("revision 03 keeps storage useful, window clear and the new guest bedside accessible", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const a = (window as any).homePresentation,
      m = a.getModel(),
      b = a.getBounds();
    return {
      version: m.version,
      livingAisle: b["living-back"].min[0] - b["central-sofa"].max[0],
      guestAisle: b["guest-east-wardrobe"].min[0] - b["guest-bed"].max[0],
      guestFoot: b["guest-window-seat"].min[2] - b["guest-bed"].max[2],
      bedside: a.clearAt(2.0, 9.55),
      foot: a.clearAt(1.2, 10.76),
      gameUpperStart: b["gaming-upper"].min[2],
      uppers: [
        "fridge-upper",
        "lobby-upper",
        "gaming-upper",
        "bath-wc-upper",
        "suite-wc-upper",
      ].map((id) => ({
        id,
        min: b[id].min[1],
        max: b[id].max[1],
      })),
      contact: a.getPerformance().contact,
    };
  });
  expect(result.version).toBe("1.2.0");
  expect(result.livingAisle).toBeGreaterThan(1.0);
  expect(result.guestAisle).toBeGreaterThan(0.56);
  expect(result.guestFoot).toBeGreaterThan(0.6);
  expect(result.bedside).toBe(true);
  expect(result.foot).toBe(true);
  // The existing side-window ends at z=1.47; the upper cabinet is on solid wall.
  expect(result.gameUpperStart).toBeGreaterThan(1.5);
  for (const c of result.uppers) {
    expect(c.min, c.id).toBeGreaterThan(1.5);
    expect(c.max, c.id).toBeCloseTo(2.76, 1);
  }
  expect(result.contact.floors).toBeGreaterThanOrEqual(12);
  expect(result.contact.dynamicExcluded).toBe(true);
  // Sliding guest doors do not swing into the narrow bedside aisle.
  await page.evaluate(() =>
    (window as any).homePresentation.interact("guest-east-wardrobe-0"),
  );
  await page.waitForFunction(
    () =>
      (window as any).homePresentation
        .getState()
        .actions.find((a: any) => a.id === "guest-east-wardrobe-0").value === 1,
  );
  expect(
    await page.evaluate(() =>
      (window as any).homePresentation.clearAt(2.0, 9.55),
    ),
  ).toBe(true);
});

test("revision 03 mobile lighting stays bounded and night switching settles without a render loop", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    const a = (window as any).homePresentation;
    a.setRoom("dining");
    a.setLightingScene("evening");
  });
  await page.waitForFunction(
    () => !(window as any).homePresentation.getPerformance().pending,
  );
  const p = await page.evaluate(() =>
    (window as any).homePresentation.getPerformance(),
  );
  expect(p.quality.mobile).toBe(true);
  expect(p.lighting.slots).toBeLessThanOrEqual(4);
  expect(p.lighting.shadowLights).toBe(1);
  expect(p.finish.kind).not.toContain("GTAO");
  expect(p.canvas[0] * p.canvas[1]).toBeLessThanOrEqual(1_000_000);
  await page.waitForTimeout(400);
  expect(
    (
      await page.evaluate(() =>
        (window as any).homePresentation.getPerformance(),
      )
    ).renders,
  ).toBe(p.renders);
});
