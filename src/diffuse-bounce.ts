import * as THREE from "three";
import { LightProbeGrid } from "three/addons/lighting/LightProbeGrid.js";
import { LightProbeGridWebGL } from "three/addons/lighting/LightProbeGridWebGL.js";
// Three 0.186 exports the runtime addon but omits this internal node's declaration.
// @ts-expect-error Internal companion class used by LightProbeGrid.bake() itself.
import { LightProbeGridNode } from "three/addons/tsl/lighting/LightProbeGridNode.js";
import { roomMembership } from "./room-radiance";
import { createMobileDiffuseBounce } from "./mobile-diffuse";

export type DiffuseBounceData = {
  version: 1;
  roomId: string;
  backend: "webgpu" | "webgl";
  bounds: { min: [number, number, number]; max: [number, number, number] };
  resolution: [number, number, number];
  atlas: { width: number; height: number; depth: number; format: "half-float" | "float32"; rgba: number[] };
  bake: { mode: "offline-static-architecture"; cubemapSize: 8; bounces: 1; sampleCount: 128 | 384; sampleMode: "webgpu-directions" | "all-cubemap-texels" };
};

type Room = { id: string; polygon?: Array<[number, number]> };
type Model = { rooms?: Room[]; objects?: Array<{ id?: string }> };
type Renderer = any;
type Grid = LightProbeGrid | LightProbeGridWebGL;
const RESOLUTION = 2 as const;
const HEIGHT_MIN = 0.25;
const HEIGHT_MAX = 2.55;
const INSET = 0.35;
const WEBGPU_FALLOFF = 0.7;
const MAX_RUNTIME_INTENSITY = 0.6;

async function waitForGPU(renderer: Renderer) {
  const queue = renderer?.backend?.device?.queue;
  if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
}

function hasObjectId(node: THREE.Object3D, ids: Set<string>) {
  const id = node.userData.objectId ?? node.userData.modelObjectId;
  if (typeof id === "string" && ids.has(id)) return true;
  const colon = node.name.indexOf(":");
  const merged = node.name.indexOf("__");
  const end = colon < 0 ? (merged < 0 ? node.name.length : merged) : (merged < 0 ? colon : Math.min(colon, merged));
  return ids.has(node.name) || (end < node.name.length && ids.has(node.name.slice(0, end)));
}

function inside(x: number, z: number, polygon: Array<[number, number]>) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i], [xj, zj] = polygon[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) result = !result;
  }
  return result;
}

/** Finds a conservative axis-aligned bake rectangle fully contained by the room polygon. */
export function diffuseRoomBounds(model: Model, roomId: string) {
  if (roomId.toLowerCase() === "hall") throw new Error("Diffuse GI bake excludes the hall because its polygon overlaps adjacent rooms.");
  const polygon = model.rooms?.find((room) => room.id === roomId)?.polygon;
  if (!polygon || polygon.length < 3 || polygon.some(([x, z]) => !Number.isFinite(x) || !Number.isFinite(z))) {
    throw new Error(`Diffuse GI bake has no valid polygon for room '${roomId}'.`);
  }
  const xs = [...new Set(polygon.flatMap(([x]) => [x - INSET, x + INSET]))].sort((a, b) => a - b);
  const zs = [...new Set(polygon.flatMap(([, z]) => [z - INSET, z + INSET]))].sort((a, b) => a - b);
  let best: [number, number, number, number] | undefined;
  let area = 0;
  for (const minX of xs) for (const maxX of xs) for (const minZ of zs) for (const maxZ of zs) {
    const candidateArea = (maxX - minX) * (maxZ - minZ);
    if (candidateArea <= area) continue;
    const mx = (minX + maxX) / 2, mz = (minZ + maxZ) / 2;
    const samples: Array<[number, number]> = [];
    for (let iz = 0; iz <= 4; iz++) for (let ix = 0; ix <= 4; ix++) samples.push([minX + (maxX - minX) * ix / 4, minZ + (maxZ - minZ) * iz / 4]);
    if (samples.every(([x, z]) => inside(x, z, polygon))) {
      best = [minX, maxX, minZ, maxZ]; area = candidateArea;
    }
  }
  if (!best || area < 0.25) throw new Error(`Diffuse GI bake cannot fit a safe rectangular probe volume in room '${roomId}'.`);
  return { min: [best[0], HEIGHT_MIN, best[2]] as [number, number, number], max: [best[1], HEIGHT_MAX, best[3]] as [number, number, number] };
}

