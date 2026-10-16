import * as THREE from "three";

export interface ExteriorWorld {
  group: THREE.Group;
  setNight(night: boolean): void;
  audit(): {
    treeInstances: number;
    leafInstances: number;
    leafTriangleCount: number;
    buildingInstances: number;
    meshCount: number;
    bounds: { min: [number, number, number]; max: [number, number, number] };
    intersectsHomeEnvelope: boolean;
    groundY: number;
    deterministicSeed: number;
  };
  dispose(): void;
}

const SEED = 0x4d554b4f;
const HOME = { minX: -0.6, maxX: 13.9, minY: 0, maxY: 2.7, minZ: -0.6, maxZ: 9.95 };
const GROUND_Y = -4.5;
const FLOOR_H = 2.9;

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function matrixAt(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  yaw = 0,
  pitch = 0,
  roll = 0,
) {
  const object = new THREE.Object3D();
  object.position.set(x, y, z);
  object.rotation.set(pitch, yaw, roll);
  object.scale.set(sx, sy, sz);
  object.updateMatrix();
  return object.matrix.clone();
}

function intersectsHome(bounds: THREE.Box3) {
  return !(
    bounds.max.x < HOME.minX || bounds.min.x > HOME.maxX ||
    bounds.max.y < HOME.minY || bounds.min.y > HOME.maxY ||
    bounds.max.z < HOME.minZ || bounds.min.z > HOME.maxZ
  );
}

function meshIntersectsHome(mesh: THREE.Mesh) {
  if (!(mesh instanceof THREE.InstancedMesh))
    return intersectsHome(new THREE.Box3().setFromObject(mesh));
  mesh.geometry.computeBoundingBox();
  const localBounds = mesh.geometry.boundingBox!;
  const transform = new THREE.Matrix4();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, transform);
    const bounds = localBounds.clone().applyMatrix4(mesh.matrixWorld.clone().multiply(transform));
    if (intersectsHome(bounds)) return true;
  }
  return false;
}

