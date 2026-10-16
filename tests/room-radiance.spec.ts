import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { buildRoomCapturePlan, createRoomRadiance, roomMembership, roomRadiancePolicy } from "../src/room-radiance";

test("capture plan points stay inside ordinary and concave room polygons deterministically", () => {
  const model = {
    rooms: [
      { id: "box", polygon: [[0, 0], [4, 0], [4, 3], [0, 3]] as [number, number][] },
      { id: "notch", polygon: [[0, 0], [5, 0], [5, 5], [3, 5], [3, 2], [2, 2], [2, 5], [0, 5]] as [number, number][] },
      { id: "invalid", polygon: [[0, 0], [1, 1]] as [number, number][] },
    ],
  };
  const first = buildRoomCapturePlan(model);
  const second = buildRoomCapturePlan(model);
  expect(first).toEqual(second);
  expect(first.map((room) => room.roomId)).toEqual(["box", "notch"]);
  for (const plan of first) {
    const polygon = model.rooms.find((room) => room.id === plan.roomId)!.polygon!;
    const [x, , z] = plan.position;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, zi] = polygon[i], [xj, zj] = polygon[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    expect(inside, plan.roomId).toBe(true);
    expect(plan.position[1]).toBe(1.35);
  }
});

test("capture quality and cache budget are bounded for mobile and desktop", () => {
  expect(roomRadiancePolicy(true)).toEqual({ captureSize: 64, maxCachedEnvironments: 16, eagerCaptures: 0, cachePolicy: "retain-until-dispose" });
  expect(roomRadiancePolicy(false)).toEqual({ captureSize: 128, maxCachedEnvironments: 16, eagerCaptures: 0, cachePolicy: "retain-until-dispose" });
});

test("capture point avoids solid object footprints where the room has a clear location", () => {
  const plan = buildRoomCapturePlan({
    rooms: [{ id: "bedroom", polygon: [[0, 0], [5, 0], [5, 5], [0, 5]] }],
    objects: [{ id: "bed", room: "bedroom", type: "bed", x: 2.5, z: 2.5, w: 2.6, d: 2.6 }],
  });
  expect(plan).toHaveLength(1);
  const [x, , z] = plan[0].position;
  expect(Math.abs(x - 2.5) > 1.46 || Math.abs(z - 2.5) > 1.46).toBe(true);
});

test("creation is lazy and does not perform GPU work before a room is selected", async () => {
  let captureCalls = 0;
  let generatorDisposals = 0;
  const scene = new THREE.Scene();
  const radiance = await createRoomRadiance({
    renderer: {},
    scene,
    model: { rooms: [{ id: "living", polygon: [[0, 0], [4, 0], [4, 4], [0, 4]] }] },
    materials: {},
    mobile: true,
    environmentGenerator: () => ({
      fromScene() { captureCalls++; throw new Error("GPU capture must stay lazy in this CPU-only check"); },
      dispose() { generatorDisposals++; },
    }),
  });
  expect(radiance.audit().captureCount).toBe(0);
  expect(radiance.audit().cacheEntries).toBe(0);
  expect(captureCalls).toBe(0);
  await radiance.dispose();
  expect(generatorDisposals).toBe(1);
});

test("nested room membership receives a cloned local reflection material", async () => {
  const scene = new THREE.Scene();
  const room = new THREE.Group();
  room.userData.spaceIds = ["bath"];
  const source = new THREE.MeshStandardMaterial({ color: "#777777", roughness: 0.4 });
  source.name = "steel";
  source.userData.auditTag = "preserve-me";
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.02), source);
  mesh.name = "nested-mirror-prop";
  room.add(mesh);
  scene.add(room);
  expect(roomMembership(mesh)).toEqual(["bath"]);

  let captured: THREE.Texture | null = null;
  const radiance = await createRoomRadiance({
    renderer: {},
    scene,
    model: { rooms: [{ id: "bath", polygon: [[0, 0], [4, 0], [4, 4], [0, 4]] }] },
    materials: { steel: source },
    mobile: true,
    environmentGenerator: () => ({
      fromScene() {
        captured = new THREE.Texture();
        return { texture: captured, dispose() { captured?.dispose(); } };
      },
      dispose() {},
    }),
  });
  radiance.setRoom("bath");
  await radiance.refresh(false);
  expect(radiance.audit().captureCount).toBe(1);
  expect(mesh.material).not.toBe(source);
  expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
  expect((mesh.material as THREE.MeshStandardMaterial).envMap).toBe(captured);
  expect(mesh.material.name).toBe("steel");
  expect(mesh.material.userData.auditTag).toBe("preserve-me");
  await radiance.dispose();
  expect(mesh.material).toBe(source);
  source.dispose();
  mesh.geometry.dispose();
});

test("overlapping hall capture remains in the actual hallway instead of the living room", () => {
  const model = {rooms:[{id:"hall",polygon:[[0,0],[6,0],[6,5],[0,5]] as [number,number][]},{id:"living",polygon:[[2,0],[6,0],[6,5],[2,5]] as [number,number][]}]};
  const plan=buildRoomCapturePlan(model).find(p=>p.roomId==="hall")!;
  expect(plan.position[0]).toBeLessThan(2);
});