export function validateDiffuseBounceData(data: DiffuseBounceData): string | null {
  if (!data || data.version !== 1 || !data.roomId || !["webgpu", "webgl"].includes(data.backend)) return "Unsupported diffuse GI atlas metadata.";
  const expectedFormat = data.backend === "webgpu" ? "half-float" : "float32";
  const expectedSampleCount = data.backend === "webgpu" ? 128 : 384;
  const expectedSampleMode = data.backend === "webgpu" ? "webgpu-directions" : "all-cubemap-texels";
  if (data.bake?.mode !== "offline-static-architecture" || data.bake?.cubemapSize !== 8 || data.bake?.bounces !== 1 || data.bake?.sampleCount !== expectedSampleCount || data.bake?.sampleMode !== expectedSampleMode) return "Diffuse GI bake provenance is inconsistent with its backend or offline bake mode.";
  const { min, max } = data.bounds ?? {} as any;
  if (!min || !max || min.length !== 3 || max.length !== 3 || [...min, ...max].some((n) => !Number.isFinite(n)) || min.some((n, i) => n >= max[i])) return "Diffuse GI atlas bounds are invalid.";
  if (!Array.isArray(data.resolution) || data.resolution.some((n) => n !== RESOLUTION)) return "Diffuse GI atlas resolution must be 2x2x2.";
  const { width, height, depth, format, rgba } = data.atlas ?? {} as any;
  // Half-float payloads are Uint16 patterns. Exponent 31 decodes to NaN/Infinity even when the integer is finite.
  const acceptedTexel = (n: number) => format === "half-float"
    ? Number.isInteger(n) && n >= 0 && n <= 0xffff && ((n >> 10) & 0x1f) !== 0x1f
    : Number.isFinite(n);
  if (width !== 2 || height !== 2 || depth !== 7 * (2 + 2) || format !== expectedFormat || !Array.isArray(rgba) || rgba.length !== width * height * depth * 4 || rgba.some((n) => !acceptedTexel(n))) return "Diffuse GI atlas payload is malformed or non-finite.";
  return null;
}

function typedAtlas(data: DiffuseBounceData) {
  return data.atlas.format === "half-float" ? new Uint16Array(data.atlas.rgba) : new Float32Array(data.atlas.rgba);
}

function halfToFloat(bits: number) {
  const sign = bits & 0x8000 ? -1 : 1;
  const exponent = (bits >> 10) & 0x1f;
  const fraction = bits & 0x03ff;
  if (exponent === 0) return sign * Math.pow(2, -14) * (fraction / 1024);
  if (exponent === 0x1f) return fraction ? NaN : sign * Infinity;
  return sign * Math.pow(2, exponent - 15) * (1 + fraction / 1024);
}

/** Removes WebGPU's 256-byte row padding while preserving the source texel type. */
export function unpackPaddedAtlasRows<T extends Uint16Array | Float32Array>(padded: T, width: number, height: number): T {
  const valuesPerRow = width * 4;
  const stride = Math.ceil(valuesPerRow * padded.BYTES_PER_ELEMENT / 256) * 256 / padded.BYTES_PER_ELEMENT;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || padded.length < (height - 1) * stride + valuesPerRow) {
    throw new Error("WebGPU diffuse GI slice has an invalid padded row buffer.");
  }
  const Constructor = padded.constructor as { new(length: number): T };
  const dense = new Constructor(valuesPerRow * height);
  for (let row = 0; row < height; row++) dense.set(padded.subarray(row * stride, row * stride + valuesPerRow), row * valuesPerRow);
  return dense;
}

