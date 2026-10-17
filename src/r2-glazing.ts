import * as THREE from "three";
import { metricUV } from "./texture-mapping";

/** Linked sliding leaves preserve a real opening, with one independently collidable hierarchy. */
export function buildR2Glazing(
  scene: THREE.Object3D,
  o: any,
  m: Record<string, THREE.Material>,
  tag: (g: THREE.Object3D, rooms: string[], kind: string) => void,
  moving: any[],
) {
  const root = new THREE.Group();
  root.name = "opening:" + o.id;
  root.userData.animated = true;
  const side = o.r2Glazing === "side",
    count = side ? 3 : 4,
    span = o.width,
    overlap = 0.02;
  const length = (span + (count - 1) * overlap) / count,
    step = length - overlap;
  const sill = o.sill || 0,
    height = o.height;
  const r3 = o.r3Corner;
  // Absent r3Corner keeps the historical R2 track, rail, post and handle placement.
  const trackDirection = !r3 ? -1 : (r3.trackDirection ?? (side ? 1 : -1));
  const railOffsetM = !r3 ? 0 : (r3.railOffsetM ?? (side ? 0.027 : 0));
  const railThicknessM = !r3
    ? 0.085
    : (r3.railThicknessM ?? (side ? 0.104 : 0.085));
  const startPostOffsetM = !r3
    ? 0
    : (r3.startPostOffsetM ?? (side ? 0.013 : 0));
  const endPostOffsetM = !r3 ? 0 : (r3.endPostOffsetM ?? (side ? 0.054 : 0));
  const handleSide = !r3 ? 1 : (r3.handleSide ?? (side ? -1 : 1));
  const omitEndPost = !!r3?.omitEndPost;
  const parkOutside = side && !!r3?.parkOutside;
  const railExtension = parkOutside ? length : 0;
  const originX = side ? 3.92 : 0,
    originZ = side ? 4.31 : 5.85;
  root.position.set(originX, 0, originZ);
  scene.add(root);
  tag(root, ["kitchen", "bar", "hall"], "opening");
  const box = (
    g: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: string,
  ) => {
    const a = new THREE.Mesh(
      metricUV(new THREE.BoxGeometry(w, h, d)),
      m[mat] || m.steel,
    );
    a.position.set(x, y, z);
    a.castShadow = mat !== "glass";
    a.receiveShadow = true;
    g.add(a);
    return a;
  };
  const rail = (
    g: THREE.Object3D,
    len: number,
    h: number,
    t: number,
    x: number,
    y: number,
    z: number,
    mat: string,
  ) =>
    side ? box(g, t, h, len, x, y, z, mat) : box(g, len, h, t, x, y, z, mat);
  // The entrance track is recessed flush with the floor, never an impassable 2D fence.
  for (const y of [side ? -0.013 : sill + 0.012, sill + height - 0.012])
    rail(
      root,
      span + railExtension,
      0.024,
      railThicknessM,
      side ? railOffsetM : 0,
      y,
      side ? (span - railExtension) / 2 : railOffsetM,
      "steel",
    ).position[side ? "z" : "x"] = (span - railExtension) / 2;
  for (const end of [0, span]) {
    if ((omitEndPost && end === span) || (r3?.omitStartPost && end === 0))
      continue;
    const normal = end === 0 ? startPostOffsetM : endPostOffsetM;
    if (side)
      box(root, 0.025, height, 0.025, normal, sill + height / 2, end, "steel");
    else
      box(root, 0.025, height, 0.025, end, sill + height / 2, normal, "steel");
  }
  const trackOffsetsM: number[] = [];
  for (let i = 0; i < count; i++) {
    const leaf = new THREE.Group();
    leaf.name = `${o.id}:leaf:${i}`;
    leaf.userData.animated = true;
    const center = length / 2 + i * step,
      offset = (r3?.firstTrackOffsetM ?? 0) + trackDirection * i * 0.027;
    trackOffsetsM.push(offset);
    leaf.position.set(side ? offset : center, 0, side ? center : offset);
    root.add(leaf);
    rail(
      leaf,
      length - 0.04,
      height - 0.05,
      0.008,
      0,
      sill + height / 2,
      0,
      "glass",
    );
    for (const edge of [-1, 1]) {
      if (side)
        box(
          leaf,
          0.024,
          height,
          0.024,
          0,
          sill + height / 2,
          edge * (length / 2 - 0.012),
          "bronze",
        );
      else
        box(
          leaf,
          0.024,
          height,
          0.024,
          edge * (length / 2 - 0.012),
          sill + height / 2,
          0,
          "bronze",
        );
    }
    for (const y of [sill + 0.012, sill + height - 0.012])
      rail(leaf, length, 0.024, 0.024, 0, y, 0, "bronze");
    if (i === count - 1) {
      let handleNormal = handleSide * 0.025,
        handleAlong = length / 2 - 0.065;
      // Counter leaf metal at +z can meet the side terminal post that owns [span, 5.85].
      if (!side && r3) {
        const postHalf = 0.0125,
          handleHalfX = 0.009,
          handleHalfZ = 0.0175,
          clearance = 0.004;
        const hits = () =>
          Math.abs(center + handleAlong - span) <
            postHalf + handleHalfX + clearance &&
          Math.abs(offset + handleNormal) < postHalf + handleHalfZ + clearance;
        let guard = 0;
        while (hits() && guard++ < 12) {
          handleAlong -= 0.012;
          handleNormal += handleSide * 0.008;
        }
      }
      if (side)
        box(
          leaf,
          0.035,
          0.15,
          0.018,
          handleNormal,
          sill + height * 0.52,
          handleAlong,
          "steel",
        );
      else
        box(
          leaf,
          0.018,
          0.12,
          0.035,
          handleAlong,
          sill + height * 0.5,
          handleNormal,
          "steel",
        );
    }
    moving.push({
      group: leaf,
      closed: [side ? offset : center, side ? center : offset],
      travel: side
        ? [0, -i * step - (parkOutside ? length : 0)]
        : [-i * step, 0],
    });
  }
  const endpoint = (along: number, normal: number) => ({
    x: originX + (side ? normal : along),
    z: originZ + (side ? along : normal),
  });
  root.userData.glazingAudit = {
    leaves: count,
    spanM: span,
    stackLengthM: length,
    openBudgetM: span - length - 0.04,
    status: "concept_mechanism_not_selected_hardware",
    sillM: sill,
    ...(r3
      ? {
          trackOffsetsM,
          trackDirection,
          parkOutside,
          railExtensionM: railExtension,
          endpoints: {
            start: r3.omitStartPost ? null : endpoint(0, startPostOffsetM),
            end: omitEndPost ? null : endpoint(span, endPostOffsetM),
          },
        }
      : {}),
  };
  return root;
}