function smoothstep(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** A five-point, gently cupped leaf, triangulated into four opaque facets. */
function makeLeafGeometry() {
  const positions = new Float32Array([
    0, -0.5, 0,
    -0.36, -0.02, 0,
    0, 0.06, 0.075,
    0, 0.5, 0,
    0.36, -0.02, 0,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 2, 1, 3, 2, 3, 4, 2, 4, 0, 2]);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.userData.trianglesPerLeaf = 4;
  return geometry;
}

/** Soft equirectangular sky. v=0 is nadir, v=1 is zenith. No shader, no image file. */
function makeSkyTexture(night: boolean) {
  const width = 128;
  const height = 64;
  const data = new Uint8Array(width * height * 4);
  const rand = seeded(SEED ^ (night ? 0x5e11 : 0x0da7));
  const clouds = Array.from({ length: night ? 4 : 6 }, () => ({
    u: rand(),
    v: 0.58 + rand() * 0.16,
    rx: 0.035 + rand() * 0.04,
    ry: 0.018 + rand() * 0.016,
    gain: night ? 0.07 + rand() * 0.05 : 0.16 + rand() * 0.1,
  }));
  const zenith = night ? [10, 18, 42] : [112, 158, 208];
  const horizon = night ? [36, 48, 64] : [188, 207, 219];
  const ground = night ? [18, 24, 30] : [132, 146, 132];
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const above = v >= 0.5 ? smoothstep((v - 0.5) / 0.5) : 0;
    const below = v < 0.5 ? smoothstep((0.5 - v) / 0.5) : 0;
    let baseR: number;
    let baseG: number;
    let baseB: number;
    if (v >= 0.5) {
      baseR = horizon[0] + (zenith[0] - horizon[0]) * above;
      baseG = horizon[1] + (zenith[1] - horizon[1]) * above;
      baseB = horizon[2] + (zenith[2] - horizon[2]) * above;
    } else {
      baseR = horizon[0] + (ground[0] - horizon[0]) * below;
      baseG = horizon[1] + (ground[1] - horizon[1]) * below;
      baseB = horizon[2] + (ground[2] - horizon[2]) * below;
    }
    for (let x = 0; x < width; x++) {
      const u = x / width;
      let cloud = 0;
      if (v > 0.52 && v < 0.82) {
        for (const blob of clouds) {
          let du = Math.abs(u - blob.u);
          du = Math.min(du, 1 - du);
          const dv = v - blob.v;
          const d = Math.hypot(du / blob.rx, dv / blob.ry);
          const k = Math.max(0, 1 - d);
          cloud += k * k * blob.gain;
        }
        cloud = Math.min(cloud, night ? 0.28 : 0.42);
      }
      const lift = night ? 36 : 78;
      const i = (y * width + x) * 4;
      data[i] = Math.min(255, Math.max(0, Math.round(baseR + cloud * lift)));
      data[i + 1] = Math.min(255, Math.max(0, Math.round(baseG + cloud * lift)));
      data[i + 2] = Math.min(255, Math.max(0, Math.round(baseB + cloud * (lift * 0.92))));
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** Shared view outside every window. A distant residential green, not a surveyed site. */
export function createExteriorWorld(
  scene: THREE.Scene,
  options: { mobile?: boolean; economical?: boolean } = {},
): ExteriorWorld {
  const group = new THREE.Group();
  group.name = "shared-exterior-world";
  group.userData.exteriorWorld = true;
  const oldBackground = scene.background;
  const daySky = makeSkyTexture(false);
  const nightSky = makeSkyTexture(true);
  const dayGround = new THREE.Color("#6f8268");
  const nightGround = new THREE.Color("#2c3834");
  const groundMaterial = new THREE.MeshStandardMaterial({ color: dayGround, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), groundMaterial);
  ground.name = "exterior-ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y;
  ground.receiveShadow = false;
  ground.castShadow = false;
  ground.userData.exteriorPart = "ground";
  group.add(ground);

  const mobile = options.mobile === true;
  const economical = options.economical === true;
  const rand = seeded(SEED);
  const treeRows: Array<{ side: "north" | "south" | "west" | "east"; count: number; start: number; step: number }> = [
    { side: "north", count: economical ? 9 : mobile ? 12 : 17, start: -13, step: 4.1 },
    { side: "south", count: economical ? 9 : mobile ? 12 : 17, start: -13, step: 4.1 },
    { side: "west", count: economical ? 7 : mobile ? 9 : 13, start: -9, step: 4.1 },
    { side: "east", count: economical ? 7 : mobile ? 9 : 13, start: -9, step: 4.1 },
  ];
  const positions: Array<{ x: number; z: number; scale: number; yaw: number; height: number }> = [];
  for (const row of treeRows) {
    for (let i = 0; i < row.count; i++) {
      const along = row.start + i * row.step + (rand() - 0.5) * 1.1;
      const offset = (rand() - 0.5) * 1.3;
      let x = along;
      let z = 0;
      if (row.side === "north") z = -14.2 - offset;
      if (row.side === "south") z = 13.8 + offset;
      if (row.side === "west") { x = -3.9 - offset; z = along; }
      if (row.side === "east") { x = 17.3 + offset; z = along; }
      // Crown top is height meters above the ground, high enough to read from indoor eye level.
      positions.push({ x, z, scale: 0.78 + rand() * 0.42, yaw: rand() * Math.PI * 2, height: 8.15 + rand() * 1.7 });
    }
  }

  const trunkGeometry = new THREE.CylinderGeometry(0.09, 0.16, 1, 6, 1);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#6d5c48", roughness: 1, metalness: 0 });
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, positions.length);
  trunks.name = "exterior-tree-trunks";
  trunks.userData.exteriorPart = "tree-trunks";

  const branchGeometry = new THREE.CylinderGeometry(0.028, 0.05, 1, 5, 1);
  const branchMaterial = new THREE.MeshStandardMaterial({ color: "#625443", roughness: 1, metalness: 0 });
  const branchesPerTree = 4;
  const branches = new THREE.InstancedMesh(branchGeometry, branchMaterial, positions.length * branchesPerTree);
  branches.name = "exterior-tree-branches";
  branches.userData.exteriorPart = "tree-branches";

  const leavesPerTree = mobile ? 320 : 600;
  const leafGeometry = makeLeafGeometry();
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
    flatShading: false,
  });
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, positions.length * leavesPerTree);
  leaves.name = "exterior-tree-leaves";
  leaves.userData.exteriorPart = "tree-leaves";
  leaves.userData.trianglesPerLeaf = 4;
  const leafPalette = [
    new THREE.Color("#536d52"), new THREE.Color("#5f7958"),
    new THREE.Color("#6d8460"), new THREE.Color("#7b8b68"),
  ];
  const leafColors: THREE.Color[] = [];
  const leafTransform = new THREE.Object3D();

  const branchSpecs = [
    { yawOff: 0.18, pitch: 0.42, len: 0.29 },
    { yawOff: 1.72, pitch: 0.54, len: 0.31 },
    { yawOff: 3.22, pitch: 0.39, len: 0.27 },
    { yawOff: 4.76, pitch: 0.5, len: 0.3 },
  ];

  positions.forEach((tree, index) => {
    const s = tree.scale;
    const trunkH = tree.height * 0.58;
    trunks.setMatrixAt(index, matrixAt(tree.x, GROUND_Y + trunkH * 0.5, tree.z, s, trunkH, s, tree.yaw));
    const tips: THREE.Vector3[] = [];
    branchSpecs.forEach((spec, branch) => {
      const yaw = tree.yaw + spec.yawOff;
      const length = tree.height * spec.len;
      const baseY = GROUND_Y + trunkH * 0.9;
      const dir = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(spec.pitch, yaw, 0));
      const center = dir.clone().multiplyScalar(length * 0.5).add(new THREE.Vector3(tree.x, baseY, tree.z));
      branches.setMatrixAt(
        index * branchesPerTree + branch,
        matrixAt(center.x, center.y, center.z, s * 0.85, length, s * 0.85, yaw, spec.pitch),
      );
      const tip = dir.clone().multiplyScalar(length * 0.92).add(new THREE.Vector3(tree.x, baseY, tree.z));
      tips.push(tip);
    });
    // Distribute small leaves through four branch-tip lobes. The irregular
    // ellipsoids leave visible gaps instead of forming a closed spherical mass.
    for (let leaf = 0; leaf < leavesPerTree; leaf++) {
      const branch = leaf % branchesPerTree;
      const tip = tips[branch];
      const angle = rand() * Math.PI * 2;
      const radius = 0.22 + rand() * 0.82;
      const x = tip.x + Math.cos(angle) * radius * 0.76 * s;
      const z = tip.z + Math.sin(angle) * radius * 0.7 * s;
      const y = tip.y + (rand() - 0.5) * 0.9 * s;
      const leafYaw = rand() * Math.PI * 2;
      const leafPitch = 0.4 + rand() * 1.9;
      const leafRoll = rand() * Math.PI * 2;
      const leafWidth = (0.09 + rand() * 0.07) * s;
      const leafLength = (0.10 + rand() * 0.08) * s;
      const leafIndex = index * leavesPerTree + leaf;
      leafTransform.position.set(x, y, z);
      leafTransform.rotation.set(leafPitch, leafYaw, leafRoll);
      leafTransform.scale.set(leafWidth, leafLength, 0.12 * s);
      leafTransform.updateMatrix();
      leaves.setMatrixAt(leafIndex, leafTransform.matrix);
      leafColors[leafIndex] = leafPalette[Math.floor(rand() * leafPalette.length)];
    }
  });
  trunks.instanceMatrix.needsUpdate = true;
  branches.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;

  const buildingCount = economical ? 7 : mobile ? 10 : 15;
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingRoofGeometry = new THREE.ConeGeometry(0.72, 0.55, 4, 1);
  buildingRoofGeometry.rotateY(Math.PI / 4);
  const buildingWall = new THREE.MeshStandardMaterial({ color: "#cbbfae", roughness: 0.94, metalness: 0 });
  const buildingRoof = new THREE.MeshStandardMaterial({ color: "#7a6f64", roughness: 0.96, metalness: 0 });
  const eaveMaterial = new THREE.MeshStandardMaterial({ color: "#8d8174", roughness: 0.92, metalness: 0 });
  const bandMaterial = new THREE.MeshStandardMaterial({ color: "#d8d0c4", roughness: 0.9, metalness: 0 });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: "#7d909c", roughness: 0.32, metalness: 0.05, emissive: "#000000", emissiveIntensity: 0,
  });
  const litMaterial = new THREE.MeshStandardMaterial({
    color: "#d9c7ae", emissive: "#ffc48a", emissiveIntensity: 0.04, roughness: 0.42, metalness: 0,
  });
  const buildings = new THREE.InstancedMesh(buildingGeometry, buildingWall, buildingCount);
  const roofs = new THREE.InstancedMesh(buildingRoofGeometry, buildingRoof, buildingCount);
  const eaves = new THREE.InstancedMesh(buildingGeometry, eaveMaterial, buildingCount);
  buildings.name = "distant-residential-massing";
  roofs.name = "distant-residential-roofs";
  eaves.name = "distant-residential-eaves";
  for (const mesh of [trunks, branches, leaves, buildings, roofs, eaves]) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }
  buildings.userData.exteriorPart = "distant-building";
  roofs.userData.exteriorPart = "distant-building";
  eaves.userData.exteriorPart = "distant-building";

  const windowMatrices: THREE.Matrix4[] = [];
  const litMatrices: THREE.Matrix4[] = [];
  const bandMatrices: THREE.Matrix4[] = [];
  for (let i = 0; i < buildingCount; i++) {
    const side = i % 4;
    const along = -22 + i * (economical ? 7.5 : 5.2) + rand() * 2;
    const x = side < 2 ? along : (side === 2 ? -22 : 39) + rand() * 5;
    const z = side === 0 ? -30 - rand() * 7 : side === 1 ? 29 + rand() * 8 : along;
    const w = 4.4 + rand() * 2.4;
    const d = 3.8 + rand() * 2.1;
    const stories = rand() > 0.42 ? 3 : 2;
    const h = stories * FLOOR_H;
    const yaw = (rand() - 0.5) * 0.5;
    buildings.setMatrixAt(i, matrixAt(x, GROUND_Y + h / 2, z, w, h, d, yaw));
    eaves.setMatrixAt(i, matrixAt(x, GROUND_Y + h + 0.12, z, w * 1.14, 0.22, d * 1.14, yaw));
    roofs.setMatrixAt(i, matrixAt(x, GROUND_Y + h + 0.55, z, w * 0.86, 1.35, d * 0.86, yaw));
    const orient = matrixAt(x, 0, z, 1, 1, 1, yaw);
    for (let floor = 1; floor < stories; floor++) {
      bandMatrices.push(orient.clone().multiply(
        matrixAt(0, GROUND_Y + floor * FLOOR_H, 0, w * 1.03, 0.1, d * 1.03),
      ));
    }
    const colsX = [-0.22 * w, 0.22 * w];
    const colsZ = [0];
    for (let floor = 0; floor < stories; floor++) {
      const ly = floor * FLOOR_H + 1.45;
      const openings: Array<[number, number, number, number, number]> = [
        ...colsX.map((lx) => [lx, ly, d / 2 + 0.05, 0.78, 0.08] as [number, number, number, number, number]),
        ...colsX.map((lx) => [lx, ly, -(d / 2 + 0.05), 0.78, 0.08] as [number, number, number, number, number]),
        ...colsZ.map((lz) => [w / 2 + 0.05, ly, lz, 0.08, 0.7] as [number, number, number, number, number]),
        ...colsZ.map((lz) => [-(w / 2 + 0.05), ly, lz, 0.08, 0.7] as [number, number, number, number, number]),
      ];
      openings.forEach(([lx, wy, lz, sx, sz], opening) => {
        const local = matrixAt(lx, GROUND_Y + wy, lz, sx, 1.12, sz);
        const world = orient.clone().multiply(local);
        const lit = (i * 5 + floor * 3 + opening) % 8 === 0;
        (lit ? litMatrices : windowMatrices).push(world);
      });
    }
  }
  const bands = new THREE.InstancedMesh(buildingGeometry, bandMaterial, Math.max(1, bandMatrices.length));
  const windows = new THREE.InstancedMesh(buildingGeometry, glassMaterial, Math.max(1, windowMatrices.length));
  const litWindows = new THREE.InstancedMesh(buildingGeometry, litMaterial, Math.max(1, litMatrices.length));
  bands.name = "distant-residential-floor-bands";
  windows.name = "distant-residential-windows";
  litWindows.name = "distant-residential-lit-windows";
  bandMatrices.forEach((matrix, index) => bands.setMatrixAt(index, matrix));
  windowMatrices.forEach((matrix, index) => windows.setMatrixAt(index, matrix));
  litMatrices.forEach((matrix, index) => litWindows.setMatrixAt(index, matrix));
  bands.count = bandMatrices.length;
  windows.count = windowMatrices.length;
  litWindows.count = litMatrices.length;
  for (const mesh of [bands, windows, litWindows]) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.exteriorPart = "distant-building";
    mesh.instanceMatrix.needsUpdate = true;
  }
  buildings.instanceMatrix.needsUpdate = true;
  roofs.instanceMatrix.needsUpdate = true;
  eaves.instanceMatrix.needsUpdate = true;
  group.add(trunks, branches, leaves, buildings, eaves, bands, roofs, windows, litWindows);
  scene.add(group);

  const applyFoliage = (night: boolean) => {
    const tint = night ? 0.42 : 1;
    const instanceTint = new THREE.Color();
    leafColors.forEach((color, index) => {
      leaves.setColorAt(index, instanceTint.copy(color).multiplyScalar(tint));
    });
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  };
  const dayWall = new THREE.Color("#cbbfae");
  const nightWall = new THREE.Color("#6a6258");
  const dayRoof = new THREE.Color("#7a6f64");
  const nightRoof = new THREE.Color("#3a342f");
  const dayEave = new THREE.Color("#8d8174");
  const nightEave = new THREE.Color("#4a433c");
  const dayBand = new THREE.Color("#ddd4c6");
  const nightBand = new THREE.Color("#756c62");
  const dayGlass = new THREE.Color("#7d909c");
  const nightGlass = new THREE.Color("#1b242c");
  const dayLit = new THREE.Color("#c9b79a");
  const nightLit = new THREE.Color("#ffe0b8");

  const setNight = (night: boolean) => {
    scene.background = night ? nightSky : daySky;
    groundMaterial.color.copy(night ? nightGround : dayGround);
    trunkMaterial.color.set(night ? "#3e342c" : "#6d5c48");
    branchMaterial.color.set(night ? "#3a3129" : "#625443");
    buildingWall.color.copy(night ? nightWall : dayWall);
    buildingRoof.color.copy(night ? nightRoof : dayRoof);
    eaveMaterial.color.copy(night ? nightEave : dayEave);
    bandMaterial.color.copy(night ? nightBand : dayBand);
    glassMaterial.color.copy(night ? nightGlass : dayGlass);
    litMaterial.color.copy(night ? nightLit : dayLit);
    litMaterial.emissiveIntensity = night ? 0.85 : 0.03;
    applyFoliage(night);
  };
  setNight(false);

  const audit = () => {
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    let meshCount = 0;
    let intersectsEnvelope = false;
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      meshCount++;
      if (meshIntersectsHome(object)) intersectsEnvelope = true;
    });
    return {
      treeInstances: positions.length,
      leafInstances: leaves.count,
      leafTriangleCount: leaves.count * leafGeometry.userData.trianglesPerLeaf,
      buildingInstances: buildingCount,
      meshCount,
      bounds: { min: bounds.min.toArray() as [number, number, number], max: bounds.max.toArray() as [number, number, number] },
      intersectsHomeEnvelope: intersectsEnvelope,
      groundY: GROUND_Y,
      deterministicSeed: SEED,
    };
  };
  const dispose = () => {
    scene.remove(group);
    scene.background = oldBackground;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    daySky.dispose();
    nightSky.dispose();
  };
  return { group, setNight, audit, dispose };
}
