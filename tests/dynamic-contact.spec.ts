import { test, expect } from "@playwright/test";
import * as THREE from "three";
import {
  attachDynamicContact,
  DYNAMIC_CONTACT_DRAW_CALL_BUDGET,
} from "../src/dynamic-contact";

test("dynamic contact follows a movable root and stays at floor height", () => {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = "sofa-module-1";
  scene.add(root);
  const shadow = attachDynamicContact(root, { w: 1.275, d: 1.05 });

  root.position.set(8.7, 0, 6.6);
  root.rotation.y = Math.PI / 2;
  scene.updateMatrixWorld(true);
  const first = shadow.getWorldPosition(new THREE.Vector3());
  expect(first.x).toBeCloseTo(8.7, 8);
  expect(first.y).toBeCloseTo(0, 8);
  expect(first.z).toBeCloseTo(6.6, 8);

  root.position.set(7.85, 0, 6.75);
  root.rotation.y = -Math.PI / 3;
  scene.updateMatrixWorld(true);
  const moved = shadow.getWorldPosition(new THREE.Vector3());
  expect(moved.x).toBeCloseTo(7.85, 8);
  expect(moved.y).toBeCloseTo(0, 8);
  expect(moved.z).toBeCloseTo(6.75, 8);
  expect(shadow.rotation.x).toBeCloseTo(-Math.PI / 2, 8);
});

test("dynamic contact is a soft render-only plane with bounded draw cost", () => {
  const root = new THREE.Group();
  root.name = "mobile-tv";
  root.userData.physicsBody = { id: "unchanged-body" };
  const shadow = attachDynamicContact(root, {
    w: 1.65,
    d: 0.55,
    strength: 0.18,
  });

  expect(shadow.userData.dynamicContactShadow).toBe(true);
  expect(shadow.userData.physicsBody).toBe(false);
  expect(root.userData.physicsBody).toEqual({ id: "unchanged-body" });
  expect(shadow.castShadow).toBe(false);
  expect(shadow.receiveShadow).toBe(false);
  expect(shadow.raycast).not.toBe(THREE.Mesh.prototype.raycast);
  expect((shadow.material as THREE.MeshBasicMaterial).depthWrite).toBe(false);
  expect((shadow.material as THREE.MeshBasicMaterial).transparent).toBe(true);
  expect((shadow.material as THREE.MeshBasicMaterial).opacity).toBeLessThanOrEqual(0.2);
  expect(shadow.geometry).toBeInstanceOf(THREE.PlaneGeometry);
  expect(DYNAMIC_CONTACT_DRAW_CALL_BUDGET).toBeLessThanOrEqual(8);
});
