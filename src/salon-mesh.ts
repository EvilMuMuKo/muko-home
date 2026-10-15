import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { metricUV } from "./texture-mapping";
import { salonFurnitureIds } from "./salon-design";
type Materials = Record<string, THREE.Material>;
interface ObjectDef {
  id: string;
  type: string;
  room?: string;
  w: number;
  h: number;
  d: number;
  x: number;
  z: number;
  rotation?: number;
  retreat?: { x: number; z: number; distanceM: number };
}
export interface Solid {
  room: string;
  name: string;
  min: number[];
  max: number[];
}
function roundedRect(w: number, d: number, r: number) {
  const s = new THREE.Shape(),
    x = -w / 2,
    y = -d / 2;
  r = Math.min(r, w / 2, d / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function meshTools(m: Materials) {
  function mesh(
    parent: THREE.Object3D,
    g: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    material: string,
  ) {
    metricUV(g);
    const a = new THREE.Mesh(g, m[material]);
    a.position.set(x, y, z);
    a.castShadow = true;
    a.receiveShadow = true;
    parent.add(a);
    return a;
  }
  function box(
    p: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: string,
    r = 0.006,
  ) {
    return mesh(
      p,
      new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)),
      x,
      y,
      z,
      mat,
    );
  }
  function slab(
    p: THREE.Object3D,
    w: number,
    d: number,
    h: number,
    x: number,
    y: number,
    z: number,
    mat: string,
    r = 0.12,
  ) {
    const g = new THREE.ExtrudeGeometry(roundedRect(w, d, r), {
      depth: h,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.003,
      bevelThickness: 0.003,
      curveSegments: 12,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -h / 2, 0);
    return mesh(p, g, x, y, z, mat);
  }
  function cyl(
    p: THREE.Object3D,
    top: number,
    bottom: number,
    h: number,
    x: number,
    y: number,
    z: number,
    mat: string,
    segments = 40,
  ) {
    return mesh(
      p,
      new THREE.CylinderGeometry(top, bottom, h, segments),
      x,
      y,
      z,
      mat,
    );
  }
  function tube(
    p: THREE.Object3D,
    points: THREE.Vector3[],
    radius: number,
    mat: string,
    segments = 56,
  ) {
    return mesh(
      p,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        segments,
        radius,
        8,
        false,
      ),
      0,
      0,
      0,
      mat,
    );
  }
  return { mesh, box, slab, cyl, tube };
}
export function buildSalonFurniture(
  group: THREE.Group,
  o: ObjectDef,
  m: Materials,
  moving: {
    chairs: {
      group: THREE.Group;
      base: THREE.Vector3;
      retreat: NonNullable<ObjectDef["retreat"]>;
      distance: number;
    }[];
  },
) {
  if (!salonFurnitureIds.includes(o.id)) return false;
  const { mesh, box, slab, cyl, tube } = meshTools(m),
    wood = "salonTimber",
    cloth = "salonFabric";
  if (o.id === "dining-table") {
    slab(group, o.w, o.d, 0.035, 0, o.h - 0.018, 0, "salonStone", 0.32);
    const pedestal = cyl(
      group,
      0.17,
      0.24,
      0.65,
      0,
      0.35,
      0,
      "salonReeded",
      56,
    );
    pedestal.scale.z = 0.78;
    slab(group, 0.6, 0.43, 0.035, 0, 0.027, 0, wood, 0.18);
  }
  if (o.id === "dining-chair-left") {
    slab(group, o.w - 0.04, o.d - 0.035, 0.3, 0, 0.23, 0, "salonReeded", 0.06);
    box(group, o.w - 0.05, 0.09, o.d - 0.045, 0, 0.43, -0.005, cloth, 0.035);
    box(group, o.w, 0.32, 0.095, 0, 0.635, 0.19, cloth, 0.045);
    box(group, 0.045, 0.11, o.d - 0.03, -o.w / 2 + 0.023, 0.37, 0, wood, 0.02);
    box(group, 0.045, 0.11, o.d - 0.03, o.w / 2 - 0.023, 0.37, 0, wood, 0.02);
  }
  if (o.id === "dining-chair-right") {
    for (const x of [-0.21, 0.21])
      for (const z of [-0.19, 0.19]) {
        const leg = box(group, 0.035, 0.43, 0.036, x, 0.215, z, wood, 0.012);
        leg.rotation.z = -Math.sign(x) * 0.06;
      }
    slab(group, 0.51, 0.5, 0.032, 0, 0.435, 0, wood, 0.17);
    box(group, 0.49, 0.075, 0.47, 0, 0.485, -0.015, cloth, 0.035);
    const outer = 0.287,
      inner = 0.261,
      s = new THREE.Shape();
    s.absarc(0, 0, outer, 0.04, Math.PI - 0.04, false);
    s.lineTo(-inner * Math.cos(0.04), inner * Math.sin(0.04));
    s.absarc(0, 0, inner, Math.PI - 0.04, 0.04, true);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.125,
      bevelEnabled: true,
      bevelSize: 0.004,
      bevelThickness: 0.004,
      bevelSegments: 2,
      curveSegments: 32,
    });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0.765, -0.02);
    mesh(group, geo, 0, 0, 0, wood);
    for (const x of [-0.22, 0.22])
      box(group, 0.028, 0.2, 0.028, x, 0.6, 0.19, wood, 0.01);
    if (o.retreat)
      moving.chairs.push({
        group,
        base: group.position.clone(),
        retreat: o.retreat,
        distance: o.retreat.distanceM,
      });
  }
  if (o.id === "living-sofa") {
    slab(group, 2.36, 0.9, 0.16, 0, 0.19, 0, wood, 0.17);
    for (const x of [-1.0, 1.0])
      for (const z of [-0.34, 0.34])
        cyl(group, 0.025, 0.028, 0.12, x, 0.06, z, "salonDarkTimber", 16);
    for (const x of [-0.6, 0.6])
      box(group, 1.17, 0.19, 0.76, x, 0.405, -0.065, cloth, 0.085);
    const points = [
      [-1.12, 0.54, -0.22],
      [-1.12, 0.54, 0.22],
      [-0.86, 0.54, 0.37],
      [0, 0.54, 0.4],
      [0.86, 0.54, 0.37],
      [1.12, 0.54, 0.22],
      [1.12, 0.54, -0.22],
    ].map((p) => new THREE.Vector3(...p));
    const back = tube(group, points, 0.12, cloth, 72),
      positions = back.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++)
      positions.setY(i, 0.54 + (positions.getY(i) - 0.54) * 1.62);
    back.geometry.computeVertexNormals();
    metricUV(back.geometry);
    for (const [x, mat] of [
      [-0.78, "salonClay"],
      [0.74, "oliveFabric"],
    ] as const) {
      const cushion = box(group, 0.38, 0.25, 0.14, x, 0.56, 0.2, mat, 0.06);
      cushion.rotation.x = -0.17;
      cushion.rotation.z = x < 0 ? 0.09 : -0.08;
    }
  }
  if (o.id === "side-table") {
    const pts = [
      [0, 0],
      [0.14, 0],
      [0.16, 0.035],
      [0.1, 0.11],
      [0.065, 0.26],
      [0.09, 0.38],
      [0.16, 0.43],
      [0.16, 0.45],
      [0, 0.45],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    mesh(group, new THREE.LatheGeometry(pts, 40), 0, 0, 0, wood);
    slab(group, 0.38, 0.38, 0.025, 0, 0.447, 0, "salonStone", 0.17);
  }
  if (o.id === "salon-coffee-table") {
    slab(group, o.w, o.d, 0.045, 0, 0.292, 0, wood, 0.25);
    slab(group, 0.59, 0.32, 0.25, 0, 0.14, 0, "salonDarkStone", 0.14);
    slab(group, 0.24, 0.16, 0.012, -0.23, 0.325, -0.07, "salonStone", 0.04);
  }
  if (o.id === "living-lamp") {
    cyl(group, 0.17, 0.18, 0.025, 0, 0.018, 0, "bronze", 36);
    cyl(group, 0.012, 0.014, 1.23, 0, 0.64, 0, wood, 20);
    const points = [
      [0, 0],
      [0.11, 0],
      [0.16, 0.05],
      [0.2, 0.17],
      [0.19, 0.3],
      [0.14, 0.4],
      [0.07, 0.44],
      [0, 0.44],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const shade = mesh(
      group,
      new THREE.LatheGeometry(points, 48),
      0,
      1.05,
      0,
      "salonPaper",
    );
    shade.castShadow = false;
    for (const [y, r] of [
      [1.1, 0.16],
      [1.22, 0.2],
      [1.35, 0.18],
    ] as const) {
      const hoop = mesh(
        group,
        new THREE.TorusGeometry(r, 0.0016, 4, 48),
        0,
        y,
        0,
        "piping",
      );
      hoop.rotation.x = Math.PI / 2;
      hoop.castShadow = false;
    }
  }
  group.userData.salonFurniture = true;
  return true;
}

export function buildSalonArchitecture(
  scene: THREE.Scene,
  m: Materials,
  tag: (n: THREE.Object3D, rooms: string[], kind: string) => void,
) {
  const { mesh, box, slab, tube } = meshTools(m),
    solids: Solid[] = [],
    groups = new Map<string, THREE.Group>();
  function room(id: string) {
    if (!groups.has(id)) {
      const g = new THREE.Group();
      g.name = "salon:" + id;
      scene.add(g);
      tag(g, [id], "detail");
      groups.set(id, g);
    }
    return groups.get(id)!;
  }
  function solid(
    roomId: string,
    name: string,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: string,
    r = 0.008,
  ) {
    const a = box(room(roomId), w, h, d, x, y, z, mat, r);
    a.name = name;
    solids.push({
      room: roomId,
      name,
      min: [x - w / 2, y - h / 2, z - d / 2],
      max: [x + w / 2, y + h / 2, z + d / 2],
    });
    return a;
  }
  // Three related deep frames: continuous edges, recesses and inset storage, without reducing cabinet inner space.
  for (const x of [0.1, 5.0])
    solid(
      "bar",
      "bar:portal-jamb",
      0.065,
      1.7,
      0.41,
      x,
      1.82,
      8.155,
      "salonFrame",
      0.02,
    );
  solid(
    "bar",
    "bar:portal-crown",
    4.965,
    0.085,
    0.49,
    2.55,
    2.6425,
    8.115,
    "salonFrame",
    0.018,
  );
  // A single calm media composition wraps the existing upper and lower storage.
  for (const x of [7.99, 11.25])
    solid(
      "living",
      "living:media-pier",
      0.07,
      2.18,
      0.31,
      x,
      1.54,
      4.65,
      "salonMediaFrame",
      0.018,
    );
  solid(
    "living",
    "living:media-crown",
    3.33,
    0.08,
    0.36,
    9.62,
    2.64,
    4.65,
    "salonMediaFrame",
    0.016,
  );
  const inset = slab(
    room("living"),
    2.68,
    1.35,
    0.032,
    9.35,
    0,
    0,
    "salonDarkStone",
    0.16,
  );
  inset.rotation.x = Math.PI / 2;
  inset.position.set(9.35, 1.16, 4.515);
  // Proscenium: the screen, cabinets and speakers sit within an architectural depth.
  for (const x of [0.25, 3.25])
    solid(
      "guest",
      "cinema:proscenium-jamb",
      0.09,
      2.58,
      0.35,
      x,
      1.35,
      3.11,
      "salonCinemaFrame",
      0.025,
    );
  solid(
    "guest",
    "cinema:proscenium-crown",
    3.09,
    0.075,
    0.4,
    1.75,
    2.6425,
    3.085,
    "salonCinemaFrame",
    0.018,
  );
  // Continuous upholstered rear wall, lower than the existing bedside storage.
  for (let i = 0; i < 5; i++)
    solid(
      "guest",
      "cinema:upholstered-bay",
      0.64,
      0.88,
      0.045,
      0.65 + i * 0.68,
      1.31,
      0.1175,
      "salonPanel",
      0.035,
    );
  solid(
    "guest",
    "cinema:rear-datum",
    3.45,
    0.025,
    0.06,
    2.01,
    0.85,
    0.13,
    "salonDarkTimber",
    0.006,
  );
  // Two shallow barrel shells create a perceptible inner room while keeping >2.49 m headroom.
  for (const [a, b] of [
    [1.05, 1.68],
    [1.78, 2.42],
  ]) {
    const g = new THREE.PlaneGeometry(3.05, b - a, 48, 8),
      p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        t = (x + 1.525) / 3.05,
        z = (a + b) / 2 + p.getY(i);
      p.setXYZ(i, 2.075 + x, 2.5 + 0.15 * Math.sin(t * Math.PI), z);
    }
    g.computeVertexNormals();
    metricUV(g);
    const material = (m.salonVault as THREE.MeshStandardMaterial).clone();
    material.side = THREE.DoubleSide;
    const shell = new THREE.Mesh(g, material);
    shell.castShadow = true;
    shell.receiveShadow = true;
    shell.name = "cinema:barrel-shell";
    room("guest").add(shell);
    solids.push({
      room: "guest",
      name: shell.name,
      min: [0.538, 2.488, a - 0.012],
      max: [3.612, 2.672, b + 0.012],
    });
    for (const z of [a, b]) {
      const pts = Array.from({ length: 49 }, (_, i) => {
        const t = i / 48;
        return new THREE.Vector3(
          0.55 + 3.05 * t,
          2.5 + 0.15 * Math.sin(t * Math.PI),
          z,
        );
      });
      tube(room("guest"), pts, 0.012, "salonDarkTimber", 48);
    }
  }
  // Pad the existing storage bench without removing the original cabinet body.
  const bench = scene.getObjectByName("guest-window-bench");
  if (bench) box(bench, 0.4, 0.045, 1.075, 0, 0.455, 0, "salonFabric", 0.02);
  // Warm timber cap on the convertible sofa arms; stays inside its original envelope.
  const bed = scene.getObjectByName("guest-sofa-bed");
  if (bed)
    for (const x of [-0.7, 0.7])
      box(bed, 0.105, 0.026, 0.7, x, 0.48, 0.015, "salonTimber", 0.012);
  // Curate lower cabinet fronts into the same timber family; upper storage remains visually quiet.
  for (const id of [
    "wet-bar",
    "s02-bar-beer",
    "s02-entry-return",
    "s02-bar-coffee",
    "s02-bar-prep",
    "s02-bar-storage",
    "s02-bar-service",
    "living-tv-console",
    "living-rear-storage",
  ]) {
    scene.getObjectByName(id)?.traverse((n) => {
      if (
        n instanceof THREE.Mesh &&
        (n.material === m.barPaint || n.material === m.livingPaint)
      )
        n.material = m.salonReeded;
    });
  }
  for (const roomId of ["bar", "living"]) {
    scene.traverse((n) => {
      if (
        !(n instanceof THREE.Group) ||
        !n.userData.spaceIds?.includes(roomId) ||
        n.name.startsWith("salon:")
      )
        return;
      n.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        if (child.material === m.barWood || child.material === m.livingWood)
          child.material = m.salonTimber;
        if (
          roomId === "bar" &&
          (child.material === m.barStone || child.material === m.stone)
        )
          child.material = m.salonStone;
      });
    });
  }
  // Merge all fixed architectural details by room/material; transparent and moving parts stay separate.
  let sources = 0,
    batches = 0;
  for (const group of groups.values()) {
    group.updateMatrixWorld(true);
    const buckets = new Map<THREE.Material, THREE.Mesh[]>();
    group.traverse((n) => {
      if (n instanceof THREE.Mesh) {
        const a = n.material as THREE.Material;
        if (!buckets.has(a)) buckets.set(a, []);
        buckets.get(a)!.push(n);
      }
    });
    for (const [material, meshes] of buckets) {
      if (meshes.length < 2) continue;
      const gs = meshes.map((a) => {
        const g = a.geometry.clone().applyMatrix4(a.matrixWorld);
        if (g.index) {
          const flat = g.toNonIndexed();
          g.dispose();
          return flat;
        }
        return g;
      });
      const merged = mergeGeometries(gs);
      gs.forEach((g) => g.dispose());
      if (!merged) continue;
      for (const a of meshes) {
        a.removeFromParent();
        a.geometry.dispose();
      }
      const a = new THREE.Mesh(merged, material);
      a.castShadow = true;
      a.receiveShadow = true;
      group.add(a);
      sources += meshes.length;
      batches++;
    }
  }
  return {
    solids,
    groups: [...groups.keys()],
    batching: { sources, batches, drawCallsReduced: sources - batches },
    language: "deep frames / low furniture / vaulted inner room",
  };
}
