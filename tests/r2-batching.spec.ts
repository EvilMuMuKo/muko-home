import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { batchFurniture } from "../src/batching";

function fixture() {
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial();
  const model = { objects: [] as { id: string; type: string }[] };
  const tags: { rooms: string[]; kind: string }[] = [];
  function add(
    id: string,
    x: number,
    z = 1,
    type = "cabinet_frame",
    parent: THREE.Object3D = scene,
  ) {
    const group = new THREE.Group();
    group.name = id;
    group.position.set(x, 0, z);
    group.userData.spaceIds = ["living"];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, 0.3), material);
    group.add(mesh);
    parent.add(group);
    model.objects.push({ id, type });
    return { group, mesh };
  }
  const run = () =>
    batchFurniture(scene, model, (_mesh, rooms, kind) =>
      tags.push({ rooms, kind }),
    );
  const batches = () =>
    scene.children.filter((n) =>
      n.name.startsWith("furniture-batch:"),
    ) as THREE.Mesh[];
  return { scene, material, add, run, batches, tags };
}

test("static same-cell meshes share a batch while source bounds and collision-layer raycasts remain available", () => {
  const f = fixture(),
    a = f.add("a", 1),
    b = f.add("b", 2);
  f.scene.updateMatrixWorld(true);
  const before = new THREE.Box3().setFromObject(a.mesh);
  expect(f.run()).toEqual({ sources: 2, batches: 1, drawCallsReduced: 1 });
  expect(a.mesh.parent).toBe(a.group);
  expect(a.mesh.layers.isEnabled(31)).toBe(true);
  expect(a.mesh.layers.isEnabled(0)).toBe(false);
  expect(new THREE.Box3().setFromObject(a.mesh).equals(before)).toBe(true);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(1, 0, 3),
    new THREE.Vector3(0, 0, -1),
  );
  ray.layers.set(31);
  expect(ray.intersectObject(a.mesh).length).toBeGreaterThan(0);
  expect(b.mesh.geometry.getAttribute("position").count).toBe(24);
  expect(f.tags).toEqual([{ rooms: ["living"], kind: "object" }]);
  expect(f.batches()[0].geometry.boundingSphere).toBeTruthy();
  expect(
    f.run().sources,
    "a second pass must not rebatch diagnostic sources",
  ).toBe(0);
});

test("same-room same-material meshes in different world cells form separate cullable batches", () => {
  const f = fixture();
  f.add("a", 1);
  f.add("b", 2);
  f.add("c", 4);
  f.add("d", 5);
  expect(f.run()).toEqual({ sources: 4, batches: 2, drawCallsReduced: 2 });
  const bounds = f.batches().map((b) => b.geometry.boundingBox!);
  expect(bounds.some((b) => b.max.x < 3)).toBe(true);
  expect(bounds.some((b) => b.min.x > 3)).toBe(true);
});

test("cell assignment follows transformed geometry bounds instead of shared group origins", () => {
  const f = fixture();
  for (const [i, x] of [1, 2, 4, 5].entries()) {
    const { mesh } = f.add(`part-${i}`, 0);
    mesh.geometry.translate(x, 0, 0);
  }
  expect(f.run().batches).toBe(2);
});

test("animated, moving and hidden ancestors and visibility-dependent roots remain in their hierarchy", () => {
  const f = fixture();
  for (const flag of [
    "animated",
    "moving",
    "visibilityDependent",
    "dynamicVisibility",
    "conditionalVisibility",
    "visibilityControlled",
    "hidden",
  ]) {
    const ancestor = new THREE.Group();
    f.scene.add(ancestor);
    if (flag === "hidden") ancestor.visible = false;
    else ancestor.userData[flag] = true;
    const a = f.add(`${flag}-a`, 1, 1, "wall_storage", ancestor);
    f.add(`${flag}-b`, 2, 1, "wall_storage", ancestor);
    expect(a.mesh.layers.isEnabled(0)).toBe(true);
  }
  const toggle = f.add("toggle-root", 1, 1, "wall_storage");
  toggle.group.userData.visibilityDependent = true;
  expect(f.run().sources).toBe(0);
  expect(f.batches()).toHaveLength(0);
});

test("hidden cabinet interiors and directly animated leaves do not escape into a static batch", () => {
  const f = fixture(),
    a = f.add("cabinet-a", 1, 1, "wall_storage"),
    b = f.add("cabinet-b", 2, 1, "wall_storage");
  a.mesh.visible = false;
  b.mesh.userData.animated = true;
  const inside = new THREE.Group();
  inside.visible = false;
  inside.add(new THREE.Mesh(new THREE.BoxGeometry(), f.material));
  a.group.add(inside);
  expect(f.run().sources).toBe(0);
  expect(inside.parent).toBe(a.group);
});

test("transparent surfaces and articulated furniture types retain independent objects", () => {
  const f = fixture();
  for (const type of [
    "mobile_tv",
    "modular_sofa",
    "door_leaf",
    "fridge",
    "folding_table",
    "dishwasher",
  ]) {
    f.add(`${type}-a`, 1, 1, type);
    f.add(`${type}-b`, 2, 1, type);
  }
  const glass = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.4,
  });
  f.add("glass-a", 1).mesh.material = glass;
  f.add("glass-b", 2).mesh.material = glass;
  expect(f.run().sources).toBe(0);
});

test("cell partition preserves room, material, layer, shadow and geometry-schema boundaries", () => {
  const f = fixture();
  const a = f.add("base", 1);
  const layer = f.add("layer", 1);
  layer.mesh.layers.set(2);
  const shadow = f.add("shadow", 1);
  shadow.mesh.castShadow = true;
  const room = f.add("room", 1);
  room.group.userData.spaceIds = ["kitchen"];
  const material = f.add("material", 1);
  material.mesh.material = f.material.clone();
  const schema = f.add("schema", 1);
  schema.mesh.geometry.deleteAttribute("uv");
  expect(f.run().sources).toBe(0);
  expect(a.mesh.layers.isEnabled(0)).toBe(true);
});
