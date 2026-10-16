import * as THREE from "three";
export function buildPegboard(
  group: THREE.Group,
  o: any,
  materials: Record<string, THREE.Material>,
) {
  const w = o.w,
    h = o.h;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, h);
  shape.lineTo(-w / 2, h);
  shape.closePath();
  let holeCount = 0;
  for (let x = -w / 2 + 0.065; x < w / 2 - 0.045; x += 0.09)
    for (let y = 0.065; y < h - 0.045; y += 0.09) {
      const hole = new THREE.Path();
      hole.absarc(x, y, 0.006, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      holeCount++;
    }
  // Matte powder-coated sheet: diffuse response avoids studio-environment pin highlights.
  const paint = new THREE.MeshLambertMaterial({
    color: o.room === "hall" ? "#78816b" : "#c3baaa",
  });
  const panel = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.018,
      bevelEnabled: false,
      curveSegments: 5,
    }),
    paint,
  );
  panel.name = "perforated-panel";
  panel.position.z = 0.025;
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);
  const wood = materials.darkoak || materials.oak;
  const metal = materials.bronze || materials.steel;
  const bar = (
    sx: number,
    sy: number,
    sz: number,
    x: number,
    y: number,
    z: number,
    material = wood,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  };
  // Stand-off blocks leave actual air behind the perforated sheet.
  for (const x of [-w / 2 + 0.025, w / 2 - 0.025]) {
    bar(0.025, h, 0.025, x, h / 2, 0.055);
    for (const y of [0.03, h - 0.03]) {
      const screw = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 0.005, 12),
        metal,
      );
      screw.rotation.x = Math.PI / 2;
      screw.position.set(x, y, 0.022);
      group.add(screw);
    }
  }
  const hook = (x: number, y: number) => {
    bar(0.006, 0.045, 0.006, x, y, 0.018, metal);
    bar(0.006, 0.006, 0.055, x, y - 0.02, -0.012, metal);
    bar(0.006, 0.02, 0.006, x, y - 0.014, -0.039, metal);
  };
  if (o.room === "master") {
    hook(-w / 2 + 0.14, h - 0.1);
    const headset = new THREE.Mesh(
      new THREE.TorusGeometry(0.064, 0.009, 6, 22, Math.PI),
      materials.charcoal || metal,
    );
    headset.position.set(-w / 2 + 0.14, h - 0.18, -0.04);
    group.add(headset);
    for (const dx of [-0.062, 0.062])
      bar(
        0.025,
        0.045,
        0.026,
        -w / 2 + 0.14 + dx,
        h - 0.18,
        -0.04,
        materials.charcoal || metal,
      );
    bar(0.28, 0.015, 0.07, 0.3, h - 0.13, -0.006);
    bar(0.28, 0.025, 0.008, 0.3, h - 0.11, -0.045);
    hook(w / 2 - 0.16, 0.24);
    const cable = new THREE.Mesh(
      new THREE.TorusGeometry(0.044, 0.004, 5, 20),
      metal,
    );
    cable.position.set(w / 2 - 0.16, 0.18, -0.04);
    group.add(cable);
  } else {
    for (const x of [-0.25, -0.07, 0.12]) hook(x, h - 0.1);
    for (const x of [-0.25, -0.07]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.016, 0.003, 5, 16),
        metal,
      );
      ring.position.set(x, h - 0.15, -0.045);
      group.add(ring);
      bar(0.009, 0.037, 0.004, x, h - 0.18, -0.045, metal);
    }
    bar(0.25, 0.018, 0.09, 0.14, 0.2, -0.012);
    bar(0.25, 0.05, 0.008, 0.14, 0.225, -0.06);
    // One light pouch, kept within the cabinet's projection rather than the walkway.
    bar(0.13, 0.14, 0.025, -0.25, 0.16, -0.025, materials.linen || wood);
  }
  group.userData.pegboard = {
    holeCount,
    throughHoles: true,
    panelThicknessM: 0.018,
    standOffM: 0.025,
    accessFace: "-z",
  };
  return true;
}
