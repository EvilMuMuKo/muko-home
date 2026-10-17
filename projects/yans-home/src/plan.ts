export type RoomId =
  | "lift-lobby"
  | "entry"
  | "dining"
  | "living"
  | "guest"
  | "master"
  | "gaming"
  | "kitchen"
  | "bath"
  | "ensuite"
  | "balcony"
  | "utility";
export type Vec2 = [number, number];
export interface Room {
  id: RoomId;
  name: string;
  rect: [number, number, number, number];
  material: string;
  camera: [number, number, number];
  target: [number, number, number];
  spawn: Vec2;
  floorRects?: [number, number, number, number][];
}
export interface Opening {
  type: "door" | "window" | "passage";
  at: number;
  width: number;
  sill?: number;
  height?: number;
  id?: string;
  name?: string;
  hinge?: number;
  curtainSides?: number[];
  open?: boolean;
}
export interface Wall {
  id: string;
  a: Vec2;
  b: Vec2;
  outside?: boolean;
  openings?: Opening[];
}
export interface Furnishing {
  id: string;
  type: string;
  room: RoomId;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  rotation?: number;
  material?: string;
  label?: string;
}
export const HEIGHT = 2.8;
// Photograph dimensions take precedence over pixels. The 600mm discrepancy is explicit, not silently averaged.
export const assumptions = [
  {
    id: "A01",
    topic: "底边尺寸链",
    value: "2950 + 5000 + 3300 = 11250mm；右侧拓展600mm另计，初稿总包络11850mm",
    status: "PROVISIONAL",
  },
  {
    id: "A02",
    topic: "层高",
    value: "暂按2800mm；门高2200mm；待复尺",
    status: "PROVISIONAL",
  },
  {
    id: "A03",
    topic: "拓展区",
    value:
      "按用户确认并入邻接房间，外轮廓采用概念占位；拆改、结构、排水与产权条件待核",
    status: "USER_DIRECTION_SITE_UNVERIFIED",
  },
  {
    id: "A04",
    topic: "方向",
    value: "图上方为标注的南向阳台；不以图上方向默认正北，不宣称实测日照",
    status: "DRAWING_LABEL",
  },
  {
    id: "A05",
    topic: "入口改造",
    value:
      "原门区域退让成朝向玄关的收纳凹位，打开入户左侧储藏区，由其南侧新门进入次卧",
    status: "USER_CONFIRMED",
  },
];
export const shell: Vec2[] = [
  [3.95, 0.15],
  [6.75, 0.15],
  [6.75, 0.45],
  [9.9, 0.45],
  [9.9, 3.55],
  [11.25, 3.55],
  [11.25, 7.05],
  [11.85, 7.05],
  [11.85, 11.45],
  [7.95, 11.45],
  [7.95, 12.5],
  [2.95, 12.5],
  [2.95, 11.45],
  [0, 11.45],
  [0, 5.95],
  [1.65, 5.95],
  [1.65, 3.55],
  [3.95, 3.55],
];
export const rooms: Room[] = [
  {
    id: "lift-lobby",
    name: "自用电梯厅",
    rect: [1.65, 3.55, 3.95, 5.95],
    material: "stoneFloor",
    camera: [1.98, 1.5, 3.98],
    target: [3.65, 1.4, 5.05],
    spawn: [2.55, 4.45],
  },
  {
    id: "entry",
    name: "入户玄关",
    rect: [0, 5.95, 3.95, 7.77],
    floorRects: [
      [0, 5.95, 3.95, 7.05],
      [1.42, 7.05, 2.95, 7.77],
    ],
    material: "stoneFloor",
    camera: [3.44, 1.52, 6.35],
    target: [2.12, 1.45, 7.4],
    spawn: [2.55, 6.28],
  },
  {
    id: "dining",
    name: "咖啡 · 餐厅",
    rect: [3.95, 4.35, 7.95, 7.05],
    material: "stoneFloor",
    camera: [7.55, 1.5, 6.85],
    target: [4.35, 1.35, 5.65],
    spawn: [5.15, 6.2],
  },
  {
    id: "living",
    name: "客厅",
    rect: [2.95, 7.05, 7.95, 10.85],
    material: "stoneFloor",
    camera: [4.25, 1.5, 7.45],
    target: [5.9, 1.05, 9.4],
    spawn: [7.2, 8.15],
  },
  {
    id: "guest",
    name: "南次卧",
    rect: [0, 7.05, 2.95, 11.45],
    floorRects: [
      [0, 7.05, 1.42, 7.77],
      [0, 7.77, 2.95, 11.45],
    ],
    material: "floor",
    camera: [2.13, 1.5, 10.79],
    target: [0.95, 1.1, 8.85],
    spawn: [0.85, 7.75],
  },
  {
    id: "master",
    name: "主卧",
    rect: [7.95, 7.05, 11.85, 11.45],
    material: "floor",
    camera: [8.55, 1.5, 7.98],
    target: [10.8, 1.1, 10.5],
    spawn: [10.9, 9.4],
  },
  {
    id: "gaming",
    name: "电脑游戏室",
    rect: [6.75, 0.45, 9.9, 3.55],
    material: "floor",
    camera: [7.63, 1.48, 3.13],
    target: [9.45, 1.18, 1.75],
    spawn: [7.8, 2.85],
  },
  {
    id: "kitchen",
    name: "厨房",
    rect: [3.95, 1.65, 6.75, 4.35],
    material: "stoneFloor",
    camera: [6.25, 1.55, 4],
    target: [4.65, 1.1, 2.7],
    spawn: [5.55, 3.45],
  },
  {
    id: "bath",
    name: "公卫",
    rect: [8.1, 3.55, 11.25, 5.25],
    material: "tileFloor",
    camera: [8.5, 1.45, 4.8],
    target: [10.25, 1.25, 4.1],
    spawn: [8.65, 4.45],
  },
  {
    id: "ensuite",
    name: "主卫",
    rect: [9.15, 5.25, 11.25, 7.05],
    material: "tileFloor",
    camera: [9.4, 1.45, 6.65],
    target: [10.7, 1.2, 5.75],
    spawn: [9.65, 6.0],
  },
  {
    id: "balcony",
    name: "生活阳台",
    rect: [2.95, 10.85, 7.95, 12.5],
    material: "stoneFloor",
    camera: [7.4, 1.5, 11.2],
    target: [3.8, 1.1, 11.9],
    spawn: [6.5, 11.6],
  },
  {
    id: "utility",
    name: "设备平台",
    rect: [3.95, 0.15, 6.75, 1.65],
    material: "stoneFloor",
    camera: [5.08, 1.42, 1.25],
    target: [6, 1, 0.8],
    spawn: [5.1, 0.85],
  },
];
const exteriorOpenings: Record<number, Opening[]> = {
  0: [{ type: "window", at: 1.4, width: 1.8, sill: 0.9, height: 1.5 }],
  2: [{ type: "window", at: 1.575, width: 2.7, sill: 0.62, height: 1.9 }],
  3: [{ type: "window", at: 0.62, width: 0.8, sill: 0.8, height: 1.65 }],
  5: [{ type: "window", at: 0.8, width: 0.7, sill: 1.4, height: 1 }],
  7: [
    {
      type: "window",
      at: 2.775,
      width: 3.25,
      sill: 0.62,
      height: 1.85,
      curtainSides: [1],
    },
  ],
  8: [
    {
      type: "window",
      at: 1.675,
      width: 3.35,
      sill: 0.62,
      height: 1.85,
      curtainSides: [-1],
    },
  ],
  10: [{ type: "window", at: 2.5, width: 4.4, sill: 0.62, height: 1.9 }],
  12: [{ type: "window", at: 1.45, width: 2.1, sill: 0.6, height: 1.85 }],

  17: [{ type: "window", at: 0.8, width: 1.25, sill: 1.05, height: 1.4 }],
};
export const walls: Wall[] = shell.map((p, i) => ({
  id: `outer-${i}`,
  a: p,
  b: shell[(i + 1) % shell.length],
  outside: true,
  openings: exteriorOpenings[i] ?? [],
}));
walls.push(
  {
    id: "entry-divider",
    a: [1.65, 5.95],
    b: [3.95, 5.95],
    openings: [
      {
        type: "door",
        at: 0.9,
        width: 0.95,
        id: "entry-door",
        name: "入户门",
        open: true,
      },
    ],
  },
  { id: "private-lobby-right", a: [3.95, 3.55], b: [3.95, 5.95] },
  {
    id: "guest-north",
    a: [0, 7.05],
    b: [1.42, 7.05],
    openings: [
      {
        type: "door",
        at: 0.87,
        width: 0.88,
        id: "guest-door",
        name: "南次卧新门",
        open: true,
      },
    ],
  },
  { id: "guest-niche-return", a: [1.42, 7.05], b: [1.42, 7.77] },
  { id: "guest-niche-back", a: [1.42, 7.77], b: [2.95, 7.77] },
  { id: "guest-east", a: [2.95, 7.05], b: [2.95, 11.45] },
  {
    id: "kitchen-north",
    a: [3.95, 1.65],
    b: [6.75, 1.65],
    openings: [
      {
        type: "door",
        at: 1.15,
        width: 0.85,
        id: "utility-door",
        name: "设备平台门",
        open: true,
      },
    ],
  },
  { id: "kitchen-east", a: [6.75, 1.65], b: [6.75, 4.35] },
  {
    id: "kitchen-dining",
    a: [3.95, 4.35],
    b: [6.75, 4.35],
    openings: [
      {
        type: "door",
        at: 1.9,
        width: 1.05,
        id: "kitchen-door",
        name: "厨房玻璃门",
        open: true,
      },
    ],
  },
  { id: "gaming-west-extension", a: [6.75, 0.45], b: [6.75, 1.65] },
  {
    id: "gaming-south",
    a: [6.75, 3.55],
    b: [8.1, 3.55],
    openings: [
      {
        type: "door",
        at: 0.64,
        width: 0.86,
        id: "gaming-door",
        name: "游戏室门",
        open: true,
      },
    ],
  },
  { id: "bath-north", a: [8.1, 3.55], b: [11.25, 3.55] },
  {
    id: "bath-west",
    a: [8.1, 3.55],
    b: [8.1, 5.25],
    openings: [
      {
        type: "door",
        at: 0.92,
        width: 0.82,
        id: "bath-door",
        name: "公卫门",
        open: true,
      },
    ],
  },
  { id: "bath-divider", a: [8.1, 5.25], b: [11.25, 5.25] },
  {
    id: "ensuite-west",
    a: [9.15, 5.25],
    b: [9.15, 7.05],
    openings: [
      {
        type: "door",
        at: 0.75,
        width: 0.8,
        id: "ensuite-door",
        name: "主卫门",
        open: true,
      },
    ],
  },
  {
    id: "master-vestibule",
    a: [7.95, 5.25],
    b: [7.95, 7.05],
    openings: [
      {
        type: "door",
        at: 1,
        width: 0.9,
        id: "master-door",
        name: "主卧套间门",
        open: true,
      },
    ],
  },
  { id: "master-west", a: [7.95, 7.05], b: [7.95, 11.45] },
  {
    id: "master-north",
    a: [7.95, 7.05],
    b: [11.85, 7.05],
    openings: [{ type: "passage", at: 0.6, width: 1.02 }],
  },
  { id: "coffee-back", a: [3.95, 5.95], b: [3.95, 6.45] },
);
const f = (
  id: string,
  type: string,
  room: RoomId,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  rotation = 0,
  material?: string,
  label?: string,
): Furnishing => ({ id, type, room, x, z, w, d, h, rotation, material, label });
export const furniture: Furnishing[] = [
  f(
    "lobby-bike-wall",
    "bike-wall",
    "lift-lobby",
    3.66,
    4.74,
    2.2,
    0.36,
    2.76,
    -90,
    undefined,
    "电梯厅通顶柜与公路车展示",
  ),
  f(
    "entry-niche",
    "entry-niche",
    "entry",
    2.185,
    7.37,
    1.37,
    0.62,
    2.76,
    180,
    "paint",
    "玄关凹位顶柜 · 洞洞板 · 鞋柜",
  ),
  f(
    "lobby-low-cabinet",
    "low-cabinet",
    "lift-lobby",
    1.91,
    4.5,
    0.95,
    0.32,
    0.72,
    90,
    "paint",
    "电梯厅矮柜",
  ),

  f(
    "coffee-island",
    "coffee",
    "dining",
    4.36,
    5.4,
    2.1,
    0.74,
    0.93,
    90,
    undefined,
    "咖啡柜岛",
  ),
  f(
    "coffee-upper",
    "cabinet",
    "dining",
    4.19,
    5.4,
    2.08,
    0.37,
    1.14,
    90,
    "paint",
    "咖啡通顶上柜",
  ),
  f("dining-table", "table", "dining", 6.35, 5.95, 1.5, 0.85, 0.75),
  f("dining-chair-1", "chair", "dining", 6.05, 5.14, 0.55, 0.58, 0.8, 180),
  f("dining-chair-2", "chair", "dining", 6.65, 6.76, 0.55, 0.58, 0.8),
  f(
    "living-library",
    "media",
    "living",
    3.21,
    9.05,
    3.4,
    0.42,
    2.76,
    90,
    undefined,
    "客厅通顶储物与电视墙",
  ),
  f("central-sofa", "sofa", "living", 5.9, 9.18, 2.55, 1.0, 0.79, 90),
  f("sofa-side", "side", "living", 5.7, 7.58, 0.44, 0.44, 0.48),
  f("living-lamp", "lamp", "living", 7.35, 10.35, 0.42, 0.42, 1.55),
  f("living-plant", "plant", "living", 3.6, 10.4, 0.42, 0.42, 1.2),
  f(
    "master-wardrobe",
    "cabinet",
    "master",
    10.45,
    7.39,
    2.6,
    0.6,
    2.76,
    0,
    "paint",
    "主卧通顶衣柜",
  ),
  f("master-bed", "bed", "master", 9.35, 9.3, 1.8, 2.12, 1.13, 90),
  f("master-side-1", "side", "master", 8.32, 8.04, 0.3, 0.35, 0.46),
  f("master-side-2", "side", "master", 8.32, 10.55, 0.3, 0.35, 0.46),
  f("master-window-seat", "bench", "master", 10.5, 11.13, 1.7, 0.46, 0.45),
  f("guest-bed", "bed", "guest", 0.85, 9.45, 1.5, 2.04, 1.1),
  f("guest-window-seat", "bench", "guest", 1.25, 11.21, 2.1, 0.26, 0.45),
  f(
    "gaming-desk",
    "desk",
    "gaming",
    9.42,
    1.95,
    2.82,
    0.75,
    0.75,
    -90,
    undefined,
    "单机位电脑桌",
  ),
  f("gaming-chair", "office-chair", "gaming", 8.45, 2.55, 0.67, 0.68, 1.2, -90),
  f(
    "gaming-library",
    "cabinet",
    "gaming",
    7.0,
    1.9,
    2.55,
    0.3,
    2.76,
    90,
    "paint",
    "游戏室书物柜",
  ),
  f(
    "kitchen-west",
    "kitchen",
    "kitchen",
    4.31,
    2.52,
    1.6,
    0.62,
    0.91,
    90,
    undefined,
    "备餐与水槽",
  ),
  f(
    "kitchen-east",
    "kitchen",
    "kitchen",
    6.41,
    2.77,
    2.06,
    0.62,
    0.91,
    -90,
    undefined,
    "烹饪台",
  ),
  f(
    "kitchen-upper",
    "cabinet",
    "kitchen",
    6.49,
    2.1,
    0.7,
    0.4,
    1.05,
    -90,
    "paint",
    "厨房上柜",
  ),
  f("fridge", "fridge", "kitchen", 4.38, 3.85, 0.78, 0.7, 1.95, 90),
  f("bath-vanity", "vanity", "bath", 8.65, 3.8, 0.85, 0.35, 0.86),
  f("bath-wc", "toilet", "bath", 9.62, 3.97, 0.4, 0.68, 0.75),
  f("bath-shower", "shower", "bath", 10.59, 4.4, 1.1, 1.35, 2.3),
  f("suite-vanity", "vanity", "ensuite", 9.7, 5.51, 0.78, 0.3, 0.86),
  f("suite-wc", "toilet", "ensuite", 9.68, 6.65, 0.4, 0.64, 0.75, 180),
  f("suite-shower", "shower", "ensuite", 10.62, 6.15, 0.96, 1.55, 2.3),
  f("laundry", "laundry", "balcony", 3.6, 11.91, 0.72, 0.68, 1.82, 90),
  f(
    "laundry-cabinet",
    "cabinet",
    "balcony",
    3.6,
    11.9,
    0.76,
    0.72,
    0.74,
    90,
    "paint",
    "洗烘顶柜",
  ),
  f("balcony-plant", "plant", "balcony", 7.45, 12.0, 0.5, 0.5, 1.3),
  f(
    "living-back",
    "cabinet",
    "living",
    7.72,
    8.65,
    2.8,
    0.3,
    2.76,
    -90,
    "paint",
    "沙发后浅柜与展示凹位",
  ),
  f(
    "guest-east-wardrobe",
    "cabinet",
    "guest",
    2.6,
    9.55,
    1.8,
    0.55,
    2.76,
    -90,
    "paint",
    "南次卧通顶衣柜",
  ),
  f(
    "lobby-upper",
    "cabinet",
    "lift-lobby",
    1.91,
    4.5,
    0.95,
    0.32,
    0.71,
    90,
    "paint",
    "电梯厅上柜",
  ),
  f(
    "gaming-upper",
    "cabinet",
    "gaming",
    9.67,
    2.43,
    1.78,
    0.26,
    0.46,
    -90,
    "paint",
    "电脑桌实体墙段上柜",
  ),
  f(
    "fridge-upper",
    "cabinet",
    "kitchen",
    4.38,
    3.85,
    0.78,
    0.6,
    0.68,
    90,
    "paint",
    "冰箱通风缝上方顶柜",
  ),
  f(
    "kitchen-upper-south",
    "cabinet",
    "kitchen",
    6.49,
    3.56,
    0.52,
    0.4,
    1.05,
    -90,
    "paint",
    "烟机旁上柜",
  ),
  f(
    "bath-wc-upper",
    "cabinet",
    "bath",
    9.62,
    3.74,
    0.62,
    0.18,
    1.18,
    0,
    "paint",
    "公卫马桶上柜",
  ),
  f(
    "suite-wc-upper",
    "cabinet",
    "ensuite",
    9.68,
    6.88,
    0.62,
    0.18,
    1.18,
    180,
    "paint",
    "主卫马桶上柜",
  ),
  f(
    "bath-vanity-upper",
    "cabinet",
    "bath",
    8.65,
    3.72,
    0.85,
    0.16,
    0.64,
    0,
    "paint",
    "公卫镜柜顶柜",
  ),
  f(
    "suite-vanity-upper",
    "cabinet",
    "ensuite",
    9.7,
    5.43,
    0.78,
    0.16,
    0.64,
    0,
    "paint",
    "主卫镜柜顶柜",
  ),
  f("utility-ac", "ac", "utility", 6.25, 0.85, 0.55, 1.0, 0.85),
];
export const cabinetBases: Record<string, number> = {
  "coffee-upper": 1.62,
  "kitchen-upper": 1.71,
  "laundry-cabinet": 2.02,
  "lobby-upper": 2.05,
  "gaming-upper": 2.3,
  "fridge-upper": 2.08,
  "kitchen-upper-south": 1.71,
  "bath-wc-upper": 1.58,
  "suite-wc-upper": 1.58,
  "bath-vanity-upper": 2.12,
  "suite-vanity-upper": 2.12,
};
export const cabinetBottom = (id: string) => cabinetBases[id] ?? 0;
export const model = {
  name: "YAN’s Home",
  version: "1.2.0",
  source: "用户户型照片与确认的改造要求",
  units: "m",
  height: HEIGHT,
  shell,
  rooms,
  walls,
  furniture,
  cabinetBases,
  assumptions,
  requirements: {
    occupants: 2,
    designDirection: "italian-minimal-greige-charcoal",
    guestWardrobe: "east-wall-with-reoriented-bed",
    livingBackStorage: "full-height-300mm-shallow",
    guestEntry: "via-opened-entry-storage",
    oldGuestDoor: "recessed-entry-storage",
    extensions: "incorporated",
    gamingStations: 1,
    gamingBalcony: "fully-incorporated",
    entryStorage: "recessed-upper-pegboard-shoe-cabinet",
    masterWindow: "continuous-corner",
    laundryFront: "clear",
    consoleGaming: false,
    master: "sleep",
    coffee: "coffee-only-upper-cabinets-and-island",
    joysticks: "floating-per-touch-half-screen",
    privateElevatorLobby: true,
    wallMountedBike: "road-bike-on-pegboard",
  },
};
export function insideShell(x: number, z: number) {
  let inside = false;
  for (let i = 0, j = shell.length - 1; i < shell.length; j = i++) {
    const a = shell[i],
      b = shell[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function roomAt(x: number, z: number): RoomId {
  if (x > 1.65 && x < 3.95 && z > 3.55 && z < 5.95) return "lift-lobby";
  if (x > 1.42 && x < 2.95 && z > 7.05 && z < 7.77) return "entry";
  if (x > 7.95 && x < 9.15 && z > 5.25 && z < 7.05) return "master";
  if (x > 6.75 && x < 8.1 && z > 3.55 && z < 5.25) return "dining";
  for (const r of rooms) {
    for (const [a, b, c, d] of r.floorRects ?? [r.rect])
      if (x > a && x < c && z > b && z < d) return r.id;
  }
  return "entry";
}
