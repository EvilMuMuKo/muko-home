import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { metricUV } from "./texture-mapping";
import { roomPalette, themeMoments } from "./atmosphere-design";
type Materials = Record<string, THREE.Material>;
export function createTileMaterial() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#b8a995";
  c.fillRect(0, 0, 512, 512);
  const rough = canvas.cloneNode() as HTMLCanvasElement,
    r = rough.getContext("2d")!;
  r.fillStyle = "#e0e0e0";
  r.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 4; x++) {
      const v = (x * 13 + y * 7) % 11;
      c.fillStyle = `rgb(${231 + v},${222 + v},${201 + v})`;
      c.fillRect(x * 128 + 2, y * 64 + 2, 124, 60);
      r.fillStyle = `rgb(${135 + v * 3},${135 + v * 3},${135 + v * 3})`;
      r.fillRect(x * 128 + 2, y * 64 + 2, 124, 60);
    }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const bump = new THREE.CanvasTexture(rough);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({
    map,
    roughnessMap: bump,
    bumpMap: bump,
    bumpScale: 0.002,
    roughness: 0.68,
    color: "#ffffff",
  });
}
function artwork(screen = false) {
  const canvas = document.createElement("canvas");
  canvas.width = screen ? 768 : 384;
  canvas.height = screen ? 432 : 480;
  const c = canvas.getContext("2d")!,
    w = canvas.width,
    h = canvas.height;
  c.fillStyle = screen ? "#25302f" : "#ece3d2";
  c.fillRect(0, 0, w, h);
  c.fillStyle = screen ? "#c4a57c" : "#bd7455";
  c.beginPath();
  c.arc(w * 0.67, h * 0.34, h * 0.16, 0, Math.PI * 2);
  c.fill();
  for (const [y, color] of [
    [0.58, screen ? "#4a5d52" : "#77806b"],
    [0.75, screen ? "#263f3b" : "#56463b"],
  ] as const) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, h);
    c.lineTo(0, h * y);
    c.bezierCurveTo(
      w * 0.35,
      h * (y - 0.3),
      w * 0.6,
      h * (y + 0.24),
      w,
      h * (y - 0.12),
    );
    c.lineTo(w, h);
    c.fill();
  }
  c.fillStyle = screen ? "#ddd2bc" : "#443a36";
  c.font = `${screen ? 16 : 13}px Georgia`;
  c.fillText(screen ? "AFTER HOURS" : "M U K O", w * 0.08, h * 0.9);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
