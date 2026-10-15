export type DoorStyle = "solid" | "open" | "glass" | "mirror";
export interface StorageUnit {
  id: string;
  type: "wall_storage";
  room: string;
  label: string;
  x: number;
  z: number;
  y: number;
  w: number;
  d: number;
  h: number;
  rotation: number;
  fronts: DoorStyle[];
  shelves: number[];
  purpose: string;
  access: "mixed" | "seasonal";
  material: string;
  contents?: "books" | "cups" | "boxes";
  hangingGlasses?: boolean;
  caseMaterial?: string;
  insideMaterial?: string;
  concealedDisplay?: boolean;
}
interface BaseObject {
  id: string;
  type: string;
  room?: string;
  [key: string]: unknown;
}
interface Fixture {
  id: string;
  position: number[];
  target: number[];
  anchor?: string | null;
  [key: string]: unknown;
}
export interface DesignInput {
  version: string;
  objects: BaseObject[];
  lighting: { fixtures: Fixture[]; [key: string]: unknown };
  presentation: {
    interiorViews: {
      id: string;
      roomId: string;
      label: string;
      position: number[];
      target: number[];
      horizontalFov: number;
    }[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
const unit = (
  id: string,
  room: string,
  label: string,
  x: number,
  z: number,
  y: number,
  w: number,
  d: number,
  h: number,
  rotation: number,
  fronts: DoorStyle[],
  purpose: string,
  access: "mixed" | "seasonal" = "mixed",
  contents?: StorageUnit["contents"],
): StorageUnit => ({
  id,
  type: "wall_storage",
  room,
  label,
  x,
  z,
  y,
  w,
  d,
  h,
  rotation,
  fronts,
  shelves: h > 0.65 ? [h * 0.48] : [],
  purpose,
  access,
  contents,
  material: "upperPaint",
});
export const upperStorage: StorageUnit[] = [
  unit(
    "upper-kitchen-left",
    "kitchen",
    "灶台左侧吊柜",
    0.475,
    3.66,
    1.6,
    0.65,
    0.32,
    1,
    180,
    ["solid"],
    "调味与轻餐具",
  ),
  unit(
    "upper-kitchen-prep",
    "kitchen",
    "备餐区吊柜",
    2.275,
    3.66,
    1.6,
    1.15,
    0.32,
    1,
    180,
    ["solid", "solid"],
    "备餐用品与食品",
  ),
  unit(
    "upper-kitchen-sink",
    "kitchen",
    "水槽上方吊柜",
    0.27,
    4.66,
    1.6,
    1.08,
    0.32,
    1,
    90,
    ["solid", "solid"],
    "杯具、清洁耗材",
  ),
  unit(
    "upper-fridge",
    "kitchen",
    "冰箱顶柜",
    4.25,
    4.05,
    2.12,
    0.74,
    0.86,
    0.48,
    -90,
    ["solid"],
    "低频厨房用品",
    "seasonal",
  ),
  unit(
    "upper-bar-coffee",
    "bar",
    "咖啡与备餐上柜",
    1.5,
    8.18,
    1.78,
    2.7,
    0.3,
    0.82,
    0,
    ["solid", "open", "solid"],
    "咖啡耗材、手冲与杯具",
    "mixed",
    "cups",
  ),
  {
    ...unit(
      "upper-bar-display",
      "bar",
      "杯酒展示柜",
      3.7,
      8.15,
      1.7,
      1.24,
      0.34,
      0.9,
      0,
      ["glass", "glass"],
      "酒瓶、收藏杯具",
    ),
    shelves: [0.34, 0.68],
    hangingGlasses: true,
  },
  unit(
    "upper-bar-service",
    "bar",
    "水吧服务吊柜",
    4.65,
    8.18,
    1.78,
    0.6,
    0.3,
    0.82,
    0,
    ["solid"],
    "餐桌用品与备品",
  ),
  unit(
    "upper-master-work",
    "master",
    "双人工作区收纳",
    9.2,
    4.11,
    1.65,
    2.6,
    0.35,
    0.95,
    0,
    ["solid", "open", "solid"],
    "文件、设备配件与书籍",
    "mixed",
    "books",
  ),
  unit(
    "upper-master-wardrobe",
    "master",
    "主卧衣柜顶柜",
    7.3,
    1,
    2.37,
    1.68,
    0.6,
    0.23,
    90,
    ["solid", "solid", "solid"],
    "薄型低频收纳盒",
    "seasonal",
  ),
  unit(
    "upper-master-bed-left",
    "master",
    "床头左侧浅柜",
    8.23,
    0.24,
    1.86,
    0.54,
    0.26,
    0.74,
    180,
    ["solid"],
    "轻型个人用品",
  ),
  unit(
    "upper-master-bed-right",
    "master",
    "床头右侧浅柜",
    10.79,
    0.24,
    1.86,
    0.54,
    0.26,
    0.74,
    180,
    ["open"],
    "轻型展示与书籍",
    "mixed",
    "books",
  ),
  unit(
    "upper-guest-media",
    "guest",
    "影音客房收纳墙",
    1.75,
    3.13,
    1.83,
    2.8,
    0.3,
    0.77,
    0,
    ["solid", "open", "solid"],
    "客用备品、影音与展示",
    "mixed",
    "books",
  ),
  unit(
    "upper-guest-wardrobe",
    "guest",
    "客房衣柜顶柜",
    4.3,
    1.25,
    2.22,
    1.65,
    0.58,
    0.38,
    -90,
    ["solid", "solid", "solid"],
    "客用织物与低频用品",
    "seasonal",
  ),
  unit(
    "upper-guest-bed-left",
    "guest",
    "沙发床左侧浅柜",
    0.94,
    0.24,
    1.86,
    0.56,
    0.26,
    0.74,
    180,
    ["open"],
    "阅读与小件展示",
    "mixed",
    "books",
  ),
  unit(
    "upper-guest-bed-right",
    "guest",
    "沙发床右侧浅柜",
    3.16,
    0.24,
    1.86,
    0.56,
    0.26,
    0.74,
    180,
    ["solid"],
    "轻型客用备品",
  ),
  unit(
    "upper-living-media",
    "living",
    "客厅影音上柜",
    9.325,
    4.64,
    1.95,
    2.55,
    0.3,
    0.65,
    180,
    ["solid", "open", "solid"],
    "影音配件与轻型展示",
    "mixed",
    "boxes",
  ),
  unit(
    "upper-living-side",
    "living",
    "电视侧展示柜",
    10.925,
    4.64,
    1.6,
    0.55,
    0.3,
    1,
    180,
    ["glass"],
    "收藏与展示",
    "mixed",
    "books",
  ),
  unit(
    "upper-living-rear",
    "living",
    "客厅后墙上柜",
    9.6,
    9.09,
    1.55,
    1.6,
    0.32,
    1.05,
    0,
    ["solid", "open", "solid"],
    "生活用品、书籍与收藏",
    "mixed",
    "books",
  ),
  unit(
    "upper-entry",
    "hall",
    "玄关高位收纳",
    7.1,
    8.18,
    2.02,
    1.3,
    0.32,
    0.58,
    0,
    ["solid", "solid"],
    "低频出行与家庭备品",
    "seasonal",
  ),
  unit(
    "upper-entry-display",
    "hall",
    "玄关随手展示",
    7.3,
    8.25,
    1.35,
    0.9,
    0.18,
    0.38,
    0,
    ["open"],
    "钥匙、随手物品与展示",
    "mixed",
    "boxes",
  ),
  unit(
    "upper-bath-mirror",
    "bath",
    "洗手台镜柜",
    4.99,
    0.55,
    1.16,
    0.6,
    0.18,
    1.12,
    90,
    ["mirror"],
    "日用洗护用品",
  ),
  unit(
    "upper-bath-toilet",
    "bath",
    "马桶上方浅柜",
    5.01,
    1.22,
    1.52,
    0.52,
    0.22,
    1.04,
    90,
    ["solid"],
    "纸品与清洁备品",
  ),
  unit(
    "upper-laundry",
    "balcony",
    "洗烘机顶柜",
    12.25,
    4.8,
    1.96,
    0.68,
    0.6,
    0.64,
    180,
    ["solid"],
    "洗衣用品与备品",
  ),
  unit(
    "upper-housekeeping",
    "balcony",
    "家政柜顶柜",
    12.25,
    8.93,
    2.32,
    0.62,
    0.65,
    0.28,
    0,
    ["solid"],
    "轻型家务备品",
    "seasonal",
  ),
];
export function storageCapacity(units = upperStorage) {
  const thickness = 0.018;
  const items = units.map((u) => {
    const bayWidth =
      (u.w - (u.fronts.length + 1) * thickness) / u.fronts.length;
    const clearHeight = u.h - 2 * thickness - u.shelves.length * thickness;
    const depth = u.d - 2 * thickness;
    const litres = Math.max(0, bayWidth * clearHeight * depth * 1000);
    return {
      id: u.id,
      room: u.room,
      label: u.label,
      purpose: u.purpose,
      access: u.access,
      closedLitres: litres * u.fronts.filter((f) => f !== "open").length,
      displayLitres: litres * u.fronts.filter((f) => f === "open").length,
      external: [u.w, u.h, u.d],
      bottom: u.y,
      top: u.y + u.h,
      fronts: u.fronts,
    };
  });
  return {
    method:
      "按模型内空尺寸扣除18mm板厚、分隔、层板与门板；未扣实际五金/管线/通风净空，非施工或承重认证",
    units: items,
    closedLitres: items.reduce((s, u) => s + u.closedLitres, 0),
    displayLitres: items.reduce((s, u) => s + u.displayLitres, 0),
  };
}
export function createStorageDesign<T extends DesignInput>(base: T): T {
  const model = structuredClone(base);
  const replaced = new Set([
    "s02-open-ceiling-frame",
    "s02-suspended-three-tier",
    "guest-top-storage",
    "living-side-upper",
    "bath-mirror",
  ]);
  model.objects = model.objects.filter((o) => !replaced.has(o.id));
  model.objects.push(...upperStorage.map((u) => ({ ...u })));
  model.version = "6.0.0";
  const adjust: Record<
    string,
    { position?: number[]; target?: number[]; anchor?: string }
  > = {
    "bar-task": {
      position: [1.5, 1.765, 8.25],
      target: [1.5, 0.96, 7.95],
      anchor: "upper-bar-coffee",
    },
    "display-level-1": {
      position: [3.7, 2.025, 8.22],
      anchor: "upper-bar-display",
    },
    "display-level-2": {
      position: [3.7, 2.365, 8.22],
      anchor: "upper-bar-display",
    },
    "display-level-3": {
      position: [3.7, 2.575, 8.22],
      anchor: "upper-bar-display",
    },
    "kitchen-prep-profile": {
      position: [2.275, 1.585, 3.79],
      anchor: "upper-kitchen-prep",
    },
    "kitchen-sink-task": {
      position: [0.4, 1.585, 4.7],
      anchor: "upper-kitchen-sink",
    },
    "pc-desk-task": {
      position: [8.45, 1.635, 4.02],
      target: [8.45, 0.78, 3.94],
      anchor: "upper-master-work",
    },
    "mac-desk-task": {
      position: [9.75, 1.635, 4.02],
      target: [9.75, 0.78, 3.94],
      anchor: "upper-master-work",
    },
    "bath-mirror-side-1": {
      position: [5.13, 1.72, 0.19],
      anchor: "upper-bath-mirror",
    },
    "bath-mirror-side-2": {
      position: [5.13, 1.72, 0.91],
      anchor: "upper-bath-mirror",
    },
    "living-wall-cove": {
      position: [9.3, 2.64, 4.67],
      anchor: "upper-living-media",
    },
    "balcony-laundry": {
      position: [12.25, 1.93, 5.08],
      target: [12.25, 1, 5.4],
      anchor: "upper-laundry",
    },
  };
  model.lighting.fixtures = model.lighting.fixtures.map((f) => ({
    ...f,
    ...adjust[f.id],
    ...(["pc-desk-task", "mac-desk-task"].includes(f.id)
      ? { support: undefined }
      : {}),
  }));
  model.lighting.fixtures.push(
    {
      id: "storage-living-task",
      roomId: "living",
      spaceIds: ["living"],
      position: [9.6, 1.535, 9.06],
      target: [9.6, 0.82, 9.04],
      group: "decor",
      kelvin: 3000,
      lumens: 320,
      type: "line",
      length: 1.42,
      axis: "x",
      beamAngle: 100,
      range: 1.5,
      shadowPriority: 0,
      anchor: "upper-living-rear",
    },
    {
      id: "storage-guest-task",
      roomId: "guest",
      spaceIds: ["guest"],
      position: [1.75, 1.815, 3.18],
      target: [1.75, 0.5, 3.13],
      group: "decor",
      kelvin: 3000,
      lumens: 240,
      type: "line",
      length: 2.35,
      axis: "x",
      beamAngle: 100,
      range: 1.5,
      shadowPriority: 0,
      anchor: "upper-guest-media",
    },
    {
      id: "storage-entry-task",
      roomId: "hall",
      spaceIds: ["hall"],
      position: [7.3, 1.745, 8.25],
      target: [7.3, 1.12, 8.17],
      group: "decor",
      kelvin: 3000,
      lumens: 150,
      type: "line",
      length: 0.76,
      axis: "x",
      beamAngle: 100,
      range: 1,
      shadowPriority: 0,
      anchor: "upper-entry-display",
    },
  );
  model.presentation.interiorViews.push(
    {
      id: "kitchen-upper-review",
      roomId: "kitchen",
      label: "厨房上柜",
      position: [2.9, 1.72, 4.9],
      target: [1.5, 1.95, 3.7],
      horizontalFov: 96,
    },
    {
      id: "bath-upper-review",
      roomId: "bath",
      label: "卫浴镜柜与储物",
      position: [5.75, 1.6, 0.88],
      target: [5.0, 1.85, 0.85],
      horizontalFov: 92,
    },
    {
      id: "laundry-upper-review",
      roomId: "balcony",
      label: "洗烘机顶柜",
      position: [12.25, 1.7, 6.25],
      target: [12.25, 2.03, 4.82],
      horizontalFov: 74,
    },
    {
      id: "housekeeping-upper-review",
      roomId: "balcony",
      label: "家政柜顶柜",
      position: [12.25, 1.7, 7.95],
      target: [12.25, 2.05, 8.93],
      horizontalFov: 74,
    },
    {
      id: "master-upper-review",
      roomId: "master",
      label: "工作区上柜",
      position: [9.2, 1.75, 2.65],
      target: [9.2, 2.05, 4.1],
      horizontalFov: 86,
    },
    {
      id: "guest-upper-review",
      roomId: "guest",
      label: "影音收纳墙",
      position: [1.75, 1.65, 1.05],
      target: [1.75, 2.02, 3.13],
      horizontalFov: 84,
    },
    {
      id: "living-upper-review",
      roomId: "living",
      label: "后墙收纳与展示",
      position: [9.55, 1.68, 7.75],
      target: [9.6, 2.03, 9.09],
      horizontalFov: 84,
    },
    {
      id: "bar-upper-review",
      roomId: "bar",
      label: "水吧上柜与展示",
      position: [2.65, 1.7, 6.35],
      target: [2.65, 2.0, 8.17],
      horizontalFov: 100,
    },
    {
      id: "hall-storage-review",
      roomId: "hall",
      label: "玄关收纳",
      position: [6.85, 1.65, 6.65],
      target: [7.1, 1.9, 8.2],
      horizontalFov: 76,
    },
  );
  return model;
}
