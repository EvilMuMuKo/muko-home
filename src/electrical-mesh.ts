import * as THREE from 'three';

const MODULE_M = 0.086;
const PLATE_D = 0.008;
const SEAM = 0.003;
const PDU_W = 0.34;
const PDU_H = 0.06;
const PDU_D = 0.05;

type XZ = [number, number];

type ElectricalPoint = {
  id: string;
  room: string;
  kind: string;
  status?: string;
  modelDisplay?: boolean | string;
  accessXZ: XZ;
  modelMountXZ?: XZ;
  normalXZ: XZ;
  heightM: number;
  acModules?: number;
  rj45?: number;
};

export type ElectricalGroup = {
  id: string;
  room: string;
  position: [number, number, number];
  heightM: number;
  acModules: number;
  rj45: number;
};

function pointsOf(model: any): ElectricalPoint[] {
  const list = model?.homeDesign?.electrical?.points;
  return Array.isArray(list) ? list : [];
}

function showsProposed(p: ElectricalPoint): boolean {
  return p.status === 'PROPOSED' && p.modelDisplay !== false;
}

function isConditional(p: ElectricalPoint): boolean {
  return p.status === 'CONDITIONAL' || p.modelDisplay === 'CONDITIONAL';
}

function isFixedConnection(p: ElectricalPoint): boolean {
  return p.kind === 'fixed_connection';
}

function isDataPoint(p: ElectricalPoint): boolean {
  return p.kind === 'data';
}

function isC04Pdu(p: ElectricalPoint): boolean {
  return p.id === 'C04';
}

