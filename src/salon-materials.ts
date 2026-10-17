import * as THREE from "three";
import { auditMaterial } from "./material-detail";
export function prepareSalonMaterials(m: Record<string, THREE.Material>) {
  const clone = (
    name: string,
    base: string,
    color: string,
    roughness?: number,
  ) => {
    const a = (m[base] as THREE.MeshStandardMaterial).clone();
    a.color.set(color);
    if (roughness !== undefined) a.roughness = a.roughnessMap && (m[base] as THREE.MeshStandardMaterial).roughness === 1 ? 1 : roughness;
    auditMaterial(
      a,
      name,
      /Timber|Reeded/i.test(name)
        ? "wood"
        : /Stone/i.test(name)
          ? "stone"
          : /Fabric|Clay|Vault|Panel|Paper/i.test(name)
            ? "fabric"
            : /Frame/i.test(name)
              ? "paint"
              : "decor",
    );
    m[name] = a;
    return a;
  };
  clone("salonTimber", "oak", "#a78465", 0.73);
  clone("salonDarkTimber", "oak", "#715440", 0.8);
  clone("salonFabric", "linen", "#d8d3c8", 0.88);
  clone("salonClay", "linen", "#b77d67", 0.86);
  clone("salonVault", "linen", "#b2aa9d", 0.9);
  clone("salonPanel", "linen", "#83796c", 0.88);
  clone("salonFrame", "upperPaint", "#c5b59b", 0.72);
  clone("salonMediaFrame", "upperPaint", "#c7c2b6", 0.74);
  clone("salonCinemaFrame", "upperPaint", "#8c8072", 0.82);
  const paper = clone("salonPaper", "linen", "#eeeae0", 0.88);
  paper.emissive.set("#8e8577");
  paper.emissiveIntensity = 0.035;
  paper.normalScale.setScalar(0.14);
  // One coherent PBR mineral family; colour, linear normal and roughness agree.
  clone("salonStone", "stone", "#f2ece1", 1);
  clone("salonDarkStone", "stone", "#a49b8b", 1);
  // Keep the established material id; calm continuous grain avoids another repeated rib pattern.
  clone("salonReeded", "salonTimber", "#9e8061", 0.76);
}
