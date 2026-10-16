import * as THREE from "three";

export interface RoomCapturePlan {
  roomId: string;
  position: [number, number, number];
  mobileSize: 64;
  desktopSize: 128;
}

export interface RoomRadianceAudit {
  kind: "local-specular-reflections";
  captureCount: number;
  cacheEntries: number;
  cacheCapacity: number;
  captureInProgress: boolean;
  currentRoom: string | null;
  night: boolean;
  mobile: boolean;
  capturePoints: RoomCapturePlan[];
  animatedRootsHiddenDuringCapture: number;
  cutawayNodesRestoredDuringCapture: number;
  lastError: string | null;
  note: string;
}

type CaptureTarget = { texture: THREE.Texture; dispose(): void };
type RoomModel = {
  rooms?: Array<{ id: string; polygon?: Array<[number, number]> }>;
  objects?: Array<{ id?: string; room?: string; type?: string; x: number; z: number; w?: number; d?: number; rotation?: number }>;
};
type EnvironmentGenerator = (renderer: unknown) => {
  fromScene(
    scene: THREE.Scene,
    sigma: number,
    near: number,
    far: number,
    options: { size: number; position: THREE.Vector3 },
  ): CaptureTarget;
  dispose?(): void;
};

const HEIGHT = 1.35;
const VARIANTS_PER_ROOM = 2;

async function waitForSubmittedWork(renderer: unknown) {
  const queue = (renderer as { backend?: { device?: { queue?: { onSubmittedWorkDone?: () => Promise<void> } } } } | null)?.backend?.device?.queue;
  if (typeof queue?.onSubmittedWorkDone === "function") await queue.onSubmittedWorkDone();
}

export function roomRadiancePolicy(mobile: boolean, roomCount = 8) {
  return {
    captureSize: mobile ? 64 : 128,
    maxCachedEnvironments: Math.max(0, roomCount) * VARIANTS_PER_ROOM,
    eagerCaptures: 0 as const,
    cachePolicy: "retain-until-dispose" as const,
  };
}

function pointInPolygon(x: number, z: number, polygon: Array<[number, number]>) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function segmentDistance(x: number, z: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq === 0 ? 0 : THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / lengthSq, 0, 1);
  return Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz));
}

function clearance(x: number, z: number, polygon: Array<[number, number]>) {
  if (!pointInPolygon(x, z, polygon)) return -Infinity;
  let distance = Infinity;
  for (let i = 0; i < polygon.length; i++) distance = Math.min(distance, segmentDistance(x, z, polygon[i], polygon[(i + 1) % polygon.length]));
  return distance;
}

function insideSolidObject(x: number, z: number, roomId: string, objects: NonNullable<RoomModel["objects"]>) {
  return objects.some((object) => {
    if (object.room && object.room !== roomId) return false;
    if (!Number.isFinite(object.x) || !Number.isFinite(object.z)) return false;
    const yaw = THREE.MathUtils.degToRad(object.rotation ?? 0);
    const dx = x - object.x, dz = z - object.z;
    const localX = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
    const localZ = Math.sin(yaw) * dx + Math.cos(yaw) * dz;
    return Math.abs(localX) <= (object.w ?? 0) / 2 + 0.16 && Math.abs(localZ) <= (object.d ?? 0) / 2 + 0.16;
  });
}

