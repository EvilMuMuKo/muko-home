import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { buildSoftBedding, createPillowGeometry, createRunnerGeometry } from "../src/soft-bedding";

test("soft pillows stay inside the mattress, contact its top, and have finite metric geometry", () => {
  const bed = { w: 1.8, d: 2, h: 0.42 };
  const g = createPillowGeometry(0.7, 0.43);
  const p = g.getAttribute("position"), uv = g.getAttribute("uv"), n = g.getAttribute("normal");
  g.computeBoundingBox();
  expect(g.boundingBox!.min.y).toBeCloseTo(-0.05, 3);
  expect(g.boundingBox!.max.y - g.boundingBox!.min.y).toBeCloseTo(0.13, 3);
  expect(bed.h + 0.05 + g.boundingBox!.min.y).toBeCloseTo(bed.h, 4);
  let flattenedContacts = 0;
  expect(p.count * 2).toBeLessThanOrEqual(3_000);
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(p.getY(i) + 0.05) < 1e-5) flattenedContacts++;
    for (let c = 0; c < 3; c++) expect(Number.isFinite(p.getComponent(i, c))).toBeTruthy();
    for (let c = 0; c < 2; c++) expect(Number.isFinite(uv.getComponent(i, c))).toBeTruthy();
    const length = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
    expect(Number.isFinite(length) && length > 0.98 && length < 1.02).toBeTruthy();
  }
  expect(flattenedContacts).toBeGreaterThan(20);
  expect(Math.max(0.47 + g.boundingBox!.max.x, -0.47 - g.boundingBox!.min.x)).toBeLessThanOrEqual(bed.w / 2);
  expect(Math.abs(-0.68) + 0.43 / 2).toBeLessThanOrEqual(bed.d / 2);
});

test("runner is softly waved, metric, and drapes down at the mattress foot", () => {
  const g = createRunnerGeometry(1.81, 2);
  const p = g.getAttribute("position"), uv = g.getAttribute("uv"), n = g.getAttribute("normal");
  g.computeBoundingBox();
  expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBeCloseTo(1.81, 4);
  expect(g.boundingBox!.max.z).toBeCloseTo(1.035, 3);
  const rowStride = 25;
  const centerY = p.getY(8 * rowStride + 12);
  const footY = p.getY(16 * rowStride + 12);
  expect(footY).toBeLessThan(centerY - 0.1);
  expect(n.getY(8 * rowStride + 12)).toBeGreaterThan(0.98);
  for (let i = 0; i < p.count; i++) {
    for (let c = 0; c < 3; c++) expect(Number.isFinite(p.getComponent(i, c))).toBeTruthy();
    for (let c = 0; c < 2; c++) expect(Number.isFinite(uv.getComponent(i, c))).toBeTruthy();
    const length = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
    expect(Number.isFinite(length) && length > 0.98 && length < 1.02).toBeTruthy();
  }
});

test("buildSoftBedding adds two piped pillows and one light sage runner under the geometry budget", () => {
  const parent = new THREE.Group();
  const linen = new THREE.MeshStandardMaterial({ color: "#eeeae0" });
  const sage = new THREE.MeshStandardMaterial({ color: "#78816f" });
  const result = buildSoftBedding(parent, { w: 1.8, d: 2, h: 0.42 }, { linen, sage });
  expect(result.pillows).toHaveLength(2);
  expect(parent.children.filter((o) => o.name === "soft-bedding:pillow-piping")).toHaveLength(2);
  expect(result.runner.material).not.toBe(sage);
  expect((result.runner.material as THREE.Material).side).toBe(THREE.DoubleSide);
  expect(result.triangleCount).toBeLessThan(10_000);
  expect(result.pillows.every((mesh) => mesh.geometry.index!.count / 3 < 3_000)).toBeTruthy();
  parent.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
  linen.dispose(); sage.dispose(); (result.runner.material as THREE.Material).dispose();
});
