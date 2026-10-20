import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;
let model: any;
let electrical: any;

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ finalModel: model } = await server.ssrLoadModule("/src/final-design.ts"));
  electrical = await server.ssrLoadModule("/src/electrical-mesh.ts");
});

test.afterAll(async () => {
  await server?.close();
});

function materials() {
  const m = new THREE.MeshBasicMaterial();
  return new Proxy({ oak: m } as Record<string, THREE.Material>, {
    get: (o, k) => o[String(k)] || m,
  });
}

const points = () => model.homeDesign.electrical.points as any[];
const fixtures = () => model.lighting.fixtures as any[];
const switches = () => points().filter((p) => p.kind === "switch");

test("R6 adds one wall-switch point per controlled zone with concept-only status", () => {
  expect(model.version).toBe("16.0.0");
  expect(switches()).toHaveLength(16);
  for (const s of switches()) {
    expect(s.status).toBe("PROPOSED");
    expect(s.modelDisplay).toBe(true);
    expect(s.switch.conceptOnly).toBe(true);
    expect(s.switch.keys).toBeGreaterThanOrEqual(1);
    expect(s.switch.keys).toBeLessThanOrEqual(4);
    expect(Array.isArray(s.switch.controls)).toBe(true);
    expect(s.switch.controls.length).toBeGreaterThan(0);
    expect(s.heightM === 1.2 || s.heightM === 0.7).toBe(true);
  }
});

test("R6 switch controls only reference fixtures that exist", () => {
  const ids = new Set(fixtures().map((f) => f.id));
  const missing: string[] = [];
  for (const s of switches()) {
    for (const c of s.switch.controls) {
      if (!ids.has(c)) missing.push(`${s.id}->${c}`);
    }
  }
  expect(missing).toEqual([]);
});

test("R6 dual-control pairs are symmetric and point at real switches", () => {
  const byId = new Map(switches().map((s) => [s.id, s]));
  const pairs = switches().filter((s) => s.switch.dualControlOf);
  expect(pairs.length).toBe(6);
  for (const s of pairs) {
    const other = byId.get(s.switch.dualControlOf);
    expect(other, `${s.id} dual target missing`).toBeTruthy();
    expect(other!.switch.dualControlOf).toBe(s.id);
  }
});

test("R6 electrical renderer keeps the 30 draw-call budget and renders switch rooms", () => {
  const scene = new THREE.Scene();
  const report = electrical.buildElectrical(scene, model, materials());
  expect(report.drawCalls).toBeLessThanOrEqual(30);
  expect(report.switches).toBe(16);
  // sockets are still counted separately from switches
  const socketProposed = points().filter((p) => p.kind === "socket" && p.status === "PROPOSED").length;
  expect(report.wallPowerGroups).toBe(socketProposed);

  const root = scene.getObjectByName("electrical:root")!;
  const switchRooms = [...new Set(switches().map((s) => s.room))];
  for (const room of switchRooms) {
    expect(root.getObjectByName(`electrical-${room}`), `missing group for ${room}`).toBeTruthy();
  }
  expect(report.groups.filter((g: any) => g.kind === "switch")).toHaveLength(16);
});

test("R6 lighting fixtures carry concept illuminance and colour-rendering targets", () => {
  const fixturesList = fixtures();
  expect(fixturesList.length).toBeGreaterThan(40);
  for (const f of fixturesList) {
    expect(f.targetLux).toBeGreaterThan(0);
    expect(f.criMin).toBe(90);
    expect(f.qualityStatus).toBe("concept_target_not_photometric_acceptance");
    expect(typeof f.glareNote).toBe("string");
    expect(f.glareNote.length).toBeGreaterThan(10);
  }
  const desk = fixturesList.filter((f) => f.id === "pc-desk-task" || f.id === "mac-desk-task");
  expect(desk).toHaveLength(2);
  expect(desk.every((f) => f.targetLux >= 500)).toBe(true);
  const night = fixturesList.filter((f) => f.group === "night");
  expect(night.length).toBeGreaterThan(0);
  expect(night.every((f) => f.targetLux <= 20)).toBe(true);
});

test("R6 weak-current topology records convergence rules without claiming a survey", () => {
  const topo = model.homeDesign.electrical.weakCurrentTopology;
  expect(topo).toBeTruthy();
  expect(topo.scope).toBe("concept_only_not_surveyed");
  expect(topo.nodes.length).toBeGreaterThanOrEqual(5);
  expect(topo.rules.length).toBeGreaterThanOrEqual(4);
  const types = topo.nodes.map((n: any) => n.type);
  expect(types).toContain("ont");
  expect(types).toContain("switch");
  expect(types).toContain("ap");
  expect(topo.rules.join(" ")).toContain("星型不串接");
  const covered = topo.nodes.filter((n: any) => n.coverageRule);
  expect(covered.length).toBeGreaterThanOrEqual(2);
  expect(covered.every((n: any) => n.coverageRule.includes("只穿一堵墙"))).toBe(true);
});
