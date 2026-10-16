import * as THREE from "three";
import { buildPegboard } from "./pegboard-mesh";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { metricUV } from "./texture-mapping";

type Materials = Record<string, THREE.Material>;
type Tag = (node: THREE.Object3D, rooms: string[], kind: string) => void;
type Model = Record<string, any>;
export type HomeMotion = {
  model?: Model;
  table?: {
    group: THREE.Group;
    top: THREE.Group;
    legs: THREE.Group[];
    object: any;
  };
  chairs: {
    group: THREE.Group;
    seat: THREE.Group;
    legs: THREE.Group[];
    object: any;
  }[];
  dishwasher?: { group: THREE.Group; pivot: THREE.Group; basket: THREE.Group };
  mobileTV?: { group: THREE.Group; object: any };
  sofaModules: THREE.Group[];
  laundry: { group: THREE.Group; pivot: THREE.Group }[];
  hatch?: {
    group: THREE.Group;
    tray: THREE.Group;
    stool: THREE.Group;
    stop: THREE.Mesh;
  };
  skies: THREE.MeshBasicMaterial[];
};
export const createHomeMotion = (): HomeMotion => ({
  chairs: [],
  laundry: [],
  sofaModules: [],
  skies: [],
});

function box(
  parent: THREE.Object3D,
  m: Materials,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material = "oak",
  radius = 0.006,
) {
  const g = metricUV(
    new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w / 4, h / 4, d / 4)),
  );
  const a = new THREE.Mesh(g, m[material] || m.oak);
  a.position.set(x, y, z);
  a.castShadow = !(m[material]?.transparent || material === "glass");
  a.receiveShadow = true;
  parent.add(a);
  return a;
}
function rod(
  parent: THREE.Object3D,
  m: Materials,
  a: number[],
  b: number[],
  radius = 0.012,
  material = "bronze",
) {
  const start = new THREE.Vector3(...(a as [number, number, number])),
    end = new THREE.Vector3(...(b as [number, number, number]));
  const delta = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, delta.length(), 8),
    m[material] || m.steel,
  );
  mesh.position.copy(start.add(end).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.normalize(),
  );
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function disk(
  parent: THREE.Object3D,
  m: Materials,
  radius: number,
  depth: number,
  y: number,
  material: string,
) {
  const a = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, 48),
    m[material] || m.oak,
  );
  metricUV(a.geometry);
  a.position.y = y;
  a.castShadow = a.receiveShadow = true;
  parent.add(a);
  return a;
}
function smooth(t: number) {
  const a = THREE.MathUtils.clamp(t, 0, 1);
  return a * a * (3 - 2 * a);
}
function followPath(path: number[][], progress: number, target: THREE.Vector3) {
  const lengths = path
    .slice(1)
    .map((point, index) =>
      Math.hypot(point[0] - path[index][0], point[1] - path[index][1]),
    );
  let distance = progress * lengths.reduce((sum, value) => sum + value, 0),
    segment = 0;
  while (segment < lengths.length - 1 && distance > lengths[segment])
    distance -= lengths[segment++];
  const t = lengths[segment] ? distance / lengths[segment] : 1;
  return target.set(
    THREE.MathUtils.lerp(path[segment][0], path[segment + 1][0], t),
    0,
    THREE.MathUtils.lerp(path[segment][1], path[segment + 1][1], t),
  );
}
function vector(p: any, fallback: THREE.Vector3) {
  if (Array.isArray(p))
    return new THREE.Vector3(
      p[0],
      p.length === 3 ? p[1] : fallback.y,
      p.length === 3 ? p[2] : p[1],
    );
  return new THREE.Vector3(
    p?.x ?? fallback.x,
    p?.y ?? fallback.y,
    p?.z ?? fallback.z,
  );
}

