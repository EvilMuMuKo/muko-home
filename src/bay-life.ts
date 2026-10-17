import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { metricUV } from "./texture-mapping";

/**
 * Removable bay-life dressing. Structural sill, projection, glazing and floor
 * stay in home-mesh. Geometry is added only when a bay carries `r3Use`.
 *
 * Defaults assume the r3 envelope: sill 0.6 m, projection 0.75 m, width 2.1 m,
 * head 2.35 m. Board heights are rises above that reference sill, so a bay
 * whose sill field differs still grounds the rack on the real sill.
 *
 * The tray anchor is cx+dx*0.28, cz-0.65. That anchor intersects the 1.3 m
 * cushion, so the built tray is shifted along -Z until a 12 mm gap remains
 * and it still sits inside the bay width. Returned centers are the built ones.
 */
export const bayLifeDefaults = {
  role: "raised_ledge_perch",
  label: "可取下的窗台薄垫、小托盘与侧向三层板",
  referenceSillM: 0.6,
  cushion: {
    projectionM: 0.5,
    alongM: 1.3,
    heightM: 0.035,
    xFactor: 0.34,
    zOffset: -0.1,
    material: "linen",
  },
  tray: {
    projectionM: 0.28,
    alongM: 0.28,
    heightM: 0.025,
    xFactor: 0.28,
    zOffset: -0.65,
    material: "salonTimber",
  },
  rack: {
    xFactor: 0.3,
    alongX: 0.4,
    insetFromSide: 0.12,
    depthZ: 0.18,
    /** World heights when sill is referenceSillM. */
    boardBottoms: [0.88, 1.2, 1.52],
    boardThickness: 0.018,
    backThickness: 0.008,
    boardMaterial: "salonTimber",
    backMaterial: "cabinetInterior",
    bracketMaterial: "bronze",
  },
  books: {
    count: 3,
    materials: ["bookClay", "bookSage", "bookCream"] as const,
    sizes: [
      [0.028, 0.16, 0.11],
      [0.032, 0.145, 0.1],
      [0.026, 0.17, 0.105],
    ] as [number, number, number][],
  },
  gapM: 0.012,
};

export interface BayLifeSizeOverride {
  projectionM?: number;
  alongM?: number;
  heightM?: number;
  xFactor?: number;
  zOffset?: number;
  material?: string;
}

export interface BayLifeUseConfig {
  role?: string;
  label?: string;
  /** +1 guest side, -1 master side, along the window. */
  sideSign?: number;
  components?: {
    cushion?: BayLifeSizeOverride;
    tray?: BayLifeSizeOverride;
    rack?: {
      xFactor?: number;
      alongX?: number;
      insetFromSide?: number;
      depthZ?: number;
      boardBottoms?: number[];
      boardThickness?: number;
    };
    bookCount?: number;
  };
}

interface BayWindow {
  roomId: string;
  windowId?: string;
  center?: number[];
  outward?: number[];
  widthM?: number;
  projectionM?: number;
  sillHeightM?: number;
  headHeightM?: number;
  r3Use?: boolean | BayLifeUseConfig;
}

export interface BayLifePiece {
  id: string;
  kind: string;
  material: string;
  /** Size along world X, Y, Z in metres. */
  size: [number, number, number];
  /** World-space centre. */
  center: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
}

export interface BayLifeDiagnostic {
  roomId: string;
  group: string;
  role: string;
  label: string;
  sideSign: number;
  sillHeightM: number;
  projectionM: number;
  widthM: number;
  headHeightM: number;
  components: BayLifePiece[];
}

type Materials = Record<string, THREE.Material | undefined>;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function pickMaterial(materials: Materials, name: string) {
  if (materials[name]) return materials[name]!;
  for (const key of ["salonTimber", "oak", "linen", "plaster", "bronze"]) {
    if (materials[key]) return materials[key]!;
  }
  const first = Object.values(materials).find((m): m is THREE.Material => !!m);
  return (
    first ??
    new THREE.MeshStandardMaterial({ color: "#c8bfb2", roughness: 0.8 })
  );
}

