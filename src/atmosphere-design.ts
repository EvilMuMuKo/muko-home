import type { DesignInput } from "./storage-design";
export const roomPalette = {
  paper: "#eeece5",
  masterPaper: "#f1ece2",
  clay: "#ad7359",
  moss: "#6d7967",
  masterSage: "#6f796d",
  masterMushroom: "#81796e",
  tobacco: "#bda68f",
  oat: "#deddd5",
  media: "#aaa99f",
  cinema: "#485149",
  cinemaFront: "#303933",
  cinemaCeiling: "#53594f",
};
export interface ThemeScene {
  id: string;
  label: string;
  daylight: boolean;
  levels: Record<string, number>;
  roomLevels?: Record<string, Record<string, number>>;
  fixtureLevels?: Record<string, number>;
  fixtureKelvin?: Record<string, number>;
  viewId?: string;
  ambientIntensity?: number;
  environmentIntensity?: number;
  exposure?: number;
}
const baseLevels = {
  ambient: 0.55,
  basic: 0.2,
  accent: 0.45,
  task: 0.25,
  decor: 0.45,
  screen: 0.15,
  reading: 0.3,
  work: 0.1,
  night: 0.15,
};
export const themeMoments: ThemeScene[] = [
  {
    id: "day-public",
    label: "白天 · 公共生活",
    daylight: true,
    levels: {
      ...baseLevels,
      ambient: 0.42,
      basic: 0.12,
      accent: 0.08,
      decor: 0.12,
      screen: 0.08,
    },
    roomLevels: {
      bar: { ambient: 0.22, task: 0.42, decor: 0.16 },
      living: { ambient: 0.22, reading: 0.18, screen: 0.08 },
    },
    ambientIntensity: 0.78,
    environmentIntensity: 0.34,
    exposure: 1.08,
  },
  {
    id: "two-person-dining",
    label: "两人用餐",
    daylight: false,
    levels: {
      ...baseLevels,
      ambient: 0.3,
      basic: 0.12,
      accent: 0.16,
      task: 0.32,
      decor: 0.3,
      screen: 0.04,
    },
    roomLevels: { bar: { ambient: 0.34, task: 0.48, decor: 0.3 } },
    fixtureKelvin: {
      "bar-task": 3000,
      "dining-offset-1": 2700,
      "dining-offset-2": 2700,
    },
    ambientIntensity: 0.66,
    environmentIntensity: 0.28,
    exposure: 1.12,
  },
  {
    id: "dual-workstations",
    label: "双人工位",
    daylight: true,
    levels: {
      ...baseLevels,
      ambient: 0.3,
      basic: 0.18,
      accent: 0.04,
      task: 0.14,
      work: 0.62,
      reading: 0.18,
      decor: 0.05,
    },
    roomLevels: {
      master: { ambient: 0.24, basic: 0.12, work: 0.82, reading: 0.16 },
    },
    fixtureLevels: { "pc-desk-task": 0.88, "mac-desk-task": 0.88 },
    fixtureKelvin: { "pc-desk-task": 3500, "mac-desk-task": 3500 },
    ambientIntensity: 0.78,
    environmentIntensity: 0.32,
    exposure: 1.08,
  },
  {
    id: "night-navigation",
    label: "夜间通行",
    daylight: false,
    levels: {
      ...baseLevels,
      ambient: 0.12,
      basic: 0.04,
      accent: 0.03,
      task: 0,
      decor: 0.03,
      screen: 0.04,
      reading: 0,
      work: 0,
      night: 0.44,
    },
    roomLevels: {
      hall: { night: 0.58, ambient: 0.08 },
      master: { night: 0.38, ambient: 0.04 },
      guest: { night: 0.38, ambient: 0.04 },
      bar: { night: 0.24, ambient: 0.06 },
      living: { night: 0.24, ambient: 0.06 },
    },
    ambientIntensity: 0.46,
    environmentIntensity: 0.18,
    exposure: 1.1,
  },
  {
    id: "coffee",
    label: "早咖啡",
    daylight: true,
    levels: {
      ...baseLevels,
      ambient: 0,
      accent: 0,
      task: 0.5,
      decor: 0.12,
      screen: 0,
    },
    viewId: "bar-ritual",
    fixtureKelvin: { "bar-task": 3500 },
    ambientIntensity: 1.1,
    environmentIntensity: 0.5,
    exposure: 0.98,
  },
  {
    id: "aperitif",
    label: "晚饮",
    daylight: false,
    levels: baseLevels,
    // Keep the bar intimate, but let the existing counter task light read as usable.
    // A neutral-warm task channel carries the worktop instead of lifting global exposure.
    roomLevels: { bar: { ambient: 0.42, accent: 0.48, task: 0.25, decor: 0.85 } },
    fixtureKelvin: {
      "bar-task": 3000,
      "dining-offset-1": 2700,
      "dining-offset-2": 2700,
    },
    viewId: "bar-ritual",
    ambientIntensity: 0.48,
    environmentIntensity: 0.2,
    exposure: 1.12,
  },
  {
    id: "game",
    label: "客厅 · 游戏与追剧",
    daylight: false,
    levels: { ...baseLevels, task: 0 },
    roomLevels: {
      living: {
        ambient: 0.32,
        accent: 0.16,
        reading: 0.7,
        decor: 0.24,
        screen: 0.45,
      },
    },
    fixtureKelvin: { "living-screen-bias": 5000 },
    viewId: "living-lounge",
    ambientIntensity: 0.48,
    environmentIntensity: 0.2,
    exposure: 1.15,
  },
  {
    id: "cinema",
    label: "私人影院",
    daylight: false,
    levels: {
      ...baseLevels,
      ambient: 0.15,
      accent: 0.08,
      task: 0,
      decor: 0.08,
    },
    roomLevels: {
      guest: {
        ambient: 0.04,
        accent: 0.02,
        task: 0,
        decor: 0,
        reading: 0,
        screen: 0.18,
        night: 0.36,
      },
    },
    fixtureKelvin: { "guest-screen-bias": 6500 },
    viewId: "cinema-seat",
    ambientIntensity: 0.52,
    environmentIntensity: 0.18,
    exposure: 1.3,
  },
  {
    id: "guest-stay",
    label: "影音室 · 客住",
    daylight: false,
    levels: baseLevels,
    roomLevels: {
      guest: {
        ambient: 0.9,
        task: 0.45,
        decor: 0.18,
        reading: 0.86,
        screen: 0,
        night: 0.42,
      },
    },
    viewId: "cinema-entry",
    ambientIntensity: 0.78,
    environmentIntensity: 0.3,
    exposure: 1.16,
  },
];
export function createAtmosphereDesign<T extends DesignInput>(base: T): T {
  const model = structuredClone(base);
  model.version = "7.0.0";
  for (const object of model.objects) {
    if (object.id === "guest-tv")
      Object.assign(object, { w: 1.84, h: 1.035, y: 0.67 });
    if (object.type === "wall_storage") {
      if (object.room === "bar")
        Object.assign(object, {
          material: "barPaint",
          caseMaterial: "barWood",
          insideMaterial: "barInterior",
        });
      if (object.room === "living")
        Object.assign(object, {
          material:
            object.id === "upper-living-rear" ? "livingPaint" : "mediaPaint",
          caseMaterial: "livingWood",
          insideMaterial: "livingInterior",
        });
      if (object.room === "guest")
        Object.assign(object, {
          material: "cinemaPaint",
          caseMaterial: "cinemaWood",
          insideMaterial: "cinemaInterior",
          concealedDisplay: object.id === "upper-guest-media",
        });
    }
  }
  const lighting = model.lighting as unknown as {
    scenes: ThemeScene[];
    fixtures: Record<string, unknown>[];
  };
  lighting.scenes = [
    ...themeMoments,
    ...lighting.scenes.filter((s) => s.id !== "cinema"),
  ];
  for (const fixture of lighting.fixtures) {
    if (fixture.id === "storage-guest-task") fixture.group = "task";
    if (fixture.id === "guest-screen-bias")
      Object.assign(fixture, {
        position: [2.05, 1.19, 3.255],
        target: [2.05, 1.19, 3.32],
        length: 1.45,
      });
  }
  model.presentation.defaultView = "bar-ritual";
  model.presentation.interiorViews.push(
    {
      id: "bar-ritual",
      roomId: "bar",
      label: "早 C 晚 A · 水吧",
      position: [4.05, 1.65, 5.85],
      target: [1.6, 1.45, 7.8],
      horizontalFov: 82,
    },
    {
      id: "living-lounge",
      roomId: "living",
      label: "客厅 · 柔光娱乐",
      position: [7.5, 1.48, 8.2],
      target: [9.45, 1.25, 5.25],
      horizontalFov: 86,
    },
    {
      id: "cinema-seat",
      roomId: "guest",
      label: "秘密影音室 · 观影位",
      position: [2.05, 1.2, 0.95],
      target: [2.05, 1.19, 3.2],
      horizontalFov: 76,
    },
    {
      id: "cinema-entry",
      roomId: "guest",
      label: "秘密影音室 · 客住",
      position: [4.25, 1.6, 2.75],
      target: [1.85, 1.1, 0.85],
      horizontalFov: 88,
    },
    {
      id: "cinema-door-review",
      roomId: "hall",
      label: "走廊 · 隐蔽门",
      position: [5.8, 1.55, 3.25],
      target: [4.8, 1.15, 2.8],
      horizontalFov: 78,
    },
  );
  return model;
}
/** Pick the finish for a single physical wall face; adjacent rooms stay independent. */
export function wallColour(room: string | undefined, wallId: string) {
  if (room === "guest")
    return wallId === "guest-west"
      ? roomPalette.cinemaFront
      : roomPalette.cinema;
  if (room === "bar" && wallId === "north") return "#cec4b2";
  if (room === "bar" && wallId === "west-left") return roomPalette.moss;
  if (room === "master") return wallId === "east" ? roomPalette.masterSage : roomPalette.masterMushroom;
  if (room === "living")
    return wallId === "balcony-west" ? roomPalette.tobacco : roomPalette.oat;
  return roomPalette.paper;
}
