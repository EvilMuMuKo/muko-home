import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

function parseArgs(argv) {
  const parsed = new Map();
  for (let i = 2; i < argv.length; i++) {
    const [rawKey, inlineValue] = argv[i].split("=", 2);
    if (!rawKey.startsWith("--")) throw new Error(`Unexpected argument: ${rawKey}`);
    const key = rawKey.slice(2);
    const value = inlineValue ?? (argv[i + 1]?.startsWith("--") ? "true" : argv[++i]);
    parsed.set(key, value);
  }
  return parsed;
}

const args = parseArgs(process.argv);
const baseURL = args.get("base-url") ?? args.get("url");
if (!baseURL) throw new Error("Pass --base-url=http://127.0.0.1:4173");
const outputDir = resolve(
  args.get("output-dir") ?? args.get("out-dir") ?? "../../outputs/whole-home-walk-audit",
);
const reportPath = resolve(outputDir, "whole-home-walk-audit.json");
const screenshotDir = resolve(outputDir, "screenshots");
const executablePath =
  process.env.CHROMIUM_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

await mkdir(screenshotDir, { recursive: true });

const report = {
  capturedAt: new Date().toISOString(),
  baseURL,
  viewport: { width: 960, height: 540, deviceScaleFactor: 1 },
  status: "FAIL",
  method:
    "One real Playwright Chromium first-person session. Opens modeled interior doors, plans over the live navigation snapshot, simplifies routes by line of sight, then walks each segment with real W key input and a slow joystick final approach and checks the camera position.",
  scope:
    "Browser-rendered model navigation and visible interaction only. This does not establish measured as-built clearances, physical phone performance, or full-scale ergonomics.",
  api: {},
  doors: [],
  route: [],
  rooms: [],
  interaction: null,
  screenshots: [],
  pageErrors: [],
  resourceFailures: [],
  performance: {},
  warnings: [],
};

const rooms = [
  { id: "dining", label: "阅读水吧", goal: [3.2, 6.4], mainDirection: "north" },
  { id: "kitchen", label: "厨房", goal: [2.0, 4.8], mainDirection: "east" },
  { id: "hall", label: "走廊", goal: [5.8, 3.2], mainDirection: "north" },
  { id: "cinema", label: "影音室", goal: [2.8, 2.4], mainDirection: "east" },
  { id: "bath", label: "卫浴", goal: [5.6, 1.45], mainDirection: "north" },
  { id: "master", label: "主卧", goal: [8, 2.7], mainDirection: "east" },
  { id: "living", label: "客厅", goal: [9.2, 7.5], mainDirection: "north" },
  { id: "balcony", label: "阳台", goal: [12.1, 7.5], mainDirection: "east" },
];
const viewDirections = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
};
const gridStep = 0.1;
const movementPollMs = 100;
const personRadius = 0.22;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function pointSegmentDistance(point, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(point[0] - (a[0] + dx * t), point[1] - (a[1] + dz * t));
}

function insidePolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      (a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

function polygonDistance(point, polygon) {
  let nearest = Infinity;
  for (let i = 0; i < polygon.length; i++)
    nearest = Math.min(nearest, pointSegmentDistance(point, polygon[i], polygon[(i + 1) % polygon.length]));
  return nearest;
}

function normalizeSnapshot(raw) {
  if (!raw || !Array.isArray(raw.shell) || !Array.isArray(raw.polygons))
    throw new Error("getWalkNavigationSnapshot() must return { radiusM, shell, polygons }");
  const validPolygon = (poly) =>
    Array.isArray(poly) && poly.length >= 3 && poly.every((point) => Array.isArray(point) && point.length >= 2 && point.slice(0, 2).every(Number.isFinite));
  if (!validPolygon(raw.shell) || raw.polygons.some((poly) => !validPolygon(poly)))
    throw new Error("Navigation snapshot contains malformed shell or obstacle polygons");
  return {
    radiusM: Number.isFinite(raw.radiusM) ? raw.radiusM : personRadius,
    shell: raw.shell.map((p) => p.slice(0, 2)),
    polygons: raw.polygons.map((poly) => poly.map((p) => p.slice(0, 2))),
  };
}

function buildPlanner(snapshot) {
  const shell = snapshot.shell;
  const polygons = snapshot.polygons;
  const radius = snapshot.radiusM;
  const minX = Math.min(...shell.map((p) => p[0]));
  const maxX = Math.max(...shell.map((p) => p[0]));
  const minZ = Math.min(...shell.map((p) => p[1]));
  const maxZ = Math.max(...shell.map((p) => p[1]));
  const pointSafe = (point) => {
    if (!insidePolygon(point, shell) || polygonDistance(point, shell) < radius - 1e-5) return false;
    for (const polygon of polygons) {
      if (insidePolygon(point, polygon) || polygonDistance(point, polygon) < radius - 1e-5) return false;
    }
    return true;
  };
  const segmentSafe = (a, b) => {
    const count = Math.max(1, Math.ceil(distance(a, b) / 0.045));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      if (!pointSafe([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) return false;
    }
    return true;
  };
  const toCell = ([x, z]) => [Math.round((x - minX) / gridStep), Math.round((z - minZ) / gridStep)];
  const fromCell = ([x, z]) => [minX + x * gridStep, minZ + z * gridStep];
  const keyOf = ([x, z]) => `${x},${z}`;
  const maxCellX = Math.ceil((maxX - minX) / gridStep);
  const maxCellZ = Math.ceil((maxZ - minZ) / gridStep);
  const cellSafe = (cell) => {
    if (cell[0] < 0 || cell[1] < 0 || cell[0] > maxCellX || cell[1] > maxCellZ) return false;
    return pointSafe(fromCell(cell));
  };
  const neighbors = [
    [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
    [-1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [1, 1, Math.SQRT2],
  ];
  function findNearestSafePoint(target, limit = 1.6) {
    if (pointSafe(target)) return target;
    let best = null;
    const steps = Math.ceil(limit / gridStep);
    const base = toCell(target);
    for (let ring = 1; ring <= steps; ring++) {
      for (let x = -ring; x <= ring; x++) {
        for (const z of [-ring, ring]) {
          const p = fromCell([base[0] + x, base[1] + z]);
          const d = distance(p, target);
          if (d <= limit && pointSafe(p) && (!best || d < best.distance)) best = { point: p, distance: d };
        }
      }
      for (let z = -ring + 1; z < ring; z++) {
        for (const x of [-ring, ring]) {
          const p = fromCell([base[0] + x, base[1] + z]);
          const d = distance(p, target);
          if (d <= limit && pointSafe(p) && (!best || d < best.distance)) best = { point: p, distance: d };
        }
      }
      if (best && best.distance < ring * gridStep) return best.point;
    }
    return best?.point ?? null;
  }
  function findNearestClearGridStart(start, limit = 0.3) {
    const base = toCell(start);
    const searchSteps = Math.ceil(limit / gridStep) + 1;
    const candidates = [];
    for (let dx = -searchSteps; dx <= searchSteps; dx++) {
      for (let dz = -searchSteps; dz <= searchSteps; dz++) {
        const cell = [base[0] + dx, base[1] + dz];
        const point = fromCell(cell);
        const offset = distance(point, start);
        if (offset > limit || !cellSafe(cell) || !segmentSafe(start, point)) continue;
        candidates.push({ cell, point, offset });
      }
    }
    candidates.sort((a, b) => a.offset - b.offset);
    return candidates[0] ?? null;
  }
  function plan(start, requestedGoal, goalRadius = 0.3) {
    if (!pointSafe(start))
      return { ok: false, actualStartUnsafe: true, reason: "actual camera start is outside the navigable shell or overlaps an obstacle", start, requestedGoal };
    const safeGridStart = findNearestClearGridStart(start, 0.3);
    if (!safeGridStart)
      return { ok: false, reason: "no collision-clear safe grid start within 0.3m of the actual camera start", start, requestedGoal };
    const startCell = safeGridStart.cell;
    const startPoint = safeGridStart.point;

    const startKey = keyOf(startCell);
    const gScore = new Map([[startKey, 0]]);
    const previous = new Map();
    const cellByKey = new Map([[startKey, startCell]]);
  const heap = [];
  const push = (item) => {
    heap.push(item);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heap[parent].f <= item.f) break;
      heap[index] = heap[parent];
      index = parent;
    }
    heap[index] = item;
  };
  const pop = () => {
    if (!heap.length) return null;
    const first = heap[0];
    const last = heap.pop();
    if (heap.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= heap.length) break;
        let child = right < heap.length && heap[right].f < heap[left].f ? right : left;
        if (heap[child].f >= last.f) break;
        heap[index] = heap[child];
        index = child;
      }
      heap[index] = last;
    }
    return first;
  };
  push({ key: startKey, g: 0, f: Math.max(0, distance(startPoint, requestedGoal) - goalRadius) });
    const goalCellWithin = (point) => distance(point, requestedGoal) <= goalRadius;
    let foundKey = goalCellWithin(startPoint) ? startKey : null;
    let expanded = 0;
    while (!foundKey && heap.length) {
      const currentEntry = pop();
      const bestKey = currentEntry.key;
      if (currentEntry.g !== gScore.get(bestKey)) continue;
      const current = cellByKey.get(bestKey);
      expanded++;
      if (expanded > 120_000) return { ok: false, reason: "A* expansion cap exceeded", expanded, start, requestedGoal };
      const currentPoint = fromCell(current);
      if (goalCellWithin(currentPoint)) { foundKey = bestKey; break; }
      const currentG = gScore.get(bestKey);
      for (const [dx, dz, multiplier] of neighbors) {
        const next = [current[0] + dx, current[1] + dz];
        if (!cellSafe(next)) continue;
        if (dx && dz && (!cellSafe([current[0] + dx, current[1]]) || !cellSafe([current[0], current[1] + dz]))) continue;
        const nextPoint = fromCell(next);
        if (!segmentSafe(currentPoint, nextPoint)) continue;
        const nextKey = keyOf(next);
        const tentative = currentG + gridStep * multiplier;
        if (tentative >= (gScore.get(nextKey) ?? Infinity)) continue;
        previous.set(nextKey, bestKey);
        gScore.set(nextKey, tentative);
        cellByKey.set(nextKey, next);
        push({ key: nextKey, g: tentative, f: tentative + Math.max(0, distance(nextPoint, requestedGoal) - goalRadius) });
      }
    }
    if (!foundKey) return { ok: false, reason: "no navigable path to a safe cell near room target", expanded, start, requestedGoal };
    const cells = [cellByKey.get(foundKey)];
    let cursor = foundKey;
    while (cursor !== startKey) {
      cursor = previous.get(cursor);
      if (!cursor) return { ok: false, reason: "broken A* predecessor chain", expanded };
      cells.push(cellByKey.get(cursor));
    }
    cells.reverse();
    const gridRaw = cells.map(fromCell);
    const gridPoints = [gridRaw[0]];
    let anchor = 0;
    while (anchor < gridRaw.length - 1) {
      let farthest = gridRaw.length - 1;
      while (farthest > anchor + 1 && !segmentSafe(gridRaw[anchor], gridRaw[farthest])) farthest--;
      gridPoints.push(gridRaw[farthest]);
      anchor = farthest;
    }
    // Keep the actual camera point and the chosen safe grid start as distinct
    // physical waypoints so the first segment is collision-checked and walked.
    const points = [start];
    if (distance(start, startPoint) > 1e-6) points.push(startPoint);
    points.push(...gridPoints.slice(1));
    return {
      ok: true,
      start,
      gridStart: startPoint,
      requestedGoal,
      reachedGoal: points.at(-1),
      goalOffsetM: distance(points.at(-1), requestedGoal),
      expanded,
      gridNodes: cells.length,
      points,
    };
  }
  return { pointSafe, segmentSafe, findNearestSafePoint, plan };
}

