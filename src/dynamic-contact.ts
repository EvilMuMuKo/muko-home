import * as THREE from "three";

export type DynamicContactOptions = {
  /** Approximate footprint dimensions in metres. */
  w: number;
  d: number;
  /** Local floor height beneath the root; animated home roots use zero. */
  y?: number;
  /** Peak material opacity, kept subtle by default. */
  strength?: number;
};

/** Upper bound when used for the movable furniture groups in this home. */
export const DYNAMIC_CONTACT_DRAW_CALL_BUDGET = 8;

const radialTexture = (() => {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - size / 2) / (size / 2);
      const dy = (y + 0.5 - size / 2) / (size / 2);
      const radius = Math.sqrt(dx * dx + dy * dy);
      const fade = Math.max(0, 1 - radius);
      const alpha = Math.round(255 * fade * fade);
      const index = (y * size + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = alpha;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
})();

const sharedGeometry = new THREE.PlaneGeometry(1, 1);
const sharedMaterial = new THREE.MeshBasicMaterial({
  color: 0x151311,
  map: radialTexture,
  transparent: true,
  opacity: 0.15,
  depthWrite: false,
  toneMapped: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  side: THREE.DoubleSide,
});

/**
 * Attach one soft floor contact to a movable render root. The helper adds no
 * physics, shadow-map caster, or raycast surface; parent translation/rotation
 * carries it with the furniture. Use only on the individually animated roots.
 */
export function attachDynamicContact<T extends THREE.Object3D>(
  root: T,
  options: DynamicContactOptions,
): THREE.Mesh {
  const strength = THREE.MathUtils.clamp(options.strength ?? 0.15, 0, 0.2);
  const material = strength === sharedMaterial.opacity
    ? sharedMaterial
    : sharedMaterial.clone();
  material.opacity = strength;

  const contact = new THREE.Mesh(sharedGeometry, material);
  contact.name = `${root.name || "movable"}-dynamic-contact`;
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = options.y ?? 0;
  contact.scale.set(Math.max(0.05, options.w * 1.14), Math.max(0.05, options.d * 1.14), 1);
  contact.castShadow = false;
  contact.receiveShadow = false;
  contact.raycast = () => {};
  contact.userData.dynamicContactShadow = true;
  contact.userData.physicsBody = false;
  root.add(contact);
  return contact;
}
