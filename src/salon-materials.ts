import * as THREE from "three";
export function prepareSalonMaterials(m: Record<string, THREE.Material>) {
  const clone = (
    name: string,
    base: string,
    color: string,
    roughness?: number,
  ) => {
    const a = (m[base] as THREE.MeshStandardMaterial).clone();
    a.color.set(color);
    if (roughness !== undefined) a.roughness = roughness;
    m[name] = a;
    return a;
  };
  clone("salonTimber", "oak", "#9c7955", 0.84);
  clone("salonDarkTimber", "oak", "#69513d", 0.9);
  clone("salonFabric", "linen", "#cdbda5", 0.98);
  clone("salonClay", "linen", "#ad7157", 0.96);
  clone("salonVault", "linen", "#918072", 0.98);
  clone("salonPanel", "linen", "#716158", 1);
  clone("salonFrame", "upperPaint", "#cbbb9e", 0.8);
  clone("salonMediaFrame", "upperPaint", "#c9bda8", 0.82);
  clone("salonCinemaFrame", "upperPaint", "#786556", 0.95);
  const paper = clone("salonPaper", "linen", "#f2e5c9", 0.92);
  paper.emissive.set("#caa072");
  paper.emissiveIntensity = 0.1;
  paper.normalScale.setScalar(0.1);
  // One shared metre-scale stone atlas, generated locally; low-amplitude strata and pores.
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext("2d")!;
  const pixels = c.createImageData(1024, 512);
  let seed = 947;
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 1024; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const stratum =
          2.0 * Math.sin(y * 0.12 + Math.sin(x * 0.008)) +
          0.8 * Math.sin(y * 0.49 + x * 0.004),
        pore = seed % 199 === 0 ? -20 : 0,
        v = stratum + pore + (seed % 5) - 2;
      const i = (y * 1024 + x) * 4;
      pixels.data[i] = 216 + v;
      pixels.data[i + 1] = 201 + v;
      pixels.data[i + 2] = 175 + v;
      pixels.data[i + 3] = 255;
    }
  c.putImageData(pixels, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  const bump = map.clone();
  bump.colorSpace = THREE.NoColorSpace;
  bump.needsUpdate = true;
  m.salonStone = new THREE.MeshStandardMaterial({
    map,
    bumpMap: bump,
    bumpScale: 0.0015,
    roughness: 0.76,
    color: "#f4eddf",
  });
  m.salonDarkStone = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.8,
    color: "#827465",
  });
  // Subtle vertical relief for cabinet fronts and pedestal tambours; shared texture, no slat draw calls.
  const ribs = document.createElement("canvas");
  ribs.width = 256;
  ribs.height = 32;
  const rc = ribs.getContext("2d")!;
  for (let x = 0; x < 256; x++) {
    const v = Math.round(125 + 90 * Math.cos((x * Math.PI) / 16));
    rc.fillStyle = `rgb(${v},${v},${v})`;
    rc.fillRect(x, 0, 1, 32);
  }
  const relief = new THREE.CanvasTexture(ribs);
  relief.wrapS = relief.wrapT = THREE.RepeatWrapping;
  relief.repeat.set(8, 1);
  const timber = clone("salonReeded", "salonTimber", "#94704d", 0.88);
  timber.bumpMap = relief;
  timber.bumpScale = 0.002;
}
