import * as THREE from "three";

/** Fine engineered mineral finish, authored procedurally; not a scanned stone. */
export function mineralSurface(size = 128) {
  const height = new Float32Array(size * size);
  const color = new Uint8Array(size * size * 4);
  const normal = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  let seed = 71821;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = (random() - 0.5) * 0.55 + Math.sin(x * Math.PI * 8 / size) * Math.cos(y * Math.PI * 6 / size) * 0.12;
    const index = (y * size + x) * 4;
    height[y * size + x] = value;
    const grain = Math.round(value * 14);
    color.set([232 + grain, 229 + grain, 220 + grain, 255], index);
    const rough = Math.round((0.66 + value * 0.06) * 255);
    roughness.set([rough, rough, rough, 255], index);
  }
  const h = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const direction = new THREE.Vector3((h(x - 1, y) - h(x + 1, y)) * 0.22,
      (h(x, y - 1) - h(x, y + 1)) * 0.22, 1).normalize();
    normal.set([Math.round((direction.x * .5 + .5) * 255),
      Math.round((direction.y * .5 + .5) * 255), Math.round((direction.z * .5 + .5) * 255), 255], (y * size + x) * 4);
  }
  const texture = (data: Uint8Array, channel: string) => {
    const value = new THREE.DataTexture(data, size, size);
    value.colorSpace = channel === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    value.flipY = false;
    value.wrapS = value.wrapT = THREE.RepeatWrapping;
    value.repeat.setScalar(1 / 0.6);
    value.magFilter = THREE.LinearFilter;
    value.minFilter = THREE.LinearMipmapLinearFilter;
    value.generateMipmaps = true;
    value.name = `authored-mineral-${channel}`;
    value.userData.materialAudit = {family: "authored fine mineral", channel, tileMeters: [0.6, 0.6], source: "procedural, not scanned"};
    value.needsUpdate = true;
    return value;
  };
  return {map: texture(color, "color"), normalMap: texture(normal, "normal"), roughnessMap: texture(roughness, "roughness")};
}
