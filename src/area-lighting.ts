import * as THREE from "three";

export type AreaLightingBackend = "webgl" | "webgpu";
export type AreaLightFixture = {
  id?: string;
  position: number[];
  target: number[];
  axis?: "x" | "y" | "z";
  length?: number;
  lumens?: number;
};

const initialized = new Map<AreaLightingBackend, Promise<void>>();

/** Load Three.js's LTC data for RectAreaLight on the active rendering backend. */
export async function initAreaLighting(backend: AreaLightingBackend): Promise<void> {
  const existing = initialized.get(backend);
  if (existing) return existing;
  const setup = backend === "webgl"
    ? import("three/addons/lights/RectAreaLightUniformsLib.js").then(({ RectAreaLightUniformsLib }) => {
        RectAreaLightUniformsLib.init();
      })
    : Promise.all([
        import("three/addons/lights/RectAreaLightTexturesLib.js"),
        import("three/webgpu"),
      ]).then(([{ RectAreaLightTexturesLib }, { RectAreaLightNode }]) => {
        RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init());
      });
  initialized.set(backend, setup);
  return setup;
}

const axisVector = (axis: AreaLightFixture["axis"]) => {
  if (axis === "y") return new THREE.Vector3(0, 1, 0);
  if (axis === "z") return new THREE.Vector3(0, 0, 1);
  return new THREE.Vector3(1, 0, 0);
};

/**
 * Position and aim a rectangular preview light from a fixture record.
 * The strip's width follows the fixture axis projected into the light plane;
 * local -Z points toward its target. This is a preview approximation only.
 */
export function alignAreaLight(
  light: THREE.RectAreaLight,
  fixture: AreaLightFixture,
  color: THREE.ColorRepresentation,
  level: number,
  previewScale: number,
): THREE.RectAreaLight {
  const position = new THREE.Vector3(...fixture.position.slice(0, 3));
  const target = new THREE.Vector3(...fixture.target.slice(0, 3));
  const direction = target.sub(position);
  if (direction.lengthSq() < 1e-10) direction.set(0, -1, 0);
  direction.normalize();

  let right = axisVector(fixture.axis).projectOnPlane(direction);
  if (right.lengthSq() < 1e-8) {
    const fallback = Math.abs(direction.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
    right = fallback.projectOnPlane(direction);
  }
  right.normalize();
  const back = direction.clone().negate();
  const up = back.clone().cross(right).normalize();
  right = up.clone().cross(back).normalize();

  const basis = new THREE.Matrix4().makeBasis(right, up, back);
  light.position.copy(position);
  light.quaternion.setFromRotationMatrix(basis);
  light.color.set(color);
  light.height = 0.035;
  light.width = Math.max(0.01, Number.isFinite(fixture.length) ? Number(fixture.length) : 0.1);

  const lumens = Math.max(0, Number.isFinite(fixture.lumens) ? Number(fixture.lumens) : 0);
  const safeLevel = Math.max(0, Number.isFinite(level) ? level : 0);
  const safeScale = Math.max(0, Number.isFinite(previewScale) ? previewScale : 0);
  const intensity = (lumens / (light.width * light.height * Math.PI)) * safeLevel * safeScale;
  light.intensity = Math.min(250, Number.isFinite(intensity) ? intensity : 0);
  light.userData = { ...light.userData, areaLightPreviewOnly: true, castsShadows: false };
  light.castShadow = false;
  return light;
}