/** Selects a deterministic interior point, including for concave room outlines. */
export function buildRoomCapturePlan(model: RoomModel): RoomCapturePlan[] {
  return (model.rooms ?? []).flatMap((room) => {
    const polygon = room.polygon;
    if (!polygon || polygon.length < 3 || polygon.some(([x, z]) => !Number.isFinite(x) || !Number.isFinite(z))) return [];
    const minX = Math.min(...polygon.map(([x]) => x)), maxX = Math.max(...polygon.map(([x]) => x));
    const minZ = Math.min(...polygon.map(([, z]) => z)), maxZ = Math.max(...polygon.map(([, z]) => z));
    let best: [number, number] | null = null;
    let bestClearance = -Infinity;
    // A fixed 19x19 grid gives stable points and resolves narrow/concave rooms cheaply on CPU.
    for (let iz = 1; iz < 20; iz++) for (let ix = 1; ix < 20; ix++) {
      const x = minX + ((maxX - minX) * ix) / 20;
      const z = minZ + ((maxZ - minZ) * iz) / 20;
      if (room.id === "hall" && (model.rooms ?? []).some(other => other.id !== "hall" && other.polygon && pointInPolygon(x,z,other.polygon))) continue;
      const gap = insideSolidObject(x, z, room.id, model.objects ?? []) ? -Infinity : clearance(x, z, polygon);
      if (gap > bestClearance) { best = [x, z]; bestClearance = gap; }
    }
    if (!best || bestClearance <= 0) return [];
    return [{ roomId: room.id, position: [best[0], HEIGHT, best[1]] as [number, number, number], mobileSize: 64 as const, desktopSize: 128 as const }];
  });
}

function hasAnimatedAncestor(node: THREE.Object3D) {
  for (let current: THREE.Object3D | null = node; current; current = current.parent) {
    if (current.userData.animated || current.userData.animation || current.userData.mixer || current.userData.animationClip || current.animations.length) return true;
  }
  return node instanceof THREE.SkinnedMesh || !!(node as THREE.Mesh).morphTargetInfluences;
}

export function roomMembership(node: THREE.Object3D): string[] {
  for (let current: THREE.Object3D | null = node; current && current.type !== "Scene"; current = current.parent) {
    const ids = current.userData.spaceIds ?? current.userData.roomIds ?? current.userData.roomIDs;
    if (Array.isArray(ids)) {
      const valid = ids.filter((id): id is string => typeof id === "string");
      if (valid.length) return valid;
    }
    if (typeof current.userData.roomId === "string") return [current.userData.roomId];
  }
  return [];
}

/**
 * Lazily captures one room at a time and applies its PMREM to room-tagged material clones.
 * These are local specular reflections only; this module does not bake diffuse GI.
 */
