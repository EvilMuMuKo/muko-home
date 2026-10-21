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
      img[o] = 214; img[o + 1] = 214; img[o + 2] = 210;
      rv[o] = rv[o + 1] = rv[o + 2] = 210;
    } else {
      const shade = Math.round(168 + wave * 16);
      img[o] = shade + 6; img[o + 1] = shade + 8; img[o + 2] = shade + 10;
      const gloss = Math.round(42 + (wave + 1) * 18);
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
  m.r7Pale = cloneStd(m.cabinetPaint || m.upperPaint, "#e4dfd6", 0.78, 0.02);
  m.r7NicheWood = cloneStd(m.oak, "#9a704c", 0.62, 0.02);
  m.r7LipWood = cloneStd(m.oak, "#8d6848", 0.58, 0.02);
  m.r7Mustard = cloneStd(m.linen || m.sage, "#c6a23a", 0.86, 0);
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
    color: "#d5d8da",
    map: maps.color,
    roughnessMap: maps.rough,
    normalMap: maps.normal,
    roughness: 1,
    metalness: 0.08,
  });
  tile.name = "r7Tile";
  tile.userData.r7Role = true;
  m.r7Tile = tile;
  const stripe = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const bar = x % 18 < 1;
    const o = (y * 64 + x) * 4;
    stripe[o] = bar ? 122 : 132;
    stripe[o + 1] = bar ? 58 : 150;
    stripe[o + 2] = bar ? 64 : 162;
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
