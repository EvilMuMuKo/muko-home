import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { createDiffuseBounce, diffuseRoomBounds, unpackPaddedAtlasRows, validateDiffuseBounceData, type DiffuseBounceData } from "../src/diffuse-bounce";

const model = { rooms: [
  { id: "box", polygon: [[0, 0], [4, 0], [4, 3], [0, 3]] as [number, number][] },
  { id: "notch", polygon: [[0, 0], [5, 0], [5, 5], [3, 5], [3, 2], [2, 2], [2, 5], [0, 5]] as [number, number][] },
  { id: "hall", polygon: [[4, 0], [8, 0], [8, 5], [4, 5]] as [number, number][] },
] };

test("probe volume bounds fit inside a room and reject the overlapping hall", () => {
  const box = diffuseRoomBounds(model, "box");
  expect(box.min[0]).toBeGreaterThan(0);
  expect(box.max[0]).toBeLessThan(4);
  expect(box.min[2]).toBeGreaterThan(0);
  expect(box.max[2]).toBeLessThan(3);
  const notch = diffuseRoomBounds(model, "notch");
  const polygon = model.rooms[1].polygon;
  for (const [x, z] of [[notch.min[0], notch.min[2]], [notch.min[0], notch.max[2]], [notch.max[0], notch.min[2]], [notch.max[0], notch.max[2]], [(notch.min[0] + notch.max[0]) / 2, (notch.min[2] + notch.max[2]) / 2]]) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, zi] = polygon[i], [xj, zj] = polygon[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    expect(inside).toBe(true);
  }
  expect(() => diffuseRoomBounds(model, "hall")).toThrow(/excludes the hall/);
  expect(() => diffuseRoomBounds(model, "missing")).toThrow(/no valid polygon/);
});

test("serialized atlas validation enforces finite packed SH payload and bounded grid", () => {
  const valid: DiffuseBounceData = {
    version: 1, roomId: "box", backend: "webgpu",
    bounds: { min: [0, 0.25, 0], max: [2, 2.55, 2] }, resolution: [2, 2, 2],
    atlas: { width: 2, height: 2, depth: 28, format: "half-float", rgba: Array(448).fill(0) },
    bake: { mode: "offline-static-architecture", cubemapSize: 8, bounces: 1, sampleCount: 128, sampleMode: "webgpu-directions" },
  };
  expect(validateDiffuseBounceData(valid)).toBeNull();
  expect(validateDiffuseBounceData({ ...valid, atlas: { ...valid.atlas, rgba: [...valid.atlas.rgba.slice(0, -1), NaN] } })).toMatch(/malformed or non-finite/);
  expect(validateDiffuseBounceData({ ...valid, bounds: { min: [1, 0, 0], max: [1, 1, 1] } })).toMatch(/bounds are invalid/);
  expect(validateDiffuseBounceData({ ...valid, atlas: { ...valid.atlas, rgba: valid.atlas.rgba.slice(1) } })).toMatch(/malformed or non-finite/);
  expect(validateDiffuseBounceData({ ...valid, backend: "webgl" })).toMatch(/provenance is inconsistent/);
});

test("WebGPU padded RGBA16 rows are unpacked into the dense atlas slice layout", () => {
  const padded = new Uint16Array(136);
  padded.set([1, 2, 3, 4, 5, 6, 7, 8], 0);
  padded.set([9, 10, 11, 12, 13, 14, 15, 16], 128);
  expect([...unpackPaddedAtlasRows(padded, 2, 2)]).toEqual(Array.from({ length: 16 }, (_, index) => index + 1));
  expect(() => unpackPaddedAtlasRows(new Uint16Array(135), 2, 2)).toThrow(/invalid padded row buffer/);
});

test("service is lazy and does not claim a bake from a non-renderer", async () => {
  const scene = new THREE.Scene();
  const service = await createDiffuseBounce({ renderer: {}, scene, model, backend: "webgpu" });
  expect(service.audit().bakeCount).toBe(0);
  expect(service.audit().activeGridCount).toBe(0);
  await expect(service.bakeRoom("box")).rejects.toThrow(/requires an initialized matching/);
  expect(service.audit().bakeCount).toBe(0);
  expect(service.audit().lastError).toBeNull();
  service.dispose();
});

test("a WebGPU half-float atlas installs in WebGL and applies the capped runtime intensity", async () => {
  const scene = new THREE.Scene();
  const service = await createDiffuseBounce({ renderer: {}, scene, model, backend: "webgl" });
  const data: DiffuseBounceData = {
    version: 1, roomId: "box", backend: "webgpu",
    bounds: { min: [0, 0.25, 0], max: [2, 2.55, 2] }, resolution: [2, 2, 2],
    atlas: { width: 2, height: 2, depth: 28, format: "half-float", rgba: Array(448).fill(0x3c00) },
    bake: { mode: "offline-static-architecture", cubemapSize: 8, bounces: 1, sampleCount: 128, sampleMode: "webgpu-directions" },
  };
  service.install(data);
  service.setRoom("box");
  const grid = scene.children.find((child) => (child as any).isLightProbeGrid) as any;
  expect(grid).toBeTruthy();
  expect(grid.texture.type).toBe(THREE.FloatType);
  expect(grid.texture.image.data).toBeInstanceOf(Float32Array);
  expect(grid.texture.image.data[0]).toBeCloseTo(0.6);
  service.setIntensity(2);
  expect(grid.parent).toBeNull();
  const replacedGrid = scene.children.find((child) => (child as any).isLightProbeGrid) as any;
  expect(replacedGrid.texture.image.data[0]).toBeCloseTo(0.6);
  service.dispose();
});

