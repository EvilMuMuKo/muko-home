import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;
let model: any;
let home: any;
let electrical: any;
let r5: any;

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ finalModel: model } = await server.ssrLoadModule("/src/final-design.ts"));
  home = await server.ssrLoadModule("/src/home-mesh.ts");
  electrical = await server.ssrLoadModule("/src/electrical-mesh.ts");
  r5 = await server.ssrLoadModule("/src/r5-mesh.ts");
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
  return new OBB()
    .fromBox3(n.geometry.boundingBox!)
    .applyMatrix4(n.matrixWorld);
}

function buildFurniture(ids: string[]) {
  const scene = new THREE.Scene();
  const motion = home.createHomeMotion();
  const m = materials();
  motion.model = model;
  const roots = new Map<string, THREE.Group>();
  for (const id of ids) {
    const o = get(id);
    if (!o) throw new Error(`Missing R5 object ${id}`);
    const g = groupFor(o);
    roots.set(id, g);
    scene.add(g);
    if (!home.buildHomeFurniture(g, o, m, motion)) {
      if (o.collisionParts?.length) {
        g.updateWorldMatrix(true, false);
        for (const p of o.collisionParts) {
          const a = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), m.oak);
          a.name = `${id}:collision-proxy`;
          a.position.copy(g.worldToLocal(new THREE.Vector3(p.x, p.y + p.h / 2, p.z)));
          a.rotation.y = -THREE.MathUtils.degToRad(p.rotation || 0) - g.rotation.y;
          g.add(a);
        }
      } else {
        const a = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), m.oak);
        a.name = `${id}:collision-proxy`;
        a.position.y = o.h / 2;
        g.add(a);
      }
    }
  }
  scene.updateMatrixWorld(true);
  return { scene, motion, roots, m };
}

function rootSpaceBounds(root: THREE.Object3D, meshes: THREE.Mesh[]) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const union = new THREE.Box3().makeEmpty();
  for (const mesh of meshes) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    union.union(mesh.geometry.boundingBox!.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
  }
  return union;
}

test("R5 rendered TV screens have the measured bodies and face their seating; real stand meshes fit the approved base budgets", () => {
  const f = buildFurniture(["living-tv", "guest-tv", "living-sofa"]);
  home.applyHomeMotion(f.motion, { dining: 0, gate: 0, dishwasher: 0, activity: 0, sofa: 0, tv: 0 });
  f.scene.updateMatrixWorld(true);
  const facing: Array<{ id: string; dot: number; normal: number[]; towardSeat: number[] }> = [];
  for (const [id, stand] of [["living-tv", [1.1, 0.66]], ["guest-tv", [1.086, 0.849]]] as const) {
    const root = f.roots.get(id)!;
    const body = root.getObjectByName(`${id}:body`) as THREE.Mesh;
    expect(body, `${id} rendered body`).toBeTruthy();
    body.geometry.computeBoundingBox();
    const bodySize = body.geometry.boundingBox!.getSize(new THREE.Vector3());
    expect(bodySize.x).toBeCloseTo(1.895, 3);
    expect(bodySize.y).toBeCloseTo(1.087, 3);
    expect(bodySize.z).toBeCloseTo(0.06, 3);
    const center = body.getWorldPosition(new THREE.Vector3());
    expect(center.y).toBeCloseTo(1.3, 3);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const target = id === "living-tv"
      ? f.motion.sofaModules.reduce((v: THREE.Vector3, g: THREE.Group) => v.add(g.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).multiplyScalar(1 / f.motion.sofaModules.length)
      : new THREE.Vector3(get("guest-sofa-bed").x, 0, get("guest-sofa-bed").z);
    const towardSeat = target.sub(center).setY(0).normalize();
    facing.push({ id, dot: normal.dot(towardSeat), normal: normal.toArray(), towardSeat: towardSeat.toArray() });

    const baseMeshes = visibleMeshes(root).filter((mesh) => {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox!.clone().applyMatrix4(root.matrixWorld.clone().invert().multiply(mesh.matrixWorld));
      return b.max.y <= 0.2;
    });
    const base = rootSpaceBounds(root, baseMeshes).getSize(new THREE.Vector3());
    expect(base.x, `${id} actual base width`).toBeLessThanOrEqual(stand[0] + 0.002);
    expect(base.z, `${id} actual base depth`).toBeLessThanOrEqual(stand[1] + 0.002);
  }
  expect(facing.filter((f) => f.dot <= 0.92), `screen normal/seating vectors: ${JSON.stringify(facing)}`).toEqual([]);
});

test("R5 study desk top and four legs stay clear of every visible small-bed part through 101 real extension states", () => {
  const f = buildFurniture(["study-desk", "study-sofa-bed", "study-office-chair"]);
  const desk = f.roots.get("study-desk")!;
  const bed = f.roots.get("study-sofa-bed")!;
  const deskSolids = visibleMeshes(desk).filter((mesh) => mesh.name === "study:desktop" || mesh.name === "study:outside-leg");
  expect(deskSolids.filter((mesh) => mesh.name === "study:desktop")).toHaveLength(1);
  expect(deskSolids.filter((mesh) => mesh.name === "study:outside-leg")).toHaveLength(4);
  const desktop = deskSolids.find((mesh) => mesh.name === "study:desktop")!;
  const tabletopBounds = new THREE.Box3().setFromObject(desktop);
  expect(tabletopBounds.min.y).toBeGreaterThanOrEqual(0.68);

  const failures: Array<{ progress: number; desk: string; bed: string }> = [];
  for (let i = 0; i <= 100; i++) {
    const progress = i / 100;
    r5.applyR5Motion(f.motion, f.scene, { smallBed: progress, cinemaTV: 0 });
    f.scene.updateMatrixWorld(true);
    const bedMeshes = visibleMeshes(bed);
    for (const d of deskSolids)
      for (const b of bedMeshes)
        if (obb(d).intersectsOBB(obb(b), 1e-10)) failures.push({ progress, desk: d.name, bed: b.name });
  }
  expect(failures.slice(0, 12), `${failures.length} visible desk/bed OBB intersections`).toEqual([]);

  r5.applyR5Motion(f.motion, f.scene, { smallBed: 1, cinemaTV: 0 });
  f.scene.updateMatrixWorld(true);
  const opened = home.homeVisibleBounds(bed);
  const size = opened.getSize(new THREE.Vector3());
  expect(size.x).toBeCloseTo(1.05, 2);
  expect(opened.max.z).toBeCloseTo(2.075, 1);
});

test("R5 office-chair collision proxy clears the real bed through the full chair-and-bed motion", () => {
  const f = buildFurniture(["study-sofa-bed", "study-office-chair"]);
  const bed = f.roots.get("study-sofa-bed")!;
  const chair = f.roots.get("study-office-chair")!;
  const chairBox = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.75), f.m.oak);
  chairBox.name = "study-office-chair:0.75m-clearance-proxy";
  chairBox.position.y = 0.45;
  chair.add(chairBox);
  const failures: Array<{ smallBed: number; chair: string; bed: string }> = [];
  for (let i = 0; i <= 100; i++) {
    const smallBed = i / 100;
    r5.applyR5Motion(f.motion, f.scene, { smallBed, cinemaTV: 0 });
    f.scene.updateMatrixWorld(true);
    for (const b of visibleMeshes(bed))
      if (obb(chairBox).intersectsOBB(obb(b), 1e-10)) failures.push({ smallBed, chair: chairBox.name, bed: b.name });
  }
  expect(failures.slice(0, 12), `${failures.length} chair/bed OBB intersections`).toEqual([]);
});

