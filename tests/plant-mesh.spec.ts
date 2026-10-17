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

function textureMaps(material: THREE.Material) {
  return Object.entries(material).filter(
    ([key, value]) =>
      (key === "map" || key.endsWith("Map")) &&
      !!value &&
      (value as { isTexture?: boolean }).isTexture,
  );
}

function strandCount(geometry: THREE.BufferGeometry) {
  const index = geometry.index!.array;
  const parent = new Uint32Array(geometry.getAttribute("position").count);
  for (let i = 0; i < parent.length; i++) parent[i] = i;
  const find = (vertex: number): number => {
    let root = vertex;
    while (parent[root] !== root) root = parent[root];
    while (parent[vertex] !== root) {
      const next = parent[vertex];
      parent[vertex] = root;
      vertex = next;
    }
    return root;
  };
  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (let i = 0; i < index.length; i += 3) {
    unite(index[i], index[i + 1]);
    unite(index[i], index[i + 2]);
  }
  const roots = new Set<number>();
  for (let i = 0; i < index.length; i++) roots.add(find(index[i]));
  return roots.size;
}

test("foliage clears inherited maps when the mesh has no UV and keeps one tapered strand per leaf", () => {
  const m = materials();
  const sage = m.sage as THREE.MeshStandardMaterial;
  const inherited = {
    map: new THREE.Texture(),
    normalMap: new THREE.Texture(),
    bumpMap: new THREE.Texture(),
    roughnessMap: new THREE.Texture(),
    metalnessMap: new THREE.Texture(),
    aoMap: new THREE.Texture(),
    emissiveMap: new THREE.Texture(),
    alphaMap: new THREE.Texture(),
    lightMap: new THREE.Texture(),
    displacementMap: new THREE.Texture(),
  };
  Object.assign(sage, inherited);
  expect(textureMaps(sage).map(([key]) => key).sort()).toEqual(
    Object.keys(inherited).sort(),
  );
  const group = new THREE.Group();
  buildPlant(group, envelopes[0], m);
  const leaves = group.children.find(
    (node) => node.userData.plantPart === "leaves",
  ) as THREE.Mesh;
  const stems = group.children.find(
    (node) => node.userData.plantPart === "stems",
  ) as THREE.Mesh;
  const leafletCount = leaves.geometry.userData.leafletCount as number;
  expect(leafletCount).toBe(10);
  expect(strandCount(stems.geometry)).toBe(1 + leafletCount);
  expect(stems.geometry.getAttribute("position").count).toBeLessThan(400);
  expect(leaves.geometry.getAttribute("position").count).toBeLessThan(500);

  for (const mesh of [leaves, stems]) {
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material).not.toBe(sage);
    expect(material.transparent).toBe(false);
    expect(material.opacity).toBe(1);
    for (const key of Object.keys(inherited)) {
      expect(material[key as keyof THREE.MeshStandardMaterial], key).toBeNull();
    }
    expect(textureMaps(material)).toEqual([]);
  }
  for (const [key, texture] of Object.entries(inherited)) {
    expect(sage[key as keyof THREE.MeshStandardMaterial]).toBe(texture);
    texture.dispose();
  }

  const leafMaterial = leaves.material as THREE.MeshStandardMaterial;
  expect(leafMaterial.vertexColors).toBe(true);
  expect(leafMaterial.color.getHexString()).toBe("ffffff");
  const positions = leaves.geometry.getAttribute("position");
  const rows = positions.count / leafletCount / 3;
  expect(Number.isInteger(rows)).toBe(true);
  let maxWidth = 0;
  const penultimate: number[] = [];
  for (let leaflet = 0; leaflet < leafletCount; leaflet++) {
    const rowStart = leaflet * rows * 3;
    const baseA = new THREE.Vector3().fromBufferAttribute(positions, rowStart);
    const baseB = new THREE.Vector3().fromBufferAttribute(
      positions,
      rowStart + 2,
    );
    const baseWidth = baseA.distanceTo(baseB);
    expect(baseWidth).toBeGreaterThan(0.0004);
    const tip = rowStart + (rows - 1) * 3;
    const tipA = new THREE.Vector3().fromBufferAttribute(positions, tip);
    const tipB = new THREE.Vector3().fromBufferAttribute(positions, tip + 1);
    const tipC = new THREE.Vector3().fromBufferAttribute(positions, tip + 2);
    expect(tipA.distanceTo(tipB)).toBeLessThan(1e-6);
    expect(tipA.distanceTo(tipC)).toBeLessThan(1e-6);
    const beforeTip = tip - 3;
    penultimate.push(
      new THREE.Vector3()
        .fromBufferAttribute(positions, beforeTip)
        .distanceTo(
          new THREE.Vector3().fromBufferAttribute(positions, beforeTip + 2),
        ),
    );
    for (let row = 0; row < rows; row++) {
      const left = new THREE.Vector3().fromBufferAttribute(
        positions,
        rowStart + row * 3,
      );
      const right = new THREE.Vector3().fromBufferAttribute(
        positions,
        rowStart + row * 3 + 2,
      );
      maxWidth = Math.max(maxWidth, left.distanceTo(right));
    }
    const stem = stems.geometry.getAttribute("position");
    let nearest = Infinity;
    const collar = baseA.clone().add(baseB).multiplyScalar(0.5);
    for (let vertex = 0; vertex < stem.count; vertex++) {
      nearest = Math.min(
        nearest,
        collar.distanceTo(
          new THREE.Vector3().fromBufferAttribute(stem, vertex),
        ),
      );
    }
    expect(nearest).toBeLessThan(0.012);
  }
  expect(Math.max(...penultimate)).toBeLessThan(maxWidth * 0.45);
  for (const material of Object.values(m)) material.dispose();
});
