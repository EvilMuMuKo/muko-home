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
    wall: surface("#e6e2d8"),
    paint: surface("#e0dcd2", 0.72),
    pegboard: surface("#889185", 0.8),
    oak: surface("#cbb99b", 0.76),
    darkwood: surface("#715c47"),
    floor: surface("#d2c3aa", 0.78),
    linen: surface("#d1c4ad", 0.98),
    clay: surface("#b19c84"),
    sage: surface("#7c8982"),
    stone: surface("#d7d0c2", 0.66),
    stoneFloor: surface("#c6c2b7", 0.87),
    tileFloor: surface("#b6b8b0", 0.65),
    tile: surface("#d7dad2", 0.5),
    metal: surface("#393e3e", 0.4, 0.65),
    steel: surface("#aaaead", 0.28, 0.76),
    bronze: surface("#a6936d", 0.4, 0.65),
    black: surface("#252b2b", 0.5),
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

  return m;
}
export async function hydrateMaterials(m: Materials, request: () => void) {
  const families = [
    ["oak", ["oak", "darkwood"]],
    ["floor", ["floor"]],
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
