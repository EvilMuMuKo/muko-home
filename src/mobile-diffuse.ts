import * as THREE from "three";
import type { DiffuseBounceData } from "./diffuse-bounce";

const RUNTIME_INTENSITY_CAP = 0.35;
const PROBES_PER_ROOM = 8;
const COMPONENTS = 27;

export type MobileDiffuseAudit = {
  backend: "mobile-sh";
  bakeCount: 0;
  cachedRooms: string[];
  currentRoom: string | null;
  activeGridCount: 0;
  activeProbeCount: 0 | 1;
  runtimeIntensityCap: number;
  policy: "persistent-room-average-sh";
  note: string;
  lastError: null;
};

export function createMobileDiffuseBounce(args: {
  scene: THREE.Scene;
  validate: (data: DiffuseBounceData) => string | null;
}) {
  const { scene, validate } = args;
  const probe = new THREE.LightProbe();
  const cached = new Map<string, THREE.SphericalHarmonics3>();
  let currentRoom: string | null = null;
  let intensity = RUNTIME_INTENSITY_CAP;
  let disposed = false;
  scene.add(probe);

  function assertLive() {
    if (disposed) throw new Error("Mobile diffuse GI service is disposed.");
  }

  function decode(data: DiffuseBounceData) {
    const issue = validate(data);
    if (issue) throw new Error(issue);
    const { rgba, format } = data.atlas;
    const valueAt = (index: number) => {
      const value = rgba[index];
      if (format === "float32") return value;
      const sign = value & 0x8000 ? -1 : 1;
      const exponent = (value >> 10) & 0x1f;
      const fraction = value & 0x03ff;
      if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
      return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
    };
    const sums = new Float64Array(COMPONENTS);
    for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      for (let component = 0; component < COMPONENTS; component++) {
        const block = Math.floor(component / 4);
        const channel = component % 4;
        const index = ((((block * 4 + 1 + z) * 2 + y) * 2 + x) * 4 + channel);
        sums[component] += valueAt(index);
      }
    }
    const sh = new THREE.SphericalHarmonics3();
    for (let component = 0; component < COMPONENTS; component++) {
      const coefficient = Math.floor(component / 3);
      const channel = component % 3;
      sh.coefficients[coefficient].setComponent(channel, sums[component] / PROBES_PER_ROOM);
    }
    return sh;
  }

  function applyRoom(roomId: string | null) {
    currentRoom = roomId;
    const sh = roomId ? cached.get(roomId) : undefined;
    if (sh) probe.sh.copy(sh);
    else probe.sh.coefficients.forEach((coefficient) => coefficient.set(0, 0, 0));
    probe.intensity = intensity;
  }

  return {
    install(data: DiffuseBounceData) {
      assertLive();
      const coefficients = decode(data);
      cached.set(data.roomId, coefficients);
      if (currentRoom === data.roomId) applyRoom(currentRoom);
    },
    setRoom(roomId: string) {
      assertLive();
      applyRoom(roomId);
    },
    setIntensity(value: number) {
      assertLive();
      intensity = Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, RUNTIME_INTENSITY_CAP) : 0;
      probe.intensity = intensity;
    },
    audit(): MobileDiffuseAudit {
      return {
        backend: "mobile-sh",
        bakeCount: 0,
        cachedRooms: [...cached.keys()],
        currentRoom,
        activeGridCount: 0,
        activeProbeCount: disposed ? 0 : 1,
        runtimeIntensityCap: RUNTIME_INTENSITY_CAP,
        policy: "persistent-room-average-sh",
        note: "Room-averaged SH only; no position-based GI, dynamic occlusion, or runtime bake.",
        lastError: null,
      };
    },
    async bakeRoom(_roomId: string): Promise<DiffuseBounceData> {
      throw new Error("Mobile diffuse GI does not support runtime baking.");
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(probe);
      cached.clear();
      currentRoom = null;
    },
  };
}
