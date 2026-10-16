import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { buildPegboard } from "../src/pegboard-mesh";
test("pegboard uses actual through-holes, stand-offs and bounded removable accessories", () => {
  for (const o of [
    { room: "master", w: 2.2, h: 0.56, d: 0.14 },
    { room: "hall", w: 0.82, h: 0.64, d: 0.14 },
  ]) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial();
    buildPegboard(group, o, {
      oak: mat,
      darkoak: mat,
      bronze: mat,
      linen: mat,
      charcoal: mat,
    });
    group.updateMatrixWorld(true);
    const sheet = group.getObjectByName("perforated-panel")!;
    const ray = new THREE.Raycaster(
      new THREE.Vector3(-o.w / 2 + 0.065, 0.065, -1),
      new THREE.Vector3(0, 0, 1),
    );
    expect(ray.intersectObject(sheet).length).toBe(0);
    ray.set(
      new THREE.Vector3(-o.w / 2 + 0.04, 0.065, -1),
      new THREE.Vector3(0, 0, 1),
    );
    expect(ray.intersectObject(sheet).length).toBeGreaterThan(0);
    const b = new THREE.Box3().setFromObject(group);
    expect(b.min.z).toBeGreaterThanOrEqual(-o.d / 2 - 0.001);
    expect(b.max.z).toBeLessThanOrEqual(o.d / 2 + 0.001);
    expect(group.userData.pegboard.holeCount).toBeGreaterThan(30);
  }
});
