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

function addBox(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, name: string) {
  const mesh = new THREE.Mesh(uvBox(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
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
  const cream = materials.r7Pale;
  const wood = materials.r7NicheWood;
  const ink = materials.r7Ink;
  const warm = new THREE.MeshStandardMaterial({ color: "#f6f1e4", roughness: 0.7, side: THREE.DoubleSide });
  warm.userData.r7Role = true;

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
  const faceMat = new THREE.MeshStandardMaterial({ color: "#f4efe4", map: dialTexture() ?? undefined, roughness: 0.45 });
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
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.07, 12), wood);
  pot.position.set(0.02, 0.28, 0);
  pot.name = "r7-pot";
  host.add(pot);
  const camera = addBox(host, 0.07, 0.045, 0.03, 0.12, 0.52, 0, ink, "r7-camera");
  camera.rotation.y = 0.4;
  const menuMap = menuTexture();
  const menuMat = new THREE.MeshBasicMaterial({ color: "#ffffff", map: menuMap ?? undefined, side: THREE.FrontSide });
  menuMat.userData.r7Role = true;
  const menu = new THREE.Group();
  menu.name = "r7-menu";
  const board = new THREE.Mesh(
    new THREE.ExtrudeGeometry(archShape(0.18, 0.30, 0.09), { depth: 0.008, bevelEnabled: false }),
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
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.008, 16), new THREE.MeshStandardMaterial({ color: "#3d6fbf", roughness: 0.45 }));
  disc.position.set(0.16, 0.26, 0);
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.034, 0.09, 10), new THREE.MeshStandardMaterial({ color: "#efe6d2", roughness: 0.55 }));
  vase.position.set(-0.12, 0.28, 0);
  vase.name = "r7-vase";
  host.add(menu, bead, disc, vase);
  end.add(host);
  const bar = scene.getObjectByName(spec.ownerId);
  if (!bar) throw new Error(`R7 dressing missing solid owner ${spec.ownerId}`);
  bar.add(end);
  tag?.(host, spec.end.rooms, "decor");
  tag?.(end, spec.end.rooms, "decor");

  const table = scene.getObjectByName("dining-table");
  const top = table?.children.find((child) => child.type === "Group");
  if (top && materials.r7ClothStripe && spec.cloth) {
    const cloth = new THREE.Mesh(uvBox(spec.cloth.w, 0.001, spec.cloth.d), materials.r7ClothStripe);
    cloth.name = "r7-cloth";
    cloth.position.y = 0.014;
    cloth.castShadow = false;
    cloth.visible = false;
    const fold = new THREE.Mesh(uvBox(0.22, 0.004, 0.16), new THREE.MeshStandardMaterial({ color: "#c6a23a", roughness: 0.9 }));
    fold.name = "r7-cloth-fold";
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
      frame.add(node);
    }
    addBox(frame, 0.22, 0.008, 0.1, 0, -fh / 2 + 0.08, 0.03, new THREE.MeshStandardMaterial({ color: "#e2c14a", roughness: 0.55 }), "r7-tray");
    chromeHost.add(frame);
    tag?.(frame, ["living"], "decor");
  }
  scene.add(root);
  poseR7Lamp(root, 0);
}

export function r7LampClearance(root: THREE.Object3D) {
  const lamp = root.getObjectByName("r7-arm-lamp");
  return lamp?.userData.shadeBottom as number | undefined;
}
