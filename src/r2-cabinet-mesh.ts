import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { metricUV } from "./texture-mapping";
import type { StorageDoor } from "./storage-mesh";

export type R2Bay = {
  x: number;
  w: number;
  y: number;
  h: number;
  door: "solid" | "open";
  shelves?: number[];
  purpose?: string;
  material?: string;
};

export type R2CabinetMeta = {
  bays: R2Bay[];
  frameMaterial?: string;
  frontMaterial?: string;
  backMaterial?: string;
  frame?: boolean;
  cutouts?: Array<{x:number;z:number;w:number;d:number;y0:number;y1:number}>;
  r7PullPolicy?: string;
  r7BallPulls?: Array<{bay:number;segment:number;leaf:number;color:string}>;
};

export type R2Panel = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  material: string;
  /** Closed-bay shelf; hidden until the door opens. Omitted from the public shape consumers need. */
  hide?: boolean;
  owner?: number;
};

export type R2Door = StorageDoor & { insideGroup?: THREE.Group };

const T = 0.018;
const DOOR_T = 0.018;
const GAP = 0.003;
const KICK = 0.09;
const EPS = 1e-3;

function num(v: unknown, name: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`r2 cabinet: ${name} must be a finite number`);
  return v;
}

function intervalsOverlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

function mergeTouching(spans: Array<[number, number]>): Array<[number, number]> {
  const sorted = spans
    .filter(([a, b]) => b - a > EPS)
    .sort((p, q) => p[0] - q[0]);
  const out: Array<[number, number]> = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + EPS) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

function metaOf(o: any): { W: number; D: number; H: number; meta: R2CabinetMeta } {
  if (!o || o.type !== "wall_storage" || !o.r2Cabinet) throw new Error("r2 cabinet: missing meta");
  const W = num(o.w, "w");
  const D = num(o.d, "d");
  const H = num(o.h, "h");
  if (W <= EPS || D <= EPS || H <= EPS) throw new Error("r2 cabinet: non-positive size");
  const meta = o.r2Cabinet as R2CabinetMeta;
  if (!Array.isArray(meta.bays)) throw new Error("r2 cabinet: bays required");
  const bays = meta.bays.map((bay, i) => {
    const x = num(bay.x, `bay[${i}].x`);
    const w = num(bay.w, `bay[${i}].w`);
    const y = num(bay.y, `bay[${i}].y`);
    const h = num(bay.h, `bay[${i}].h`);
    if (w <= EPS || h <= EPS) throw new Error(`r2 cabinet: bay[${i}] non-positive`);
    if (bay.door !== "solid" && bay.door !== "open") throw new Error(`r2 cabinet: bay[${i}].door`);
    const left = x - w / 2;
    const right = x + w / 2;
    if (left < -W / 2 - EPS || right > W / 2 + EPS || y < -EPS || y + h > H + EPS) {
      throw new Error(`r2 cabinet: bay[${i}] out of bounds`);
    }
    for (const shelf of bay.shelves ?? []) {
      if (typeof shelf !== "number" || shelf < -EPS || shelf > h + EPS) {
        throw new Error(`r2 cabinet: bay[${i}] shelf out of section`);
      }
    }
    return bay;
  });
  for (let i = 0; i < bays.length; i++) {
    for (let j = i + 1; j < bays.length; j++) {
      const a = bays[i];
      const b = bays[j];
      const ox = intervalsOverlap(a.x - a.w / 2, a.x + a.w / 2, b.x - b.w / 2, b.x + b.w / 2);
      const oy = intervalsOverlap(a.y, a.y + a.h, b.y, b.y + b.h);
      if (ox > EPS && oy > EPS) throw new Error("r2 cabinet: bay overlap");
    }
  }
  return { W, D, H, meta: { ...meta, bays } };
}

function panelBox(W: number, D: number, H: number): { d: number; z: number } {
  const d = Math.max(T, D - T - 0.028);
  const z = -D / 2 + 0.02 + d / 2;
  return {d,z};
}

