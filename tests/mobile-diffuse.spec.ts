import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { createMobileDiffuseBounce } from "../src/mobile-diffuse";
import type { DiffuseBounceData } from "../src/diffuse-bounce";

function data(roomId: string, fill = 0): DiffuseBounceData {
  return {
    version: 1,
    roomId,
    backend: "webgpu",
    bounds: { min: [0, 0.25, 0], max: [2, 2.55, 2] },
    resolution: [2, 2, 2],
    atlas: { width: 2, height: 2, depth: 28, format: "half-float", rgba: Array(448).fill(fill) },
    bake: { mode: "offline-static-architecture", cubemapSize: 8, bounces: 1, sampleCount: 128, sampleMode: "webgpu-directions" },
  };
}

const validate = (value: DiffuseBounceData) =>
  value.atlas.width === 2 && value.atlas.height === 2 && value.atlas.depth === 28 && value.atlas.rgba.length === 448
    ? null
    : "invalid fixture";

function atlasIndex(component: number, x: number, y: number, z: number) {
  const block = Math.floor(component / 4);
  const channel = component % 4;
  return ((((block * 4 + 1 + z) * 2 + y) * 2 + x) * 4 + channel);
}

test("mobile SH averages eight probes per packed coefficient and ignores padding slices", () => {
  const scene = new THREE.Scene();
  const service = createMobileDiffuseBounce({ scene, validate });
  const input = data("room", 0x7bff);
  for (let component = 0; component < 27; component++) {
    for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const probeIndex = (z * 2 + y) * 2 + x;
      input.atlas.rgba[atlasIndex(component, x, y, z)] = 0x3c00 + probeIndex;
    }
  }
  service.install(input);
  service.setRoom("room");
  const probe = scene.children.find((child) => (child as THREE.LightProbe).isLightProbe) as THREE.LightProbe;
  for (let component = 0; component < 27; component++) {
    const coefficient = Math.floor(component / 3);
    const channel = component % 3;
    expect(probe.sh.coefficients[coefficient].getComponent(channel)).toBeCloseTo(1 + 3.5 / 1024);
  }
  service.dispose();
});

test("negative half SH values decode and hall remains neutral with one persistent probe", () => {
  const scene = new THREE.Scene();
  const service = createMobileDiffuseBounce({ scene, validate });
  service.install(data("living", 0xbc00));
  service.setRoom("living");
  const probe = scene.children[0] as THREE.LightProbe;
  const uuid = probe.uuid;
  const coefficient = probe.sh.coefficients[0].clone();
  expect(coefficient.x).toBe(-1);

  service.setRoom("hall");
  expect(probe.sh.coefficients.every((value) => value.length() === 0)).toBe(true);
  service.setRoom("living");
  expect(scene.children).toHaveLength(1);
  expect(scene.children[0].uuid).toBe(uuid);
  expect(service.audit()).toMatchObject({ backend: "mobile-sh", bakeCount: 0, activeGridCount: 0, activeProbeCount: 1, currentRoom: "living" });
  service.dispose();
  service.dispose();
  expect(scene.children).toHaveLength(0);
  expect(service.audit().activeProbeCount).toBe(0);
});

test("reinstalling the active room updates the same probe and intensity stays capped", () => {
  const scene = new THREE.Scene();
  const service = createMobileDiffuseBounce({ scene, validate });
  const first = data("room", 0x3c00);
  service.install(first);
  service.setRoom("room");
  const probe = scene.children[0] as THREE.LightProbe;
  const uuid = probe.uuid;
  service.setIntensity(100);
  expect(probe.intensity).toBe(0.35);

  service.install(data("room", 0x4000));
  expect(scene.children).toHaveLength(1);
  expect(scene.children[0].uuid).toBe(uuid);
  expect(probe.sh.coefficients[0].x).toBe(2);
  expect(probe.intensity).toBe(0.35);
  service.setIntensity(-1);
  expect(probe.intensity).toBe(0);
  service.dispose();
});

test("validation rejects malformed data and runtime bake remains unavailable", async () => {
  const scene = new THREE.Scene();
  const service = createMobileDiffuseBounce({ scene, validate: () => "bad atlas" });
  expect(() => service.install(data("room"))).toThrow("bad atlas");
  await expect(service.bakeRoom("room")).rejects.toThrow(/does not support runtime baking/);
  expect(service.audit().cachedRooms).toEqual([]);
  service.dispose();
});