export function addUpholsterySeam(mesh: THREE.Mesh, material: THREE.Material) {
  mesh.geometry.computeBoundingBox();
  const b = mesh.geometry.boundingBox!;
  const size = b.getSize(new THREE.Vector3());
  if (size.x < 0.5 || size.z < 0.4 || size.y < 0.07 || size.y > 0.2) return;
  const x = size.x / 2 - 0.025,
    z = size.z / 2 - 0.025,
    r = 0.035,
    points: THREE.Vector3[] = [];
  for (const [cx, cz, start] of [
    [x - r, z - r, 0],
    [-x + r, z - r, 90],
    [-x + r, -z + r, 180],
    [x - r, -z + r, 270],
  ])
    for (let i = 0; i <= 5; i++) {
      const a = THREE.MathUtils.degToRad(start + i * 18);
      points.push(
        new THREE.Vector3(
          cx + r * Math.cos(a),
          size.y / 2 - 0.008,
          cz + r * Math.sin(a),
        ),
      );
    }
  const seam = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points, true),
      64,
      0.0017,
      4,
      true,
    ),
    material,
  );
  seam.name = "upholstery:stitched-edge";
  seam.castShadow = false;
  mesh.add(seam);
}
export function buildInteriorDetails(
  scene: THREE.Scene,
  m: Materials,
  tag: (n: THREE.Object3D, rooms: string[], kind: string) => void,
  spatial = false,
  model?: {
    version: string;
    objects: Record<string, any>[];
    homeDesign?: any;
    openings?: { id: string; rotation?: number; openAngle?: number }[];
  },
) {
  m.barTile = createTileMaterial();
  const groups = new Map<string, THREE.Group>();
  const room = (id: string) => {
    if (!groups.has(id)) {
      const g = new THREE.Group();
      g.name = "interior-detail:" + id;
      groups.set(id, g);
      scene.add(g);
      tag(g, [id], "detail");
    }
    return groups.get(id)!;
  };
  function box(
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: string,
    bevel = 0.004,
  ) {
    const geo = metricUV(
      new RoundedBoxGeometry(w, h, d, 1, Math.min(bevel, w / 4, h / 4, d / 4)),
    );
    const mesh = new THREE.Mesh(geo, m[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const bar = room("bar");
  box(
    bar,
    4.5,
    0.67,
    0.008,
    2.4,
    1.315,
    8.35,
    spatial ? "salonStone" : "barTile",
    0,
  );
  // Framed original graphic, clear of the window and café worktop.
  const frame = new THREE.Group();
  frame.position.set(0.106, 1.75, 7.65);
  frame.rotation.y = Math.PI / 2;
  bar.add(frame);
  box(frame, 0.58, 0.72, 0.018, 0, 0, 0, "barWood");
  const print = new THREE.Mesh(
    new THREE.PlaneGeometry(0.53, 0.67),
    new THREE.MeshStandardMaterial({ map: artwork(), roughness: 0.96 }),
  );
  print.position.z = 0.011;
  frame.add(print);
  // Two glazed espresso cups on a small tray; keep the surrounding counter clear.
  box(bar, 0.4, 0.012, 0.22, 1.94, 0.961, 7.9, "barWood");
  const ceramic = new THREE.MeshStandardMaterial({
    color: "#e9d8b5",
    roughness: 0.28,
  });
  // Coffee is a dark dielectric liquid, never the stone/wood material from the tray.
  const espresso = new THREE.MeshStandardMaterial({color:'#25170e',roughness:0.23,metalness:0});
  m.espressoSurface = espresso;
  m.ceramic = ceramic;
  for (const x of [1.83, 2.03]) {
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.03, 0.067, 20, 1, true),
      ceramic,
    );
    cup.position.set(x, 1.001, 7.9);
    bar.add(cup);
    // Fine rolled lip and a small foot ring stay inside the existing cup envelope.
    for (const [major, minor, y] of [
      [0.0345, 0.0015, 1.033],
      [0.0285, 0.0015, 0.969],
    ]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(major, minor, 6, 16),
        ceramic,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y, 7.9);
      ring.castShadow = false;
      bar.add(ring);
    }
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.028, 20), ceramic);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.set(x, 0.969, 7.9);
    bar.add(bottom);
    if (espresso) {
      const coffee = new THREE.Mesh(
        new THREE.CircleGeometry(0.027, 20),
        espresso,
      );
      coffee.rotation.x = -Math.PI / 2;
      coffee.position.set(x, 1.026, 7.9);
      bar.add(coffee);
    }
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.018, 0.005, 6, 16),
      ceramic,
    );
    handle.position.set(x + 0.039, 1.005, 7.9);
    bar.add(handle);
  }
  const living = room("living");
  // A folded woven throw on the sofa arm, fully inside its existing footprint.
  if (!spatial) {
    box(living, 0.15, 0.022, 0.46, 10.43, 0.652, 7.43, "clayFabric", 0.009);
    box(living, 0.016, 0.29, 0.36, 10.49, 0.52, 7.43, "clayFabric", 0.004);
  }
  // A few game cases on the rear sideboard with a restrained framed print above.
  for (let j = 0; j < (model?.homeDesign?.mobileTV ? 0 : 4); j++)
    box(
      living,
      0.026,
      0.18,
      0.125,
      9.03 + j * 0.034,
      0.896,
      9.03,
      j === 0 ? "clayFabric" : "oliveFabric",
      0.002,
    );
  const guest = room("guest");
  if (!spatial)
    for (const x of [1.05, 2.05, 3.05])
      box(guest, 0.78, 0.74, 0.038, x, 1.29, 0.112, "cinemaAcoustic", 0.012);
  for (const x of [0.65, 3.35]) {
    const speakerY=model?.homeDesign?.r5Revision?1.4:1.05;
    box(guest, 0.2, 0.39, 0.16, x, speakerY, 3.17, "cinemaWood", 0.012);
    box(guest, 0.176, 0.365, 0.009, x, speakerY, 3.084, "cinemaAcoustic", 0.004);
    if(model?.homeDesign?.r5Revision)box(guest,.04,.08,.07,x,speakerY,3.275,'steel',.003);
  }
  if(!model?.homeDesign?.r5Revision){
  box(guest, 0.85, 0.06, 0.13, 2.05, 0.49, 3.0, "cinemaAcoustic", 0.012);
  box(guest, 0.31, 0.35, 0.32, 0.6, 0.18, 0.45, "cinemaWood", 0.02);
  box(guest, 0.28, 0.31, 0.006, 0.6, 0.18, 0.286, "cinemaAcoustic", 0.01);
  }
  box(guest, 2.5, 0.008, 2.48, 2.05, 0.009, 1.71, "cinemaAcoustic", 0.002);
  // Merge decorative meshes by room/material. Dynamic shutters, curtains and screens stay separate.
  for (const [id, group] of groups) {
    group.updateMatrixWorld(true);
    const buckets = new Map<THREE.Material, THREE.Mesh[]>();
    group.traverse((n) => {
      if (n instanceof THREE.Mesh) {
        const material = n.material as THREE.Material;
        if (!buckets.has(material)) buckets.set(material, []);
        buckets.get(material)!.push(n);
      }
    });
    for (const [material, meshes] of buckets) {
      if (meshes.length < 2) continue;
      const geos = meshes.map((mesh) => {
        const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        if (g.index) {
          const flat = g.toNonIndexed();
          g.dispose();
          return flat;
        }
        return g;
      });
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      for (const mesh of meshes) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      }
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  const treatment = scene.getObjectByName("window-treatment:guest-window")!;
  treatment.traverse((n) => {
    if (n instanceof THREE.Mesh && n.material === m.linen)
      n.material = m.cinemaCurtain;
  });
  const curtainGeometry = new THREE.PlaneGeometry(1.74, 2.36, 64, 12),
    p = curtainGeometry.getAttribute("position");
  for (let i = 0; i < p.count; i++)
    p.setZ(i, 0.014 * Math.sin(p.getX(i) * Math.PI * 22));
  curtainGeometry.computeVertexNormals();
  metricUV(curtainGeometry);
  const curtainMaterial = (
    m.cinemaCurtain as THREE.MeshStandardMaterial
  ).clone();
  curtainMaterial.side = THREE.DoubleSide;
  const blackout = new THREE.Mesh(curtainGeometry, curtainMaterial);
  blackout.name = "cinema:blackout";
  blackout.position.set(0, 1.26, -0.135);
  blackout.castShadow = true;
  blackout.receiveShadow = true;
  treatment.add(blackout);
  const poster = artwork(true),
    screens: { material: THREE.MeshStandardMaterial; room: string }[] = [];
  for (const id of ["guest-tv", "living-tv", "pc-monitor", "macbook", ...(model?.homeDesign?.r5Revision ? ["study-monitor"] : [])]) {
    const g = scene.getObjectByName(id)!;
    g.traverse((n) => {
      if (n instanceof THREE.Mesh && n.material === m.screen) {
        const geometry = n.geometry.clone();
        geometry.computeBoundingBox();
        const size = geometry.boundingBox!.getSize(new THREE.Vector3());
        const positions = geometry.getAttribute("position"),
          uv = geometry.getAttribute("uv");
        const facing = id === "living-tv" || (id==='guest-tv' && model?.homeDesign?.r5Revision) ? 1 : -1;
        for (let i = 0; i < positions.count; i++)
          uv.setXY(
            i,
            0.5 + (facing * positions.getX(i)) / size.x,
            0.5 + positions.getY(i) / size.y,
          );
        uv.needsUpdate = true;
        n.geometry = geometry;
        const material = (m.screen as THREE.MeshStandardMaterial).clone();
        material.color.set("#ffffff");
        material.map = material.emissiveMap = poster;
        material.emissive.set("#ffffff");
        material.roughness = 0.28;
        n.material = material;
        screens.push({
          material,
          room: id.startsWith("guest") || id==='study-monitor' ? "guest" : ["pc-monitor", "macbook"].includes(id) ? "master" : "living",
        });
      }
    });
  }
  for (const id of ["guest-sofa-bed", "living-sofa"]) {
    const group = scene.getObjectByName(id)!;
    const upholstery: THREE.Mesh[] = [];
    group.traverse(child => { if (child instanceof THREE.Mesh) upholstery.push(child); });
    // Module seats are nested; a direct-children pass missed both living cushions.
    for (const child of upholstery)
      if (
        child instanceof THREE.Mesh &&
        [m.linen, m.livingFabric, m.cinemaFabric, m.salonFabric, m.r7BlackLeather, m.r7ForestGreen].includes(
          child.material as THREE.Material,
        )
      )
        addUpholsterySeam(
          child,
          child.material === m.r7BlackLeather ? (m.r7Ink || m.piping) : m.piping,
        );
  }
  const door = scene.getObjectByName("opening:guest-door")!;
  const guestOpening = model?.openings?.find((opening) => opening.id === "guest-door");
  // scene.js: closed = -deg(rotation), open = closed - deg(openAngle)
  const doorClosed = guestOpening
    ? -THREE.MathUtils.degToRad(guestOpening.rotation || 0)
    : -Math.PI / 2;
  const doorOpenYaw = guestOpening
    ? doorClosed - THREE.MathUtils.degToRad(guestOpening.openAngle || 0)
    : -Math.PI;
  let current = "aperitif",
    doorOpen = true;
  function setDoorOpen(open: boolean) {
    doorOpen = open;
    door.rotation.y = open ? doorOpenYaw : doorClosed;
  }
  function apply(id: string) {
    current = id;
    blackout.visible = id === "cinema" || id === "guest-stay";
    setDoorOpen(id !== "cinema" && id !== "guest-stay");
    for (const screen of screens) {
      const active = screen.room === "guest" ? id === "cinema" : screen.room === "master" ? id === "dual-workstations" : id === "game";
      screen.material.map = screen.material.emissiveMap = active
        ? poster
        : null;
      screen.material.color.set(active ? "#ffffff" : "#111615");
      screen.material.emissive.set(active ? "#ffffff" : "#000000");
      screen.material.emissiveIntensity = active ? 0.35 : 0;
      screen.material.needsUpdate = true;
    }
  }
  return {
    apply,
    toggleScreen(room: string) {
      for (const screen of screens.filter((screen) => screen.room === room)) {
        const active = screen.material.emissiveIntensity < 0.1;
        screen.material.map = screen.material.emissiveMap = active
          ? poster
          : null;
        screen.material.color.set(active ? "#ffffff" : "#111615");
        screen.material.emissive.set(active ? "#ffffff" : "#000000");
        screen.material.emissiveIntensity = active ? 0.35 : 0;
        screen.material.needsUpdate = true;
      }
    },
    setDoorOpen,
    getState: () => ({
      moment: current,
      doorOpen,
      blackoutClosed: blackout.visible,
      palette: roomPalette,
      screenInches: 83,
      acousticPanels: spatial ? 5 : 3,
      compositionVersion: model?.homeDesign?.lifeRevision ? 10 : model?.homeDesign ? 9 : spatial ? 8 : 7,
      storageGroups: model
        ? model.objects.filter((o) => o.type === "wall_storage").length
        : 24,
      decorRooms: [...groups.keys()],
      moments: themeMoments.map((s) => s.id),
    }),
  };
}
export function mountMomentControls(
  onSelect: (id: string) => void,
  onDoor: () => void,
  onReviewDoor: () => void,
) {
  const review = document.createElement("button");
  review.id = "cinema-door-review";
  review.type = "button";
  review.textContent = "查看影音室入口";
  review.onclick = onReviewDoor;
  document.querySelector("#motion-controls")!.append(review);
  const button = document.createElement("button");
  button.id = "cinema-door-toggle";
  button.type = "button";
  button.textContent = "开启 / 关闭影音室门";
  button.onclick = onDoor;
  document.querySelector("#motion-controls")!.append(button);
}
