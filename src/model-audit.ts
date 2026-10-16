import * as THREE from "three";
/** Read-only inventory: geometry integrity and current rendered bounds, not physical acceptance. */
export function auditSceneModel(scene: THREE.Scene, model: { objects: any[] }) {
  scene.updateMatrixWorld(true);
  const checked = new Set<string>(),
    issues: string[] = [];
  const objects = model.objects
    .filter((o) => o.type !== "door_leaf")
    .map((o) => {
      const group = scene.getObjectByName(o.id);
      if (!group) return { id: o.id, type: o.type, missing: true };
      let meshes = 0,
        triangles = 0;
      const primitives: Record<string, number> = {},
        materials = new Set<string>();
      group.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        meshes++;
        const g = node.geometry;
        triangles +=
          (g.index?.count || g.getAttribute("position")?.count || 0) / 3;
        primitives[g.type] = (primitives[g.type] || 0) + 1;
        for (const m of Array.isArray(node.material)
          ? node.material
          : [node.material])
          materials.add(m.type);
        if (checked.has(g.uuid)) return;
        checked.add(g.uuid);
        for (const key of ["position", "normal", "uv"]) {
          const attr = g.getAttribute(key);
          if (!attr) continue;
          for (let i = 0; i < attr.array.length; i++)
            if (!Number.isFinite(attr.array[i])) {
              issues.push(`${o.id}:${key}:nonfinite`);
              break;
            }
        }
      });
      const b = new THREE.Box3().setFromObject(group);
      return {
        id: o.id,
        type: o.type,
        room: o.room,
        meshes,
        triangles: Math.round(triangles),
        primitives,
        materials: [...materials],
        bounds: { min: b.min.toArray(), max: b.max.toArray() },
        accessFace: o.accessFace || null,
      };
    });
  return {
    version: 9,
    objects,
    checkedGeometryCount: checked.size,
    issues,
    note: "Current-state geometry inventory. Bounds include hidden assembly parts; use articulated visible-mesh tests for swept solids. This is not a material photorealism score or physical-use acceptance.",
  };
}
