import * as THREE from "three";
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
    if (roughness !== undefined) material.roughness = roughness;
    m[name] = material;
    return material;
  };
  (m.plaster as THREE.MeshStandardMaterial).color.set(roomPalette.paper);
  const walls = clone("roomPlaster", "plaster", "#ffffff", 0.96);
  walls.map = null;
  walls.normalMap = null;
  walls.vertexColors = true;
  clone("barPaint", "upperPaint", roomPalette.oat, 0.78);
  clone("livingPaint", "upperPaint", roomPalette.oat, 0.78);
  clone("mediaPaint", "upperPaint", roomPalette.media, 0.75);
  clone("cinemaPaint", "upperPaint", roomPalette.cinema, 0.92);
  clone("cinemaCeiling", "plaster", roomPalette.cinemaCeiling, 1);
  clone("barWood", "oak", "#ae906f", 0.9);
  clone("livingWood", "oak", "#ae906f", 0.9);
  clone("cinemaWood", "oak", "#756353", 0.94);
  clone("barInterior", "cabinetInterior", "#746a5c");
  clone("livingInterior", "cabinetInterior", "#bdb8aa");
  clone("cinemaInterior", "cabinetInterior", "#58534c");
  clone("livingFabric", "linen", "#d8d7cf");
  clone("cinemaFabric", "linen", "#a49a8d");
  clone("cinemaCurtain", "linen", "#514d47");
  clone("cinemaAcoustic", "linen", "#5d5851");
  clone("clayFabric", "linen", "#b77d67");
  clone("oliveFabric", "sage", "#777c68");
  clone("cinemaMetal", "bronze", "#746b5e", 0.64);
  clone("paperPaint", "upperPaint", roomPalette.paper, 0.82);
  clone("piping", "linen", "#baaa91");
  const glass = clone("barGlass", "displayGlass", "#b7aa8f", 0.16);
  glass.opacity = 0.2;
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
  const minus = new THREE.Color(
    wallColour(sides.find((s) => s.sign === -1)?.ids[0], wallId),
  );
  const plus = new THREE.Color(
    wallColour(sides.find((s) => s.sign === 1)?.ids[0], wallId),
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
  mesh.userData.wallFinish = {
    wallId,
    sides: sides.map((s) => ({
      sign: s.sign,
      room: s.ids[0],
      color: wallColour(s.ids[0], wallId),
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
        normals.getZ(i) > 0.5 ? roomPalette.cinema : roomPalette.paper,
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
