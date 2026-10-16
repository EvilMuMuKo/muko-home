import * as THREE from "three";
import { mineralSurface } from "./mineral-surface";
import type { WebGPURenderer } from "three/webgpu";
const textureState = {
  requested: 12,
  loaded: 0,
  failed: [] as string[],
  metricMapping: true,
};
type SurfaceRole =
  | "wood"
  | "mineral"
  | "stone"
  | "fabric"
  | "metal"
  | "glass"
  | "mirror"
  | "paint"
  | "decor";

/** Stable, inspectable material identity without changing renderer behavior. */
export function auditMaterial(
  material: THREE.Material,
  name: string,
  role: SurfaceRole,
) {
  material.name = name;
  material.userData = {
    ...material.userData,
    materialAudit: {
      name,
      role,
      roughness:
        "roughness" in material
          ? (material as THREE.MeshStandardMaterial).roughness
          : null,
      metalness:
        "metalness" in material
          ? (material as THREE.MeshStandardMaterial).metalness
          : null,
      maps: {
        color: "map" in material && Boolean(material.map),
        normal: "normalMap" in material && Boolean(material.normalMap),
        roughness: "roughnessMap" in material && Boolean(material.roughnessMap),
      },
    },
  };
  return material;
}

/** Read-only audit view useful to diagnostics; no caller changes are required. */
export function auditMaterialSet(materials: Record<string, THREE.Material>) {
  return Object.entries(materials).map(([key, material]) => {
    const m = material as THREE.MeshPhysicalMaterial;
    return {
      key, name: material.name || key, role: material.userData.materialAudit?.role,
      roughness: m.roughness ?? null, metalness: m.metalness ?? null,
      transmission: m.transmission ?? 0,
      maps: {color:!!m.map, normal:!!m.normalMap, roughness:!!m.roughnessMap},
      channels: ["map", "normalMap", "roughnessMap"].map(channel => {
        const texture = (m as any)[channel] as THREE.Texture | null;
        return texture ? {channel, colorSpace:texture.colorSpace, width:(texture.image as any)?.width,
          height:(texture.image as any)?.height, repeat:texture.repeat.toArray(), anisotropy:texture.anisotropy,
          provenance:texture.userData.materialAudit ?? null} : {channel, missing:true};
      }),
    };
  });
}
export const materialDetailState = () => ({
  ...textureState,
  failed: [...textureState.failed],
});
export async function refineMaterials(
  materials: Record<string, THREE.Material>,
  renderer: THREE.WebGLRenderer | WebGPURenderer,
) {
  const mobile = matchMedia("(max-width:1000px), (pointer:coarse)").matches;
  const loader = new THREE.TextureLoader();
  const anisotropy = Math.min(
    8,
    (renderer as THREE.WebGLRenderer).capabilities?.getMaxAnisotropy?.() ?? 4,
  );
  const load = async (name: string, channel: string) => {
    try {
      const texture = await loader.loadAsync(
        `${import.meta.env.BASE_URL}materials/${name}-${channel}${name === "floor" && !mobile ? "-desktop" : ""}.webp`,
      );
      texture.colorSpace =
        channel === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      const tileMeters =
        name === "oak"
          ? [0.5, 0.5]
          : name === "floor"
            ? [1.7, 1.7]
            : name === "plaster" ? [1.5, 1.5] : [0.28, 0.28];
      // Preserve metre-based mapping while slightly tightening oak repeats and
      // keeping the floor-board and linen textures close to their source scale.
      texture.repeat.set(1 / tileMeters[0], 1 / tileMeters[1]);
      texture.userData = {
        ...texture.userData,
        materialAudit: { family: name, channel, tileMeters },
      };
      texture.anisotropy = anisotropy;
      textureState.loaded++;
      return texture;
    } catch {
      textureState.failed.push(`${name}-${channel}`);
      return null;
    }
  };
  const maps = await Promise.all(
    (["oak", "floor", "linen", "plaster"] as const).map(async (name) => {
      const [map, normalMap, roughnessMap] = await Promise.all(
        ["color", "normal", "roughness"].map((channel) => load(name, channel)),
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
    // The measured map encodes absolute roughness; do not multiply it into gloss.
    material.roughness = mapSet.roughnessMap ? 1 : 0.85;
    auditMaterial(
      material,
      name,
      name === "oak" || name === "darkoak"
        ? "wood"
        : name === "floor"
          ? "wood"
          : "fabric",
    );
  };
  for (const name of ["oak", "darkoak"]) replace(name, maps[0], 0.17);
  replace("floor", maps[1], 0.15);
  for (const name of ["linen", "sage"]) replace(name, maps[2], 0.2);
  (materials.oak as THREE.MeshStandardMaterial).color.set("#ffffff");
  (materials.darkoak as THREE.MeshStandardMaterial).color.set("#b49a78");
  (materials.floor as THREE.MeshStandardMaterial).color.set("#ffffff");
  (materials.linen as THREE.MeshStandardMaterial).color.set("#f0e9de");
  (materials.sage as THREE.MeshStandardMaterial).color.set("#a3ad96");
  (materials.stone as THREE.MeshStandardMaterial).color.set("#eee7da");
  const plaster = materials.plaster as THREE.MeshStandardMaterial;
  plaster.map = maps[3].map;
  plaster.normalMap = maps[3].normalMap;
  plaster.roughnessMap = maps[3].roughnessMap;
  plaster.normalScale.setScalar(0.15);
  plaster.roughness = 1;
  plaster.color.set("#ffffff");
  const mineral = mineralSurface();
  const stone = materials.stone as THREE.MeshStandardMaterial;
  Object.assign(stone, mineral);
  stone.color.set("#ffffff");
  stone.normalScale.setScalar(0.35);
  stone.roughness = 1;
  materials.upperPaint = auditMaterial(
    new THREE.MeshStandardMaterial({
      color: "#e8e4d8",
      roughness: 0.68,
    }),
    "upperPaint",
    "paint",
  );
  materials.cabinetInterior = auditMaterial(
    new THREE.MeshStandardMaterial({
      color: "#d9cbb6",
      roughness: 0.78,
    }),
    "cabinetInterior",
    "wood",
  );
  materials.bookClay = auditMaterial(
    new THREE.MeshStandardMaterial({
      color: "#a66e50",
      roughness: 0.84,
    }),
    "bookClay",
    "decor",
  );
  materials.bookSage = auditMaterial(
    new THREE.MeshStandardMaterial({
      color: "#647564",
      roughness: 0.88,
    }),
    "bookSage",
    "decor",
  );
  materials.bookCream = auditMaterial(
    new THREE.MeshStandardMaterial({
      color: "#ddd0b5",
      roughness: 0.89,
    }),
    "bookCream",
    "decor",
  );
  materials.displayGlass = auditMaterial(
    new THREE.MeshPhysicalMaterial({
      color: "#f6faf8",
      roughness: 0.045,
      metalness: 0,
      transmission: mobile ? 0 : 0.9,
      thickness: 0.008,
      ior: 1.5,
      transparent: mobile,
      opacity: mobile ? 0.28 : 1,
      depthWrite: !mobile,
      clearcoat: 0,
    }),
    "displayGlass",
    "glass",
  );
  materials.mirror = auditMaterial(
    new THREE.MeshStandardMaterial({
      color: "#f4f4f2",
      metalness: 1,
      roughness: 0.035,
    }),
    "mirror",
    "mirror",
  );
  const paintNoise = new Uint8Array(64 * 64 * 4);
  let seed = 17;
  for (let i = 0; i < paintNoise.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 225 + (seed % 23);
    paintNoise[i] = paintNoise[i + 1] = paintNoise[i + 2] = value;
    paintNoise[i + 3] = 255;
  }
  const micro = new THREE.DataTexture(paintNoise, 64, 64);
  micro.name = "shared-paint-roughness-micro";
  micro.userData = {
    ...micro.userData,
    materialAudit: {
      family: "subtle paint microtexture",
      channel: "roughness",
    },
  };
  micro.wrapS = micro.wrapT = THREE.RepeatWrapping;
  micro.repeat.set(16, 16);
  micro.magFilter = THREE.LinearFilter;
  micro.minFilter = THREE.LinearMipmapLinearFilter;
  micro.generateMipmaps = true;
  micro.needsUpdate = true;
  for (const name of [
    "upperPaint",
    "cabinetPaint",

  ]) {
    const m = materials[name] as THREE.MeshStandardMaterial;
    if (!m) continue;
    m.roughnessMap = micro;
    auditMaterial(
      m,
      name,
      name === "steel" || name === "bronze"
        ? "metal"
        : name === "plaster"
          ? "mineral"
          : "paint",
    );
  }
  for (const name of ["steel", "bronze"]) {
    const m = materials[name] as THREE.MeshStandardMaterial;
    if (m) { m.roughnessMap = null; m.metalness = 1; m.roughness = name === "steel" ? 0.28 : 0.36; }
  }
  for (const name of ["cabinetInterior", "bookClay", "bookSage", "bookCream"]) {
    const m = materials[name] as THREE.MeshStandardMaterial;
    const family = name === "cabinetInterior" ? maps[0] : maps[2];
    m.normalMap = family.normalMap; m.normalScale.setScalar(0.06);
    m.roughnessMap = family.roughnessMap; m.roughness = 1;
  }
  for (const [name, material] of Object.entries(materials)) {
    const priorRole = material.userData.materialAudit?.role as
      SurfaceRole | undefined;
    const role =
      priorRole ??
      (/wood|oak|cabinetInterior/i.test(name)
        ? "wood"
        : /stone/i.test(name)
          ? "stone"
          : /steel|bronze|metal/i.test(name)
            ? "metal"
            : /glass/i.test(name)
              ? "glass"
              : /linen|fabric|sage|curtain/i.test(name)
                ? "fabric"
                : /plaster/i.test(name)
                  ? "mineral"
                  : "paint");
    auditMaterial(material, name, role);
  }
}
