import { test, expect } from "@playwright/test";
import { allocateLighting, observerRoom } from "../src/lighting-allocation";
import model from "../src/model.js";

test("walking light allocation reserves local task sources within the fixed mobile budget", () => {
  const sources = ["hall", "bar", "living", "master", "kitchen", "bath", "guest", "balcony"].flatMap((roomId, i) =>
    ["ambient", "task", "accent"].map((group, j) => ({ f: {roomId, group, id: `${roomId}-${group}`}, score: 1000 - i * 80 - j * 20 })));
  const active = allocateLighting(sources, 6, "balcony", true);
  expect(active).toHaveLength(6);
  expect(active[0].f.id).toBe("balcony-task");
  expect(active.filter(f => f.f.roomId === "balcony")).toHaveLength(3);
  expect(new Set(active)).toHaveProperty("size", 6);
});

test("observer resolves living before overlapping hall and preserves selected room views", () => {
  expect(observerRoom(model.rooms, [9.2, 1.74, 7.5], "all")).toBe("living");
  expect(observerRoom(model.rooms, [5.8, 1.74, 3.2], "all")).toBe("hall");
  expect(observerRoom(model.rooms, null, "master")).toBe("master");
  expect(observerRoom(model.rooms, null, "all")).toBeNull();
});
