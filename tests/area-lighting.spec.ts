import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { alignAreaLight } from "../src/area-lighting";

test("area light width follows fixture axis and local -Z points at target", () => {
  const light = new THREE.RectAreaLight();
  const fixture = {
    position: [1.5, 2, 3],
    target: [1.5, 0, 3],
    axis: "x" as const,
    length: 0.82,
    lumens: 650,
  };
  alignAreaLight(light, fixture, 0xffd8a8, 0.5, 0.2);

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(light.quaternion);
  expect(forward.x).toBeCloseTo(0, 8);
  expect(forward.y).toBeCloseTo(-1, 8);
  expect(forward.z).toBeCloseTo(0, 8);
  const widthAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(light.quaternion);
  expect(Math.abs(widthAxis.dot(new THREE.Vector3(1, 0, 0)))).toBeCloseTo(1, 8);
  expect(light.position.toArray()).toEqual(fixture.position);
  expect(light.width).toBeCloseTo(0.82, 8);
  expect(light.height).toBeCloseTo(0.035, 8);
  expect(light.castShadow).toBe(false);
});

test("area light intensity scales by scene level and preview cap", () => {
  const fixture = {
    position: [0, 2, 0],
    target: [0, 0, 0],
    axis: "z" as const,
    length: 0.8,
    lumens: 520,
  };
  const light = new THREE.RectAreaLight();
  alignAreaLight(light, fixture, 0xffffff, 0, 0.2);
  expect(light.intensity).toBe(0);
  expect(Number.isFinite(light.intensity)).toBe(true);

  alignAreaLight(light, fixture, 0xffffff, 1, 100);
  expect(light.intensity).toBe(250);
  expect(Number.isFinite(light.intensity)).toBe(true);
  expect(light.userData.areaLightPreviewOnly).toBe(true);
});