function piece(
  id: string,
  kind: string,
  material: string,
  size: [number, number, number],
  center: [number, number, number],
): BayLifePiece {
  const min = size.map((s, i) => center[i] - s / 2) as [number, number, number];
  const max = size.map((s, i) => center[i] + s / 2) as [number, number, number];
  return { id, kind, material, size, center, min, max };
}

function overlapsZ(a: BayLifePiece, b: BayLifePiece) {
  return a.min[2] < b.max[2] && b.min[2] < a.max[2];
}

/** Keep the tray on the sill, beside the cushion, inside the bay width. */
function placeTray(
  anchor: BayLifePiece,
  cushion: BayLifePiece,
  cz: number,
  halfWidth: number,
): BayLifePiece {
  const gap = bayLifeDefaults.gapM;
  let z = anchor.center[2];
  if (overlapsZ(anchor, cushion)) {
    const toward = anchor.center[2] <= cushion.center[2] ? -1 : 1;
    z =
      toward < 0
        ? cushion.min[2] - gap - anchor.size[2] / 2
        : cushion.max[2] + gap + anchor.size[2] / 2;
  }
  const limit = Math.max(0, halfWidth - anchor.size[2] / 2 - 0.004);
  z = clamp(z, cz - limit, cz + limit);
  if (
    z + anchor.size[2] / 2 > cushion.min[2] - gap &&
    z - anchor.size[2] / 2 < cushion.max[2] + gap
  ) {
    const roomNeg = cushion.min[2] - gap - (cz - limit);
    const roomPos = cz + limit - (cushion.max[2] + gap);
    if (roomPos >= anchor.size[2] && roomPos >= roomNeg)
      z = cushion.max[2] + gap + anchor.size[2] / 2;
    else if (roomNeg >= anchor.size[2])
      z = cushion.min[2] - gap - anchor.size[2] / 2;
    else {
      const along = Math.max(0.08, Math.max(roomNeg, roomPos) - 0.004);
      const centerZ =
        roomNeg >= roomPos
          ? cushion.min[2] - gap - along / 2
          : cushion.max[2] + gap + along / 2;
      return piece(
        anchor.id,
        anchor.kind,
        anchor.material,
        [anchor.size[0], anchor.size[1], along],
        [
          anchor.center[0],
          anchor.center[1],
          clamp(
            centerZ,
            cz - (halfWidth - along / 2 - 0.004),
            cz + (halfWidth - along / 2 - 0.004),
          ),
        ],
      );
    }
  }
  return piece(anchor.id, anchor.kind, anchor.material, anchor.size, [
    anchor.center[0],
    anchor.center[1],
    z,
  ]);
}

