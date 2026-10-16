import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { buildPlant } from "../src/plant-mesh";

function materials() {
  const stone = new THREE.MeshStandardMaterial({
    color: "#ded8ce",
    roughness: 0.72,
    map: new THREE.Texture(),
    normalMap: new THREE.Texture(),
  });
  return {
    sage: new THREE.MeshStandardMaterial({ color: "#77826b", roughness: 0.9 }),
    stone,
    salonClay: new THREE.MeshStandardMaterial({
      color: "#ad7157",
      roughness: 0.9,
      map: new THREE.Texture(),
      normalMap: new THREE.Texture(),
    }),
    darkoak: new THREE.MeshStandardMaterial({
      color: "#65564a",
      roughness: 0.95,
      map: new THREE.Texture(),
    }),
  } as Record<string, THREE.Material>;
}

const envelopes = [
  { w: 0.32, d: 0.32, h: 0.8 },
  { w: 0.22, d: 0.28, h: 0.48 },
  { w: 0.44, d: 0.36, h: 1.05 },
];

test("plant geometry stays inside each declared object envelope and above the floor", () => {
  const m = materials();
  for (const o of envelopes) {
    const group = new THREE.Group();
    buildPlant(group, o, m);
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    expect(bounds.min.x, JSON.stringify(o)).toBeGreaterThanOrEqual(
      -o.w / 2 - 1e-5,
    );
    expect(bounds.max.x, JSON.stringify(o)).toBeLessThanOrEqual(o.w / 2 + 1e-5);
    expect(bounds.min.z, JSON.stringify(o)).toBeGreaterThanOrEqual(
      -o.d / 2 - 1e-5,
    );
    expect(bounds.max.z, JSON.stringify(o)).toBeLessThanOrEqual(o.d / 2 + 1e-5);
    expect(bounds.min.y, JSON.stringify(o)).toBeGreaterThanOrEqual(-1e-5);
    expect(bounds.max.y, JSON.stringify(o)).toBeLessThanOrEqual(o.h + 1e-5);
  }
  for (const material of Object.values(m)) material.dispose();
});

test("foliage is a single opaque curved-ribbon mesh, with thin surfaces and no ellipsoid leaves", () => {
  const m = materials();
  const first = new THREE.Group();
  buildPlant(first, envelopes[0], m);
  const meshes: THREE.Mesh[] = [];
  first.traverse((node) => {
    if (node instanceof THREE.Mesh) meshes.push(node);
  });
  const leaves = meshes.filter((mesh) => mesh.userData.plantPart === "leaves");
  expect(leaves).toHaveLength(1);
  expect(meshes).toHaveLength(4);
  for (const mesh of meshes) {
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect((mesh.material as THREE.Material).transparent).toBe(false);
    expect(mesh.geometry.type).not.toMatch(/Sphere|Ellipsoid/);
  }
  const leaf = leaves[0];
  const material = leaf.material as THREE.MeshStandardMaterial;
  const positions = leaf.geometry.getAttribute("position");
  const colors = leaf.geometry.getAttribute("color");
  expect(material.vertexColors).toBe(true);
  expect(material.side).toBe(THREE.DoubleSide);
  expect(leaf.geometry.index).not.toBeNull();
  expect(positions.count).toBeGreaterThan(200);
  expect(colors.count).toBe(positions.count);
  expect(leaf.geometry.userData.surfaceOnly).toBe(true);
  const edgeCounts = new Map<string, number>();
  const indices = leaf.geometry.index!.array;
  for (let i = 0; i < indices.length; i += 3) {
    for (const [a, b] of [
      [indices[i], indices[i + 1]],
      [indices[i + 1], indices[i + 2]],
      [indices[i + 2], indices[i]],
    ]) {
      const edge = [Math.min(a, b), Math.max(a, b)].join(":");
      edgeCounts.set(edge, (edgeCounts.get(edge) ?? 0) + 1);
    }
  }
  expect([...edgeCounts.values()].some((count) => count === 1)).toBe(true);
  const distinctColors = new Set<string>();
  for (let i = 0; i < colors.count; i++) {
    const rgb = [colors.getX(i), colors.getY(i), colors.getZ(i)];
    if (rgb.every((value) => value >= 0 && value <= 1))
      distinctColors.add(rgb.map((value) => value.toFixed(2)).join(","));
  }
  expect(distinctColors.size).toBeGreaterThan(3);

  const second = new THREE.Group();
  buildPlant(second, envelopes[0], m);
  const secondLeaves = second.children.find(
    (node) => node.userData.plantPart === "leaves",
  ) as THREE.Mesh;
  expect(secondLeaves.geometry).toBe(leaf.geometry);
  expect(secondLeaves.material).toBe(leaf.material);
  for (const material of Object.values(m)) material.dispose();
});

test("pot and soil use separate flat matte materials without room fabric or wood maps", () => {
  const m = materials();
  const group = new THREE.Group();
  buildPlant(group, envelopes[0], m);
  const pot = group.children.find(
    (node) => node.userData.plantPart === "pot",
  ) as THREE.Mesh | undefined;
  const soil = group.children.find(
    (node) => node.userData.plantPart === "soil",
  ) as THREE.Mesh | undefined;
  expect(pot).toBeDefined();
  expect(soil).toBeDefined();
  expect(pot!.material).not.toBe(m.salonClay);
  expect(soil!.material).not.toBe(m.darkoak);
  expect(m.homePlantPot).toBe(pot!.material);
  expect(m.homePlantSoil).toBe(soil!.material);
  const potMat = pot!.material as THREE.MeshStandardMaterial;
  const soilMat = soil!.material as THREE.MeshStandardMaterial;
  for (const material of [potMat, soilMat]) {
    expect(material.map).toBeNull();
    expect(material.normalMap).toBeNull();
    expect(material.bumpMap).toBeNull();
    expect(material.roughnessMap).toBeNull();
    expect(material.metalnessMap).toBeNull();
    expect(material.aoMap).toBeNull();
    expect(material.transparent).toBe(false);
    expect(material.metalness).toBe(0);
  }
  expect(potMat.roughness).toBe(0.82);
  expect(soilMat.roughness).toBe(0.98);
  expect(potMat.color.getHexString()).toBe("a96f58");
  expect(soilMat.color.getHexString()).toBe("463c30");
  for (const material of Object.values(m)) material.dispose();
});
