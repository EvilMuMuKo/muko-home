import { test, expect } from "@playwright/test";
import { ShallowWater } from "../src/shallow-water";
import { Curtain } from "../src/cloth";
import { Group, MeshStandardMaterial } from "three";
test("Saint-Venant still water stays still; perturbed basin conserves mass and stays positive", () => {
  const water = new ShallowWater(16, 20);
  const original = water.state.slice(),
    volume = water.volume;
  for (let i = 0; i < 60; i++) water.step(1 / 30);
  expect(water.state).toEqual(original);
  water.disturb(0.38, 0.45, 0.025);
  for (let i = 0; i < 900; i++) {
    if (i % 100 === 0) water.disturb(0.5, 0.6, 0.015);
    water.step(1 / 30);
  }
  expect(water.volume).toBeCloseTo(volume, 12);
  expect([...water.state].every(Number.isFinite)).toBe(true);
  expect(
    Array.from(
      { length: water.nx * water.nz },
      (_, i) => water.state[i * 3],
    ).every((h) => h > 0 && h < 0.12),
  ).toBe(true);
});
test("cloth pins remain fixed and cloth avoids floor and wall over sustained wind", () => {
  const parent = new Group(),
    curtain = new Curtain(parent, new MeshStandardMaterial(), 0.8, 0.16, 1);
  const position = curtain.mesh.geometry.attributes.position;
  const pins = position.array.slice(0, 27);
  for (let i = 0; i < 600; i++) curtain.step(1 / 60, i / 60);
  expect(position.array.slice(0, 27)).toEqual(pins);
  for (let i = 9; i < position.count; i++) {
    expect(position.getY(i)).toBeGreaterThanOrEqual(0.034);
    expect(position.getZ(i)).toBeGreaterThanOrEqual(0.104);
  }
  expect([...position.array].every(Number.isFinite)).toBe(true);
});
