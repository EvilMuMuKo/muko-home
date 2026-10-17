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
  const stopped = await page.evaluate(() => window.ghostWalkHarness.walk.getState());
  await page.evaluate(() => { for (let i = 0; i < 20; i++) window.ghostWalkHarness.step(); });
  expect(await page.evaluate(() => window.ghostWalkHarness.walk.getState())).toEqual(stopped);
  expect(await page.evaluate(() => window.ghostWalkHarness.events.motion)).toEqual([true, false]);
});

test("touching controls UI does not create a floating stick; cancel and resize clear active touch state", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const exit = (await page.locator(".ghost-exit").boundingBox())!;
  const x = exit.x + exit.width / 2, y = exit.y + exit.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 21 }] });
  await expect(page.locator(".ghost-joystick--floating")).toHaveCount(0);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.ghostWalkHarness));

  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 180, y: 260, id: 22 }] });
  await expect(page.locator(".ghost-joystick--floating")).toBeVisible();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect(page.locator(".ghost-joystick--floating")).toHaveCount(0);
  expect(await page.evaluate(() => window.ghostWalkHarness.events.motion.at(-1))).toBe(false);

  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 180, y: 260, id: 23 }] });
  await page.evaluate(() => window.ghostWalkHarness.walk.resize(innerWidth + 20, innerHeight));
  await expect(page.locator(".ghost-joystick--floating")).toHaveCount(0);
  expect(await page.evaluate(() => window.ghostWalkHarness.events.motion.at(-1))).toBe(false);
});

test("desktop mouse drag remains available", async ({ page }) => {
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

declare global {
  interface Window {
    ghostWalkHarness: {
      walk: { getState(): { active: boolean; yaw: number; pitch: number; position: [number, number, number]; nearestId: string | null }; resize(width: number, height: number): void };
      events: { motion: boolean[] };
      step(dt?: number): boolean;
    };
  }
}
