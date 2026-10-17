import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { transformGeometry } from "./geometry";
const CELL_SIZE_M = 3;
const SOURCE_LAYER = 31;

// A scene-root batch cannot inherit a moving or conditionally visible ancestor.
// Cabinet interiors and other toggleable groups must retain their own hierarchy.
function dependsOnHierarchy(node: THREE.Object3D, scene: THREE.Scene) {
  for (
    let current: THREE.Object3D | null = node;
    current && current !== scene;
    current = current.parent
  ) {
    const data = current.userData;
    if (
      !current.visible ||
      data.animated ||
      data.moving ||
      data.visibilityDependent ||
      data.dynamicVisibility ||
      data.conditionalVisibility ||
      data.visibilityControlled ||
      current.animations.length
    )
      return true;
  }
  return false;
}

/** Merge only flat, static, opaque furniture, by spatial cell/room/material/render state.
 * Keep source objects on a non-rendered layer for inspection and collision bounds.
 */
export function batchFurniture(
  scene: THREE.Scene,
  model: { objects: { id: string; type: string }[] },
  tag: (mesh: THREE.Object3D, rooms: string[], kind: string) => void,
) {
  const dynamic = new Set([
    "fridge",
    "sofa_bed",
    "office_chair",
    "dining_chair",
    "door_leaf",
    "folding_table",
    "folding_chair",
    "dishwasher",
    "modular_sofa",
    "mobile_tv",
    "ps5",
    "washer",
    "dryer",
  ]);
  const buckets = new Map<string, { mesh: THREE.Mesh; rooms: string[] }[]>();
  scene.updateMatrixWorld(true);
  for (const object of model.objects) {
    const group = scene.getObjectByName(object.id);
    if (
      !group ||
      dynamic.has(object.type) ||
      dependsOnHierarchy(group, scene) ||
      (object.type !== "wall_storage" &&
        group.children.some((child) => !("isMesh" in child)))
    )
      continue;
    const rooms = [...(group.userData.spaceIds ?? [])].sort() as string[];
    for (const child of group.children) {
      if (!("isMesh" in child)) continue;
      const mesh = child as THREE.Mesh,
        geometry = mesh.geometry,
        material = mesh.material as THREE.Material;
      if (
        dependsOnHierarchy(mesh, scene) ||
        mesh.layers.mask === (1 << SOURCE_LAYER) >>> 0 ||
        mesh.userData.batchedFurniture ||
        (mesh as THREE.SkinnedMesh).isSkinnedMesh ||
        (mesh as THREE.InstancedMesh).isInstancedMesh ||
        Array.isArray(material) ||
        material.transparent ||
        Object.keys(geometry.morphAttributes).length ||
        Object.values(geometry.attributes).some(
          (a) => "isInterleavedBufferAttribute" in a,
        )
      )
        continue;
      const schema = Object.entries(geometry.attributes).map(([key, a]) => [
        key,
        a.itemSize,
        a.normalized,
        a.array.constructor.name,
      ]);
      // Geometry can contain translated vertices, so use its world bounds centre
      // rather than the Object3D origin. A large individual mesh is not split.
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) continue;
      const centre = geometry.boundingBox
        .clone()
        .applyMatrix4(mesh.matrixWorld)
        .getCenter(new THREE.Vector3());
      const cell = [
        Math.floor(centre.x / CELL_SIZE_M),
        Math.floor(centre.z / CELL_SIZE_M),
      ];
      const key = JSON.stringify([
        cell,
        rooms,
        material.uuid,
        mesh.layers.mask,
        mesh.castShadow,
        mesh.receiveShadow,
        mesh.renderOrder,
        !!geometry.index,
        schema,
      ]);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push({ mesh, rooms });
    }
  }
  let sources = 0,
    batches = 0;
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    const copies = bucket.map(({ mesh }) =>
      transformGeometry(mesh.geometry.clone(), mesh.matrixWorld),
    );
    const merged = mergeGeometries(copies);
    copies.forEach((g) => g.dispose());
    if (!merged) continue;
    const source = bucket[0].mesh,
      batch = new THREE.Mesh(merged, source.material);
    batch.name = `furniture-batch:${bucket[0].rooms.join("+")}:${batches}`;
    batch.castShadow = source.castShadow;
    batch.receiveShadow = source.receiveShadow;
    batch.layers.mask = source.layers.mask;
    batch.renderOrder = source.renderOrder;
    batch.userData.batchedFurniture = true;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    scene.add(batch);
    tag(batch, bucket[0].rooms, "object");
    for (const { mesh } of bucket) mesh.layers.set(SOURCE_LAYER);
    sources += bucket.length;
    batches++;
  }
  return { sources, batches, drawCallsReduced: sources - batches };
}
