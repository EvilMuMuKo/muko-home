import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";
import { createServer, type ViteDevServer } from "vite";
let server: ViteDevServer, model: any, home: any, cabinet: any, bayLife: any;
test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ finalModel: model } = await server.ssrLoadModule("/src/final-design.ts"));
  home = await server.ssrLoadModule("/src/home-mesh.ts");
  cabinet = await server.ssrLoadModule("/src/r2-cabinet-mesh.ts");
  bayLife = await server.ssrLoadModule("/src/bay-life.ts");
});
test.afterAll(async () => {
  await server?.close();
});
const get = (id: string) => model.objects.find((o: any) => o.id === id);
function materials() {
  const m = new THREE.MeshBasicMaterial();
  return new Proxy({ oak: m } as Record<string, THREE.Material>, {
    get: (o, k) => o[String(k)] || m,
  });
}
function groupFor(o: any) {
  const g = new THREE.Group();
  g.name = o.id;
  g.position.set(o.x, o.y || 0, o.z);
  g.rotation.y = -THREE.MathUtils.degToRad(o.rotation || 0);
  return g;
}
function visibleMeshes(g: THREE.Object3D) {
  const out: THREE.Mesh[] = [];
  g.traverse((n) => {
    if (!(n instanceof THREE.Mesh)) return;
    for (let p: THREE.Object3D | null = n; p; p = p.parent)
      if (!p.visible) return;
    out.push(n);
  });
  return out;
}
function obb(n: THREE.Mesh) {
  if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
  const b = new OBB()
    .fromBox3(n.geometry.boundingBox!)
    .applyMatrix4(n.matrixWorld);
  b.halfSize.set(
    Math.max(0, b.halfSize.x - 0.001),
    Math.max(0, b.halfSize.y - 0.001),
    Math.max(0, b.halfSize.z - 0.001),
  );
  return b;
}
function majorFurniture() {
  const scene = new THREE.Scene(),
    motion = home.createHomeMotion(),
    m = materials(),
    groups = new Map<string, THREE.Group>();
  motion.model = model;
  const types = new Set([
    "wall_storage",
    "cabinet_frame",
    "modular_sofa",
    "mobile_tv",
    "mattress",
    "desk",
    "office_chair",
    "sofa_bed",
    "fridge",
    "shower",
    "toilet",
    "vanity",
    "counter_stool",
  ]);
  for (const o of model.objects.filter((o: any) => types.has(o.type))) {
    const g = groupFor(o);
    groups.set(o.id, g);
    scene.add(g);
    if (o.r2Cabinet) cabinet.buildR2Cabinet(g, o, m, []);
    else if (!home.buildHomeFurniture(g, o, m, motion)) {
      if (o.collisionParts?.length) {
        g.updateWorldMatrix(true, false);
        for (const p of o.collisionParts) {
          const a = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), m.oak);
          a.position.copy(
            g.worldToLocal(new THREE.Vector3(p.x, p.y + p.h / 2, p.z)),
          );
          a.rotation.y =
            -THREE.MathUtils.degToRad(p.rotation || 0) - g.rotation.y;
          g.add(a);
        }
      } else {
        const a = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), m.oak);
        a.position.y = o.h / 2;
        g.add(a);
      }
    }
  }
  home.applyHomeMotion(motion, {
    dining: 0,
    gate: 0,
    dishwasher: 0,
    tv: 0,
    sofa: 0,
  });
  scene.updateMatrixWorld(true);
  return { scene, groups, m };
}
function door(o: any, m: THREE.Material) {
  const g = new THREE.Group();
  g.position.set(o.hinge[0], 0, o.hinge[1]);
  g.name = o.id;
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(o.width, o.height || 2.08, o.thickness || 0.04),
    m,
  );
  panel.position.set(o.width / 2, (o.height || 2.08) / 2, 0);
  g.add(panel);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.016, 0.025), m);
  handle.position.set(o.width - 0.1, 0.93, -0.013);
  g.add(handle);
  return g;
}
function inside(p: number[], poly: number[][]) {
  let value = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      value = !value;
  }
  return value;
}