/** Local static panels. Centers; y is the panel center. Doors are omitted. */
export function r2CabinetPanels(o: any): R2Panel[] {
  const { W, D, H, meta } = metaOf(o);
  const frameMat = meta.frameMaterial || "oak";
  const backMat = meta.backMaterial || "cabinetInterior";
  const { d: shelfD, z: shelfZ } = panelBox(W, D, H);
  const panels: R2Panel[] = [];
  const frame = meta.frame !== false;

  if (frame) {
    const sideH = H - T;
    panels.push(
      { x: 0, y: KICK + T / 2, z: -T / 2, w: Math.max(T, W - 2 * T), h: T, d: Math.max(T, D - T), material: frameMat },
      { x: 0, y: H - T / 2, z: 0, w: Math.max(T, W - 2 * T), h: T, d: D, material: frameMat },
      { x: -W / 2 + T / 2, y: sideH / 2, z: 0, w: T, h: sideH, d: D, material: frameMat },
      { x: W / 2 - T / 2, y: sideH / 2, z: 0, w: T, h: sideH, d: D, material: frameMat },
      {
        x: 0,
        y: KICK / 2,
        z: -D / 2 + 0.045 + T / 2,
        w: Math.max(T, W - 2 * T),
        h: Math.max(T, KICK - 0.004),
        d: T,
        material: frameMat,
      },
      {
        x: 0,
        y: KICK + T + (H - KICK - 2 * T) / 2,
        z: D / 2 - T / 2,
        w: Math.max(T, W - 2 * T),
        h: Math.max(T, H - KICK - 2 * T),
        d: T,
        material: backMat,
      },
    );
  }

  if (frame) {
    const openings=mergeTouching(meta.bays.filter(b=>b.y<=KICK+EPS&&b.door==='open'&&/appliance|beer/.test(b.purpose||'')).map(b=>[b.x-b.w/2,b.x+b.w/2] as [number,number]));
    if(openings.length) {
      const cut=panels.filter(p=>p.y<=KICK+T&&p.h<=KICK+T);const rest=panels.filter(p=>!cut.includes(p));
      for(const p of cut) {
        let spans:Array<[number,number]>=[[p.x-p.w/2,p.x+p.w/2]];
        for(const [a,b] of openings) spans=spans.flatMap(([u,v])=>b<=u||a>=v?[[u,v]]:[[u,Math.max(u,a)],[Math.min(v,b),v]].filter(([x,y])=>y-x>EPS)) as Array<[number,number]>;
        for(const [a,b] of spans)rest.push({...p,x:(a+b)/2,w:b-a});
      }
      panels.splice(0,panels.length,...rest);
    }
  }
  const vertical = new Map<number, Array<[number, number]>>();
  const addV = (x: number, y0: number, y1: number) => {
    if (Math.abs(x + W / 2) <= T + EPS || Math.abs(x - W / 2) <= T + EPS) return;
    const key = Math.round(x * 1000) / 1000;
    const list = vertical.get(key) ?? [];
    list.push([y0, y1]);
    vertical.set(key, list);
  };
  for (const bay of meta.bays) {
    addV(bay.x - bay.w / 2, bay.y, bay.y + bay.h);
    addV(bay.x + bay.w / 2, bay.y, bay.y + bay.h);
  }
  for (const [x, spans] of vertical) {
    for (const [y0, y1] of mergeTouching(spans)) {
      const h = y1 - y0;
      panels.push({
        x,
        y: y0 + h / 2,
        z: shelfZ,
        w: T,
        h: Math.max(T, h - (y0 <= EPS ? KICK : 0)),
        d: shelfD,
        material: frameMat,
      });
      const last = panels[panels.length - 1];
      if (y0 <= EPS) last.y = KICK + last.h / 2;
    }
  }

  const horizontal = new Map<number, Array<[number, number]>>();
  for (let i = 0; i < meta.bays.length; i++) {
    for (let j = i + 1; j < meta.bays.length; j++) {
      const a = meta.bays[i];
      const b = meta.bays[j];
      const shareTop = Math.abs(a.y + a.h - b.y) <= 0.004;
      const shareBot = Math.abs(b.y + b.h - a.y) <= 0.004;
      if (!shareTop && !shareBot) continue;
      const y = shareTop ? b.y : a.y;
      const x0 = Math.max(a.x - a.w / 2, b.x - b.w / 2);
      const x1 = Math.min(a.x + a.w / 2, b.x + b.w / 2);
      if (x1 - x0 <= EPS) continue;
      if (y <= KICK + T || y >= H - T - EPS) continue;
      const key = Math.round(y * 1000) / 1000;
      const list = horizontal.get(key) ?? [];
      list.push([x0, x1]);
      horizontal.set(key, list);
    }
  }
  for (const [y, spans] of horizontal) {
    for (const [x0, x1] of mergeTouching(spans)) {
      panels.push({
        x: (x0 + x1) / 2,
        y,
        z: shelfZ,
        w: x1 - x0 - T,
        h: T,
        d: shelfD,
        material: frameMat,
      });
    }
  }

  meta.bays.forEach((bay, index) => {
    const mat = bay.material || frameMat;
    const left = bay.x - bay.w / 2;
    const right = bay.x + bay.w / 2;
    const insetL = Math.abs(left + W / 2) <= T + EPS ? T : T / 2;
    const insetR = Math.abs(right - W / 2) <= T + EPS ? T : T / 2;
    const w = bay.w - insetL - insetR;
    const x = (left + insetL + right - insetR) / 2;
    if (w <= EPS) return;
    const purpose = bay.purpose || "";
    if (bay.door === "open" && purpose === "bench") {
      panels.push({
        x,
        y: bay.y + bay.h - 0.02,
        z: shelfZ + 0.01,
        w,
        h: 0.04,
        d: Math.min(shelfD, D * 0.72),
        material: mat,
      });
    }
    for (const rel of bay.shelves ?? []) {
      if (rel <= T || rel >= bay.h - T) continue;
      panels.push({
        x,
        y: bay.y + rel,
        z: shelfZ,
        w,
        h: T,
        d: shelfD * 0.96,
        material: bay.material === "r7BlackGlass" ? frameMat : mat,
        hide: bay.door === "solid",
        owner: index,
      });
    }
    void index;
  });

  let cutPanels=panels;
  for(const hole of meta.cutouts??[]) {
    cutPanels=cutPanels.flatMap(p=>{
      if(p.h>.05||p.y-p.h/2>=hole.y1||p.y+p.h/2<=hole.y0)return [p];
      const x0=p.x-p.w/2,x1=p.x+p.w/2,z0=p.z-p.d/2,z1=p.z+p.d/2;
      const a=Math.max(x0,hole.x-hole.w/2),b=Math.min(x1,hole.x+hole.w/2),c=Math.max(z0,hole.z-hole.d/2),e=Math.min(z1,hole.z+hole.d/2);
      if(b<=a||e<=c)return [p];
      return [[x0,a,z0,z1],[b,x1,z0,z1],[a,b,z0,c],[a,b,e,z1]].filter(([u,v,r,s])=>v-u>EPS&&s-r>EPS).map(([u,v,r,s])=>({...p,x:(u+v)/2,z:(r+s)/2,w:v-u,d:s-r}));
    });
  }
  return cutPanels.filter((p) => p.w > EPS && p.h > EPS && p.d > EPS);
}

