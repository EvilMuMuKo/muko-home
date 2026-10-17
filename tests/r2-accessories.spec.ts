import { test, expect } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import * as THREE from "three";
let server: ViteDevServer,
  model: any,
  home: any,
  cabinets: any,
  buildPlant: any;
test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ finalModel: model } = await server.ssrLoadModule("/src/final-design.ts"));
  home = await server.ssrLoadModule("/src/home-mesh.ts");
  cabinets = await server.ssrLoadModule("/src/r2-cabinet-mesh.ts");
  ({ buildPlant } = await server.ssrLoadModule("/src/plant-mesh.ts"));
});
test.afterAll(async () => {
  await server?.close();
});
const get = (id: string) => model.objects.find((o: any) => o.id === id);
function materials() {
  const mat = new THREE.MeshStandardMaterial();
  return new Proxy({ oak: mat } as Record<string, THREE.Material>, {
    get: (o, k) => o[String(k)] || mat,
  });
}
function groupFor(o: any) {
  const g = new THREE.Group();
  g.name = o.id;
  g.position.set(o.x, o.y || 0, o.z);
  g.rotation.y = -THREE.MathUtils.degToRad(o.rotation || 0);
  return g;
}
function relativeBounds(root: THREE.Object3D, frame: THREE.Object3D) {
  frame.updateWorldMatrix(true, true);
  root.updateWorldMatrix(true, true);
  const out = new THREE.Box3(),
    inverse = frame.matrixWorld.clone().invert();
  root.traverse((n) => {
    if (!(n instanceof THREE.Mesh)) return;
    for (let a: THREE.Object3D | null = n; a; a = a.parent)
      if (!a.visible) return;
    if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
    out.union(
      n.geometry
        .boundingBox!.clone()
        .applyMatrix4(inverse.clone().multiply(n.matrixWorld)),
    );
  });
  return out;
}
function modelBox(o: any) {
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

test("final PS5 is supported within the actual trolley shelf and follows its complete movement", () => {
  const scene = new THREE.Scene(),
    motion = home.createHomeMotion(),
    m = materials();
  for (const id of ["living-tv", "ps5"]) {
    const o = get(id),
      g = groupFor(o);
    expect(home.buildHomeFurniture(g, o, m, motion)).toBe(true);
    scene.add(g);
  }
  home.buildHomeArchitecture(scene, model, m, () => {}, motion);
  const tv = motion.mobileTV.group as THREE.Group,
    ps5 = scene.getObjectByName("ps5")!,
    shelf = scene.getObjectByName("home:mobile-device-shelf")!;
  expect(ps5.parent).toBe(tv);
  const offset = ps5.position.clone();
  for (let i = 0; i <= 100; i++) {
    home.applyHomeMotion(motion, {
      dining: 0,
      gate: 0,
      dishwasher: 0,
      tv: i / 100,
    });
    const b = relativeBounds(ps5, tv),
      support = relativeBounds(shelf, tv);
    for (const axis of ["x", "z"] as const) {
      expect(b.min[axis]).toBeGreaterThanOrEqual(support.min[axis] - 0.001);
      expect(b.max[axis]).toBeLessThanOrEqual(support.max[axis] + 0.001);
    }
    expect(b.min.y - support.max.y).toBeGreaterThanOrEqual(-0.001);
    expect(b.min.y - support.max.y).toBeLessThanOrEqual(0.002);
    expect(
      ps5
        .getWorldPosition(new THREE.Vector3())
        .distanceTo(tv.localToWorld(offset.clone())),
    ).toBeLessThan(1e-6);
  }
});

test("robot external envelope clears the deep cabinet and remains inside exterior finished wall faces", () => {
  const robot = modelBox(get("robot-dock")),
    cab = modelBox(get("r2-living-deep"));
  const d = robot.clone().intersect(cab).getSize(new THREE.Vector3());
  expect(d.x * d.y * d.z).toBe(0);
  const bottom = model.walls.find((w: any) => w.id === "balcony-west"),
    right = model.walls.find((w: any) => w.id === "balcony-inner");
  expect(robot.max.z).toBeLessThanOrEqual(
    bottom.a[1] - bottom.thickness / 2 + 1e-6,
  );
  expect(robot.max.x).toBeLessThanOrEqual(
    right.a[0] - right.thickness / 2 + 1e-6,
  );
  expect(get("robot-dock")).toMatchObject({ w: 0.36, d: 0.42, h: 0.42 });
});

test("living plant occupies an open bay and its actual pot rests on a real shelf", () => {
  const scene = new THREE.Scene(),
    m = materials(),
    o = get("plant-living"),
    cab = get("r2-living-shallow");
  const cg = groupFor(cab),
    plant = groupFor(o);
  scene.add(cg, plant);
  cabinets.buildR2Cabinet(cg, cab, m, []);
  buildPlant(plant, o, m);
  scene.updateMatrixWorld(true);
  const box = relativeBounds(plant, cg),
    bay = cab.r2Cabinet.bays.find(
      (b: any) =>
        box.min.x >= b.x - b.w / 2 &&
        box.max.x <= b.x + b.w / 2 &&
        box.min.y >= b.y &&
        box.max.y <= b.y + b.h,
    );
  expect(bay?.door).toBe("open");
  const pot = plant.getObjectByName("plant:pot")!,
    potBounds = new THREE.Box3().setFromObject(pot);
  let supportingTop = -Infinity;
  cg.traverse((n) => {
    if (!(n instanceof THREE.Mesh)) return;
    const b = new THREE.Box3().setFromObject(n);
    if (b.max.y > potBounds.min.y + 0.002) return;
    if (
      b.min.x <= potBounds.min.x &&
      b.max.x >= potBounds.max.x &&
      b.min.z <= potBounds.min.z &&
      b.max.z >= potBounds.max.z
    )
      supportingTop = Math.max(supportingTop, b.max.y);
  });
  expect(Number.isFinite(supportingTop)).toBe(true);
  expect(potBounds.min.y - supportingTop).toBeGreaterThanOrEqual(-0.002);
  expect(potBounds.min.y - supportingTop).toBeLessThanOrEqual(0.002);
});
