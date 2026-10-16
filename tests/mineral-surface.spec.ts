import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { mineralSurface } from "../src/mineral-surface";

test("authored mineral uses matched PBR data channels, physical scale and mild relief", () => {
  const surface = mineralSurface(32);
  expect(surface.map.colorSpace).toBe(THREE.SRGBColorSpace);
  expect(surface.normalMap.colorSpace).toBe(THREE.NoColorSpace);
  expect(surface.roughnessMap.colorSpace).toBe(THREE.NoColorSpace);
  expect(surface.map.repeat.x).toBeCloseTo(1 / .6);
  const normals = surface.normalMap.image.data;
  const rough = surface.roughnessMap.image.data;
  for (let i = 0; i < normals.length; i += 4) {
    expect(normals[i + 2]).toBeGreaterThan(250);
    expect(rough[i + 1]).toBeGreaterThan(155);
    expect(rough[i + 1]).toBeLessThan(182);
  }
  Object.values(surface).forEach(texture => texture.dispose());
});
