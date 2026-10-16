import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { createWalkCollision, type WalkModel } from "../src/walk-collision";
import original from "../src/model.js";
import { createStorageDesign } from "../src/storage-design";
import { createAtmosphereDesign } from "../src/atmosphere-design";
import { createSalonDesign } from "../src/salon-design";
import { createHomeDesign } from "../src/home-design";

function fixture(
  opening?: WalkModel["openings"][number],
  objects: WalkModel["objects"] = [],
) {
  const model: WalkModel = {
    walls: [
      { id: "partition", a: [0, 0], b: [4, 0], thickness: 0.18, height: 2.7 },
    ],
    openings: opening ? [opening] : [],
    objects,
  };
  const scene = new THREE.Scene();
  return { model, scene, collision: createWalkCollision(model, scene) };
}

test("wall segment blocks crossing and the capsule cannot cut the inside corner", () => {
  const model: WalkModel = {
      walls: [
        { id: "east-west", a: [0, 0], b: [4, 0], thickness: 0.18, height: 2.7 },
        {
          id: "north-south",
          a: [0, 0],
          b: [0, 4],
          thickness: 0.18,
          height: 2.7,
        },
      ],
      openings: [],
      objects: [],
    },
    collision = createWalkCollision(model, new THREE.Scene());
  const across = collision.move([2, -1], [2, 1]);
  expect(across[1]).toBeLessThan(-0.3);
  const corner = collision.move([-0.5, -0.5], [0.5, 0.5]);
  expect(corner[0]).toBeLessThan(-0.15);
  expect(corner[1]).toBeLessThan(-0.15);
});

test("door opening remains a passage, while the live rotated door leaf blocks it", () => {
  const { scene, model } = fixture({
    id: "room-door",
    type: "door",
    wallId: "partition",
    center: [2, 0],
    width: 1.2,
    height: 2.08,
  });
  const door = new THREE.Group();
  door.name = "opening:room-door";
  door.position.set(2, 0, 0);
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 2.08, 0.04),
    new THREE.MeshBasicMaterial(),
  );
  leaf.position.set(0.4, 1.04, 0);
  door.add(leaf);
  scene.add(door);
  const collision = createWalkCollision(model, scene);

  door.rotation.y = -Math.PI / 2;
  const closed = collision.move([1, 0.4], [3, 0.4]);
  expect(closed[0]).toBeLessThan(2);

  door.rotation.y = 0;
  const open = collision.move([1, 0.4], [3, 0.4]);
  expect(open[0]).toBeGreaterThan(2.9);
  expect(collision.audit.movingOpenings).toContain("opening:room-door");
});

test("a window sill stays solid below sill height even though the wall has a window cut", () => {
  const { collision } = fixture({
    id: "window",
    type: "window",
    wallId: "partition",
    center: [2, 0],
    width: 1.3,
    height: 1.3,
    sill: 0.9,
  });
  const result = collision.move([2, -0.8], [2, 0.8]);
  expect(result[1]).toBeLessThan(-0.3);
});

test("movement slides along a wall and a long input cannot tunnel through it", () => {
  const { collision } = fixture();
  const result = collision.move([1, -0.45], [3, 0.45]);
  expect(result[0]).toBeGreaterThan(2.7);
  expect(result[1]).toBeLessThan(-0.3);
});

test("the L-shaped floor keeps the full walker footprint out of its re-entrant notch", () => {
  const model: WalkModel = {
      shell: [
        [0, 0],
        [4, 0],
        [4, 1],
        [1, 1],
        [1, 4],
        [0, 4],
      ],
      walls: [],
      openings: [],
      objects: [],
    },
    collision = createWalkCollision(model, new THREE.Scene());
  const result = collision.move([0.5, 3], [3, 3]);
  expect(result[0]).toBeLessThan(0.78);
  expect(collision.move(result, result)).toEqual(result);
});

