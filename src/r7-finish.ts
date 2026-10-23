import * as THREE from "three";
import { mineralSurface } from "./mineral-surface";

let tileMaps: { color: THREE.DataTexture; rough: THREE.DataTexture; normal: THREE.DataTexture } | null = null;

let brushMaps: { rough: THREE.DataTexture; normal: THREE.DataTexture } | null = null;

/** One 100mm tile per texture. Repeat of 10 is ten tiles per metre. */
function tileTextures() {
  if (tileMaps) return tileMaps;
  const size = 64;
  const mineral = mineralSurface(size);
  const color = mineral.map.clone();
  const rough = mineral.roughnessMap.clone();
  const normal = mineral.normalMap.clone();
  const height = new Float32Array(size * size);
  const img = color.image.data as Uint8Array;
  const rv = rough.image.data as Uint8Array;
  const nv = normal.image.data as Uint8Array;
  const groutPx = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grout = x < groutPx || y < groutPx;
    const o = (y * size + x) * 4;
    const wave = Math.sin(x * 0.62) * Math.sin(y * 0.47);
    height[y * size + x] = grout ? 0 : 0.007 + wave * 0.005;
    if (grout) {
      img[o] = 224; img[o + 1] = 222; img[o + 2] = 216;
      rv[o] = rv[o + 1] = rv[o + 2] = 210;
    } else {
      const shade = Math.round(142 + wave * 15);
      img[o] = shade - 14; img[o + 1] = shade; img[o + 2] = shade + 18;
      const gloss = Math.round(38 + (wave + 1) * 16);
      rv[o] = rv[o + 1] = rv[o + 2] = gloss;
    }
  }
  const h = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const direction = new THREE.Vector3((h(x - 1, y) - h(x + 1, y)) * 12, (h(x, y - 1) - h(x, y + 1)) * 12, 1).normalize();
    const o = (y * size + x) * 4;
    nv[o] = Math.round((direction.x * 0.5 + 0.5) * 255);
    nv[o + 1] = Math.round((direction.y * 0.5 + 0.5) * 255);
    nv[o + 2] = Math.round((direction.z * 0.5 + 0.5) * 255);
  }
  color.colorSpace = THREE.SRGBColorSpace;
  for (const tex of [color, rough, normal]) {
    tex.needsUpdate = true;
    tex.repeat.set(10, 10);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  }
  tileMaps = { color, rough, normal };
  return tileMaps;
}

function brushTextures() {
  if (brushMaps) return brushMaps;
  const w = 32;
  const h = 8;
  const rough = new Uint8Array(w * h * 4);
  const normal = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const stripe = x % 4 === 0 ? 0.55 : 0.28;
    const o = (y * w + x) * 4;
    const value = Math.round(stripe * 255);
    rough[o] = rough[o + 1] = rough[o + 2] = value;
    rough[o + 3] = 255;
    const tilt = x % 4 === 0 ? 0.18 : 0;
    const direction = new THREE.Vector3(tilt, 0, 1).normalize();
    normal[o] = Math.round((direction.x * 0.5 + 0.5) * 255);
    normal[o + 1] = Math.round((direction.y * 0.5 + 0.5) * 255);
    normal[o + 2] = Math.round((direction.z * 0.5 + 0.5) * 255);
    normal[o + 3] = 255;
  }
  const roughTex = new THREE.DataTexture(rough, w, h);
  const normalTex = new THREE.DataTexture(normal, w, h);
  for (const tex of [roughTex, normalTex]) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    tex.repeat.set(8, 1);
  }
  brushMaps = { rough: roughTex, normal: normalTex };
  return brushMaps;
}

function kitchenCheckerTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const du = (u + v) * 2;
      const dv = (u - v + 2) * 2;
      const fu = Math.abs(du - Math.round(du));
      const fv = Math.abs(dv - Math.round(dv));
      const grout = fu < 0.028 || fv < 0.028;
      const warm = (Math.floor(du) + Math.floor(dv)) % 2 === 0;
      const grain = Math.round(Math.sin(x * 0.37) * Math.cos(y * 0.41) * 4);
      const o = (y * size + x) * 4;
      if (grout) {
        data[o] = 214;
        data[o + 1] = 208;
        data[o + 2] = 196;
      } else if (warm) {
        data[o] = Math.min(255, 218 + grain);
        data[o + 1] = Math.min(255, 146 + grain);
        data[o + 2] = Math.max(0, 66 + grain);
      } else {
        data[o] = Math.min(255, 242 + grain);
        data[o + 1] = Math.min(255, 236 + grain);
        data[o + 2] = Math.min(255, 224 + grain);
      }
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.6, 1.6);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function plaidBeddingTexture(scale = 7) {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x / 16)) % 2 === 0;
      const gy = Math.floor((y / 16)) % 2 === 0;
      const fine = ((x + y) % 3 === 0 ? 4 : 0) - ((x * 3 + y) % 4 === 0 ? 3 : 0);
      const o = (y * size + x) * 4;
      if (gx && gy) {
        data[o] = 240 + fine;
        data[o + 1] = 233 + fine;
        data[o + 2] = 221 + fine;
      } else if (gx !== gy) {
        data[o] = 186 + fine;
        data[o + 1] = 158 + fine;
        data[o + 2] = 132 + fine;
      } else {
        data[o] = 138 + fine;
        data[o + 1] = 104 + fine;
        data[o + 2] = 77 + fine;
      }
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(scale, scale);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function cinemaRugTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = ((x % 32) - 16) / 16;
      const cy = ((y % 32) - 16) / 16;
      const dist = Math.hypot(cx, cy);
      const diamond = Math.abs(cx) + Math.abs(cy);
      const weave = ((x + y) % 2 === 0 ? 5 : -4);
      const o = (y * size + x) * 4;
      if (dist < 0.56 || diamond < 0.65) {
        data[o] = 86 + weave;
        data[o + 1] = 102 + weave;
        data[o + 2] = 114 + weave;
      } else if (diamond < 0.92) {
        data[o] = 156 + weave;
        data[o + 1] = 56 + weave;
        data[o + 2] = 44 + weave;
      } else {
        data[o] = 64 + weave;
        data[o + 1] = 54 + weave;
        data[o + 2] = 50 + weave;
      }
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function stripeThrowTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const band = y % 32;
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      const knit = (x % 4 === 0 ? 6 : 0);
      if (band < 12) {
        data[o] = 228 + knit; data[o + 1] = 216 + knit; data[o + 2] = 194 + knit;
      } else if (band < 22) {
        data[o] = 142 + knit; data[o + 1] = 48 + knit; data[o + 2] = 38 + knit;
      } else {
        data[o] = 34 + knit; data[o + 1] = 42 + knit; data[o + 2] = 52 + knit;
      }
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.needsUpdate = true;
  return tex;
}

function cloneStd(source: THREE.Material, color: string, roughness: number, metalness: number) {
  const material = (source as THREE.MeshStandardMaterial).clone();
  material.color.set(color);
  material.metalness = metalness;
  const keepMap = material.roughnessMap && (source as THREE.MeshStandardMaterial).roughness === 1;
  material.roughness = keepMap ? 1 : roughness;
  material.userData.r7Role = true;
  return material;
}