function pickMaterial(
  materials: Record<string, THREE.Material>,
  keys: string[],
  color: number,
  roughness: number,
): THREE.Material {
  for (const key of keys) {
    if (materials[key]) return materials[key];
  }
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function facing(normalXZ: XZ): THREE.Quaternion {
  const n = new THREE.Vector3(normalXZ?.[0] ?? 0, 0, normalXZ?.[1] ?? 1);
  if (n.lengthSq() < 1e-8) n.set(0, 0, 1);
  n.normalize();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
}

function place(
  target: THREE.Object3D,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
): void {
  target.position.copy(position);
  target.quaternion.copy(rotation);
  target.scale.copy(scale);
  target.updateMatrix();
}

function tagSpace(obj: THREE.Object3D, rooms: string[]): void {
  obj.userData.rooms = rooms;
  obj.userData.spaceIds = rooms;
  obj.userData.kind = 'electrical';
  obj.userData.physicsBody = false;
  const mesh = obj as THREE.Mesh;
  if (mesh.isMesh) mesh.castShadow = false;
}

function addAcHoles(
  holes: THREE.InstancedMesh,
  scratch: THREE.Object3D,
  face: THREE.Vector3,
  right: THREE.Vector3,
  rotation: THREE.Quaternion,
  pinScale: THREE.Vector3,
  holeIndex: number,
): number {
  const slots: Array<[number, number]> = [
    [-0.012, 0.008],
    [0.012, 0.008],
    [0, -0.012],
  ];
  for (const [x, y] of slots) {
    place(
      scratch,
      face.clone().addScaledVector(right, x).add(new THREE.Vector3(0, y, 0)),
      rotation,
      pinScale,
    );
    holes.setMatrixAt(holeIndex++, scratch.matrix);
  }
  return holeIndex;
}

export function buildElectrical(
  scene: THREE.Object3D,
  model: any,
  materials: Record<string, THREE.Material>,
): {
  groups: ElectricalGroup[];
  conditionalOmitted: string[];
  wallPowerGroups: number;
  drawCalls: number;
  conceptOnly: true;
} {
  const points = pointsOf(model);
  const conditionalOmitted = points.filter(isConditional).map((p) => p.id);
  const shown = points.filter(showsProposed);
  const wallPowerGroups = points.filter((p) => p.status === 'PROPOSED' && p.kind === 'socket').length;

  const groups: ElectricalGroup[] = [];
  const byRoom = new Map<string, ElectricalPoint[]>();
  const pdus: ElectricalPoint[] = [];

  for (const p of shown) {
    const acModules = p.acModules ?? 0;
    const rj45 = p.rj45 ?? 0;
    groups.push({
      id: p.id,
      room: p.room,
      position: [(p.modelMountXZ??p.accessXZ)[0], p.heightM, (p.modelMountXZ??p.accessXZ)[1]],
      heightM: p.heightM,
      acModules,
      rj45,
    });
    if (isFixedConnection(p) || isDataPoint(p) || isC04Pdu(p)) {
      if (isC04Pdu(p)) pdus.push(p);
      continue;
    }
    if (acModules + rj45 === 0) continue;
    const list = byRoom.get(p.room);
    if (list) list.push(p);
    else byRoom.set(p.room, [p]);
  }

  const root = new THREE.Group();
  root.name = 'electrical:root';
  scene.add(root);

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const plateMat = pickMaterial(materials, ['electricalPlate', 'plate', 'ivory'], 0xf3efe4, 0.72);
  const seamMat = pickMaterial(materials, ['electricalSeam', 'seam', 'edge'], 0xb7b1a4, 0.86);
  const holeMat = pickMaterial(materials, ['electricalHole', 'hole', 'dark'], 0x2c2c2c, 0.42);

  const scratch = new THREE.Object3D();
  const plateScale = new THREE.Vector3(MODULE_M - 0.004, MODULE_M - 0.004, PLATE_D);
  const seamScale = new THREE.Vector3(MODULE_M + SEAM, MODULE_M + SEAM, 0.004);
  const pinScale = new THREE.Vector3(0.01, 0.014, 0.004);
  const portScale = new THREE.Vector3(0.016, 0.014, 0.004);
  let drawCalls = 0;

  for (const [room, list] of byRoom) {
    let roomPlates = 0;
    let roomHoles = 0;
    for (const p of list) {
      const ac = p.acModules ?? 0;
      const rj = p.rj45 ?? 0;
      roomPlates += ac + rj;
      roomHoles += ac * 3 + rj;
    }
    if (roomPlates === 0 || roomHoles === 0) continue;

    const roomGroup = new THREE.Group();
    roomGroup.name = `electrical-${room}`;
    tagSpace(roomGroup, [room]);
    root.add(roomGroup);

    const seams = new THREE.InstancedMesh(boxGeometry, seamMat, roomPlates);
    const plates = new THREE.InstancedMesh(boxGeometry, plateMat, roomPlates);
    const holes = new THREE.InstancedMesh(boxGeometry, holeMat, roomHoles);
    let plateIndex = 0;
    let holeIndex = 0;

    for (const p of list) {
      const ac = p.acModules ?? 0;
      const rj = p.rj45 ?? 0;
      const mods = ac + rj;
      const rotation = facing(p.normalXZ);
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(rotation);
      const origin = new THREE.Vector3((p.modelMountXZ??p.accessXZ)[0], p.heightM, (p.modelMountXZ??p.accessXZ)[1]);
      const start = -((mods - 1) * MODULE_M) / 2;

      for (let m = 0; m < mods; m++) {
        const center = origin
          .clone()
          .addScaledVector(right, start + m * MODULE_M)
          .addScaledVector(normal, PLATE_D / 2);
        place(scratch, center.clone().addScaledVector(normal, -0.001), rotation, seamScale);
        seams.setMatrixAt(plateIndex, scratch.matrix);
        place(scratch, center, rotation, plateScale);
        plates.setMatrixAt(plateIndex, scratch.matrix);

        const face = center.clone().addScaledVector(normal, PLATE_D / 2 + 0.001);
        if (m < ac) {
          holeIndex = addAcHoles(holes, scratch, face, right, rotation, pinScale, holeIndex);
        } else {
          place(scratch, face, rotation, portScale);
          holes.setMatrixAt(holeIndex++, scratch.matrix);
        }
        plateIndex++;
      }
    }

    seams.count = plateIndex;
    plates.count = plateIndex;
    holes.count = holeIndex;
    for (const mesh of [seams, plates, holes]) {
      mesh.instanceMatrix.needsUpdate = true;
      tagSpace(mesh, [room]);
      roomGroup.add(mesh);
      drawCalls++;
    }
  }

  const pduBody = new THREE.Vector3(PDU_W - 0.006, PDU_H - 0.006, PDU_D);
  const pduSeam = new THREE.Vector3(PDU_W + SEAM, PDU_H + SEAM, 0.004);
  for (const p of pdus) {
    const rotation = facing(p.normalXZ);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(rotation);
    const origin = new THREE.Vector3((p.modelMountXZ??p.accessXZ)[0], p.heightM, (p.modelMountXZ??p.accessXZ)[1]);
    const center = origin.clone().addScaledVector(normal, PDU_D / 2);
    const body = new THREE.Mesh(boxGeometry, plateMat);
    const rim = new THREE.Mesh(boxGeometry, seamMat);
    place(body, center, rotation, pduBody);
    place(rim, center.clone().addScaledVector(normal, -0.001), rotation, pduSeam);
    const mods = (p.acModules ?? 0) > 0 ? (p.acModules as number) : 2;
    const sockets = new THREE.InstancedMesh(boxGeometry, holeMat, mods * 3);
    const face = center.clone().addScaledVector(normal, PDU_D / 2 + 0.001);
    const span = PDU_W - 0.06;
    let socketIndex = 0;
    for (let i = 0; i < mods; i++) {
      const x = mods === 1 ? 0 : -span / 2 + (span * i) / (mods - 1);
      socketIndex = addAcHoles(
        sockets,
        scratch,
        face.clone().addScaledVector(right, x),
        right,
        rotation,
        pinScale,
        socketIndex,
      );
    }
    sockets.count = socketIndex;
    sockets.instanceMatrix.needsUpdate = true;
    const pdu = new THREE.Group();
    pdu.name = `electrical-pdu-${p.id}`;
    tagSpace(pdu, [p.room]);
    tagSpace(rim, [p.room]);
    tagSpace(body, [p.room]);
    tagSpace(sockets, [p.room]);
    pdu.add(rim, body, sockets);
    root.add(pdu);
    drawCalls += 3;
  }

  return {
    groups,
    conditionalOmitted,
    wallPowerGroups,
    drawCalls,
    conceptOnly: true,
  };
}
