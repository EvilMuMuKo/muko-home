import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
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
      if (["oak", "darkoak", "cabinetPaint"].includes(name)) {
        material.clearcoat = 0.16;
        material.clearcoatRoughness = 0.5;
      }
      materials[name] = material;
    }
  }
  // Shared soft contact-occlusion atlas. Room batches cost one draw call per room.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(32, 32, 3, 32, 32, 32);
  gradient.addColorStop(0, "rgba(35,29,22,.32)");
  gradient.addColorStop(0.55, "rgba(35,29,22,.18)");
  gradient.addColorStop(1, "rgba(35,29,22,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    toneMapped: false,
  });
  const rooms = new Map<string, THREE.BufferGeometry[]>();
  const grounded = new Set([
    "wardrobe",
    "waterbar_cabinet",
    "sofa",
    "sofa_bed",
    "bed",
    "cabinet_frame",
    "fridge",
    "kegerator",
    "washing_machine",
    "dryer",
    "round_table",
    "desk",
    "bench",
  ]);
  for (const object of objects) {
    if (!grounded.has(object.type) || (object.y ?? 0) > 0.12) continue;
    const plane = new THREE.PlaneGeometry(object.w + 0.32, object.d + 0.32);
    plane.rotateX(-Math.PI / 2);
    plane.rotateY(-THREE.MathUtils.degToRad(object.rotation ?? 0));
    plane.translate(object.x, 0.013, object.z);
    if (!rooms.has(object.room)) rooms.set(object.room, []);
    rooms.get(object.room)!.push(plane);
  }
  for (const [room, planes] of rooms) {
    const merged = mergeGeometries(planes);
    if (merged) {
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = "contact-occlusion:" + room;
      mesh.renderOrder = 1;
      scene.add(mesh);
      tag(mesh, [room], "detail");
    }
    planes.forEach((p) => p.dispose());
  }
}
