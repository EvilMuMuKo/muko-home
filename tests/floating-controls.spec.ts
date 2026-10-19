import { test, expect } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";

let fixtureServer: ViteDevServer;
let fixtureUrl: string;

test.beforeAll(async () => {
  fixtureServer = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: "mpa",
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  await fixtureServer.listen();
  const address = fixtureServer.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Vite fixture server did not expose a TCP port");
  fixtureUrl = `http://127.0.0.1:${address.port}/tests/fixtures/ghost-walk.html`;
});

test.afterAll(async () => { await fixtureServer?.close(); });

test.beforeEach(async ({ page }) => {
  await page.goto(fixtureUrl);
  await page.waitForFunction(() => Boolean(window.ghostWalkHarness));
});

test("floating touch controls lock to their starting half, act independently, and clear on release", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const moveIdle = page.locator(".ghost-joystick:not(.ghost-look-joystick)");
  const lookIdle = page.locator(".ghost-look-joystick");
  await expect(moveIdle).toBeHidden();
  await expect(lookIdle).toBeHidden();
  const leftStart = { x: 170, y: 260, id: 11 };
  const rightStart = { x: 720, y: 260, id: 12 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [leftStart, rightStart] });
  const moveStick = page.locator(".ghost-joystick:not(.ghost-look-joystick)");
  const lookStick = page.locator(".ghost-look-joystick");
  await expect(moveStick).toBeVisible();
  await expect(lookStick).toBeVisible();
  const moveBox = (await moveStick.boundingBox())!;
  const lookBox = (await lookStick.boundingBox())!;
  expect(moveBox.x + moveBox.width / 2).toBeCloseTo(leftStart.x, 0);
  expect(moveBox.y + moveBox.height / 2).toBeCloseTo(leftStart.y, 0);
  expect(lookBox.x + lookBox.width / 2).toBeCloseTo(rightStart.x, 0);
  expect(lookBox.y + lookBox.height / 2).toBeCloseTo(rightStart.y, 0);

  // Cross the center line while both pointers are captured. Their roles must stay fixed.
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [
    { x: 730, y: 225, id: 11 }, { x: 180, y: 100, id: 12 },
  ] });
  await page.evaluate(() => { for (let i = 0; i < 12; i++) window.ghostWalkHarness.step(); });
  const state = await page.evaluate(() => window.ghostWalkHarness.walk.getState());
  expect(state.position[2]).toBeLessThan(4.8);
  expect(state.yaw).toBeLessThan(-0.2);
  expect(state.pitch).toBeGreaterThan(0.1);

  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(moveStick).toBeHidden();
  await expect(lookStick).toBeHidden();
  await expect(page.locator(".ghost-joystick--floating")).toHaveCount(0);
  const stopped = await page.evaluate(() => window.ghostWalkHarness.walk.getState());
  await page.evaluate(() => { for (let i = 0; i < 20; i++) window.ghostWalkHarness.step(); });
  expect(await page.evaluate(() => window.ghostWalkHarness.walk.getState())).toEqual(stopped);
  expect(await page.evaluate(() => window.ghostWalkHarness.events.motion)).toEqual([true, false]);
});

test("touching controls UI does not create a floating stick; cancel/lost capture, blur and resize clear active touch state", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await expect(page.locator(".ghost-joystick")).toHaveCount(2);
  await expect(page.locator(".ghost-joystick").nth(0)).toBeHidden();
  await expect(page.locator(".ghost-joystick").nth(1)).toBeHidden();
  const exit = (await page.locator(".ghost-exit").boundingBox())!;
  const x = exit.x + exit.width / 2, y = exit.y + exit.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 21 }] });
  await expect(page.locator(".ghost-joystick--floating")).toHaveCount(0);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.ghostWalkHarness));

  await page.evaluate(() => {
    document.querySelector("#scene")!.addEventListener("lostpointercapture", () => {
      document.body.dataset.lostPointerCapture = "true";
    });
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 180, y: 260, id: 22 }] });
  await expect(page.locator(".ghost-joystick--floating")).toBeVisible();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect(page.locator(".ghost-joystick--floating")).toHaveCount(0);
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)")).toHaveCount(2);
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)").nth(0)).toBeHidden();
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)").nth(1)).toBeHidden();
  expect(await page.evaluate(() => document.body.dataset.lostPointerCapture)).toBe("true");
  expect(await page.evaluate(() => window.ghostWalkHarness.events.motion.at(-1))).toBe(false);

  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 180, y: 260, id: 23 }] });
  await page.evaluate(() => window.ghostWalkHarness.walk.resize(innerWidth + 20, innerHeight));
  await expect(page.locator(".ghost-joystick--floating")).toHaveCount(0);
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)").nth(0)).toBeHidden();
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)").nth(1)).toBeHidden();
  expect(await page.evaluate(() => window.ghostWalkHarness.events.motion.at(-1))).toBe(false);

  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 180, y: 260, id: 25 }] });
  await expect(page.locator(".ghost-joystick--floating")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator(".ghost-joystick--floating")).toHaveCount(0);
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)")).toHaveCount(2);
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)").nth(0)).toBeHidden();
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)").nth(1)).toBeHidden();
  expect(await page.evaluate(() => window.ghostWalkHarness.events.motion.at(-1))).toBe(false);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
});

test("desktop mouse drag remains available", async ({ page }) => {
  await expect(page.locator(".ghost-joystick")).toHaveCount(2);
  await expect(page.locator(".ghost-joystick").nth(0)).toBeHidden();
  await expect(page.locator(".ghost-joystick").nth(1)).toBeHidden();
  const canvas = page.locator("#scene");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 8);
  await page.mouse.up();
  const state = await page.evaluate(() => window.ghostWalkHarness.walk.getState());
  expect(state.yaw).not.toBeCloseTo(0, 2);
  expect(state.pitch).not.toBeCloseTo(0, 2);
});

