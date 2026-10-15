import type { DesignInput } from "./storage-design";
/** V8 composition overlay. The source layout and V6/V7 remain independently inspectable. */
export function createSalonDesign<T extends DesignInput>(base: T): T {
  const m = structuredClone(base);
  m.version = "8.0.0";
  const patches: Record<string, Record<string, unknown>> = {
    "dining-table": { w: 1.1, d: 0.8, h: 0.735, x: 1.55, z: 6.5 },
    "dining-chair-left": {
      type: "salon_banquette",
      w: 1.68,
      d: 0.5,
      h: 0.8,
      x: 0.36,
      z: 6.5,
      rotation: 90,
      retreat: undefined,
    },
    "dining-chair-right": {
      w: 0.6,
      d: 0.6,
      h: 0.79,
      x: 2.55,
      z: 6.5,
      retreat: { x: 3.0, z: 6.5, distanceM: 0.45 },
    },
    "living-sofa": { w: 2.55, d: 1.05, h: 0.76 },
    "side-table": { w: 0.38, d: 0.38, h: 0.46 },
    "living-lamp": { w: 0.41, d: 0.41 },
    "guest-window-bench": { h: 0.48 },
    "plant-bar": { x: 3.45, z: 5.82 },
    "plant-living": { x: 8.2, z: 8.35 },
    "plant-guest": { room: "hall", x: 6.55, z: 3.65 },
  };
  for (const o of m.objects) if (patches[o.id]) Object.assign(o, patches[o.id]);
  m.objects.push({
    id: "salon-coffee-table",
    type: "coffee_table",
    room: "living",
    x: 9.35,
    z: 6.18,
    y: 0,
    w: 1.05,
    d: 0.54,
    h: 0.34,
    rotation: 0,
    material: "salonStone",
  });
  const scenes = m.presentationScenarios as {
    id: string;
    people: { points: number[][]; radius: number }[];
    geometryCheck: string;
  }[];
  const route = scenes.find((s) => s.id === "ps5-balcony");
  if (route) {
    route.people[0].points = [
      [7.5, 5.4],
      [11.15, 5.4],
      [11.15, 7.45],
      [12.1, 7.45],
    ];
    route.geometryCheck =
      "V8 route rerouted in front of the low table, preserving the original 0.45m avatar radius";
  }
  for (const view of m.presentation.interiorViews) {
    if (view.id === "bar-ritual")
      Object.assign(view, {
        position: [4.12, 1.5, 5.95],
        target: [1.7, 1.42, 7.65],
        horizontalFov: 88,
      });
    if (view.id === "living-lounge")
      Object.assign(view, {
        position: [7.5, 1.4, 6.3],
        target: [9.5, 1.15, 6.5],
        horizontalFov: 100,
      });
    if (view.id === "cinema-seat")
      Object.assign(view, {
        position: [2.05, 1.15, 0.7],
        target: [2.05, 1.5, 3.12],
        horizontalFov: 88,
      });
    if (view.id === "cinema-entry")
      Object.assign(view, {
        position: [4.15, 1.5, 2.8],
        target: [1.8, 1.45, 1.2],
        horizontalFov: 96,
      });
  }
  m.presentation.interiorViews.push(
    {
      id: "salon-bar-seat",
      roomId: "bar",
      label: "水吧 · 窗边沙龙",
      position: [3.75, 1.4, 7.2],
      target: [0.7, 1.1, 6.5],
      horizontalFov: 82,
    },
    {
      id: "salon-living-seat",
      roomId: "living",
      label: "客厅 · 围坐与停留",
      position: [10.9, 1.4, 5.35],
      target: [9.2, 1.0, 7.95],
      horizontalFov: 84,
    },
    {
      id: "salon-cinema-vault",
      roomId: "guest",
      label: "影音室 · 弧顶内室",
      position: [3.45, 1.5, 2.75],
      target: [1.8, 1.6, 1.1],
      horizontalFov: 94,
    },
  );
  m.lighting.fixtures.push({
    id: "salon-bar-wash",
    roomId: "bar",
    spaceIds: ["bar"],
    position: [2.4, 2.585, 7.93],
    target: [2.4, 1.15, 7.7],
    group: "ambient",
    kelvin: 2700,
    lumens: 480,
    type: "line",
    length: 4.25,
    axis: "x",
    beamAngle: 110,
    range: 2.2,
    shadowPriority: 0,
    anchor: "salon:bar-portal",
  });
  const lightScenes = m.lighting.scenes as {
    id: string;
    ambientIntensity?: number;
    environmentIntensity?: number;
    roomLevels?: Record<string, Record<string, number>>;
  }[];
  for (const s of lightScenes) {
    if (s.id === "aperitif") {
      s.ambientIntensity = 0.58;
      s.environmentIntensity = 0.24;
    }
    if (s.id === "game") {
      s.ambientIntensity = 0.6;
      s.environmentIntensity = 0.25;
    }
    if (s.id === "cinema") {
      s.ambientIntensity = 0.68;
      s.environmentIntensity = 0.2;
    }
  }
  return m;
}
export const salonFurnitureIds = [
  "dining-table",
  "dining-chair-left",
  "dining-chair-right",
  "living-sofa",
  "side-table",
  "living-lamp",
  "salon-coffee-table",
];
