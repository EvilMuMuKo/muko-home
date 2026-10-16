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
  clone("salonTimber", "oak", "#a88968", 0.9);
  clone("salonDarkTimber", "oak", "#65564a", 0.94);
  clone("salonFabric", "linen", "#d0cec6", 0.98);
  clone("salonClay", "linen", "#b77d67", 0.96);
  clone("salonVault", "linen", "#a7a198", 0.98);
  clone("salonPanel", "linen", "#746e66", 1);
  clone("salonFrame", "upperPaint", "#c5b59b", 0.88);
  clone("salonMediaFrame", "upperPaint", "#c7c2b6", 0.9);
  clone("salonCinemaFrame", "upperPaint", "#81776b", 0.96);
  const paper = clone("salonPaper", "linen", "#eeeae0", 0.94);
  paper.emissive.set("#8e8577");
  paper.emissiveIntensity = 0.035;
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
      pixels.data[i] = 207 + v;
      pixels.data[i + 1] = 207 + v;
      pixels.data[i + 2] = 198 + v;
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
    bumpScale: 0.0008,
    roughness: 0.84,
    color: "#efeee8",
  });
  m.salonDarkStone = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.8,
    color: "#777168",
  });
  // Keep the established material id; calm continuous grain avoids another repeated rib pattern.
  clone("salonReeded", "salonTimber", "#9e8061", 0.92);
}
