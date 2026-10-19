import * as T from "three";
export type Materials = Record<string, T.MeshStandardMaterial>;
export const textureStatus = {
  loaded: 0,
  requested: 12,
  failed: [] as string[],
};
function surface(color: string, roughness = 0.85, metalness = 0) {
  return new T.MeshStandardMaterial({ color, roughness, metalness });
}
export function createMaterials(): Materials {
  const m: Materials = {
    wall: surface("#d3cfc7"),
    paint: surface("#91867c", 0.74),
    charcoal: surface("#433e39", 0.8),
    grout: surface("#9e9990", 0.9),
    pegboard: surface("#82786e", 0.8),
    oak: surface("#82705e", 0.76),
    darkwood: surface("#51473e"),
    walnut: surface("#795841", 0.52),
    olive: surface("#596947", 0.96),
    floor: surface("#9c8a76", 0.78),
    linen: surface("#ddd6cd", 0.98),
    clay: surface("#a49b93"),
    sage: surface("#68625c"),
    stone: surface("#d1cbc1", 0.66),
    stoneFloor: surface("#c6c1b8", 0.87),
    tileFloor: surface("#afa9a0", 0.65),
    tile: surface("#c3bdb4", 0.5),
    metal: surface("#393e3e", 0.4, 0.65),
    steel: surface("#aaaead", 0.28, 0.76),
    bronze: surface("#514b44", 0.4, 0.65),
    black: surface("#292827", 0.5),
    paper: surface("#f1e9d5", 0.94),
    ceramic: surface("#e9e5d9", 0.28),
    leaf: surface("#526c52"),
    soil: surface("#3d3329"),
    rubber: surface("#333a3d"),
    water: surface("#6b959e", 0.18, 0.15),
    screen: surface("#253b45", 0.4),
  };
  m.glass = new T.MeshPhysicalMaterial({
    color: "#c4d3ce",
    transparent: true,
    opacity: 0.14,
    roughness: 0.08,
    metalness: 0.08,
    depthWrite: false,
  });
  m.mirror = surface("#c1cecc", 0.1, 0.82);
  m.glow = surface("#f8e7c7", 0.7);
  m.glow.emissive.set("#ffe5b0");
  m.glow.emissiveIntensity = 0.6;
  m.paper.emissive.set("#f6d8a9");
  m.paper.emissiveIntensity = 0.12;
  m.screen.emissive.set("#6e9bab");
  m.screen.emissiveIntensity = 0.34;
  // Shared, mipmapped corduroy normals add ribbed textile detail without
  // downloading another image or adding geometry/per-frame simulation.
  const ribCanvas = document.createElement("canvas");
  ribCanvas.width = ribCanvas.height = 256;
  const ribContext = ribCanvas.getContext("2d")!;
  const ribs = ribContext.createImageData(256, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      const nx = Math.sin((x / 256) * Math.PI * 16) * 0.3;
      const ny = Math.sin(x * 17 + y * 31) * 0.018;
      ribs.data[i] = Math.round(127.5 + nx * 127.5);
      ribs.data[i + 1] = Math.round(127.5 + ny * 127.5);
      ribs.data[i + 2] = Math.round(
        127.5 + Math.sqrt(1 - nx * nx - ny * ny) * 127.5,
      );
      ribs.data[i + 3] = 255;
    }
  ribContext.putImageData(ribs, 0, 0);
  const ribMap = new T.CanvasTexture(ribCanvas);
  ribMap.wrapS = ribMap.wrapT = T.RepeatWrapping;
  ribMap.repeat.setScalar(12.5);
  ribMap.anisotropy = 4;
  ribMap.colorSpace = T.NoColorSpace;
  m.olive.normalMap = ribMap;
  m.olive.normalScale.setScalar(0.55);
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#d7d2c7";
  ctx.fillRect(0, 0, 1024, 512);
  let seed = 51;
  for (let i = 0; i < 20000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const x = seed % 1024;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    ctx.fillStyle = i % 3 ? "rgba(105,94,77,.045)" : "rgba(255,255,255,.14)";
    ctx.fillRect(x, seed % 512, 1 + (i % 3), 1);
  }
  const map = new T.CanvasTexture(c);
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.colorSpace = T.SRGBColorSpace;
  m.stone.map = map;
  m.stone.bumpMap = map;
  m.stone.bumpScale = 0.0007;
  // A shared fine mineral surface adds detail without another image request.
  for (const key of ["stoneFloor", "tileFloor"]) {
    m[key].map = map;
    m[key].bumpMap = map;
    m[key].bumpScale = 0.0005;
  }

  const washCanvas = document.createElement("canvas");
  washCanvas.width = 8;
  washCanvas.height = 128;
  const washContext = washCanvas.getContext("2d")!;
  const washGradient = washContext.createLinearGradient(0, 0, 0, 128);
  washGradient.addColorStop(0, "rgba(255,226,185,.64)");
  washGradient.addColorStop(0.3, "rgba(255,226,185,.21)");
  washGradient.addColorStop(1, "rgba(255,226,185,0)");
  washContext.fillStyle = washGradient;
  washContext.fillRect(0, 0, 8, 128);
  m.coveWash = surface("#fff0d8");
  m.coveWash.map = new T.CanvasTexture(washCanvas);
  m.coveWash.map.colorSpace = T.SRGBColorSpace;
  m.coveWash.emissive.set("#ffe1af");
  m.coveWash.emissiveIntensity = 0.28;
  m.coveWash.transparent = true;
  m.coveWash.depthWrite = false;
  for (const name of ["floor", "stoneFloor", "tileFloor"]) {
    m[name + "Contact"] = m[name].clone();
    m[name + "Contact"].vertexColors = true;
  }
  return m;
}
export async function hydrateMaterials(m: Materials, request: () => void) {
  const families = [
    ["oak", ["oak", "darkwood", "walnut"]],
    ["floor", ["floor", "floorContact"]],
    ["linen", ["linen", "clay", "sage", "paper"]],
    ["plaster", ["wall", "paint"]],
  ] as const;
  const loader = new T.TextureLoader();
  const tileMetres: Record<string, number> = {
    oak: 0.5,
    floor: 1.7,
    linen: 0.271,
    plaster: 1.5,
  };
  for (const [family, keys] of families)
    for (const channel of ["color", "normal", "roughness"]) {
      try {
        const t = await loader.loadAsync(
          `${import.meta.env.BASE_URL}materials/${family}-${channel}.webp`,
        );
        t.wrapS = t.wrapT = T.RepeatWrapping;
        t.anisotropy = 4;
        t.colorSpace = channel === "color" ? T.SRGBColorSpace : T.NoColorSpace;
        t.repeat.setScalar(1 / tileMetres[family]);
        for (const key of keys) {
          const a = m[key];
          if (channel === "color") a.map = t;
          else if (channel === "normal") {
            a.normalMap = t;
            a.normalScale.setScalar(
              key === "paint"
                ? 0.035
                : family === "linen"
                  ? 0.16
                  : family === "plaster"
                    ? 0.1
                    : 0.18,
            );
          } else a.roughnessMap = t;
          a.needsUpdate = true;
        }
        textureStatus.loaded++;
        request();
        await new Promise((r) => setTimeout(r, 40));
      } catch {
        textureStatus.failed.push(`${family}-${channel}`);
      }
    }
}
