import { test, expect } from "@playwright/test";
import * as THREE from "three";
import {
  attachBrushedMetals,
  auditMaterialSet,
  brushedMetalTextures,
  sampleAnisotropy,
} from "../src/material-detail";

function meanChannel(data: Uint8Array, offset: number) {
  let sum = 0;
  let count = 0;
  for (let i = offset; i < data.length; i += 4) {
    sum += data[i];
    count++;
  }
  return sum / count;
}

test("steel and bronze keep independent brushed maps and light normals", () => {
  const steel = brushedMetalTextures("steel", 4);
  const bronze = brushedMetalTextures("bronze", 4);
  expect(steel.roughnessMap).not.toBe(bronze.roughnessMap);
  expect(steel.normalMap).not.toBe(bronze.normalMap);
  const steelRough = steel.roughnessMap.image.data as Uint8Array;
  const bronzeRough = bronze.roughnessMap.image.data as Uint8Array;
  expect(steelRough).not.toEqual(bronzeRough);
  expect(meanChannel(steelRough, 0)).toBeGreaterThan(65);
  expect(meanChannel(steelRough, 0)).toBeLessThan(80);
  expect(meanChannel(bronzeRough, 0)).toBeGreaterThan(85);
  expect(meanChannel(bronzeRough, 0)).toBeLessThan(100);
  for (const maps of [steel, bronze]) {
    expect(maps.roughnessMap.colorSpace).toBe(THREE.NoColorSpace);
    expect(maps.normalMap.colorSpace).toBe(THREE.NoColorSpace);
    expect(maps.roughnessMap.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(maps.roughnessMap.magFilter).toBe(THREE.LinearFilter);
    expect(maps.roughnessMap.generateMipmaps).toBe(true);
    expect(maps.normalMap.anisotropy).toBe(4);
    const normals = maps.normalMap.image.data as Uint8Array;
    for (let i = 0; i < normals.length; i += 4) expect(normals[i + 2]).toBeGreaterThan(250);
    maps.roughnessMap.dispose();
    maps.normalMap.dispose();
  }
  expect(steel.roughnessMap.userData.materialAudit.family).toBe("brushed steel");
  expect(bronze.roughnessMap.userData.materialAudit.family).toBe("brushed bronze");
});

test("wall and paint maps stay off the brushed metal noise", () => {
  const plasterRough = new THREE.DataTexture(new Uint8Array([9, 9, 9, 255]), 1, 1);
  plasterRough.name = "wall-roughness";
  const paint = new THREE.DataTexture(new Uint8Array([200, 200, 200, 255]), 1, 1);
  paint.name = "paint-micro";
  const materials = {
    plaster: new THREE.MeshStandardMaterial({ roughnessMap: plasterRough }),
    upperPaint: new THREE.MeshStandardMaterial({ roughnessMap: paint }),
    cabinetPaint: new THREE.MeshStandardMaterial({ roughnessMap: paint }),
    steel: new THREE.MeshStandardMaterial(),
    bronze: new THREE.MeshStandardMaterial(),
  };
  attachBrushedMetals(materials, 2);
  expect(materials.plaster.roughnessMap).toBe(plasterRough);
  expect(materials.upperPaint.roughnessMap).toBe(paint);
  expect(materials.cabinetPaint.roughnessMap).toBe(paint);
  expect(materials.steel.roughnessMap?.userData.materialAudit.family).toBe("brushed steel");
  expect(materials.bronze.roughnessMap?.userData.materialAudit.family).toBe("brushed bronze");
  expect(materials.steel.roughnessMap).not.toBe(materials.bronze.roughnessMap);
  expect(materials.steel.normalMap).not.toBe(materials.bronze.normalMap);
  expect(materials.steel.roughness).toBe(1);
  expect(materials.bronze.metalness).toBe(1);
  const audit = auditMaterialSet(materials);
  const steel = audit.find((entry) => entry.key === "steel");
  expect(steel?.channels.find((channel) => channel.channel === "roughnessMap")).toMatchObject({
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
  });
  for (const material of Object.values(materials)) material.dispose();
  plasterRough.dispose();
  paint.dispose();
});

test("anisotropy uses WebGL capabilities or the initialized WebGPU backend", () => {
  expect(sampleAnisotropy({ capabilities: { getMaxAnisotropy: () => 16 } })).toBe(8);
  expect(sampleAnisotropy({ capabilities: { getMaxAnisotropy: () => 2 } })).toBe(2);
  expect(sampleAnisotropy({ backend: { isWebGPUBackend: true } })).toBe(8);
  expect(sampleAnisotropy({ backend: { isWebGPUBackend: false } })).toBe(1);
  expect(sampleAnisotropy({})).toBe(1);
});