export async function createRoomRadiance(args: {
  renderer: unknown;
  scene: THREE.Scene;
  model: RoomModel;
  materials: Record<string, THREE.Material>;
  mobile: boolean;
  environmentGenerator: EnvironmentGenerator;
  /** Pause the normal renderer loop for the full scene-mutation/capture/restore window. */
  withRenderPaused?: <T>(capture: () => Promise<T>) => Promise<T>;
}) {
  const { renderer, scene, model, materials, mobile } = args;
  const generator = args.environmentGenerator(renderer);
  const plans = buildRoomCapturePlan(model);
  const planByRoom = new Map(plans.map((plan) => [plan.roomId, plan]));
  const eligibleMaterials = new Set(Object.values(materials));
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const baseMaterials = new Map<THREE.Material, THREE.Material>();
  const targets = new Map<string, CaptureTarget>();
  const clones = new Map<string, THREE.Material>();
  const cacheCapacity = roomRadiancePolicy(mobile, plans.length).maxCachedEnvironments;
  const withRenderPaused = args.withRenderPaused ?? ((capture) => capture());
  let currentRoom: string | null = null;
  let night = false;
  let disposed = false;
  let captureCount = 0;
  let captureInProgress = false;
  let animatedRootsHiddenDuringCapture = 0;
  let cutawayNodesRestoredDuringCapture = 0;
  let lastError: string | null = null;
  let pending: Promise<void> | null = null;
  let disposalTask: Promise<void> | null = null;
  let mutationTail: Promise<void> = Promise.resolve();
  const inFlightRequests = new Set<Promise<void>>();

  async function withRenderMutationLock<T>(work: () => Promise<T>): Promise<T> {
    const previous = mutationTail;
    let release!: () => void;
    mutationTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await withRenderPaused(work);
    } finally {
      release();
    }
  }

  function trackRequest(request: Promise<void>) {
    inFlightRequests.add(request);
    void request.then(
      () => inFlightRequests.delete(request),
      () => inFlightRequests.delete(request),
    );
  }

  async function waitUntilIdle() {
    while (inFlightRequests.size) await Promise.all([...inFlightRequests]);
    await mutationTail;
  }

  scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    if (!nodeMaterials.some((material) => eligibleMaterials.has(material))) return;
    originals.set(node, node.material);
    for (const material of nodeMaterials) if (eligibleMaterials.has(material)) baseMaterials.set(material, material);
  });

  const cacheKey = (roomId: string, isNight: boolean) => `${roomId}:${isNight ? "night" : "day"}`;
  const cloneKey = (key: string, base: THREE.Material) => `${key}:${base.uuid}`;

  function restoreOriginalAssignments() {
    for (const [mesh, material] of originals) if (mesh.parent) mesh.material = material;
  }

  function applyRoom(key: string, roomId: string) {
    const target = targets.get(key);
    if (!target) return;
    restoreOriginalAssignments();
    for (const [mesh, original] of originals) {
      if (!mesh.parent || !roomMembership(mesh).includes(roomId)) continue;
      const setEnv = (base: THREE.Material) => {
        if (!eligibleMaterials.has(base)) return base;
        const id = cloneKey(key, base);
        let clone = clones.get(id);
        if (!clone) {
          clone = base.clone();
          clone.name = base.name;
          clone.userData = { ...base.userData };
          if ("envMap" in clone) (clone as THREE.MeshStandardMaterial).envMap = target.texture as THREE.Texture;
          if ("envMapIntensity" in clone) (clone as THREE.MeshStandardMaterial).envMapIntensity = mobile ? 0.22 : 0.3;
          clone.needsUpdate = true;
          clones.set(id, clone);
        }
        return clone;
      };
      mesh.material = Array.isArray(original) ? original.map(setEnv) : setEnv(original);
    }
  }

  async function ensureCapture(roomId: string, isNight: boolean) {
    const plan = planByRoom.get(roomId);
    if (!plan || disposed) return;
    const key = cacheKey(roomId, isNight);
    if (targets.has(key)) {
      await withRenderMutationLock(async () => {
        await waitForSubmittedWork(renderer);
        if (disposed) return;
        if (currentRoom === roomId && night === isNight) restoreOriginalAssignments();
        if (currentRoom === roomId && night === isNight) applyRoom(key, roomId);
      });
      return;
    }
    if (pending) await pending;
    if (disposed || targets.has(key) || currentRoom !== roomId || night !== isNight) return;
    pending = Promise.resolve(withRenderMutationLock(async () => {
      if (disposed || targets.has(key) || currentRoom !== roomId || night !== isNight) return;
      captureInProgress = true;
      const hidden: Array<[THREE.Object3D, boolean]> = [];
      const envMaps: Array<[THREE.Material, THREE.Texture | null]> = [];
      const oldEnvironment = scene.environment;
      const oldIntensity = scene.environmentIntensity;
      try {
        // The render gate excludes new scene submissions; also drain queued GPU work.
        await waitForSubmittedWork(renderer);
        // A room/night change may arrive while the queue drain yields. Do not
        // mutate the shared scene for a capture that is no longer requested.
        if (disposed || currentRoom !== roomId || night !== isNight) return;
        restoreOriginalAssignments();
        scene.traverse((node) => {
          if (!node.visible && node !== scene && roomMembership(node).length > 0 && !hasAnimatedAncestor(node)) {
            hidden.push([node, node.visible]);
            node.visible = true;
            cutawayNodesRestoredDuringCapture++;
          }
          if (node !== scene && node.visible && hasAnimatedAncestor(node) && !hasAnimatedAncestor(node.parent ?? node)) {
            hidden.push([node, node.visible]);
            node.visible = false;
            animatedRootsHiddenDuringCapture++;
          }
          if (!(node instanceof THREE.Mesh)) return;
          const list = Array.isArray(node.material) ? node.material : [node.material];
          // A cubemap must not resize the live frame's transmission buffers or
          // recursively render planar mirrors. Clear glazing is absent from the
          // reflection capture, while its frame and the shared exterior remain.
          if (node.visible && (node.userData.kind === "planar-mirror" ||
              list.some(material => (material as THREE.MeshPhysicalMaterial).transmission > 0))) {
            hidden.push([node,true]); node.visible=false;
          }
          for (const material of list) {
            if (!("envMap" in material)) continue;
            const envMaterial = material as THREE.MeshStandardMaterial;
            if (!envMaps.some(([candidate]) => candidate === material)) envMaps.push([material, envMaterial.envMap]);
            envMaterial.envMap = null;
            envMaterial.needsUpdate = true;
          }
        });
        scene.environment = null;
        scene.environmentIntensity = 0;
        // Night reflections are captured under the live night lighting; refresh(night) is called after light changes.
        const target = generator.fromScene(scene, 0, 0.08, 50, {
          size: roomRadiancePolicy(mobile, plans.length).captureSize,
          position: new THREE.Vector3(...plan.position),
        });
        // PMREMGenerator.fromScene submits render work synchronously but completion is queued.
        await waitForSubmittedWork(renderer);
        if (disposed) { target.dispose(); return; }
        targets.set(key, target);
        captureCount++;
        lastError = null;
        if (currentRoom === roomId && night === isNight) applyRoom(key, roomId);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      } finally {
        for (const [material, envMap] of envMaps) {
          (material as THREE.MeshStandardMaterial).envMap = envMap;
          material.needsUpdate = true;
        }
        scene.environment = oldEnvironment;
        scene.environmentIntensity = oldIntensity;
        for (let i = hidden.length - 1; i >= 0; i--) hidden[i][0].visible = hidden[i][1];
        captureInProgress = false;
      }
    }));
    try { await pending; } finally { pending = null; }
  }

  function requestCurrent() {
    if (currentRoom) trackRequest(ensureCapture(currentRoom, night).catch((error) => {
      lastError = error instanceof Error ? error.message : String(error);
    }));
  }

  return {
    async refresh(nextNight: boolean) {
      night = nextNight;
      if (currentRoom) await ensureCapture(currentRoom, night);
    },
    whenReady: waitUntilIdle,
    setRoom(roomId: string | null) {
      const nextRoom = roomId && planByRoom.has(roomId) ? roomId : null;
      if (currentRoom === nextRoom) return;
      currentRoom = nextRoom;
      if (currentRoom) requestCurrent();
      else trackRequest(withRenderMutationLock(async () => {
        await waitForSubmittedWork(renderer);
        restoreOriginalAssignments();
      }).catch((error) => {
        lastError = error instanceof Error ? error.message : String(error);
      }));
    },
    audit(): RoomRadianceAudit {
      return {
        kind: "local-specular-reflections",
        captureCount,
        cacheEntries: targets.size,
        cacheCapacity,
        captureInProgress,
        currentRoom,
        night,
        mobile,
        capturePoints: plans.map((plan) => ({ ...plan, position: [...plan.position] as [number, number, number] })),
        animatedRootsHiddenDuringCapture,
        cutawayNodesRestoredDuringCapture,
        lastError,
        note: "Room-positioned PMREM reflections only. This is not a lightmap or diffuse global illumination bake.",
      };
    },
    dispose() {
      if (disposalTask) return disposalTask;
      disposed = true;
      disposalTask = (async () => {
        await Promise.all([...inFlightRequests].map((request) => request.catch(() => undefined)));
        await pending?.catch(() => undefined);
        await withRenderMutationLock(async () => {
          await waitForSubmittedWork(renderer);
          restoreOriginalAssignments();
          for (const target of targets.values()) target.dispose();
          for (const material of clones.values()) material.dispose();
          targets.clear();
          clones.clear();
          generator.dispose?.();
        });
      })();
      return disposalTask;
    },
  };
}
