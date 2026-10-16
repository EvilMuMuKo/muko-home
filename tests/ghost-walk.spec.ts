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

test.afterAll(async () => {
  await fixtureServer?.close();
});

test.beforeEach(async ({ page }) => {
  await page.goto(fixtureUrl);
  await page.waitForFunction(() => Boolean(window.ghostWalkHarness));
});

test("touch joystick and keyboard move at eye height within the ghost bounds", async ({ page }) => {
  const joystick = page.locator(".ghost-joystick:not(.ghost-look-joystick)");
  const box = await joystick.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBe(120);
  expect(box!.height).toBe(120);

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 22, box!.y + box!.height / 2);
  await page.evaluate(() => window.ghostWalkHarness.step());
  const joystickState = await page.evaluate(() => window.ghostWalkHarness.walk.getState());
  expect(joystickState.position[0]).toBeGreaterThan(6);
  expect(joystickState.position[1]).toBe(1.74);
  expect(joystickState.active).toBe(true);
  await page.mouse.up();
  expect(await page.evaluate(() => window.ghostWalkHarness.events.motion)).toEqual([true, false]);

  await page.keyboard.down("ArrowRight");
  await page.evaluate(() => {
    for (let index = 0; index < 240; index++) window.ghostWalkHarness.step();
  });
  await page.keyboard.up("ArrowRight");
  const edgeState = await page.evaluate(() => window.ghostWalkHarness.walk.getState());
  expect(edgeState.position[0]).toBeCloseTo(13.3, 3);
  expect(edgeState.position[1]).toBe(1.74);

  for (const [key, expectedZ] of [["ArrowUp", -0.4], ["ArrowDown", 9.8]] as const) {
    await page.keyboard.down(key);
    await page.evaluate(() => {
      for (let index = 0; index < 240; index++) window.ghostWalkHarness.step();
    });
    await page.keyboard.up(key);
    const state = await page.evaluate(() => window.ghostWalkHarness.walk.getState());
    expect(state.position[2]).toBeCloseTo(expectedZ, 3);
    expect(state.position[0]).toBeCloseTo(13.3, 3);
  }
  await page.keyboard.down("ArrowLeft");
  await page.evaluate(() => {
    for (let index = 0; index < 240; index++) window.ghostWalkHarness.step();
  });
  await page.keyboard.up("ArrowLeft");
  const minX = await page.evaluate(() => window.ghostWalkHarness.walk.getState());
  expect(minX.position[0]).toBeCloseTo(-0.4, 3);
});

test("canvas drag rotates view and a nearby forward target is the only interaction", async ({ page }) => {
  await page.evaluate(() => {
    window.ghostWalkHarness.setTargetPosition([6, 1.74, 3.84]);
    window.ghostWalkHarness.setExtraTargets([{
      id: "nearby-cabinet",
      label: "邻近上柜",
      position: [6.24, 1.74, 4.5],
      activate: () => window.ghostWalkHarness.extraTargets[0].activations++,
      activations: 0,
    }]);
    window.ghostWalkHarness.step(0);
  });
  const button = page.locator(".ghost-interact");
  await expect(button).toBeVisible();
  await expect(button).toHaveText("使用：测试柜门");
  expect(await page.evaluate(() => window.ghostWalkHarness.walk.getState().nearestId)).toBe("test-target");

  await button.click();
  expect(await page.evaluate(() => window.ghostWalkHarness.target.activations)).toBe(1);
  expect(await page.evaluate(() => window.ghostWalkHarness.extraTargets[0].activations)).toBe(0);
  await page.evaluate(() => window.ghostWalkHarness.setExtraTargets([]));

  await page.evaluate(() => window.ghostWalkHarness.setTargetPosition([6, 1.74, 3.2]));
  await page.evaluate(() => window.ghostWalkHarness.step(0));
  await expect(button).toBeHidden();
  expect(await page.evaluate(() => window.ghostWalkHarness.walk.getState().nearestId)).toBeNull();

  await page.evaluate(() => window.ghostWalkHarness.setTargetPosition([6, 1.74, 3.7]));
  await page.evaluate(() => window.ghostWalkHarness.step(0));
  const canvas = page.locator("#scene");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 80, box!.y + box!.height / 2 + 8);
  await page.mouse.up();
  const rotated = await page.evaluate(() => window.ghostWalkHarness.walk.getState());
  expect(rotated.yaw).not.toBeCloseTo(0, 2);
  expect(rotated.pitch).not.toBeCloseTo(0, 2);
  expect(await page.evaluate(() => window.ghostWalkHarness.events.motion)).toEqual([true, false]);
});