export async function createDiffuseBounce(args: { renderer: Renderer; scene: THREE.Scene; model: Model; backend: "webgpu" | "webgl"; mobile?: boolean }) {
  const { renderer, scene, model, backend } = args;
  if (args.mobile) return createMobileDiffuseBounce({scene, validate: validateDiffuseBounceData});
  const baked = new Map<string, DiffuseBounceData>();
  const grids = new Map<string, Grid>();
  let currentRoom: string | null = null;
  let bakeCount = 0;
  let animatedHidden = 0;
  let runtimeIntensity = MAX_RUNTIME_INTENSITY;
  let lastError: string | null = null;
  let disposed = false;

  function makeGrid(data: DiffuseBounceData): Grid {
    const [minX, minY, minZ] = data.bounds.min, [maxX, maxY, maxZ] = data.bounds.max;
    const grid: any = backend === "webgpu"
      ? new LightProbeGrid(maxX - minX, maxY - minY, maxZ - minZ, RESOLUTION, RESOLUTION, RESOLUTION)
      : new LightProbeGridWebGL(maxX - minX, maxY - minY, maxZ - minZ, RESOLUTION, RESOLUTION, RESOLUTION);
    grid.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    grid.updateBoundingBox();
    if (backend === "webgpu") grid.intensity = runtimeIntensity;
    if (backend === "webgpu") grid.falloff = WEBGPU_FALLOFF;
    const source = typedAtlas(data);
    const textureData = backend === "webgl"
      ? Float32Array.from(source, (value) => (data.atlas.format === "half-float" ? halfToFloat(value) : value) * runtimeIntensity)
      : source;
    const texture = new THREE.Data3DTexture(textureData, data.atlas.width, data.atlas.height, data.atlas.depth);
    texture.format = THREE.RGBAFormat;
    texture.type = backend === "webgl" ? THREE.FloatType : (data.atlas.format === "half-float" ? THREE.HalfFloatType : THREE.FloatType);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    grid.texture = texture;
    return grid;
  }

  function install(data: DiffuseBounceData) {
    const issue = validateDiffuseBounceData(data);
    if (issue) throw new Error(issue);
    if (backend === "webgpu") {
      const library = renderer?.library;
      if (!library?.getLightNodeClass || !library?.addLight) throw new Error("WebGPU diffuse GI install requires an initialized renderer with a node library.");
      if (library.getLightNodeClass(LightProbeGrid) === null) library.addLight(LightProbeGridNode, LightProbeGrid);
    }
    const old = grids.get(data.roomId);
    const wasActive = old?.parent === scene;
    if (old) { scene.remove(old); old.texture?.dispose(); old.dispose(); }
    const copy = structuredClone(data);
    baked.set(copy.roomId, copy);
    grids.set(copy.roomId, makeGrid(copy));
    if (wasActive || currentRoom === copy.roomId) scene.add(grids.get(copy.roomId)!);
  }

  return {
    async bakeRoom(roomId: string): Promise<DiffuseBounceData> {
      if (disposed) throw new Error("Diffuse GI service is disposed.");
      const existing = baked.get(roomId);
      if (existing) return structuredClone(existing);
      const bounds = diffuseRoomBounds(model, roomId);
      if (!renderer || (backend === "webgpu" && (renderer.isWebGPURenderer !== true || renderer.initialized === false)) || (backend === "webgl" && renderer.isWebGLRenderer !== true)) {
        throw new Error(`Diffuse GI ${backend} bake requires an initialized matching Three.js renderer.`);
      }
      const total = 7 * (RESOLUTION + 2) * 4 * 2 * 2;
      const hidden: Array<[THREE.Object3D, boolean]> = [];
      const suppressedAmbient: Array<[THREE.Light, number]> = [];
      const envMaps: Array<[THREE.Material, THREE.Texture | null]> = [];
      const oldEnvironment = scene.environment;
      const oldEnvironmentIntensity = scene.environmentIntensity;
      const previousTarget = renderer.getRenderTarget?.() ?? null;
      const previousFace = renderer.getActiveCubeFace?.() ?? 0;
      const previousMipmap = renderer.getActiveMipmapLevel?.() ?? 0;
      const furnitureIds = new Set((model.objects ?? []).map((object) => object.id).filter((id): id is string => typeof id === "string"));
      const activeGrid = currentRoom ? grids.get(currentRoom) : undefined;
      if (activeGrid) scene.remove(activeGrid);
      const grid: any = backend === "webgpu"
        ? new LightProbeGrid(bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2], 2, 2, 2)
        : new LightProbeGridWebGL(bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2], 2, 2, 2);
      grid.position.set((bounds.min[0] + bounds.max[0]) / 2, (bounds.min[1] + bounds.max[1]) / 2, (bounds.min[2] + bounds.max[2]) / 2);
      grid.updateBoundingBox();
      try {
        await waitForGPU(renderer);
        scene.updateMatrixWorld(true);
        scene.traverse((node) => {
        if (!node.visible && node !== scene && roomMembership(node).length > 0 && !node.userData.animated) { hidden.push([node, node.visible]); node.visible = true; }
        if (node !== scene && node.visible && node.userData.animated && !(node.parent?.userData.animated)) { hidden.push([node, node.visible]); node.visible = false; animatedHidden++; }
        if (node !== scene && node.visible && hasObjectId(node, furnitureIds) && !hasObjectId(node.parent ?? scene, furnitureIds)) { hidden.push([node, node.visible]); node.visible = false; }
        if (node instanceof THREE.Mesh) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          if (node.visible && (node.userData.kind === "planar-mirror" || materials.some((material) => (material as THREE.MeshPhysicalMaterial).transmission > 0))) {
            hidden.push([node, node.visible]); node.visible = false;
          }
          for (const material of materials) {
            if (!("envMap" in material)) continue;
            const envMaterial = material as THREE.MeshStandardMaterial;
            if (!envMaps.some(([candidate]) => candidate === material)) envMaps.push([material, envMaterial.envMap]);
            envMaterial.envMap = null;
            envMaterial.needsUpdate = true;
          }
        }
        if (node instanceof THREE.AmbientLight || node instanceof THREE.HemisphereLight || node instanceof THREE.LightProbe) {
          suppressedAmbient.push([node, node.intensity]); node.intensity = 0;
        }
        });
        scene.environment = null;
        scene.environmentIntensity = 0;
        grid.bake(renderer, scene, { cubemapSize: 8, bounces: 1, sampleCount: 128 });
        const target = grid._renderTarget;
        if (!target) throw new Error("Three.js LightProbeGrid did not expose its baked atlas target.");
        await waitForGPU(renderer);
        const values = new Array<number>();
        if (backend === "webgpu") {
          for (let layer = 0; layer < target.depth; layer++) {
            const slice = await renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height, 0, layer) as ArrayLike<number>;
            if (!(slice instanceof Uint16Array || slice instanceof Float32Array)) throw new Error("WebGPU diffuse GI readback returned an unsupported texel array type.");
            values.push(...Array.from(unpackPaddedAtlasRows(slice, target.width, target.height)));
          }
        } else {
          for (let layer = 0; layer < target.depth; layer++) {
            renderer.setRenderTarget(target, layer);
            const buffer = new Float32Array(target.width * target.height * 4);
            await renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height, buffer);
            values.push(...buffer);
          }
        }
        if (values.length !== total || Array.from(values).some((n) => !Number.isFinite(n))) throw new Error("Baked diffuse GI atlas readback was incomplete or non-finite.");
        const data: DiffuseBounceData = { version: 1, roomId, backend, bounds, resolution: [2, 2, 2], atlas: { width: 2, height: 2, depth: 28, format: backend === "webgpu" ? "half-float" : "float32", rgba: values }, bake: { mode: "offline-static-architecture", cubemapSize: 8, bounces: 1, sampleCount: backend === "webgpu" ? 128 : 384, sampleMode: backend === "webgpu" ? "webgpu-directions" : "all-cubemap-texels" } };
        const problem = validateDiffuseBounceData(data);
        if (problem) throw new Error(problem);
        baked.set(roomId, data); bakeCount++; lastError = null;
        return structuredClone(data);
      } catch (error) { lastError = error instanceof Error ? error.message : String(error); throw error; }
      finally {
        scene.environment = oldEnvironment;
        scene.environmentIntensity = oldEnvironmentIntensity;
        for (const [material, envMap] of envMaps.reverse()) { (material as THREE.MeshStandardMaterial).envMap = envMap; material.needsUpdate = true; }
        hidden.forEach(([node, visible]) => { node.visible = visible; });
        suppressedAmbient.forEach(([light, intensity]) => { light.intensity = intensity; });
        if (activeGrid) scene.add(activeGrid);
        renderer.setRenderTarget?.(previousTarget, previousFace, previousMipmap);
        await waitForGPU(renderer);
        grid.dispose(); scene.updateMatrixWorld(true);
      }
    },
    install,
    async loadRoom(roomId: string, variant: "day" | "night") {
      const response = await fetch(`/diffuse-bounce/${variant}/${encodeURIComponent(roomId)}.json`);
      if (!response.ok) throw new Error(`Diffuse GI atlas request failed (${response.status}): ${roomId}/${variant}.`);
      const data = await response.json() as DiffuseBounceData;
      if (data.roomId !== roomId) throw new Error(`Diffuse GI atlas room mismatch: expected '${roomId}', got '${data.roomId}'.`);
      install(data);
    },
    setRoom(roomId: string) {
      const nextRoom = baked.has(roomId) ? roomId : null;
      if (currentRoom === nextRoom) return;
      if (currentRoom) { const old = grids.get(currentRoom); if (old) scene.remove(old); }
      currentRoom = nextRoom;
      if (currentRoom) { let grid = grids.get(currentRoom); if (!grid) { grid = makeGrid(baked.get(currentRoom)!); grids.set(currentRoom, grid); } scene.add(grid); }
    },
    setIntensity(value: number) {
      runtimeIntensity = THREE.MathUtils.clamp(Number.isFinite(value) ? value : MAX_RUNTIME_INTENSITY, 0, MAX_RUNTIME_INTENSITY);
      for (const [roomId, grid] of grids) {
        const wasActive = grid.parent === scene;
        scene.remove(grid); grid.texture?.dispose(); grid.dispose();
        const replacement = makeGrid(baked.get(roomId)!);
        grids.set(roomId, replacement);
        if (wasActive) scene.add(replacement);
      }
    },
    audit() { return { backend, bakeCount, cachedRooms: [...baked.keys()], currentRoom, activeGridCount: [...grids.values()].filter((grid) => grid.parent === scene).length, animatedRootsHidden: animatedHidden, modelObjectsOmitted: (model.objects ?? []).length, lastError, bakeMode: "manual-offline-static-architecture-only" as const, runtimeIntensityCap: MAX_RUNTIME_INTENSITY, webgpuFalloff: backend === "webgpu" ? WEBGPU_FALLOFF : null, nearWallNote: "0.7 m WebGPU falloff keeps inset probes contributing near walls; adjacent-room leakage can occur within that range because wall occlusion is not evaluated by runtime sampling." as const, mobileBakePolicy: "manual-developer-call-only" as const, crossBackendAtlasLoad: "supported by shared packed atlas layout; preserved source texel type" as const, atlasFormat: backend === "webgpu" ? "half-float" as const : "float32" as const, webglFalloff: backend === "webgl" ? "LightProbeGridWebGL has no falloff; single-grid WebGL sampling clamps the selected atlas beyond its bounds, so adjacent-space leakage remains possible." : null }; },
    dispose() { if (disposed) return; disposed = true; for (const grid of grids.values()) { scene.remove(grid); grid.texture?.dispose(); grid.dispose(); } grids.clear(); baked.clear(); currentRoom = null; },
  };
}