/** Real components share one articulated assembly; a state never swaps in a smaller table. */
export function buildHomeFurniture(
  group: THREE.Group,
  o: any,
  m: Materials,
  motion: HomeMotion,
) {
  if (o.type === "pegboard") return buildPegboard(group, o, m);
  if (o.type === "basket") {
    box(group, m, o.w, 0.018, o.d, 0, 0.009, 0, "linen");
    for (const x of [-o.w / 2 + 0.009, o.w / 2 - 0.009])
      box(group, m, 0.018, o.h, o.d, x, o.h / 2, 0, "linen");
    for (const z of [-o.d / 2 + 0.009, o.d / 2 - 0.009])
      box(group, m, o.w - 0.036, o.h, 0.018, 0, o.h / 2, z, "linen");
    for (const x of [-o.w / 2, o.w / 2])
      rod(
        group,
        m,
        [x, o.h - 0.04, -0.06],
        [x, o.h - 0.04, 0.06],
        0.009,
        "salonTimber",
      );
    return true;
  }
  if (o.type === "toilet") {
    const pedestal = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          [0.13, 0],
          [0.14, 0.025],
          [0.11, 0.12],
          [0.1, 0.25],
          [0.15, 0.31],
        ].map(([r, h]) => new THREE.Vector2(r, h)),
        24,
      ),
      m.cream,
    );
    pedestal.scale.z = 1.18;
    pedestal.position.z = -0.02;
    group.add(pedestal);
    const bowl = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          [0.09, 0.25],
          [0.15, 0.28],
          [0.185, 0.36],
          [0.18, 0.43],
          [0.15, 0.43],
          [0.135, 0.36],
          [0.07, 0.31],
          [0.01, 0.31],
        ].map(([r, h]) => new THREE.Vector2(r, h)),
        32,
      ),
      m.cream,
    );
    bowl.scale.z = 1.28;
    bowl.position.z = -0.08;
    bowl.castShadow = bowl.receiveShadow = true;
    group.add(bowl);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.167, 0.012, 8, 40),
      m.cream,
    );
    rim.rotation.x = Math.PI / 2;
    rim.scale.y = 1.25;
    rim.position.set(0, 0.442, -0.08);
    group.add(rim);
    box(group, m, 0.35, 0.39, 0.17, 0, 0.57, 0.23, "cream", 0.03);
    box(group, m, 0.075, 0.006, 0.034, 0, 0.769, 0.23, "steel", 0.008);
    return true;
  }
  if (o.type === "modular_sofa") {
    for (let index = 0; index < 2; index++) {
      const module = new THREE.Group();
      module.name = `sofa-module-${index + 1}`;
      const w = 1.275,
        d = 1.05,
        outer = index === 0 ? 1 : -1;
      box(module, m, w, 0.22, d, 0, 0.245, 0, "salonFabric", 0.065);
      box(
        module,
        m,
        w - 0.045,
        0.15,
        d - 0.06,
        0,
        0.425,
        -0.01,
        "salonFabric",
        0.065,
      );
      box(module, m, w - 0.03, 0.3, 0.17, 0, 0.61, 0.425, "salonFabric", 0.065);
      box(
        module,
        m,
        0.125,
        0.29,
        0.95,
        outer * (w / 2 - 0.0625),
        0.43,
        0,
        "salonFabric",
        0.05,
      );
      for (const x of [-0.5, 0.5])
        for (const z of [-0.36, 0.36])
          box(module, m, 0.045, 0.14, 0.045, x, 0.07, z, "salonTimber");
      box(module, m, 0.04, 0.025, 0.09, (-outer * w) / 2, 0.17, -0.25, "steel");
      const cushion = box(
        module,
        m,
        0.32,
        0.29,
        0.13,
        outer * 0.35,
        0.57,
        0.28,
        index ? "oliveFabric" : "clayFabric",
        0.05,
      );
      cushion.rotation.x = -0.12;
      group.add(module);
      motion.sofaModules.push(module);
    }
    group.userData.animated = true;
    return true;
  }
  if (o.type === "mobile_tv") {
    box(group, m, 1.65, 0.93, 0.055, 0, 1.265, 0, "charcoal", 0.012);
    box(group, m, 1.605, 0.885, 0.009, 0, 1.265, 0.034, "screen", 0.008);
    for (const x of [-0.13, 0.13])
      box(group, m, 0.042, 1.22, 0.045, x, 0.735, -0.08, "bronze");
    box(group, m, 0.64, 0.075, 0.09, 0, 1.26, -0.06, "steel");
    for (const z of [-0.27, 0.27])
      box(group, m, 0.84, 0.042, 0.042, 0, 0.125, z, "steel");
    for (const x of [-0.36, 0.36])
      for (const z of [-0.27, 0.27]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, 0.035, 12),
          m.charcoal,
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.055, z);
        group.add(wheel);
        box(group, m, 0.025, 0.05, 0.025, x, 0.095, z, "steel");
        box(group, m, 0.045, 0.012, 0.065, x, 0.1, z + 0.025, "bronze");
      }
    box(group, m, 0.62, 0.024, 0.3, 0, 0.515, -0.09, "salonTimber");
    const wire = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.23, -0.12),
      new THREE.Vector3(0.04, 0.88, -0.12),
      new THREE.Vector3(0, 0.55, -0.17),
    ]);
    group.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(wire, 12, 0.006, 6, false),
        m.charcoal,
      ),
    );
    motion.mobileTV = { group, object: o };
    group.userData.animated = true;
    return true;
  }
  if (o.type === "washer" || o.type === "dryer") {
    for (const x of [-o.w / 2 + 0.009, o.w / 2 - 0.009])
      box(group, m, 0.018, o.h, o.d, x, o.h / 2, 0, "cream");
    for (const y of [0.009, o.h - 0.009])
      box(group, m, o.w, 0.018, o.d, 0, y, 0, "cream");
    box(group, m, o.w, o.h, 0.018, 0, o.h / 2, o.d / 2 - 0.009, "cream");
    const face = new THREE.Shape();
    face.moveTo(-o.w / 2, 0);
    face.lineTo(o.w / 2, 0);
    face.lineTo(o.w / 2, o.h);
    face.lineTo(-o.w / 2, o.h);
    face.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0.39, 0.2, 0, Math.PI * 2, true);
    face.holes.push(hole);
    const front = new THREE.Mesh(
      new THREE.ExtrudeGeometry(face, {
        depth: 0.018,
        bevelEnabled: false,
        curveSegments: 24,
      }),
      m.cream,
    );
    front.position.z = -o.d / 2;
    group.add(front);
    box(
      group,
      m,
      o.w - 0.03,
      0.115,
      0.025,
      0,
      o.h - 0.065,
      -o.d / 2 - 0.012,
      "steel",
    );
    box(
      group,
      m,
      0.15,
      0.045,
      0.006,
      0.12,
      o.h - 0.065,
      -o.d / 2 - 0.028,
      "screen",
    );
    const drum = new THREE.Mesh(new THREE.CircleGeometry(0.19, 32), m.charcoal);
    drum.rotation.y = Math.PI;
    drum.position.set(0, 0.39, o.d / 2 - 0.06);
    group.add(drum);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, o.d - 0.08, 24, 1, true),
      m.steel,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.39, 0);
    group.add(barrel);
    const pivot = new THREE.Group();
    pivot.position.set(-0.215, 0.39, -o.d / 2 - 0.025);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.205, 0.024, 8, 32),
      m.steel,
    );
    ring.position.x = 0.215;
    pivot.add(ring);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.184, 32), m.glass);
    glass.rotation.y = Math.PI;
    glass.position.set(0.215, 0, -0.005);
    pivot.add(glass);
    box(pivot, m, 0.027, 0.12, 0.035, 0.385, 0, -0.024, "bronze");
    group.add(pivot);
    group.userData.animated = true;
    motion.laundry.push({ group, pivot });
    return true;
  }
  if (o.type === "folding_table") {
    const top = new THREE.Group();
    group.add(top);
    disk(top, m, o.w / 2, 0.025, 0, "salonTimber");
    // Foldable crossed frames. Mechanism is a concept, not a certified product CAD.
    const legs: THREE.Group[] = [];
    for (const sign of [-1, 1]) {
      const frame = new THREE.Group();
      frame.userData.sign = sign;
      for (const x of [-0.24, 0.24])
        rod(frame, m, [x, -0.42, 0], [x, 0.42, 0], 0.014, "bronze");
      rod(frame, m, [-0.24, -0.4, 0], [0.24, -0.4, 0], 0.013, "bronze");
      rod(frame, m, [-0.24, 0.4, 0], [0.24, 0.4, 0], 0.013, "bronze");
      group.add(frame);
      legs.push(frame);
    }
    motion.table = { group, top, legs, object: o };
    group.userData.animated = true;
    return true;
  }
  if (o.type === "folding_chair") {
    const seat = new THREE.Group();
    seat.position.y = 0.45;
    box(seat, m, 0.43, 0.045, 0.43, 0, 0, 0, "salonFabric", 0.015);
    group.add(seat);
    const rear = new THREE.Group(),
      front = new THREE.Group();
    for (const x of [-0.2, 0.2]) {
      rod(rear, m, [x, 0.025, 0.19], [x, 0.86, 0.14], 0.014, "salonTimber");
      rod(front, m, [x, 0.025, -0.19], [x, 0.49, 0.19], 0.014, "salonTimber");
    }
    box(rear, m, 0.43, 0.14, 0.028, 0, 0.765, 0.155, "salonTimber", 0.014);
    rod(front, m, [-0.2, 0.17, -0.09], [0.2, 0.17, -0.09], 0.009, "bronze");
    group.add(rear, front);
    motion.chairs.push({ group, seat, legs: [front, rear], object: o });
    group.userData.animated = true;
    return true;
  }
  if (o.type === "dishwasher") {
    box(group, m, o.w, 0.018, o.d, 0, 0.02, 0, "steel");
    for (const x of [-o.w / 2 + 0.012, o.w / 2 - 0.012])
      box(group, m, 0.024, o.h, o.d, x, o.h / 2, 0, "steel");
    box(group, m, o.w, o.h, 0.02, 0, o.h / 2, o.d / 2 - 0.01, "steel");
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.065, -o.d / 2);
    box(
      pivot,
      m,
      o.w - 0.025,
      o.h - 0.065,
      0.03,
      0,
      (o.h - 0.065) / 2,
      0,
      "cabinetPaint",
    );
    box(pivot, m, 0.3, 0.015, 0.028, 0, o.h - 0.15, -0.025, "bronze");
    group.add(pivot);
    const basket = new THREE.Group();
    basket.position.y = 0.4;
    for (const z of [-0.2, -0.1, 0, 0.1, 0.2])
      rod(basket, m, [-0.23, 0, z], [0.23, 0, z], 0.004, "steel");
    for (const x of [-0.23, -0.12, 0, 0.12, 0.23])
      rod(basket, m, [x, 0, -0.2], [x, 0, 0.2], 0.004, "steel");
    for (const x of [-0.2, -0.08, 0.08, 0.2]) {
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.012, 16),
        m.cream,
      );
      plate.rotation.z = Math.PI / 2;
      plate.position.set(x, 0.08, 0);
      basket.add(plate);
    }
    group.add(basket);
    group.userData.animated = true;
    motion.dishwasher = { group, pivot, basket };
    return true;
  }
  return false;
}

