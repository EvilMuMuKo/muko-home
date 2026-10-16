import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { createExteriorWorld } from "../src/exterior-world";

function instanceMatrices(world: ReturnType<typeof createExteriorWorld>) {
  const matrices: number[][] = [];
  world.group.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) {
      for (let i = 0; i < object.count; i++) {
        const matrix = new THREE.Matrix4();
        object.getMatrixAt(i, matrix);
        matrices.push(matrix.elements);
      }
    }
  });
  return matrices;
}

function partBounds(mesh: THREE.Mesh, index?: number) {
  mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox!.clone();
  if (mesh instanceof THREE.InstancedMesh && index !== undefined) {
    const instance = new THREE.Matrix4();
    mesh.getMatrixAt(index, instance);
    return bounds.applyMatrix4(mesh.matrixWorld.clone().multiply(instance));
  }
  return bounds.applyMatrix4(mesh.matrixWorld);
}

function skySample(background: unknown, v = 0.82) {
  const texture = background as THREE.DataTexture;
  const image = texture.image as { data: Uint8Array; width: number; height: number };
  const x = Math.floor(image.width / 2);
  const y = Math.min(image.height - 1, Math.max(0, Math.round(v * (image.height - 1))));
  const i = (y * image.width + x) * 4;
  return [image.data[i], image.data[i + 1], image.data[i + 2]];
}

test("shared exterior is deterministic, compactly instanced, and outside the home envelope", () => {
  const firstScene = new THREE.Scene();
  const first = createExteriorWorld(firstScene);
  const second = createExteriorWorld(new THREE.Scene());
  expect(instanceMatrices(first)).toEqual(instanceMatrices(second));

  const audit = first.audit();
  expect(audit.treeInstances).toBeGreaterThan(30);
  expect(audit.treeInstances).toBeLessThan(80);
  expect(audit.leafInstances).toBe(audit.treeInstances * 600);
  expect(audit.leafTriangleCount).toBe(audit.leafInstances * 4);
  expect(audit.leafTriangleCount).toBeLessThan(200_000);
  expect(audit.buildingInstances).toBeGreaterThan(5);
  expect(audit.meshCount).toBeLessThan(30);
  expect(audit.intersectsHomeEnvelope).toBe(false);
  expect(audit.groundY).toBe(-4.5);
  expect(audit.deterministicSeed).toBeGreaterThan(0);
  expect(audit.bounds.min[1]).toBeLessThan(-4.49);

  const parts: THREE.Object3D[] = [];
  first.group.traverse((node) => { if (node instanceof THREE.Mesh) parts.push(node); });
  for (const part of parts) {
    const count = part instanceof THREE.InstancedMesh ? part.count : 1;
    for (let i = 0; i < count; i++) {
      const bounds = partBounds(part, part instanceof THREE.InstancedMesh ? i : undefined);
      const intersectsEnvelope =
        bounds.max.x >= -0.6 && bounds.min.x <= 13.9 &&
        bounds.max.y >= 0 && bounds.min.y <= 2.7 &&
        bounds.max.z >= -0.6 && bounds.min.z <= 9.95;
      expect(intersectsEnvelope, `${part.name}[${i}]`).toBe(false);
    }
    expect(part.castShadow).toBe(false);
    const materials = Array.isArray((part as THREE.Mesh).material)
      ? (part as THREE.Mesh).material as THREE.Material[]
      : [(part as THREE.Mesh).material as THREE.Material];
    for (const material of materials) expect(material.type).not.toBe("ShaderMaterial");
  }
  first.dispose();
  second.dispose();
  expect(firstScene.children).toHaveLength(0);
});

test("day and night update the same sky and landscape coherently, then restore scene background", () => {
  const scene = new THREE.Scene();
  const original = new THREE.Color("#ff00ff");
  scene.background = original;
  const world = createExteriorWorld(scene);
  const ground = world.group.getObjectByName("exterior-ground") as THREE.Mesh;
  const material = ground.material as THREE.MeshStandardMaterial;
  expect(scene.background).toBeInstanceOf(THREE.DataTexture);
  expect((scene.background as THREE.DataTexture).mapping).toBe(THREE.EquirectangularReflectionMapping);
  const daySky = scene.background;
  const daySample = skySample(daySky).join(",");
  const dayGround = material.color.getHexString();
  const horizon = skySample(daySky, 0.5);
  const zenith = skySample(daySky, 0.98);
  expect(horizon).toEqual([188, 207, 219]);
  expect(zenith[2]).toBeGreaterThan(zenith[0]);
  expect(zenith[0] + zenith[1] + zenith[2]).toBeLessThan(horizon[0] + horizon[1] + horizon[2]);

  const lit = world.group.getObjectByName("distant-residential-lit-windows") as THREE.InstancedMesh;
  const litMaterial = lit.material as THREE.MeshStandardMaterial;
  expect(litMaterial.emissiveIntensity).toBeLessThan(0.1);

  world.setNight(true);
  const nightSky = scene.background as THREE.DataTexture;
  const nightGround = material.color.getHexString();
  expect(nightSky).not.toBe(daySky);
  expect(nightSky).toBeInstanceOf(THREE.DataTexture);
  expect(skySample(nightSky).join(",")).not.toBe(daySample);
  expect(nightGround).not.toBe(dayGround);
  expect(litMaterial.emissiveIntensity).toBeGreaterThan(0.5);
  expect(lit.count).toBeGreaterThan(0);
  expect(lit.count).toBeLessThan(
    (world.group.getObjectByName("distant-residential-windows") as THREE.InstancedMesh).count,
  );
  world.setNight(false);
  expect(scene.background).toBe(daySky);
  expect(material.color.getHexString()).toBe(dayGround);
  expect(litMaterial.emissiveIntensity).toBeLessThan(0.1);
  world.dispose();
  expect((scene.background as THREE.Color).getHexString()).toBe("ff00ff");
});