function stats(values) {
  if (!values.length) return { samples: 0, p50: null, p95: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: values.length,
    p50: sorted[Math.floor((sorted.length - 1) * 0.5)],
    p95: sorted[Math.floor((sorted.length - 1) * 0.95)],
    max: Math.max(...values),
  };
}

const launchArgs = ["--no-sandbox", "--disable-dev-shm-usage"];
if (process.env.SOFTWARE_GPU === "1")
  launchArgs.push("--use-angle=swiftshader", "--enable-unsafe-swiftshader");
const browser = await chromium.launch({ executablePath, args: launchArgs });

try {
  const context = await browser.newContext({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") report.pageErrors.push(`console: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      report.resourceFailures.push({ status: response.status(), url: response.url() });
  });
  await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(() => window.homePresentation?.getState().ready, null, { timeout: 180_000 });
  await page.waitForFunction(() => window.homePresentation?.getGhostWalkState()?.active, null, { timeout: 30_000 });
  await page.evaluate(()=>window.homePresentation.whenVisualReady?.());

  const apiStatus = await page.evaluate(() => {
    const api = window.homePresentation;
    return {
      navigationSnapshot: typeof api.getWalkNavigationSnapshot === "function",
      lookTarget: typeof api.setWalkLookTarget === "function",
      active: api.getGhostWalkState()?.active,
      camera: api.getCamera()?.position ?? null,
    };
  });
  report.api = apiStatus;
  assert(apiStatus.navigationSnapshot, "getWalkNavigationSnapshot() API is required");
  assert(apiStatus.lookTarget, "setWalkLookTarget([x,y,z]) API is required");
  assert(apiStatus.active, "default arrival must already be in first-person walk mode");
  assert(apiStatus.camera, "first-person camera is unavailable");
  report.initialPosition = apiStatus.camera;
  const beforeLook = await page.evaluate(() => window.homePresentation.getCamera().position);
  await page.evaluate(p => window.homePresentation.setWalkLookTarget([p[0] + 1, p[1], p[2]]), beforeLook);
  const afterLook = await page.evaluate(() => window.homePresentation.getCamera().position);
  report.lookChangesPosition = beforeLook.some((v, i) => v !== afterLook[i]);
  assert.equal(report.lookChangesPosition, false, "look helper must never teleport the player");
  report.runtime = await page.evaluate(() => {
    const api = window.homePresentation;
    const performance = api.getPerformance();
    return {
      userAgent: navigator.userAgent,
      renderer: api.getState().renderer,
      rendering: performance.rendering,
      wasmBackend: performance.geometry?.backend ?? null,
      geometry: performance.geometry,
      qualityProfile: performance.qualityProfile,
    };
  });
  report.runtime.softwareGpuForced = process.env.SOFTWARE_GPU === "1";

  const doorReady = async (id) => {
    if (id === "guest-door")
      return page.evaluate(() => window.homePresentation.getAtmosphereDesign()?.doorOpen === true);
    if (id === "kitchen-door")
      return page.evaluate(() => window.homePresentation.getState().kitchenProgress > 0.99);
    const model = await page.evaluate(() => window.homePresentation.getModel());
    const opening = model.openings.find((item) => item.id === id);
    if (!opening) return false;
    const target = -((opening.rotation || 0) + (opening.openAngle || 0)) * Math.PI / 180;
    const angle = await page.evaluate((doorId) => window.homePresentation.getWalkDoorStates()[doorId], id);
    return Number.isFinite(angle) && Math.abs(angle - target) < 0.003;
  };
  for (const id of ["master-door", "guest-door", "bath-door", "kitchen-door"]) {
    await page.evaluate((doorId) => window.homePresentation.setWalkDoorOpen(doorId, true), id);
    try {
      await page.waitForFunction((doorId) => {
        const api = window.homePresentation;
        if (doorId === "guest-door") return api.getAtmosphereDesign()?.doorOpen === true;
        if (doorId === "kitchen-door") return api.getState().kitchenProgress > 0.99;
        const model = api.getModel();
        const opening = model.openings.find((item) => item.id === doorId);
        const angle = api.getWalkDoorStates()[doorId];
        const target = -((opening?.rotation || 0) + (opening?.openAngle || 0)) * Math.PI / 180;
        return Number.isFinite(angle) && Math.abs(angle - target) < 0.003;
      }, id, { timeout: 45_000, polling: 100 });
      if (id === "guest-door") {
        let previousAngle = null;
        let stableSamples = 0;
        const stableDeadline = Date.now() + 15_000;
        while (Date.now() < stableDeadline && stableSamples < 4) {
          const angle = await page.evaluate((doorId) => window.homePresentation.getWalkDoorStates()[doorId], id);
          if (!Number.isFinite(angle)) break;
          stableSamples = previousAngle !== null && Math.abs(angle - previousAngle) < 0.001 ? stableSamples + 1 : 0;
          previousAngle = angle;
          await page.waitForTimeout(150);
        }
        report.doors.push({ id: "guest-door-angle", stableSamples, angle: previousAngle, observable: Number.isFinite(previousAngle), pass: !Number.isFinite(previousAngle) || stableSamples >= 4 });
        if (Number.isFinite(previousAngle) && stableSamples < 4)
          throw new Error("Guest door angle did not settle after open state was reported");
      }
      report.doors.push({ id, pass: true, state: await page.evaluate((doorId) => ({ angle: window.homePresentation.getWalkDoorStates()[doorId], kitchenProgress: window.homePresentation.getState().kitchenProgress, atmosphere: window.homePresentation.getAtmosphereDesign() }), id) });
    } catch (error) {
      report.doors.push({ id, pass: false, error: String(error), readyCheck: await doorReady(id) });
      throw new Error(`Door did not reach open state: ${id}`);
    }
  }

  const rawSnapshot = await page.evaluate(() => window.homePresentation.getWalkNavigationSnapshot());
  const snapshot = normalizeSnapshot(rawSnapshot);
  report.navigationSnapshot = {
    radiusM: snapshot.radiusM,
    shellVertexCount: snapshot.shell.length,
    polygonCount: snapshot.polygons.length,
    shell: snapshot.shell,
    polygons: snapshot.polygons,
  };
  let planner = buildPlanner(snapshot);

  const cameraPosition = () => page.evaluate(() => window.homePresentation.getCamera().position);
  const lookAt = async (point) => {
    await page.evaluate((target) => window.homePresentation.setWalkLookTarget(target), point);
  };
  const saveScreenshot = async (name, roomId = null, direction = null) => {
    await page.waitForFunction(() => !window.homePresentation.getPerformance().pending, null, { timeout: 30_000, polling: 100 }).catch(() => {});
    const path = resolve(screenshotDir, `${name}.png`);
    await page.screenshot({ path, animations: "disabled" });
    report.screenshots.push({ name, path, roomId, direction, camera: await cameraPosition() });
    return path;
  };

  const waitForFridgeAndCollisionSettle = async () => {
    let previous = null;
    let stableSamples = 0;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline && stableSamples < 4) {
      const sample = await page.evaluate(() => ({
        angle: window.homePresentation.getState().fridgeAngle,
        position: window.homePresentation.getCamera().position,
      }));
      const stable = previous && Math.abs(sample.angle - previous.angle) < 0.001 &&
        Math.hypot(sample.position[0] - previous.position[0], sample.position[2] - previous.position[2]) < 0.005;
      stableSamples = stable ? stableSamples + 1 : 0;
      previous = sample;
      if (stableSamples < 4) await page.waitForTimeout(150);
    }
    return { stableSamples, settled: stableSamples >= 4 };
  };

  const walkTo = async (goal, label, roomRecord) => {
    await page.evaluate(()=>window.homePresentation.whenVisualReady?.());
    const before = await cameraPosition();
    let settledStart = [before[0], before[2]];
    let fresh = normalizeSnapshot(await page.evaluate(() => window.homePresentation.getWalkNavigationSnapshot()));
    planner = buildPlanner(fresh);
    let route = planner.plan(settledStart, goal, 0.32);
    const initialPlanning = route;
    let unsafeStartRetry = null;
    if (!route.ok && route.actualStartUnsafe) {
      unsafeStartRetry = await waitForFridgeAndCollisionSettle();
      const settledCamera = await cameraPosition();
      settledStart = [settledCamera[0], settledCamera[2]];
      fresh = normalizeSnapshot(await page.evaluate(() => window.homePresentation.getWalkNavigationSnapshot()));
      planner = buildPlanner(fresh);
      route = planner.plan(settledStart, goal, 0.32);
    }
    const routeRecord = {
      label,
      start: before,
      requestedGoal: goal,
      planning: route,
      ...(unsafeStartRetry ? { initialPlanning, unsafeStartRetry } : {}),
      pass: false,
      segments: [],
    };
    report.route.push(routeRecord);
    if (!route.ok) {
      routeRecord.actualPosition = await cameraPosition();
      routeRecord.failure = route.reason;
      return false;
    }
    for (let i = 1; i < route.points.length; i++) {
      const target = route.points[i];
      const current = await cameraPosition();
      const dx = target[0] - current[0];
      const dz = target[1] - current[2];
      const length = Math.hypot(dx, dz);
      if (length < 0.005) continue;
      await lookAt([target[0], 1.74, target[1]]);
      const segment = {
        from: current,
        target,
        distanceM: length,
        timeoutMs: Math.min(180_000, Math.max(60_000, Math.ceil(length * 45_000))),
      };
      const began = Date.now();
      let fineJoystick = false;
      await page.keyboard.down("w");
      try {
        let lastProgressAt = Date.now();
        let bestDistance = length;
        while (Date.now() - began < segment.timeoutMs) {
          const position = await cameraPosition();
          const remaining = Math.hypot(target[0] - position[0], target[1] - position[2]);
          if (remaining < 0.03) {
            await page.keyboard.up("w");
            break;
          }
          if (remaining < 0.2 && !fineJoystick) {
            await page.keyboard.up("w");
            const cx = 180, cy = 400, id = 77;
            await cdp.send("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[{x:cx,y:cy,id}]});
            const bounds = await page.locator(".ghost-joystick--floating:not(.ghost-look-joystick)").boundingBox();
            if(!bounds) throw new Error("floating movement stick did not appear at the touch point");
            await cdp.send("Input.dispatchTouchEvent", {type:"touchMove",touchPoints:[{x:cx,y:cy-bounds.width*.1,id}]});
            fineJoystick = true;
            segment.finalApproach = "real floating touch joystick at 20 percent travel";
          }
          if (remaining < bestDistance - 0.015) {
            bestDistance = remaining;
            lastProgressAt = Date.now();
          }
          if (Date.now() - lastProgressAt > 6000) throw new Error("stalled for 6s; no continued wall-pushing");
          // Re-aim from the actual camera after every sample, including collision slides.
          await lookAt([target[0], 1.74, target[1]]);
          await page.waitForTimeout(remaining < 0.16 ? 20 : 65);
        }
        const finalPosition = await cameraPosition();
        if (Math.hypot(target[0] - finalPosition[0], target[1] - finalPosition[2]) >= 0.055)
          throw new Error("waypoint did not converge within 55mm");
        segment.pass = true;
      } catch (error) {
        segment.failure = String(error);
      } finally {
        await page.keyboard.up("w");
        if (fineJoystick) await cdp.send("Input.dispatchTouchEvent", {type:"touchEnd",touchPoints:[]});
      }
      segment.elapsedMs = Date.now() - began;
      segment.actual = await cameraPosition();
      segment.progressM = Math.hypot(segment.actual[0] - current[0], segment.actual[2] - current[2]);
      routeRecord.segments.push(segment);
      if (!segment.pass) {
        routeRecord.failure = "movement did not reach the planned waypoint";
        routeRecord.actualPosition = segment.actual;
        if (roomRecord) roomRecord.failure = routeRecord.failure;
        return false;
      }
    }
    routeRecord.actualPosition = await cameraPosition();
    routeRecord.finalErrorM = distance([routeRecord.actualPosition[0], routeRecord.actualPosition[2]], route.reachedGoal);
    routeRecord.requestedGoalErrorM = distance([routeRecord.actualPosition[0], routeRecord.actualPosition[2]], goal);
    routeRecord.allowedGoalRadiusM = 0.38;
    routeRecord.pass = routeRecord.finalErrorM <= 0.055 && routeRecord.requestedGoalErrorM <= 0.38;
    if (!routeRecord.pass) routeRecord.failure = "camera ended outside the 55mm waypoint / 380mm semantic room-goal tolerance";
    return routeRecord.pass;
  };

  const routeStart = await cameraPosition();
  report.performance.beforeWalk = await page.evaluate(() => window.homePresentation.getPerformance());
  let interactionDone = false;
  let publicDayShot = false;
  for (const room of rooms) {
    const roomRecord = { ...room, status: "FAIL", start: await cameraPosition(), screenshots: [], routeIndex: report.route.length };
    report.rooms.push(roomRecord);
    const reached = await walkTo(room.goal, `${room.id}-room-goal`, roomRecord);
    roomRecord.actual = await cameraPosition();
    if (!reached) {
      roomRecord.status = "FAIL";
      roomRecord.failure ??= report.route.at(-1)?.failure ?? "route planning failed";
      break;
    }
    const semanticRoom = ({dining:"bar",cinema:"guest"})[room.id] ?? room.id;
    const roomPolygon = await page.evaluate(id => window.homePresentation.getModel().rooms.find(r => r.id === id)?.polygon, semanticRoom);
    assert(insidePolygon([roomRecord.actual[0], roomRecord.actual[2]], roomPolygon), "room goal must remain inside its actual room polygon");
    roomRecord.status = "PASS";

    if (room.id === "kitchen" && !interactionDone) {
      const model = await page.evaluate(() => window.homePresentation.getModel());
      const fridge = model.objects.find((item) => item.id === "kitchen-fridge");
      if (fridge) {
        const normal = ({"+x":[1,0],"-x":[-1,0],"+z":[0,1],"-z":[0,-1]})[fridge.accessFace] ?? [0,1];
        const front = [fridge.x+normal[0]*.95,fridge.z+normal[1]*.95];
        const tangent=[-normal[1],normal[0]];
        const candidates = [
          front,
          [front[0]+tangent[0]*.3,front[1]+tangent[1]*.3],
          [front[0]-tangent[0]*.3,front[1]-tangent[1]*.3],
        ];
        const safeCandidates = candidates.filter((p) => planner.pointSafe(p));
        let interactionPosition = safeCandidates.sort((a, b) => distance([roomRecord.actual[0], roomRecord.actual[2]], a) - distance([roomRecord.actual[0], roomRecord.actual[2]], b))[0] ?? planner.findNearestSafePoint(front, 0.9);
        if (interactionPosition && await walkTo(interactionPosition, "kitchen-fridge-interaction-approach", roomRecord)) {
          await lookAt([fridge.x, 1.15, fridge.z]);
          try {
            await page.waitForFunction(() => {
              const button = document.querySelector(".ghost-interact");
              return button && !button.hidden && button.dataset.targetId === "walk-fridge";
            }, null, { timeout: 5_000, polling: 100 });
            const beforeInteraction = await page.evaluate(() => ({
              state: window.homePresentation.getState(),
              buttonText: document.querySelector(".ghost-interact")?.textContent,
              position: window.homePresentation.getCamera().position,
            }));
            await page.locator(".ghost-interact").click();
            await page.waitForFunction((oldAngle) => Math.abs(window.homePresentation.getState().fridgeAngle - oldAngle) > 0.05, beforeInteraction.state.fridgeAngle, { timeout: 15_000, polling: 100 });
            const afterInteraction = await page.evaluate(() => ({ state: window.homePresentation.getState(), position: window.homePresentation.getCamera().position }));
            report.interaction = {
              id: "walk-fridge",
              label: beforeInteraction.buttonText,
              pass: true,
              interactionDistanceM: Math.hypot(fridge.x-beforeInteraction.position[0], fridge.z-beforeInteraction.position[2]),
              maximumTargetDistanceM: 1.6,
              before: { fridgeAngle: beforeInteraction.state.fridgeAngle, position: beforeInteraction.position },
              after: { fridgeAngle: afterInteraction.state.fridgeAngle, position: afterInteraction.position },
            };
            assert(report.interaction.interactionDistanceM <= 1.6, "fridge interaction must be nearby");
            interactionDone = true;
          } catch (error) {
            report.interaction = {
              id: "walk-fridge",
              pass: false,
              failure: String(error),
              position: await cameraPosition(),
              targetButton: await page.locator(".ghost-interact").evaluate((el) => ({ hidden: el.hidden, targetId: el.dataset.targetId ?? null, text: el.textContent })).catch(() => null),
            };
          }
        }
      }
    }

    const sweepNames = [];
    for (const direction of ["north", "east", "south", "west"]) {
      const vector = viewDirections[direction];
      const actual = await cameraPosition();
      await lookAt([actual[0] + vector[0], 1.74, actual[2] + vector[1]]);
      await page.waitForTimeout(180);
      const path = await saveScreenshot(`${room.id}-${direction}`, room.id, direction);
      sweepNames.push(path);
    }
    const mainIndex = ["north", "east", "south", "west"].indexOf(room.mainDirection);
    const mainPath = resolve(screenshotDir, `${room.id}-main.png`);
    const mainVector = viewDirections[room.mainDirection];
    const mainCamera = await cameraPosition();
    await lookAt([mainCamera[0] + mainVector[0], 1.74, mainCamera[2] + mainVector[1]]);
    await page.waitForTimeout(180);
    await page.screenshot({ path: mainPath, animations: "disabled" });
    report.screenshots.push({ name: `${room.id}-main`, path: mainPath, roomId: room.id, direction: room.mainDirection, camera: await cameraPosition() });
    roomRecord.screenshots = { sweep: sweepNames, main: mainPath, selectedSweepIndex: mainIndex };

    if (room.id === "living" && !publicDayShot) {
      for (const [lighting, name] of [["day-public", "public-area-day"], ["aperitif", "public-area-night"]]) {
        await page.evaluate((preset) => window.homePresentation.setLightingScene(preset), lighting);
        await page.waitForTimeout(300);
        const camera = await cameraPosition();
        await lookAt([camera[0], 1.74, camera[2] - 1]);
        await page.waitForTimeout(180);
        const path = await saveScreenshot(name, "living", "north");
        roomRecord.publicLighting ??= {};
        roomRecord.publicLighting[lighting] = path;
      }
      await page.evaluate(() => window.homePresentation.setLightingScene("day-public"));
      publicDayShot = true;
    }
  }

  if (!report.interaction) report.interaction = { id: "walk-fridge", pass: false, failure: "kitchen was not reached or no safe interaction approach was found" };
  if (!publicDayShot) report.warnings.push("Public-area day/night captures were not produced because the living room was not reached.");
  if (!interactionDone) report.warnings.push("The near-object interaction was not confirmed.");

  const finalPosition = await cameraPosition();
  const afterWalkPerf = await page.evaluate(() => window.homePresentation.getPerformance());
  report.performance.afterWalk = afterWalkPerf;
  report.performance.navigation = {
    start: routeStart,
    end: finalPosition,
    segments: report.route.flatMap((r) => r.segments ?? []),
    frameMs: stats(afterWalkPerf.frameMs ?? []),
    renderMs: stats(afterWalkPerf.renderMs ?? []),
    frameCount: afterWalkPerf.frames ?? null,
    renderCount: afterWalkPerf.renders ?? null,
    idleCheck: null,
  };
  const idleStart = afterWalkPerf.renders ?? 0;
  await page.waitForTimeout(1_200);
  const afterIdle = await page.evaluate(() => window.homePresentation.getPerformance());
  report.performance.navigation.idleCheck = {
    durationMs: 1200,
    rendersBefore: idleStart,
    rendersAfter: afterIdle.renders ?? null,
    renderDelta: Number.isFinite(afterIdle.renders) ? afterIdle.renders - idleStart : null,
    pending: afterIdle.pending ?? null,
  };
  report.pageErrors = [...new Set(report.pageErrors)];
  report.resourceFailures = [...new Map(report.resourceFailures.map((item) => [`${item.status}:${item.url}`, item])).values()];
  const allRoomsPassed = rooms.every((room) => report.rooms.find((item) => item.id === room.id)?.status === "PASS");
  report.acceptance = {
    allRoomsPassed,
    interactionDone,
    publicDayShot,
    pageErrorsClear: report.pageErrors.length === 0,
    resourcesClear: report.resourceFailures.length === 0,
    webgpu: report.runtime?.renderer === "WebGPU",
    wasm: report.runtime?.wasmBackend === "wasm",
  };
  report.status = Object.values(report.acceptance).every(Boolean) ? "PASS" : "FAIL";
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.failurePosition = await pagePositionSafe(browser).catch(() => null);
} finally {
  await browser.close();
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    status: report.status,
    reportPath,
    screenshotCount: report.screenshots.length,
    rooms: report.rooms.map(({ id, status, actual, failure }) => ({ id, status, actual, failure })),
    interaction: report.interaction,
    pageErrors: report.pageErrors,
    resourceFailures: report.resourceFailures.length,
    error: report.error,
  }, null, 2));
  if (report.status !== "PASS") process.exitCode = 1;
}

async function pagePositionSafe(browserInstance) {
  const pages = browserInstance.contexts().flatMap((context) => context.pages());
  const activePage = pages[0];
  if (!activePage) return null;
  return activePage.evaluate(() => window.homePresentation?.getCamera()?.position ?? null);
}