test("current 4173 build creates independent touch sticks at arbitrary origins and clears them", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await page.goto("http://localhost:4173/?renderer=webgl");
  try {
    await page.waitForFunction(() => window.homePresentation?.getState().ready, undefined, { timeout: 30_000 });
  } catch {
    throw new Error(runtimeErrors.length
      ? `Current 4173 page failed before input tests: ${runtimeErrors.join("; ")}`
      : "Current 4173 page did not become ready within 30 seconds");
  }
  expect(await page.evaluate(() => window.homePresentation.getState().version)).toBe("15.0.0");
  await page.evaluate(() => window.homePresentation.startGhostWalk());
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)")).toHaveCount(2);
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)").nth(0)).toBeHidden();
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)").nth(1)).toBeHidden();

  const { width, height } = page.viewportSize()!;
  const left = { x: Math.round(width * 0.23), y: Math.round(height * 0.62), id: 31 };
  const right = { x: Math.round(width * 0.78), y: Math.round(height * 0.37), id: 32 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [left, right] });
  const moveStick = page.locator(".ghost-joystick--floating:not(.ghost-look-joystick)");
  const lookStick = page.locator(".ghost-joystick--floating.ghost-look-joystick");
  await expect(moveStick).toBeVisible();
  await expect(lookStick).toBeVisible();
  const origins = await page.evaluate(() => [...document.querySelectorAll(".ghost-joystick--floating")].map((stick) => {
    const rect = stick.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, look: stick.classList.contains("ghost-look-joystick") };
  }));
  expect(origins).toHaveLength(2);
  expect(origins.find((origin) => !origin.look)?.x).toBeCloseTo(left.x, 0);
  expect(origins.find((origin) => !origin.look)?.y).toBeCloseTo(left.y, 0);
  expect(origins.find((origin) => origin.look)?.x).toBeCloseTo(right.x, 0);
  expect(origins.find((origin) => origin.look)?.y).toBeCloseTo(right.y, 0);

  const before = await page.evaluate(() => window.homePresentation.getGhostWalkState());
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [
    { x: right.x, y: left.y - 48, id: left.id },
    { x: left.x, y: right.y - 140, id: right.id },
  ] });
  await expect.poll(async () => page.evaluate((origin) => {
    const state = window.homePresentation.getGhostWalkState();
    return Math.hypot(state.position[0] - origin.position[0], state.position[2] - origin.position[2]);
  }, before), { timeout: 5_000 }).toBeGreaterThan(0.01);
  await expect.poll(async () => {
    const pose = await page.evaluate(() => window.homePresentation.getGhostWalkState());
    return Math.abs(pose.yaw - before.yaw) > .02 && Math.abs(pose.pitch - before.pitch) > .02;
  }, {timeout:5000}).toBe(true);
  const moved = await page.evaluate(() => window.homePresentation.getGhostWalkState());
  expect(moved.yaw).not.toBeCloseTo(before.yaw, 2);
  expect(moved.pitch).not.toBeCloseTo(before.pitch, 2);

  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator(".ghost-joystick--floating")).toHaveCount(0);
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)").nth(0)).toBeHidden();
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)").nth(1)).toBeHidden();
  await page.waitForTimeout(180);
  const released = await page.evaluate(() => window.homePresentation.getGhostWalkState());
  await page.waitForTimeout(180);
  expect(await page.evaluate(() => window.homePresentation.getGhostWalkState())).toEqual(released);

  const cancelStart = { x: Math.round(width * 0.31), y: Math.round(height * 0.69), id: 33 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [cancelStart] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...cancelStart, y: cancelStart.y - 55 }] });
  await page.waitForTimeout(140);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect(page.locator(".ghost-joystick--floating")).toHaveCount(0);
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)")).toHaveCount(2);
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)").nth(0)).toBeHidden();
  await expect(page.locator(".ghost-joystick:not(.ghost-joystick--floating)").nth(1)).toBeHidden();
  await page.waitForTimeout(180);
  const cancelled = await page.evaluate(() => window.homePresentation.getGhostWalkState());
  await page.waitForTimeout(180);
  expect(await page.evaluate(() => window.homePresentation.getGhostWalkState())).toEqual(cancelled);

  const exit = (await page.locator(".ghost-exit").boundingBox())!;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: exit.x + exit.width / 2, y: exit.y + exit.height / 2, id: 34 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator(".ghost-joystick--floating")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.homePresentation.getGhostWalkState().active)).toBe(false);
});

declare global {
  interface Window {
    homePresentation: {
      getState(): { ready: boolean; version: string };
      startGhostWalk(): void;
      getGhostWalkState(): { active: boolean; yaw: number; pitch: number; position: [number, number, number] };
    };
    ghostWalkHarness: {
      walk: { getState(): { active: boolean; yaw: number; pitch: number; position: [number, number, number]; nearestId: string | null }; resize(width: number, height: number): void };
      events: { motion: boolean[] };
      step(dt?: number): boolean;
    };
  }
}


test("a floating stick near the center cannot steal the second finger from the other half", async ({page}) => {
  const cdp=await page.context().newCDPSession(page);
  const {width,height}=page.viewportSize()!;
  const left={x:width/2-10,y:height*.55,id:81}, right={x:width/2+10,y:height*.55,id:82};
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[left]});
  await expect(page.locator(".ghost-joystick--floating:not(.ghost-look-joystick)")).toBeVisible();
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[left,right]});
  await expect(page.locator(".ghost-look-joystick.ghost-joystick--floating")).toBeVisible();
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await expect(page.locator(".ghost-joystick--floating")).toHaveCount(0);
});
