import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { bakeStaticFloorOcclusion } from "../src/baked-occlusion";

function createFloor(scene: THREE.Scene, polygon: [number, number][]) {
  const shape = new THREE.Shape();
  polygon.forEach(([x, z], index) =>
    index ? shape.lineTo(x, -z) : shape.moveTo(x, -z),
  );
  shape.closePath();
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.001;
  mesh.name = "floor:test";
  scene.add(mesh);
  return mesh;
}

function aoAt(mesh: THREE.Mesh, worldX: number, worldZ: number) {
  const material = mesh.material as THREE.MeshStandardMaterial;
  const texture = material.aoMap!;
  const image = texture.image as {
    data: Uint8Array;
    width: number;
    height: number;
  };
  const uv1 = mesh.geometry.getAttribute("uv1");
  const positions = mesh.geometry.getAttribute("position");
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  const v = new THREE.Vector3();
  mesh.updateWorldMatrix(true, false);
  for (let i = 0; i < positions.count; i++) {
    v.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minZ = Math.min(minZ, v.z);
    maxZ = Math.max(maxZ, v.z);
  }
  const u = THREE.MathUtils.clamp((worldX - minX) / (maxX - minX), 0, 1);
  const vCoord = THREE.MathUtils.clamp((worldZ - minZ) / (maxZ - minZ), 0, 1);
  const x = Math.min(image.width - 1, Math.floor(u * image.width));
  const y = Math.min(image.height - 1, Math.floor(vCoord * image.height));
  expect(uv1).toBeTruthy();
  return image.data[(y * image.width + x) * 4];
}

test("bakes restrained near-contact AO under static geometry and excludes a moving TV", () => {
  const scene = new THREE.Scene();
  const floor = createFloor(scene, [
    [0, 0],
    [4, 0],
    [4, 3],
    [0, 3],
  ]);
  const originalUV = floor.geometry.getAttribute("uv").array.slice();
  const bed = new THREE.Group();
  bed.name = "bed-fixed";
  const bedMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.3, 0.8),
    new THREE.MeshStandardMaterial(),
  );
  bedMesh.position.set(3, 0.15, 2);
  bed.add(bedMesh);
  scene.add(bed);
  const movingTV = new THREE.Group();
  movingTV.name = "tv-moving";
  movingTV.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.6, 0.5),
      new THREE.MeshStandardMaterial(),
    ),
  );
  movingTV.position.set(1, 0.3, 2);
  scene.add(movingTV);

  const audit = bakeStaticFloorOcclusion(
    scene,
    {
      walls: [],
      openings: [],
      objects: [
        { id: "bed-fixed", type: "bed", x: 3, z: 2, w: 0.8, d: 0.8, h: 0.3 },
        { id: "tv-moving", type: "mobile_tv", x: 1, z: 2, w: 0.8, d: 0.5, h: 0.6 },
      ],
    },
    { size: 96 },
  );

  const material = floor.material as THREE.MeshStandardMaterial;
  expect(audit.status).toBe("baked");
  expect(audit.affectedFloorCount).toBe(1);
  expect(audit.textureSize).toEqual({ width: 96, height: 96 });
  expect(audit.staticParticipantIds).toContain("bed-fixed");
  expect(audit.dynamicExcludedIds).toContain("tv-moving");
  expect(material.aoMap).toBeTruthy();
  expect(material.aoMap!.channel).toBe(1);
  expect(material.aoMap!.colorSpace).toBe(THREE.NoColorSpace);
  expect(material.aoMap!.image.width).toBe(96);
  expect(floor.geometry.getAttribute("uv1").count).toBe(
    floor.geometry.getAttribute("position").count,
  );
  expect(Array.from(floor.geometry.getAttribute("uv").array)).toEqual(
    Array.from(originalUV),
  );
  const bedPixel = aoAt(floor, 3, 2);
  const tvPixel = aoAt(floor, 1, 2);
  expect(bedPixel).toBeLessThanOrEqual(174);
  expect(tvPixel).toBeGreaterThan(245);
  for (const value of floor.geometry.getAttribute("uv1").array)
    expect(Number.isFinite(value)).toBe(true);
});

test("wall segmentation leaves a door opening brighter than adjacent solid wall", () => {
  const scene = new THREE.Scene();
  const floor = createFloor(scene, [
    [0, 0],
    [4, 0],
    [4, 3],
    [0, 3],
  ]);
  const audit = bakeStaticFloorOcclusion(
    scene,
    {
      walls: [
        { id: "north-wall", a: [0, 0], b: [4, 0], thickness: 0.18, height: 2.7 },
      ],
      openings: [
        { id: "door", type: "door", wallId: "north-wall", center: [2, 0], width: 1, height: 2.08 },
      ],
      objects: [],
    },
    { size: 160 },
  );
  expect(audit.staticParticipantIds).toContain("wall:north-wall");
  expect(audit.dynamicExcludedIds).toContain("opening:door");
  expect(aoAt(floor, 1.2, 0.12)).toBeLessThan(aoAt(floor, 2, 0.12));
  expect(aoAt(floor, 2, 0.12)).toBeGreaterThan(245);
  expect(aoAt(floor, 1.2, 0.12)).toBeGreaterThanOrEqual(173);
});

test("does not attach AO attributes to non-floor meshes", () => {
  const scene = new THREE.Scene();
  const furniture = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial(),
  );
  furniture.name = "not-a-floor";
  scene.add(furniture);
  const audit = bakeStaticFloorOcclusion(scene, { objects: [], walls: [], openings: [] });
  expect(audit.status).toBe("no_floors");
  expect(audit.affectedFloorCount).toBe(0);
  expect(furniture.geometry.getAttribute("uv1")).toBeUndefined();
});