test("an open entry threshold stops at the floor edge instead of walking into exterior space", () => {
  const model: WalkModel = {
      shell: [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3],
      ],
      walls: [
        {
          id: "entry-wall",
          a: [0, 0],
          b: [4, 0],
          thickness: 0.18,
          height: 2.7,
        },
      ],
      openings: [
        {
          id: "entry",
          type: "door",
          wallId: "entry-wall",
          center: [2, 0],
          width: 1.2,
          height: 2.08,
        },
      ],
      objects: [],
    },
    collision = createWalkCollision(model, new THREE.Scene());
  const result = collision.move([2, 0.7], [2, -1]);
  expect(result[1]).toBeGreaterThanOrEqual(0.22 - 1e-4);
  expect(collision.move(result, result)).toEqual(result);
});

test("live low furniture collides and ceiling-height cabinetry is ignored", () => {
  const { scene, model } = fixture(undefined, [
    { id: "sofa", type: "sofa" },
    { id: "upper", type: "cabinet_frame" },
  ]);
  const sofa = new THREE.Group();
  sofa.name = "sofa";
  const sofaMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.8, 0.8),
    new THREE.MeshBasicMaterial(),
  );
  sofaMesh.position.set(2, 0.4, 2);
  sofa.add(sofaMesh);
  scene.add(sofa);
  const upper = new THREE.Group();
  upper.name = "upper";
  const upperMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.4, 0.8),
    new THREE.MeshBasicMaterial(),
  );
  upperMesh.position.set(2, 2.1, 2);
  upper.add(upperMesh);
  scene.add(upper);
  const collision = createWalkCollision(model, scene);

  expect(collision.move([1, 2], [3, 2])[0]).toBeLessThan(2);
  expect(collision.move([1, 3], [3, 3])[0]).toBeGreaterThan(2.9);
});

test("V9 modular and folding furniture plus low wall storage enter the walk footprint", () => {
  const cases = [
    {
      id: "modular-sofa",
      type: "modular_sofa",
      x: 2,
      y: 0.4,
      w: 1.2,
      h: 0.8,
      d: 0.9,
    },
    {
      id: "mobile-tv",
      type: "mobile_tv",
      x: 4,
      y: 1.265,
      w: 0.8,
      h: 0.93,
      d: 0.12,
    },
    {
      id: "folding-table",
      type: "folding_table",
      x: 6,
      y: 0.4,
      w: 0.9,
      h: 0.8,
      d: 0.9,
    },
    {
      id: "folding-chair",
      type: "folding_chair",
      x: 8,
      y: 0.45,
      w: 0.45,
      h: 0.9,
      d: 0.45,
    },
    {
      id: "low-wall-storage",
      type: "wall_storage",
      x: 10,
      y: 0.475,
      w: 0.8,
      h: 0.95,
      d: 0.4,
    },
    {
      id: "upper-wall-storage",
      type: "wall_storage",
      x: 12,
      y: 2.5,
      w: 0.8,
      h: 1,
      d: 0.4,
    },
  ];
  const model: WalkModel = {
    walls: [],
    openings: [],
    objects: cases.map(({ id, type }) => ({ id, type })),
  };
  const scene = new THREE.Scene();
  for (const item of cases) {
    const group = new THREE.Group();
    group.name = item.id;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(item.w, item.h, item.d),
      new THREE.MeshBasicMaterial(),
    );
    mesh.position.set(item.x, item.y, 2);
    group.add(mesh);
    scene.add(group);
  }
  const collision = createWalkCollision(model, scene);

  for (const item of cases.slice(0, 5)) {
    const result = collision.move([item.x - 1, 2], [item.x + 1, 2]);
    expect(result[0], item.id).toBeLessThan(item.x);
  }
  const upper = cases[5];
  expect(collision.move([upper.x - 1, 2], [upper.x + 1, 2])[0]).toBeGreaterThan(
    upper.x + 0.9,
  );
  expect(collision.audit.missingGroups).toEqual([]);
});

