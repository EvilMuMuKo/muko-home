import * as THREE from "three";
import { metricUV } from "./texture-mapping";

export function r7FoldTheta(progress: number) {
  return Math.max(0, Math.min(1, progress)) * Math.PI / 2;
}

/** World hinge samples for one 700+700 pair. z0 is the closed plane. */
export function r7FoldPoints(progress: number, z0 = 5.85) {
  const t = r7FoldTheta(progress);
  const yA = 2.35;
  return {
    theta: t,
    A: { z: z0, y: yA },
    B: { z: z0 + 0.7 * Math.sin(t), y: yA - 0.7 * Math.cos(t) },
    C: { z: z0, y: yA - 1.4 * Math.cos(t) },
  };
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, name: string) {
  const mesh = new THREE.Mesh(metricUV(new THREE.BoxGeometry(w, h, d)), material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = !/glass/i.test(material.name || "");
  mesh.receiveShadow = true;
  mesh.userData.animated = true;
  parent.add(mesh);
  return mesh;
}

function leafFrame(parent: THREE.Object3D, width: number, length: number, z: number, frame: THREE.Material, glass: THREE.Material, prefix: string, t = 0.025) {
  const d = 0.012;
  box(parent, t, length, d, -width / 2 + t / 2, -length / 2, z, frame, `${prefix}-stile-l`);
  box(parent, t, length, d, width / 2 - t / 2, -length / 2, z, frame, `${prefix}-stile-r`);
  box(parent, width, t, d, 0, -t / 2, z, frame, `${prefix}-rail-a`);
  box(parent, width, t, d, 0, -length + t / 2, z, frame, `${prefix}-rail-b`);
  box(parent, width - t * 2, length - t * 2, 0.006, 0, -length / 2, z, glass, `${prefix}-glass`);
}

/** Bi-fold pass. Leaves are not pushed onto the linear sliding-door list. */
export function buildR7PassWindow(
  scene: THREE.Object3D,
  opening: any,
  materials: Record<string, THREE.Material>,
  tag?: (g: THREE.Object3D, rooms: string[], kind: string) => void,
) {
  const root = new THREE.Group();
  root.name = "opening:" + opening.id;
  const planeZ = opening.planeZ ?? opening.sweep?.z0;
  const x0 = opening.x0;
  const x1 = opening.x1;
  const groups = opening.groups;
  const width = opening.groupWidth;
  const leaf = opening.leafLength;
  const head = opening.head;
  const sill = opening.sill;
  const frameM = opening.frameM;
  const fixed = opening.fixedGlass;
  const header = opening.header;
  if ([planeZ, x0, x1, groups, width, leaf, head, sill, frameM].some((v) => typeof v !== "number") || !fixed || !header?.reveal) {
    throw new Error("r7 pass opening is missing fold metadata");
  }
  if (Math.abs(x1 - (x0 + groups * width)) > 0.02) throw new Error("r7 fold groups do not fill x0..x1");
  root.position.set(0, 0, planeZ);
  root.userData.animated = true;
  root.userData.r7Fold = true;
  root.userData.r7Groups = groups;
  scene.add(root);
  tag?.(root, ["kitchen", "bar", "hall"], "opening");
  const frameMat = materials.charcoal || materials.black || materials.steel;
  const pale = materials.r7Pale || materials.cabinetPaint || frameMat;
  const glassMat = materials.glass || materials.displayGlass || frameMat;
  const steel = materials.r7Brushed || materials.steel;
  const hz = header.localZ;
  const hd = header.depth;
  const span = fixed.x1;
  const reveal = header.reveal;
  box(root, span, header.y1 - reveal.y1, hd, span / 2, (header.y1 + reveal.y1) / 2, hz, pale, "r7-header-cap");
  box(root, span, reveal.y0 - header.y0, hd, span / 2, (header.y0 + reveal.y0) / 2, hz, pale, "r7-header-sill");
  box(root, reveal.x0, reveal.y1 - reveal.y0, hd, reveal.x0 / 2, (reveal.y0 + reveal.y1) / 2, hz, pale, "r7-header-left");
  box(root, span - reveal.x1, reveal.y1 - reveal.y0, hd, (reveal.x1 + span) / 2, (reveal.y0 + reveal.y1) / 2, hz, pale, "r7-header-right");
  const fx0 = fixed.x0;
  const fx1 = fixed.x1;
  const fcx = (fx0 + fx1) / 2;
  const fcy = (sill + head) / 2;
  box(root, fx1 - fx0, frameM, frameM, fcx, head - frameM / 2, 0, frameMat, "r7-fixed-top");
  box(root, fx1 - fx0, frameM, frameM, fcx, sill + frameM / 2, 0, frameMat, "r7-fixed-sill");
  box(root, frameM, head - sill, frameM, fx0 + frameM / 2, fcy, 0, frameMat, "r7-fixed-left");
  box(root, frameM, head - sill, frameM, fx1 - frameM / 2, fcy, 0, frameMat, "r7-fixed-right");
  box(root, fx1 - fx0 - frameM * 2, head - sill - frameM * 2, 0.006, fcx, fcy, 0, glassMat, "r7-fixed-glass");
  box(root, frameM, head - sill, frameM, fx1, (sill + head) / 2, 0, frameMat, "r7-corner-post");
  for (let g = 0; g < groups; g++) {
    const cx = x0 + width / 2 + g * width;
    const upper = new THREE.Group();
    upper.name = `r7-fold-upper-${g}`;
    upper.position.set(cx, head, 0);
    upper.userData.animated = true;
    root.add(upper);
    leafFrame(upper, width, leaf, 0.022, frameMat, glassMat, `r7-upper-${g}`, frameM);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, Math.min(0.12, width * 0.1), 10), steel);
    pin.rotation.z = Math.PI / 2;
    pin.name = `r7-hinge-${g}`;
    pin.position.set(0, 0, 0.03);
    pin.castShadow = true;
    upper.add(pin);
    const lower = new THREE.Group();
    lower.name = `r7-fold-lower-${g}`;
    lower.position.set(0, -leaf, 0);
    lower.userData.animated = true;
    upper.add(lower);
    leafFrame(lower, width, leaf, 0.002, frameMat, glassMat, `r7-lower-${g}`, frameM);
    const tip = new THREE.Object3D();
    tip.name = `r7-fold-tip-${g}`;
    tip.position.set(0, -leaf, 0);
    lower.add(tip);
  }
  poseR7Pass(root, 1);
  return root;
}

