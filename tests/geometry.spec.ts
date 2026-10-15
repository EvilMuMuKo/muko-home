import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { readFile } from "node:fs/promises";
import {
  initGeometry,
  transformGeometry,
  geometryState,
} from "../src/geometry";
test("WASM matches Three.js transforms, normals, bounds and memory growth", async () => {
  const bytes = await readFile("public/transform.wasm");
  await initGeometry(
    `data:application/wasm;base64,${bytes.toString("base64")}`,
  );
  expect(geometryState().backend).toBe("wasm");
  for (let i = 0; i < 8; i++) {
    const source = new THREE.SphereGeometry(1, 128, 64);
    source.computeBoundingBox();
    source.computeBoundingSphere();
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(2, -3, 4),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(i * 0.1, 0.7, -0.2)),
      new THREE.Vector3(1 + i * 0.1, 0.8, 1.4),
    );
    const expected = source.clone().applyMatrix4(matrix),
      actual = transformGeometry(source.clone(), matrix);
    for (const name of ["position", "normal", "uv"])
      expect(actual.attributes[name].array).toEqual(
        expected.attributes[name].array,
      );
    expect(actual.boundingBox).toEqual(expected.boundingBox);
    expect(actual.boundingSphere).toEqual(expected.boundingSphere);
  }
  const small = new THREE.BoxGeometry();
  expect(
    transformGeometry(
      small.clone(),
      new THREE.Matrix4().makeTranslation(2, 3, 4),
    ).attributes.position.array,
  ).toEqual(
    small.applyMatrix4(new THREE.Matrix4().makeTranslation(2, 3, 4)).attributes
      .position.array,
  );
});