test("final V9 model obstacle ids match scene naming and include ground-level storage", () => {
  const finalModel = createHomeDesign(
    createSalonDesign(
      createAtmosphereDesign(createStorageDesign(original as any)),
    ),
  );
  const scene = new THREE.Scene();
  for (const object of finalModel.objects) {
    if (
      object.type === "door_leaf" ||
      object.type === "cabinet_frame_part" ||
      object.rendererHidden === true
    )
      continue;
    const group = new THREE.Group();
    group.name = object.id;
    scene.add(group);
  }
  for (const opening of finalModel.openings)
    if (["door", "sliding_door", "gate"].includes(opening.type)) {
      const group = new THREE.Group();
      group.name = `opening:${opening.id}`;
      scene.add(group);
    }
  const collision = createWalkCollision(finalModel, scene);
  expect(collision.audit.missingGroups).toEqual([]);
  const lowStorage = finalModel.objects.filter(
    (object) =>
      object.type === "wall_storage" &&
      object.y < 1.88 &&
      object.y + object.h > 0,
  );
  expect(lowStorage.length).toBeGreaterThan(0);
  expect(
    lowStorage.every((object) =>
      collision.audit.staticGroups.includes(object.id),
    ),
  ).toBe(true);
  for (const type of [
    "modular_sofa",
    "mobile_tv",
    "folding_table",
    "folding_chair",
  ])
    expect(
      finalModel.objects.some((object) => object.type === type),
      type,
    ).toBe(true);
});

test("a moving mesh pushes a stationary walker out of its actual world pose", () => {
  const { scene, model } = fixture({
    id: "room-door",
    type: "door",
    wallId: "partition",
    center: [2, 0],
    width: 1.2,
    height: 2.08,
  });
  const door = new THREE.Group();
  door.name = "opening:room-door";
  door.position.set(2, 0, 0);
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 2.08, 0.04),
    new THREE.MeshBasicMaterial(),
  );
  leaf.position.set(0.4, 1.04, 0);
  door.add(leaf);
  door.rotation.y = -Math.PI / 2;
  scene.add(door);
  const collision = createWalkCollision(model, scene);
  const moved = collision.move([2, 0.35], [2, 0.35]);
  expect(Math.hypot(moved[0] - 2, moved[1] - 0.35)).toBeGreaterThan(0.2);
  expect(moved[0]).not.toBe(2);
});

test("door depenetration stays on the floor and chooses a path clear of the adjacent wall", () => {
  const model: WalkModel = {
    shell: [
      [0, -2],
      [4, -2],
      [4, 2],
      [0, 2],
    ],
    walls: [
      { id: "partition", a: [0, 0], b: [4, 0], thickness: 0.18, height: 2.7 },
    ],
    openings: [
      {
        id: "room-door",
        type: "door",
        wallId: "partition",
        center: [2, 0],
        width: 1.2,
        height: 2.08,
      },
    ],
    objects: [],
  };
  const scene = new THREE.Scene();
  const door = new THREE.Group();
  door.name = "opening:room-door";
  door.position.set(2, 0, 0);
  door.rotation.y = -Math.PI / 2;
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 2.08, 0.04),
    new THREE.MeshBasicMaterial(),
  );
  leaf.position.set(0.4, 1.04, 0);
  door.add(leaf);
  scene.add(door);
  const collision = createWalkCollision(model, scene);
  const moved = collision.move([2, 0.35], [2, 0.35]);
  expect(Math.hypot(moved[0] - 2, moved[1] - 0.35)).toBeGreaterThan(0.2);
  expect(moved[1]).toBeGreaterThanOrEqual(-2 + 0.22 - 1e-4);
  expect(moved[1]).toBeLessThanOrEqual(2 - 0.22 + 1e-4);
  expect(collision.move(moved, moved)).toEqual(moved);
});
