import * as THREE from "three";
import { metricUV } from "./texture-mapping";

type Tag = (node: THREE.Object3D, rooms: string[], kind: string) => void;

const CEILING = 2.68;
const LENS = [0.46, 0.4, 0.36];

function uvBox(w: number, h: number, d: number) {
  const geo = new THREE.BoxGeometry(w, h, d);
  metricUV(geo);
  return geo;
}

function uvCyl(rt: number, rb: number, h: number, seg = 16) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, seg);
  metricUV(geo);
  return geo;
}

function addBox(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, name: string) {
  const mesh = new THREE.Mesh(uvBox(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.decorativeEnvelope = true;
  mesh.userData.physicsBody = false;
  parent.add(mesh);
  return mesh;
}

function addCyl(parent: THREE.Object3D, rt: number, rb: number, h: number, x: number, y: number, z: number, material: THREE.Material, name: string, seg = 16) {
  const mesh = new THREE.Mesh(uvCyl(rt, rb, h, seg), material);
  mesh.position.set(x, y, z);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.decorativeEnvelope = true;
  mesh.userData.physicsBody = false;
  parent.add(mesh);
  return mesh;
}

function dialTexture() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#f4efe4";
  g.fillRect(0, 0, 256, 256);
  // Triangle in UV is (0,0)-(1,0)-(0.5,1). Keep the dial inside that incircle.
  const cx = 128;
  const cy = 78;
  const rad = 46;
  g.strokeStyle = "#1a1a1a";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cy, rad, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.sin(a) * (rad - 10), cy - Math.cos(a) * (rad - 10));
    g.lineTo(cx + Math.sin(a) * (rad - 3), cy - Math.cos(a) * (rad - 3));
    g.stroke();
  }
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx, cy - 26);
  g.moveTo(cx, cy);
  g.lineTo(cx + 18, cy);
  g.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function portraitTexture() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 320;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#e6dac2";
  g.fillRect(0, 0, 256, 320);
  g.fillStyle = "#a22e29";
  g.beginPath();
  g.ellipse(128, 260, 88, 92, 0, Math.PI, 0, false);
  g.fill();
  g.fillStyle = "#c89b74";
  g.beginPath();
  g.arc(134, 128, 36, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#3b231b";
  g.beginPath();
  g.arc(122, 118, 38, Math.PI * 0.65, Math.PI * 2.05);
  g.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function albumCoverTexture(index: number) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const g = canvas.getContext("2d")!;
  const bg = ["#141619", "#dfd8cb", "#2a3948", "#1d1a18", "#c8b89e", "#384b54"][index % 6];
  g.fillStyle = bg;
  g.fillRect(0, 0, 128, 128);
  if (index === 0) {
    // Prism motif (V11 top-center)
    g.strokeStyle = "#f2efe9";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(64, 28);
    g.lineTo(30, 96);
    g.lineTo(98, 96);
    g.closePath();
    g.stroke();
    ["#d13b2e", "#e29a32", "#dec842", "#4aa056", "#3d7ab8"].forEach((c, i) => {
      g.strokeStyle = c;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(80, 58 + i * 3);
      g.lineTo(126, 68 + i * 5);
      g.stroke();
    });
  } else if (index === 1) {
    // Monochrome portrait motif (V11 top-right)
    g.fillStyle = "#2b2826";
    g.fillRect(16, 20, 96, 88);
    g.fillStyle = "#d9cbb8";
    g.beginPath();
    g.arc(64, 56, 22, 0, Math.PI * 2);
    g.fill();
  } else if (index === 2) {
    // Crosswalk stripes motif (V11 bottom-right)
    g.fillStyle = "#6e8294";
    g.fillRect(0, 0, 128, 68);
    g.fillStyle = "#f0ede6";
    for (let i = 0; i < 5; i++) g.fillRect(14 + i * 22, 82, 14, 32);
  } else {
    g.fillStyle = index % 2 ? "#c4683b" : "#d8a444";
    g.beginPath();
    g.arc(64, 64, 34, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function fitShapeUv(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position");
  const uv = geo.getAttribute("uv");
  if (!pos || !uv) return;
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const sx = bb.max.x - bb.min.x || 1;
  const sy = bb.max.y - bb.min.y || 1;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - bb.min.x) / sx, (pos.getY(i) - bb.min.y) / sy);
  uv.needsUpdate = true;
}

function shadeClothTexture() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#f3eee4";
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    g.fillStyle = y % 8 === 0 ? "rgba(90,70,50,0.16)" : "rgba(255,255,255,0.18)";
    g.fillRect(0, y, 128, 1);
  }
  for (let x = 0; x < 128; x += 5) {
    g.fillStyle = "rgba(80,60,40,0.08)";
    g.fillRect(x, 0, 1, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

function menuTexture() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#f4efe4";
  g.fillRect(0, 0, 512, 768);
  g.fillStyle = "#1c1c1c";
  g.font = "bold 56px Georgia, serif";
  g.fillText("MENU", 150, 150);
  g.font = "32px Georgia, serif";
  ["MuKo highball", "barley tea", "cold brew", "soda"].forEach((line, i) => g.fillText(line, 64, 270 + i * 72));
  g.fillStyle = "#d24a3a";
  g.fillRect(56, 600, 72, 56);
  g.fillStyle = "#e2c14a";
  g.fillRect(148, 612, 56, 44);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function archShape(w: number, h: number, arch: number) {
  const s = new THREE.Shape();
  const hw = w / 2;
  s.moveTo(-hw, -h / 2);
  s.lineTo(hw, -h / 2);
  s.lineTo(hw, -h / 2 + (h - arch));
  s.absarc(0, -h / 2 + (h - arch), hw, 0, Math.PI, false);
  s.lineTo(-hw, -h / 2);
  return s;
}

function roundedTriangle() {
  const s = new THREE.Shape();
  const r = 0.028;
  const p = [new THREE.Vector2(0, 0.15), new THREE.Vector2(-0.145, -0.1), new THREE.Vector2(0.145, -0.1)];
  for (let i = 0; i < 3; i++) {
    const prev = p[(i + 2) % 3];
    const cur = p[i];
    const next = p[(i + 1) % 3];
    const a = prev.clone().sub(cur).normalize();
    const b = next.clone().sub(cur).normalize();
    const start = cur.clone().addScaledVector(a, r);
    const end = cur.clone().addScaledVector(b, r);
    if (i === 0) s.moveTo(start.x, start.y);
    else s.lineTo(start.x, start.y);
    s.quadraticCurveTo(cur.x, cur.y, end.x, end.y);
  }
  s.closePath();
  return s;
}

function chainPoint(open: number) {
  const t = THREE.MathUtils.clamp(open, 0, 1);
  // Swing finishes before any descent. Pitch stays at the stowed value, so the shade
  // height does not change while the links yaw into a closed plan over the anchor.
  const swing = THREE.MathUtils.smoothstep(t, 0, 0.5);
  const lower = THREE.MathUtils.smoothstep(t, 0.5, 1);
  const stowed = new THREE.Vector3(Math.cos(0.18) * Math.sin(-1.05), -Math.sin(0.18), 0).normalize();
  const pitch0 = Math.asin(THREE.MathUtils.clamp(-stowed.y, 0, 1));
  const pitch = THREE.MathUtils.lerp(pitch0, Math.PI / 2, lower);
  const horizontal = LENS.map((len) => Math.cos(pitch0) * len);
  const reach = horizontal[0];
  const alpha = Math.acos(
    THREE.MathUtils.clamp((horizontal[1] ** 2 + reach ** 2 - horizontal[2] ** 2) / (2 * horizontal[1] * reach), -1, 1),
  );
  const az1 = Math.PI / 2 - alpha;
  const az2 = Math.atan2(reach - horizontal[1] * Math.sin(az1), -horizontal[1] * Math.cos(az1));
  const azimuth = [
    -Math.PI / 2,
    THREE.MathUtils.lerp(-Math.PI / 2, az1, swing),
    THREE.MathUtils.lerp(-Math.PI / 2, az2, swing),
  ];
  const pts = [new THREE.Vector3()];
  for (let i = 0; i < 3; i++) {
    const dir = new THREE.Vector3(
      Math.cos(pitch) * Math.sin(azimuth[i]),
      -Math.sin(pitch),
      Math.cos(pitch) * Math.cos(azimuth[i]),
    );
    pts.push(pts[i].clone().addScaledVector(dir, LENS[i]));
  }
  return pts;
}

export function poseR7Lamp(root: THREE.Object3D, dining: number) {
  const lamp = root.getObjectByName("r7-arm-lamp") as THREE.Group | null;
  if (!lamp) return null;
  const open = THREE.MathUtils.smoothstep(dining, 0.94, 1);
  const pts = chainPoint(open);
  const arms = lamp.userData.arms as THREE.Mesh[];
  const joints = lamp.userData.joints as THREE.Mesh[];
  for (let i = 0; i < 3; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a).normalize();
    arms[i].position.copy(mid);
    arms[i].quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const cables = lamp.userData.cables as THREE.Mesh[] | undefined;
    if (cables?.[i]) {
      cables[i].position.copy(mid);
      cables[i].quaternion.copy(arms[i].quaternion);
    }
    joints[i].position.copy(b);
  }
  const cloth = root.parent?.getObjectByName("r7-cloth") ?? root.getObjectByName("r7-cloth");
  if (cloth) cloth.visible = dining >= 0.94;
  const shade = lamp.getObjectByName("r7-lamp-shade") as THREE.Object3D;
  shade.quaternion.identity();
  shade.position.copy(pts[3]);
  shade.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(shade);
  const bottom = box.min.y;
  lamp.userData.shadeBottom = bottom;
  lamp.userData.shadeBox = { min: box.min.toArray(), max: box.max.toArray() };
  lamp.userData.jointsWorld = pts.map((p) => lamp.localToWorld(p.clone()).toArray());
  return { bottom, pts };
}

export function buildR7Dressing(
  scene: THREE.Object3D,
  materials: Record<string, THREE.Material>,
  spec: any,
  tag?: Tag,
) {
  if (!spec || scene.getObjectByName("r7-dressing")) return;
  const root = new THREE.Group();
  root.name = "r7-dressing";
  const steel = new THREE.MeshStandardMaterial({ color: "#c5c9ce", metalness: 0.94, roughness: 0.34, envMapIntensity: 1.85 });
  steel.name = "r7Polish";
  steel.userData.r7Role = true;
  const cream = materials.r7Pale || materials.oak;
  const wood = materials.r7NicheWood || materials.oak;
  const lipWood = materials.r7LipWood || wood;
  const ink = materials.r7Ink || steel;
  const mustard = materials.r7Mustard || new THREE.MeshStandardMaterial({ color: "#c89f36", roughness: 0.86 });
  mustard.userData.r7Role = true;
  const foliageMat = new THREE.MeshStandardMaterial({ color: "#43593a", roughness: 0.78 });
  foliageMat.userData.r7Role = true;
  const warm = new THREE.MeshStandardMaterial({ color: "#f6f1e4", roughness: 0.7, side: THREE.DoubleSide });
  warm.userData.r7Role = true;
  const warmGlow = new THREE.MeshStandardMaterial({
    color: "#f8f0dc",
    emissive: "#ffe4b5",
    emissiveIntensity: 0.35,
    roughness: 0.55,
  });
  warmGlow.userData.r7Role = true;

  const lamp = new THREE.Group();
  lamp.name = "r7-arm-lamp";
  lamp.position.set(spec.lamp.x, spec.lamp.ceilingY, spec.lamp.z);
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 16), steel);
  canopy.position.y = 0.01;
  canopy.name = "r7-canopy";
  lamp.add(canopy);
  const arms: THREE.Mesh[] = [];
  const joints: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, LENS[i], 8), steel);
    arm.name = `r7-arm-${i}`;
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), steel);
    joint.name = `r7-joint-${i}`;
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.006, 8), steel);
    screw.name = `r7-screw-${i}`;
    screw.rotation.z = Math.PI / 2;
    joint.add(screw);
    lamp.add(arm, joint);
    arms.push(arm);
    joints.push(joint);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, LENS[i], 4), ink);
    cable.name = `r7-cable-${i}`;
    lamp.add(cable);
    (lamp.userData.cables ??= []).push(cable);
  }
  const shade = new THREE.Group();
  shade.name = "r7-lamp-shade";
  const shadeMat = (cream?.clone?.() ?? warm) as THREE.MeshStandardMaterial;
  shadeMat.name = "r7ShadeCloth";
  shadeMat.map = shadeClothTexture() ?? null;
  shadeMat.roughness = 0.82;
  shadeMat.metalness = 0;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 0.16, 24, 1, true), shadeMat);
  shell.name = "r7-shade-shell";
  shell.position.y = -0.08;
  const liner = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.188, 0.15, 24, 1, true), warm);
  liner.position.y = -0.08;
  liner.scale.z = -1;
  liner.name = "r7-shade-liner";
  shade.add(shell, liner);
  lamp.add(shade);
  lamp.userData.arms = arms;
  lamp.userData.joints = joints;
  root.add(lamp);
  tag?.(lamp, ["living"], "fixture");

  const clock = new THREE.Group();
  clock.name = "r7-tri-clock";
  clock.position.set(-0.12, spec.clockY - spec.end.y, 0.03);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedTriangle(), { depth: 0.04, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 }), new THREE.MeshStandardMaterial({ color: "#c53636", roughness: 0.42 }));
  body.position.z = -0.02;
  body.name = "r7-clock-body";
  const faceMat = new THREE.MeshStandardMaterial({ color: "#f4efe4", map: dialTexture(), roughness: 0.45 });
  faceMat.userData.r7Role = true;
  const faceGeo = new THREE.ShapeGeometry(roundedTriangle());
  fitShapeUv(faceGeo);
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.scale.set(0.72, 0.72, 1);
  // Extrusion front is z=0.02. Park the dial 8mm further out so the caps do not share a depth.
  face.position.z = 0.028;
  faceMat.side = THREE.DoubleSide;
  face.name = "r7-clock-face";
  clock.add(body, face);
  const end = new THREE.Group();
  end.name = "r7-bar-end";
  end.position.set(spec.end.x, spec.end.y, spec.end.z);
  end.rotation.y = spec.end.yaw;
  end.add(clock);
  tag?.(clock, spec.end.rooms, "decor");

  const host = new THREE.Group();
  host.name = "r7-collect-shelves";
  host.position.set(0.08, 0, spec.end.d / 2);
  for (let i = 0; i < 3; i++) {
    addBox(host, spec.end.w, 0.016, spec.end.d, 0, i * 0.22, 0, wood, "r7-shelf");
    addBox(host, 0.012, 0.07, 0.012, -spec.end.w * 0.32, i * 0.22 - 0.04, 0, ink, "r7-bracket");
    addBox(host, 0.012, 0.07, 0.012, spec.end.w * 0.32, i * 0.22 - 0.04, 0, ink, "r7-bracket");
  }
  const book = addBox(host, 0.02, 0.16, 0.11, -0.16, 0.09, 0, cream, "r7-book");
  book.rotation.z = 0.04;
  const pot = new THREE.Mesh(uvCyl(0.035, 0.028, 0.07, 12), wood);
  pot.position.set(0.02, 0.28, 0);
  pot.name = "r7-pot";
  host.add(pot);
  const camera = addBox(host, 0.07, 0.045, 0.03, 0.12, 0.52, 0, ink, "r7-camera");
  camera.rotation.y = 0.4;
  const menuMap = menuTexture();
  const menuMat = new THREE.MeshBasicMaterial({ color: "#ffffff", map: menuMap, side: THREE.FrontSide });
  menuMat.userData.r7Role = true;
  const menu = new THREE.Group();
  menu.name = "r7-menu";
  const boardGeo = new THREE.ExtrudeGeometry(archShape(0.18, 0.30, 0.09), { depth: 0.008, bevelEnabled: false });
  metricUV(boardGeo);
  const board = new THREE.Mesh(
    boardGeo,
    new THREE.MeshStandardMaterial({ color: "#161616", roughness: 0.45 }),
  );
  board.name = "r7-menu-board";
  const paperGeo = new THREE.ShapeGeometry(archShape(0.15, 0.26, 0.075));
  paperGeo.computeBoundingBox();
  const bb = paperGeo.boundingBox!;
  const pos = paperGeo.getAttribute("position");
  const uv = paperGeo.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
  }
  const paper = new THREE.Mesh(paperGeo, menuMat);
  paper.position.z = 0.01;
  paper.name = "r7-menu-face";
  menu.add(board, paper);
  menu.position.set(0.14, 0.5, 0.08);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), new THREE.MeshStandardMaterial({ color: "#d24a3a", roughness: 0.4 }));
  bead.position.set(-0.08, 0.5, 0);
  const disc = new THREE.Mesh(uvCyl(0.05, 0.05, 0.008, 16), new THREE.MeshStandardMaterial({ color: "#3d6fbf", roughness: 0.45 }));
  disc.position.set(0.16, 0.26, 0);
  const vase = new THREE.Mesh(uvCyl(0.02, 0.034, 0.09, 10), new THREE.MeshStandardMaterial({ color: "#efe6d2", roughness: 0.55 }));
  vase.position.set(-0.12, 0.28, 0);
  vase.name = "r7-vase";
  host.add(menu, bead, disc, vase);
  end.add(host);
  const bar = scene.getObjectByName(spec.ownerId);
  if (!bar) throw new Error(`R7 dressing missing solid owner ${spec.ownerId}`);
  bar.add(end);
  tag?.(host, spec.end.rooms, "decor");
  tag?.(end, spec.end.rooms, "decor");

  // --- V02: Waterbar open niche coffee/barware & 3-tier black-glass display cabinet collection ---
  const glassInside = bar.getObjectByName("r2-waterbar:inside:8");
  if (glassInside) {
    const colGroup = new THREE.Group();
    colGroup.name = "r7-display-collection";
    const amberGlass = new THREE.MeshStandardMaterial({ color: "#9c5828", roughness: 0.22, metalness: 0.08 });
    amberGlass.userData.r7Role = true;
    const cobaltGlass = new THREE.MeshStandardMaterial({ color: "#2d4c7c", roughness: 0.22, metalness: 0.08 });
    cobaltGlass.userData.r7Role = true;
    const emeraldGlass = new THREE.MeshStandardMaterial({ color: "#345942", roughness: 0.24, metalness: 0.06 });
    emeraldGlass.userData.r7Role = true;
    for (const [sy, matA, matB] of [[1.815, amberGlass, cobaltGlass], [2.135, emeraldGlass, cream], [2.455, cobaltGlass, amberGlass]] as const) {
      addCyl(colGroup, 0.026, 0.028, 0.14, 0.08, sy + 0.07, -0.08, matA, "r7-disp-bottle-a", 14);
      addCyl(colGroup, 0.032, 0.024, 0.09, 0.17, sy + 0.045, -0.06, matB, "r7-disp-vessel-b", 14);
      addCyl(colGroup, 0.028, 0.026, 0.075, 0.26, sy + 0.038, -0.09, cream, "r7-disp-cup-c", 14);
    }
    glassInside.add(colGroup);
  }
  const barNicheProps = new THREE.Group();
  barNicheProps.name = "r7-waterbar-niche-props";
  const yellowDome = new THREE.MeshStandardMaterial({ color: "#e2b838", emissive: "#c89620", emissiveIntensity: 0.18, roughness: 0.42 });
  yellowDome.userData.r7Role = true;
  // Small yellow dome lamp in the left open niche (V02)
  addCyl(barNicheProps, 0.024, 0.03, 0.08, -1.46, 0.99, -0.12, steel, "r7-bar-lamp-stem", 12);
  addCyl(barNicheProps, 0.062, 0.078, 0.055, -1.46, 1.055, -0.12, yellowDome, "r7-bar-lamp-shade", 16);
  // Gooseneck kettle, moka pot & bean canisters on the coffee counter (V02)
  addCyl(barNicheProps, 0.042, 0.048, 0.11, -0.12, 1.005, -0.14, steel, "r7-moka-pot", 14);
  addCyl(barNicheProps, 0.044, 0.052, 0.12, 0.04, 1.01, -0.12, ink, "r7-kettle", 16);
  addCyl(barNicheProps, 0.036, 0.036, 0.095, 0.18, 0.998, -0.15, cream, "r7-bean-jar-1", 14);
  addCyl(barNicheProps, 0.034, 0.034, 0.085, 0.27, 0.993, -0.15, wood, "r7-bean-jar-2", 14);
  bar.add(barNicheProps);
  tag?.(barNicheProps, ["bar"], "decor");

  const table = scene.getObjectByName("dining-table");
  const top = table?.children.find((child) => child.type === "Group");
  if (top && materials.r7ClothStripe && spec.cloth) {
    const cloth = new THREE.Mesh(uvBox(spec.cloth.w, 0.001, spec.cloth.d), materials.r7ClothStripe);
    cloth.name = "r7-cloth";
    cloth.position.y = 0.014;
    cloth.castShadow = false;
    cloth.visible = false;
    // Overhang is dress, not the 1.10 x 0.70 table solid or the walk hull.
    cloth.userData.decorativeEnvelope = true;
    cloth.userData.physicsBody = false;
    const fold = new THREE.Mesh(uvBox(0.22, 0.004, 0.16), new THREE.MeshStandardMaterial({ color: "#c6a23a", roughness: 0.9 }));
    fold.name = "r7-cloth-fold";
    fold.userData.decorativeEnvelope = true;
    fold.userData.physicsBody = false;
    fold.position.set(0.18, 0.016, 0.1);
    cloth.add(fold);
    top.add(cloth);
    tag?.(cloth, ["living"], "object");
  }
  if (spec.checker) {
    const cells = new Uint8Array(16 * 16 * 4);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const on = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0;
      const o = (y * 16 + x) * 4;
      cells[o] = on ? 236 : 214;
      cells[o + 1] = on ? 232 : 164;
      cells[o + 2] = on ? 220 : 78;
      cells[o + 3] = 255;
    }
    const tex = new THREE.DataTexture(cells, 16, 16);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.NearestFilter;
    const tile = new THREE.Mesh(uvBox(spec.checker.w, 0.004, spec.checker.d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    tile.name = "r7-checker";
    tile.position.set(spec.checker.x, 0.006, spec.checker.z);
    tile.rotation.y = Math.PI / 4;
    tile.castShadow = false;
    tile.userData.decorativeEnvelope = true;
    tile.userData.physicsBody = false;
    root.add(tile);
    tag?.(tile, ["bar", "hall"], "decor");
  }
  const chromeHost = scene.getObjectByName(spec.chrome?.ownerId);
  if (chromeHost) {
    const frame = new THREE.Group();
    frame.name = "r7-chrome-frame";
    const bay = spec.chrome;
    frame.position.set(bay.x ?? 0, bay.y ?? 1.325, bay.z ?? -0.172);
    const fw = (bay.w ?? 1.9) - 0.04;
    const fh = (bay.h ?? 0.95) - 0.04;
    addBox(frame, fw, 0.008, 0.008, 0, fh / 2, 0, steel, "r7-chrome");
    addBox(frame, fw, 0.008, 0.008, 0, -fh / 2, 0, steel, "r7-chrome");
    addBox(frame, 0.008, fh, 0.008, -fw / 2, 0, 0, steel, "r7-chrome");
    addBox(frame, 0.008, fh, 0.008, fw / 2, 0, 0, steel, "r7-chrome");
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), steel);
      node.position.set(sx * fw / 2, sy * fh / 2, 0);
      node.userData.decorativeEnvelope = true;
      node.userData.physicsBody = false;
      frame.add(node);
    }
    addBox(frame, 0.22, 0.008, 0.1, 0, -fh / 2 + 0.08, 0.03, new THREE.MeshStandardMaterial({ color: "#e2c14a", roughness: 0.55 }), "r7-tray");
    // Open-niche mushroom lamp, art books, framed print and leaning vinyl cover (V04, V14, V15)
    addCyl(frame, 0.025, 0.032, 0.075, -0.52, -fh / 2 + 0.045, 0.06, cream, "r7-living-lamp-base");
    addCyl(frame, 0.065, 0.085, 0.055, -0.52, -fh / 2 + 0.105, 0.06, warmGlow, "r7-living-lamp-dome");
    addBox(frame, 0.24, 0.032, 0.16, -0.48, 0.025, 0.06, ink, "r7-living-artbook-1");
    addBox(frame, 0.21, 0.028, 0.15, -0.48, 0.055, 0.06, cream, "r7-living-artbook-2");
    const vinyl = addBox(frame, 0.28, 0.28, 0.012, 0.58, -fh / 2 + 0.15, 0.07, ink, "r7-living-vinyl");
    vinyl.rotation.x = -0.15;
    chromeHost.add(frame);
    tag?.(frame, ["living"], "decor");
  }

  // --- V01/V02/V03/V20: Kitchen diagonal checkerboard floor, grey-blue backsplash & cream appliance fronts ---
  const kitchenFloor = scene.getObjectByName("floor:kitchen") as THREE.Mesh | null;
  if (kitchenFloor && materials.r7KitchenChecker) {
    kitchenFloor.material = materials.r7KitchenChecker;
    kitchenFloor.userData.r7Locked = true;
  }
  for (const appId of ["kitchen-fridge", "kitchen-dishwasher"]) {
    const app = scene.getObjectByName(appId);
    app?.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const mat = node.material as THREE.Material;
      if (mat === materials.cabinetPaint || mat === materials.cream) {
        node.material = cream;
        node.userData.r7Locked = true;
      }
    });
  }
  if (materials.r7Tile && scene.getObjectByName("r2-kitchen-back")) {
    const kGroup = new THREE.Group();
    kGroup.name = "r7-kitchen-dressing";
    addBox(kGroup, 2.79, 0.70, 0.008, 1.485, 1.30, 3.496, materials.r7Tile, "r7-kitchen-backsplash");
    addBox(kGroup, 0.008, 0.70, 0.65, 0.094, 1.30, 3.82, materials.r7Tile, "r7-kitchen-side-splash");
    const bluePotMat = new THREE.MeshStandardMaterial({ color: "#4d6b88", roughness: 0.35, metalness: 0.15 });
    bluePotMat.userData.r7Role = true;
    addCyl(kGroup, 0.095, 0.088, 0.085, 1.35, 1.005, 3.76, bluePotMat, "r7-kitchen-pot", 20);
    addCyl(kGroup, 0.098, 0.098, 0.015, 1.35, 1.052, 3.76, bluePotMat, "r7-kitchen-pot-lid", 20);
    addCyl(kGroup, 0.026, 0.028, 0.18, 2.32, 1.04, 3.64, new THREE.MeshStandardMaterial({ color: "#3d4c2e", roughness: 0.25 }), "r7-oil-bottle-1", 12);
    addCyl(kGroup, 0.024, 0.026, 0.15, 2.40, 1.025, 3.66, new THREE.MeshStandardMaterial({ color: "#6e4b2a", roughness: 0.3 }), "r7-oil-bottle-2", 12);
    addCyl(kGroup, 0.032, 0.032, 0.09, 2.48, 0.995, 3.68, cream, "r7-salt-jar", 14);
    addCyl(kGroup, 0.085, 0.055, 0.048, 2.64, 0.974, 3.72, lipWood, "r7-fruit-bowl", 18);
    const orangeMat = new THREE.MeshStandardMaterial({ color: "#d97724", roughness: 0.5 });
    orangeMat.userData.r7Role = true;
    for (const [ox, oz] of [[2.62, 3.71], [2.66, 3.73]]) {
      const orange = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), orangeMat);
      orange.position.set(ox, 0.995, oz);
      orange.userData.decorativeEnvelope = true;
      orange.userData.physicsBody = false;
      kGroup.add(orange);
    }
    // Pass-through window inner sill herb pots & bottles (V01, V02)
    for (const [hx, col] of [[0.28, "#8c5438"], [0.46, "#4d6b88"], [0.64, "#3b5238"], [0.82, "#7a4e2d"]] as const) {
      const bMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35 });
      bMat.userData.r7Role = true;
      addCyl(kGroup, 0.024, 0.026, 0.13, hx, 1.015, 5.79, bMat, `r7-sill-bottle-${hx}`, 12);
    }
    root.add(kGroup);
    tag?.(kGroup, ["kitchen", "bar"], "decor");
  }

  // --- V01/V02/V04: Entry wall wood wainscot, column art print & Entry Island runner, yellow mat, tray & mini lamp ---
  const island = scene.getObjectByName("s02-entry-return");
  if (island) {
    const iGroup = new THREE.Group();
    iGroup.name = "r7-island-dressing";
    // Wall-mounted warm wood wainscot on the entry left wall (V01)
    addBox(iGroup, 0.014, 1.04, 0.96, 4.895, 0.52, 7.95, lipWood, "r7-entry-wainscot");
    addBox(iGroup, 0.024, 0.022, 0.96, 4.89, 1.05, 7.95, lipWood, "r7-entry-wainscot-cap");
    // Framed art print on the central structural column (V14, V15)
    addBox(iGroup, 0.016, 0.52, 0.38, 4.808, 1.62, 4.56, wood, "r7-column-art-frame");
    addBox(iGroup, 0.006, 0.46, 0.32, 4.815, 1.62, 4.56, new THREE.MeshStandardMaterial({ color: "#b84a34", roughness: 0.8 }), "r7-column-art-print");
    // Short striped runner & mustard yellow placemat on the 2-person island (V01, V04)
    if (materials.r7ClothStripe) {
      addBox(iGroup, 0.34, 0.003, 1.04, 4.95, 0.952, 7.42, materials.r7ClothStripe, "r7-island-runner");
      addBox(iGroup, 0.34, 0.14, 0.004, 4.95, 0.882, 6.898, materials.r7ClothStripe, "r7-island-runner-drop");
    }
    addBox(iGroup, 0.32, 0.003, 0.42, 4.94, 0.953, 7.86, mustard, "r7-island-placemat");
    addCyl(iGroup, 0.11, 0.11, 0.012, 4.95, 0.96, 7.86, lipWood, "r7-island-tray", 20);
    addCyl(iGroup, 0.028, 0.026, 0.075, 4.92, 0.998, 7.83, cream, "r7-island-cup-1", 14);
    addCyl(iGroup, 0.026, 0.026, 0.065, 4.98, 0.993, 7.89, new THREE.MeshStandardMaterial({ color: "#2f4f86", roughness: 0.4 }), "r7-island-cup-2", 14);
    // Brass cordless table lamp & ceramic vase at the south end of the island (V04)
    const brass = new THREE.MeshStandardMaterial({ color: "#b89658", metalness: 0.78, roughness: 0.32 });
    brass.userData.r7Role = true;
    addCyl(iGroup, 0.038, 0.042, 0.01, 4.96, 0.956, 8.12, brass, "r7-island-lamp-base", 16);
    addCyl(iGroup, 0.006, 0.006, 0.22, 4.96, 1.07, 8.12, brass, "r7-island-lamp-stem", 10);
    addCyl(iGroup, 0.068, 0.072, 0.022, 4.96, 1.185, 8.12, brass, "r7-island-lamp-shade", 18);
    addCyl(iGroup, 0.034, 0.044, 0.15, 4.96, 1.025, 8.24, cream, "r7-island-vase", 16);
    addCyl(iGroup, 0.055, 0.035, 0.12, 4.96, 1.12, 8.24, foliageMat, "r7-island-foliage", 10);
    root.add(iGroup);
    tag?.(iGroup, ["bar", "hall", "living"], "decor");
  }

  // --- V01/V02/V19: Reading corner stereo bookshelf speakers, turntable dust cover & side table props ---
  const recordConsole = scene.getObjectByName("reading-records");
  if (recordConsole) {
    const rGroup = new THREE.Group();
    rGroup.name = "r7-reading-audio";
    for (const [side, xPos] of [["l", -0.44], ["r", 0.44]] as const) {
      const spk = new THREE.Group();
      spk.name = `r7-reading-speaker-${side}`;
      spk.position.set(0, 0.68, 0);
      addBox(spk, 0.16, 0.25, 0.18, xPos, 0.135, 0, wood, `r7-spk-cabinet-${side}`);
      addBox(spk, 0.14, 0.012, 0.16, xPos, 0.006, 0, ink, `r7-spk-stand-${side}`);
      const woofer = new THREE.Mesh(uvCyl(0.048, 0.048, 0.006, 18), ink);
      woofer.rotation.x = Math.PI / 2;
      woofer.position.set(xPos, 0.11, -0.092);
      woofer.userData.decorativeEnvelope = true;
      woofer.userData.physicsBody = false;
      const tweeter = new THREE.Mesh(uvCyl(0.022, 0.022, 0.006, 14), ink);
      tweeter.rotation.x = Math.PI / 2;
      tweeter.position.set(xPos, 0.195, -0.092);
      tweeter.userData.decorativeEnvelope = true;
      tweeter.userData.physicsBody = false;
      spk.add(woofer, tweeter);
      rGroup.add(spk);
    }
    if (materials.r7BlackGlass) {
      addBox(rGroup, 0.42, 0.055, 0.29, -0.15, 0.755, 0, materials.r7BlackGlass, "r7-turntable-lid");
    }
    recordConsole.add(rGroup);
    tag?.(rGroup, ["bar"], "decor");
  }
  const readingSide = scene.getObjectByName("reading-side");
  if (readingSide) {
    const sGroup = new THREE.Group();
    sGroup.name = "r7-reading-side-props";
    addBox(sGroup, 0.18, 0.024, 0.14, -0.02, 0.562, 0, cream, "r7-reading-book");
    addCyl(sGroup, 0.032, 0.028, 0.068, 0.02, 0.608, 0.01, mustard, "r7-reading-mug", 14);
    readingSide.add(sGroup);
    tag?.(sGroup, ["bar"], "decor");
  }

  // --- V04/V05/V14/V15: Mustard knit throw blanket & tufted seams on the black leather modular sofa + side-table cup ---
  const livingSofa = scene.getObjectByName("living-sofa");
  const mod1 = livingSofa?.getObjectByName("sofa-module-1");
  const mod2 = livingSofa?.getObjectByName("sofa-module-2");
  if (mod1) {
    const throwGroup = new THREE.Group();
    throwGroup.name = "r7-sofa-throw";
    throwGroup.userData.decorativeEnvelope = true;
    throwGroup.userData.physicsBody = false;
    addBox(throwGroup, 0.44, 0.03, 0.36, -0.34, 0.768, 0.38, mustard, "r7-throw-top");
    addBox(throwGroup, 0.42, 0.34, 0.03, -0.34, 0.60, 0.525, mustard, "r7-throw-back");
    addBox(throwGroup, 0.40, 0.28, 0.028, -0.34, 0.61, 0.31, mustard, "r7-throw-front");
    addBox(throwGroup, 0.36, 0.28, 0.026, -0.52, 0.32, 0.18, mustard, "r7-throw-side-cascade");
    // Tufted seam lines on the leather seat cushion
    for (const sx of [-0.32, 0, 0.32]) {
      addBox(throwGroup, 0.005, 0.003, 0.72, sx, 0.502, -0.04, ink, `r7-tuft-z-${sx}`);
    }
    mod1.add(throwGroup);
    tag?.(throwGroup, ["living"], "decor");
  }
  if (mod2) {
    const tuftGroup = new THREE.Group();
    tuftGroup.name = "r7-sofa-tuft-2";
    tuftGroup.userData.decorativeEnvelope = true;
    tuftGroup.userData.physicsBody = false;
    for (const sx of [-0.32, 0, 0.32]) {
      addBox(tuftGroup, 0.005, 0.003, 0.72, sx, 0.502, -0.04, ink, `r7-tuft2-z-${sx}`);
    }
    mod2.add(tuftGroup);
    tag?.(tuftGroup, ["living"], "decor");
  }
  const sideTable = scene.getObjectByName("side-table");
  if (sideTable) {
    const stGroup = new THREE.Group();
    stGroup.name = "r7-side-table-props";
    addBox(stGroup, 0.17, 0.02, 0.13, 0, 0.47, 0, cream, "r7-side-book");
    addCyl(stGroup, 0.03, 0.026, 0.065, 0.01, 0.512, 0.01, cream, "r7-side-mug", 14);
    sideTable.add(stGroup);
    tag?.(stGroup, ["living"], "decor");
  }

  // --- V06/V07/V12/V13: Master bedroom plaid bedding, mustard pillow, portrait artwork, pegboard plant & bay props ---
  const masterMattress = scene.getObjectByName("master-mattress");
  if (masterMattress && materials.r7PlaidBedding) {
    masterMattress.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.name === "soft-bedding:pillow" && materials.r7PlaidPillow) {
        node.material = materials.r7PlaidPillow;
        node.userData.r7Locked = true;
      } else if (node.name === "soft-bedding:runner" && materials.r7ClothStripe) {
        node.material = materials.r7ClothStripe;
        node.userData.r7Locked = true;
      }
    });
    const bedDress = new THREE.Group();
    bedDress.name = "r7-master-bedding";
    bedDress.userData.decorativeEnvelope = true;
    bedDress.userData.physicsBody = false;
    // Gingham check duvet + cream folded sheet cuff + mustard center pillow (V06, V13)
    addBox(bedDress, 1.78, 0.042, 1.32, 0, 0.435, 0.31, materials.r7PlaidBedding, "r7-master-duvet");
    addBox(bedDress, 1.79, 0.046, 0.28, 0, 0.44, -0.26, cream, "r7-master-sheet-fold");
    const cushion = addBox(bedDress, 0.38, 0.22, 0.12, 0, 0.52, -0.56, mustard, "r7-master-mustard-pillow");
    cushion.rotation.x = -0.22;
    masterMattress.add(bedDress);
    tag?.(bedDress, ["master"], "decor");
  }
  const masterBed = scene.getObjectByName("master-bed");
  if (masterBed) {
    masterBed.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.position.y < 0.3) {
        node.material = wood;
        node.userData.r7Locked = true;
      }
    });
    const artGroup = new THREE.Group();
    artGroup.name = "r7-master-art";
    artGroup.position.set(0, 1.56, -0.98);
    addBox(artGroup, 0.62, 0.76, 0.022, 0, 0, 0, wood, "r7-master-art-frame");
    const artTex = portraitTexture();
    const canvasMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: artTex,
      roughness: 0.88,
    });
    canvasMat.userData.r7Role = true;
    addBox(artGroup, 0.56, 0.70, 0.006, 0, 0, 0.012, canvasMat, "r7-master-art-canvas");
    // Warm headboard top walnut rail & LED strip (V06, V13)
    addBox(artGroup, 1.84, 0.024, 0.085, 0, -0.665, 0.03, wood, "r7-headboard-cap");
    addBox(artGroup, 1.78, 0.008, 0.016, 0, -0.65, 0.055, warmGlow, "r7-headboard-led");
    masterBed.add(artGroup);
    tag?.(artGroup, ["master"], "decor");
  }
  const masterNightstand = scene.getObjectByName("master-nightstand");
  if (masterNightstand) {
    const nsGroup = new THREE.Group();
    nsGroup.name = "r7-nightstand-props";
    addBox(nsGroup, 0.22, 0.022, 0.16, 0, 0.49, 0, cream, "r7-ns-book");
    addCyl(nsGroup, 0.045, 0.045, 0.06, -0.02, 0.53, 0, wood, "r7-ns-lamp-base", 14);
    addCyl(nsGroup, 0.055, 0.062, 0.055, -0.02, 0.585, 0, warmGlow, "r7-ns-lamp-dome", 16);
    masterNightstand.add(nsGroup);
    tag?.(nsGroup, ["master"], "decor");
  }
  const upperMasterWork = scene.getObjectByName("upper-master-work");
  if (upperMasterWork) {
    const mwGroup = new THREE.Group();
    mwGroup.name = "r7-master-work-props";
    // Trailing vine plant in the open center bay of upper-master-work & pegboard notebook (V07)
    addCyl(mwGroup, 0.055, 0.042, 0.09, -0.18, 0.08, -0.04, cream, "r7-work-vine-pot", 14);
    for (let v = 0; v < 4; v++) {
      addBox(mwGroup, 0.035, 0.14, 0.025, -0.19 + v * 0.022, -0.02 - v * 0.07, -0.12, foliageMat, `r7-work-vine-${v}`);
    }
    upperMasterWork.add(mwGroup);
    tag?.(mwGroup, ["master"], "decor");
  }
  const masterBay = scene.getObjectByName("bay:master");
  if (masterBay) {
    const mbGroup = new THREE.Group();
    mbGroup.name = "r7-master-bay-props";
    addCyl(mbGroup, 0.026, 0.032, 0.075, 11.98, 1.58, 1.05, steel, "r7-mbay-lamp-base", 14);
    addCyl(mbGroup, 0.068, 0.088, 0.055, 11.98, 1.64, 1.05, warmGlow, "r7-mbay-lamp-dome", 16);
    addCyl(mbGroup, 0.032, 0.028, 0.068, 11.96, 0.67, 2.52, cream, "r7-mbay-teacup", 14);
    masterBay.add(mbGroup);
    tag?.(mbGroup, ["master"], "decor");
  }

  // --- V08/V10/V11/V16/V17: Cinema room north-wall vinyl display, open walnut wall shelf, vintage rug & striped throw ---
  const guestSofa = scene.getObjectByName("guest-sofa-bed");
  if (guestSofa) {
    const cGroup = new THREE.Group();
    cGroup.name = "r7-cinema-dressing";
    if (materials.r7CinemaRug) {
      addBox(cGroup, 2.48, 0.006, 2.44, 2.05, 0.012, 1.71, materials.r7CinemaRug, "r7-cinema-rug");
    }
    // Continuous warm walnut headboard datum along the north wall behind both sofa beds (V10, V11, V16, V17)
    addBox(cGroup, 3.28, 0.44, 0.032, 1.82, 0.68, 0.115, wood, "r7-cinema-headboard");
    // Open 2-tier walnut wall bookshelf on the north wall above study-sofa-bed (V11, V16, V17)
    const shelfX = 0.88, shelfY = 1.78, shelfZ = 0.21;
    addBox(cGroup, 0.48, 0.56, 0.20, shelfX, shelfY, shelfZ, wood, "r7-cinema-wall-bookcase");
    addBox(cGroup, 0.44, 0.24, 0.18, shelfX, shelfY + 0.13, shelfZ + 0.012, ink, "r7-cinema-bookcase-upper-void");
    addBox(cGroup, 0.44, 0.24, 0.18, shelfX, shelfY - 0.13, shelfZ + 0.012, ink, "r7-cinema-bookcase-lower-void");
    for (let b = 0; b < 5; b++) {
      addBox(cGroup, 0.032, 0.19, 0.14, shelfX - 0.14 + b * 0.055, shelfY + 0.11, shelfZ + 0.02, b % 2 ? cream : mustard, `r7-cbook-u-${b}`);
      addBox(cGroup, 0.032, 0.20, 0.14, shelfX - 0.14 + b * 0.055, shelfY - 0.14, shelfZ + 0.02, b % 2 ? materials.r7RustPillow || mustard : cream, `r7-cbook-l-${b}`);
    }
    // Six vinyl album covers on two walnut ledges on the cinema NORTH wall above guest-sofa-bed (V11, V16, V17)
    for (let row = 0; row < 2; row++) {
      const y = 1.44 + row * 0.38;
      addBox(cGroup, 1.18, 0.018, 0.042, 2.25, y - 0.145, 0.125, wood, `r7-vinyl-ledge-${row}`);
      for (let col = 0; col < 3; col++) {
        const x = 1.86 + col * 0.39;
        const covTex = albumCoverTexture(row * 3 + col);
        const covMat = new THREE.MeshStandardMaterial({
          color: "#ffffff",
          map: covTex,
          roughness: 0.58,
        });
        covMat.userData.r7Role = true;
        const sleeve = addBox(cGroup, 0.28, 0.28, 0.012, x, y, 0.132, covMat, `r7-cinema-album-${row}-${col}`);
        sleeve.rotation.x = -0.06;
      }
    }
    // Warm mushroom lamp on the cinema study desk (V10, V11)
    addCyl(cGroup, 0.03, 0.038, 0.085, 0.96, 0.785, 2.12, wood, "r7-study-lamp-base", 14);
    addCyl(cGroup, 0.075, 0.095, 0.06, 0.96, 0.85, 2.12, warmGlow, "r7-study-lamp-shade", 16);
    root.add(cGroup);
    tag?.(cGroup, ["guest"], "decor");

    if (materials.r7StripeThrow) {
      const throwBlanket = new THREE.Group();
      throwBlanket.name = "r7-cinema-throw";
      throwBlanket.userData.decorativeEnvelope = true;
      throwBlanket.userData.physicsBody = false;
      addBox(throwBlanket, 0.52, 0.024, 0.56, -0.34, 0.452, -0.08, materials.r7StripeThrow, "r7-cinema-throw-seat");
      addBox(throwBlanket, 0.50, 0.24, 0.024, -0.34, 0.34, -0.365, materials.r7StripeThrow, "r7-cinema-throw-drop");
      guestSofa.add(throwBlanket);
      tag?.(throwBlanket, ["guest"], "decor");
    }
  }

  // --- V09: Balcony washer-dryer cream cabinet surround & warm walnut window sill cap ---
  const washer = scene.getObjectByName("washer");
  if (washer) {
    const bGroup = new THREE.Group();
    bGroup.name = "r7-balcony-dressing";
    // Cream cabinet surround framing the stacked washer & dryer (V09)
    addBox(bGroup, 0.032, 1.92, 0.66, 11.88, 0.96, 8.93, cream, "r7-laundry-surround-l");
    addBox(bGroup, 0.68, 0.14, 0.66, 12.22, 1.85, 8.93, cream, "r7-laundry-surround-top");
    root.add(bGroup);
    tag?.(bGroup, ["balcony"], "decor");
  }

  scene.add(root);
  poseR7Lamp(root, 0);
}

export function r7LampClearance(root: THREE.Object3D) {
  const lamp = root.getObjectByName("r7-arm-lamp");
  return lamp?.userData.shadeBottom as number | undefined;
}
