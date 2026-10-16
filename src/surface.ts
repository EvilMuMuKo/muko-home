import * as THREE from "three";
import { quality } from "./quality";
interface Furniture {
  id: string;
  room: string;
  type: string;
  x: number;
  z: number;
  w: number;
  d: number;
  y?: number;
  rotation?: number;
}
export function enhanceSurfaces(
  materials: Record<string, THREE.Material>,
  scene: THREE.Scene,
  objects: Furniture[],
  tag: (node: THREE.Object3D, rooms: string[], kind: string) => void,
) {
  for (const name of [
    "oak",
    "darkoak",
    "linen",
    "sage",
    "steel",
    "bronze",
    "cabinetPaint",
    "upperPaint",
  ]) {
    const original = materials[name] as THREE.MeshStandardMaterial;
    if (!original) continue;
    if (!quality.mobile) {
      const material = new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(material, original);
      material.defines = { STANDARD: "", PHYSICAL: "" };
      if (["linen", "sage"].includes(name)) {
        material.sheen = 0.35;
        material.sheenRoughness = 0.9;
        material.sheenColor.set("#d8cbb5");
      }
      if (["cabinetPaint"].includes(name)) {
        material.clearcoat = 0.16;
        material.clearcoatRoughness = 0.5;
      }
      if (["steel", "bronze"].includes(name)) {
        material.anisotropy = 0.25;
        material.anisotropyRotation = Math.PI / 2;
      }
      materials[name] = material;
    }
  }
  // Static floor grounding is now baked once by baked-occlusion.ts.
  // Do not leave separate shadow decals at retired furniture positions.
}
