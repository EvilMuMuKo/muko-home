import { Matrix3, type BufferGeometry, type Matrix4 } from "three";
type Kernel = { memory: WebAssembly.Memory; transform(count: number): void };
let kernel: Kernel | undefined;
const stats = {
  backend: "javascript",
  transformedVertices: 0,
  batches: 0,
  reason: "",
};
export const geometryState = () => ({ ...stats });
export async function initGeometry(url: string, enabled = true) {
  if (!enabled) return;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`WASM HTTP ${response.status}`);
    // ArrayBuffer also works on static hosts without application/wasm MIME configuration.
    const { instance } = await WebAssembly.instantiate(
      await response.arrayBuffer(),
    );
    kernel = instance.exports as Kernel;
    stats.backend = "wasm";
  } catch (error) {
    stats.reason = String(error);
  }
}
export function transformGeometry(geometry: BufferGeometry, matrix: Matrix4) {
  const position = geometry.getAttribute("position");
  if (
    !kernel ||
    "isInterleavedBufferAttribute" in position ||
    !(position?.array instanceof Float32Array) ||
    position.itemSize !== 3 ||
    position.count < 256
  ) {
    return geometry.applyMatrix4(matrix);
  }
  const bytes = 128 + position.array.byteLength;
  if (bytes > kernel.memory.buffer.byteLength)
    kernel.memory.grow(
      Math.ceil((bytes - kernel.memory.buffer.byteLength) / 65536),
    );
  new Float64Array(kernel.memory.buffer, 0, 16).set(matrix.elements);
  const buffer = new Float32Array(
    kernel.memory.buffer,
    128,
    position.array.length,
  );
  buffer.set(position.array);
  kernel.transform(position.count);
  position.array.set(buffer);
  position.needsUpdate = true;
  const normal = geometry.getAttribute("normal");
  if (normal) {
    normal.applyNormalMatrix(new Matrix3().getNormalMatrix(matrix));
    normal.needsUpdate = true;
  }
  const tangent = geometry.getAttribute("tangent");
  if (tangent) {
    tangent.transformDirection(matrix);
    tangent.needsUpdate = true;
  }
  if (geometry.boundingBox) geometry.computeBoundingBox();
  if (geometry.boundingSphere) geometry.computeBoundingSphere();
  stats.transformedVertices += position.count;
  stats.batches++;
  return geometry;
}
