import * as THREE from "three";
import type { WebGPURenderer } from "three/webgpu";
const textureState = {
  requested: 9,
  loaded: 0,
  failed: [] as string[],
  metricMapping: true,
};
export const materialDetailState = () => ({
  ...textureState,
  failed: [...textureState.failed],
});
export async function refineMaterials(
  materials: Record<string, THREE.Material>,
  renderer: THREE.WebGLRenderer | WebGPURenderer,
) {
  const loader = new THREE.TextureLoader();
  const anisotropy = Math.min(
    8,
    (renderer as THREE.WebGLRenderer).capabilities?.getMaxAnisotropy?.() ?? 4,
  );
  const load = async (name: string, channel: string, tile: number) => {
    try {
      const texture = await loader.loadAsync(
        `${import.meta.env.BASE_URL}materials/${name}-${channel}.webp`,
      );
      texture.colorSpace =
        channel === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1 / tile, 1 / tile);
      texture.anisotropy = anisotropy;
      textureState.loaded++;
      return texture;
    } catch {
      textureState.failed.push(`${name}-${channel}`);
      return null;
    }
  };
  const maps = await Promise.all(
    (["oak", "floor", "linen"] as const).map(async (name) => {
      const tile = { oak: 0.5, floor: 1.7, linen: 0.271 }[name];
      const [map, normalMap, roughnessMap] = await Promise.all(
        ["color", "normal", "roughness"].map((channel) =>
          load(name, channel, tile),
        ),
      );
      return { name, map, normalMap, roughnessMap };
    }),
  );
  const replace = (
    name: string,
    mapSet: (typeof maps)[number],
    normalScale: number,
  ) => {
    const material = materials[name] as THREE.MeshStandardMaterial;
    if (!material) return;
    if (mapSet.map) material.map = mapSet.map;
    if (mapSet.normalMap) material.normalMap = mapSet.normalMap;
    if (mapSet.roughnessMap) material.roughnessMap = mapSet.roughnessMap;
    material.normalScale.setScalar(normalScale);
    material.roughness = 1;
  };
  for (const name of ["oak", "darkoak"]) replace(name, maps[0], 0.24);
  replace("floor", maps[1], 0.3);
  for (const name of ["linen", "sage"]) replace(name, maps[2], 0.32);
  (materials.oak as THREE.MeshStandardMaterial).color.set("#eee5d5");
  (materials.darkoak as THREE.MeshStandardMaterial).color.set("#ac9170");
  (materials.floor as THREE.MeshStandardMaterial).color.set("#f6eddd");
  (materials.linen as THREE.MeshStandardMaterial).color.set("#f0e9dc");
  (materials.sage as THREE.MeshStandardMaterial).color.set("#9aaa91");
  materials.upperPaint = new THREE.MeshStandardMaterial({
    color: "#e8e4d8",
    roughness: 0.57,
  });
  materials.cabinetInterior = new THREE.MeshStandardMaterial({
    color: "#d6c6ac",
    roughness: 0.82,
  });
  materials.bookClay = new THREE.MeshStandardMaterial({
    color: "#a66e50",
    roughness: 0.84,
  });
  materials.bookSage = new THREE.MeshStandardMaterial({
    color: "#647564",
    roughness: 0.88,
  });
  materials.bookCream = new THREE.MeshStandardMaterial({
    color: "#ddd0b5",
    roughness: 0.89,
  });
  materials.displayGlass = new THREE.MeshPhysicalMaterial({
    color: "#d5e5dd",
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    clearcoat: 1,
  });
  materials.mirror = new THREE.MeshStandardMaterial({
    color: "#e2e7e5",
    metalness: 1,
    roughness: 0.045,
  });
  const paintNoise = new Uint8Array(64 * 64 * 4);
  let seed = 17;
  for (let i = 0; i < paintNoise.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 225 + (seed % 23);
    paintNoise[i] = paintNoise[i + 1] = paintNoise[i + 2] = value;
    paintNoise[i + 3] = 255;
  }
  const micro = new THREE.DataTexture(paintNoise, 64, 64);
  micro.wrapS = micro.wrapT = THREE.RepeatWrapping;
  micro.repeat.set(16, 16);
  micro.magFilter = THREE.LinearFilter;
  micro.minFilter = THREE.LinearMipmapLinearFilter;
  micro.generateMipmaps = true;
  micro.needsUpdate = true;
  for (const name of [
    "upperPaint",
    "cabinetPaint",
    "plaster",
    "steel",
    "bronze",
  ]) {
    const m = materials[name] as THREE.MeshStandardMaterial;
    m.roughnessMap = micro;
  }
}