export function buildHomeArchitecture(
  scene: THREE.Scene,
  model: Model,
  m: Materials,
  tag: Tag,
  motion: HomeMotion,
) {
  motion.model = model;
  const device = scene.getObjectByName("ps5");
  if (device && motion.mobileTV) motion.mobileTV.group.attach(device);
  const solids: { room: string; name: string; min: number[]; max: number[] }[] =
    [];
  function group(id: string, rooms: string[], kind = "detail") {
    const g = new THREE.Group();
    g.name = id;
    scene.add(g);
    tag(g, rooms, kind);
    return g;
  }
  function solid(
    g: THREE.Group,
    room: string,
    name: string,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: string,
  ) {
    const a = box(g, m, w, h, d, x, y, z, mat);
    a.name = name;
    solids.push({
      room,
      name,
      min: [x - w / 2, y - h / 2, z - d / 2],
      max: [x + w / 2, y + h / 2, z + d / 2],
    });
    return a;
  }
  const data = new Uint8Array(16 * 64 * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 16; x++) {
      const f = y / 63,
        i = (y * 16 + x) * 4;
      data[i] = 210 - 28 * f;
      data[i + 1] = 219 - 17 * f;
      data[i + 2] = 207 + 9 * f;
      data[i + 3] = 255;
    }
  const skyMap = new THREE.DataTexture(data, 16, 64);
  skyMap.colorSpace = THREE.SRGBColorSpace;
  skyMap.needsUpdate = true;
  // Local exterior projections keep the original floor polygons and structural wall intact.
  for (const bay of model.homeDesign?.bayWindows || []) {
    const opening = model.openings.find((o: any) => o.id === bay.windowId);
    const center = bay.center || opening.center,
      outward = bay.outward || [bay.roomId === "guest" ? -1 : 1, 0];
    const depth = bay.projectionM,
      width = bay.widthM,
      sill = bay.sillHeightM,
      head = bay.headHeightM || 2.35;
    const [cx, cz] = center,
      dx = outward[0];
    const g = group("bay:" + bay.roomId, [bay.roomId], "opening");
    solid(
      g,
      bay.roomId,
      "bay-solid:" + bay.roomId,
      depth + 0.09,
      sill,
      width + 0.12,
      cx + (dx * depth) / 2,
      sill / 2,
      cz,
      "plaster",
    );
    box(
      g,
      m,
      depth + 0.13,
      0.035,
      width + 0.12,
      cx + dx * (depth / 2 - 0.02),
      sill - 0.0175,
      cz,
      "salonStone",
    );
    for (const sign of [-1, 1])
      solid(
        g,
        bay.roomId,
        "bay-reveal:" + bay.roomId,
        depth + 0.09,
        head - sill,
        0.06,
        cx + (dx * depth) / 2,
        (head + sill) / 2,
        cz + sign * (width / 2 + 0.03),
        "plaster",
      );
    solid(
      g,
      bay.roomId,
      "bay-head:" + bay.roomId,
      depth + 0.1,
      0.06,
      width + 0.12,
      cx + (dx * depth) / 2,
      head + 0.03,
      cz,
      "plaster",
    );
    const glazing = new THREE.Group();
    glazing.position.set(cx + dx * depth, sill, cz);
    glazing.rotation.y = Math.PI / 2;
    box(
      glazing,
      m,
      width,
      head - sill,
      0.012,
      0,
      (head - sill) / 2,
      0,
      "glass",
      0,
    );
    for (const sign of [-1, 1])
      box(
        glazing,
        m,
        0.035,
        head - sill,
        0.045,
        (sign * width) / 2,
        (head - sill) / 2,
        0,
        "salonTimber",
      );
    for (const y of [0, head - sill])
      box(glazing, m, width + 0.035, 0.035, 0.045, 0, y, 0, "salonTimber");
    box(
      glazing,
      m,
      0.023,
      head - sill,
      0.035,
      0,
      (head - sill) / 2,
      0,
      "bronze",
    );
    g.add(glazing);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyMap,
      color: "#eef3ef",
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(width, head - sill),
      skyMat,
    );
    sky.position.set(cx + dx * (depth + 0.025), (head + sill) / 2, cz);
    sky.rotation.y = Math.PI / 2;
    g.add(sky);
    motion.skies.push(skyMat);
    // A book and removable tray leave the real sill visible; no invented hollow structural storage.
    box(
      g,
      m,
      0.24,
      0.025,
      0.32,
      cx + dx * 0.28,
      sill + 0.013,
      cz + 0.22,
      "salonTimber",
    );
    box(
      g,
      m,
      0.16,
      0.018,
      0.24,
      cx + dx * 0.28,
      sill + 0.035,
      cz + 0.2,
      "clayFabric",
    );
  }

  // A lightweight loop above the fixed worktop; one concentrated three-tier display remains on the wall.
  const rack = group("home:bar-suspended-loop", ["bar"]);
  const xmin = 0.58,
    xmax = 4.12,
    zmin = 7.58,
    zmax = 8.25,
    y = 2.43;
  for (const z of [zmin, zmax])
    solid(
      rack,
      "bar",
      "bar-loop:rail",
      xmax - xmin,
      0.028,
      0.028,
      (xmin + xmax) / 2,
      y,
      z,
      "bronze",
    );
  for (const x of [xmin, xmax])
    solid(
      rack,
      "bar",
      "bar-loop:return",
      0.028,
      0.028,
      zmax - zmin,
      x,
      y,
      (zmin + zmax) / 2,
      "bronze",
    );
  for (const x of [xmin, xmax])
    for (const z of [zmin, zmax])
      rod(rack, m, [x, y, z], [x, 2.69, z], 0.008, "bronze");
  box(rack, m, 2.0, 0.012, 0.012, 2.3, 2.412, zmin + 0.02, "light", 0.002);
  for (let i = 0; i < 4; i++) {
    const x = 2.1 + i * 0.14;
    // Turned bowl, stem and foot instead of a solid triangular placeholder.
    const profile = [
      [0.001, 0],
      [0.037, 0],
      [0.037, 0.006],
      [0.005, 0.009],
      [0.004, 0.09],
      [0.01, 0.11],
      [0.029, 0.13],
      [0.041, 0.17],
      [0.042, 0.205],
      [0.037, 0.23],
    ].map(([r, h]) => new THREE.Vector2(r, h));
    const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), m.glass);
    cup.rotation.x = Math.PI;
    cup.position.set(x, 2.43, 7.95);
    rack.add(cup);
  }
  for (const z of [7.93, 7.97])
    box(rack, m, 0.7, 0.012, 0.009, 2.31, 2.422, z, "bronze", 0.002);

  const hatchConfig = model.homeDesign?.hatch || {};
  const hx = hatchConfig.hinge?.x ?? 4.705,
    hz = hatchConfig.hinge?.z ?? 7.405;
  const span = hatchConfig.spanM || 0.9,
    depth = hatchConfig.depthM || 0.4,
    height = hatchConfig.heightM || 0.95;
  const hatch = group("opening:hall-gate", ["bar", "hall"], "opening");
  hatch.position.set(hx, height, hz);
  hatch.userData.animated = true;
  box(hatch, m, depth, 0.03, span, 0, -0.015, -span / 2, "salonTimber", 0.01);
  box(hatch, m, depth, 0.012, 0.014, 0, -0.015, -0.04, "bronze", 0.002);
  // Stops and receiver are deliberately independent of the protected column.
  const hardware = group("home:hatch-hardware", ["bar", "hall"]);
  solid(
    hardware,
    "bar",
    "hatch:receiver",
    0.055,
    height - 0.035,
    0.055,
    hx,
    (height - 0.035) / 2,
    hz - span - 0.03,
    "salonTimber",
  );
  box(
    hardware,
    m,
    0.085,
    0.025,
    0.075,
    hx,
    height - 0.042,
    hz - span + 0.003,
    "bronze",
  );
  for (const x of [hx - 0.13, hx + 0.13]) {
    rod(
      hardware,
      m,
      [x, 0.72, hz + 0.06],
      [x, 0.91, hz - 0.03],
      0.009,
      "steel",
    );
    box(hardware, m, 0.035, 0.09, 0.025, x, 0.86, hz + 0.015, "bronze");
  }
  const stop = box(
    hardware,
    m,
    0.025,
    0.025,
    0.065,
    hx + 0.18,
    height + 0.02,
    hz + 0.025,
    "bronze",
  );
  const tray = new THREE.Group();
  hatch.add(tray);
  box(tray, m, 0.27, 0.014, 0.22, 0, 0.015, -span * 0.5, "salonStone");
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.028, 0.065, 16),
    m.cream,
  );
  cup.position.set(0, 0.054, -span * 0.5);
  tray.add(cup);
  const stool = group("home:hatch-stool", ["bar"]);
  stool.userData.animated = true;
  box(stool, m, 0.39, 0.045, 0.36, 0, 0.65, 0, "salonFabric", 0.025);
  for (const x of [-0.16, 0.16])
    for (const z of [-0.14, 0.14])
      rod(stool, m, [x, 0.025, z], [x, 0.64, z], 0.012, "salonTimber");
  rod(stool, m, [-0.16, 0.25, -0.14], [0.16, 0.25, -0.14], 0.009, "bronze");
  box(stool, m, 0.36, 0.17, 0.025, 0, 0.82, 0.16, "salonTimber", 0.012);
  motion.hatch = { group: hatch, tray, stool, stop };

  // One continuous, restrained cinema ceiling datum, not disconnected decorative vaults.
  const cinema = group("home:cinema-composition", ["guest"]);
  for (const x of [0.25, 4.52])
    solid(
      cinema,
      "guest",
      "cinema:ceiling-edge",
      0.025,
      0.035,
      2.85,
      x,
      2.61,
      1.65,
      "salonTimber",
    );
  solid(
    cinema,
    "guest",
    "cinema:ceiling-cross",
    4.3,
    0.035,
    0.025,
    2.385,
    2.61,
    3.075,
    "salonTimber",
  );
  for (const x of [0.6, 3.5])
    solid(
      cinema,
      "guest",
      "cinema:media-edge",
      0.04,
      2.2,
      0.09,
      x,
      1.45,
      3.255,
      "salonTimber",
    );
  solid(
    cinema,
    "guest",
    "cinema:media-head",
    2.94,
    0.04,
    0.09,
    2.05,
    2.53,
    3.255,
    "salonTimber",
  );
  // Books are useful objects at reachable low level, not high cabinetry on every empty wall.
  const living = group("home:living-ritual", ["living"]);
  const media = model.objects.find((o: any) => o.id === "living-tv-console");
  if (media) {
    for (let i = 0; i < 4; i++)
      box(
        living,
        m,
        0.028,
        0.15,
        0.12,
        media.x - 0.7 + i * 0.035,
        media.h + 0.075,
        media.z - 0.025,
        i % 2 ? "clayFabric" : "oliveFabric",
      );
  }
  return {
    version: 9,
    groups: ["bar", "living", "guest"],
    solids,
    bayWindows: model.homeDesign?.bayWindows || [],
    hatch: hatchConfig,
  };
}