test("mobile and economical options reduce instance budgets", () => {
  const fullWorld = createExteriorWorld(new THREE.Scene());
  const mobileWorld = createExteriorWorld(new THREE.Scene(), { mobile: true });
  const economicalWorld = createExteriorWorld(new THREE.Scene(), { economical: true });
  const full = fullWorld.audit();
  const mobile = mobileWorld.audit();
  const economical = economicalWorld.audit();
  expect(mobile.treeInstances).toBeLessThan(full.treeInstances);
  expect(mobile.buildingInstances).toBeLessThan(full.buildingInstances);
  expect(economical.treeInstances).toBeLessThan(mobile.treeInstances);
  expect(economical.buildingInstances).toBeLessThan(mobile.buildingInstances);
  expect(mobile.leafInstances).toBe(mobile.treeInstances * 320);
  expect(mobile.leafTriangleCount).toBeLessThan(100_000);
  fullWorld.dispose();
  mobileWorld.dispose();
  economicalWorld.dispose();
});

test("leaf clusters sit in the window view and houses recede with two or three stories", () => {
  const scene = new THREE.Scene();
  const world = createExteriorWorld(scene);
  world.audit();
  const leaves = world.group.getObjectByName("exterior-tree-leaves") as THREE.InstancedMesh;
  const trunks = world.group.getObjectByName("exterior-tree-trunks") as THREE.InstancedMesh;
  const branches = world.group.getObjectByName("exterior-tree-branches") as THREE.InstancedMesh;
  expect(leaves).toBeTruthy();
  expect(branches.count).toBe(trunks.count * 4);
  expect(leaves.count).toBe(trunks.count * 600);
  expect(leaves.geometry.index!.count / 3).toBe(4);
  expect((leaves.material as THREE.MeshStandardMaterial).side).toBe(THREE.DoubleSide);
  expect((leaves.material as THREE.MeshStandardMaterial).transparent).toBe(false);

  const perTreeTops: number[] = [];
  let visibleLeaves = 0;
  for (let i = 0; i < leaves.count; i++) {
    const bounds = partBounds(leaves, i);
    if (bounds.max.y > 1.8) visibleLeaves++;
    expect(bounds.max.y - bounds.min.y).toBeLessThan(0.26);
    const treeIndex = Math.floor(i / 600);
    perTreeTops[treeIndex] = Math.max(perTreeTops[treeIndex] ?? -Infinity, bounds.max.y);
  }
  for (const top of perTreeTops) {
    expect(top).toBeGreaterThan(1.8);
    expect(top).toBeLessThan(4.2);
  }
  expect(visibleLeaves / leaves.count).toBeGreaterThan(0.6);

  const houses = world.group.getObjectByName("distant-residential-massing") as THREE.InstancedMesh;
  const houseWindows = world.group.getObjectByName("distant-residential-windows") as THREE.InstancedMesh;
  const eaves = world.group.getObjectByName("distant-residential-eaves") as THREE.InstancedMesh;
  expect(eaves.count).toBe(houses.count);
  expect(houseWindows.count).toBeGreaterThan(houses.count * 4);
  const home = new THREE.Vector2(6.65, 4.675);
  let treeDistance = 0;
  let houseDistance = 0;
  for (let i = 0; i < trunks.count; i++) {
    const center = partBounds(trunks, i).getCenter(new THREE.Vector3());
    treeDistance += Math.hypot(center.x - home.x, center.z - home.y);
  }
  for (let i = 0; i < houses.count; i++) {
    const bounds = partBounds(houses, i);
    const height = bounds.max.y - bounds.min.y;
    expect(height).toBeGreaterThan(5.5);
    expect(height).toBeLessThan(9.2);
    const center = bounds.getCenter(new THREE.Vector3());
    houseDistance += Math.hypot(center.x - home.x, center.z - home.y);
  }
  expect(houseDistance / houses.count).toBeGreaterThan(treeDistance / trunks.count + 6);
  world.dispose();
});
