import { expect, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import * as THREE from "three";

let server: ViteDevServer,
  model: any,
  panels: (o: any) => any[],
  buildGlazing: any,
  createCollision: any;
test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ finalModel: model } = await server.ssrLoadModule("/src/final-design.ts"));
  ({ r2CabinetPanels: panels } = await server.ssrLoadModule(
    "/src/r2-cabinet-mesh.ts",
  ));
  ({ buildR2Glazing: buildGlazing } =
    await server.ssrLoadModule("/src/r2-glazing.ts"));
  ({ createWalkCollision: createCollision } = await server.ssrLoadModule(
    "/src/walk-collision.ts",
  ));
});
test.afterAll(async () => {
  await server?.close();
});
const get = (id: string) => model.objects.find((o: any) => o.id === id);
function bounds(o: any) {
  const a = ((o.rotation || 0) * Math.PI) / 180,
    c = Math.abs(Math.cos(a)),
    s = Math.abs(Math.sin(a));
  return new THREE.Box3(
    new THREE.Vector3(
      o.x - (o.w * c + o.d * s) / 2,
      o.y || 0,
      o.z - (o.d * c + o.w * s) / 2,
    ),
    new THREE.Vector3(
      o.x + (o.w * c + o.d * s) / 2,
      (o.y || 0) + o.h,
      o.z + (o.d * c + o.w * s) / 2,
    ),
  );
}
function panelBounds(cab: any, p: any) {
  const a = (cab.rotation * Math.PI) / 180;
  return bounds({
    x: cab.x + Math.cos(a) * p.x - Math.sin(a) * p.z,
    z: cab.z + Math.sin(a) * p.x + Math.cos(a) * p.z,
    y: (cab.y || 0) + p.y - p.h / 2,
    w: p.w,
    d: p.d,
    h: p.h,
    rotation: cab.rotation,
  });
}
function overlapVolume(a: THREE.Box3, b: THREE.Box3) {
  const d = a.clone().intersect(b).getSize(new THREE.Vector3());
  return d.x * d.y * d.z;
}

for (const [sinkId, topId, baseId] of [
  ["kitchen-sink", "r2-sink-worktop", "r2-kitchen-sink-base"],
  ["r2-bar-sink", "r2-bar-niche-counter", "r2-waterbar"],
]) {
  test(`${sinkId} has an actual stone and cabinet opening through the basin rim`, () => {
    const sink = get(sinkId),
      top = get(topId),
      cab = get(baseId);
    // Derive the clear bowl from the equipment dimensions, not the cutout metadata.
    const mouth = bounds({
      ...sink,
      w: Math.min(0.4, sink.w - 0.08) - 0.008,
      d: Math.min(0.5, sink.d - 0.08) - 0.008,
      y: 0.91,
      h: 0.05,
    });
    expect(top.collisionParts.length).toBeGreaterThan(1);
    for (const p of top.collisionParts)
      expect(overlapVolume(bounds(p), mouth)).toBeLessThan(1e-10);
    for (const p of panels(cab))
      expect(overlapVolume(panelBounds(cab, p), mouth)).toBeLessThan(1e-10);
    // The test must still reject the previous solid-slab shape.
    expect(overlapVolume(bounds(top), mouth)).toBeGreaterThan(0.001);
  });
}

test("guest beverage refrigerator fits the real open bay and intersects no generated cabinet panel", () => {
  const cab = get("r2-guest-wardrobe"),
    fridge = get("guest-drinks-fridge"),
    box = bounds(fridge);
  const bay = cab.r2Cabinet.bays.find(
    (b: any) => b.door === "open" && b.purpose === "appliance",
  );
  const a = (cab.rotation * Math.PI) / 180;
  const bayZ = cab.z + Math.sin(a) * bay.x;
  expect(fridge.z).toBeCloseTo(bayZ, 6);
  expect(fridge.accessFace).toBe("-x");
  for (const p of panels(cab))
    expect(
      overlapVolume(panelBounds(cab, p), box),
      JSON.stringify(p),
    ).toBeLessThan(1e-10);
});

test("every named lighting anchor resolves against the final object inventory", () => {
  const ids = new Set(model.objects.map((o: any) => o.id));
  const missing = model.lighting.fixtures
    .filter((f: any) => f.anchor && !ids.has(f.anchor))
    .map((f: any) => `${f.id}:${f.anchor}`);
  expect(missing).toEqual([]);
});

test("cabinet operator envelopes are outside the access face and retain their orientation", () => {
  for (const cab of model.objects.filter((o: any) => o.r2Cabinet)) {
    const e = cab.useEnvelope,
      a = (cab.rotation * Math.PI) / 180,
      n = [Math.sin(a), -Math.cos(a)];
    const along = (e.x - cab.x) * n[0] + (e.z - cab.z) * n[1];
    const sideways = (e.x - cab.x) * Math.cos(a) + (e.z - cab.z) * Math.sin(a);
    expect(along - e.d / 2, cab.id).toBeCloseTo(cab.d / 2, 6);
    expect(sideways, cab.id).toBeCloseTo(0, 6);
    expect(e.rotation).toBe(cab.rotation);
    expect(e.coordinateFrame).toBe("oriented_world");
    expect(e.source).toContain("not_joint_acceptance");
  }
});

test("open kitchen glazing permits a continuous walk through its opening while closed leaves block it", () => {
  const scene = new THREE.Scene(),
    moving: any[] = [],
    opening = model.openings.find((o: any) => o.id === "kitchen-door");
  const materials = {
    steel: new THREE.MeshBasicMaterial(),
    bronze: new THREE.MeshBasicMaterial(),
    glass: new THREE.MeshBasicMaterial({ transparent: true }),
  };
  buildGlazing(scene, opening, materials, () => {}, moving);
  const walk = createCollision(
    {
      shell: [
        [-1, -1],
        [10, -1],
        [10, 10],
        [-1, 10],
      ],
      walls: [],
      objects: [],
      openings: [opening],
    },
    scene,
  );
  const closed = walk.move([3.3, 5.35], [4.5, 5.35]);
  expect(closed[0]).toBeLessThan(3.92);
  for (const leaf of moving)
    leaf.group.position.set(
      leaf.closed[0] + leaf.travel[0],
      0,
      leaf.closed[1] + leaf.travel[1],
    );
  const open = walk.move([3.3, 5.35], [4.5, 5.35]);
  expect(open[0]).toBeCloseTo(4.5, 5);
  expect(open[1]).toBeCloseTo(5.35, 5);
});