export function poseR7Pass(root: THREE.Object3D, progress: number) {
  const theta = r7FoldTheta(progress);
  const groups = root.userData.r7Groups ?? 2;
  for (let g = 0; g < groups; g++) {
    const upper = root.getObjectByName(`r7-fold-upper-${g}`);
    const lower = root.getObjectByName(`r7-fold-lower-${g}`);
    if (upper) upper.rotation.x = -theta;
    if (lower) lower.rotation.x = theta * 2;
  }
  root.updateMatrixWorld(true);
}

export function r7WalkerInSweep(x: number, z: number, sweep: { x0: number; x1: number; z0: number; z1: number }, radius = 0.22) {
  return x > sweep.x0 - radius && x < sweep.x1 + radius && z > sweep.z0 - radius && z < sweep.z1 + radius;
}

/** Continuous 100mm grey-blue glazed tiles, white plinth and walnut sill/end trim across the pass-through bar face (x = 0.09..3.92). */
export function buildR7PassTiles(
  peninsula: THREE.Object3D | null,
  materials: Record<string, THREE.Material>,
  spec?: { w: number; h: number; t: number; x: number; y: number; z: number; fullSpan?: boolean },
) {
  if (!peninsula || !spec || peninsula.getObjectByName("r7-pass-tiles")) return;
  const tile = materials.r7Tile || materials.stone;
  const mesh = new THREE.Mesh(metricUV(new THREE.BoxGeometry(spec.w, spec.h, spec.t)), tile);
  mesh.name = "r7-pass-tiles";
  mesh.position.set(spec.x, spec.y, spec.z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.r7Role = "outer-face-tiles";
  mesh.userData.physicsBody = false;
  peninsula.add(mesh);

  const plinthMat = materials.r7Pale || materials.cream || tile;
  const skirting = new THREE.Mesh(metricUV(new THREE.BoxGeometry(spec.w, 0.09, spec.t + 0.004)), plinthMat);
  skirting.name = "r7-pass-skirting";
  skirting.position.set(spec.x, 0.045, spec.z + 0.001);
  skirting.receiveShadow = true;
  skirting.userData.r7Role = "outer-face-skirting";
  skirting.userData.physicsBody = false;
  peninsula.add(skirting);

  const lipWood = materials.r7LipWood || materials.r7NicheWood || materials.oak || tile;
  const sillTop = new THREE.Mesh(metricUV(new THREE.BoxGeometry(spec.w, 0.032, 0.24)), lipWood);
  sillTop.name = "r7-pass-sill-cap";
  sillTop.position.set(spec.x, 0.935, spec.z - 0.04);
  sillTop.castShadow = true;
  sillTop.receiveShadow = true;
  sillTop.userData.r7Role = "outer-counter-cap";
  sillTop.userData.physicsBody = false;
  peninsula.add(sillTop);

  const endCap = new THREE.Mesh(metricUV(new THREE.BoxGeometry(0.032, 0.95, 0.50)), lipWood);
  endCap.name = "r7-pass-end-panel";
  endCap.position.set(spec.x + spec.w / 2 + 0.016, 0.475, spec.z - 0.17);
  endCap.castShadow = true;
  endCap.receiveShadow = true;
  endCap.userData.r7Role = "outer-counter-end";
  endCap.userData.physicsBody = false;
  peninsula.add(endCap);
}
