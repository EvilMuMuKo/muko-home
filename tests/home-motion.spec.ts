import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";
import base from "../src/model.js";
import { createStorageDesign } from "../src/storage-design";
import { createAtmosphereDesign } from "../src/atmosphere-design";
import { createSalonDesign } from "../src/salon-design";
import { createHomeDesign } from "../src/home-design";
import {
  createHomeMotion,
  buildHomeFurniture,
  buildHomeArchitecture,
  applyHomeMotion,
  homeVisibleBounds,
} from "../src/home-mesh";

function fixture() {
  const v8 = createSalonDesign(
    createAtmosphereDesign(createStorageDesign(base as never)),
  );
  const model: any = createHomeDesign(v8),
    motion = createHomeMotion(),
    scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial();
  const materials = new Proxy({}, { get: () => material }) as Record<
    string,
    THREE.Material
  >;
  for (const o of model.objects) {
    const group = new THREE.Group();
    group.name = o.id;
    group.position.set(o.x, o.y || 0, o.z);
    group.rotation.y = -THREE.MathUtils.degToRad(o.rotation || 0);
    if (buildHomeFurniture(group, o, materials, motion)) scene.add(group);
  }
  const architecture = buildHomeArchitecture(
    scene,
    model,
    materials,
    () => {},
    motion,
  );
  const bounds = (o: THREE.Object3D) => {
    o.updateWorldMatrix(true, true);
    return homeVisibleBounds(o);
  };
  return { v8, model, motion, scene, architecture, bounds, material };
}
function overlap(a: THREE.Box3, b: THREE.Box3) {
  return (
    Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > 0.002 &&
    Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > 0.002 &&
    Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > 0.002
  );
}
function objectBox(o: any) {
  const quarter = Math.abs(Math.sin(THREE.MathUtils.degToRad(o.rotation || 0))),
    c = Math.abs(Math.cos(THREE.MathUtils.degToRad(o.rotation || 0)));
  const w = o.w * c + o.d * quarter,
    d = o.d * c + o.w * quarter;
  return new THREE.Box3(
    new THREE.Vector3(o.x - w / 2, o.y || 0, o.z - d / 2),
    new THREE.Vector3(o.x + w / 2, (o.y || 0) + o.h, o.z + d / 2),
  );
}
test("entry return uses a supported two-leaf telescopic pullout within the cabinet budget", () => {
  const { model, v8, motion, bounds } = fixture();
  const pillar = model.objects.find((o: any) => o.id === "column-handdrawn");
  expect(pillar).toEqual(v8.objects.find((o) => o.id === pillar.id));
  const island = model.objects.find((o: any) => o.id === "s02-entry-return");
  expect(island.x).toBe(pillar.x);
  expect(island.w).toBe(pillar.w);
  expect(island.w).toBe(0.5);
  expect(island.d).toBe(0.9);
  const design = model.homeDesign.hatch;
  expect(design.kind).toBe("two_leaf_drawer_pullout");
  expect(design.status).toBe("concept_not_factory_cad");
  expect(design.spanM).toBe(0.895);
  expect(design.depthM).toBe(0.405);
  expect(design.leafCount).toBe(2);
  expect(design.leafLengthM * 2).toBeCloseTo(design.spanM, 4);
  expect(design.cabinetClearWidthM).toBeGreaterThan(design.depthM);
  expect(design.cabinetClearDepthM).toBeGreaterThanOrEqual(
    design.railDepthMinM,
  );
  expect(design.cabinetClearHeightM).toBeGreaterThanOrEqual(
    design.requiredClearHeightM,
  );
  expect(design.storagePocketMinDepthM).toBeLessThan(design.cabinetClearDepthM);
  expect(
    island.collisionParts.filter(
      (p: any) => p.h <= 0.025 && [0.08, 0.34, 0.62].includes(p.y),
    ),
  ).toHaveLength(3);
  expect(design.storagePocketYBoundsM).toEqual([0.638, 0.915]);
  expect(design.lowerOpenStorageBays).toBe(2);
  expect(island.collisionParts.find((p:any)=>p.role==="pullout_pocket_side_fascia")).toMatchObject({y:0.638,h:0.277,d:0.9});
  expect(motion.hatch!.group.name).toBe("opening:hall-gate");

  const meshBox = (o: THREE.Object3D) => {
    o.updateWorldMatrix(true, true);
    return new THREE.Box3().setFromObject(o);
  };
  for (let step = 0; step <= 100; step++) {
    applyHomeMotion(motion, { dining: 0, gate: 1 - step / 100, dishwasher: 0 });
    const box = bounds(motion.hatch!.group);
    expect(overlap(box, objectBox(pillar)), `pillar at ${step}%`).toBe(false);
    const allLeafBounds = meshBox(motion.hatch!.baseLeaf);
    expect(allLeafBounds.min.y).toBeGreaterThanOrEqual(0.1);
    expect(allLeafBounds.max.y).toBeLessThan(0.915);
    expect(motion.hatch!.leaves.position.z).toBeLessThanOrEqual(
      design.leafLengthM / 2 + 0.001,
    );
    expect(motion.hatch!.leaves.position.z).toBeGreaterThanOrEqual(
      -design.spanM - 0.001,
    );
    expect(motion.hatch!.railStage2.position.z).toBeGreaterThanOrEqual(
      -design.leafLengthM - 0.001,
    );
    expect(motion.hatch!.railStage3.position.z).toBeGreaterThanOrEqual(
      -design.leafLengthM - 0.001,
    );
  }
  applyHomeMotion(motion, { dining: 0, gate: 0, dishwasher: 0 });
  const extended = meshBox(motion.hatch!.baseLeaf);
  expect(extended.min.z).toBeCloseTo(design.drawerFrontZ - design.spanM, 3);
  expect(extended.max.z).toBeCloseTo(
    design.drawerFrontZ - design.leafLengthM,
    3,
  );
  expect(motion.hatch!.outerLeafPivot.rotation.x).toBeCloseTo(Math.PI, 4);
  expect(motion.hatch!.railStage2.position.z).toBeCloseTo(
    -design.leafLengthM,
    4,
  );
  expect(motion.hatch!.railStage3.position.z).toBeCloseTo(
    -design.leafLengthM,
    4,
  );
  expect(motion.hatch!.front.rotation.x).toBeCloseTo(-Math.PI / 2, 4);
  // All nested rails stay immediately below the worktop, never on the floor.
  motion.hatch!.group.updateWorldMatrix(true, true);
  for (const stage of [motion.hatch!.railStage2, motion.hatch!.railStage3]) {
    const railBounds = meshBox(stage);
    expect(railBounds.min.y).toBeGreaterThan(design.worktopTopM - 0.05);
    expect(railBounds.max.y).toBeLessThan(design.worktopTopM);
  }

  applyHomeMotion(motion, { dining: 0, gate: 1, dishwasher: 0 });
  const stowedBase = meshBox(motion.hatch!.baseLeaf);
  const stowedTop = meshBox(motion.hatch!.outerLeafPivot);
  expect(stowedBase.min.z).toBeGreaterThanOrEqual(design.drawerFrontZ - 0.001);
  expect(stowedBase.max.z).toBeLessThanOrEqual(
    design.drawerFrontZ + design.cabinetClearDepthM + 0.001,
  );
  expect(stowedTop.max.y).toBeLessThan(0.915);
  expect(motion.hatch!.front.rotation.x).toBeCloseTo(0, 4);
  expect(motion.hatch!.tray.visible).toBe(false);
  expect(motion.hatch!.stool.visible).toBe(false);
});
test("V9 folding table uses one complete assembly and fits its stowed budget", () => {
  const { motion, model, bounds } = fixture();
  applyHomeMotion(motion, { dining: 1, gate: 1, dishwasher: 0 });
  let b = bounds(motion.table!.group),
    size = b.getSize(new THREE.Vector3());
  expect(size.x).toBeCloseTo(0.96, 2);
  expect(size.z).toBeCloseTo(0.96, 2);
  expect(b.max.y).toBeCloseTo(0.74, 2);
  expect(b.min.y).toBeGreaterThanOrEqual(-0.005);
  applyHomeMotion(motion, { dining: 0, gate: 1, dishwasher: 0 });
  b = bounds(motion.table!.group);
  size = b.getSize(new THREE.Vector3());
  const parked = model.homeDesign.dining.table.parkedEnvelope;
  expect(size.x).toBeLessThanOrEqual(parked.w);
  expect(size.z).toBeLessThanOrEqual(parked.d);
  expect(b.max.y).toBeLessThanOrEqual(parked.h);
  const [a, c] = motion.chairs.map((chair) => bounds(chair.group));
  expect(overlap(a, c), "folded chairs must not intersect").toBe(false);
});
test("V9 outward solid bay ledges do not expand walking polygons or obstruct the clear window band", () => {
  const { v8, model, architecture } = fixture();
  expect(model.rooms).toEqual(v8.rooms);
  expect(model.walls).toEqual(v8.walls);
  for (const bay of model.homeDesign.bayWindows) {
    const solid = architecture.solids.find(
      (s) => s.name === `bay-solid:${bay.roomId}`,
    )!;
    expect(solid.max[1]).toBeCloseTo(0.9, 3);
    if (bay.roomId === "guest") expect(solid.min[0]).toBeLessThan(-0.5);
    else expect(solid.max[0]).toBeGreaterThan(12.15);
  }
  for (const id of ["bar-window-worktop", "bar-window-worktop-connector"]) {
    const top = model.objects.find((o: any) => o.id === id);
    expect(
      Math.max(...top.collisionParts.map((p: any) => p.y + p.h)),
    ).toBeLessThanOrEqual(0.851);
    expect(
      Math.min(...top.collisionParts.map((p: any) => p.y)),
    ).toBeLessThanOrEqual(0.1);
  }
});
test("V9 dishwasher and stacked laundry doors have reversible real part transforms", () => {
  const { motion, bounds } = fixture();
  applyHomeMotion(motion, { dining: 0, gate: 1, dishwasher: 0, laundry: 0 });
  const closed = bounds(motion.dishwasher!.group);
  applyHomeMotion(motion, { dining: 0, gate: 1, dishwasher: 1, laundry: 1 });
  const open = bounds(motion.dishwasher!.group);
  expect(open.max.z).toBeGreaterThan(closed.max.z + 0.4);
  expect(motion.dishwasher!.pivot.rotation.x).toBeCloseTo(-Math.PI / 2, 3);
  expect(motion.laundry).toHaveLength(2);
  for (const item of motion.laundry)
    expect(Math.abs(item.pivot.rotation.y)).toBeGreaterThan(Math.PI / 2);
  applyHomeMotion(motion, { dining: 0, gate: 1, dishwasher: 0, laundry: 0 });
  for (const item of motion.laundry)
    expect(Math.abs(item.pivot.rotation.y)).toBeLessThan(0.000001);
});
test("two sofa modules and mobile television clear peripheral furniture in their complete sampled motions", () => {
  const { model, motion, bounds } = fixture();
  const obstacles = model.objects
    .filter(
      (o: any) =>
        ["living", "hall"].includes(o.room) &&
        !["living-sofa", "living-tv", "ps5", "living-rug"].includes(o.id) &&
        o.type !== "door_leaf",
    )
    .map((o: any) => ({ id: o.id, box: objectBox(o) }));
  const visibleMeshes = (g: THREE.Object3D) => {
    const result: THREE.Mesh[] = [];
    g.traverseVisible((node) => {
      if (node instanceof THREE.Mesh) result.push(node);
    });
    return result;
  };
  const failures: string[] = [];
  let minimumY = Infinity;
  for (let index = 0; index <= 100; index++) {
    for (const sofa of [0, index / 100, 1]) {
      applyHomeMotion(motion, {
        dining: 0,
        gate: 1,
        dishwasher: 0,
        tv: index / 100,
        sofa,
      });
      for (const group of [motion.mobileTV!.group, ...motion.sofaModules]) {
        const b = bounds(group);
        minimumY = Math.min(minimumY, b.min.y);
        for (const mesh of visibleMeshes(group))
          for (const obstacle of obstacles)
            if (overlap(bounds(mesh), obstacle.box))
              failures.push(
                `${group.name} vs ${obstacle.id} tv=${index} sofa=${sofa}`,
              );
      }
      const television = visibleMeshes(motion.mobileTV!.group);
      for (const module of motion.sofaModules)
        for (const cushion of visibleMeshes(module))
          for (const tvPart of television)
            if (overlap(bounds(cushion), bounds(tvPart)))
              failures.push(`TV vs sofa at ${index}/${sofa}`);
    }
  }
  expect(failures.slice(0, 15)).toEqual([]);
  expect(minimumY).toBeGreaterThanOrEqual(-0.002);
  expect(model.homeDesign.mobileTV.stand.locking).toBe(true);
  expect(model.homeDesign.modularSofa.middleArmrest).toBe(false);
  expect(motion.sofaModules).toHaveLength(2);
});

test("two tabletop leaves have no volume overlap during the complete fold sequence",()=>{
  const {motion}=fixture();
  const first=motion.hatch!.baseLeaf;
  const second=motion.hatch!.outerLeafPivot.children.find(o=>(o as THREE.Mesh).isMesh) as THREE.Mesh;
  const obb=(mesh:THREE.Mesh)=>{
    mesh.updateWorldMatrix(true,false);
    mesh.geometry.computeBoundingBox();
    const box=new OBB().fromBox3(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
    box.halfSize.addScalar(-0.0002); // ignore touching finished edges under 0.4mm combined tolerance
    return box;
  };
  for(let step=0;step<=200;step++){
    applyHomeMotion(motion,{dining:0,gate:1-step/200,dishwasher:0});
    expect(obb(first).intersectsOBB(obb(second)),`leaf volume at ${step/2}%`).toBe(false);
  }
});