test("R3 retains full inward leaves, the 500mm daily counter, 300mm knee void and two full-sized stools", () => {
  const roomFor: Record<string, string> = {
    "entry-door": "hall",
    "guest-door": "guest",
    "master-door": "master",
    "bath-door": "bath",
  };
  for (const [id, w] of [
    ["entry-door", 1.1],
    ["guest-door", 0.86],
    ["master-door", 0.88],
    ["bath-door", 0.8],
  ] as const) {
    const o = model.openings.find((o: any) => o.id === id),
      a = ((o.rotation + o.openAngle) * Math.PI) / 180;
    expect(o.width).toBe(w);
    const p = [
      o.hinge[0] + o.width * 0.8 * Math.cos(a),
      o.hinge[1] + o.width * 0.8 * Math.sin(a),
    ];
    expect(
      inside(p, model.rooms.find((r: any) => r.id === roomFor[id]).polygon),
      id,
    ).toBe(true);
  }
  const top = get("s02-entry-return"),
    base = get("r3-entry-island-base");
  expect(top).toMatchObject({ x: 4.95, w: 0.5, d: 1.6, h: 0.95 });
  expect(base).toMatchObject({
    x: 5.1,
    w: 1.6,
    d: 0.2,
    rotation: 90,
    accessFace: "+x",
  });
  expect(base.x - base.d / 2 - (top.x - top.w / 2)).toBeCloseTo(0.3, 6);
  expect(base.r2Cabinet.bays.every((b: any) => b.door === "solid")).toBe(true);
  const seats = model.homeDesign.entryIslandDining.seats;
  expect(seats).toHaveLength(2);
  expect(model.homeDesign.entryIslandDining.dailyMainDining).toBe(true);
  for (const s of seats) {
    expect(get(s.id)).toMatchObject({ x: 4.4, w: 0.46, d: 0.46 });
    expect(s.pulledCenter[0]).toBeCloseTo(4, 6);
    expect(s.center[0] - 0.3).toBeGreaterThan(
      get("r2-waterbar").x + get("r2-waterbar").w / 2,
    );
  }
});

test("101 real leaf and handle samples clear major furniture with both daily stools parked and pulled 400mm", () => {
  const f = majorFurniture(),
    failures: any[] = [];
  for (const pulled of [false, true]) {
    for (const s of model.homeDesign.entryIslandDining.seats)
      f.groups.get(s.id)!.position.x = s.center[0] - (pulled ? 0.4 : 0);
    f.scene.updateMatrixWorld(true);
    const solids = [...f.groups].flatMap(([id, g]) =>
      visibleMeshes(g).map((n) => ({ id, box: obb(n) })),
    );
    for (const id of ["entry-door", "guest-door", "master-door", "bath-door"]) {
      const o = model.openings.find((o: any) => o.id === id),
        g = door(o, f.m.oak);
      f.scene.add(g);
      for (let i = 0; i <= 100; i++) {
        g.rotation.y = -THREE.MathUtils.degToRad(
          o.rotation + (o.openAngle * i) / 100,
        );
        g.updateWorldMatrix(true, true);
        for (const leaf of visibleMeshes(g)) {
          const b = obb(leaf);
          for (const s of solids)
            if (b.intersectsOBB(s.box, 1e-10))
              failures.push({
                pulled,
                door: id,
                progress: i / 100,
                object: s.id,
              });
        }
      }
      f.scene.remove(g);
    }
  }
  expect(
    failures.slice(0, 15),
    `${failures.length} leaf/handle intersections above 2mm tolerance`,
  ).toEqual([]);
});

test("bay-life actual components remain on the structural sill, clear the glass and retain bedroom walking polygons", () => {
  const scene = new THREE.Scene(),
    m = materials(),
    motion = home.createHomeMotion(),
    before = structuredClone(
      model.rooms.map((r: any) => ({ id: r.id, polygon: r.polygon })),
    );
  home.buildHomeArchitecture(scene, model, m, () => {}, motion);
  const reports = bayLife.buildBayLife(scene, model, m, () => {});
  scene.updateMatrixWorld(true);
  expect(reports).toHaveLength(2);
  for (const report of reports) {
    const b = model.homeDesign.bayWindows.find(
        (b: any) => b.roomId === report.roomId,
      ),
      cx = b.center[0],
      cz = b.center[1],
      dx = b.outward[0],
      arch = scene.getObjectByName("bay:" + b.roomId)!;
    const structural = visibleMeshes(arch).map((n) => obb(n));
    const life = scene.getObjectByName(report.group)!;
    for (const n of visibleMeshes(life)) {
      const box = new THREE.Box3().setFromObject(n);
      expect(box.min.y).toBeGreaterThanOrEqual(b.sillHeightM - 0.002);
      const far = dx > 0 ? box.max.x - cx : cx - box.min.x;
      expect(far).toBeLessThan(b.projectionM - 0.01);
      expect(box.min.z).toBeGreaterThanOrEqual(cz - b.widthM / 2 - 0.002);
      expect(box.max.z).toBeLessThanOrEqual(cz + b.widthM / 2 + 0.002);
      for (const solid of structural)
        expect(obb(n).intersectsOBB(solid, 1e-10), n.name).toBe(false);
    }
    const room = model.rooms.find((r: any) => r.id === b.roomId);
    expect(inside([cx + (dx * b.projectionM) / 2, cz], room.polygon)).toBe(
      false,
    );
  }
  expect(
    model.rooms.map((r: any) => ({ id: r.id, polygon: r.polygon })),
  ).toEqual(before);
});

