// Node 24 strips TypeScript types; no extra runtime dependency required.
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { SphereGeometry, Matrix4 } from "three";
import { initGeometry, transformGeometry } from "../src/geometry.ts";
const bytes = await readFile("public/transform.wasm");
await initGeometry(`data:application/wasm;base64,${bytes.toString("base64")}`);
const matrix = new Matrix4()
  .makeRotationY(0.4)
  .scale({ x: 1.2, y: 0.8, z: 1.1 });
const source = new SphereGeometry(1, 128, 64),
  iterations = 300;
const samples = { javascript: [], wasm: [] };
for (let round = 0; round < 9; round++)
  for (const [key, fn] of [
    ["javascript", (g) => g.applyMatrix4(matrix)],
    ["wasm", (g) => transformGeometry(g, matrix)],
  ]) {
    const geometries = Array.from({ length: iterations }, () => source.clone());
    const start = performance.now();
    for (const geometry of geometries) fn(geometry);
    if (round > 0) samples[key].push(performance.now() - start);
  }
const median = (a) => a.sort((a, b) => a - b)[Math.floor(a.length / 2)];
console.log(
  JSON.stringify(
    {
      vertices: source.attributes.position.count,
      iterations,
      medianMs: Object.fromEntries(
        Object.entries(samples).map(([key, a]) => [key, median(a)]),
      ),
    },
    null,
    2,
  ),
);
