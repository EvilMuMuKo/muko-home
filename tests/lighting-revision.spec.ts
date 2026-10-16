import { test, expect } from "@playwright/test";
import original from "../src/model.js";
import { createStorageDesign, type DesignInput } from "../src/storage-design";
import { createAtmosphereDesign } from "../src/atmosphere-design";
import { createSalonDesign } from "../src/salon-design";
import { createHomeDesign } from "../src/home-design";

function finalModel() {
  return createHomeDesign(
    createSalonDesign(
      createAtmosphereDesign(
        createStorageDesign(original as unknown as DesignInput),
      ),
    ),
  );
}

test("lighting anchors resolve against final objects and scene presets", () => {
  const model = finalModel();
  const objectIds = new Set(model.objects.map((object: any) => object.id));
  const fixtureIds = new Set(model.lighting.fixtures.map((fixture: any) => fixture.id));
  for (const fixture of model.lighting.fixtures as any[]) {
    if (fixture.anchor) expect(objectIds.has(fixture.anchor), fixture.id).toBe(true);
  }
  for (const scene of model.lighting.scenes as any[]) {
    for (const id of Object.keys(scene.fixtureLevels ?? {})) expect(fixtureIds.has(id), `${scene.id}:${id}`).toBe(true);
    for (const id of Object.keys(scene.fixtureKelvin ?? {})) expect(fixtureIds.has(id), `${scene.id}:${id}`).toBe(true);
  }
  expect(model.lighting.fixtures.find((f: any) => f.id === "living-wall-cove").anchor).toBeNull();
  expect(model.lighting.fixtures.find((f: any) => f.id === "balcony-laundry").anchor).toBeNull();
});

test("dining and cabinet lights follow final geometry and shelf beams point down", () => {
  const model = finalModel();
  const fixture = (id: string) => model.lighting.fixtures.find((f: any) => f.id === id) as any;
  const diningPair = [fixture("dining-offset-1"), fixture("dining-offset-2")];
  expect(diningPair[0].position[0]).toBeCloseTo(2.07, 8);
  expect(diningPair[1].position[0]).toBeCloseTo(2.63, 8);
  expect(diningPair.map((f) => f.position[2])).toEqual([6.45, 6.45]);
  expect(diningPair.every((f) => f.target[1] > 0.74)).toBe(true);

  const coffee = model.objects.find((o: any) => o.id === "upper-bar-coffee");
  const task = fixture("bar-task");
  expect(task.position[1]).toBeLessThan(coffee.y);
  expect(task.position[2]).toBeLessThan(coffee.z - coffee.d / 2);

  for (const id of ["display-level-1", "display-level-2", "display-level-3"]) {
    const f = fixture(id);
    expect(f.target[1]).toBeLessThan(f.position[1]);
    const display = model.objects.find((o: any) => o.id === "upper-bar-display");
    const shelfIndex = Number(id.at(-1)) - 1;
    const attachment = shelfIndex < 2 ? display.shelves[shelfIndex] : display.h - 0.018;
    expect(f.position[1]).toBeCloseTo(display.y + attachment - 0.018, 8);
  }
});

test("master reading points avoid bed volume and bedtime keeps them off", () => {
  const model = finalModel();
  const bed = model.objects.find((o: any) => o.id === "master-bed");
  const minX = bed.x - bed.w / 2, maxX = bed.x + bed.w / 2;
  const minZ = bed.z - bed.d / 2, maxZ = bed.z + bed.d / 2;
  for (const id of ["master-reading-1", "master-reading-2"]) {
    const f = model.lighting.fixtures.find((item: any) => item.id === id) as any;
    for (const point of [f.position, f.target]) {
      const withinFootprint = point[0] > minX && point[0] < maxX && point[2] > minZ && point[2] < maxZ;
      const withinBedHeight = point[1] <= bed.y + bed.h;
      expect(withinFootprint && withinBedHeight, `${id}:${point}`).toBe(false);
    }
    expect(f.lumens).toBeLessThanOrEqual(140);
  }
  const night = model.lighting.scenes.find((scene: any) => scene.id === "night");
  expect(night.levels.reading).toBe(0);
});


test("daylight disables low night guides and all light vectors remain finite", () => {
  const model = finalModel();
  expect(model.lighting.defaultScene).toBe("day-public");
  for (const scene of model.lighting.scenes as any[]) {
    if (scene.daylight) expect(scene.levels.night, scene.id).toBe(0);
  }
  for (const f of model.lighting.fixtures as any[]) {
    expect([...f.position, ...f.target].every(Number.isFinite), f.id).toBe(true);
    expect(Math.hypot(...f.position.map((v: number, i: number) => v - f.target[i])), f.id).toBeGreaterThan(0.025);
  }
});
