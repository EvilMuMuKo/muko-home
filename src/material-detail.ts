import * as THREE from "three";
import { mineralSurface } from "./mineral-surface";
import type { WebGPURenderer } from "three/webgpu";
const textureState = {
  requested: 12,
  loaded: 0,
  failed: [] as string[],
  metricMapping: true,
};
let materialTexturesReady: Promise<void> = Promise.resolve();

export type RefineMaterialsOptions = {
  /** Install renderable maps immediately, then hydrate those same Texture objects. */
  progressive?: boolean;
  onTextureReady?: (event: {
    family: string;
    channel: string;
    loaded: number;
    requested: number;
    failed: number;
  }) => void;
};

/** Resolves when the latest refineMaterials call has finished all image loads. */
export function whenMaterialTexturesReady() {
  return materialTexturesReady;
}
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
      key,
      name: material.name || key,
      role: material.userData.materialAudit?.role,
      roughness: m.roughness ?? null,
      metalness: m.metalness ?? null,
      transmission: m.transmission ?? 0,
      maps: {
        color: !!m.map,
        normal: !!m.normalMap,
        roughness: !!m.roughnessMap,
      },
      channels: ["map", "normalMap", "roughnessMap"].map((channel) => {
        const texture = (m as any)[channel] as THREE.Texture | null;
        return texture
          ? {
              channel,
              uuid: texture.uuid,
              colorSpace: texture.colorSpace,
              width: (texture.image as any)?.width,
              height: (texture.image as any)?.height,
              repeat: texture.repeat.toArray(),
              anisotropy: texture.anisotropy,
              minFilter: texture.minFilter,
              magFilter: texture.magFilter,
              generateMipmaps: texture.generateMipmaps,
              provenance: texture.userData.materialAudit ?? null,
            }
          : { channel, missing: true };
      }),
    };
  });
}
export const materialDetailState = () => ({
  ...textureState,
  failed: [...textureState.failed],
});

type AnisotropySource = {
  capabilities?: { getMaxAnisotropy?: () => number };
  backend?: { isWebGPUBackend?: boolean };
};

/**
 * Requested design budget. GPUSamplerDescriptor.maxAnisotropy is 1..16, so 8 is legal on WebGPU.
 * WebGL still clamps to the real capability. An unknown renderer stays at 1.
 */
const requestedDesignAnisotropy = 8;

export function sampleAnisotropy(
  renderer: AnisotropySource | THREE.WebGLRenderer | WebGPURenderer,
) {
  const source = renderer as AnisotropySource;
  const fromWebGL = source.capabilities?.getMaxAnisotropy;
  if (typeof fromWebGL === "function") {
    return Math.min(requestedDesignAnisotropy, fromWebGL());
  }
  // Initialized Three WebGPUBackend sets this flag. Limits have no maxSamplerAnisotropy.
  if (source.backend?.isWebGPUBackend === true)
    return requestedDesignAnisotropy;
  return 1;
}

function configureDataMap(
  texture: THREE.DataTexture,
  family: string,
  channel: "roughness" | "normal",
  tileMeters: [number, number],
  anisotropy: number,
) {
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / tileMeters[0], 1 / tileMeters[1]);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.userData = {
    ...texture.userData,
    materialAudit: {
      family,
      channel,
      tileMeters,
      colorSpace: texture.colorSpace,
      minFilter: texture.minFilter,
      magFilter: texture.magFilter,
      generateMipmaps: true,
      anisotropy,
      source: "procedural",
    },
  };
  texture.needsUpdate = true;
  return texture;
}

