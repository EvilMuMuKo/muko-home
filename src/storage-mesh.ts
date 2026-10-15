import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { StorageUnit } from "./storage-design";
import { metricUV } from "./texture-mapping";
export interface StorageDoor {
  pivot: THREE.Group;
  sign: number;
  unitId: string;
  axis?: "x";
  openAngle?: number;
}
export function buildStorageUnit(
  group: THREE.Group,
  unit: StorageUnit,
  materials: Record<string, THREE.Material>,
  doors: StorageDoor[],
) {
  const t = 0.018,
    front = -unit.d / 2,
    inside = unit.d - t,
    body: THREE.Mesh[] = [];
  function box(
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: string,
    bevel = 0.0015,
  ) {
    const geo = new RoundedBoxGeometry(
      w,
      h,
      d,
      1,
      Math.min(bevel, w / 4, h / 4, d / 4),
    );
    metricUV(geo);
    const mesh = new THREE.Mesh(geo, materials[material] ?? materials.oak);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const board = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m = "oak",
  ) => {
    const mesh = box(group, w, h, d, x, y, z, m);
    body.push(mesh);
    return mesh;
  };
  board(unit.w, t, unit.d, 0, t / 2, 0);
  board(unit.w, t, unit.d, 0, unit.h - t / 2, 0);
  board(t, unit.h - 2 * t, unit.d, -unit.w / 2 + t / 2, unit.h / 2, 0);
  board(t, unit.h - 2 * t, unit.d, unit.w / 2 - t / 2, unit.h / 2, 0);
  board(
    unit.w - 2 * t,
    unit.h - 2 * t,
    t,
    0,
    unit.h / 2,
    unit.d / 2 - t / 2,
    "cabinetInterior",
  );
  const bay = (unit.w - (unit.fronts.length + 1) * t) / unit.fronts.length;
  for (let col = 0; col < unit.fronts.length; col++) {
    const left = -unit.w / 2 + t + col * (bay + t),
      cx = left + bay / 2,
      style = unit.fronts[col];
    if (col > 0)
      board(t, unit.h - 2 * t, inside, left - t / 2, unit.h / 2, -t / 2);
    for (const level of unit.shelves)
      board(bay, t, inside - 0.016, cx, level + t / 2, -t / 2);
    if (style !== "open") {
      const topLift =
        unit.room === "kitchen" ||
        unit.id === "upper-master-work" ||
        unit.access === "seasonal";
      const leaves = topLift ? 1 : style === "mirror" || bay > 0.72 ? 2 : 1,
        leafWidth = (bay + 0.012) / leaves - 0.003;
      for (let leaf = 0; leaf < leaves; leaf++) {
        const side =
          leaves === 1 ? (col % 2 === 0 ? -1 : 1) : leaf === 0 ? -1 : 1;
        const hinge = new THREE.Group();
        hinge.position.set(
          topLift
            ? left + bay / 2
            : side === -1
              ? left - 0.004
              : left + bay + 0.004,
          topLift ? unit.h - 0.003 : 0.003,
          front - 0.008,
        );
        group.add(hinge);
        const center = topLift ? 0 : (-side * leafWidth) / 2,
          height = unit.h - 0.006,
          bias = topLift ? -height : 0;
        if (style === "glass") {
          box(
            hinge,
            leafWidth - 0.052,
            height - 0.052,
            0.006,
            center,
            bias + height / 2,
            0,
            "displayGlass",
            0,
          );
          for (const sign of [-1, 1])
            box(
              hinge,
              0.026,
              height,
              0.02,
              center + sign * (leafWidth / 2 - 0.013),
              bias + height / 2,
              0,
              "oak",
            );
          for (const y of [0.013, height - 0.013])
            box(
              hinge,
              leafWidth - 0.052,
              0.026,
              0.02,
              center,
              bias + y,
              0,
              "oak",
            );
        } else
          box(
            hinge,
            leafWidth,
            height,
            0.02,
            center,
            bias + height / 2,
            0,
            style === "mirror" ? "mirror" : unit.material,
          );
        if (style !== "mirror")
          box(
            hinge,
            0.07,
            0.009,
            0.012,
            center - side * (leafWidth / 2 - 0.08),
            bias + Math.min(height - 0.045, 0.14),
            -0.017,
            "bronze",
            0.002,
          );
        doors.push({
          pivot: hinge,
          sign: side,
          unitId: unit.id,
          ...(topLift ? { axis: "x" as const, openAngle: Math.PI * 0.47 } : {}),
        });
      }
    }
    if (unit.contents && (style === "open" || style === "glass")) {
      const levels = [t, ...unit.shelves.map((y) => y + t)];
      for (let row = 0; row < levels.length; row++) {
        const floor = levels[row],
          ceiling = [...unit.shelves, unit.h - t][row];
        if (ceiling - floor < 0.16) continue;
        if (unit.contents === "books")
          for (let j = 0; j < Math.min(5, Math.floor(bay / 0.065)); j++) {
            const h = Math.min(0.22 + (j % 3) * 0.018, ceiling - floor - 0.018);
            board(
              0.035 + (j % 2) * 0.008,
              h,
              Math.min(unit.d - 0.075, 0.18),
              left + 0.06 + j * 0.055,
              floor + h / 2,
              -0.008,
              ["bookClay", "bookSage", "bookCream"][j % 3],
            );
          }
        if (unit.contents === "boxes")
          board(
            Math.min(bay - 0.06, 0.25),
            Math.min(ceiling - floor - 0.035, 0.16),
            unit.d - 0.07,
            cx,
            floor + 0.08,
            0,
            "linen",
          );
        if (unit.contents === "cups")
          for (let j = 0; j < Math.min(3, Math.floor(bay / 0.12)); j++) {
            const cup = new THREE.Mesh(
              new THREE.CylinderGeometry(0.035, 0.031, 0.085, 20, 1, true),
              materials.cream,
            );
            cup.position.set(left + 0.08 + j * 0.12, floor + 0.0425, -0.025);
            group.add(cup);
            body.push(cup);
          }
      }
    }
  }
  if (unit.hangingGlasses)
    for (const x of [-0.375, -0.095, 0.185])
      for (const dx of [-0.025, 0.025])
        board(0.01, 0.008, 0.22, x + dx, -0.018, 0.03, "steel");
  // Merge the static shell and contents; door pivots stay independent and inspectable.
  const buckets = new Map<THREE.Material, THREE.Mesh[]>();
  for (const mesh of body) {
    const material = mesh.material as THREE.Material;
    if (!buckets.has(material)) buckets.set(material, []);
    buckets.get(material)!.push(mesh);
  }
  for (const [material, meshes] of buckets) {
    const copies = meshes.map((mesh) => {
      mesh.updateMatrix();
      const copy = mesh.geometry.clone().applyMatrix4(mesh.matrix);
      if (!copy.index) return copy;
      const flat = copy.toNonIndexed();
      copy.dispose();
      return flat;
    });
    const merged = mergeGeometries(copies);
    copies.forEach((g) => g.dispose());
    if (!merged) continue;
    for (const mesh of meshes) {
      group.remove(mesh);
      mesh.geometry.dispose();
    }
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = unit.id + ":shell";
    group.add(mesh);
  }
  group.userData.storage = {
    label: unit.label,
    purpose: unit.purpose,
    access: unit.access,
  };
}