test("R5 electrical renderer batches proposed outlets per room, omits conditional points and stays within 30 draw calls", async () => {
  const scene = new THREE.Scene();
  const report = electrical.buildElectrical(scene, model, materials());
  const points = model.homeDesign.electrical.points;
  const proposed = points.filter((p: any) => p.status === "PROPOSED" && p.modelDisplay !== false);
  const conditional = points.filter((p: any) => p.status === "CONDITIONAL").map((p: any) => p.id).sort();
  expect(report.conceptOnly).toBe(true);
  expect(report.groups.map((g: any) => g.id).sort()).toEqual(proposed.map((p: any) => p.id).sort());
  expect(report.conditionalOmitted.slice().sort()).toEqual(conditional);
  expect(report.groups.length).toBeGreaterThan(0);
  expect(report.drawCalls).toBeLessThanOrEqual(30);

  const root = scene.getObjectByName("electrical:root")!;
  const expectedRooms = [...new Set(proposed
    .filter((p: any) => p.kind !== "fixed_connection" && p.kind !== "data" && p.id !== "C04" &&
      (p.kind === "switch" || (p.acModules || 0) + (p.rj45 || 0) > 0))
    .map((p: any) => p.room))].sort();
  const roomGroups = root.children.filter((n) => n.name.startsWith("electrical-") && !n.name.startsWith("electrical-pdu-"));
  expect(roomGroups.map((n) => n.name).sort()).toEqual(expectedRooms.map((room) => `electrical-${room}`));
  for (const roomGroup of roomGroups) {
    const meshes: THREE.InstancedMesh[] = [];
    roomGroup.traverse((node) => { if ((node as THREE.InstancedMesh).isInstancedMesh) meshes.push(node as THREE.InstancedMesh); });
    expect(meshes).toHaveLength(3);
    expect(meshes.every((mesh) => mesh.count > 0)).toBe(true);
  }
  expect(root.getObjectByName("electrical-pdu-C04")).toBeTruthy();
  expect(report.groups.some((g: any) => proposed.some((p: any) => p.id === g.id && p.kind === "socket"))).toBe(true);
});

test('R5 full-size sofa modules turn without crossing one another in 101 living-state samples',()=>{
 const f=buildFurniture(['living-sofa']);
 const roots=f.motion.sofaModules;
 const hits:Array<{mode:string;progress:number}>=[];
 for(const mode of ['sofa','dining','activity'])for(let i=0;i<=100;i++){
  home.applyHomeMotion(f.motion,{dining:0,gate:0,dishwasher:0,tv:0,sofa:0,activity:0,[mode]:i/100});
  f.scene.updateMatrixWorld(true);
  const a=visibleMeshes(roots[0]),b=visibleMeshes(roots[1]);
  let overlap=false;
  for(const x of a)for(const y of b){
   const ax=obb(x),by=obb(y);
   // Merely touching seams are intentional; exclude 0.1mm numerical contact tolerance only.
   ax.halfSize.subScalar(.0001);by.halfSize.subScalar(.0001);
   if(ax.intersectsOBB(by,1e-10))overlap=true;
  }
  if(overlap)hits.push({mode,progress:i/100});
 }
 expect(hits.slice(0,10),`${hits.length} module intersections`).toEqual([]);
});