/** Directional brush. Steel and bronze do not share pixels or texture objects. */
export function brushedMetalTextures(kind: "steel" | "bronze", anisotropy = 1) {
  const size = 64;
  const roughnessData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);
  let seed = kind === "steel" ? 0x51ee11 : 0xb20e2e;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const base = kind === "steel" ? 0.28 : 0.36;
  const bands = kind === "steel" ? 18 : 11;
  const tileMeters: [number, number] =
    kind === "steel" ? [0.08, 0.02] : [0.1, 0.03];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const phase = (x / size) * Math.PI * 2 * bands;
      const streak = Math.sin(phase + (random() - 0.5) * 0.15);
      const rough = Math.min(
        1,
        Math.max(0, base + streak * 0.04 + (random() - 0.5) * 0.015),
      );
      const index = (y * size + x) * 4;
      const value = Math.round(rough * 255);
      roughnessData[index] =
        roughnessData[index + 1] =
        roughnessData[index + 2] =
          value;
      roughnessData[index + 3] = 255;
      const slope = Math.cos(phase) * 0.035;
      const length = Math.hypot(slope, 1);
      normalData[index] = 128;
      normalData[index + 1] = Math.round(((slope / length) * 0.5 + 0.5) * 255);
      normalData[index + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      normalData[index + 3] = 255;
    }
  }
  const family = kind === "steel" ? "brushed steel" : "brushed bronze";
  const roughnessMap = configureDataMap(
    new THREE.DataTexture(roughnessData, size, size),
    family,
    "roughness",
    tileMeters,
    anisotropy,
  );
  roughnessMap.name = `${kind}-brushed-roughness`;
  const normalMap = configureDataMap(
    new THREE.DataTexture(normalData, size, size),
    family,
    "normal",
    tileMeters,
    anisotropy,
  );
  normalMap.name = `${kind}-brushed-normal`;
  return { roughnessMap, normalMap };
}

export function attachBrushedMetals(
  materials: Record<string, THREE.Material>,
  anisotropy: number,
) {
  for (const name of ["steel", "bronze"] as const) {
    const material = materials[name] as THREE.MeshStandardMaterial | undefined;
    if (!material) continue;
    const maps = brushedMetalTextures(name, anisotropy);
    material.roughnessMap = maps.roughnessMap;
    material.normalMap = maps.normalMap;
    material.normalScale.setScalar(0.08);
    material.metalness = 1;
    material.roughness = 1;
    auditMaterial(material, name, "metal");
  }
}