/** The same hierarchy supplies rendering and measured dynamic bounds. */
export function applyHomeMotion(
  motion: HomeMotion,
  state: {
    dining: number;
    gate: number;
    dishwasher: number;
    laundry?: number;
    diningRetreat?: number;
    tv?: number;
    sofa?: number;
  },
) {
  const model = motion.model,
    config = model?.homeDesign?.dining;
  if (motion.sofaModules.length && model?.homeDesign?.modularSofa) {
    const design = model.homeDesign.modularSofa,
      t = smooth(state.sofa || 0);
    for (let index = 0; index < motion.sofaModules.length; index++) {
      const module = motion.sofaModules[index],
        parent = module.parent!,
        a = design.combined[index],
        b = design.separated[index];
      parent.updateWorldMatrix(true, false);
      module.position.copy(
        parent.worldToLocal(
          new THREE.Vector3(
            THREE.MathUtils.lerp(a.x, b.x, t),
            0,
            THREE.MathUtils.lerp(a.z, b.z, t),
          ),
        ),
      );
      const parentAngle = -THREE.MathUtils.degToRad(
        model.objects.find((o: any) => o.id === "living-sofa").rotation || 0,
      );
      module.rotation.y =
        -THREE.MathUtils.degToRad(
          THREE.MathUtils.lerp(a.rotation, b.rotation, t),
        ) - parentAngle;
    }
  }
  if (motion.mobileTV) {
    const poses = model?.homeDesign?.mobileTV?.poses;
    if (poses?.length === 2) {
      const t = smooth(state.tv || 0),
        a = poses[0],
        b = poses[1];
      motion.mobileTV.group.position.set(
        THREE.MathUtils.lerp(a.x, b.x, t),
        0,
        THREE.MathUtils.lerp(a.z, b.z, t),
      );
      motion.mobileTV.group.rotation.y = -THREE.MathUtils.degToRad(
        THREE.MathUtils.lerp(a.rotation, b.rotation, t),
      );
    }
  }
  if (motion.table) {
    const { group, top, legs, object } = motion.table;
    const p = state.dining,
      move = smooth(p / 0.24),
      unfold = smooth((p - 0.24) / 0.16);
    const parked = new THREE.Vector3(object.x, object.y || 0, object.z);
    const target = vector(config?.usePositions?.table, parked);
    if (config?.sequence?.tablePath?.length)
      followPath(config.sequence.tablePath, move, group.position);
    else group.position.lerpVectors(parked, target, move);
    const useRotation = config?.usePositions?.table?.rotation ?? 0;
    group.rotation.y = THREE.MathUtils.lerp(
      -THREE.MathUtils.degToRad(object.rotation || 0),
      -THREE.MathUtils.degToRad(useRotation),
      move,
    );
    top.position.y = THREE.MathUtils.lerp(0.7, object.h - 0.0125, unfold);
    top.rotation.x = ((1 - unfold) * Math.PI) / 2;
    for (const frame of legs) {
      frame.position.y = THREE.MathUtils.lerp(0.46, 0.37, unfold);
      frame.rotation.x =
        frame.userData.sign * THREE.MathUtils.lerp(0.04, 0.62, unfold);
    }
  }
  for (let index = 0; index < motion.chairs.length; index++) {
    const { group, seat, legs, object } = motion.chairs[index];
    const p = state.dining,
      move = smooth(
        (p - (index === 0 ? 0.42 : 0.74)) / (index === 0 ? 0.24 : 0.16),
      ),
      unfold = smooth(
        (p - (index === 0 ? 0.66 : 0.9)) / (index === 0 ? 0.06 : 0.1),
      );
    const parked = new THREE.Vector3(object.x, object.y || 0, object.z);
    const use = config?.usePositions?.chairs?.[index];
    const path = config?.sequence?.chairPaths?.[index];
    if (path?.length) {
      const lengths = path
        .slice(1)
        .map((point: number[], i: number) =>
          Math.hypot(point[0] - path[i][0], point[1] - path[i][1]),
        );
      let distance = move * lengths.reduce((a: number, b: number) => a + b, 0),
        segment = 0;
      while (segment < lengths.length - 1 && distance > lengths[segment])
        distance -= lengths[segment++];
      const t = lengths[segment] ? distance / lengths[segment] : 1;
      group.position.set(
        THREE.MathUtils.lerp(path[segment][0], path[segment + 1][0], t),
        0,
        THREE.MathUtils.lerp(path[segment][1], path[segment + 1][1], t),
      );
    } else group.position.lerpVectors(parked, vector(use, parked), move);
    const retreat =
      (state.diningRetreat || 0) *
      unfold *
      (config?.chairs?.[index]?.use?.pullbackM || 0.35);
    group.position.x +=
      Math.sign((use?.x || 0) - (config?.usePositions?.table?.x || 0)) *
      retreat;
    const rotation = use?.rotation ?? object.rotation ?? 0;
    group.rotation.y = THREE.MathUtils.lerp(
      -THREE.MathUtils.degToRad(object.rotation || 0),
      -THREE.MathUtils.degToRad(rotation),
      move,
    );
    seat.rotation.x = ((1 - unfold) * Math.PI) / 2;
    legs[0].rotation.x = (1 - unfold) * -0.45;
    legs[0].position.y = (1 - unfold) * 0.075;
  }
  if (motion.hatch) {
    const p = state.gate,
      { group, tray, stool, stop } = motion.hatch;
    // Clear the top and seat before lifting; leave the open leaf held beyond vertical.
    group.rotation.x =
      THREE.MathUtils.degToRad(model?.homeDesign?.hatch?.openAngleDeg || 95) *
      smooth((p - 0.25) / 0.75);
    tray.visible = p < 0.06;
    stool.visible = !!config?.temporarySeatAvailable;
    stool.position.set(
      4.12 - smooth(p / 0.24) * 0.07,
      0,
      6.95 - smooth(p / 0.24) * 0.8,
    );
    stool.scale.setScalar(1);
    stop.visible = true;
  }
  if (motion.dishwasher) {
    const p = state.dishwasher;
    motion.dishwasher.pivot.rotation.x = (-Math.PI / 2) * smooth(p / 0.65);
    motion.dishwasher.basket.position.z = -0.48 * smooth((p - 0.6) / 0.4);
    motion.dishwasher.basket.visible = p > 0.05;
  }
  for (const item of motion.laundry)
    item.pivot.rotation.y = -(state.laundry || 0) * Math.PI * 0.6;
}
export function homeMotionBounds(motion: HomeMotion) {
  const objects = [
    motion.mobileTV?.group,
    ...motion.sofaModules,
    motion.table?.group,
    ...motion.chairs.map((c) => c.group),
    motion.hatch?.group,
    motion.hatch?.stool,
    motion.dishwasher?.group,
    ...motion.laundry.map((item) => item.group),
  ].filter(Boolean) as THREE.Object3D[];
  return objects.map((group) => {
    group.updateWorldMatrix(true, true);
    const b = homeVisibleBounds(group);
    return {
      id: group.name,
      min: b.min.toArray(),
      max: b.max.toArray(),
      visible: group.visible,
    };
  });
}
/** Hidden props are cleared before motion and do not belong to its swept solid. */
export function homeVisibleBounds(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  function visit(node: THREE.Object3D) {
    if (node !== root && !node.visible) return;
    if (node instanceof THREE.Mesh && node.geometry) {
      if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      bounds.union(
        node.geometry.boundingBox!.clone().applyMatrix4(node.matrixWorld),
      );
    }
    for (const child of node.children) visit(child);
  }
  visit(root);
  return bounds;
}
export function updateHomeLighting(motion: HomeMotion, daylight: boolean) {
  for (const material of motion.skies)
    material.color.set(daylight ? "#eff4f0" : "#495a64");
}