function addPiece(
  group: THREE.Group,
  materials: Materials,
  item: BayLifePiece,
  radius: number,
) {
  const [w, h, d] = item.size;
  const geo = new RoundedBoxGeometry(
    w,
    h,
    d,
    2,
    Math.min(radius, w / 3, h / 3, d / 3),
  );
  metricUV(
    geo,
    /timber|oak|book/i.test(item.material) ? "horizontal" : undefined,
  );
  const mesh = new THREE.Mesh(geo, pickMaterial(materials, item.material));
  mesh.name = item.id;
  mesh.position.set(item.center[0], item.center[1], item.center[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    removable: true,
    kind: item.kind,
    material: item.material,
    size: item.size,
  };
  group.add(mesh);
}

function lifePieces(bay: BayWindow, config: BayLifeUseConfig): BayLifePiece[] {
  const d = bayLifeDefaults;
  const c = config.components ?? {};
  const sill = bay.sillHeightM ?? d.referenceSillM;
  const projection = bay.projectionM ?? 0.75;
  const width = bay.widthM ?? 2.1;
  const head = bay.headHeightM ?? 2.35;
  const cx = bay.center?.[0] ?? 0;
  const cz = bay.center?.[1] ?? 0;
  const dx =
    bay.outward?.[0] === 0
      ? 1
      : Math.sign(bay.outward?.[0] ?? (bay.roomId === "guest" ? -1 : 1));
  const side = config.sideSign ?? (bay.roomId === "master" ? -1 : 1);
  const outwardLimit = projection - 0.015;

  const cushionSpec = { ...d.cushion, ...c.cushion };
  const cushionSize: [number, number, number] = [
    Math.min(cushionSpec.projectionM, outwardLimit - 0.04),
    cushionSpec.heightM,
    Math.min(cushionSpec.alongM, width - 0.08),
  ];
  let cushionX = cx + dx * cushionSpec.xFactor;
  const cushionOut = (cushionX - cx) * dx;
  const maxCenterOut = outwardLimit - cushionSize[0] / 2;
  if (cushionOut + cushionSize[0] / 2 > outwardLimit)
    cushionX = cx + dx * maxCenterOut;
  const cushion = piece(
    `bay-life:${bay.roomId}:cushion`,
    "raised-ledge-cushion",
    cushionSpec.material,
    cushionSize,
    [cushionX, sill + cushionSize[1] / 2, cz + cushionSpec.zOffset],
  );

  const traySpec = { ...d.tray, ...c.tray };
  const trayH = traySpec.heightM;
  const trayAnchor = piece(
    `bay-life:${bay.roomId}:tray`,
    "removable-tray",
    traySpec.material,
    [Math.min(traySpec.projectionM, 0.34), trayH, traySpec.alongM],
    [cx + dx * traySpec.xFactor, sill + trayH / 2, cz + traySpec.zOffset],
  );
  const tray = placeTray(trayAnchor, cushion, cz, width / 2);
  const trayOut = (tray.center[0] - cx) * dx;
  if (trayOut + tray.size[0] / 2 > outwardLimit) {
    tray.center[0] = cx + dx * (outwardLimit - tray.size[0] / 2);
    tray.min[0] = tray.center[0] - tray.size[0] / 2;
    tray.max[0] = tray.center[0] + tray.size[0] / 2;
  }

  const rackSpec = { ...d.rack, ...c.rack };
  const boardBottoms = (c.rack?.boardBottoms ?? d.rack.boardBottoms).map(
    (y) => sill + (y - d.referenceSillM),
  );
  const rackX = cx + dx * rackSpec.xFactor;
  const rackW = Math.min(rackSpec.alongX, outwardLimit - 0.02);
  const rackZ = cz + side * (width / 2 - rackSpec.insetFromSide);
  const rackD = rackSpec.depthZ;
  const backT = rackSpec.backThickness;
  const boardT = rackSpec.boardThickness;
  const usable = boardBottoms.filter(
    (y) => y >= sill - 0.001 && y + boardT <= head - 0.02,
  );
  const top = (usable[usable.length - 1] ?? sill + 0.28) + boardT;
  const backH = Math.min(head - 0.04, top + 0.02) - sill;
  const backZ = rackZ + side * (rackD / 2 - backT / 2);
  const parts: BayLifePiece[] = [
    cushion,
    tray,
    piece(
      `bay-life:${bay.roomId}:rack-back`,
      "rack-back",
      rackSpec.backMaterial,
      [rackW, backH, backT],
      [rackX, sill + backH / 2, backZ],
    ),
  ];

  const boardZ = rackZ - side * (backT / 2 + 0.004);
  const boardD = Math.max(0.08, rackD - backT - 0.012);
  usable.forEach((bottom, index) => {
    const board = piece(
      `bay-life:${bay.roomId}:board-${index}`,
      "rack-board",
      rackSpec.boardMaterial,
      [rackW - 0.028, boardT, boardD],
      [
        rackX,
        bottom + boardT / 2,
        boardZ - side * (boardD / 2 - rackD / 2 + backT + 0.004),
      ],
    );
    // Keep the board's outer edge against the back panel so the shelf is carried.
    const backInner = backZ - side * (backT / 2);
    board.center[2] = backInner - side * (boardD / 2);
    board.min[2] = board.center[2] - boardD / 2;
    board.max[2] = board.center[2] + boardD / 2;
    parts.push(board);
    for (const end of [-1, 1]) {
      parts.push(
        piece(
          `bay-life:${bay.roomId}:cleat-${index}-${end === -1 ? "a" : "b"}`,
          "rack-bracket",
          rackSpec.bracketMaterial,
          [0.016, 0.012, Math.min(0.05, boardD - 0.01)],
          [
            rackX + end * (rackW / 2 - 0.02),
            bottom - 0.006,
            board.center[2] + side * (boardD / 2 - 0.03),
          ],
        ),
      );
    }
  });

  // Two stiles from the existing sill up the back, so the rack is grounded.
  for (const end of [-1, 1]) {
    parts.push(
      piece(
        `bay-life:${bay.roomId}:stile-${end === -1 ? "a" : "b"}`,
        "rack-bracket",
        rackSpec.bracketMaterial,
        [0.014, backH, 0.012],
        [
          rackX + end * (rackW / 2 - 0.012),
          sill + backH / 2,
          backZ - side * (backT / 2 + 0.006),
        ],
      ),
    );
  }

  const bookCount = clamp(c.bookCount ?? d.books.count, 2, 3);
  const boards = parts.filter((p) => p.kind === "rack-board");
  for (let i = 0; i < bookCount && i < boards.length; i++) {
    const host = boards[i];
    const [bw, bh, bd] = d.books.sizes[i];
    const topY = host.max[1];
    parts.push(
      piece(
        `bay-life:${bay.roomId}:book-${i}`,
        "book",
        d.books.materials[i],
        [bw, bh, bd],
        [host.center[0] + (i - 1) * 0.05, topY + bh / 2, host.center[2]],
      ),
    );
  }
  return parts;
}

export function buildBayLife(
  scene: THREE.Object3D,
  model: {
    homeDesign?: { bayWindows?: BayWindow[] };
    openings?: { id?: string; center?: number[] }[];
  },
  materials: Materials,
  tag: (group: THREE.Object3D, rooms: string[], kind: string) => void,
): BayLifeDiagnostic[] {
  const reports: BayLifeDiagnostic[] = [];
  for (const bay of model.homeDesign?.bayWindows ?? []) {
    if (!bay.r3Use) continue;
    const config: BayLifeUseConfig = bay.r3Use === true ? {} : bay.r3Use;
    const opening = model.openings?.find((o) => o.id === bay.windowId);
    const resolved: BayWindow = {
      ...bay,
      center: bay.center ?? opening?.center,
    };
    const role = config.role ?? bayLifeDefaults.role;
    const label = config.label ?? bayLifeDefaults.label;
    const sideSign = config.sideSign ?? (bay.roomId === "master" ? -1 : 1);
    const components = lifePieces(resolved, {
      ...config,
      role,
      label,
      sideSign,
    });
    const group = new THREE.Group();
    group.name = `bay-life:${bay.roomId}`;
    group.userData = { removable: true, role, label, sideSign };
    tag(group, [bay.roomId], "detail");
    for (const item of components) {
      const radius =
        item.kind === "raised-ledge-cushion"
          ? 0.008
          : item.kind === "book"
            ? 0.002
            : 0.003;
      addPiece(group, materials, item, radius);
    }
    scene.add(group);
    reports.push({
      roomId: bay.roomId,
      group: group.name,
      role,
      label,
      sideSign,
      sillHeightM: bay.sillHeightM ?? bayLifeDefaults.referenceSillM,
      projectionM: bay.projectionM ?? 0.75,
      widthM: bay.widthM ?? 2.1,
      headHeightM: bay.headHeightM ?? 2.35,
      components,
    });
  }
  return reports;
}