test("WebGPU install registers Three's LightProbeGrid node without invoking a bake", async () => {
  const registrations: Array<[Function, Function]> = [];
  const renderer = { library: { getLightNodeClass: () => null, addLight: (node: Function, light: Function) => registrations.push([node, light]) } };
  const scene = new THREE.Scene();
  const service = await createDiffuseBounce({ renderer, scene, model, backend: "webgpu" });
  const data: DiffuseBounceData = {
    version: 1, roomId: "box", backend: "webgpu",
    bounds: { min: [0, 0.25, 0], max: [2, 2.55, 2] }, resolution: [2, 2, 2],
    atlas: { width: 2, height: 2, depth: 28, format: "half-float", rgba: Array(448).fill(0) },
    bake: { mode: "offline-static-architecture", cubemapSize: 8, bounces: 1, sampleCount: 128, sampleMode: "webgpu-directions" },
  };
  service.install(data);
  expect(registrations).toHaveLength(1);
  expect(registrations[0][0].name).toBe("LightProbeGridNode");
  expect(registrations[0][1].name).toBe("LightProbeGrid");
  service.setRoom("box");
  const grid = scene.children.find((child) => (child as any).isLightProbeGrid) as any;
  expect(grid.falloff).toBe(0.7);
  expect(service.audit().bakeCount).toBe(0);
  service.dispose();
});

test("half-float payload accepts sign-bit SH coefficients and rejects invalid bit patterns", () => {
  const half: DiffuseBounceData = {
    version: 1, roomId: "box", backend: "webgpu",
    bounds: { min: [0, 0.25, 0], max: [2, 2.55, 2] }, resolution: [2, 2, 2],
    atlas: { width: 2, height: 2, depth: 28, format: "half-float", rgba: Array(448).fill(0) },
    bake: { mode: "offline-static-architecture", cubemapSize: 8, bounces: 1, sampleCount: 128, sampleMode: "webgpu-directions" },
  };
  const withTexel = (value: number, index = 0): DiffuseBounceData => ({
    ...half,
    atlas: { ...half.atlas, rgba: half.atlas.rgba.map((texel, i) => i === index ? value : texel) },
  });
  // Sign bit set: -0, -1, and the most negative finite half. These stay valid SH coefficients.
  for (const bits of [0x8000, 0xbc00, 0xfbff]) expect(validateDiffuseBounceData(withTexel(bits))).toBeNull();
  expect(validateDiffuseBounceData({ ...half, atlas: { ...half.atlas, rgba: Array(448).fill(0xbc00) } })).toBeNull();
  // Exponent 31 is finite as a JS integer and non-finite after half decoding: +Inf, NaN, -Inf, NaN.
  for (const bits of [0x7c00, 0x7c01, 0x7e00, 0x7fff, 0xfc00, 0xffff]) {
    expect(validateDiffuseBounceData(withTexel(bits, 17))).toMatch(/malformed or non-finite/);
  }
  for (const bits of [-1, -1024]) expect(validateDiffuseBounceData(withTexel(bits))).toMatch(/malformed or non-finite/);
  for (const bits of [0.5, 1.5, 32768.5]) expect(validateDiffuseBounceData(withTexel(bits))).toMatch(/malformed or non-finite/);
  for (const bits of [65536, 70000]) expect(validateDiffuseBounceData(withTexel(bits))).toMatch(/malformed or non-finite/);

  const float32: DiffuseBounceData = {
    ...half,
    backend: "webgl",
    atlas: { ...half.atlas, format: "float32", rgba: Array(448).fill(-1.5) },
    bake: { ...half.bake, sampleCount: 384, sampleMode: "all-cubemap-texels" },
  };
  expect(validateDiffuseBounceData(float32)).toBeNull();
  const withFloat = (value: number): DiffuseBounceData => ({
    ...float32,
    atlas: { ...float32.atlas, rgba: float32.atlas.rgba.map((texel, i) => i === 0 ? value : texel) },
  });
  // The same integer is a finite float32 coefficient, including a negative fraction elsewhere in the payload.
  expect(validateDiffuseBounceData(withFloat(0x7c00))).toBeNull();
  expect(validateDiffuseBounceData(withFloat(Number.NaN))).toMatch(/malformed or non-finite/);
  expect(validateDiffuseBounceData(withFloat(Number.POSITIVE_INFINITY))).toMatch(/malformed or non-finite/);
  expect(validateDiffuseBounceData(withFloat(Number.NEGATIVE_INFINITY))).toMatch(/malformed or non-finite/);
});

test("valid negative half-float SH sign bits install as negative WebGL coefficients", async () => {
  const scene = new THREE.Scene();
  const service = await createDiffuseBounce({ renderer: {}, scene, model, backend: "webgl" });
  const data: DiffuseBounceData = {
    version: 1, roomId: "box", backend: "webgpu",
    bounds: { min: [0, 0.25, 0], max: [2, 2.55, 2] }, resolution: [2, 2, 2],
    atlas: { width: 2, height: 2, depth: 28, format: "half-float", rgba: Array(448).fill(0xbc00) },
    bake: { mode: "offline-static-architecture", cubemapSize: 8, bounces: 1, sampleCount: 128, sampleMode: "webgpu-directions" },
  };
  service.install(data);
  service.setRoom("box");
  const grid = scene.children.find((child) => (child as any).isLightProbeGrid) as any;
  expect(grid.texture.type).toBe(THREE.FloatType);
  expect(grid.texture.image.data[0]).toBeCloseTo(-0.6);
  const rejected = { ...data, atlas: { ...data.atlas, rgba: data.atlas.rgba.map((texel, index) => index === 3 ? 0x7c00 : texel) } };
  expect(() => service.install(rejected)).toThrow(/malformed or non-finite/);
  expect(grid.texture.image.data[0]).toBeCloseTo(-0.6);
  service.dispose();
});