test("dual touch sticks move and turn independently, release and blur stop both", async ({ page }) => {
  const left = (await page.locator(".ghost-joystick:not(.ghost-look-joystick)").boundingBox())!;
  const right = (await page.locator(".ghost-look-joystick").boundingBox())!;
  const x1 = left.x + left.width / 2, y1 = left.y + left.height / 2;
  const x2 = right.x + right.width / 2, y2 = right.y + right.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [
    { x: x1, y: y1, id: 1 }, { x: x2, y: y2, id: 2 },
  ] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [
    { x: x1, y: y1 - 35, id: 1 }, { x: x2 + 34, y: y2 - 15, id: 2 },
  ] });
  await page.evaluate(() => { for (let i=0;i<12;i++) window.ghostWalkHarness.step(); });
  const moved = await page.evaluate(() => window.ghostWalkHarness.walk.getState());
  expect(moved.position[2]).toBeLessThan(4.8);
  expect(moved.yaw).toBeGreaterThan(.2);
  expect(moved.pitch).toBeGreaterThan(.1);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const before = await page.evaluate(() => window.ghostWalkHarness.walk.getState());
  await page.evaluate(() => { for (let i=0;i<20;i++) window.ghostWalkHarness.step(); });
  expect(await page.evaluate(() => window.ghostWalkHarness.walk.getState())).toEqual(before);
  await page.keyboard.down("l");
  await page.evaluate(() => { for (let i=0;i<150;i++) window.ghostWalkHarness.step(); });
  await page.keyboard.up("l");
  expect((await page.evaluate(() => window.ghostWalkHarness.walk.getState())).yaw).toBeGreaterThan(before.yaw + 3);
  await page.keyboard.down("i");
  await page.evaluate(() => { for (let i=0;i<150;i++) window.ghostWalkHarness.step(); });
  await page.keyboard.up("i");
  expect((await page.evaluate(() => window.ghostWalkHarness.walk.getState())).pitch).toBeCloseTo(65 * Math.PI / 180);
  await page.keyboard.down("w");
  await page.evaluate(() => dispatchEvent(new Event("blur")));
  await page.keyboard.up("w");
  expect(await page.evaluate(() => window.ghostWalkHarness.step())).toBe(false);
  expect(await page.evaluate(() => window.ghostWalkHarness.events.motion.at(-1))).toBe(false);
});

test("Escape exits, idle updates do not request renders, and dispose removes listeners and UI", async ({ page }) => {
  const before = await page.evaluate(() => window.ghostWalkHarness.events.changes);
  const idleMoved = await page.evaluate(() => window.ghostWalkHarness.step(0.05));
  const after = await page.evaluate(() => window.ghostWalkHarness.events.changes);
  expect(idleMoved).toBe(false);
  expect(after).toBe(before);

  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window.ghostWalkHarness.events.exits)).toBe(1);
  expect(await page.evaluate(() => window.ghostWalkHarness.walk.getState().active)).toBe(false);
  await expect(page.locator(".ghost-exit")).toBeVisible();
  await page.evaluate(() => window.ghostWalkHarness.dispose());
  await expect(page.locator(".ghost-walk-controls")).toHaveCount(0);
  expect(await page.locator("#scene").evaluate((element) => element.classList.contains("ghost-walk-active"))).toBe(false);
});

declare global {
  interface Window {
    ghostWalkHarness: {
      walk: {
        update(dtSeconds: number): boolean;
        getState(): { active: boolean; yaw: number; pitch: number; position: [number, number, number]; nearestId: string | null };
        dispose(): void;
      };
      events: { changes: number; motion: boolean[]; exits: number };
      target: { activations: number };
      extraTargets: Array<{ id: string; label: string; position: [number, number, number]; activations: number }>;
      setTargetPosition(position: [number, number, number]): void;
      setExtraTargets(targets: Array<{ id: string; label: string; position: [number, number, number]; activate: () => void; activations: number }>): void;
      step(dt?: number): boolean;
      dispose(): void;
    };
  }
}