test("kitchen glass has a real 900mm opening after subtracting folded leaves and the peninsula footprint", async () => {
  const f = majorFurniture(),
    moving: any[] = [];
  const { buildR2Glazing } = await server.ssrLoadModule("/src/r2-glazing.ts");
  const side = model.openings.find((o: any) => o.id === "kitchen-door");
  const g = buildR2Glazing(f.scene, side, f.m, () => {}, moving);
  for (const leaf of moving)
    leaf.group.position.set(
      leaf.closed[0] + leaf.travel[0],
      0,
      leaf.closed[1] + leaf.travel[1],
    );
  f.scene.updateMatrixWorld(true);
  const lo = side.center[1] - side.width / 2,
    hi = new THREE.Box3().setFromObject(f.groups.get("r2-shallow-peninsula")!)
      .min.z;
  let available: Array<[number, number]> = [[lo, hi]];
  for (const n of visibleMeshes(g)) {
    const b = new THREE.Box3().setFromObject(n);
    if (b.max.y <= 0 || b.min.y >= 1.88) continue;
    available = available.flatMap(([a, z]) =>
      b.max.z <= a || b.min.z >= z
        ? [[a, z]]
        : [
            [a, Math.max(a, b.min.z)],
            [Math.min(z, b.max.z), z],
          ].filter(([u, v]) => v - u > 1e-6),
    ) as Array<[number, number]>;
  }
  const width = Math.max(0, ...available.map(([a, b]) => b - a));
  test.info().annotations.push({
    type: "physical kitchen opening",
    description: JSON.stringify({
      available,
      width,
      nominalGlazingBudget: g.userData.glazingAudit.openBudgetM,
    }),
  });
  expect(
    width,
    "real cabinet and open-leaf geometry must satisfy 900mm; glass span alone is insufficient",
  ).toBeGreaterThanOrEqual(0.9);
});

test("R3 sliding leaves, posts and extended tracks clear actual kitchen cabinetry throughout 101 states", async () => {
  const f = majorFurniture(),
    moving: any[] = [];
  const { buildR2Glazing } = await server.ssrLoadModule("/src/r2-glazing.ts");
  const roots = [];
  for (const id of ["kitchen-door"])
    roots.push(
      buildR2Glazing(
        f.scene,
        model.openings.find((o: any) => o.id === id),
        f.m,
        () => {},
        moving,
      ),
    );
  const kitchenIds = [
    "r2-fridge-cabinet",
    "kitchen-fridge",
    "r2-kitchen-back",
    "r2-kitchen-sink-base",
    "r2-back-worktop",
    "r2-sink-worktop",
    "r2-kitchen-peninsula",
    "r2-main-countertop",
    "r2-shallow-peninsula",
    "r2-shallow-countertop",
  ];
  f.scene.updateMatrixWorld(true);
  const fixed = kitchenIds.flatMap((id) =>
    visibleMeshes(f.groups.get(id)!).map((n) => ({ id, box: obb(n) })),
  );
  const failures: any[] = [];
  for (let i = 0; i <= 100; i++) {
    for (const leaf of moving)
      leaf.group.position.set(
        leaf.closed[0] + (leaf.travel[0] * i) / 100,
        0,
        leaf.closed[1] + (leaf.travel[1] * i) / 100,
      );
    f.scene.updateMatrixWorld(true);
    for (const root of roots)
      for (const n of visibleMeshes(root)) {
        const b = obb(n);
        for (const cab of fixed)
          if (b.intersectsOBB(cab.box, 1e-10))
            failures.push({
              p: i / 100,
              opening: root.name,
              cabinet: cab.id,
              center: b.center.toArray(),
            });
      }
  }
  expect(
    failures.slice(0, 10),
    `${failures.length} glass/cabinet intersections above 2mm`,
  ).toEqual([]);
});
