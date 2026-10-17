import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { shadeFloors } from "./contact-shading";
import { metricUV } from "./texture-mapping";
import { transformGeometry } from "./geometry";
import {
  HEIGHT,
  rooms,
  walls,
  furniture,
  cabinetBottom,
  type Furnishing,
  type RoomId,
  type Wall,
} from "./plan";
import type { Materials } from "./materials";
export interface Collider {
  id: string;
  min: T.Vector3;
  max: T.Vector3;
  dynamic?: T.Object3D;
}
export interface Action {
  id: string;
  name: string;
  room: RoomId;
  at: T.Vector3;
  value: number;
  target: number;
  apply: (t: number) => void;
  kind: string;
}
export function buildHome(scene: T.Scene, m: Materials) {
  const colliders: Collider[] = [],
    actions: Action[] = [],
    wallTops: T.Object3D[] = [],
    cutWalls: T.Object3D[] = [],
    roofs: T.Object3D[] = [],
    floors: T.Mesh[] = [],
    bounds: Record<string, { min: number[]; max: number[] }> = {};
  const all = new T.Group();
  scene.add(all);
  const fixed = new T.Group();
  all.add(fixed);
  function mesh(
    p: T.Object3D,
    g: T.BufferGeometry,
    mat: string,
    x = 0,
    y = 0,
    z = 0,
  ): T.Mesh<T.BufferGeometry, T.Material> {
    // Architectural segments share one texture origin, including the overview cut.
    metricUV(g, undefined, p === fixed ? [x, y, z] : [0, 0, 0]);
    const o = new T.Mesh(g, m[mat]);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    p.add(o);
    return o;
  }
  function box(
    p: T.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat = "oak",
    r = 0.008,
  ) {
    return mesh(
      p,
      r
        ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3))
        : new T.BoxGeometry(w, h, d),
      mat,
      x,
      y,
      z,
    );
  }
  function cyl(
    p: T.Object3D,
    r: number,
    r2: number,
    h: number,
    x: number,
    y: number,
    z: number,
    mat = "oak",
    n = 32,
  ) {
    return mesh(p, new T.CylinderGeometry(r, r2, h, n), mat, x, y, z);
  }
  function sphere(
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    mat: string,
  ) {
    const o = mesh(p, new T.SphereGeometry(1, 24, 16), mat, x, y, z);
    o.scale.set(sx, sy, sz);
    return o;
  }
  function tube(p: T.Object3D, points: number[][], r: number, mat: string) {
    return mesh(
      p,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(
          points.map((a) => new T.Vector3(...(a as [number, number, number]))),
        ),
        32,
        r,
        8,
        false,
      ),
      mat,
    );
  }
  function obstacle(id: string, o: T.Object3D) {
    o.updateWorldMatrix(true, true);
    const b = new T.Box3().setFromObject(o);
    colliders.push({ id, min: b.min.clone(), max: b.max.clone() });
    return b;
  }
  function colliderRect(
    id: string,
    x: number,
    z: number,
    w: number,
    d: number,
    h = 2.8,
  ) {
    colliders.push({
      id,
      min: new T.Vector3(x - w / 2, 0, z - d / 2),
      max: new T.Vector3(x + w / 2, h, z + d / 2),
    });
  }
  function movingCollider(id: string, o: T.Object3D) {
    o.updateWorldMatrix(true, true);
    const b = new T.Box3().setFromObject(o);
    colliders.push({ id, min: b.min, max: b.max, dynamic: o });
  }
  function act(
    id: string,
    name: string,
    room: RoomId,
    at: T.Vector3,
    apply: (t: number) => void,
    kind = "cabinet",
    initial = 0,
  ) {
    const a = {
      id,
      name,
      room,
      at,
      value: initial,
      target: initial,
      apply,
      kind,
    };
    actions.push(a);
    apply(initial);
    return a;
  }
  function line(
    p: T.Object3D,
    a: number[],
    b: number[],
    radius = 0.012,
    mat = "metal",
  ) {
    const from = new T.Vector3(...(a as [number, number, number])),
      to = new T.Vector3(...(b as [number, number, number])),
      d = to.clone().sub(from);
    const o = cyl(
      p,
      radius,
      radius,
      d.length(),
      ...(from.clone().add(to).multiplyScalar(0.5).toArray() as [
        number,
        number,
        number,
      ]),
      mat,
      16,
    );
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    return o;
  }
  function pegboard(
    parent: T.Object3D,
    left: number,
    right: number,
    bottom: number,
    top: number,
    z: number,
  ) {
    const shape = new T.Shape();
    shape.moveTo(left, bottom);
    shape.lineTo(right, bottom);
    shape.lineTo(right, top);
    shape.lineTo(left, top);
    shape.closePath();
    for (let x = left + 0.055; x < right - 0.035; x += 0.085)
      for (let y = bottom + 0.055; y < top - 0.035; y += 0.085) {
        const hole = new T.Path();
        hole.absarc(x, y, 0.007, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
    const panel = mesh(
      parent,
      new T.ExtrudeGeometry(shape, {
        depth: 0.018,
        bevelEnabled: false,
        curveSegments: 4,
      }),
      "pegboard",
      0,
      0,
      z,
    );
    panel.castShadow = false;
    return panel;
  }
  // Wood planks and tiles use metre-scale textures; a thin seam grid gives mineral floors a real joint.
  const floorShape = new T.Shape();
  const shellPoints = awaitShell();
  shellPoints.forEach(([x, z], i) =>
    i ? floorShape.lineTo(x, -z) : floorShape.moveTo(x, -z),
  );
  floorShape.closePath();
  const slab = new T.ExtrudeGeometry(floorShape, {
    depth: 0.1,
    bevelEnabled: false,
  });
  slab.rotateX(-Math.PI / 2);
  mesh(fixed, slab, "floor", 0, -0.1, 0);
  for (const room of rooms) {
    const rectangles = room.floorRects ?? [room.rect];
    for (const [a, b, c, d] of rectangles) {
      const floor = mesh(
        fixed,
        new T.PlaneGeometry(
          c - a,
          d - b,
          Math.ceil((c - a) * 8),
          Math.ceil((d - b) * 8),
        ),
        room.material + "Contact",
        (a + c) / 2,
        0.018,
        (b + d) / 2,
      );
      floor.rotation.x = -Math.PI / 2;
      floor.castShadow = false;
      floors.push(floor);
      if (room.material !== "floor")
        for (let x = Math.ceil(a / 1.2) * 1.2; x < c; x += 1.2)
          box(fixed, 0.003, 0.001, d - b, x, 0.019, (b + d) / 2, "grout", 0);
      if (room.material !== "floor")
        for (let z = Math.ceil(b / 1.2) * 1.2; z < d; z += 1.2)
          box(fixed, c - a, 0.001, 0.003, (a + c) / 2, 0.019, z, "grout", 0);
      const roof = box(
        fixed,
        c - a,
        0.06,
        d - b,
        (a + c) / 2,
        HEIGHT + 0.03,
        (b + d) / 2,
        "wall",
        0,
      );
      roofs.push(roof);
    }
  }
  function wall(w: Wall) {
    const dx = w.b[0] - w.a[0],
      dz = w.b[1] - w.a[1],
      len = Math.hypot(dx, dz),
      ux = dx / len,
      uz = dz / len,
      axisX = Math.abs(dx) > 0.01;
    const position = (t: number): [number, number] => [
      w.a[0] + ux * t,
      w.a[1] + uz * t,
    ];
    function part(
      start: number,
      end: number,
      y0: number,
      y1: number,
      mat = "wall",
    ) {
      if (end - start < 0.002 || y1 - y0 < 0.002) return;
      const [x, z] = position((start + end) / 2),
        width = axisX ? end - start : 0.16,
        depth = axisX ? 0.16 : end - start;
      const o = box(fixed, width, y1 - y0, depth, x, (y0 + y1) / 2, z, mat, 0);
      if (y1 > 1.05) {
        wallTops.push(o);
        if (y0 < 1.05) {
          const cutTop = Math.min(y1, 1.05);
          const cut = box(
            fixed,
            width,
            cutTop - y0,
            depth,
            x,
            (y0 + cutTop) / 2,
            z,
            mat,
            0,
          );
          cut.visible = false;
          cutWalls.push(cut);
        }
      }
      if (y0 < 1.7) colliderRect(w.id, x, z, width, depth, y1);
    }
    let cursor = 0;
    for (const opening of [...(w.openings ?? [])].sort((a, b) => a.at - b.at)) {
      const left = opening.at - opening.width / 2,
        right = opening.at + opening.width / 2;
      part(cursor, left, 0, HEIGHT);
      const y0 = opening.type === "window" ? (opening.sill ?? 0.8) : 0,
        y1 = y0 + (opening.height ?? (opening.type === "window" ? 1.6 : 2.22));
      if (y0) part(left, right, 0, y0);
      part(left, right, y1, HEIGHT);
      const [x, z] = position(opening.at);
      if (opening.type === "window") {
        const group = new T.Group();
        group.position.set(x, 0, z);
        if (!axisX) group.rotation.y = Math.PI / 2;
        fixed.add(group);
        box(group, opening.width, 0.045, 0.22, 0, y0, 0, "stone", 0.002);
        box(group, opening.width, 0.035, 0.08, 0, y1, 0, "metal", 0.002);
        for (const xx of [-opening.width / 2, 0, opening.width / 2])
          box(
            group,
            0.028,
            y1 - y0,
            0.075,
            xx,
            (y0 + y1) / 2,
            0,
            "metal",
            0.002,
          );
        const glass = box(
          group,
          opening.width - 0.035,
          y1 - y0 - 0.025,
          0.012,
          0,
          (y0 + y1) / 2,
          0,
          "glass",
          0,
        );
        glass.castShadow = false;
        wallTops.push(group);
        if (opening.width > 1.3 && y0 < 1.1) {
          const curtain = new T.Group();
          curtain.position.copy(group.position);
          curtain.rotation.copy(group.rotation);
          fixed.add(curtain);
          for (const side of opening.curtainSides ?? [-1, 1])
            for (let j = 0; j < 8; j++) {
              const xx = side * (opening.width / 2 - 0.12) + j * 0.022;
              const c = box(
                curtain,
                0.025,
                HEIGHT - 0.2,
                0.09,
                xx,
                HEIGHT / 2,
                0.12 + (j % 2) * 0.025,
                "linen",
                0.01,
              );
              c.castShadow = false;
            }
          wallTops.push(curtain);
        }
      } else if (opening.type === "door") {
        const frame = new T.Group();
        frame.position.set(x, 0, z);
        if (!axisX) frame.rotation.y = -Math.PI / 2;
        all.add(frame);
        for (const xx of [-opening.width / 2, opening.width / 2])
          box(frame, 0.045, 2.25, 0.2, xx, 1.125, 0, "oak", 0.004);
        box(frame, opening.width + 0.05, 0.055, 0.2, 0, 2.25, 0, "oak");
        wallTops.push(frame);
        const room = opening.id?.replace("-door", "") as RoomId;
        if (
          opening.id?.includes("kitchen") ||
          opening.id?.includes("balcony") ||
          opening.id === "ensuite-door"
        ) {
          const leaves: T.Group[] = [];
          for (const sign of [-1, 1]) {
            const pivot = new T.Group();
            pivot.position.x = (sign * opening.width) / 4;
            frame.add(pivot);
            leaves.push(pivot);
            const leaf = box(
              pivot,
              opening.width / 2 - 0.025,
              2.17,
              0.025,
              0,
              1.085,
              0,
              "glass",
              0.002,
            );
            for (const side of [-1, 1])
              box(
                pivot,
                0.024,
                2.17,
                0.04,
                side * (opening.width / 4 - 0.015),
                1.085,
                0,
                "metal",
              );
            box(pivot, opening.width / 2, 0.025, 0.04, 0, 0.025, 0, "metal");
            movingCollider(opening.id! + sign, leaf);
          }
          act(
            opening.id!,
            opening.name!,
            room,
            new T.Vector3(x, 1, z),
            (t) =>
              leaves.forEach(
                (leaf, i) =>
                  (leaf.position.x =
                    (i ? 1 : -1) *
                    (opening.width / 4 + (t * opening.width) / 2)),
              ),
            "door",
            opening.open ? 1 : 0,
          );
        } else {
          const pivot = new T.Group();
          pivot.position.x = -opening.width / 2 + 0.025;
          frame.add(pivot);
          const leaf = box(
            pivot,
            opening.width - 0.055,
            2.17,
            0.042,
            (opening.width - 0.055) / 2,
            1.085,
            0,
            "paint",
            0.005,
          );
          box(
            pivot,
            0.024,
            0.15,
            0.035,
            opening.width - 0.13,
            1.03,
            0.045,
            "metal",
          );
          movingCollider(opening.id!, leaf);
          const sign = 1;
          act(
            opening.id!,
            opening.name!,
            room,
            new T.Vector3(x, 1, z),
            (t) => {
              pivot.rotation.y = sign * t * Math.PI * 0.49;
            },
            "door",
            opening.open ? 1 : 0,
          );
        }
      }
      cursor = right;
    }
    part(cursor, len, 0, HEIGHT);
    // Thin wall base. Openings remain genuine holes in both mesh and collider.
  }
  walls.forEach(wall);
  box(fixed, 1.2, 2.3, 0.025, 2.65, 1.15, 3.64, "steel", 0.008);
  box(fixed, 0.012, 2.25, 0.028, 2.65, 1.15, 3.66, "metal");
  box(fixed, 0.07, 0.2, 0.028, 3.34, 1.08, 3.67, "black");
  box(fixed, 1.25, 0.055, 0.15, 2.65, 2.35, 3.6, "metal");
  const objectGroups = new Map<string, T.Group>();
  for (const o of furniture) {
    const g = new T.Group();
    g.name = o.id;
    g.position.set(o.x, 0, o.z);
    g.rotation.y = ((o.rotation ?? 0) * Math.PI) / 180;
    g.userData.room = o.room;
    all.add(g);
    objectGroups.set(o.id, g);
    const { w, d, h } = o;
    const wood =
      o.material ?? (["coffee", "kitchen"].includes(o.type) ? "paint" : "oak");
    function bodyObstacle(height = h) {
      colliderRect(
        o.id,
        o.x,
        o.z,
        (o.rotation ?? 0) % 180 ? d : w,
        (o.rotation ?? 0) % 180 ? w : d,
        height,
      );
    }
    function cabinet(bottom = 0) {
      const cols =
          o.id === "guest-east-wardrobe"
            ? 2
            : Math.max(1, Math.round(w / 0.58)),
        cw = w / cols;
      box(g, w, 0.08, d, 0, bottom + 0.06, 0, "charcoal");
      box(g, w, 0.035, d, 0, bottom + h - 0.02, 0, wood);
      for (const x of [-w / 2 + 0.012, w / 2 - 0.012])
        box(g, 0.022, h, d, x, bottom + h / 2, 0, wood);
      box(g, w, h, 0.018, 0, bottom + h / 2, -d / 2 + 0.055, "charcoal");
      const front = (j: number, low: number, high: number, suffix = "") => {
        const x = -w / 2 + cw * (j + 0.5),
          sliding = o.id === "guest-east-wardrobe";
        const pivot = new T.Group();
        pivot.position.set(
          x - cw / 2 + 0.012,
          bottom + low,
          d / 2 + (sliding ? j * 0.025 : 0),
        );
        pivot.userData.moving = true;
        g.add(pivot);
        const leaf = box(
          pivot,
          cw - 0.018,
          high - low - 0.022,
          0.024,
          (cw - 0.018) / 2,
          (high - low) / 2,
          0.006,
          wood,
          0.003,
        );
        if (sliding || o.id === "master-wardrobe")
          box(
            pivot,
            0.008,
            Math.min(0.34, (high - low) * 0.4),
            0.012,
            cw - 0.045,
            (high - low) * 0.5,
            0.024,
            "metal",
            0.002,
          );
        g.updateWorldMatrix(true, true);
        act(
          `${o.id}-${j}${suffix}`,
          o.label ?? "收纳柜",
          o.room,
          new T.Vector3(
            x,
            bottom + low + Math.min((high - low) / 2, 1.3),
            d / 2 + 0.15,
          ).applyMatrix4(g.matrixWorld),
          (t) => {
            if (sliding)
              pivot.position.x =
                x - cw / 2 + 0.012 + (j ? -1 : 1) * t * (cw - 0.07);
            else pivot.rotation.y = -t * Math.PI * 0.49;
          },
        );
        if (bottom + low < 1.7)
          movingCollider(`${o.id}-leaf-${j}${suffix}`, leaf);
      };
      for (let j = 0; j < cols; j++) {
        const x = -w / 2 + cw * (j + 0.5),
          niche = o.id === "living-back" && (j === 1 || j === 2);
        if (j) box(g, 0.018, h, d, x - cw / 2, bottom + h / 2, 0, wood);
        const levels = niche
          ? [0.87, 1.77, 2.3]
          : o.id === "guest-east-wardrobe"
            ? [0.28, 2.12]
            : [0.52, 1.04, 1.56, 2.08, 2.6];
        for (const level of levels)
          if (level < h - 0.1)
            box(g, cw, 0.018, d - 0.03, x, bottom + level, 0, wood);
        if (o.id === "guest-east-wardrobe")
          line(
            g,
            [x - cw * 0.4, 2.02, 0],
            [x + cw * 0.4, 2.02, 0],
            0.009,
            "metal",
          );
        if (niche) {
          front(j, 0.08, 0.86, "-lower");
          front(j, 1.79, h - 0.02, "-upper");
          box(g, cw - 0.02, 0.012, 0.02, x, 1.75, -d / 2 + 0.05, "glow", 0.002);
          if (j === 1) {
            book(g, x - 0.06, 0.89, 0, 0.06, 0.27, 0.19);
            book(g, x + 0.03, 0.89, 0, 0.07, 0.23, 0.19);
          } else {
            cyl(g, 0.07, 0.045, 0.28, x, 1.03, 0, "ceramic");
            line(g, [x, 1.16, 0], [x + 0.1, 1.45, 0], 0.003, "darkwood");
          }
        } else if (o.id === "coffee-upper" && j === 1) {
          for (const row of [0.53, 1.05])
            if (row < h)
              for (const k of [0, 1])
                cup(g, x - 0.12 + k * 0.22, bottom + row + 0.01, d / 2 - 0.12);
        } else front(j, 0.08, h - 0.02);
      }
      // Inset shadow plinth, aligned flush fronts and a single restrained light seam.
      box(
        g,
        w - 0.06,
        0.012,
        0.02,
        0,
        bottom + 0.115,
        d / 2 - 0.04,
        "glow",
        0.002,
      );
      if (bottom > 0) {
        const width = (o.rotation ?? 0) % 180 ? d : w,
          depth = (o.rotation ?? 0) % 180 ? w : d;
        colliders.push({
          id: o.id,
          min: new T.Vector3(o.x - width / 2, bottom, o.z - depth / 2),
          max: new T.Vector3(o.x + width / 2, bottom + h, o.z + depth / 2),
        });
      } else bodyObstacle(h);
    }
    if (o.type === "low-cabinet") {
      cabinet();
      box(g, w + 0.014, 0.026, d + 0.016, 0, h + 0.018, 0, "stone", 0.006);
      box(g, 0.23, 0.025, 0.14, 0.19, h + 0.044, 0.02, "darkwood", 0.018);
      box(g, 0.1, 0.035, 0.07, 0.18, h + 0.065, 0.02, "ceramic", 0.02);
    }
    if (o.type === "entry-niche") {
      // This unit sits inside the bedroom setback and opens toward the foyer.
      box(g, w, h, 0.028, 0, h / 2, -d / 2 + 0.02, "paint", 0);
      for (const x of [-w / 2 + 0.014, w / 2 - 0.014])
        box(g, 0.028, h, d, x, h / 2, 0, "paint", 0.003);
      const front = (name: string, bottom: number, height: number) => {
        for (let col = 0; col < 2; col++) {
          const cw = (w - 0.06) / 2,
            x = -w / 2 + 0.03 + col * cw;
          box(g, cw, 0.025, d - 0.02, x + cw / 2, bottom, 0, "oak", 0.002);
          box(
            g,
            cw,
            0.025,
            d - 0.02,
            x + cw / 2,
            bottom + height,
            0,
            "paint",
            0.002,
          );
          const pivot = new T.Group();
          pivot.position.set(x, bottom, d / 2);
          pivot.userData.moving = true;
          g.add(pivot);
          const leaf = box(
            pivot,
            cw - 0.012,
            height - 0.02,
            0.024,
            cw / 2,
            height / 2,
            0,
            "paint",
            0.003,
          );
          box(
            pivot,
            cw - 0.07,
            0.014,
            0.014,
            cw / 2,
            height - 0.05,
            0.019,
            "metal",
            0.002,
          );
          g.updateWorldMatrix(true, true);
          act(
            o.id + "-" + name + "-" + col,
            name === "shoe" ? "玄关鞋柜" : "玄关顶柜",
            o.room,
            new T.Vector3(
              x + cw / 2,
              bottom + height / 2,
              d / 2 + 0.12,
            ).applyMatrix4(g.matrixWorld),
            (t) => (pivot.rotation.y = -t * Math.PI * 0.46),
          );
          if (bottom < 1.7)
            movingCollider(o.id + "-" + name + "-leaf-" + col, leaf);
        }
      };
      front("shoe", 0.12, 0.52);
      front("upper", 2.08, 0.66);
      box(g, w - 0.03, 0.035, d + 0.025, 0, 0.67, 0, "oak", 0.006);
      pegboard(g, -w / 2 + 0.04, w / 2 - 0.04, 0.75, 2.02, -d / 2 + 0.045);
      box(g, w - 0.08, 0.016, 0.025, 0, 2.045, -d / 2 + 0.065, "glow", 0.002);
      for (const x of [-0.43, -0.13, 0.19, 0.47]) {
        line(
          g,
          [x, 1.83, -d / 2 + 0.065],
          [x, 1.83, -d / 2 + 0.14],
          0.008,
          "metal",
        );
        line(
          g,
          [x, 1.83, -d / 2 + 0.14],
          [x, 1.875, -d / 2 + 0.14],
          0.008,
          "metal",
        );
      }
      box(g, 0.34, 0.025, 0.14, -0.31, 1.22, -d / 2 + 0.125, "oak", 0.004);
      box(g, 0.18, 0.1, 0.075, -0.31, 1.28, -d / 2 + 0.13, "ceramic", 0.018);
      const pouch = box(
        g,
        0.22,
        0.25,
        0.055,
        0.2,
        1.58,
        -d / 2 + 0.13,
        "linen",
        0.028,
      );
      pouch.rotation.z = -0.07;
      line(
        g,
        [0.12, 1.69, -d / 2 + 0.13],
        [0.19, 1.83, -d / 2 + 0.13],
        0.006,
        "darkwood",
      );
      bodyObstacle();
    }
    if (o.type === "bike-wall") {
      box(g, w, h, 0.025, 0, h / 2, -d / 2 + 0.02, "paint");
      box(g, 0.43, h, d, -w / 2 + 0.22, h / 2, 0, "paint");
      box(g, w - 0.46, 0.4, d + 0.1, 0.23, 0.21, 0.04, "charcoal", 0.018);
      box(g, w - 0.46, 0.41, d, 0.23, h - 0.205, 0, "paint");
      const pivot = new T.Group();
      pivot.position.set(-w / 2 + 0.015, 0, d / 2 + 0.015);
      g.add(pivot);
      pivot.userData.moving = true;
      const leaf = box(pivot, 0.4, h - 0.08, 0.025, 0.2, h / 2, 0, "paint");
      box(pivot, 0.012, 0.16, 0.026, 0.34, 1.1, 0.026, "metal");
      g.updateWorldMatrix(true, true);
      act(
        o.id,
        "电梯厅收纳柜",
        o.room,
        new T.Vector3(-0.8, 1, d / 2 + 0.1).applyMatrix4(g.matrixWorld),
        (t) => (pivot.rotation.y = -t * Math.PI * 0.49),
      );
      movingCollider(o.id + "-leaf", leaf);
      const shape = new T.Shape();
      shape.moveTo(-0.65, 0.65);
      shape.lineTo(1.08, 0.65);
      shape.lineTo(1.08, 2.25);
      shape.lineTo(-0.65, 2.25);
      shape.closePath();
      for (let x = -0.57; x < 1.04; x += 0.1)
        for (let y = 0.73; y < 2.2; y += 0.1) {
          const hole = new T.Path();
          hole.absarc(x, y, 0.008, 0, Math.PI * 2, true);
          shape.holes.push(hole);
        }
      mesh(
        g,
        new T.ExtrudeGeometry(shape, {
          depth: 0.018,
          bevelEnabled: false,
          curveSegments: 5,
        }),
        "pegboard",
        0,
        0,
        -d / 2 + 0.04,
      );
      const depth = 0.21,
        rear = -0.29,
        front = 0.75,
        cy = 1.35;
      for (const x of [rear, front]) {
        mesh(
          g,
          new T.TorusGeometry(0.335, 0.012, 6, 48),
          "rubber",
          x,
          cy,
          depth,
        );
        mesh(
          g,
          new T.TorusGeometry(0.315, 0.005, 6, 48),
          "steel",
          x,
          cy,
          depth,
        );
        const hub = cyl(g, 0.018, 0.018, 0.09, x, cy, depth, "steel");
        hub.rotation.x = Math.PI / 2;
        for (let j = 0; j < 16; j++) {
          const a = (j * Math.PI) / 8;
          line(
            g,
            [x, cy, depth],
            [x + Math.cos(a) * 0.31, cy + Math.sin(a) * 0.31, depth],
            0.0013,
            "steel",
          );
        }
      }
      const rearAx = [rear, cy, depth],
        bb = [0.1, 1.25, depth],
        seat = [0.02, 1.81, depth],
        head = [0.61, 1.82, depth];
      for (const [a, b] of [
        [rearAx, bb],
        [bb, seat],
        [seat, rearAx],
        [seat, head],
        [head, bb],
        [head, [front, cy, depth]],
      ])
        line(g, a, b, 0.014, "metal");
      line(g, seat, [0.01, 1.94, depth], 0.011, "steel");
      box(g, 0.22, 0.035, 0.095, -0.025, 1.95, depth, "black", 0.025);
      line(g, head, [0.63, 1.92, depth], 0.012, "steel");
      tube(
        g,
        [
          [0.64, 1.92, depth - 0.19],
          [0.71, 1.92, depth - 0.19],
          [0.76, 1.83, depth - 0.19],
          [0.69, 1.77, depth - 0.19],
        ],
        0.011,
        "black",
      );
      tube(
        g,
        [
          [0.64, 1.92, depth + 0.19],
          [0.71, 1.92, depth + 0.19],
          [0.76, 1.83, depth + 0.19],
          [0.69, 1.77, depth + 0.19],
        ],
        0.011,
        "black",
      );
      line(
        g,
        [0.64, 1.92, depth - 0.19],
        [0.64, 1.92, depth + 0.19],
        0.01,
        "metal",
      );
      mesh(
        g,
        new T.TorusGeometry(0.075, 0.006, 6, 24),
        "steel",
        bb[0],
        bb[1],
        depth + 0.025,
      );
      line(
        g,
        [bb[0], bb[1], depth],
        [bb[0] - 0.06, bb[1] - 0.09, depth + 0.09],
        0.009,
        "steel",
      );
      box(
        g,
        0.09,
        0.015,
        0.06,
        bb[0] - 0.09,
        bb[1] - 0.09,
        depth + 0.09,
        "black",
      );
      for (const x of [0.02, 0.6]) {
        line(g, [x, 1.84, -d / 2 + 0.06], [x, 1.84, depth], 0.012, "black");
        box(g, 0.07, 0.1, 0.025, x, 1.79, -d / 2 + 0.045, "black");
      }
      colliderRect(o.id, o.x - 0.08, o.z, 0.62, w, h);
    }
    if (o.type === "cabinet") cabinet(cabinetBottom(o.id));
    if (o.type === "media") {
      box(g, w, h, 0.025, 0, h / 2, -d / 2 + 0.02, "charcoal");
      for (const side of [-1, 1]) {
        const x = side * (w / 2 - 0.27);
        box(g, 0.52, h, d, x, h / 2, 0, "paint");
        const pivot = new T.Group();
        pivot.position.set(x - 0.25, 0, d / 2 + 0.015);
        g.add(pivot);
        pivot.userData.moving = true;
        const leaf = box(pivot, 0.49, h - 0.1, 0.024, 0.245, h / 2, 0, "paint");
        box(pivot, 0.012, 0.18, 0.025, 0.44, 1.1, 0.025, "metal");
        g.updateWorldMatrix(true, true);
        act(
          o.id + side,
          "客厅通顶柜",
          o.room,
          new T.Vector3(x, 1, d / 2 + 0.15).applyMatrix4(g.matrixWorld),
          (t) => (pivot.rotation.y = -t * Math.PI * 0.49),
        );
        movingCollider(o.id + "leaf" + side, leaf);
      }
      const inner = w - 1.1;
      box(g, inner, 0.44, d, 0, 0.24, 0, "paint");
      box(g, inner, 0.035, d, 0, 0.475, 0, "stone");
      box(g, inner, 0.48, d, 0, h - 0.24, 0, "paint");
      for (let x = -inner / 2 + 0.4; x < inner / 2; x += 0.65)
        box(g, 0.004, 0.38, 0.025, x, 0.24, d / 2 + 0.014, "metal", 0);
      box(g, inner, 0.025, 0.035, 0, h - 0.5, d / 2 - 0.03, "glow");
      box(g, 1.91, 1.1, 0.045, 0, 1.36, d / 2 - 0.06, "black", 0.015);
      const tv = new T.Mesh(
        new T.PlaneGeometry(1.85, 1.04),
        new T.MeshBasicMaterial({ map: displayTexture("living") }),
      );
      tv.position.set(0, 1.36, d / 2 - 0.033);
      g.add(tv);
      for (const x of [-0.98, 0.98]) {
        box(g, 0.13, 0.28, 0.16, x, 0.64, 0.02, "black");
        box(g, 0.1, 0.25, 0.012, x, 0.64, 0.11, "linen");
      }
      box(g, inner - 0.08, 0.012, 0.03, 0, 0.1, d / 2 - 0.025, "glow", 0.002);
      bodyObstacle(h);
    }
    if (["coffee", "kitchen", "console"].includes(o.type)) {
      box(g, w, h - 0.11, d, 0, (h - 0.11) / 2 + 0.07, 0, wood, 0.012);
      for (let j = 0; j < Math.max(2, Math.round(w / 0.5)); j++) {
        const cw = w / Math.max(2, Math.round(w / 0.5)),
          x = -w / 2 + cw * (j + 0.5);
        box(
          g,
          cw - 0.018,
          h - 0.17,
          0.022,
          x,
          h / 2,
          d / 2 + 0.012,
          wood,
          0.004,
        );
        box(g, 0.15, 0.012, 0.026, x, h - 0.15, d / 2 + 0.03, "metal");
      }
      box(g, w + 0.03, 0.045, d + 0.025, 0, h, 0, "stone", 0.012);
      bodyObstacle(h);
      if (o.type === "coffee") {
        box(g, 0.48, 0.36, 0.34, -0.48, h + 0.2, -0.04, "steel", 0.025);
        box(g, 0.39, 0.22, 0.012, -0.48, h + 0.21, 0.139, "black", 0.008);
        box(g, 0.35, 0.025, 0.16, -0.48, h + 0.035, 0.15, "metal");
        for (const x of [-0.59, -0.36]) {
          cyl(g, 0.038, 0.038, 0.016, x, h + 0.38, 0.07, "black");
          line(g, [x, h + 0.28, 0.15], [x, h + 0.27, 0.25], 0.018, "metal");
        }
        cyl(g, 0.082, 0.09, 0.22, 0.15, h + 0.13, -0.03, "black");
        cyl(g, 0.07, 0.05, 0.14, 0.15, h + 0.31, -0.03, "glass");
        cyl(g, 0.075, 0.075, 0.02, 0.15, h + 0.395, -0.03, "metal");
        cup(g, -0.48, h + 0.05, 0.19);
        cup(g, 0.57, h + 0.025, 0.12);
        box(g, 0.48, 0.024, 0.27, 0.62, h + 0.035, -0.02, "oak", 0.025);
        cyl(g, 0.075, 0.06, 0.15, 0.65, h + 0.12, -0.04, "ceramic");
        box(g, w - 0.04, 0.65, 0.022, 0, 1.28, -d / 2 + 0.1, "charcoal");
        for (const x of [-w / 2 + 0.012, w / 2 - 0.012])
          box(g, 0.024, 2.76, d - 0.04, x, 1.38, -0.02, "paint", 0.003);
        box(g, w - 0.12, 0.012, 0.035, 0, 1.585, -0.04, "glow");
      }
      if (o.type === "kitchen") {
        if (o.id.includes("west")) {
          box(g, 0.6, 0.025, 0.44, -0.1, h + 0.027, 0, "steel", 0.04);
          box(g, 0.49, 0.016, 0.34, -0.1, h + 0.042, 0, "black", 0.04);
          box(g, 0.43, 0.008, 0.28, -0.1, h + 0.052, 0, "steel", 0.035);
          tube(
            g,
            [
              [0.24, h, -0.19],
              [0.24, h + 0.28, -0.19],
              [0.24, h + 0.34, 0.01],
              [0.24, h + 0.22, 0.1],
            ],
            0.016,
            "steel",
          );
        } else {
          box(g, 0.71, 0.018, 0.45, 0.12, h + 0.035, 0, "black", 0.015);
          for (const x of [-0.09, 0.32])
            for (const z of [-0.13, 0.13])
              cyl(g, 0.073, 0.073, 0.014, x, h + 0.052, z, "metal");
          box(g, 0.7, 0.12, 0.39, 0.12, 1.9, -0.03, "steel");
          box(g, 0.18, 0.65, 0.16, 0.12, 2.25, -0.13, "steel");
        }
      }
    }
    if (o.type === "table" || o.type === "side") {
      box(
        g,
        w,
        0.045,
        d,
        0,
        h - 0.025,
        0,
        o.type === "side" ? "stone" : "oak",
        0.12,
      );
      if (o.type === "side")
        cyl(g, 0.1, 0.17, h - 0.04, 0, (h - 0.04) / 2, 0, "oak");
      else
        for (const x of [-w * 0.34, w * 0.34])
          box(g, 0.08, h - 0.04, 0.35, x, (h - 0.04) / 2, 0, "oak", 0.025);
      bodyObstacle(h);
      if (o.type === "table") {
        box(g, 0.26, 0.025, 0.26, 0.28, h + 0.012, 0, "ceramic", 0.09);
        cyl(g, 0.07, 0.045, 0.19, -0.25, h + 0.1, 0, "ceramic");
      }
    }
    if (o.type === "chair") {
      for (const x of [-0.2, 0.2])
        for (const z of [-0.19, 0.19])
          line(g, [x, 0.02, z], [x * 0.9, 0.45, z * 0.8], 0.018, "oak");
      box(g, 0.5, 0.07, 0.48, 0, 0.45, 0, "linen", 0.055);
      box(g, 0.52, 0.28, 0.07, 0, 0.67, 0.205, "oak", 0.045);
      bodyObstacle(0.85);
    }
    if (o.type === "sofa") {
      box(g, w - 0.14, 0.17, d - 0.08, 0, 0.2, 0, "clay", 0.09);
      for (const x of [-0.62, 0.62])
        box(g, 1.2, 0.21, 0.81, x, 0.425, -0.065, "linen", 0.09);
      box(g, w - 0.08, 0.38, 0.22, 0, 0.6, 0.34, "linen", 0.1);
      for (const x of [-w / 2 + 0.12, w / 2 - 0.12])
        box(g, 0.22, 0.3, 0.91, x, 0.55, 0, "linen", 0.1);
      const p = box(g, 0.38, 0.35, 0.12, -0.75, 0.65, 0.16, "sage", 0.06);
      p.rotation.z = 0.1;
      box(g, 0.4, 0.3, 0.13, 0.75, 0.65, 0.15, "clay", 0.065);
      // Fine upholstery seams add scale without covering timber in fabric piping.
      for (const x of [-0.62, 0.62])
        tube(
          g,
          [
            [x - 0.5, 0.53, -0.4],
            [x + 0.5, 0.53, -0.4],
          ],
          0.0025,
          "clay",
        );
      bodyObstacle(0.82);
    }
    if (o.type === "bed") {
      box(g, w + 0.04, 0.22, d, 0, 0.2, 0, "sage", 0.06);
      // Upholstered storage base with real drawer fronts and recessed toe space.
      for (const side of o.room === "guest" ? [1] : [-1, 1])
        for (const z of [-d * 0.23, d * 0.23])
          box(
            g,
            0.018,
            0.14,
            d * 0.43,
            side * (w / 2 + 0.026),
            0.21,
            z,
            "sage",
            0.008,
          );
      box(g, w, 0.26, d - 0.06, 0, 0.43, 0, "linen", 0.075);
      box(
        g,
        w + (o.room === "guest" ? 0.04 : 0.18),
        1.08,
        0.12,
        0,
        0.55,
        -d / 2 + 0.04,
        "sage",
        0.055,
      );
      box(g, w - 0.04, 0.1, d * 0.68, 0, 0.6, 0.25, "linen", 0.07);
      for (const x of [-w * 0.24, w * 0.24]) {
        const p = box(
          g,
          w * 0.42,
          0.12,
          0.47,
          x,
          0.655,
          -d * 0.27,
          "paper",
          0.06,
        );
        p.rotation.x = -0.1;
      }
      box(g, w + 0.035, 0.035, 0.46, 0, 0.66, d * 0.32, "sage", 0.018);
      if (o.room === "guest")
        box(
          g,
          w - 0.14,
          0.025,
          0.08,
          0,
          1.11,
          -d / 2 + 0.065,
          "darkwood",
          0.004,
        );
      bodyObstacle(0.8);
    }
    if (o.type === "bench") {
      box(g, w, 0.025, d - 0.03, 0, 0.04, -0.015, "paint", 0.003);
      box(g, w, 0.025, d - 0.03, 0, 0.35, -0.015, "paint", 0.003);
      box(g, w, 0.3, 0.02, 0, 0.19, -d / 2 + 0.015, "charcoal", 0.003);
      for (const x of [-w / 2 + 0.012, w / 2 - 0.012])
        box(g, 0.024, 0.3, d, x, 0.19, 0, "paint", 0.003);
      const cols = Math.max(2, Math.round(w / 0.6));
      for (let col = 0; col < cols; col++) {
        const cw = w / cols,
          x = -w / 2 + cw * (col + 0.5);
        const lid = new T.Group();
        lid.position.set(x, 0.19, d / 2);
        lid.userData.moving = true;
        g.add(lid);
        const leaf = box(lid, cw - 0.014, 0.28, 0.023, 0, 0, 0, "paint", 0.003);
        box(lid, cw - 0.08, 0.008, 0.012, 0, 0.1, 0.018, "metal", 0.002);
        g.updateWorldMatrix(true, true);
        act(
          o.id + "-drawer-" + col,
          "窗边收纳抽屉",
          o.room,
          new T.Vector3(x, 0.3, d / 2 + 0.1).applyMatrix4(g.matrixWorld),
          (t) => {
            lid.position.z = d / 2 + t * Math.min(0.26, d * 0.75);
          },
        );
        movingCollider(o.id + "-drawer-leaf-" + col, leaf);
      }
      box(g, w, 0.09, d, 0, 0.405, 0, "linen", 0.035);
      bodyObstacle(0.5);
    }
    if (o.type === "desk") {
      box(g, w, 0.045, d, 0, 0.73, 0, "oak", 0.012);
      for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) {
        box(g, 0.045, 0.7, d - 0.06, x, 0.36, 0, "metal");
        box(g, 0.16, 0.035, d - 0.02, x, 0.022, 0, "metal");
      }
      const station = new T.Group();
      station.position.x = 0.6;
      g.add(station);
      box(station, 0.9, 0.4, 0.045, -0.18, 1.12, -0.2, "black", 0.022);
      const monitor = new T.Mesh(
        new T.PlaneGeometry(0.855, 0.355),
        new T.MeshBasicMaterial({ map: displayTexture("gaming") }),
      );
      monitor.position.set(-0.18, 1.12, -0.174);
      station.add(monitor);
      cyl(station, 0.023, 0.023, 0.23, -0.18, 0.86, -0.2, "metal");
      box(station, 0.26, 0.012, 0.18, -0.18, 0.76, -0.2, "metal", 0.02);
      box(station, 0.45, 0.021, 0.17, -0.15, 0.77, 0.18, "black", 0.01);
      box(station, 0.055, 0.027, 0.095, 0.22, 0.78, 0.18, "black", 0.02);
      box(station, 0.24, 0.43, 0.42, 0.65, 0.975, -0.08, "black", 0.025);
      box(station, 0.008, 0.35, 0.32, 0.525, 0.99, -0.08, "glass");
      for (const y of [0.9, 1.05]) {
        const fan = mesh(
          station,
          new T.TorusGeometry(0.05, 0.005, 6, 24),
          "steel",
          0.65,
          y,
          0.135,
        );
        fan.rotation.x = 0;
      }
      for (const x of [-0.69, 0.35]) {
        box(station, 0.1, 0.19, 0.1, x, 0.86, -0.22, "black");
        cyl(station, 0.018, 0.018, 0.12, x, 1.0, -0.22, "metal");
      }
      // Extend along the solid wall; preserve the existing side-window opening.
      const sideWindow = walls.find((w) => w.id === "outer-3")!.openings![0];
      const windowStart = 0.45 + sideWindow.at - sideWindow.width / 2 - o.z;
      const windowEnd = 0.45 + sideWindow.at + sideWindow.width / 2 - o.z;
      for (const [a, b] of [
        [-w / 2, windowStart - 0.035],
        [windowEnd + 0.035, w / 2],
      ])
        if (b - a > 0.18) {
          pegboard(g, a, b, 1.46, 2.23, -d / 2 + 0.02);
          box(
            g,
            b - a,
            0.018,
            0.028,
            (a + b) / 2,
            1.435,
            -d / 2 + 0.065,
            "glow",
            0.003,
          );
        }
      box(g, w - 0.16, 0.055, 0.11, 0, 0.64, -d / 2 + 0.08, "metal", 0.006);
      box(g, 0.84, 0.006, 0.36, 0.44, 0.756, 0.05, "rubber", 0.018);
      bodyObstacle(0.76);
    }
    if (o.type === "office-chair") {
      cyl(g, 0.035, 0.035, 0.42, 0, 0.26, 0, "metal");
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        line(
          g,
          [0, 0.17, 0],
          [Math.sin(a) * 0.29, 0.08, Math.cos(a) * 0.29],
          0.022,
          "metal",
        );
        sphere(
          g,
          Math.sin(a) * 0.28,
          0.05,
          Math.cos(a) * 0.28,
          0.035,
          0.04,
          0.035,
          "rubber",
        );
      }
      box(g, 0.51, 0.1, 0.48, 0, 0.48, 0, "sage", 0.06);
      box(g, 0.49, 0.63, 0.12, 0, 0.87, 0.22, "sage", 0.065);
      for (const x of [-0.3, 0.3]) {
        box(g, 0.055, 0.04, 0.28, x, 0.7, 0.02, "black", 0.02);
        box(g, 0.025, 0.18, 0.025, x, 0.6, 0.1, "metal");
      }
      bodyObstacle(1.2);
    }
    if (o.type === "fridge" || o.type === "laundry") {
      box(
        g,
        w,
        h,
        d,
        0,
        h / 2,
        0,
        o.type === "fridge" ? "steel" : "paint",
        0.025,
      );
      if (o.type === "fridge") {
        for (const s of [-1, 1]) {
          const pivot = new T.Group();
          pivot.position.set((s * w) / 2, 0, d / 2 + 0.014);
          g.add(pivot);
          box(
            pivot,
            w / 2 - 0.008,
            h - 0.06,
            0.03,
            (-s * w) / 4,
            h / 2,
            0.01,
            "steel",
          );
          box(
            pivot,
            0.018,
            0.68,
            0.04,
            -s * (w / 2 - 0.04),
            h * 0.55,
            0.045,
            "metal",
          );
          pivot.userData.moving = true;
          g.updateWorldMatrix(true, true);
          act(
            o.id + s,
            "冰箱门",
            o.room,
            new T.Vector3(o.x, 1, o.z),
            (t) => {
              pivot.rotation.y = s * t * Math.PI * 0.47;
            },
            "appliance",
          );
        }
      } else
        for (const y of [0.46, 1.34]) {
          const ring = mesh(
            g,
            new T.TorusGeometry(0.21, 0.035, 8, 32),
            "metal",
            0,
            y,
            d / 2 + 0.01,
          );
          const drum = cyl(g, 0.18, 0.18, 0.02, 0, y, d / 2 + 0.015, "glass");
          drum.rotation.x = Math.PI / 2;
          box(g, 0.38, 0.05, 0.02, 0, y + 0.33, d / 2 + 0.015, "black");
        }
      bodyObstacle(h);
    }
    if (o.type === "vanity") {
      box(g, w, 0.51, d, 0, 0.55, 0, "paint", 0.015);
      box(g, w + 0.02, 0.06, d + 0.02, 0, 0.84, 0, "stone", 0.012);
      const sink = sphere(g, 0, 0.88, 0.02, 0.25, 0.045, 0.17, "ceramic");
      cyl(g, 0.009, 0.009, 0.16, 0.14, 0.94, -0.17, "steel");
      line(g, [0.14, 1.02, -0.17], [0.14, 1.02, -0.04], 0.009, "steel");
      // A shallow, usable mirror cabinet rather than a painted mirror rectangle.
      box(g, w - 0.02, 0.94, 0.14, 0, 1.62, -d / 2 + 0.05, "charcoal", 0.008);
      for (const side of [-1, 1]) {
        const pivot = new T.Group();
        pivot.position.set(side * (w / 2 - 0.02), 1.16, -d / 2 + 0.125);
        pivot.userData.moving = true;
        g.add(pivot);
        const leaf = box(
          pivot,
          w / 2 - 0.03,
          0.9,
          0.018,
          -side * (w / 4 - 0.015),
          0.45,
          0,
          "mirror",
          0.006,
        );
        g.updateWorldMatrix(true, true);
        movingCollider(o.id + "-mirror-leaf-" + side, leaf);
        act(
          o.id + "-mirror-" + side,
          "镜柜",
          o.room,
          new T.Vector3(0, 1.6, d / 2 + 0.08).applyMatrix4(g.matrixWorld),
          (t) => {
            pivot.rotation.y = side * t * Math.PI * 0.42;
          },
        );
      }
      for (const x of [-w / 2 - 0.025, w / 2 + 0.025])
        box(g, 0.022, 0.7, 0.025, x, 1.59, -d / 2 + 0.03, "glow");
      bodyObstacle(0.9);
    }
    if (o.type === "toilet") {
      sphere(g, 0, 0.26, 0.04, 0.18, 0.24, 0.29, "ceramic");
      sphere(g, 0, 0.45, 0.04, 0.205, 0.055, 0.31, "ceramic");
      box(g, 0.35, 0.37, 0.18, 0, 0.53, -0.23, "ceramic", 0.045);
      box(g, 0.07, 0.012, 0.035, 0, 0.724, -0.23, "steel");
      bodyObstacle(0.8);
    }
    if (o.type === "shower") {
      box(g, w, 0.045, d, 0, 0.025, 0, "stone", 0.025);
      const glass = box(g, 0.012, 2.12, d, -w / 2, 1.1, 0, "glass", 0);
      glass.castShadow = false;
      for (const z of [-d / 2, d / 2])
        box(g, 0.025, 2.2, 0.025, -w / 2, 1.1, z, "metal");
      box(g, w, 2.3, 0.018, 0, 1.15, -d / 2, "tile", 0);
      for (let xx = -w / 2 + 0.15; xx < w / 2; xx += 0.2)
        box(g, 0.002, 2.25, 0.003, xx, 1.15, -d / 2 + 0.012, "paint", 0);
      line(
        g,
        [w / 2 - 0.12, 0.9, -d / 2 + 0.08],
        [w / 2 - 0.12, 2.12, -d / 2 + 0.08],
        0.014,
        "steel",
      );
      line(
        g,
        [w / 2 - 0.12, 2.12, -d / 2 + 0.08],
        [w / 2 - 0.12, 2.12, -d / 2 + 0.37],
        0.014,
        "steel",
      );
      box(
        g,
        0.22,
        0.018,
        0.22,
        w / 2 - 0.12,
        2.1,
        -d / 2 + 0.35,
        "steel",
        0.02,
      );
      colliderRect(o.id, o.x - w / 2, o.z, 0.035, d, 2.3);
    }
    if (o.type === "lamp") {
      cyl(g, 0.18, 0.18, 0.025, 0, 0.018, 0, "metal");
      cyl(g, 0.012, 0.012, 1.1, 0, 0.58, 0, "metal");
      sphere(g, 0, 1.3, 0, 0.2, 0.25, 0.2, "paper");
      bodyObstacle(0.6);
    }
    if (o.type === "plant") {
      cyl(g, 0.16, 0.12, 0.29, 0, 0.15, 0, "ceramic");
      cyl(g, 0.145, 0.145, 0.01, 0, 0.3, 0, "soil");
      for (let j = 0; j < 7; j++) {
        const a = j * 2.4,
          yy = 0.55 + j * 0.09;
        line(
          g,
          [0, 0.29, 0],
          [Math.sin(a) * 0.2, yy, Math.cos(a) * 0.2],
          0.006,
          "leaf",
        );
        const leaf = sphere(
          g,
          Math.sin(a) * 0.2,
          yy,
          Math.cos(a) * 0.2,
          0.11,
          0.018,
          0.22,
          "leaf",
        );
        leaf.rotation.set(0.3, a, 0.35);
      }
      bodyObstacle(h);
    }
    if (o.type === "ac") {
      box(g, w, h, d, 0, h / 2, 0, "paint");
      for (let y = 0.15; y < h - 0.1; y += 0.08)
        box(g, w + 0.005, 0.018, d * 0.7, 0, y, 0.02, "metal");
      bodyObstacle(h);
    }
    g.updateWorldMatrix(true, true);
    const b = new T.Box3().setFromObject(g);
    bounds[o.id] = { min: b.min.toArray(), max: b.max.toArray() };
  }
  function cup(p: T.Object3D, x: number, y: number, z: number) {
    cyl(p, 0.041, 0.032, 0.075, x, y + 0.04, z, "ceramic", 24);
    const h = mesh(
      p,
      new T.TorusGeometry(0.025, 0.006, 6, 18),
      "ceramic",
      x + 0.046,
      y + 0.04,
      z,
    );
    h.rotation.y = Math.PI / 2;
  }
  function book(
    p: T.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) {
    box(p, w, h, d, x, y + h / 2, z, "sage", 0.002);
    box(p, w + 0.002, 0.006, d - 0.015, x, y + h * 0.7, z, "paper", 0);
  }
  function displayTexture(mode: string) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, 1024, 512);
    grad.addColorStop(0, mode === "gaming" ? "#243a4a" : "#767d6c");
    grad.addColorStop(1, mode === "gaming" ? "#576b73" : "#c2b395");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = mode === "gaming" ? "#819a9b" : "#e5d9b8";
    ctx.beginPath();
    ctx.arc(720, 160, 78, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = ["#596e73", "#455e64", "#354c53", "#293f45"][i];
      ctx.beginPath();
      ctx.moveTo(0, 512);
      for (let x = 0; x <= 1024; x += 20)
        ctx.lineTo(x, 290 + i * 42 + Math.sin(x * 0.006 + i) * 45);
      ctx.lineTo(1024, 512);
      ctx.fill();
    }
    ctx.fillStyle = "#e9e2d2";
    ctx.font = "22px Georgia";
    ctx.fillText(mode === "gaming" ? "A QUIET WORLD" : "YAN’S HOME", 55, 458);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  // Architectural coves share one gradient and one emissive material. No extra lights per strip.
  const covePaths: [number, number][][] = [
    [
      [4.92, 4.56],
      [7.43, 4.56],
      [7.43, 10.6],
      [3.58, 10.6],
      [3.58, 7.2],
      [4.92, 7.2],
    ],
    [
      [0.25, 8.04],
      [2.15, 8.04],
      [2.15, 10.87],
      [0.25, 10.87],
    ],
    [
      [8.22, 7.98],
      [11.55, 7.98],
      [11.55, 11.05],
      [8.22, 11.05],
    ],
    [
      [7.25, 0.76],
      [9.38, 0.76],
      [9.38, 3.25],
      [7.25, 3.25],
    ],
    [
      [2.25, 3.95],
      [3.25, 3.95],
      [3.25, 5.55],
      [2.25, 5.55],
    ],
  ];
  for (const path of covePaths) {
    const cove = new T.Group();
    fixed.add(cove);
    roofs.push(cove);
    for (let i = 0; i < path.length; i++) {
      const a = path[i],
        b = path[(i + 1) % path.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        angle = Math.atan2(dz, dx),
        nx = -dz / len,
        nz = dx / len,
        x = (a[0] + b[0]) / 2,
        z = (a[1] + b[1]) / 2;
      const baffle = box(
        cove,
        len + 0.035,
        0.06,
        0.045,
        x,
        2.735,
        z,
        "wall",
        0.002,
      );
      baffle.rotation.y = -angle;
      const seam = box(
        cove,
        len,
        0.008,
        0.018,
        x + nx * 0.035,
        2.773,
        z + nz * 0.035,
        "glow",
        0.001,
      );
      seam.rotation.y = -angle;
      seam.castShadow = false;
      // Miter adjacent gradient strips so their coplanar corner triangles never overlap.
      const offsetAt = (index: number, distance: number) => {
        const prev = path[(index + path.length - 1) % path.length],
          p = path[index],
          next = path[(index + 1) % path.length];
        const l1 = Math.hypot(p[0] - prev[0], p[1] - prev[1]),
          l2 = Math.hypot(next[0] - p[0], next[1] - p[1]);
        const n1 = [-(p[1] - prev[1]) / l1, (p[0] - prev[0]) / l1],
          n2 = [-(next[1] - p[1]) / l2, (next[0] - p[0]) / l2];
        const scale = distance / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
        return [
          p[0] + (n1[0] + n2[0]) * scale,
          2.794,
          p[1] + (n1[1] + n2[1]) * scale,
        ];
      };
      const nextIndex = (i + 1) % path.length;
      const geometry = new T.BufferGeometry();
      geometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(
          [
            ...offsetAt(i, 0.04),
            ...offsetAt(nextIndex, 0.04),
            ...offsetAt(nextIndex, 0.48),
            ...offsetAt(i, 0.48),
          ],
          3,
        ),
      );
      geometry.setAttribute(
        "uv",
        new T.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2),
      );
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();
      cove.add(new T.Mesh(geometry, m.coveWash));
    }
  }
  // A restrained upholstered head wall leaves both continuous corner windows exposed.
  box(fixed, 0.035, 2.35, 2.28, 8.075, 1.33, 9.3, "clay", 0.008);
  for (const z of [8.18, 10.42])
    box(fixed, 0.012, 2.15, 0.012, 8.1, 1.36, z, "glow", 0.002);
  // Pendant shapes and visible strips have physical locations; only a bounded light pool is allocated at runtime.
  for (const [id, x, z, w] of [
    ["dining", 6.35, 5.95, 1.1],
    ["kitchen", 5.5, 2.8, 0.8],
    ["entry", 2.4, 5.8, 0.5],
  ] as const) {
    const y = id === "dining" ? 2.03 : 2.62;
    if (id === "dining") {
      for (const xx of [x - 0.35, x + 0.35])
        line(fixed, [xx, y, z], [xx, HEIGHT - 0.02, z], 0.003, "metal");
      box(fixed, w, 0.05, 0.075, x, y, z, "metal");
      box(fixed, w - 0.04, 0.012, 0.06, x, y - 0.03, z, "glow");
    } else box(fixed, w, 0.045, 0.11, x, y, z, "glow", 0.012);
  }
  // Master bedside shades and a kitchen rail make the close views useful, rather than filling every niche with generic books.
  for (const z of [8.04, 10.55]) {
    cyl(fixed, 0.06, 0.06, 0.014, 8.32, 0.72, z, "metal");
    sphere(fixed, 8.32, 0.86, z, 0.11, 0.13, 0.11, "paper");
  }
  all.updateMatrixWorld(true);
  const contact = shadeFloors(floors, colliders);
  // Batch the whole hideable ceiling layer separately: coves need three draws, not one per strip.
  const ceilingMeshes: T.Mesh[] = [];
  for (const roof of roofs)
    roof.traverse((node) => {
      if (node instanceof T.Mesh) ceilingMeshes.push(node);
    });
  const ceilingBuckets = new Map<string, T.Mesh[]>();
  for (const mesh of ceilingMeshes) {
    const key = `${(mesh.material as T.Material).uuid}:${mesh.castShadow}`;
    if (!ceilingBuckets.has(key)) ceilingBuckets.set(key, []);
    ceilingBuckets.get(key)!.push(mesh);
  }
  const ceilingLayer = new T.Group();
  fixed.add(ceilingLayer);
  let sources = ceilingMeshes.length,
    batches = 0;
  for (const meshes of ceilingBuckets.values()) {
    const geometries = meshes.map((mesh) => {
      let geo = mesh.geometry.clone();
      transformGeometry(geo, mesh.matrixWorld);
      if (geo.index) {
        const flat = geo.toNonIndexed();
        geo.dispose();
        geo = flat;
      }
      return geo;
    });
    const geometry = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    if (!geometry) throw new Error("Incompatible ceiling geometry");
    const batch = new T.Mesh(geometry, meshes[0].material);
    batch.castShadow = meshes[0].castShadow;
    batch.receiveShadow = true;
    ceilingLayer.add(batch);
    batches++;
  }
  for (const roof of roofs) roof.removeFromParent();
  ceilingMeshes.forEach((mesh) => mesh.geometry.dispose());
  roofs.splice(0, roofs.length, ceilingLayer);

  const buckets = new Map<string, T.Mesh[]>();
  all.traverse((n) => {
    if (!(n instanceof T.Mesh) || wallTops.includes(n) || roofs.includes(n))
      return;
    let parent: T.Object3D | null = n;
    while (parent) {
      if (
        parent.userData.moving ||
        wallTops.includes(parent) ||
        cutWalls.includes(parent) ||
        roofs.includes(parent) ||
        (parent.type === "Group" &&
          parent.parent?.parent === all &&
          parent.parent?.name === "")
      )
        return;
      parent = parent.parent;
    }
    // Preserve every articulated door, and bucket fixed meshes per room and material.
    if (colliders.some((c) => c.dynamic === n)) return;
    const pos = new T.Vector3();
    n.getWorldPosition(pos);
    const key = `${Math.floor(pos.x / 3)}:${Math.floor(pos.z / 3)}:${(n.material as T.Material).uuid}:${n.castShadow}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(n);
  });
  // Window groups, roofs and walls are kept available for the overview cutaway.
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map((o) => {
      let geo = o.geometry.clone();
      transformGeometry(geo, o.matrixWorld);
      if (geo.index) {
        const flat = geo.toNonIndexed();
        geo.dispose();
        geo = flat;
      }
      return geo;
    });
    const g = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    if (!g) continue;
    const merged = new T.Mesh(g, meshes[0].material);
    merged.castShadow = meshes[0].castShadow;
    merged.receiveShadow = true;
    scene.add(merged);
    for (const o of meshes) {
      o.removeFromParent();
      o.geometry.dispose();
    }
    sources += meshes.length;
    batches++;
  }
  return {
    colliders,
    actions,
    bounds,
    objectGroups,
    contact,
    batching: { sources, batches, reduced: sources - batches },
    setOverview(on: boolean) {
      wallTops.forEach((o) => (o.visible = !on));
      cutWalls.forEach((o) => (o.visible = on));
      roofs.forEach((o) => (o.visible = !on));
    },
  };
}
import { shell as awaitShellPoints } from "./plan";
function awaitShell() {
  return awaitShellPoints;
}
