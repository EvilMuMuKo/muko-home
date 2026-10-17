import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer,
  model: any,
  buildFurniture: any,
  createMotion: any,
  applyMotion: any,
  buildCabinet: any;
test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ finalModel: model } = await server.ssrLoadModule("/src/final-design.ts"));
  ({
    buildHomeFurniture: buildFurniture,
    createHomeMotion: createMotion,
    applyHomeMotion: applyMotion,
  } = await server.ssrLoadModule("/src/home-mesh.ts"));
  ({ buildR2Cabinet: buildCabinet } = await server.ssrLoadModule(
    "/src/r2-cabinet-mesh.ts",
  ));
});
test.afterAll(async () => {
  await server?.close();
});
function setup() {
  const scene = new THREE.Scene(),
    motion = createMotion();
  motion.model = model;
  const material = new THREE.MeshBasicMaterial();
  const materials = new Proxy(
    { oak: material } as Record<string, THREE.Material>,
    { get: (target, key) => target[String(key)] || material },
  );
  const cab = model.objects.find((o: any) => o.id === "r2-living-deep");
  const cabinet = new THREE.Group();
  cabinet.name = cab.id;
  cabinet.position.set(cab.x, cab.y || 0, cab.z);
  cabinet.rotation.y = (-cab.rotation * Math.PI) / 180;
  scene.add(cabinet);
  const doors: any[] = [];
  buildCabinet(cabinet, cab, materials, doors);
  const roots: THREE.Group[] = [];
  for (const id of [
    "dining-table",
    "dining-chair-left",
    "dining-chair-right",
  ]) {
    const o = model.objects.find((o: any) => o.id === id),
      g = new THREE.Group();
    g.name = id;
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = (-o.rotation * Math.PI) / 180;
    scene.add(g);
    roots.push(g);
    expect(buildFurniture(g, o, materials, motion)).toBe(true);
  }
  const surroundings: THREE.Group[] = [];
  for (const id of ["living-sofa", "living-tv"]) {
    const o = model.objects.find((o: any) => o.id === id),
      g = new THREE.Group();
    g.name = id;
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = (-o.rotation * Math.PI) / 180;
    scene.add(g);
    expect(buildFurniture(g, o, materials, motion)).toBe(true);
    surroundings.push(g);
  }
  const set = (p: number) => {
    const q = THREE.MathUtils.clamp(p / 0.12, 0, 1),
      progress = q * q * (3 - 2 * q);
    for (const d of doors) {
      const value = d.pivot.name.includes(":door:0:") ? progress : 0;
      d.pivot.rotation.y = ((-d.sign * Math.PI) / 2) * value;
      if (d.insideGroup) d.insideGroup.visible = value > 0.04;
    }
    applyMotion(motion, {
      dining: p,
      gate: 0,
      dishwasher: 0,
      laundry: 0,
      sofa: 0,
      tv: 0,
      activity: 0,
    });
    scene.updateMatrixWorld(true);
  };
  return { scene, cabinet, roots, surroundings, set };
}
function meshes(root: THREE.Object3D) {
  const out: THREE.Mesh[] = [];
  root.traverse((n) => {
    if (!(n instanceof THREE.Mesh)) return;
    for (let p: THREE.Object3D | null = n; p; p = p.parent)
      if (!p.visible) return;
    out.push(n);
  });
  return out;
}
function oriented(mesh: THREE.Mesh) {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const b = new OBB()
    .fromBox3(mesh.geometry.boundingBox!)
    .applyMatrix4(mesh.matrixWorld);
  // Two volumes must penetrate by more than 2mm: shrink each by 1mm.
  b.halfSize.set(
    Math.max(0, b.halfSize.x - 0.001),
    Math.max(0, b.halfSize.y - 0.001),
    Math.max(0, b.halfSize.z - 0.001),
  );
  return b;
}
function conflicts(a: THREE.Mesh[], b: THREE.Mesh[]) {
  for (const x of a)
    for (const y of b) {
      const ba = oriented(x),
        bb = oriented(y);
      if (ba.intersectsOBB(bb, 1e-10))
        return {
          a: x.parent?.name || x.name,
          b: y.parent?.name || y.name,
          centerA: ba.center.toArray(),
          centerB: bb.center.toArray(),
        };
    }
  return null;
}
test("folded furniture parked above the plinth has no actual cabinet-panel or peer intersection", () => {
  const f = setup();
  f.set(0);
  const cabinet = meshes(f.cabinet);
  for (let i = 0; i < f.roots.length; i++) {
    const a = meshes(f.roots[i]);
    expect(conflicts(a, cabinet), f.roots[i].name).toBeNull();
    for (let j = i + 1; j < f.roots.length; j++)
      expect(
        conflicts(a, meshes(f.roots[j])),
        `${f.roots[i].name}/${f.roots[j].name}`,
      ).toBeNull();
    expect(new THREE.Box3().setFromObject(f.roots[i]).min.y).toBeGreaterThan(
      0.108 - 0.002,
    );
  }
});
test("101 extraction and return samples preserve real 2mm cabinet-door and furniture clearances", () => {
  const f = setup(),
    failures: any[] = [];
  for (const direction of ["extract", "return"])
    for (let step = 0; step <= 100; step++) {
      const p = direction === "extract" ? step / 100 : 1 - step / 100;
      f.set(p);
      const cabinet = meshes(f.cabinet);
      for (let i = 0; i < f.roots.length; i++) {
        const a = meshes(f.roots[i]);
        expect(
          new THREE.Box3().setFromObject(f.roots[i]).min.y,
          `${direction} ${p} ${f.roots[i].name} floor`,
        ).toBeGreaterThanOrEqual(-0.002);
        const hit = conflicts(a, cabinet);
        if (hit)
          failures.push({
            direction,
            p,
            item: f.roots[i].name,
            kind: "cabinet",
            ...hit,
          });
        for (const other of f.surroundings) {
          const hit = conflicts(a, meshes(other));
          if (hit)
            failures.push({
              direction,
              p,
              item: f.roots[i].name,
              other: other.name,
              kind: "surroundings",
              ...hit,
            });
        }
        for (let j = i + 1; j < f.roots.length; j++) {
          const hit = conflicts(a, meshes(f.roots[j]));
          if (hit)
            failures.push({
              direction,
              p,
              item: f.roots[i].name,
              other: f.roots[j].name,
              kind: "peer",
              ...hit,
            });
        }
      }
    }
  annotateCollisions(failures);
  expect(
    failures.slice(0, 12),
    `${failures.length} colliding item/states; tolerance remains 2mm`,
  ).toEqual([]);
});