test("visited room and lighting PMREMs stay alive until orderly disposal", async () => {
  const scene = new THREE.Scene();
  const base = new THREE.MeshStandardMaterial({ color: "#777777", roughness: 0.45 });
  const rooms = Array.from({ length: 4 }, (_, i) => ({
    id: `room-${i}`,
    polygon: [[i * 5, 0], [i * 5 + 4, 0], [i * 5 + 4, 4], [i * 5, 4]] as [number, number][],
  }));
  for (const room of rooms) {
    const group = new THREE.Group();
    group.userData.spaceIds = [room.id];
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), base));
    scene.add(group);
  }

  let disposedTargets = 0;
  let captureCalls = 0;
  let generatorDisposals = 0;
  let renderLockDepth = 0;
  let maxRenderLockDepth = 0;
  const radiance = await createRoomRadiance({
    renderer: {},
    scene,
    model: { rooms },
    materials: { metal: base },
    mobile: true,
    withRenderPaused: async <T>(capture: () => Promise<T>) => {
      renderLockDepth++;
      maxRenderLockDepth = Math.max(maxRenderLockDepth, renderLockDepth);
      try {
        await Promise.resolve();
        return await capture();
      } finally {
        renderLockDepth--;
      }
    },
    environmentGenerator: () => ({
      fromScene() {
        captureCalls++;
        const texture = new THREE.Texture();
        return { texture, dispose() { disposedTargets++; texture.dispose(); } };
      },
      dispose() { generatorDisposals++; },
    }),
  });

  for (const room of rooms) {
    radiance.setRoom(room.id);
    await radiance.whenReady();
  }
  for (const room of [...rooms].reverse()) {
    radiance.setRoom(room.id);
    await radiance.whenReady();
    await radiance.refresh(true);
  }

  expect(captureCalls).toBe(rooms.length * 2);
  expect(radiance.audit().cacheEntries).toBe(rooms.length * 2);
  expect(radiance.audit().cacheCapacity).toBe(rooms.length * 2);
  expect(disposedTargets).toBe(0);
  expect(maxRenderLockDepth).toBe(1);
  await radiance.dispose();
  expect(disposedTargets).toBe(rooms.length * 2);
  expect(generatorDisposals).toBe(1);
  expect(scene.children.every((group) => (group as THREE.Group).children[0].material === base)).toBe(true);
  base.dispose();
  scene.traverse((node) => { if (node instanceof THREE.Mesh) node.geometry.dispose(); });
});

test("rapid room changes coalesce stale uncached captures and expose whenReady", async () => {
  const scene = new THREE.Scene();
  const rooms = Array.from({ length: 3 }, (_, i) => ({
    id: `room-${i}`,
    polygon: [[i * 5, 0], [i * 5 + 4, 0], [i * 5 + 4, 4], [i * 5, 4]] as [number, number][],
  }));
  let captureCalls = 0;
  const radiance = await createRoomRadiance({
    renderer: {}, scene, model: { rooms }, materials: {}, mobile: true,
    withRenderPaused: async <T>(capture: () => Promise<T>) => {
      await Promise.resolve();
      return capture();
    },
    environmentGenerator: () => ({
      fromScene() {
        captureCalls++;
        const texture = new THREE.Texture();
        return { texture, dispose() { texture.dispose(); } };
      },
    }),
  });
  radiance.setRoom("room-0");
  radiance.setRoom("room-1");
  radiance.setRoom("room-2");
  await radiance.whenReady();
  expect(radiance.audit().currentRoom).toBe("room-2");
  expect(captureCalls).toBe(1);
  await radiance.dispose();
});

test("concurrent dispose calls share cleanup and cancel an in-flight capture safely", async () => {
  let releaseQueue!: () => void;
  let signalQueueEntered!: () => void;
  const queueEntered = new Promise<void>((resolve) => { signalQueueEntered = resolve; });
  const queueGate = new Promise<void>((resolve) => { releaseQueue = resolve; });
  let queueWaits = 0;
  let targetDisposals = 0;
  let generatorDisposals = 0;
  const scene = new THREE.Scene();
  const radiance = await createRoomRadiance({
    renderer: { backend: { device: { queue: { onSubmittedWorkDone: async () => {
      queueWaits++;
      if (queueWaits === 1) {
        signalQueueEntered();
        await queueGate;
      }
    } } } } },
    scene,
    model: { rooms: [{ id: "living", polygon: [[0, 0], [4, 0], [4, 4], [0, 4]] }] },
    materials: {},
    mobile: true,
    environmentGenerator: () => ({
      fromScene() {
        return { texture: new THREE.Texture(), dispose() { targetDisposals++; } };
      },
      dispose() { generatorDisposals++; },
    }),
  });

  radiance.setRoom("living");
  await queueEntered;
  const firstDispose = radiance.dispose();
  const secondDispose = radiance.dispose();
  expect(secondDispose).toBe(firstDispose);
  expect(targetDisposals).toBe(0);
  expect(generatorDisposals).toBe(0);
  releaseQueue();
  await Promise.all([firstDispose, secondDispose]);
  expect(targetDisposals).toBe(0);
  expect(generatorDisposals).toBe(1);
});
