import * as THREE from "three";
import { auditMaterial } from "./material-detail";
import { roomPalette, wallColour } from "./atmosphere-design";
type Materials = Record<string, THREE.Material>;
export function configureRoomMaterials(m: Materials) {
  const clone = (
    name: string,
    source: string,
    color: string,
    roughness?: number,
  ) => {
    const material = (m[source] as THREE.MeshStandardMaterial).clone();
    material.color.set(color);
    if (roughness !== undefined) material.roughness = material.roughnessMap && (m[source] as THREE.MeshStandardMaterial).roughness === 1 ? 1 : roughness;
    auditMaterial(
      material,
      name,
      /Wood|Interior/i.test(name)
        ? "wood"
        : /Fabric|Curtain|Acoustic|Piping/i.test(name)
          ? "fabric"
          : /Metal/i.test(name)
            ? "metal"
            : /Glass/i.test(name)
              ? "glass"
              : /Paint|Ceiling/i.test(name)
                ? "paint"
                : "decor",
    );
    m[name] = material;
    return material;
  };
  (m.plaster as THREE.MeshStandardMaterial).color.set(roomPalette.paper);
  const walls = clone("roomPlaster", "plaster", "#ffffff", 0.96);
  // Wall vertex tint and subtle plaster maps are independent layers.
  walls.vertexColors = true;
  const wallpaper = clone("masterWallcover", "linen", roomPalette.masterPaper, 1);
  wallpaper.vertexColors = true;
  wallpaper.normalScale.setScalar(0.04);
  if (wallpaper instanceof THREE.MeshPhysicalMaterial) {
    wallpaper.sheen = 0.12; wallpaper.sheenRoughness = 0.95;
  }
  clone("barPaint", "upperPaint", roomPalette.oat, 0.68);
  clone("livingPaint", "upperPaint", roomPalette.oat, 0.68);
  clone("mediaPaint", "upperPaint", roomPalette.media, 0.67);
  clone("cinemaPaint", "upperPaint", roomPalette.cinema, 0.82);
  clone("cinemaCeiling", "plaster", roomPalette.cinemaCeiling, 0.9);
  clone("barWood", "oak", "#ae906f", 0.73);
  clone("livingWood", "oak", "#ae906f", 0.73);
  clone("cinemaWood", "oak", "#88735f", 0.82);
  clone("barInterior", "cabinetInterior", "#827563", 0.76);
  clone("livingInterior", "cabinetInterior", "#c5bcaa", 0.76);
  clone("cinemaInterior", "cabinetInterior", "#70685d", 0.82);
  clone("livingFabric", "linen", "#ddd8cd", 0.88);
  clone("cinemaFabric", "linen", "#aea496", 0.91);
  clone("cinemaCurtain", "linen", "#625b52", 0.92);
  clone("cinemaAcoustic", "linen", "#6c655c", 0.94);
  clone("clayFabric", "linen", "#b77d67", 0.86);
  clone("oliveFabric", "sage", "#858a73", 0.9);
  clone("cinemaMetal", "bronze", "#827866", 0.58);
  clone("paperPaint", "upperPaint", roomPalette.paper, 0.7);
  clone("piping", "linen", "#baaa91", 0.86);
  const glass = clone("barGlass", "displayGlass", "#f1f4ed", 0.045);
  glass.opacity = (m.displayGlass as THREE.MeshStandardMaterial).opacity;
}
export function finishWall(
  mesh: THREE.Mesh,
  wallId: string,
  sides: { sign: number; ids: string[] }[],
  m: Materials,
) {
  const geometry = mesh.geometry.clone(),
    normals = geometry.getAttribute("normal");
  const colors = new Float32Array(normals.count * 3);
  const positions = geometry.getAttribute("position");
  geometry.computeBoundingBox();
  const minZ = geometry.boundingBox!.min.z,
    depth = geometry.boundingBox!.max.z - minZ;
  const roomFor = (side: {ids:string[]} | undefined) => side?.ids.find(id => id !== "hall") ?? side?.ids[0];
  const minus = new THREE.Color(
    wallColour(roomFor(sides.find((s) => s.sign === -1)), wallId),
  );
  const plus = new THREE.Color(
    wallColour(roomFor(sides.find((s) => s.sign === 1)), wallId),
  );
  const colour = new THREE.Color();
  for (let i = 0; i < normals.count; i++) {
    // Match end-cap vertices to each painted face, avoiding pale seams between coplanar segments.
    colour.lerpColors(
      minus,
      plus,
      Math.abs(normals.getZ(i)) > 0.5
        ? normals.getZ(i) > 0
          ? 1
          : 0
        : (positions.getZ(i) - minZ) / depth,
    );
    colour.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  mesh.geometry = geometry;
  mesh.material = m.roomPlaster;
  if (m.masterWallcover && sides.some(side => roomFor(side) === "master")) {
    // Room finishes are assigned per real wall face; neighbours keep their finish.
    const groups: {start:number;count:number;materialIndex:number}[] = [];
    for (const group of geometry.groups) {
      const vertex = geometry.index?.getX(group.start) ?? group.start;
      const sign = normals.getZ(vertex) > 0.5 ? 1 : normals.getZ(vertex) < -0.5 ? -1 : 0;
      const wallpaperFace = sign !== 0 && roomFor(sides.find(side => side.sign === sign)) === "master";
      const materialIndex = wallpaperFace ? 1 : 0;
      const last = groups.at(-1);
      if (last && last.materialIndex === materialIndex && last.start + last.count === group.start) last.count += group.count;
      else groups.push({start:group.start,count:group.count,materialIndex});
    }
    geometry.clearGroups(); groups.forEach(group => geometry.addGroup(group.start,group.count,group.materialIndex));
    mesh.material = [m.roomPlaster, m.masterWallcover];
  }
  mesh.userData.wallFinish = {
    wallId,
    sides: sides.map((s) => ({
      sign: s.sign,
      room: roomFor(s),
      color: wallColour(roomFor(s), wallId),
    })),
  };
}
export function finishArchitecture(
  scene: THREE.Scene,
  m: Materials,
  tag: (n: THREE.Object3D, rooms: string[], kind: string) => void,
) {
  scene.traverse((node) => {
    if (
      node.name.startsWith("skirting:") ||
      node.name.startsWith("trim:guest-door:")
    ) {
      const rooms = node.userData.spaceIds as string[];
      const finish = rooms?.includes("guest")
        ? m.cinemaPaint
        : rooms?.includes("living")
          ? m.livingPaint
          : m.paperPaint;
      node.traverse((n) => {
        if (n instanceof THREE.Mesh) n.material = finish;
      });
    }
  });
  const leaf = scene.getObjectByName("opening:guest-door");
  leaf?.traverse((n) => {
    if (!(n instanceof THREE.Mesh) || n.material !== m.oak) return;
    const g = n.geometry.clone(),
      normals = g.getAttribute("normal"),
      colors = new Float32Array(normals.count * 3);
    for (let i = 0; i < normals.count; i++)
      new THREE.Color(
        normals.getZ(i) < -0.5 ? roomPalette.cinema : roomPalette.paper,
      ).toArray(colors, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    n.geometry = g;
    n.material = m.roomPlaster;
  });
  const g = new THREE.PlaneGeometry(4.62, 3.22);
  g.rotateX(Math.PI / 2);
  const ceiling = new THREE.Mesh(g, m.cinemaCeiling);
  ceiling.position.set(2.4, 2.697, 1.7);
  ceiling.name = "ceiling:cinema-finish";
  ceiling.receiveShadow = true;
  scene.add(ceiling);
  tag(ceiling, ["guest"], "ceiling");
}
export function finishFurniture(
  scene: THREE.Scene,
  objects: { id: string; room?: string; type: string }[],
  m: Materials,
) {
  for (const object of objects) {
    if (!["bar", "living", "guest"].includes(object.room ?? "")) continue;
    const group = scene.getObjectByName(object.id);
    if (!group) continue;
    const room = object.room!,
      wood =
        m[
          room === "guest"
            ? "cinemaWood"
            : room === "bar"
              ? "barWood"
              : "livingWood"
        ];
    const paint =
      m[
        room === "guest"
          ? "cinemaPaint"
          : room === "bar"
            ? "barPaint"
            : "livingPaint"
      ];
    group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.material === m.oak || node.material === m.darkoak)
        node.material = wood;
      else if (node.material === m.cabinetPaint) node.material = paint;
      else if (node.material === m.linen)
        node.material = m[room === "guest" ? "cinemaFabric" : "livingFabric"];
      else if (
        node.material === m.sage &&
        ["sofa", "sofa_bed", "dining_chair"].includes(object.type)
      )
        node.material = m[room === "guest" ? "clayFabric" : "oliveFabric"];
      else if (node.material === m.bronze && room === "guest")
        node.material = m.cinemaMetal;
      else if (node.material === m.displayGlass && room === "bar")
        node.material = m.barGlass;
    });
  }
}