function addPanel(group: THREE.Object3D, p: R2Panel, materials: Record<string, THREE.Material>) {
  const geo = new RoundedBoxGeometry(p.w, p.h, p.d, 1, Math.min(0.0015, p.w / 4, p.h / 4, p.d / 4));
  metricUV(geo, /oak|wood/i.test(p.material) && p.w > p.h ? "horizontal" : undefined);
  const mesh = new THREE.Mesh(geo, materials[p.material] ?? materials.oak);
  mesh.position.set(p.x, p.y, p.z);
  mesh.castShadow = !/glass/i.test(p.material);
  mesh.receiveShadow = true;
  group.add(mesh);
}

function markAnimated(root: THREE.Object3D) {
  root.traverse((node) => {
    node.userData.animated = true;
  });
}

function leafCount(width: number): number {
  return width > 0.7 ? 2 : 1;
}

function segmentCount(height: number): number {
  return Math.max(1, Math.ceil(height / 1.25));
}

export function buildR2Cabinet(
  group: THREE.Group,
  o: any,
  materials: Record<string, THREE.Material>,
  doors: StorageDoor[],
): boolean {
  if (!o || o.type !== "wall_storage" || !o.r2Cabinet) return false;
  const { W, D, H, meta } = metaOf(o);
  const panels = r2CabinetPanels(o);
  const hidden = new Map<number, THREE.Group>();
  meta.bays.forEach((bay, i) => {
    if (bay.door !== "solid") return;
    const inside = new THREE.Group();
    inside.name = `${o.id || "r2"}:inside:${i}`;
    const showThrough = bay.material === "r7BlackGlass";
    inside.visible = showThrough;
    if (!showThrough) {
      inside.userData.animated = true;
      inside.userData.visibilityDependent = true;
    } else inside.userData.r7AlwaysVisible = true;
    group.add(inside);
    hidden.set(i, inside);
  });

  for (const p of panels) {
    addPanel(p.hide ? hidden.get(p.owner ?? -1) ?? group : group,p,materials);
  }

  const frontMat = meta.frontMaterial || meta.frameMaterial || "oak";
  meta.bays.forEach((bay, i) => {
    const purpose = bay.purpose || "";
    const left = bay.x - bay.w / 2;
    const right = bay.x + bay.w / 2;
    const insetL = Math.abs(left + W / 2) <= T + EPS ? T : T / 2;
    const insetR = Math.abs(right - W / 2) <= T + EPS ? T : T / 2;
    const innerW = bay.w - insetL - insetR;
    const innerX = (left + insetL + right - insetR) / 2;
    const inside = hidden.get(i);
    const host = bay.door === "solid" ? inside : group;
    if (!host || innerW <= EPS) return;

    if (bay.door === "solid" && purpose !== "appliance" && purpose !== "beer" && purpose !== "display") {
      const boxes = purpose === "folded-storage" || purpose === "wardrobe" ? 0 : 1;
      for (let n = 0; n < boxes; n++) {
        addPanel(
          host,
          {
            x: innerX + (n === 0 ? -innerW * 0.18 : innerW * 0.18),
            y: bay.y + 0.1 + n * 0.02,
            z: Math.min(-D / 2 + 0.16, D / 2 - T - 0.005 - Math.min(0.22, D * 0.45) / 2),
            w: Math.min(0.28, innerW * 0.42),
            h: 0.12,
            d: Math.min(0.22, D * 0.45),
            material: n === 0 ? "linen" : "cream",
          },
          materials,
        );
      }
      if (purpose === "wardrobe") {
        const rail = new THREE.Mesh(
          new THREE.CylinderGeometry(0.01, 0.01, Math.max(0.05, innerW - 0.08), 10),
          materials.bronze || materials.steel || materials.oak,
        );
        rail.rotation.z = Math.PI / 2;
        rail.position.set(innerX, bay.y + Math.min(bay.h - 0.12, 1.55), -D / 2 + D * 0.45);
        rail.userData.animated = true;
        host.add(rail);
      }
    }

    if (bay.door === "open" && purpose !== "display" && purpose !== "appliance" && purpose !== "beer" && purpose !== "bench" && purpose !== "pegboard") {
      const floorY = bay.y + (bay.y < 0.02 ? KICK + T : T);
      const span = (bay.shelves ?? []).find((s) => s > 0.12) ?? Math.min(bay.h - 0.04, 0.36);
      if (span > 0.2 && purpose !== "utility") {
        const books = Math.min(3, Math.max(1, Math.floor(innerW / 0.28)));
        for (let j = 0; j < books; j++) {
          const bh = 0.18 + (j % 2) * 0.03;
          addPanel(
            group,
            {
              x: innerX - innerW * 0.28 + j * 0.05,
              y: floorY + bh / 2,
              z: -D / 2 + 0.14,
              w: 0.028,
              h: bh,
              d: 0.14,
              material: ["bookClay", "bookSage", "bookCream"][j % 3],
            },
            materials,
          );
        }
      } else if (innerW < 0.55) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.08, 16), materials.cream || materials.oak);
        cup.position.set(innerX, floorY + 0.04, -D / 2 + 0.12);
        cup.castShadow = true;
        group.add(cup);
      }
    }

    if (bay.door !== "solid") return;
    const usableH = bay.h - GAP * 2;
    const segs = segmentCount(usableH);
    const segH = (usableH - GAP * (segs - 1)) / segs;
    const leaves = leafCount(innerW);
    const leafW = (innerW - GAP * (leaves + 1)) / leaves;
    for (let s = 0; s < segs; s++) {
      const y0 = bay.y + GAP + s * (segH + GAP);
      for (let leaf = 0; leaf < leaves; leaf++) {
        const side = leaves === 1 ? (i % 2 === 0 ? -1 : 1) : leaf === 0 ? -1 : 1;
        const hingeX = side === -1 ? innerX - innerW / 2 + GAP / 2 : innerX + innerW / 2 - GAP / 2;
        const pivot = new THREE.Group();
        pivot.name = `${o.id || "r2"}:door:${i}:${s}:${leaf}`;
        pivot.position.set(hingeX, y0, -D / 2 - 0.001);
        group.add(pivot);
        const center = (-side * leafW) / 2;
        if (bay.material === "r7BlackGlass") {
          const ft = 0.016;
          const rail = (x: number, y: number, w: number, h: number, name: string) => {
            addPanel(pivot, { x, y, z: -DOOR_T / 2, w, h, d: DOOR_T, material: "r7Ink" }, materials);
            pivot.children[pivot.children.length - 1].name = name;
          };
          rail(center - leafW / 2 + ft / 2, segH / 2, ft, segH, "r7-glass-stile");
          rail(center + leafW / 2 - ft / 2, segH / 2, ft, segH, "r7-glass-stile");
          rail(center, ft / 2, leafW, ft, "r7-glass-rail");
          rail(center, segH - ft / 2, leafW, ft, "r7-glass-rail");
          addPanel(pivot, {
            x: center, y: segH / 2, z: -DOOR_T / 2, w: leafW - ft * 2, h: segH - ft * 2, d: 0.006, material: "r7BlackGlass",
          }, materials);
        } else addPanel(
          pivot,
          {
            x: center,
            y: segH / 2,
            z: -DOOR_T / 2,
            w: leafW,
            h: segH,
            d: DOOR_T,
            material: bay.material || frontMat,
          },
          materials,
        );
        const pull = meta.r7BallPulls?.find((p: any) => p.bay === i && p.segment === s && p.leaf === leaf);
        if (pull) {
          const key = `r7Ball:${pull.color}`;
          if (!materials[key]) {
            materials[key] = new THREE.MeshStandardMaterial({ color: pull.color, roughness: 0.35, metalness: 0.05 });
            materials[key].userData.r7Role = true;
          }
          const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), materials[key]);
          knob.position.set(center - side * (leafW / 2 - 0.06), Math.min(segH - 0.1, segH * 0.48), -DOOR_T - 0.012);
          knob.castShadow = true;
          knob.userData.animated = true;
          pivot.add(knob);
        } else if (meta.r7PullPolicy !== "two-balls") addPanel(
          pivot,
          {
            x: center - side * (leafW / 2 - 0.07),
            y: Math.min(segH - 0.08, Math.max(0.12, segH * 0.45)),
            z: -DOOR_T - 0.008,
            w: 0.11,
            h: 0.012,
            d: 0.012,
            material: "bronze",
          },
          materials,
        );
        markAnimated(pivot);
        const record: R2Door = { pivot, sign: side, unitId: String(o.id ?? "") };
        if (inside && !inside.userData.r7AlwaysVisible) record.insideGroup = inside;
        doors.push(record);
      }
    }
  });
  void H;
  return true;
}