function annotateCollisions(failures: any[]) {
  const summary: Record<string, { min: number; max: number; count: number }> =
    {};
  for (const f of failures) {
    const key = `${f.direction}:${f.item}:${f.kind}:${f.other || ""}`;
    const old = summary[key] || { min: f.p, max: f.p, count: 0 };
    old.min = Math.min(old.min, f.p);
    old.max = Math.max(old.max, f.p);
    old.count++;
    summary[key] = old;
  }
  test.info().annotations.push({
    type: "collision ranges",
    description: JSON.stringify(summary),
  });
}

test("dining endpoint, retained furniture dimensions and task lighting share one final use position", () => {
  const f = setup();
  f.set(1);
  expect(f.roots[0].position.x).toBeCloseTo(
    model.homeDesign.dining.table.use.x,
    6,
  );
  expect(f.roots[0].position.z).toBeCloseTo(
    model.homeDesign.dining.table.use.z,
    6,
  );
  for (let i = 0; i < 2; i++) {
    const p = model.homeDesign.dining.chairs[i].use;
    expect(f.roots[i + 1].position.x).toBeCloseTo(p.x, 6);
    expect(f.roots[i + 1].position.z).toBeCloseTo(p.z, 6);
  }
  const lights = model.lighting.fixtures.filter((f: any) =>
    /^dining-offset-/.test(f.id),
  );
  expect(lights).toHaveLength(2);
  for (const l of lights)
    expect(l.target[2]).toBeCloseTo(f.roots[0].position.z, 6);
  expect(model.objects.find((o: any) => o.id === "dining-table")).toMatchObject(
    { w: 1.1, d: 0.7, h: 0.74 },
  );
  for (const c of model.homeDesign.dining.chairs)
    expect(model.objects.find((o: any) => o.id === c.id)).toMatchObject({
      w: 0.5,
      d: 0.55,
      h: 0.88,
    });
});
