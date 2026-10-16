import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { createUpperBathMirror, planarMirrorBudget } from "../src/planar-mirror";

test("planar mirror resolution stays within the mobile and desktop edge budgets", () => {
  const mobile = planarMirrorBudget(true);
  const desktop = planarMirrorBudget(false);
  expect(mobile.perLeafEdge).toBe(512);
  expect(desktop.perLeafEdge).toBe(1024);
  expect(mobile.samples).toBe(4);
  expect(desktop.samples).toBe(4);
  expect(mobile.totalPixelBudget).toBe(2 * 512 ** 2);
  expect(desktop.totalPixelBudget).toBe(2 * 1024 ** 2);
  expect(mobile.totalSamplePixelBudget).toBe(2 * 512 ** 2 * 4);
  expect(desktop.totalSamplePixelBudget).toBe(2 * 1024 ** 2 * 4);
});

test("final bath mirror cabinet gets one bounded official reflector per moving leaf", async () => {
  const scene = new THREE.Scene();
  const storage = new THREE.Group();
  storage.name = "upper-bath-mirror";
  scene.add(storage);
  const mirrorMaterial = new THREE.MeshStandardMaterial({ color: "#c6c8c4", metalness: 0.95, roughness: 0.08 });
  mirrorMaterial.name = "mirror";
  for (let i = 0; i < 2; i++) {
    const hinge = new THREE.Group();
    hinge.name = `leaf-hinge-${i}`;
    storage.add(hinge);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.1, 0.02), mirrorMaterial);
    hinge.add(leaf);
  }
  const reflectors = await createUpperBathMirror({
    scene,
    renderer: {},
    model: { objects: [{ id: "upper-bath-mirror", type: "wall_storage", fronts: ["mirror"] }] },
    materials: { mirror: mirrorMaterial },
    mobile: true,
    backend: "webgl",
  });
  const audit = reflectors.audit();
  expect(audit.enabled).toBe(true);
  expect(audit.enabledLeafCount).toBe(2);
  expect(audit.perLeafWidth).toBe(512);
  expect(audit.perLeafHeight).toBe(512);
  expect(audit.samples).toBe(4);
  expect(audit.totalPixelBudget).toBe(2 * 512 ** 2);
  expect(audit.totalSamplePixelBudget).toBe(2 * 512 ** 2 * 4);
  expect(audit.note).toContain("Live output remains unverified");
  const surfaces = storage.children.flatMap((hinge) => hinge.children[0].children);
  expect(surfaces.filter((node) => (node as any).isReflector)).toHaveLength(2);
  await Promise.resolve();
  reflectors.dispose();
  expect(storage.getObjectByName("upper-bath-mirror-reflector:1")).toBeUndefined();
  mirrorMaterial.dispose();
  storage.traverse((node) => {
    if (node instanceof THREE.Mesh) node.geometry.dispose();
  });
});