export async function refineMaterials(
  materials: Record<string, THREE.Material>,
  renderer: THREE.WebGLRenderer | WebGPURenderer,
  options: RefineMaterialsOptions = {},
) {
  const progressive = options.progressive === true;
  textureState.loaded = 0;
  textureState.failed = [];
  textureState.requested = 12;
  const mobile = matchMedia("(max-width:1000px), (pointer:coarse)").matches;
  const loader = new THREE.TextureLoader();
  const anisotropy = sampleAnisotropy(renderer);
  const tileScale = (name: string): [number, number] =>
    name === "oak"
      ? [0.5, 0.5]
      : name === "floor"
        ? [1.7, 1.7]
        : name === "plaster"
          ? [1.5, 1.5]
          : [0.28, 0.28];
  const configure = (texture: THREE.Texture, name: string, channel: string) => {
    texture.colorSpace =
      channel === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    const tileMeters = tileScale(name);
    texture.repeat.set(1 / tileMeters[0], 1 / tileMeters[1]);
    texture.userData = {
      ...texture.userData,
      materialAudit: {
        family: name,
        channel,
        tileMeters,
        colorSpace: texture.colorSpace,
        minFilter: texture.minFilter,
        magFilter: texture.magFilter,
        generateMipmaps: true,
      },
    };
    texture.anisotropy = anisotropy;
    return texture;
  };
  const placeholder = (name: string, channel: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Canvas 2D is required for progressive material placeholders",
      );
    const fill =
      channel === "normal"
        ? "rgb(128,128,255)"
        : channel === "roughness"
          ? "rgb(210,210,210)"
          : name === "oak"
            ? "#a9825a"
            : name === "floor"
              ? "#d0c7b7"
              : name === "linen"
                ? "#d7d0c4"
                : "#dedbd2";
    context.fillStyle = fill;
    context.fillRect(0, 0, 1, 1);
    const texture = configure(new THREE.CanvasTexture(canvas), name, channel);
    texture.name = `${name}-${channel}-progressive-placeholder`;
    texture.userData.materialAudit.source = "progressive-placeholder";
    return texture;
  };
  const load = async (name: string, channel: string) => {
    let texture: THREE.Texture | null = null;
    try {
      texture = await loader.loadAsync(
        `${import.meta.env.BASE_URL}materials/${name}-${channel}${name === "floor" && !mobile ? "-desktop" : ""}.webp`,
      );
    } catch {
      texture = null;
    }
    if (texture) configure(texture, name, channel);
    else textureState.failed.push(`${name}-${channel}`);
    if (texture) textureState.loaded++;
    options.onTextureReady?.({
      family: name,
      channel,
      loaded: textureState.loaded,
      requested: textureState.requested,
      failed: textureState.failed.length,
    });
    return texture;
  };
  const families = ["oak", "floor", "linen", "plaster"] as const;
  const channels = ["color", "normal", "roughness"] as const;
  const placeholders = progressive
    ? families.map((name) => ({
        name,
        map: placeholder(name, "color"),
        normalMap: placeholder(name, "normal"),
        roughnessMap: placeholder(name, "roughness"),
      }))
    : [];
  const prepareLoads = () =>
    Promise.all(
      families.map(async (name) => {
        const results = await Promise.all(
          channels.map((channel) => load(name, channel)),
        );
        return {
          name,
          map: results[0],
          normalMap: results[1],
          roughnessMap: results[2],
        };
      }),
    );
  type MapSet = {
    name: string;
    map: THREE.Texture | null;
    normalMap: THREE.Texture | null;
    roughnessMap: THREE.Texture | null;
  };
  const replace = (name: string, mapSet: MapSet, normalScale: number) => {
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
  const prepareMaterials = (maps: Awaited<ReturnType<typeof prepareLoads>>) => {
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
    micro.colorSpace = THREE.NoColorSpace;
    micro.wrapS = micro.wrapT = THREE.RepeatWrapping;
    micro.repeat.set(16, 16);
    micro.magFilter = THREE.LinearFilter;
    micro.minFilter = THREE.LinearMipmapLinearFilter;
    micro.generateMipmaps = true;
    micro.anisotropy = anisotropy;
    micro.userData = {
      ...micro.userData,
      materialAudit: {
        family: "subtle paint microtexture",
        channel: "roughness",
        colorSpace: micro.colorSpace,
        minFilter: micro.minFilter,
        magFilter: micro.magFilter,
        generateMipmaps: true,
        anisotropy,
        source: "procedural",
      },
    };
    micro.needsUpdate = true;
    for (const name of ["upperPaint", "cabinetPaint"]) {
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
    attachBrushedMetals(materials, anisotropy);
    for (const name of [
      "cabinetInterior",
      "bookClay",
      "bookSage",
      "bookCream",
    ]) {
      const m = materials[name] as THREE.MeshStandardMaterial;
      const family = name === "cabinetInterior" ? maps[0] : maps[2];
      m.normalMap = family.normalMap;
      m.normalScale.setScalar(0.06);
      m.roughnessMap = family.roughnessMap;
      m.roughness = 1;
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
  };
  if (progressive) {
    prepareMaterials(placeholders);
    const hydrate = (target: THREE.Texture, source: THREE.Texture | null) => {
      if (!source) return;
      // Keep the placeholder Texture object so materials cloned before decode
      // continue to see the final image without any map replacement.
      target.image = source.image;
      target.needsUpdate = true;
      source.dispose();
    };
    materialTexturesReady = prepareLoads().then((maps) => {
      for (let i = 0; i < maps.length; i++) {
        for (const channel of channels) {
          const key =
            channel === "color"
              ? "map"
              : channel === "normal"
                ? "normalMap"
                : "roughnessMap";
          const loaded = maps[i][key];
          hydrate(placeholders[i][key]!, loaded);
        }
      }
      // A missing image retains its warm placeholder, while matching the
      // original roughness fallback for the three wood/fabric families.
      for (const [i, matName] of [
        "oak",
        "floor",
        "linen",
        "plaster",
      ].entries()) {
        if (!maps[i].roughnessMap && matName !== "plaster") {
          const mat = materials[matName] as
            THREE.MeshStandardMaterial | undefined;
          if (mat) mat.roughness = 0.85;
        }
      }
    });
    return;
  }
  const maps = await prepareLoads();
  prepareMaterials(maps);
  materialTexturesReady = Promise.resolve();
}