/** Shared R7 finishes. Call once before meshes are built. */
export function ensureR7Materials(m: Record<string, THREE.Material>) {
  if (m.r7Pale) return;
  m.r7Pale = cloneStd(m.cabinetPaint || m.upperPaint, "#e4dfd6", 0.76, 0.02);
  m.r7Pale.name = "r7Pale";
  m.r7NicheWood = cloneStd(m.oak, "#936744", 0.62, 0.02);
  m.r7NicheWood.name = "r7NicheWood";
  m.r7LipWood = cloneStd(m.oak, "#825b3b", 0.56, 0.02);
  m.r7LipWood.name = "r7LipWood";
  m.r7Mustard = cloneStd(m.linen || m.sage, "#c89f36", 0.86, 0);
  m.r7Mustard.name = "r7Mustard";
  const leather = cloneStd(m.linen || m.oak, "#202225", 0.44, 0.05);
  leather.roughness = 0.44;
  leather.roughnessMap = null;
  leather.name = "r7BlackLeather";
  m.r7BlackLeather = leather;
  const forest = cloneStd(m.linen || m.sage, "#3f5340", 0.88, 0);
  forest.name = "r7ForestGreen";
  m.r7ForestGreen = forest;
  const rust = cloneStd(m.linen || m.sage, "#943e2f", 0.86, 0);
  rust.name = "r7RustPillow";
  m.r7RustPillow = rust;
  const glass = new THREE.MeshStandardMaterial({
    color: "#1c1e22",
    roughness: 0.08,
    metalness: 0.04,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  glass.name = "r7BlackGlass";
  glass.userData.r7Role = true;
  m.r7BlackGlass = glass;
  const ink = new THREE.MeshStandardMaterial({ color: "#16181c", roughness: 0.42, metalness: 0.08 });
  ink.name = "r7Ink";
  ink.userData.r7Role = true;
  m.r7Ink = ink;
  const brush = brushTextures();
  const steel = new THREE.MeshStandardMaterial({
    color: "#c5c8cc",
    roughness: 1,
    metalness: 0.82,
    roughnessMap: brush.rough,
    normalMap: brush.normal,
  });
  steel.name = "r7Brushed";
  steel.userData.r7Role = true;
  m.r7Brushed = steel;
  const maps = tileTextures();
  const tile = new THREE.MeshStandardMaterial({
    color: "#b8c7d4",
    map: maps.color,
    roughnessMap: maps.rough,
    normalMap: maps.normal,
    roughness: 1,
    metalness: 0.08,
  });
  tile.name = "r7Tile";
  tile.userData.r7Role = true;
  m.r7Tile = tile;
  const kitchenChecker = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: kitchenCheckerTexture(),
    roughness: 0.72,
    metalness: 0.02,
  });
  kitchenChecker.name = "r7KitchenChecker";
  kitchenChecker.userData.r7Role = true;
  m.r7KitchenChecker = kitchenChecker;
  const plaid = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: plaidBeddingTexture(7),
    roughness: 0.9,
    metalness: 0,
  });
  plaid.name = "r7PlaidBedding";
  plaid.userData.r7Role = true;
  m.r7PlaidBedding = plaid;
  const plaidPillow = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: plaidBeddingTexture(5),
    roughness: 0.88,
    metalness: 0,
  });
  plaidPillow.name = "r7PlaidPillow";
  plaidPillow.userData.r7Role = true;
  m.r7PlaidPillow = plaidPillow;
  const cinemaRug = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: cinemaRugTexture(),
    roughness: 0.92,
    metalness: 0,
  });
  cinemaRug.name = "r7CinemaRug";
  cinemaRug.userData.r7Role = true;
  m.r7CinemaRug = cinemaRug;
  const stripeThrow = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: stripeThrowTexture(),
    roughness: 0.9,
    metalness: 0,
  });
  stripeThrow.name = "r7StripeThrow";
  stripeThrow.userData.r7Role = true;
  m.r7StripeThrow = stripeThrow;
  const stripe = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const bar = x % 18 < 2;
    const o = (y * 64 + x) * 4;
    stripe[o] = bar ? 132 : 118;
    stripe[o + 1] = bar ? 54 : 134;
    stripe[o + 2] = bar ? 58 : 148;
    stripe[o + 3] = 255;
  }
  const stripeMap = new THREE.DataTexture(stripe, 64, 64);
  stripeMap.wrapS = stripeMap.wrapT = THREE.RepeatWrapping;
  stripeMap.colorSpace = THREE.SRGBColorSpace;
  stripeMap.needsUpdate = true;
  const cloth = new THREE.MeshStandardMaterial({ color: "#ffffff", map: stripeMap, roughness: 0.9 });
  cloth.name = "r7ClothStripe";
  cloth.userData.r7Role = true;
  m.r7ClothStripe = cloth;
  const weave = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const n = ((x + y) % 5 === 0 ? 18 : 0) + ((x * 3 + y) % 7);
    const o = (y * 32 + x) * 4;
    weave[o] = 196 + n; weave[o + 1] = 98 + n / 2; weave[o + 2] = 32; weave[o + 3] = 255;
  }
  const weaveMap = new THREE.DataTexture(weave, 32, 32);
  weaveMap.wrapS = weaveMap.wrapT = THREE.RepeatWrapping;
  weaveMap.colorSpace = THREE.SRGBColorSpace;
  weaveMap.repeat.set(8, 6);
  weaveMap.needsUpdate = true;
  const rugMat = new THREE.MeshStandardMaterial({ color: "#ffffff", map: weaveMap, roughness: 0.94 });
  rugMat.name = "r7Rug";
  rugMat.userData.r7Role = true;
  m.r7Rug = rugMat;
  const menuMat = new THREE.MeshStandardMaterial({ color: "#1b1c1a", roughness: 0.7 });
  menuMat.name = "r7Menu";
  menuMat.userData.r7Role = true;
  m.r7Menu = menuMat;
}

/** Room remaps must not replace a material this layer already assigned. */
export function lockR7Materials(root: THREE.Object3D) {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    const material = mesh.material as THREE.Material | undefined;
    if (material?.userData?.r7Role) mesh.userData.r7Locked = true;
  });
}
