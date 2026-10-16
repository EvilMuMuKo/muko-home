import { allocateLighting, observerRoom } from "./lighting-allocation";
import { buildSoftBedding } from "./soft-bedding";
import { initAreaLighting, alignAreaLight } from "./area-lighting";
import { attachDynamicContact } from "./dynamic-contact";
import { showWelcome } from "./welcome";
import { createGhostWalk } from "./ghost-walk";
import { createWalkCollision } from "./walk-collision";
import { auditSceneModel } from "./model-audit";
import { buildPlant } from "./plant-mesh";
import { daylightStudy, sunDirection } from "./daylight";
import { createHomeDesign } from "./home-design";
import { createLifeDesign } from "./life-design";
import { createLifeMotion, buildLifeFurniture, applyLifeMotion } from "./life-mesh";
import { createExteriorWorld } from "./exterior-world";
import { createRoomRadiance } from "./room-radiance";
import { createBathMirror } from "./planar-mirror";
import { createDiffuseBounce } from "./diffuse-bounce";
import bakedDiffuse from "./generated-diffuse.json";
import {
  createHomeMotion,
  buildHomeFurniture,
  buildHomeArchitecture,
  applyHomeMotion,
  homeMotionBounds,
  updateHomeLighting,
} from "./home-mesh";
import { createSalonDesign } from "./salon-design";
import { prepareSalonMaterials } from "./salon-materials";
import { buildSalonFurniture } from "./salon-mesh";
import { createAtmosphereDesign, themeMoments } from "./atmosphere-design";
import {
  configureRoomMaterials,
  finishWall,
  finishArchitecture,
  finishFurniture,
} from "./room-finish";
import { buildInteriorDetails, mountMomentControls } from "./interior-detail";
import { mountStoragePanel } from "./storage-panel";
import { refineMaterials, whenMaterialTexturesReady, materialDetailState, auditMaterialSet } from "./material-detail";
import { createStorageDesign, storageCapacity } from "./storage-design";
import { buildStorageUnit } from "./storage-mesh";
import { metricUV } from "./texture-mapping";
import { batchFurniture } from "./batching";
import { quality } from "./quality";
import { enhanceSurfaces } from "./surface";
import { bakeStaticFloorOcclusion } from "./baked-occlusion";
import { createRenderer, environmentGenerator, rendering } from "./renderer";
import { gpuStartupDeadline, isGPUDeviceLoss } from "./gpu-recovery";
import { initGeometry, transformGeometry, geometryState } from "./geometry";
// Scene recovered from the published V5 bundle; original local names retained.
import * as yi from "three";
import {
  BoxGeometry as Rn,
  Mesh as tt,
  CylinderGeometry as Ei,
  Vector3 as P,
  MathUtils as Kn,
  Group as mn,
  SphereGeometry as Zi,
  HemisphereLight as nr,
  DirectionalLight as ar,
  MeshStandardMaterial as ui,
  CapsuleGeometry as _s,
  PerspectiveCamera as Ut,
  OrthographicCamera as jn,
  Box3 as Ft,
  PCFShadowMap as ws,
  ACESFilmicToneMapping as Ts,
  SRGBColorSpace as on,
  Scene as Xi,
  Color as ve,
} from "three";
import baseModel from "./model.js";
const pt = createLifeDesign(createHomeDesign(
  createSalonDesign(createAtmosphereDesign(createStorageDesign(baseModel))),
));
const homeMotion = createHomeMotion();
const lifeMotion = createLifeMotion();
const currentStorage = () =>
  ut.objects.filter((o) => o.type === "wall_storage");
let spatialDesign, compositionMaterial, exteriorWorld, roomRadiance;
let diffuseBounce, diffuseReady = Promise.resolve();
let visualEnhancementsReady = Promise.resolve();
const startupTiming = { started: performance.now(), stages: {} };
function startupStage(name) { startupTiming.stages[name] = Math.round(performance.now() - startupTiming.started); }
const bakeOnly = new URLSearchParams(location.search).has("gi-bake");
function syncDiffuseRoom(room) {
  // One bounded volume follows the observer; overlapping hall has no baked grid.
  diffuseBounce?.setRoom(room || "hall");
}
async function loadDiffuseVariant(night, compile = true) {
  if (!diffuseBounce || bakeOnly) return;
  const room = ghostWalk ? observerRoom(ut.rooms,ct.position.toArray(),"all") : Wt;
  syncDiffuseRoom("hall");
  for (const data of bakedDiffuse.variants[night?"night":"day"] || []) diffuseBounce.install(data);
  syncDiffuseRoom(room);
  if (compile) await Ht.compileAsync(Ct,ct);
  Oi();
}
let renderEffectTier = 0;
let reflectionPauseDepth = 0;
let bathMirror;
let roomAtmosphere;
import { OrbitControls as Mc } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry as ru } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment as au } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries as gu } from "three/addons/utils/BufferGeometryUtils.js";
function Jg(i) {
  let e = {};
  function t(h, u = !1) {
    let d = document.createElement("canvas");
    d.width = d.height = 512;
    let f = d.getContext("2d"),
      p = 78131,
      x = () => ((p = (p * 1664525 + 1013904223) >>> 0), p / 4294967296);
    if (
      ((f.fillStyle = u
        ? "#8080ff"
        : h === "wood"
          ? "#d8c8ab"
          : h === "linen"
            ? "#d9d3c6"
            : h === "stone"
              ? "#dedbd3"
              : "#e6e3dc"),
      f.fillRect(0, 0, 512, 512),
      h === "wood")
    )
      for (let m = 0; m < 2500; m++) {
        let y = x() * 512,
          b = x() * 512,
          v = x() * 7;
        ((f.strokeStyle = u
          ? `rgba(155,118,245,${x() * 0.2})`
          : `rgba(84,62,34,${x() * 0.085})`),
          (f.lineWidth = 0.3 + x() * 0.8),
          f.beginPath(),
          f.moveTo(y, b),
          f.bezierCurveTo(y + v, b + 40, y - v, b + 110, y + x() * 3, b + 200),
          f.stroke());
      }
    else if (h === "linen")
      for (let m = 0; m < 512; m += 3)
        ((f.fillStyle = u
          ? m % 2
            ? "#8280fe"
            : "#7d82fe"
          : "rgba(91,82,67,.055)"),
          f.fillRect(m, 0, 1, 512),
          f.fillRect(0, m, 512, 1));
    else
      for (let m = 0; m < 2e4; m++)
        ((f.fillStyle = u
          ? `rgba(138,124,250,${x() * 0.13})`
          : `rgba(86,77,62,${x() * (h === "stone" ? 0.055 : 0.018)})`),
          f.fillRect(x() * 512, x() * 512, x() * 2, x() * 2));
    let g = new i.CanvasTexture(d);
    return (
      (g.wrapS = g.wrapT = i.RepeatWrapping),
      (g.colorSpace = u ? i.NoColorSpace : i.SRGBColorSpace),
      (g.anisotropy = 4),
      g
    );
  }
  for (let h of ["wood", "linen", "stone", "plaster"])
    e[h] = { color: t(h), normal: t(h, !0) };
  let n = {},
    s = {
      oak: ["#f0e6d6", "wood", 0.75, 0],
      darkoak: ["#c8b290", "wood", 0.73, 0],
      stone: ["#ebe6db", "stone", 0.82, 0],
      linen: ["#f5f1e8", "linen", 0.98, 0],
      sage: ["#9aab96", "linen", 0.96, 0],
      charcoal: ["#434943", null, 0.86, 0],
      plaster: ["#eeeae0", "plaster", 0.95, 0],
      cream: ["#e8e7df", null, 0.53, 0],
      black: ["#202420", null, 0.53, 0],
      steel: ["#bbc1be", null, 0.32, 0.85],
      bronze: ["#a7916b", null, 0.36, 0.68],
    };
  for (let [h, [u, d, f, p]] of Object.entries(s))
    n[h] = new i.MeshStandardMaterial({
      color: u,
      roughness: f,
      metalness: p,
      map: d ? e[d].color : null,
      normalMap: d ? e[d].normal : null,
      normalScale: new i.Vector2(
        d === "linen" ? 0.04 : 0.025,
        d === "linen" ? 0.04 : 0.025,
      ),
    });
  ((n.cabinetPaint = new i.MeshStandardMaterial({
    color: "#a6b0a0",
    roughness: 0.72,
  })),
    (n.barStone = n.stone.clone()),
    n.barStone.color.set("#b7b7aa"),
    (n.glass = new i.MeshPhysicalMaterial({
      color: "#d8e4dc",
      transparent: !0,
      opacity: 0.2,
      roughness: 0.13,
      metalness: 0,
      side: i.DoubleSide,
      depthWrite: !1,
      clearcoat: 0.35,
      clearcoatRoughness: 0.15,
    })),
    (n.screen = new i.MeshStandardMaterial({
      color: "#1c292d",
      roughness: 0.22,
      emissive: "#17242a",
      emissiveIntensity: 0.12,
    })),
    (n.light = new i.MeshStandardMaterial({
      color: "#fff5df",
      emissive: "#ffe3b3",
      emissiveIntensity: 1.2,
    })));
  let r = document.createElement("canvas");
  r.width = r.height = 512;
  let a = r.getContext("2d"),
    o = 23,
    l = () => ((o = (o * 1103515245 + 12345) >>> 0), o / 4294967296);
  for (let h = 0; h < 4; h++) {
    ((a.fillStyle = `hsl(37 28% ${70 + l() * 7}%)`),
      a.fillRect(h * 128, 0, 128, 512));
    for (let u = 0; u < 150; u++) {
      ((a.strokeStyle = `rgba(93,69,42,${l() * 0.07})`), a.beginPath());
      let d = h * 128 + l() * 128;
      (a.moveTo(d, 0),
        a.bezierCurveTo(d + 5, 160, d - 4, 350, d + 2, 512),
        a.stroke());
    }
    ((a.fillStyle = "#8d80654d"),
      a.fillRect(h * 128, 0, 1, 512),
      a.fillRect(h * 128, 128 + (h % 2) * 256, 128, 1));
  }
  let c = new i.CanvasTexture(r);
  return (
    (c.colorSpace = i.SRGBColorSpace),
    (c.wrapS = c.wrapT = i.RepeatWrapping),
    c.repeat.set(1 / 0.72, 1 / 2.4),
    (c.anisotropy = 4),
    (n.floor = new i.MeshStandardMaterial({
      map: c,
      color: "#ede6d8",
      roughness: 0.82,
    })),
    n
  );
}
function Kg({
  THREE: i,
  scene: e,
  model: t,
  materials: n,
  mesh: s,
  tag: r,
  movingParts: a,
}) {
  let o = t.rooms.map((_) => ({
    ..._,
    polygon:
      _.id === "hall"
        ? [
            [4.8, 1.65],
            [6.9, 1.65],
            [6.9, 7.3],
            [7.8, 7.3],
            [7.8, 8.45],
            [4.8, 8.45],
          ]
        : _.id === "living"
          ? [
              [6.9, 4.4],
              [11.65, 4.4],
              [11.65, 9.35],
              [7.95, 9.35],
              [7.95, 8.45],
              [7.8, 8.45],
              [7.8, 7.3],
              [6.9, 7.3],
            ]
          : _.polygon,
  }));
  function l(_, A) {
    let E = !1;
    for (let L = 0, N = A.length - 1; L < A.length; N = L++) {
      let R = A[L],
        C = A[N];
      R[1] > _[1] != C[1] > _[1] &&
        _[0] < ((C[0] - R[0]) * (_[1] - R[1])) / (C[1] - R[1]) + R[0] &&
        (E = !E);
    }
    return E;
  }
  function c(_, A, E = 0, L = 0) {
    let N = [];
    for (let R of o)
      (l([_ + E, A + L], R.polygon) || l([_ - E, A - L], R.polygon)) &&
        N.push(R.id);
    return N.length ? N : ["hall"];
  }
  function h(_, A) {
    return o.filter((E) => l([_, A], E.polygon)).map((E) => E.id);
  }
  function u(_, A, E) {
    let L = _.b[0] - _.a[0],
      N = _.b[1] - _.a[1],
      R = Math.hypot(L, N),
      C = -N / R,
      O = L / R,
      U = _.thickness / 2 + 0.005;
    return [-1, 1].map((B) => ({
      sign: B,
      nx: C,
      nz: O,
      ids: h(A + C * U * B, E + O * U * B),
    }));
  }
  function d(_) {
    let A = new i.Shape();
    return (
      _.forEach(([E, L], N) => (N ? A.lineTo(E, -L) : A.moveTo(E, -L))),
      A.closePath(),
      A
    );
  }
  function f(_, A, E, L) {
    let N = new i.Mesh(metricUV(new i.ShapeGeometry(d(_))), n[A]);
    return (
      (N.rotation.x = -Math.PI / 2),
      (N.position.y = 0.001),
      (N.receiveShadow = !0),
      (N.name = L),
      e.add(N),
      r(N, E, "floor"),
      N
    );
  }
  for (let _ of o)
    f(
      _.polygon,
      ["kitchen", "bath", "balcony"].includes(_.id) ? "stone" : "floor",
      [_.id],
      "floor:" + _.id,
    );
  f(
    [
      [3.5, 4.8],
      [4.8, 4.8],
      [4.8, 5.4],
      [3.5, 5.4],
    ],
    "floor",
    ["hall", "bar"],
    "floor:released-threshold",
  );
  let p =
      n.ceiling ||
      new i.MeshStandardMaterial({
        color: "#fffaf1",
        roughness: 0.96,
        metalness: 0,
        side: i.DoubleSide,
      }),
    x = new i.Mesh(
      new i.ExtrudeGeometry(d(t.shell), { depth: 0.08, bevelEnabled: !1 }),
      p,
    );
  ((x.rotation.x = -Math.PI / 2),
    (x.position.y = 2.7),
    (x.name = "ceiling:shell"),
    (x.castShadow = !1),
    (x.receiveShadow = !0),
    e.add(x));
  let g = o.map((_) => _.id);
  r(x, g, "ceiling");
  let m = new Map();
  for (let _ of t.openings.filter((A) => !A.standalone))
    (m.has(_.wallId) || m.set(_.wallId, []), m.get(_.wallId).push(_));
  let y = [],
    b = [];
  for (let _ of t.walls) {
    let A = _.a[0],
      E = _.a[1],
      L = _.b[0] - A,
      N = _.b[1] - E,
      R = Math.hypot(L, N),
      C = L / R,
      O = N / R,
      U = -Math.atan2(O, C),
      B = m.get(_.id) || [],
      J = [0, R];
    for (let V of B) {
      let W = (V.center[0] - A) * C + (V.center[1] - E) * O;
      J.push(
        Math.max(0, Math.min(R, W - V.width / 2)),
        Math.max(0, Math.min(R, W + V.width / 2)),
      );
    }
    for (let V of o)
      for (let W of V.polygon) {
        let ce = (W[0] - A) * C + (W[1] - E) * O;
        ce > 0 && ce < R && J.push(ce);
      }
    let F = [...new Set(J.map((V) => Math.round(V * 1e6) / 1e6))].sort(
      (V, W) => V - W,
    );
    for (let V = 0; V < F.length - 1; V++) {
      let W = F[V],
        ce = F[V + 1];
      if (ce - W < 0.001) continue;
      let Q = (W + ce) / 2,
        Ie = A + Q * C,
        Ue = E + Q * O,
        ke = B.find(
          (oe) =>
            Math.abs((oe.center[0] - A) * C + (oe.center[1] - E) * O - Q) <
            oe.width / 2 - 1e-4,
        ),
        Z = [[0, _.height]];
      ke &&
        (Z =
          ke.type === "window"
            ? [
                [0, ke.sill],
                [ke.sill + ke.height, _.height],
              ]
            : ke.type === "open"
              ? [[ke.height || 2.08, _.height]]
              : [[ke.height || 2.08, _.height]]);
      let te = c(
        Ie,
        Ue,
        -O * (_.thickness / 2 + 0.04),
        C * (_.thickness / 2 + 0.04),
      );
      for (let [oe, Ce] of Z) {
        if (Ce - oe < 0.001) continue;
        let _e = s(
          e,
          ce - W,
          Ce - oe,
          _.thickness,
          Ie,
          (oe + Ce) / 2,
          Ue,
          "plaster",
          0,
        );
        ((_e.rotation.y = U),
          (_e.castShadow = !0),
          (_e.receiveShadow = !0),
          finishWall(_e, _.id, u(_, Ie, Ue), n),
          (_e.name = "wall:" + _.id),
          r(_e, te, "wall"));
      }
      if ((!ke || ke.type === "window") && ce - W > 0.02)
        for (let oe of u(_, Ie, Ue)) {
          if (!oe.ids.length) continue;
          let Ce = oe.sign * (_.thickness / 2 + 0.005),
            _e = Ie + oe.nx * Ce,
            Xe = Ue + oe.nz * Ce,
            ot = s(e, ce - W, 0.08, 0.01, _e, 0.04, Xe, "oak", 0.002);
          ((ot.rotation.y = U),
            (ot.name = "skirting:" + _.id + ":" + oe.sign),
            r(ot, oe.ids, "trim"),
            y.push({
              wallId: _.id,
              start: W,
              end: ce,
              side: oe.sign,
              roomIds: oe.ids,
              faceOffsetM: _.thickness / 2 + 0.005,
            }));
        }
    }
  }
  for (let _ of t.openings) {
    let A = t.walls.find((R) => R.id === _.wallId),
      E = A ? Math.atan2(A.b[1] - A.a[1], A.b[0] - A.a[0]) : 0,
      L =
        _.id === "hall-gate"
          ? ["bar", "hall"]
          : c(_.center[0], _.center[1], Math.sin(E) * 0.15, Math.cos(E) * 0.15),
      N = 0.035;
    if (
      _.type === "window" &&
      !t.homeDesign?.bayWindows?.some((b) => b.windowId === _.id)
    ) {
      let R = new i.Group();
      ((R.name = "opening:" + _.id),
        R.position.set(_.center[0], _.sill, _.center[1]),
        (R.rotation.y = -E),
        s(R, _.width, _.height, 0.012, 0, _.height / 2, 0, "glass", 0),
        s(R, 0.025, _.height, 0.036, 0, _.height / 2, 0, "steel", 0.002));
      for (let F of [0.014, _.height - 0.014])
        s(R, _.width, 0.028, 0.036, 0, F, 0, "steel", 0.002);
      let C = A ? u(A, _.center[0], _.center[1]) : [];
      for (let F of [-1, 1]) {
        let V = A ? F * (A.thickness / 2 + 0.005) : 0,
          W = new i.Group();
        ((W.name = "trim:" + _.id + ":" + F),
          W.position.copy(R.position),
          (W.rotation.y = -E));
        for (let ce of [-1, 1])
          s(
            W,
            N,
            _.height,
            0.045,
            ce * (_.width / 2 + N / 2),
            _.height / 2,
            V,
            "bronze",
            0.002,
          );
        for (let ce of [0, _.height])
          s(
            W,
            _.width + 2 * N,
            N,
            0.045,
            0,
            ce + (ce === 0 ? -N / 2 : N / 2),
            V,
            "oak",
            0.002,
          );
        (e.add(W), r(W, C.find((ce) => ce.sign === F)?.ids || L, "trim"));
      }
      let O = C.find((F) => F.ids.length),
        U = 0.22,
        B = 0.02,
        J = O?.sign || 1;
      (s(
        R,
        _.width + 0.06,
        0.028,
        U,
        0,
        -0.014,
        J * ((A?.thickness || 0.18) / 2 + B - U / 2),
        "stone",
        0.002,
      ),
        e.add(R),
        r(R, L, "opening"),
        b.push({
          id: _.id,
          projectionIntoRoomM: B,
          depthM: U,
          interiorSide: J,
        }));
    }
    if (_.type === "door") {
      if (A) {
        let B = _.height || 2.08;
        for (let J of u(A, _.center[0], _.center[1])) {
          let F = new i.Group();
          ((F.name = "trim:" + _.id + ":" + J.sign),
            F.position.set(_.center[0], 0, _.center[1]),
            (F.rotation.y = -E));
          let V = J.sign * (A.thickness / 2 + 0.005);
          for (let W of [-1, 1])
            s(
              F,
              N,
              B,
              0.045,
              W * (_.width / 2 + N / 2),
              B / 2,
              V,
              "oak",
              0.002,
            );
          (s(F, _.width + 2 * N, N, 0.045, 0, B + N / 2, V, "oak", 0.002),
            e.add(F),
            r(F, J.ids.length ? J.ids : L, "trim"));
        }
      }
      let R = new i.Group();
      ((R.name = "opening:" + _.id), R.position.set(_.hinge[0], 0, _.hinge[1]));
      let C = _.height || 2.08,
        O = -i.MathUtils.degToRad(_.rotation || 0),
        U = i.MathUtils.degToRad(_.openAngle || 0);
      ((R.rotation.y = O - U),
        s(
          R,
          _.width,
          C,
          _.thickness || 0.04,
          _.width / 2,
          C / 2,
          0,
          "oak",
          0.006,
        ),
        s(R, 0.07, 0.016, 0.025, _.width - 0.1, 0.93, -0.013, "bronze"),
        e.add(R),
        r(R, _.id === "entry-door" ? ["hall"] : L, "opening"),
        _.id === "entry-door" && a.entry.push({ group: R, base: O, angle: U }));
    }
    if (_.type === "sliding_door") {
      if (A) {
        let B = _.height || 2.08;
        for (let J of u(A, _.center[0], _.center[1])) {
          let F = new i.Group();
          ((F.name = "trim:" + _.id + ":" + J.sign),
            F.position.set(_.center[0], 0, _.center[1]),
            (F.rotation.y = -E));
          let V = J.sign * (A.thickness / 2 + 0.005);
          for (let W of [-1, 1])
            s(
              F,
              N,
              B,
              0.045,
              W * (_.width / 2 + N / 2),
              B / 2,
              V,
              "steel",
              0.002,
            );
          (s(F, _.width + 2 * N, N, 0.045, 0, B + N / 2, V, "steel", 0.002),
            e.add(F),
            r(F, J.ids.length ? J.ids : L, "trim"));
        }
      }
      let R = new i.Group();
      R.name = "opening:" + _.id;
      let C = _.panelClosedCenter || _.center,
        O = _.thickness || 0.04,
        U = 0.04;
      (R.position.set(C[0], 0, C[1]),
        s(
          R,
          _.width - 2 * U,
          _.height - 2 * U,
          0.01,
          0,
          _.height / 2,
          0,
          "glass",
          0,
        ));
      for (let B of [-_.width / 2 + U / 2, _.width / 2 - U / 2])
        s(R, U, _.height, O, B, _.height / 2, 0, "steel", 0.002);
      for (let B of [U / 2, _.height - U / 2])
        s(R, _.width, U, O, 0, B, 0, "steel", 0.002);
      (s(
        R,
        0.025,
        0.12,
        0.005,
        _.width / 2 - 0.075,
        _.height * 0.52,
        -O / 2 + 0.0025,
        "bronze",
        0,
      ),
        e.add(R),
        r(R, ["kitchen", "bar", "hall"], "opening"),
        a.kitchen.push({ group: R, closed: C, travel: _.travel || [0, 0] }));
    }
    if (_.type === "gate" && _.id !== "hall-gate") {
      let R = new i.Group();
      ((R.name = "opening:" + _.id), R.position.set(_.hinge[0], 0, _.hinge[1]));
      let C = _.thickness || 0.025;
      s(
        R,
        _.width,
        _.height,
        C,
        _.width / 2,
        _.height / 2,
        0,
        "darkoak",
        0.006,
      );
      for (let O of [-1, 1])
        s(
          R,
          0.04,
          0.09,
          0.004,
          _.width - 0.1,
          0.56,
          O * (C / 2 - 0.002),
          "bronze",
          0,
        );
      (e.add(R),
        r(R, ["bar", "hall"], "opening"),
        a.gate.push({
          group: R,
          base: -i.MathUtils.degToRad(_.rotation),
          angle: i.MathUtils.degToRad(_.openAngle),
        }));
    }
  }
  let v = new i.Box3().setFromPoints(
      t.shell.map(([_, A]) => new i.Vector3(_, 0, A)),
    ),
    M = v.getSize(new i.Vector3()),
    w = v.getCenter(new i.Vector3()),
    I = s(e, M.x + 0.45, 0.15, M.z + 0.45, w.x, -0.09, w.z, "stone", 0.03);
  return (
    r(I, [], "plinth"),
    {
      floorRooms: o,
      ceiling: x,
      detailOwnership: { ceiling: g, skirting: y, windowSills: b },
    }
  );
}
function Qg({ THREE: i, scene: e, model: t, registerVisual: n, mobile: s }) {
  let r = t.lighting || { fixtures: [], scenes: [] },
    a = new i.Group();
  ((a.name = "lighting-fixtures"), e.add(a));
  let o = [],
    l = new Set(),
    c = new Set(),
    h = [],
    areaPool = [],
    areaBudget = quality.mobile ? 1 : 2,
    u = r.defaultScene || "warm",
    d = null,
    f = null,
    observer = null,
    p = !0,
    x = true,
    g = quality.shadowLights,
    m = quality.lightSlots,
    y = (R) => new i.Vector3(...R);
  function b(R) {
    let C = R / 100,
      O = C <= 66 ? 255 : 329.698727446 * Math.pow(C - 60, -0.1332047592),
      U =
        C <= 66
          ? 99.4708025861 * Math.log(C) - 161.1195681661
          : 288.1221695283 * Math.pow(C - 60, -0.0755148492),
      B =
        C >= 66
          ? 255
          : C <= 19
            ? 0
            : 138.5177312231 * Math.log(C - 10) - 305.0447927307;
    return new i.Color(
      Math.min(255, Math.max(0, O)) / 255,
      Math.min(255, Math.max(0, U)) / 255,
      Math.min(255, Math.max(0, B)) / 255,
    ).convertSRGBToLinear();
  }
  function v(R) {
    let C = new i.MeshStandardMaterial(R);
    return (c.add(C), C);
  }
  function M(R, C, O, U, B) {
    let J = new i.BoxGeometry(C, O, U);
    l.add(J);
    let F = new i.Mesh(J, B);
    return (R.add(F), F);
  }
  let w = v({ color: 3881266, roughness: 0.72, metalness: 0.25 }),
    I = v({ color: 1645080, roughness: 0.9, metalness: 0.12 });
  for (let R of r.fixtures) {
    let C = new i.Group();
    ((C.name = `fixture:${R.id}`),
      (C.userData.roomId = R.roomId),
      (C.userData.spaceIds = R.spaceIds || [R.roomId]),
      C.position.copy(y(R.position)),
      a.add(C));
    let O = b(R.kelvin || 3e3),
      U = v({
        color: 16183263,
        emissive: O,
        emissiveIntensity: 0,
        roughness: 0.48,
        toneMapped: !1,
      });
    if (R.type === "line") {
      let V = R.axis || "x",
        W = R.length || 0.3,
        ce =
          V === "y"
            ? [0.025, W, 0.035]
            : V === "z"
              ? [0.035, 0.025, W]
              : [W, 0.025, 0.035],
        Q = M(C, ce[0] + 0.01, ce[1] + 0.008, ce[2] + 0.01, w);
      M(C, ce[0], ce[1], ce[2], U);
      let Ie = y(R.target).sub(y(R.position)).normalize();
      Q.position.copy(Ie.multiplyScalar(-0.021));
    } else {
      let V = new i.CylinderGeometry(0.045, 0.05, 0.055, 20);
      l.add(V);
      let W = new i.Mesh(V, w);
      (C.add(W), (W.position.y = 0.052));
      let ce = new i.CylinderGeometry(0.035, 0.031, 0.027, 20);
      l.add(ce);
      let Q = new i.Mesh(ce, I);
      (C.add(Q), (Q.position.y = 0.015));
      let Ie = new i.CircleGeometry(0.022, 20);
      l.add(Ie);
      let Ue = new i.Mesh(Ie, U);
      (C.add(Ue),
        (Ue.rotation.x = -Math.PI / 2),
        (Ue.position.y = 0),
        C.quaternion.setFromUnitVectors(
          new i.Vector3(0, -1, 0),
          y(R.target).sub(y(R.position)).normalize(),
        ));
    }
    if (R.support?.kind === "desk-clamp") {
      let V = y(R.support.base).sub(y(R.position)),
        W = -V.y;
      (M(C, 0.012, W, 0.014, w).position.set(V.x, V.y / 2, V.z),
        M(C, 0.065, 0.018, 0.08, w).position.copy(V));
    }
    let B = i.MathUtils.degToRad((R.beamAngle || 60) / 2),
      J =
        ((R.lumens || 300) / (2 * Math.PI * (1 - Math.cos(B)))) *
        (r.previewIntensityScale ?? 0.025),
      F = null;
    if (R.position[1] > 2.2 && R.type !== "line") {
      ((F = new i.Group()),
        (F.name = "fixture-mount:" + R.id),
        (F.userData.spaceIds = R.spaceIds || [R.roomId]));
      let V = Math.max(0.025, 2.7 - R.position[1] - 0.035);
      (M(F, 0.015, V, 0.015, w).position.set(
        R.position[0],
        R.position[1] + 0.035 + V / 2,
        R.position[2],
      ),
        M(F, 0.11, 0.015, 0.11, w).position.set(
          R.position[0],
          2.6925,
          R.position[2],
        ),
        a.add(F),
        n && n(F, R.roomId));
    }
    (o.push({
      f: R,
      root: C,
      mount: F,
      emission: U,
      color: O.clone(),
      baseIntensity: J,
      half: B,
      logicalVisible: !1,
    }),
      n && n(C, R.roomId));
  }
  for (let R = 0; R < m - areaBudget; R++) {
    let C = new i.SpotLight(16777215, 0, 3, Math.PI / 6, 0.65, 2);
    ((C.name = x ? `light:mobile-slot-${R}` : `light:${o[R]?.f.id || R}`),
      (C.visible = !0),
      (C.castShadow = !1),
      C.shadow.mapSize.set(
        R < g ? quality.shadowSize : 1,
        R < g ? quality.shadowSize : 1,
      ),
      (C.shadow.bias = -15e-5),
      (C.shadow.normalBias = 0.01),
      (C.shadow.camera.near = 0.03),
      (C.shadow.camera.far = 3),

      e.add(C),
      e.add(C.target),
      h.push(C),
      !x && o[R] && (o[R].light = C));
  }
  for (let index = 0; index < areaBudget; index++) {
    const light = new i.RectAreaLight(0xffffff, 0, 1, 0.035);
    light.name = `light:area-slot-${index}`;
    e.add(light); areaPool.push(light);
  }
  function _() {
    let R = r.scenes.find((C) => C.id === u) || r.scenes[0];
    for (let C of o) {
      let O = !d || d.has(C.f.roomId),
        U =
          R?.fixtureLevels?.[C.f.id] ??
          R?.roomLevels?.[C.f.roomId]?.[C.f.group] ??
          R?.levels?.[C.f.group] ??
          0;
      C.color.copy(b(R?.fixtureKelvin?.[C.f.id] ?? C.f.kelvin ?? 3000));
      C.emission.emissive.copy(C.color);
      if (
        ((C.logicalVisible = O),
        (C.root.visible = O && (p || C.f.position[1] < 2.2)),
        C.mount && (C.mount.visible = O && p),
        (C.emission.emissiveIntensity = U > 0 ? 0.08 * U : 0),
        (C.level = U),
        (C.score =
          ((C.f.lumens || 300) * U) /
          (observer
            ? 1 +
              0.18 *
                ((C.f.position[0] - observer[0]) ** 2 +
                  (C.f.position[2] - observer[2]) ** 2)
            : 1)),
        !x)
      ) {
        let B = C.light;
        (B.position.copy(y(C.f.position)),
          B.target.position.copy(y(C.f.target)),
          B.color.copy(C.color),
          (B.angle = C.half),
          (B.distance = C.f.range || 3),
          (B.visible = O),
          (B.intensity = C.baseIntensity * U),
          (B.userData.roomId = C.f.roomId),
          (B.userData.spaceIds = C.f.spaceIds || [C.f.roomId]),
          (B.shadow.camera.far = C.f.range || 3),
          (B.castShadow = !1));
      }
    }
    if (x) {
      const localRoom = observerRoom(t.rooms, observer, Wt);
      const active = o.filter(F => F.logicalVisible && F.level > 0);
      const spots = allocateLighting(active.filter(F => F.f.type !== "line"), m - areaBudget, localRoom, quality.mobile);
      const areas = allocateLighting(active.filter(F => F.f.type === "line"), areaBudget, localRoom, quality.mobile);
      const O = [...spots, ...areas];
      for (let index = 0; index < areaPool.length; index++) {
        const light = areaPool[index], fixture = areas[index];
        if (fixture) {
          alignAreaLight(light, fixture.f, fixture.color, fixture.level, r.previewIntensityScale ?? 0.025);
          light.userData.sourceId = fixture.f.id;
          light.userData.roomId = fixture.f.roomId;
        } else { light.intensity = 0; light.userData.sourceId = null; light.userData.roomId = null; }
      }
      for (const fixture of O)
        fixture.emission.emissiveIntensity = 0.18 + 0.5 * fixture.level;
      let B = spots.filter(
        (F) => (F.f.shadowPriority || 0) > 0 && F.baseIntensity * F.level > 0,
      ).sort(
        (F, V) => (V.f.shadowPriority || 0) - (F.f.shadowPriority || 0),
      )[0];
      f = B?.f.id || null;
      let J = B ? [B, ...spots.filter((F) => F !== B)] : spots;
      for (let F = 0; F < h.length; F++) {
        let V = h[F],
          W = J[F];
        ((V.visible = !0),
          (V.intensity = W ? Math.min(2.8, W.baseIntensity * W.level) : 0),
          V.color.copy(W?.color || o[0]?.color || new i.Color(16777215)),
          V.position.copy(W ? y(W.f.position) : new i.Vector3()),
          V.target.position.copy(W ? y(W.f.target) : new i.Vector3()),
          (V.angle = W?.half || Math.PI / 6),
          (V.distance = W?.f.range || 3),
          (V.shadow.camera.far = W?.f.range || 3),
          (V.userData.sourceId = W?.f.id || null),
          (V.userData.roomId = W?.f.roomId || null),
          (V.userData.spaceIds = W?.f.spaceIds || (W ? [W.f.roomId] : [])),
          (V.castShadow = F < Math.max(0, g - Math.max(0, renderEffectTier - 1)) && !!W));
      }
    } else {
      let C = o
        .filter((O) => O.logicalVisible && (O.f.shadowPriority || 0) > 0)
        .sort((O, U) => (U.f.shadowPriority || 0) - (O.f.shadowPriority || 0));
      for (let O of C.slice(0, g)) O.light.castShadow = !0;
    }
  }
  function A(R) {
    return (r.scenes.some((C) => C.id === R) && (u = R), _(), L());
  }
  function E(R) {
    ((d = R == null ? null : new Set(R)), _());
  }
  function L() {
    let R = o.filter((U) => U.logicalVisible).length,
      C = x
        ? [...h, ...areaPool].filter((U) => U.visible && U.intensity > 0).length
        : o.filter((U) => U.light.visible && U.light.intensity > 0).length,
      O = x
        ? [...h, ...areaPool]
            .map((U) => ({
              sourceId: U.userData.sourceId,
              color: U.color.toArray(),
              target: U.target?.position.toArray() ?? null,
              kind: U.isRectAreaLight ? "area" : "spot",
              intensity: U.intensity,
            }))
            .filter((U) => U.sourceId)
        : o.map((U) => ({
            sourceId: U.f.id,
            color: U.color.toArray(),
            target: U.f.target,
            intensity: U.light.intensity,
          }));
    return {
      scene: u,
      fixtureCount: o.length,
      logicalFixtureCount: o.length,
      slotCount: h.length + areaPool.length,
      areaSlotCount: areaPool.length,
      visibleFixtureCount: R,
      activeLightCount: C,
      shadowCount: h.filter((U) => U.castShadow).length,
      shadowBudget: g,
      daylight: !!r.scenes.find((U) => U.id === u)?.daylight,
      allocated: O,
      fixtures: o.map((U) => ({
        id: U.f.id,
        roomId: U.f.roomId,
        position: U.f.position,
        target: U.f.target,
        kelvin:
          r.scenes.find((scene) => scene.id === u)?.fixtureKelvin?.[U.f.id] ??
          U.f.kelvin,
        intensity: x ? U.baseIntensity * U.level : U.light.intensity,
        visible: U.logicalVisible,
        shadow: x
          ? O.some(
              (B) =>
                B.sourceId === U.f.id &&
                h.some(
                  (light) =>
                    light.userData.sourceId === U.f.id && light.castShadow,
                ),
            )
          : U.light.castShadow,
      })),
    };
  }
  function N() {
    for (const light of areaPool) { e.remove(light); light.dispose(); }
    for (let R of h)
      (e.remove(R),
        e.remove(R.target),
        R.dispose(),
        R.shadow?.map && R.shadow.map.dispose());
    e.remove(a);
    for (let R of l) R.dispose();
    for (let R of c) R.dispose();
  }
  return (
    _(),
    {
      apply: A,
      setVisibleRooms: E,
      setObserver(position) {
        observer = position;
        _();
      },
      setInterior(R) {
        ((p = !!R), _());
      },
      getState: L,
      dispose: N,
    }
  );
}
var NM = {
  guest: "秘密影音室",
  bath: "\u536B\u6D74",
  master: "\u4E3B\u5367",
  kitchen: "\u5C01\u95ED\u53A8\u623F",
  bar: "\u9910\u53A8\u6C34\u5427",
  hall: "\u7384\u5173\u4E0E\u8FC7\u9053",
  living: "\u5BA2\u5385",
  balcony: "\u751F\u6D3B\u9633\u53F0",
};
function $g({
  model: i,
  onLighting: e = () => {},
  onVisibility: t = () => {},
  onFit: n = () => {},
  getActive: s = () => "all",
}) {
  let r = document.getElementById("control-panel"),
    a = document.getElementById("panel-toggle"),
    o = document.getElementById("panel-close"),
    l = !1,
    c = new Map();
  function h({ restoreFocus: y = !1 } = {}) {
    ((l = !1),
      (r.hidden = !0),
      (a.hidden = !1),
      a.setAttribute("aria-expanded", "false"),
      y
        ? a.focus()
        : document.getElementById("scene").focus({ preventScroll: !0 }));
  }
  function u() {
    ((l = !0),
      (r.hidden = !1),
      (a.hidden = !0),
      a.setAttribute("aria-expanded", "true"),
      o.focus());
  }
  (a.addEventListener("click", u),
    o.addEventListener("click", () => h({ restoreFocus: !0 })),
    document.addEventListener("keydown", (y) => {
      y.key === "Escape" && l && (y.preventDefault(), h({ restoreFocus: !0 }));
    }));
  let d = [...r.querySelectorAll("[role=tab]")];
  function f(y) {
    for (let b of d) {
      let v = b === y;
      (b.setAttribute("aria-selected", String(v)),
        (b.tabIndex = v ? 0 : -1),
        (document.getElementById(b.getAttribute("aria-controls")).hidden = !v));
    }
  }
  for (let y of d)
    (y.addEventListener("click", () => f(y)),
      y.addEventListener("keydown", (b) => {
        let v;
        if (
          (b.key === "ArrowRight" && (v = 1),
          b.key === "ArrowLeft" && (v = -1),
          v)
        ) {
          b.preventDefault();
          let M = d[(d.indexOf(y) + v + d.length) % d.length];
          (f(M), M.focus());
        }
      }));
  (r.addEventListener("click", (y) => {
    y.target.closest("[data-view],[data-detail],[data-point]") && h();
  }),
    document
      .getElementById("show-all")
      .addEventListener("click", () => t({ mode: "all" })),
    document
      .getElementById("show-current")
      .addEventListener("click", () => t({ mode: "current", id: s() })));
  for (let y of i.rooms || []) {
    let b = document.createElement("label"),
      v = document.createElement("input");
    ((v.type = "checkbox"),
      (v.checked = !0),
      (v.dataset.room = y.id),
      v.addEventListener("change", () =>
        t({ mode: "toggle", id: y.id, visible: v.checked }),
      ),
      b.append(v, document.createTextNode(NM[y.id] || y.label || y.id)),
      document.getElementById("room-visibility").append(b),
      c.set(y.id, v));
  }
  let p = document.getElementById("lighting-presets"),
    x = Array.isArray(i.lighting?.scenes)
      ? i.lighting.scenes
      : Object.entries(i.lighting?.scenes || {}).map(([y, b]) => ({
          id: y,
          ...b,
        }));
  for (let y of x.filter((s) =>
    ["day-public", "aperitif", "cinema"].includes(s.id),
  )) {
    let b = document.createElement("button");
    ((b.type = "button"),
      (b.textContent = {
        "day-public": "日间",
        aperitif: "夜间",
        cinema: "观影",
      }[y.id]),
      (b.dataset.lightPreset = y.id),
      b.setAttribute("aria-pressed", "false"),
      b.addEventListener("click", () => e(y.id)),
      p.append(b));
  }
  document.getElementById("fullscreen").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
      else if (document.documentElement.requestFullscreen) {
        let y;
        try {
          if (
            (await Promise.race([
              document.documentElement.requestFullscreen(),
              new Promise((b, v) => {
                y = setTimeout(
                  () => v(new Error("Fullscreen unavailable")),
                  1200,
                );
              }),
            ]),
            !document.fullscreenElement)
          )
            throw new Error("Fullscreen unavailable");
        } finally {
          clearTimeout(y);
        }
      } else {
        let y = document.getElementById("notice");
        ((y.textContent =
          "\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u5168\u5C4F\uFF0C\u5DF2\u4F7F\u7528\u53EF\u7528\u7A97\u53E3\u5C55\u793A"),
          y.classList.add("show"),
          setTimeout(() => y.classList.remove("show"), 2800));
      }
    } catch {
      let y = document.getElementById("notice");
      ((y.textContent =
        "\u6682\u672A\u8FDB\u5165\u5168\u5C4F\uFF0C\u53EF\u7EE7\u7EED\u5728\u5F53\u524D\u7A97\u53E3\u67E5\u770B"),
        y.classList.add("show"),
        setTimeout(() => y.classList.remove("show"), 2800));
    }
  });
  let g = 0;
  function m() {
    g ||
      (g = requestAnimationFrame(() => {
        ((g = 0),
          document.documentElement.style.setProperty(
            "--viewport-height",
            `${window.visualViewport?.height || window.innerHeight}px`,
          ),
          n());
      }));
  }
  return (
    window.visualViewport?.addEventListener("resize", m),
    window.addEventListener("orientationchange", m),
    window.addEventListener("resize", m),
    document.addEventListener("fullscreenchange", () => {
      ((document.getElementById("fullscreen").textContent =
        document.fullscreenElement
          ? "\u9000\u51FA\u5168\u5C4F"
          : "\u5168\u5C4F"),
        m());
    }),
    m(),
    {
      closePanel: h,
      updateLighting(y) {
        for (let b of p.querySelectorAll("button"))
          b.setAttribute("aria-pressed", String(b.dataset.lightPreset === y));
      },
      updateVisibility(y) {
        let b = new Set(y || []);
        for (let [v, M] of c) M.checked = b.has(v);
      },
    }
  );
}
function tx({
  renderer: i,
  render: e,
  step: t,
  isSuspended: n,
  mobile: s,
  onQualityChange: r = () => {},
}) {
  let a = 0,
    o = !0,
    l = !0,
    c = !1,
    h = !1,
    u = !1,
    d = 0,
    f = 0,
    p = 16.7,
    x = 0,
    g = 0,
    m = quality.maxDpr,
    y = m,
    b = quality.interactionDpr,
    v = {
      frames: 0,
      renders: 0,
      shadowUpdates: 0,
      renderMs: [],
      frameMs: [],
      qualityChanges: 0,
      lastRenderAt: 0,
    };
  function M(U) {
    Math.abs(y - U) < 0.001 ||
      ((y = U), i.setPixelRatio(y), r(), v.qualityChanges++, (o = !0));
  }
  function w() {
    !a && !u && !n() && (a = requestAnimationFrame(N));
  }
  function I({ shadow: U = !1 } = {}) {
    ((o = !0), (l ||= U), w());
  }
  function _() {
    (clearTimeout(d), (d = 0), (c = !0), (f = 0), w());
  }
  function A() {
    ((c = !1), E(), w());
  }
  function E() {
    (clearTimeout(d),
      (d = setTimeout(() => {
        ((d = 0), !n() && !c && !h && (M(m), w()));
      }, 250)));
  }
  function L(U) {
    l &&
      ((i.shadowMap.needsUpdate = !0),
      Ct.traverse((light) => {
        if (light.isLight && light.shadow) light.shadow.needsUpdate = true;
      }),
      v.shadowUpdates++,
      (l = !1));
    let B = performance.now();
    (e(),
      v.renderMs.push(performance.now() - B),
      v.renderMs.length > 600 && v.renderMs.shift(),
      v.renders++,
      (v.lastRenderAt = U),
      (o = !1));
  }
  function N(U) {
    if (((a = 0), n())) return;
    ((u = !0), v.frames++);
    let B = h,
      J = t(U) || {};
    if (
      ((h = !!J.active),
      (o ||= !!J.dirty),
      (l ||= !!J.shadow),
      h && !B && (clearTimeout(d), (d = 0), (f = 0)),
      B && !h && !c && E(),
      (c || h) && f)
    ) {
      let F = U - f;
      if (
        Number.isFinite(F) && F > 0 &&
        (v.frameMs.push(F),
        v.frameMs.length > 600 && v.frameMs.shift(),
        (p = 0.9 * p + 0.1 * F),
        x++,
        x >= 20 && U - g > 1e3)
      ) {
        // Sustained load sheds effects, never the main frame's resolution.
        // The cadence includes GPU/vsync work; renderMs below is CPU submission only.
        if (p > (s ? 42 : 28) && U - g > 10000 && renderEffectTier < 2) {
          renderEffectTier++;
          g = U;
          r({ effectTier: renderEffectTier });
        }
        x = 0;
      }
    }
    ((f = U), o && L(U), (u = !1), (c || h || o) && w());
  }
  function R() {
    (a && cancelAnimationFrame(a),
      (a = 0),
      clearTimeout(d),
      (d = 0),
      (c = !1),
      (f = 0));
  }
  function C() {
    (I(), h || E());
  }
  function O(U) {
    let B = y;
    (M(m), L(performance.now()));
    let J = U();
    return (M(B), I(), J);
  }
  return {
    request: I,
    begin: _,
    end: A,
    pause: R,
    resume: C,
    capture: O,
    getState: () => ({
      ...v,
      resolutionPolicy: quality.resolutionPolicy,
      pixelRatio: y,
      drawingBuffer: i.getDrawingBufferSize(new yi.Vector2()).toArray(),
      effectTier: renderEffectTier,
      frameP95Ms: [...v.frameMs].sort((a,b)=>a-b)[Math.floor(v.frameMs.length * 0.95)] ?? null,
      cpuSubmissionOnly: true,
      interactionRatio: b,
      highPixelRatio: m,
      pending: !!a,
      dirty: o,
      interacting: c,
      animating: h,
      suspended: n(),
      shadowAutoUpdate: i.shadowMap.autoUpdate,
    }),
  };
}
var BM = new Set([
    "fridge",
    "sofa_bed",
    "office_chair",
    "dining_chair",
    "folding_table",
    "folding_chair",
    "dishwasher",
    "modular_sofa",
    "mobile_tv",
    "ps5",
    "washer",
    "dryer",
    "architecture",
    "fixture",
    "door",
    "window",
    "windows",
    "people",
    "person",
  ]),
  ix = 1e-6;
function rx(i) {
  return !!(
    i.isGroup ||
    i.mixer ||
    i.animations?.length ||
    i.userData?.animated ||
    i.userData?.animation ||
    i.userData?.mixer ||
    i.userData?.animationClip ||
    (i.geometry?.morphAttributes &&
      Object.keys(i.geometry.morphAttributes).length) ||
    i.morphTargetInfluences ||
    i.isSkinnedMesh ||
    i.skeleton
  );
}
function kM(i) {
  if (Object.values(i.attributes).some((t) => t.isInterleavedBufferAttribute))
    return null;
  let e = Object.entries(i.attributes).sort(([t], [n]) => t.localeCompare(n));
  return JSON.stringify([
    i.index?.array.constructor.name ?? null,
    e.map(([t, n]) => [
      t,
      n.itemSize,
      n.normalized,
      n.array.constructor.name,
      n.gpuType ?? null,
      n.isInterleavedBufferAttribute ? n.data.stride : null,
    ]),
  ]);
}
function VM(i) {
  let e = (i.clippingPlanes ?? [])
    .map((t) => `${t.normal.x},${t.normal.y},${t.normal.z},${t.constant}`)
    .join(";");
  return [
    i.uuid,
    i.clipping ? 1 : 0,
    i.clipIntersection ? 1 : 0,
    i.clipShadows ? 1 : 0,
    e,
  ].join("|");
}
function sx(i, e) {
  return (e.updateWorldMatrix(!0, !0), new i.Box3().setFromObject(e, !0));
}
function GM(i, e) {
  return i.isEmpty() !== e.isEmpty()
    ? !1
    : i.isEmpty()
      ? !0
      : ["x", "y", "z"].every(
          (t) =>
            Math.abs(i.min[t] - e.min[t]) <= ix &&
            Math.abs(i.max[t] - e.max[t]) <= ix,
        );
}
function HM(i) {
  let e = !1;
  return (
    i.traverse((t) => {
      t !== i && (t.isGroup || rx(t)) && (e = !0);
    }),
    e
  );
}
function ax({ THREE: i, scene: e, model: t }) {
  let n = {
    objectsVisited: 0,
    objectsSkipped: 0,
    meshesMerged: 0,
    meshesCreated: 0,
    drawCallsReduced: 0,
    groupsOptimized: 0,
    groupsRolledBack: 0,
  };
  for (let s of t?.objects ?? []) {
    n.objectsVisited += 1;
    let r = e.getObjectByName(s.id);
    if (!r || BM.has(String(s.type ?? "").toLowerCase()) || HM(r)) {
      n.objectsSkipped += 1;
      continue;
    }
    let a = new Map();
    for (let u of r.children) {
      let d = u.geometry,
        f = d?.index?.count ?? d?.attributes?.position?.count;
      if (
        !u.isMesh ||
        !u.visible ||
        u.isSkinnedMesh ||
        u.morphTargetInfluences ||
        rx(u) ||
        Array.isArray(u.material) ||
        !u.material ||
        u.material.transparent ||
        u.geometry?.drawRange?.start !== 0 ||
        (d?.drawRange?.count !== 1 / 0 && d?.drawRange?.count !== f) ||
        !d?.attributes?.position ||
        (d.morphAttributes && Object.keys(d.morphAttributes).length)
      )
        continue;
      let p = kM(d);
      if (!p) continue;
      let x = JSON.stringify([
        VM(u.material),
        u.castShadow,
        u.receiveShadow,
        u.visible,
        u.layers.mask,
        u.renderOrder,
        p,
      ]);
      (a.has(x) || a.set(x, []), a.get(x).push(u));
    }
    let o = [...a.values()].filter((u) => u.length >= 2);
    if (!o.length) continue;
    let l = sx(i, r).clone(),
      c = [],
      h = [];
    try {
      for (let d of o) {
        let f = d.map((m) => {
            m.matrixAutoUpdate && m.updateMatrix();
            let y = m.geometry.clone();
            return (transformGeometry(y, m.matrix), y);
          }),
          p = gu(f, !1);
        for (let m of f) m.dispose();
        if (!p) continue;
        let x = d[0],
          g = new i.Mesh(p, x.material);
        ((g.name = `${r.name || s.id}__merged_${c.length + 1}`),
          (g.castShadow = x.castShadow),
          (g.receiveShadow = x.receiveShadow),
          (g.visible = x.visible),
          (g.layers.mask = x.layers.mask),
          (g.renderOrder = x.renderOrder),
          (g.frustumCulled = d.every((m) => m.frustumCulled)),
          (g.userData.mergedSourceNames = d.map((m) => m.name)),
          c.push({ replacement: g, bucket: d }));
      }
      if (!c.length) continue;
      for (let { bucket: d } of c)
        for (let f of d)
          (h.push({ mesh: f, index: r.children.indexOf(f) }), r.remove(f));
      for (let { replacement: d } of c) r.add(d);
      let u = sx(i, r);
      if (!GM(l, u)) {
        for (let { replacement: d } of c) (r.remove(d), d.geometry.dispose());
        for (let { mesh: d, index: f } of h.sort((p, x) => p.index - x.index))
          (r.children.splice(Math.min(f, r.children.length), 0, d),
            (d.parent = r));
        (r.updateMatrixWorld(!0), (n.groupsRolledBack += 1));
        continue;
      }
      ((n.groupsOptimized += 1),
        (n.meshesMerged += h.length),
        (n.meshesCreated += c.length),
        (n.drawCallsReduced += h.length - c.length));
    } catch {
      for (let { replacement: d } of c)
        (d.parent === r && r.remove(d), d.geometry.dispose());
      for (let { mesh: d, index: f } of h.sort((p, x) => p.index - x.index))
        d.parent ||
          (r.children.splice(Math.min(f, r.children.length), 0, d),
          (d.parent = r));
      (r.updateMatrixWorld(!0), (n.groupsRolledBack += 1));
    }
  }
  return n;
}
function ox({
  THREE: i,
  camera: e,
  canvas: t,
  onChange: n = () => {},
  onStart: s = () => {},
  onEnd: r = () => {},
}) {
  let a = i.MathUtils.degToRad(-65),
    o = i.MathUtils.degToRad(65),
    l = 45,
    c = 90,
    h = 0,
    u = 0,
    d = 72,
    f = t.clientWidth || 1,
    p = t.clientHeight || 1,
    x = 0,
    g = 0,
    m = 0,
    y = !1,
    b = !1,
    v = null,
    M = new Map(),
    w = null,
    I = null,
    _ = new i.Vector3();
  function A() {
    return i.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(i.MathUtils.degToRad(d / 2)) / (f / p)),
    );
  }
  function E() {
    ((e.aspect = f / p), (e.fov = A()), e.updateProjectionMatrix());
  }
  function L() {
    u = i.MathUtils.clamp(u, a, o);
    let Q = Math.cos(u);
    (_.set(Math.sin(h) * Q, Math.sin(u), -Math.cos(h) * Q).normalize(),
      e.lookAt(e.position.clone().add(_)),
      e.updateMatrixWorld());
  }
  function N() {
    (L(), n());
  }
  function R() {
    y || ((y = !0), s());
  }
  function C() {
    y && ((y = !1), r());
  }
  function O() {
    !M.size && v === null && C();
  }
  function U(Q) {
    return { x: Q.clientX, y: Q.clientY };
  }
  function B(Q) {
    b ||
      Q.button !== 0 ||
      (t.setPointerCapture?.(Q.pointerId),
      M.set(Q.pointerId, U(Q)),
      (x = g = 0),
      (m = 0),
      R(),
      J(),
      Q.preventDefault());
  }
  function J() {
    let Q = [...M.values()];
    ((w = null),
      (I = null),
      Q.length >= 2
        ? (I = {
            distance: Math.max(1, Math.hypot(Q[0].x - Q[1].x, Q[0].y - Q[1].y)),
            fov: d,
          })
        : Q.length === 1 && (w = { ...Q[0] }));
  }
  function F(Q) {
    if (!M.has(Q.pointerId)) return;
    let Ie = M.get(Q.pointerId);
    if ((M.set(Q.pointerId, U(Q)), M.size >= 2)) {
      let Ue = [...M.values()],
        ke = Math.max(1, Math.hypot(Ue[0].x - Ue[1].x, Ue[0].y - Ue[1].y));
      I || J();
      let Z = i.MathUtils.clamp((I.fov * I.distance) / ke, l, c);
      Math.abs(Z - d) > 0.01 && ((d = Z), E(), n());
    } else if (w) {
      let Ue = Q.clientX - Ie.x,
        ke = Q.clientY - Ie.y,
        Z = ((2 * Math.PI) / Math.max(1, f)) * 0.65,
        te = ((2 * Math.PI) / Math.max(1, p)) * 0.4,
        oe = performance.now(),
        Ce = m ? Math.max(1, oe - m) : 16;
      ((h -= Ue * Z),
        (u += ke * te),
        (x = i.MathUtils.clamp((-Ue * Z) / Ce, -0.003, 0.003)),
        (g = i.MathUtils.clamp((ke * te) / Ce, -0.003, 0.003)),
        (m = oe),
        N());
    }
    Q.preventDefault();
  }
  function V(Q) {
    if (M.has(Q.pointerId)) {
      M.delete(Q.pointerId);
      try {
        t.hasPointerCapture?.(Q.pointerId) &&
          t.releasePointerCapture(Q.pointerId);
      } catch {}
      (M.size ? J() : ((w = I = null), (m = 0), O()), Q.preventDefault?.());
    }
  }
  function W(Q) {
    if (b) return;
    R();
    let Ie = i.MathUtils.clamp(d * Math.exp(Q.deltaY * 0.001), l, c);
    (Math.abs(Ie - d) > 0.001 && ((d = Ie), E(), (x = g = 0), n()),
      v !== null && clearTimeout(v),
      (v = setTimeout(() => {
        ((v = null), O());
      }, 120)),
      Q.preventDefault());
  }
  function ce(Q) {
    if (b || document.activeElement !== t) return;
    let Ie = i.MathUtils.degToRad(3);
    if (Q.key === "ArrowLeft") h += Ie;
    else if (Q.key === "ArrowRight") h -= Ie;
    else if (Q.key === "ArrowUp") u += Ie;
    else if (Q.key === "ArrowDown") u -= Ie;
    else return;
    ((x = g = 0), N(), Q.preventDefault());
  }
  return (
    t.addEventListener("pointerdown", B),
    t.addEventListener("pointermove", F),
    t.addEventListener("pointerup", V),
    t.addEventListener("pointercancel", V),
    t.addEventListener("lostpointercapture", V),
    t.addEventListener("wheel", W, { passive: !1 }),
    t.addEventListener("keydown", ce),
    E(),
    L(),
    {
      setPose(Q, Ie, Ue = 72) {
        e.position.copy(Q);
        let ke = new i.Vector3().subVectors(Ie, Q).normalize();
        ((h = Math.atan2(ke.x, -ke.z)),
          (u = Math.asin(i.MathUtils.clamp(ke.y, -1, 1))),
          (d = i.MathUtils.clamp(Ue, l, c)),
          E(),
          (x = g = 0),
          (m = 0),
          N());
      },
      resize(Q, Ie) {
        ((f = Math.max(1, Q)), (p = Math.max(1, Ie)), E(), n());
      },
      update() {
        if (b || M.size || (!x && !g)) return !1;
        let Q = 16.67,
          Ie = Math.exp(-Q / 180);
        return (
          (h += x * Q),
          (u = i.MathUtils.clamp(u + g * Q, a, o)),
          (x *= Ie),
          (g *= Ie),
          Math.abs(x) < 1e-5 && (x = 0),
          Math.abs(g) < 1e-5 && (g = 0),
          N(),
          !!(x || g)
        );
      },
      dispose() {
        if (!b) {
          ((b = !0),
            t.removeEventListener("pointerdown", B),
            t.removeEventListener("pointermove", F),
            t.removeEventListener("pointerup", V),
            t.removeEventListener("pointercancel", V),
            t.removeEventListener("lostpointercapture", V),
            t.removeEventListener("wheel", W),
            t.removeEventListener("keydown", ce),
            v !== null && (clearTimeout(v), (v = null)));
          for (let Q of M.keys())
            try {
              t.hasPointerCapture?.(Q) && t.releasePointerCapture(Q);
            } catch {}
          (M.clear(), (w = I = null), (x = g = 0), C());
        }
      },
      getTarget() {
        return (e.getWorldDirection(_), e.position.clone().add(_));
      },
    }
  );
}
function lx({
  THREE: i,
  g: e,
  o: t,
  materials: n,
  mesh: s,
  cyl: r,
  movingParts: a,
}) {
  let o = n[t.material] || n.oak,
    l = (h, u, d, f, p, x, g = "oak", m = 0) => s(e, h, u, d, f, p, x, g, m),
    c = (h, u, d, f, p, x = "steel", g = h) => r(e, h, u, d, f, p, x, g);
  if (t.type === "waterbar_cabinet") {
    let f = t.h - 0.02;
    (l(
      0.018,
      t.h - 0.05,
      t.d,
      -t.w / 2 + 0.018 / 2,
      (t.h - 0.05) / 2,
      0,
      "oak",
      0,
    ),
      l(
        0.018,
        t.h - 0.05,
        t.d,
        t.w / 2 - 0.018 / 2,
        (t.h - 0.05) / 2,
        0,
        "oak",
        0,
      ),
      l(t.w - 2 * 0.018, 0.06, t.d, 0, 0.06 / 2, 0, "oak", 0),
      l(t.w - 2 * 0.018, 0.42, 0.018, 0, 0.42, t.d / 2 - 0.018 / 2, "oak", 0),
      l(t.w, 0.03, t.d, 0, t.h - 0.015, 0, "barStone", 0));
    let p = -t.d / 2;
    (l(t.w - 0.045, 0.155, 0.024, 0, t.h - 0.125, p + 0.012, "oak", 0),
      l(0.12, 0.012, 0.014, 0, t.h - 0.13, p + 0.007, "bronze", 0));
    for (let x of [-1, 1]) {
      let g = new i.Group();
      (g.position.set(x * (t.w / 2 - 0.022), 0.035, -t.d / 2 + 0.012),
        e.add(g));
      let m = (t.w - 0.05) / 2,
        y = -x;
      (s(
        g,
        m,
        t.h - 0.31,
        0.024,
        (y * m) / 2,
        (t.h - 0.31) / 2,
        0,
        "cabinetPaint",
        0.002,
      ),
        s(g, 0.012, 0.12, 0.006, y * m * 0.85, 0.49, -0.006, "bronze", 0.001),
        a?.storage.push({ pivot: g, sign: x }));
    }
    return !0;
  }
  if (t.type === "wet_bar") {
    let d = -t.d / 2;
    (l(
      0.018,
      t.h - 0.04,
      t.d,
      -t.w / 2 + 0.018 / 2,
      (t.h - 0.04) / 2,
      0,
      "oak",
      0,
    ),
      l(
        0.018,
        t.h - 0.04,
        t.d,
        t.w / 2 - 0.018 / 2,
        (t.h - 0.04) / 2,
        0,
        "oak",
        0,
      ),
      l(t.w - 2 * 0.018, 0.06, t.d, 0, 0.03, 0, "oak", 0),
      l(t.w - 2 * 0.018, 0.42, 0.018, 0, 0.42, t.d / 2 - 0.018 / 2, "oak", 0));
    let f = 0.35,
      p = 0.4,
      x = t.h,
      g = p,
      m = t.d - g;
    (l(
      (t.w - f) / 2,
      0.03,
      t.d,
      -(f + (t.w - f) / 2) / 2,
      t.h - 0.015,
      0,
      "barStone",
      0,
    ),
      l(
        (t.w - f) / 2,
        0.03,
        t.d,
        (f + (t.w - f) / 2) / 2,
        t.h - 0.015,
        0,
        "barStone",
        0,
      ),
      l(f, 0.03, m / 2, 0, t.h - 0.015, -(g + m / 2) / 2, "barStone", 0),
      l(f, 0.03, m / 2, 0, t.h - 0.015, (g + m / 2) / 2, "barStone", 0));
    let y = x - 0.105,
      b = 0.12,
      v = 0.008;
    (l(f - 0.02, v, p - 0.02, 0, y - b / 2, 0, "steel", 0),
      l(v, b, p - 0.02, -f / 2 + 0.01, y, 0, "steel", 0),
      l(v, b, p - 0.02, f / 2 - 0.01, y, 0, "steel", 0),
      l(f - 0.02, b, v, 0, y, -p / 2 + 0.01, "steel", 0),
      l(f - 0.02, b, v, 0, y, p / 2 - 0.01, "steel", 0),
      c(0.012, 0.2, f / 2 + 0.09, x + 0.1, -0.015, "steel"),
      c(0.016, 0.055, f / 2 + 0.09, x + 0.205, -0.04, "steel", 0.012),
      l(0.13, 0.018, 0.018, f / 2 + 0.09, x + 0.18, -0.105, "steel", 0),
      l(t.w - 0.045, 0.14, 0.024, 0, t.h - 0.12, d + 0.012, "cabinetPaint", 0));
    for (let M of [-1, 1]) {
      let w = new i.Group();
      (w.position.set(M * (t.w / 2 - 0.022), 0.035, d + 0.012), e.add(w));
      let I = (t.w - 0.05) / 2,
        _ = -M;
      (s(
        w,
        I,
        t.h - 0.3,
        0.024,
        (_ * I) / 2,
        (t.h - 0.3) / 2,
        0,
        "cabinetPaint",
        0.002,
      ),
        s(w, 0.012, 0.12, 0.006, _ * I * 0.85, 0.49, -0.006, "bronze", 0.001),
        a?.storage.push({ pivot: w, sign: M }));
    }
    return !0;
  }
  if (t.type === "waterbar_shelf") {
    let h = [0, 0.28, 0.56];
    for (let u of h) l(t.w, 0.022, t.d, 0, u, 0, "oak", 0);
    for (let u of [-t.w / 2 + 0.013, t.w / 2 - 0.013])
      l(0.026, t.h, t.d, u, t.h / 2, 0, "oak", 0);
    for (let u = 0; u < 3; u++) {
      let d = u === 1 ? 2 : 3,
        f = 0.2;
      for (let p = 0; p < d; p++) {
        let x = (p - (d - 1) / 2) * f,
          g = h[u] + 0.022 + 0.075;
        (c(0.034, 0.12, x, g, 0, u === 1 ? "cream" : "glass", 0.045),
          c(0.043, 0.012, x, g - 0.054, 0, "cream"));
      }
    }
    return !0;
  }
  return !1;
}
function cx({
  THREE: i,
  g: e,
  o: t,
  materials: n,
  mesh: s,
  cyl: r,
  movingParts: a,
  model: o,
}) {
  let l = (c, h, u, d, f, p, x = "oak", g = 0.008) =>
    s(e, c, h, u, d, f, p, x, g);
  if (t.type === "study_bottle")
    return (
      r(e, t.w / 2, t.h * 0.7, 0, t.h * 0.35, 0, t.material || "sage"),
      r(
        e,
        t.w * 0.32,
        t.h * 0.12,
        0,
        t.h * 0.76,
        0,
        t.material || "sage",
        t.w * 0.19,
      ),
      r(e, t.w * 0.19, t.h * 0.18, 0, t.h * 0.91, 0, "darkoak"),
      l(t.w * 0.65, 0.055, 0.002, 0, 0.11, -t.d / 2 - 0.001, "cream", 0),
      !0
    );
  if (t.type === "study_stemware") {
    (r(e, 0.032, 0.008, 0, t.h - 0.004, 0, "glass"),
      r(e, 0.004, 0.09, 0, t.h - 0.053, 0, "glass"));
    let c = [
        new i.Vector2(0.001, 0),
        new i.Vector2(0.025, 0.015),
        new i.Vector2(0.043, 0.07),
        new i.Vector2(0.041, 0.12),
        new i.Vector2(0.037, 0.12),
        new i.Vector2(0.039, 0.07),
        new i.Vector2(0.021, 0.02),
      ],
      h = new i.Mesh(new i.LatheGeometry(c, 20), n.glass);
    return ((h.position.y = 0.01), e.add(h), !0);
  }
  if (t.type === "study_cup") {
    let c = [
        new i.Vector2(0.001, 0),
        new i.Vector2(0.04, 0),
        new i.Vector2(0.045, 0.115),
        new i.Vector2(0.04, 0.115),
        new i.Vector2(0.035, 0.008),
        new i.Vector2(0.001, 0.008),
      ],
      h = new i.Mesh(new i.LatheGeometry(c, 20), n.cream);
    return (e.add(h), !0);
  }
  if (t.type === "washer" || t.type === "dryer") {
    (l(0.018, t.h, t.d, -t.w / 2 + 0.018 / 2, t.h / 2, 0, "cream"),
      l(0.018, t.h, t.d, t.w / 2 - 0.018 / 2, t.h / 2, 0, "cream"),
      l(t.w, 0.018, t.d, 0, 0.018 / 2, 0, "cream"),
      l(t.w, 0.018, t.d, 0, t.h - 0.018 / 2, 0, "cream"),
      l(t.w, t.h, 0.018, 0, t.h / 2, t.d / 2 - 0.018 / 2, "cream"));
    let h = new i.Shape();
    (h.moveTo(-t.w / 2, 0),
      h.lineTo(t.w / 2, 0),
      h.lineTo(t.w / 2, t.h),
      h.lineTo(-t.w / 2, t.h),
      h.closePath());
    let u = new i.Path();
    (u.absarc(0, 0.39, 0.205, 0, Math.PI * 2, !0), h.holes.push(u));
    let d = new i.Mesh(
      new i.ExtrudeGeometry(h, {
        depth: 0.018,
        bevelEnabled: !1,
        curveSegments: 24,
      }),
      n.cream,
    );
    ((d.position.z = -t.d / 2),
      e.add(d),
      l(t.w, 0.11, 0.025, 0, t.h - 0.055, -t.d / 2 + 0.0125, "cream"),
      l(0.15, 0.045, 0.008, 0.1, t.h - 0.055, -t.d / 2 - 0.004, "screen"));
    let f = new i.Mesh(new i.TorusGeometry(0.205, 0.025, 8, 32), n.steel);
    (f.position.set(0, 0.39, -t.d / 2 - 0.005), e.add(f));
    let p = new i.Mesh(
      new i.CylinderGeometry(0.175, 0.175, 0.46, 32, 1, !0),
      n.steel,
    );
    ((p.rotation.x = Math.PI / 2), p.position.set(0, 0.39, -0.04), e.add(p));
    let x = new i.Mesh(new i.CircleGeometry(0.18, 32), n.glass);
    return (
      x.position.set(0, 0.39, -t.d / 2 - 0.01),
      (x.rotation.y = Math.PI),
      e.add(x),
      !0
    );
  }
  if (t.type === "sink" || t.type === "study_basin") {
    let c = t.type === "study_basin" ? t.w : 0.4,
      h = t.type === "study_basin" ? t.d : 0.5,
      u = 0.008,
      d = -0.1,
      f = 0.14;
    return (
      l(c, u, h, 0, d - f / 2, 0, "steel", 0),
      l(u, f, h, -c / 2, d, 0, "steel", 0),
      l(u, f, h, c / 2, d, 0, "steel", 0),
      l(c, f, u, 0, d, -h / 2, "steel", 0),
      l(c, f, u, 0, d, h / 2, "steel", 0),
      r(e, 0.011, 0.22, t.w / 2 - 0.04, 0.11, t.d / 2 - 0.04, "steel"),
      l(0.02, 0.02, 0.16, t.w / 2 - 0.04, 0.22, t.d / 2 - 0.12, "steel"),
      !0
    );
  }
  if (t.type === "coffee") {
    (l(t.w, 0.04, t.d, 0, 0.02, 0, "steel"),
      l(
        t.w - 0.014,
        t.h - 0.065,
        t.d - 0.05,
        0,
        (t.h - 0.065) / 2 + 0.05,
        0.014,
        "cream",
        0.016,
      ),
      l(t.w - 0.025, 0.055, 0.045, 0, t.h - 0.055, -t.d / 2 + 0.0225, "steel"),
      l(
        0.08,
        0.033,
        0.005,
        0.065,
        t.h - 0.045,
        -t.d / 2 + 0.001,
        "screen",
        0.003,
      ));
    for (let c of [-0.055, 0.045])
      r(e, 0.01, 0.055, c, 0.21, -t.d / 2 + 0.028, "steel");
    for (let c = 0; c < 9; c++)
      l(
        t.w - 0.07,
        0.003,
        0.006,
        0,
        0.063,
        -t.d / 2 + 0.045 + c * 0.01,
        "steel",
        0,
      );
    return (
      r(e, 0.009, 0.13, t.w / 2 - 0.026, 0.17, -t.d / 2 + 0.04, "steel"),
      l(
        0.013,
        0.013,
        0.05,
        t.w / 2 - 0.026,
        0.105,
        -t.d / 2 + 0.025,
        "steel",
        0.003,
      ),
      r(e, 0.031, 0.056, -0.03, 0.09, -t.d / 2 + 0.095, "cream", 0.036),
      !0
    );
  }
  if (t.type === "kegerator") {
    (l(0.018, t.h, t.d, -t.w / 2 + 0.018 / 2, t.h / 2, 0, "charcoal"),
      l(0.018, t.h, t.d, t.w / 2 - 0.018 / 2, t.h / 2, 0, "charcoal"),
      l(t.w, 0.025, t.d, 0, 0.0125, 0, "charcoal"),
      l(t.w, 0.025, t.d, 0, t.h - 0.0125, 0, "charcoal"),
      l(t.w, t.h, 0.018, 0, t.h / 2, t.d / 2 - 0.018 / 2, "charcoal"));
    let h = new i.Group();
    (h.position.set(t.w / 2 - 0.01, 0, -t.d / 2 + 0.012),
      e.add(h),
      s(
        h,
        t.w - 0.02,
        t.h - 0.025,
        0.024,
        -(t.w - 0.02) / 2,
        t.h / 2,
        0,
        "steel",
        0.006,
      ),
      s(
        h,
        0.12,
        0.022,
        0.009,
        -t.w * 0.22,
        t.h - 0.105,
        -0.008,
        "black",
        0.003,
      ));
    let u = new i.Group();
    (e.add(u), (u.visible = !1));
    for (let d of ["keg", "co2-cylinder"]) {
      let f = o.objects.find((m) => m.id === d),
        p = f.x - t.x,
        x = f.z - t.z,
        g = new i.Mesh(
          new i.CylinderGeometry(f.w / 2, f.w / 2, f.h, 24),
          n.steel,
        );
      (g.position.set(p, f.y + f.h / 2, x), u.add(g));
      for (let m of [f.y + 0.02, f.y + f.h - 0.02]) {
        let y = new i.Mesh(
          new i.CylinderGeometry(f.w / 2 + 0.003, f.w / 2 + 0.003, 0.014, 24),
          n.charcoal,
        );
        (y.position.set(p, m, x), u.add(y));
      }
    }
    return (a?.keg.push({ pivot: h, inside: u }), !0);
    return !0;
  }
  if (t.type === "wardrobe") {
    l(t.w, t.h, t.d, 0, t.h / 2, 0, "oak", 0.005);
    let c = Math.max(2, Math.round(t.d / 0.55)),
      h = t.d / c;
    for (let u = 0; u < c; u++) {
      let d = -t.d / 2 + (u + 0.5) * h;
      (l(
        0.018,
        t.h - 0.04,
        h - 0.008,
        t.w / 2 - 0.009,
        t.h / 2,
        d,
        "darkoak",
        0.002,
      ),
        l(
          0.004,
          0.22,
          0.012,
          t.w / 2 - 0.002,
          1.02,
          d - h / 2 + 0.05,
          "bronze",
          0.001,
        ));
    }
    return !0;
  }
  if (t.type === "monitor" || t.type === "tv") {
    let c = t.id === "living-tv" ? 1 : -1;
    return (
      l(t.w, t.h, 0.06, 0, t.h / 2, 0, "black", 0.012),
      l(
        t.w - 0.028,
        t.h - 0.028,
        0.004,
        0,
        t.h / 2,
        c * 0.031,
        "screen",
        0.004,
      ),
      t.type === "monitor"
        ? (l(0.045, 0.04, 0.035, 0, -0.02, 0, "steel"),
          l(0.22, 0.008, 0.12, 0, -0.036, 0, "charcoal", 0.004))
        : l(0.24, 0.08, 0.09, 0, t.h * 0.42, -c * 0.075, "charcoal", 0.003),
      !0
    );
  }
  if (t.type === "laptop") {
    l(t.w, 0.014, t.d, 0, 0.007, 0, "steel", 0.006);
    for (let h = 0; h < 3; h++)
      for (let u = 0; u < 10; u++)
        l(
          0.022,
          0.002,
          0.022,
          -0.124 + u * 0.027,
          0.015,
          -0.01 + h * 0.026,
          "charcoal",
          0.001,
        );
    l(0.11, 0.002, 0.055, 0, 0.015, -0.074, "darkoak", 0.003);
    let c = new i.Group();
    return (
      c.position.set(0, 0.015, 0.115),
      (c.rotation.x = -0.16),
      e.add(c),
      s(c, t.w, 0.174, 0.012, 0, 0.087, 0, "black", 0.006),
      s(c, t.w - 0.025, 0.149, 0.003, 0, 0.087, -0.007, "screen", 0.003),
      !0
    );
  }
  return !1;
}
function hx({ THREE: i, scene: e, model: t, mesh: n, tag: s, materials: r }) {
  let a = new i.CylinderGeometry(0.033, 0.04, 2.36, 12);
  for (let o of t.openings.filter((l) => l.type === "window")) {
    let l = t.walls.find((x) => x.id === o.wallId),
      c = Math.atan2(l.b[1] - l.a[1], l.b[0] - l.a[0]),
      h = o.id.split("-")[0],
      u = ["guest", "bar"].includes(h) ? -1 : 1,
      d = new i.Group();
    ((d.name = "window-treatment:" + o.id),
      d.position.set(o.center[0], 0, o.center[1]),
      (d.rotation.y = -c),
      e.add(d),
      s(d, [h], "detail"));
    let f = u * (l.thickness / 2 + 0.07),
      p = ["master", "guest", "balcony"].includes(h);
    if (
      (n(
        d,
        o.width + (p ? 0.48 : 0.025),
        0.035,
        0.025,
        0,
        2.53,
        f,
        "oak",
        0.006,
      ),
      p)
    )
      for (let x of [-1, 1])
        for (let g = 0; g < 5; g++) {
          let m = new i.Mesh(a, r.linen);
          (m.position.set(
            x * (o.width / 2 + 0.03 + (g + 0.5) * 0.043),
            1.26,
            f + 0.014 * Math.sin(g * 2),
          ),
            (m.scale.z = 0.8),
            (m.castShadow = !0),
            (m.receiveShadow = !0),
            d.add(m));
        }
    else
      n(
        d,
        o.width,
        0.13,
        0.022,
        0,
        o.sill + o.height - 0.04,
        f,
        "linen",
        0.003,
      );
    for (let x of [-o.width * 0.42, o.width * 0.42])
      n(d, 0.012, 0.14, 0.012, x, 2.62, f, "bronze", 0.002);
  }
}
var dx = 1e-6,
  WM = new Set(["wall", "trim"]);
function ux(i) {
  let e = Object.entries(i.attributes).sort(([t], [n]) => t.localeCompare(n));
  return e.some(([, t]) => t.isInterleavedBufferAttribute) ||
    Object.keys(i.morphAttributes ?? {}).length
    ? null
    : JSON.stringify([
        i.index?.array.constructor.name ?? null,
        e.map(([t, n]) => [
          t,
          n.itemSize,
          n.normalized,
          n.array.constructor.name,
          n.gpuType ?? null,
        ]),
      ]);
}
function XM(i, e) {
  let t = e.attributes.position;
  return !t || t.count === 0
    ? new i.Box3()
    : new i.Box3().setFromBufferAttribute(t);
}
function qM(i, e) {
  return i.isEmpty() !== e.isEmpty()
    ? !1
    : i.isEmpty()
      ? !0
      : ["x", "y", "z"].every(
          (t) =>
            Math.abs(i.min[t] - e.min[t]) <= dx &&
            Math.abs(i.max[t] - e.max[t]) <= dx,
        );
}
function YM(i) {
  return [...new Set(i.userData?.spaceIds ?? [])].map(String).sort();
}
function ZM(i) {
  let e = i.material,
    t = i.geometry;
  return !i.isMesh ||
    i.parent === null ||
    !i.visible ||
    Array.isArray(e) ||
    !e ||
    e.transparent ||
    !t?.attributes?.position ||
    t.drawRange?.start !== 0 ||
    (t.drawRange?.count !== 1 / 0 &&
      t.drawRange?.count !== (t.index?.count ?? t.attributes.position.count))
    ? !1
    : ux(t) !== null && i.matrixWorld.determinant() > 0;
}
function fx({ THREE: i, scene: e, tagged: t }) {
  let n = {
    meshesConsidered: 0,
    meshesMerged: 0,
    batchesCreated: 0,
    drawCallsReduced: 0,
    bucketsRolledBack: 0,
  };
  if (!Array.isArray(t)) return n;
  e.updateMatrixWorld(!0);
  let s = new Map();
  for (let r of t) {
    if (
      !r ||
      r.parent !== e ||
      !r.isMesh ||
      !WM.has(r.userData?.kind) ||
      ((n.meshesConsidered += 1), !ZM(r))
    )
      continue;
    let a = YM(r),
      o = JSON.stringify([
        r.material.uuid,
        r.userData.kind,
        a,
        r.visible,
        r.castShadow,
        r.receiveShadow,
        r.layers.mask,
        r.renderOrder,
        ux(r.geometry),
      ]);
    (s.has(o) || s.set(o, []), s.get(o).push({ node: r, spaceIds: a }));
  }
  for (let r of s.values()) {
    if (r.length < 2) continue;
    let a = r.map(({ node: c }) => c),
      o = [],
      l;
    try {
      e.updateMatrixWorld(!0);
      let c = new i.Box3();
      for (let g of a) {
        let m = g.geometry.clone();
        (transformGeometry(m, g.matrixWorld),
          m.computeBoundingBox(),
          m.boundingBox && c.union(m.boundingBox),
          o.push(m));
      }
      if (((l = gu(o, !1)), !l)) {
        n.bucketsRolledBack += 1;
        continue;
      }
      if ((l.computeBoundingBox(), !qM(c, l.boundingBox ?? XM(i, l)))) {
        (l.dispose(), (l = null), (n.bucketsRolledBack += 1));
        continue;
      }
      let h = a[0],
        u = r[0].spaceIds.slice(),
        d = new i.Mesh(l, h.material);
      ((d.name = `architecture:${h.userData.kind}:${u.join("+")}:${a.length}`),
        (d.castShadow = h.castShadow),
        (d.receiveShadow = h.receiveShadow),
        (d.layers.mask = h.layers.mask),
        (d.renderOrder = h.renderOrder),
        (d.visible = h.visible),
        (d.userData.kind = h.userData.kind),
        (d.userData.spaceIds = u.slice()),
        (d.userData.roomIDs = u.slice()),
        (d.userData.sourceNames = a.map((g) => g.name)));
      let f = a.map((g) => t.indexOf(g)).filter((g) => g >= 0);
      e.add(d);
      for (let g of a) e.remove(g);
      let p = f.length ? Math.min(...f) : t.length,
        x = t.filter((g) => !a.includes(g));
      (x.splice(Math.min(p, x.length), 0, d),
        t.splice(0, t.length, ...x),
        (n.meshesMerged += a.length),
        (n.batchesCreated += 1),
        (n.drawCallsReduced += a.length - 1),
        (l = null));
    } catch {
      ((n.bucketsRolledBack += 1), l && l.dispose());
    } finally {
      for (let c of o) c.dispose();
    }
  }
  return n;
}
var Lc = matchMedia("(max-width:1000px), (pointer:coarse)").matches,
  Jt,
  xx = {},
  roomBatching = {},
  kp = !1,
  xu = new Map(),
  xr = new Map(),
  yr = "interior",
  $n,
  Nc,
  vr = null,
  _x = {},
  ut = pt,
  jM = `${import.meta.env.BASE_URL}preview.jpg`,
  $e = (i) => document.querySelector(i),
  kn = $e("#scene"),
  Ui = $e("#viewer"),
  JM = {
    all: [
      "\u5168\u5C4B\u6982\u89C8",
      "\u5149\u4E0E\u751F\u6D3B\uFF0C\u81EA\u7136\u76F8\u9047\u3002",
    ],
    bar: [
      "\u9910\u53A8 \xB7 \u6C34\u5427",
      "\u4E00\u676F\u5496\u5561\uFF0C\u4E00\u987F\u5BB6\u5E38\u996D\u3002",
    ],
    master: [
      "\u4E3B\u5367 \xB7 \u53CC\u4EBA\u5DE5\u4F5C",
      "\u7761\u7720\u4E0E\u4E13\u6CE8\uFF0C\u90FD\u6709\u8212\u9002\u7684\u4F4D\u7F6E\u3002",
    ],
    guest: [
      "\u5F71\u97F3 \xB7 \u5BA2\u623F",
      "\u5E73\u65F6\u653E\u677E\uFF0C\u5076\u5C14\u7559\u5BBF\u3002",
    ],
    living: [
      "\u5BA2\u5385 \xB7 \u5A31\u4E50",
      "\u4E00\u8D77\u6E38\u620F\uFF0C\u4E00\u8D77\u6D88\u78E8\u597D\u65F6\u5149\u3002",
    ],
    balcony: [
      "\u751F\u6D3B\u9633\u53F0",
      "\u628A\u5BB6\u52A1\uFF0C\u5B89\u653E\u5728\u5411\u5149\u7684\u4E00\u4FA7\u3002",
    ],
    kitchen: [
      "\u5C01\u95ED\u53A8\u623F",
      "\u70DF\u706B\u65E5\u5E38\uFF0C\u8BA4\u771F\u5BF9\u5F85\u3002",
    ],
    bath: [
      "\u536B\u6D74\u7A7A\u95F4",
      "\u660E\u51C0\u3001\u6E29\u548C\uFF0C\u81EA\u5728\u6D17\u6F31\u3002",
    ],
  },
  Wt = "all",
  _u = !1,
  Ln = !1,
  Vp = !1,
  Ht,
  Nt,
  ct,
  Ct,
  yu = [],
  KM = [];
var QM = {},
  vu = !1,
  an = {
    entry: 1,
    gate: 0,
    kitchen: 0,
    fridge: 0,
    drawer: 0,
    chairs: 0,
    storage: 0,
    keg: 0,
    dining: 0,
    diningRetreat: 0,
    dishwasher: 0,
    laundry: 0,
    tv: 0,
    sofa: 0,
    activity: 0,
    miniFridge: 0,
    shower: 0,
    foldingShelf: 0,
  },
  Dn = { ...an };
var Za = null,
  Fc = [],
  St = {
    entry: [],
    gate: [],
    kitchen: [],
    fridge: [],
    drawer: [],
    chairs: [],
    storage: [],
    keg: [],
  },
  Su = (i) => {
    let e = $e("#notice");
    ((e.textContent = i),
      e.classList.add("show"),
      setTimeout(() => e.classList.remove("show"), 2800));
  },
  $M = $e(".room-tabs");
ut.cameras.forEach((i) => {
  let e = document.createElement("button");
  ((e.textContent = i.label),
    (e.dataset.view = i.id),
    (e.onclick = () => ja(i.id)),
    $M.append(e));
});
var Vn = {};
async function ew() {
  Object.assign(Vn, Jg(yi));
  await refineMaterials(Vn, Ht, { progressive: true, onTextureReady: () => Jt?.request({ shadow: true }) });
  enhanceSurfaces(Vn, Ct, ut.objects, Mu);
  configureRoomMaterials(Vn);
  prepareSalonMaterials(Vn);
  Ct.userData.materials = Vn;
}
function re(i, e, t, n, s, r, a, o = "oak", l = 0.015) {
  let c = ["box", e, t, n, l, /oak|wood/i.test(o)].join(":"),
    h = xr.get(c);
  h ||
    ((h = l
      ? new ru(e, t, n, 2, Math.min(l, e / 4, t / 4, n / 4))
      : new Rn(e, t, n)),
    metricUV(h, /oak|wood/i.test(o) && e > t ? "horizontal" : undefined),
    xr.set(c, h));
  let u = new tt(h, Vn[o] || Vn.oak);
  return (
    u.position.set(s, r, a),
    (u.castShadow = !0),
    (u.receiveShadow = !0),
    i.add(u),
    u
  );
}
function at(i, e, t, n, s, r, a = "oak", o = e) {
  let l = ["cylinder", o, e, t].join(":"),
    c = xr.get(l);
  c || ((c = new Ei(o, e, t, 32)), xr.set(l, c));
  let h = new tt(c, Vn[a] || Vn.oak);
  return (
    h.position.set(n, s, r),
    (h.castShadow = !0),
    (h.receiveShadow = !0),
    i.add(h),
    h
  );
}
function px(i, e) {
  re(i, e.w, 0.055, e.d, 0, e.h - 0.0275, 0, e.material);
  for (let t of [-e.w / 2 + 0.06, e.w / 2 - 0.06])
    for (let n of [-e.d / 2 + 0.06, e.d / 2 - 0.06])
      re(i, 0.045, e.h - 0.055, 0.045, t, (e.h - 0.055) / 2, n, "darkoak");
}
function Op(i, e) {
  (re(i, e.w, e.h - 0.1, e.d, 0, (e.h - 0.1) / 2 + 0.08, 0, e.material),
    re(i, e.w + 0.02, 0.045, e.d + 0.02, 0, e.h, 0, "stone"));
  let t = Math.max(1, Math.round(e.w / 0.55));
  for (let n = 0; n < t; n++) {
    let s = -e.w / 2 + ((n + 0.5) * e.w) / t;
    (re(
      i,
      e.w / t - 0.016,
      e.h - 0.15,
      0.025,
      s,
      e.h / 2 + 0.03,
      -e.d / 2 - 0.01,
      e.material,
    ),
      re(i, 0.13, 0.013, 0.025, s, e.h - 0.15, -e.d / 2 - 0.025, "bronze"));
  }
  re(i, e.w - 0.08, 0.06, e.d - 0.08, 0, 0.035, 0, "charcoal");
}
function tw(i, e) {
  for (let t of e.collisionParts || []) {
    let n = t.x - e.x,
      s = t.z - e.z,
      r = new P(n, 0, s).applyAxisAngle(
        new P(0, 1, 0),
        Kn.degToRad(e.rotation || 0),
      ),
      a = re(
        i,
        t.w,
        t.h,
        t.d,
        r.x,
        t.y - (e.y || 0) + t.h / 2,
        r.z,
        t.material || e.material || "oak",
        0.0012,
      );
    a.rotation.y = -Kn.degToRad((t.rotation || 0) - (e.rotation || 0));
  }
  if (e.id === "guest-wardrobe") {
    // Folded linens sit on the existing lower shelf, inside the open frame.
    re(i, 0.27, 0.075, 0.24, -0.12, 0.515, -0.22, "linen", 0.012);
    re(i, 0.24, 0.065, 0.22, 0.13, 0.505, 0.20, "cream", 0.01);
    re(i, 0.20, 0.055, 0.18, -0.08, 0.58, -0.20, "sage", 0.009);
  }
}
function nw(i, e) {
  let t = e.articulation || {},
    n = t.doorThickness || 0.04,
    s = e.frame || {},
    r = s.side ?? 0.035,
    a = s.back ?? 0.025,
    o = s.top ?? 0.035,
    l = s.bottom ?? 0.04,
    c = t.doorBottom ?? t.drawerHeight ?? 0.65,
    h = t.doorHeight ?? e.h - c - o,
    u = t.drawerTravel ?? 0.55;
  (re(i, r, e.h, e.d, -e.w / 2 + r / 2, e.h / 2, 0, "steel"),
    re(i, r, e.h, e.d, e.w / 2 - r / 2, e.h / 2, 0, "steel"),
    re(i, e.w - 2 * r, l, e.d, 0, l / 2, 0, "steel"),
    re(i, e.w - 2 * r, o, e.d, 0, e.h - o / 2, 0, "steel"),
    re(
      i,
      e.w - 2 * r,
      e.h - o - l,
      a,
      0,
      (e.h + l - o) / 2,
      e.d / 2 - a / 2,
      "steel",
    ));
  let d = e.d - a - 0.025,
    f = e.h - o - l;
  (re(i, e.w - 2 * r, 0.012, d, 0, l + 0.01, -a / 2, "cream", 0),
    re(
      i,
      0.012,
      f,
      d,
      -e.w / 2 + r + 0.006,
      (e.h + l - o) / 2,
      -a / 2,
      "cream",
      0,
    ),
    re(
      i,
      0.012,
      f,
      d,
      e.w / 2 - r - 0.006,
      (e.h + l - o) / 2,
      -a / 2,
      "cream",
      0,
    ));
  for (let v = 1; v <= 2; v++)
    re(
      i,
      e.w - 2 * r - 0.024,
      0.012,
      d - 0.02,
      0,
      c + (h * v) / 3,
      -a / 2,
      "glass",
      0,
    );
  if (e.id === "kitchen-fridge") {
    // Small cartons rest on the fixed shelves near the rear wall.
    for (let [x, y, z, itemW, itemH, itemD, material] of [
      [-0.13, c + h / 3 + 0.055, 0.17, 0.12, 0.11, 0.13, "cream"],
      [0.10, c + h / 3 + 0.065, 0.17, 0.15, 0.13, 0.14, "sage"],
      [-0.12, c + (2 * h) / 3 + 0.055, 0.16, 0.13, 0.11, 0.13, "cream"],
      [0.11, c + (2 * h) / 3 + 0.07, 0.16, 0.14, 0.14, 0.14, "sage"],
    ])
      re(i, itemW, itemH, itemD, x, y, z, material, 0.012);
  }
  let p = new mn();
  ((p.name = `${e.id}:hinge`),
    p.position.set(
      t.hinge === "right" ? e.w / 2 : -e.w / 2,
      0,
      -e.d / 2 - n / 2,
    ),
    i.add(p));
  let x = t.hinge === "right" ? -1 : 1,
    g = Math.min(h, e.h - c),
    m = c + g / 2;
  (re(p, e.w, g, n, (x * e.w) / 2, m, 0, "cream"),
    re(p, 0.025, g * 0.43, 0.014, (x * e.w) / 2, m, -n / 2 - 0.007, "steel"));
  let y = Math.min(u, e.d - a),
    b = new mn();
  ((b.name = `${e.id}:drawer`),
    b.position.set(0, c / 2, -e.d / 2 + y / 2),
    i.add(b),
    re(b, e.w, c - 0.035, y, 0, 0, 0, "steel"),
    re(b, e.w, c, n, 0, 0, -y / 2 - n / 2, "cream"),
    re(b, 0.18, 0.018, 0.014, 0, 0.04, -y / 2 - n - 0.007, "steel"),
    St.fridge.push({
      object: e,
      pivot: p,
      drawer: b,
      drawerClosedZ: b.position.z,
      hinge: x,
      max: Kn.degToRad(t.maxAngle ?? 110),
      travel: u,
    }));
}
function iw(i, e) {
  at(i, 0.08, 0.43, 0, 0.215, 0, "steel");
  for (let t = 0; t < 5; t++) {
    let n = new mn();
    ((n.rotation.y = (t * Math.PI * 2) / 5),
      re(n, 0.035, 0.045, 0.3, 0, 0.08, 0.15, "charcoal"),
      at(n, 0.025, 0.035, 0, 0.043, 0.3, "black"),
      i.add(n));
  }
  (re(i, 0.51, 0.1, 0.47, 0, 0.47, 0, "charcoal", 0.055),
    re(i, 0.5, 0.53, 0.065, 0, 0.8, 0.23, "charcoal", 0.04));
  for (let t of [-0.295, 0.295])
    (re(i, 0.025, 0.22, 0.025, t, 0.55, 0.12, "steel"),
      re(i, 0.07, 0.045, 0.35, t, 0.67, -0.025, "charcoal"));
  for (let t = 0; t < 9; t++)
    re(i, 0.4, 0.011, 0.006, 0, 0.62 + t * 0.042, 0.195, "black", 0);
}
function sw(i, e) {
  for (let t of [-0.19, 0.19])
    for (let n of [-0.18, 0.18])
      re(i, 0.035, 0.44, 0.035, t, 0.22, n, "darkoak");
  (re(i, 0.46, 0.085, 0.43, 0, 0.465, 0, e.material, 0.035),
    re(i, 0.46, 0.34, 0.075, 0, 0.69, 0.2, e.material, 0.045));
}
function mx(i, e, t = !1) {
  let n = t ? 0.24 : 0.23;
  re(i, e.w - 0.05, n, e.d - 0.08, 0, 0.17, 0, "darkoak");
  for (let l of [-e.w / 2 + 0.1, e.w / 2 - 0.1])
    for (let c of [-e.d / 2 + 0.12, e.d / 2 - 0.12])
      at(i, 0.028, 0.1, l, 0.05, c, "darkoak");
  let s = re(
      i,
      e.w - 0.16,
      t ? 0.15 : 0.18,
      e.d - 0.23,
      0,
      t ? 0.355 : 0.38,
      -0.06,
      "linen",
      0.075,
    ),
    r = re(
      i,
      e.w - 0.16,
      t ? 0.37 : 0.39,
      0.23,
      0,
      t ? 0.585 : 0.62,
      e.d / 2 - 0.14,
      "linen",
      0.07,
    ),
    a = [];
  for (let l of [-e.w / 2 + 0.09, e.w / 2 - 0.09])
    re(i, 0.17, 0.43, e.d - 0.05, l, 0.42, 0, "linen", 0.065);
  let o = t ? 2 : 3;
  for (let l = 0; l < o; l++) {
    let c = -e.w / 2 + 0.17 + ((l + 0.5) * (e.w - 0.34)) / o;
    (a.push(
      re(
        i,
        (e.w - 0.36) / o - 0.012,
        t ? 0.015 : 0.09,
        e.d - 0.29,
        c,
        t ? 0.4375 : 0.51,
        -0.06,
        "linen",
        0.04,
      ),
    ),
      a.push(
        re(
          i,
          (e.w - 0.4) / o - 0.06,
          0.27,
          0.12,
          c,
          t ? 0.625 : 0.7,
          e.d / 2 - 0.27,
          l === 0 ? "sage" : "linen",
          0.045,
        ),
      ));
  }
  if (t) {
    i.rotation.y = Math.PI;
    let l = new mn();
    ((l.visible = !1),
      i.add(l),
      re(l, 1.4, 0.12, 0.8, 0, 0.3, -0.79, "linen", 0.035),
      re(l, 1.4, 0.12, 0.41, 0, 0.3, -1.385, "linen", 0.025));
    for (let c of [-0.63, 0.63]) re(l, 0.03, 0.3, 0.03, c, 0.15, -1.4, "steel");
    yu.push({ g: i, ext: l, o: e, seat: s, back: r, tops: a });
  }
}
function rw(i, e) {
  (re(i, e.w, e.h, 0.065, 0, e.h / 2, 0, "black", 0.025),
    re(i, e.w - 0.055, e.h - 0.055, 0.006, 0, e.h / 2, -0.038, "screen", 0.006),
    re(i, 0.06, 0.15, 0.05, 0, -0.06, 0, "steel"));
}
function gx(i, e) {
  Op(i, { ...e, material: "cream" });
  let t = at(i, 0.235, 0.026, 0, 0.46, -0.365, "steel");
  t.rotation.x = Math.PI / 2;
  let n = at(i, 0.195, 0.029, 0, 0.46, -0.385, "black");
  n.rotation.x = Math.PI / 2;
  let s = at(i, 0.164, 0.029, 0, 0.46, -0.402, "glass");
  ((s.rotation.x = Math.PI / 2),
    re(i, 0.18, 0.05, 0.015, -0.15, 0.75, -0.36, "charcoal"),
    (at(i, 0.04, 0.019, 0.14, 0.74, -0.365, "steel").rotation.x = Math.PI / 2));
}
function aw(i, e) {
  buildPlant(i, e, Vn);
}

var yx = [],
  Gp = [],
  Ni = new Set(ut.rooms.map((i) => i.id)),
  _r,
  Hp,
  Wp = "warm";
function Mu(i, e, t = "object") {
  ((i.userData.spaceIds = e), (i.userData.kind = t), Gp.push(i));
}
function ow() {
  let i = Kg({
    THREE: yi,
    scene: Ct,
    model: ut,
    materials: Vn,
    mesh: re,
    tag: Mu,
    movingParts: St,
  });
  ((yx = i.floorRooms),
    (Nc = i.ceiling),
    finishArchitecture(Ct, Vn, Mu),
    (_x = fx({ THREE: yi, scene: Ct, tagged: Gp })));
}
function lw() {
  for (let i of ut.objects) {
    if (
      i.type === "door_leaf" ||
      i.type === "cabinet_frame_part" ||
      i.rendererHidden === !0
    )
      continue;
    let e = new mn();
    if (
      ((e.name = i.id),
      e.position.set(i.x, i.y || 0, i.z),
      (e.rotation.y = -Kn.degToRad(i.rotation || 0)),
      Ct.add(e),
      Mu(
        e,
        i.room === "v3-dining-entry" ||
          i.id === "column-handdrawn" ||
          i.type === "island"
          ? ["bar", "hall"]
          : [i.room],
      ),
      !(
        buildLifeFurniture(e, i, Vn, lifeMotion) ||
        buildHomeFurniture(e, i, Vn, homeMotion) ||
        buildSalonFurniture(e, i, Vn, St) ||
        (i.type === "wall_storage" &&
          (buildStorageUnit(e, i, Vn, St.storage), true)) ||
        lx({
          THREE: yi,
          g: e,
          o: i,
          materials: Vn,
          mesh: re,
          cyl: at,
          movingParts: St,
        }) ||
        cx({
          THREE: yi,
          g: e,
          o: i,
          materials: Vn,
          mesh: re,
          cyl: at,
          movingParts: St,
          model: ut,
        })
      ))
    )
      switch (i.type) {
        case "column":
          (re(e, i.w, i.h, i.d, 0, i.h / 2, 0, "plaster", 0.012),
            re(e, i.w, 0.07, i.d, 0, 0.035, 0, "stone", 0.004));
          break;
        case "island":
          (re(e, i.w, i.h - 0.055, i.d, 0, (i.h - 0.055) / 2, 0, "darkoak"),
            re(e, i.w, 0.055, i.d, 0, i.h - 0.0275, 0, "stone"));
          for (let s of [-i.d / 4, i.d / 4])
            re(e, 0.01, 0.014, 0.18, i.w / 2, i.h - 0.18, s, "bronze");
          break;
        case "base_cabinet":
        case "bar_cabinet":
        case "vanity":
        case "shoe_cabinet":
        case "utility_cabinet":
        case "nightstand":
        case "tv_console":
          (Op(e, i),
            i.type === "vanity" &&
              (at(e, 0.16, 0.045, 0, i.h + 0.055, 0, "cream"),
              re(e, 0.02, 0.13, 0.02, 0.19, i.h + 0.1, 0.1, "steel")));
          break;
        case "cabinet_frame":
          tw(e, i);
          break;
        case "wardrobe":
          re(e, i.w, i.h, i.d, 0, i.h / 2, 0, "oak");
          for (let s of [-i.d / 4, i.d / 4])
            (re(
              e,
              0.025,
              i.h - 0.1,
              i.d / 2 - 0.025,
              i.w / 2 + 0.015,
              i.h / 2,
              s,
              "oak",
            ),
              re(e, 0.022, 0.26, 0.02, i.w / 2 + 0.04, 1, s, "bronze"));
          break;
        case "desk":
          px(e, i);
          for (let [s, r] of [
            [-0.1, 0.09],
            [0.17, 0.06],
          ])
            re(e, 0.22, 0.018, 0.07, s, i.h + 0.03, r, "charcoal");
          break;
        case "office_chair":
          iw(e, i);
          break;
        case "dining_chair":
          (sw(e, i),
            i.retreat &&
              St.chairs.push({
                group: e,
                base: e.position.clone(),
                retreat: i.retreat,
                distance: i.retreat.distanceM || 0,
              }));
          break;
        case "round_table":
          (at(e, 0.13, 0.65, 0, 0.325, 0, "darkoak", 0.085),
            at(e, 0.34, 0.035, 0, 0.045, 0, "darkoak"),
            at(e, i.w / 2, 0.045, 0, i.h - 0.0225, 0, "oak"),
            at(e, 0.075, 0.055, 0.17, i.h + 0.05, 0.07, "stone"));
          break;
        case "bed":
          (re(e, i.w, 0.37, i.d, 0, 0.185, 0, "oak", 0.055),
            re(e, i.w, 0.87, 0.08, 0, 0.45, -i.d / 2 + 0.03, "linen", 0.04));
          break;
        case "mattress":
          re(e, i.w, i.h, i.d, 0, i.h / 2, 0, "linen", 0.065);
          buildSoftBedding(e, i, Vn);
          break;
        case "sofa":
          mx(e, i);
          break;
        case "sofa_bed":
          mx(e, i, !0);
          break;
        case "tv":
        case "monitor":
          rw(e, i);
          break;
        case "laptop":
          (re(e, 0.35, 0.018, 0.24, 0, 0.014, 0, "steel"),
            (re(
              e,
              0.35,
              0.2,
              0.014,
              0,
              0.115,
              0.09,
              "black",
              0.007,
            ).rotation.x = -0.18));
          break;
        case "mirror":
          (re(e, i.w, i.h, 0.045, 0, i.h / 2, 0, "oak"),
            re(
              e,
              i.w - 0.04,
              i.h - 0.04,
              0.01,
              0,
              i.h / 2,
              -0.027,
              "steel",
              0.002,
            ));
          break;
        case "pc":
          (re(e, i.w, i.h, i.d, 0, i.h / 2, 0, "charcoal"),
            re(
              e,
              i.w - 0.035,
              i.h - 0.05,
              0.006,
              0,
              i.h / 2,
              -i.d / 2 - 0.004,
              "glass",
            ),
            (at(e, 0.065, 0.02, 0, 0.28, -i.d / 2 - 0.014, "sage").rotation.x =
              Math.PI / 2));
          break;
        case "fridge":
          nw(e, i);
          break;
        case "hob":
          re(e, i.w, 0.035, i.d, 0, 0.0175, 0, "black");
          for (let s of [-0.23, 0.23]) {
            (at(e, 0.105, 0.025, s, 0.05, 0, "steel"),
              at(e, 0.067, 0.035, s, 0.05, 0, "black"));
            for (let r = 0; r < 4; r++) {
              let a = re(e, 0.025, 0.022, 0.22, s, 0.085, 0, "black");
              a.rotation.y = (r * Math.PI) / 2;
            }
          }
          break;
        case "hood":
          (re(e, i.w, 0.08, i.d, 0, 0.04, 0, "steel"),
            re(e, 0.25, 0.55, 0.22, 0, 0.32, 0.06, "steel"));
          break;
        case "sink":
          (re(e, i.w, 0.025, i.d, 0, 0.012, 0, "steel"),
            re(e, i.w - 0.08, 0.012, i.d - 0.12, 0, 0.03, 0, "charcoal"),
            at(e, 0.011, 0.22, i.w / 2 - 0.08, 0.12, i.d / 2 - 0.05, "steel"),
            re(
              e,
              0.02,
              0.02,
              0.16,
              i.w / 2 - 0.08,
              0.23,
              i.d / 2 - 0.12,
              "steel",
            ));
          break;
        case "dishwasher":
          (re(e, i.w, 0.81, 0.035, 0, 0.41, -0.303, "steel"),
            re(e, 0.45, 0.023, 0.03, 0, 0.73, -0.33, "charcoal"));
          break;
        case "coffee":
          (re(e, i.w, 0.29, i.d - 0.06, 0, 0.22, 0.02, "cream"),
            re(e, i.w + 0.02, 0.06, i.d, 0, 0.03, 0, "steel"),
            re(e, 0.25, 0.06, 0.15, 0, 0.24, -0.25, "steel"));
          for (let s of [-0.07, 0.07])
            at(e, 0.025, 0.045, s, 0.19, -0.23, "steel");
          (re(e, 0.028, 0.1, 0.035, 0.14, 0.2, -0.24, "steel"),
            at(e, 0.035, 0.05, -0.03, 0.08, -0.2, "cream"));
          break;
        case "grinder":
          (re(e, 0.15, 0.23, 0.18, 0, 0.115, 0, "black"),
            at(e, 0.073, 0.16, 0, 0.31, 0, "glass", 0.085),
            at(e, 0.089, 0.016, 0, 0.4, 0, "black"),
            re(e, 0.045, 0.06, 0.08, 0, 0.2, -0.1, "steel"));
          break;
        case "kegerator":
          (gx(e, i),
            re(e, 0.42, 0.7, 0.03, 0, 0.4, -0.355, "steel"),
            re(e, 0.15, 0.025, 0.025, 0.1, 0.69, -0.38, "black"));
          break;
        case "beer_font":
          (at(e, 0.043, 0.04, 0, -0.02, 0, "steel"),
            at(e, 0.025, 0.29, 0, 0.145, 0, "steel"),
            re(e, 0.12, 0.045, 0.045, 0, 0.29, -0.03, "steel"),
            re(e, 0.018, 0.1, 0.03, 0, 0.33, -0.05, "black"));
          break;
        case "keg":
        case "co2":
          break;
        case "three_shelf":
          re(e, i.w, 0.025, i.d, 0, 0, 0, "oak");
          for (let s of [-i.w / 2, i.w / 2])
            re(e, 0.025, i.h, i.d, s, i.h / 2, 0, "oak");
          for (let s = 0; s < 3; s++) {
            re(e, i.w, 0.025, i.d, 0, s * 0.31, 0, "oak");
            for (let r = 0; r < 3; r++)
              at(
                e,
                0.025,
                0.12,
                -0.22 + r * 0.22,
                s * 0.31 + 0.075,
                0,
                r === 1 ? "cream" : "glass",
              );
          }
          break;
        case "washer":
        case "dryer":
          gx(e, i);
          break;
        case "laundry_sink":
          (Op(e, i),
            re(e, 0.42, 0.025, 0.42, 0, i.h + 0.02, 0, "steel"),
            re(e, 0.36, 0.014, 0.33, 0, i.h + 0.04, 0, "charcoal"),
            at(e, 0.012, 0.18, 0.17, i.h + 0.1, 0.18, "steel"));
          break;
        case "drying_rack":
          for (let s of [-0.28, 0.28])
            re(e, 0.028, 0.035, 1.2, s, 0, 0, "steel");
          for (let s = 0; s < 6; s++)
            re(e, 0.56, 0.025, 0.02, 0, 0, -0.5 + s * 0.2, "steel");
          re(e, 0.45, 0.55, 0.012, -0.1, -0.29, -0.2, "linen");
          break;
        case "basket":
          at(e, 0.21, 0.49, 0, 0.245, 0, "linen", 0.19);
          for (let s = 0; s < 8; s++)
            at(e, 0.215, 0.009, 0, 0.03 + s * 0.06, 0, "oak", 0.19);
          break;
        case "toilet":
          (re(e, 0.37, 0.39, 0.47, 0, 0.22, -0.04, "cream", 0.12),
            re(e, 0.36, 0.39, 0.17, 0, 0.57, 0.23, "cream", 0.04));
          let t = at(e, 0.17, 0.04, 0, 0.45, -0.08, "cream");
          t.scale.z = 1.25;
          break;
        case "shower":
          (re(e, i.w, 0.035, i.d, 0, 0.018, 0, "stone"),
            re(e, i.w, 0.025, 0.025, 0, 2.2, i.d / 2, "steel"),
            re(e, 0.1, 1.7, 0.025, i.w / 2 - 0.055, 1.34, i.d / 2, "linen"),
            re(e, 0.02, 1.4, 0.02, 0.26, 1.5, i.d / 2 - 0.06, "steel"),
            at(e, 0.1, 0.025, 0.26, 2.22, i.d / 2 - 0.18, "steel"));
          break;
        case "bench":
          (px(e, { ...i, h: Math.max(0.1, i.h - 0.08) }),
            re(e, i.w, 0.08, i.d, 0, i.h - 0.04, 0, "linen", 0.04));
          break;
        case "robot":
          (re(e, i.w, 0.35, 0.18, 0, 0.19, 0.11, "cream"),
            at(e, 0.165, 0.08, 0, 0.05, -0.09, "cream"));
          break;
        case "bin":
          re(e, i.w, i.h, i.d, 0, i.h / 2, 0, "sage", 0.035);
          break;
        case "vacuum":
          (at(e, 0.015, 0.9, 0, 0.5, 0, "steel"),
            re(e, 0.2, 0.07, 0.16, 0, 0.05, 0, "charcoal"));
          break;
        case "plant":
          aw(e, i);
          break;
        case "rug":
          re(e, i.w, 0.012, i.d, 0, 0.012, 0, "linen", 0.035);
          break;
        case "side_table":
          (at(e, 0.19, 0.035, 0, i.h, 0, "oak"),
            at(e, 0.04, i.h, 0, i.h / 2, 0, "darkoak"));
          break;
        case "floor_lamp":
          (at(e, 0.16, 0.035, 0, 0.025, 0, "bronze"),
            at(e, 0.012, 1.25, 0, 0.66, 0, "bronze"),
            at(e, 0.16, 0.28, 0, 1.4, 0, "linen", 0.13));
          let n = at(e, 0.1, 0.025, 0, 1.26, 0, "light");
          KM.push(n);
          break;
        case "ps5":
          (re(e, i.w, i.h, i.d, 0, 0.05, 0, "cream", 0.03),
            re(e, i.w - 0.07, i.h + 0.01, i.d - 0.01, 0, 0.05, 0, "black"));
          for (let s of [-0.15, 0.15])
            re(e, 0.1, 0.04, 0.05, s, 0.16, -0.03, "cream", 0.015);
          break;
        case "key_tray":
          re(e, i.w, 0.025, i.d, 0, 0.01, 0, "bronze", 0.025);
          break;
        case "hooks":
          (re(e, 0.08, 0.23, 0.03, 0, 0.13, 0, "bronze"),
            re(e, 0.3, 0.28, 0.1, 0.02, -0.05, 0, "darkoak", 0.02));
          break;
        default:
          re(e, i.w, i.h, i.d, 0, i.h / 2, 0, i.material);
      }
  }
}
function cw() {
  // A transparent glazing pane must not behave like an opaque shadow blocker.
  Ct.traverse((node) => {
    if (
      node.isMesh &&
      !Array.isArray(node.material) &&
      node.material?.transparent &&
      node.material.opacity < 0.8
    )
      node.castShadow = false;
  });
  let i = new nr("#f4f4ed", "#77756b", 0.65);
  ((i.name = "ambient"), Ct.add(i));
  let e = new ar("#fff7ea", 0.1);
  ((e.name = "sun"),
    e.position.fromArray(
      sunDirection().map((v, index) => [6, 0.8, 4.5][index] + v * 24),
    ),
    (e.castShadow = !0),
    e.shadow.mapSize.set(quality.sunShadowSize, quality.sunShadowSize),
    Object.assign(e.shadow.camera, {
      left: -10,
      right: 10,
      top: 10,
      bottom: -10,
      near: 1,
      far: 45,
    }),
    e.shadow.camera.layers.enable(1),
    (e.shadow.bias = -3e-4),
    (e.shadow.normalBias = 0.014),
    Ct.add(e));
  e.target.position.set(6, 0.8, 4.5);
  Ct.add(e.target);
  // Camera cutaway never removes the roof from the solar shadow pass.
  const roofShadow = Nc.clone();
  roofShadow.name = "daylight:roof-shadow";
  roofShadow.layers.set(1);
  roofShadow.visible = true;
  roofShadow.castShadow = true;
  roofShadow.receiveShadow = false;
  Ct.add(roofShadow);
  let t = environmentGenerator(Ht),
    n = new au();
  ((Ct.environment = t.fromScene(n, 0.04).texture),
    (Ct.environmentIntensity = 0.2),
    n.dispose(),
    t.dispose(),
    (_r = Qg({
      THREE: yi,
      scene: Ct,
      model: ut,
      mobile: Lc,
      registerVisual: (s, r) => Mu(s, s.userData.spaceIds || [r], "fixture"),
    })),
    Ct.traverse((s) => {
      if (s.isLight && s.shadow) {
        // Roof proxy belongs only to the directional sun, not interior spots.
        s.shadow.autoUpdate = false;
      }
    }));
}
function Fp(i) {
  if (!ut.lighting.scenes.some((s) => s.id === i)) return;
  Wp = i;
  const moment = ut.lighting.scenes.find((s) => s.id === i);
  roomAtmosphere?.apply(i);
  if (Vn?.light) Vn.light.emissiveIntensity = moment?.daylight ? 0.12 : i === "cinema" ? 0.08 : 0.4;
  let e = _r.apply(i);
  gpuFinish?.setNight(!e.daylight);
  ((_u = !e.daylight),
    document.body.classList.toggle("night", _u),
    (Ct.getObjectByName("ambient").intensity =
      moment?.ambientIntensity ??
      (e.daylight ? 1.5 : i === "night" ? 0.2 : 0.58)),
    (Ct.getObjectByName("sun").intensity = e.daylight ? 2.6 : 0.04),
    (Ct.environmentIntensity =
      moment?.environmentIntensity ?? (e.daylight ? 0.55 : 0.18)),
    Ct.background?.isColor && Ct.background.set(e.daylight ? "#e4e0d7" : "#383b35"),
    (Ht.toneMappingExposure = moment?.exposure ?? (e.daylight ? 0.95 : 1.12)),
    updateHomeLighting(homeMotion, e.daylight),
    exteriorWorld?.setNight(!e.daylight),
    (diffuseReady = loadDiffuseVariant(!e.daylight)),
    roomRadiance?.refresh(!e.daylight).then(()=>Oi()),
    ($e("#lighting").textContent = e.daylight
      ? "\u591C\u95F4"
      : "\u65E5\u95F4"),
    Hp?.updateLighting(i),
    Jt?.request({ shadow: !0 }),
    Oi());
  if (i === "cinema") {
    ns({ storage: 0 }, 0);
    $e("#storage-toggle")?.setAttribute("aria-pressed", "false");
    if ($e("#storage-toggle"))
      $e("#storage-toggle").textContent = "收纳柜门（已关）";
    vx(false);
  }
  if (i === "guest-stay") vx(true);
  if (i === "two-person-dining") setLivingMode("dining");
  if (
    !ghostWalk &&
    moment?.viewId &&
    !["day-public", "aperitif", "cinema"].includes(i)
  ) {
    const view = ut.presentation.interiorViews.find(
      (v) => v.id === moment.viewId,
    );
    if (view) Ka(view);
  }
  document
    .querySelectorAll("[data-moment]")
    .forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.moment === i)),
    );
}
function Xp(i) {
  i.mode === "all"
    ? (Ni = new Set(ut.rooms.map((e) => e.id)))
    : i.mode === "current"
      ? (Ni = new Set(
          Wt === "all"
            ? ut.rooms.map((e) => e.id)
            : [
                Wt,
                ...(["bar", "kitchen"].includes(Wt)
                  ? ["bar", "hall", "kitchen"]
                  : Wt === "living"
                    ? ["balcony"]
                    : []),
              ],
        ))
      : i.visible
        ? Ni.add(i.id)
        : Ni.delete(i.id);
  for (let e of Gp)
    e.visible =
      e.userData.kind === "ceiling"
        ? yr !== "overview" && Ni.size > 0
        : e.userData.kind === "plinth"
          ? Ni.size === ut.rooms.length
          : e.userData.spaceIds.some((t) => Ni.has(t));
  (_r?.setVisibleRooms(Ni),
    _r?.setInterior(yr !== "overview"),
    Nc && (Nc.castShadow = false),
    Hp?.updateVisibility(Ni),
    Jt?.request({ shadow: !0 }),
    Oi());
}
function vx(i) {
  Vp = i;
  let e = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700,
    t = performance.now(),
    n = yu[0]?.progress || 0,
    s = i ? 1 : 0,
    r = (a) => {
      let o = e ? Math.max(0, Math.min(1, (a - t) / e)) : 1,
        l = n + (s - n) * (o * o * (3 - 2 * o));
      for (let c of yu)
        ((c.progress = l),
          (c.ext.visible = l > 0.001),
          (c.ext.scale.z = Math.max(0.001, l)),
          (c.seat.position.y = 0.355 - 0.07 * l),
          (c.back.rotation.x = (-Math.PI / 2) * l),
          (c.back.position.y = 0.585 - 0.34 * l),
          (c.back.position.z = c.o.d / 2 - 0.14 - 0.06 * l),
          c.tops.forEach((h) => (h.visible = l < 0.5)));
      return o < 1;
    };
  (xu.set("bed", r),
    Jt?.request({ shadow: !0 }),
    ($e("#bed-state").textContent = i
      ? "\u6536\u8D77\u5BA2\u5E8A"
      : "\u5C55\u5F00\u5BA2\u5E8A"),
    $e("#bed-state").setAttribute("aria-pressed", String(i)));
}
var localStorageProgress = new Map();
function ns(i, e = 600) {
  if (Object.hasOwn(i, "storage")) localStorageProgress.clear();
  let t = { ...an },
    n = { ...Dn, ...i };
  (i.fridge === 0 ? (n.drawer = 0) : n.drawer > 0 && (n.fridge = 1),
    Object.assign(Dn, n));
  let s = [];
  (n.drawer > 0 && t.fridge < 0.999
    ? s.push({ ...n, drawer: 0 })
    : n.fridge === 0 &&
      t.drawer > 0.001 &&
      s.push({ ...n, fridge: t.fridge, drawer: 0 }),
    s.push(n),
    matchMedia("(prefers-reduced-motion: reduce)").matches && (e = 0));
  let r = performance.now();
  (xu.set("motion", (a) => {
    let o = e * s.length,
      l = e ? Math.max(0, Math.min(s.length, (a - r) / e)) : s.length,
      c = Math.min(s.length - 1, Math.floor(l)),
      h = l >= s.length ? 1 : l - c,
      u = h * h * (3 - 2 * h),
      d = c === 0 ? t : s[c - 1],
      f = s[c];
    for (let p of Object.keys(an)) an[p] = d[p] + (f[p] - d[p]) * u;
    return (bx(), e > 0 && a - r < o);
  }),
    zc(),
    Jt?.request({ shadow: !0 }));
}
function bx() {
  for (let i of St.storage) {
    const progress = localStorageProgress.get(i.unitId) ?? an.storage;
    if (i.axis === "x") i.pivot.rotation.x = i.openAngle * progress;
    else i.pivot.rotation.y = ((-i.sign * Math.PI) / 2) * progress;
  }
  for (let i of St.keg)
    ((i.pivot.rotation.y = (-Math.PI / 2) * an.keg),
      (i.inside.visible = an.keg > 0.05));
  for (let i of St.entry) i.group.rotation.y = i.base - i.angle * an.entry;
  for (let i of St.gate)
    i.group.rotation[i.axis || "y"] = i.base - i.angle * an.gate;
  applyHomeMotion(homeMotion, {
    dining: an.dining,
    gate: an.gate,
    dishwasher: an.dishwasher,
    laundry: an.laundry,
    tv: an.tv,
    sofa: an.sofa,
    diningRetreat: an.diningRetreat,
    activity: an.activity,
  });
  applyLifeMotion(lifeMotion, an);
  for (let i of St.kitchen)
    i.group.position.set(
      i.closed[0] + i.travel[0] * an.kitchen,
      0,
      i.closed[1] + i.travel[1] * an.kitchen,
    );
  for (let i of St.fridge.filter(item=>!item.lifeManaged))
    ((i.pivot.rotation.y = i.hinge * i.max * an.fridge),
      (i.drawer.position.z = i.drawerClosedZ - i.travel * an.drawer));
  for (let i of St.chairs) {
    let e = i.retreat,
      t = an.chairs;
    i.group.position.set(
      i.base.x + (e.x - i.base.x) * t,
      i.base.y,
      i.base.z + (e.z - i.base.z) * t,
    );
  }
}
function setTVAlternative(alternative) {
  if (alternative && Dn.dining > 0) { Su("请先收起餐桌，再调整电视停靠位置"); return; }
  ns({tv:alternative?1:0});
}
function setLivingMode(mode) {
  if (!["relax","dining","activity"].includes(mode)) return;
  ns({dining:mode==="dining"?1:0,activity:mode==="activity"?1:0,sofa:0,diningRetreat:0,gate:1,tv:0},1800);
  const control=$e("#living-mode"); if(control)control.value=mode;
}
function zc() {
  for (let [i, e, t] of [
    ["entry-toggle", "entry", "\u5165\u6237\u95E8"],
    ["gate-toggle", "gate", "抽拉台面"],
    ["kitchen-toggle", "kitchen", "\u53A8\u623F\u95E8"],
    ["fridge-toggle", "fridge", "\u51B0\u7BB1\u95E8"],
    ["drawer-toggle", "drawer", "\u62BD\u5C49"],
    ["chairs-toggle", "chairs", "工位退椅"],
    ["dining-toggle", "dining", "餐桌展开"],
    ["dishwasher-toggle", "dishwasher", "洗碗机"],
    ["laundry-toggle", "laundry", "洗烘舱门"],
    ["sofa-toggle", "sofa", "沙发"],
    ["tv-toggle", "tv", "电视"],
  ]) {
    let n = $e(`#${i}`);
    if (!n) continue;
    let s = !!Dn[e];
    (n.setAttribute("aria-pressed", String(s)),
      (n.textContent = `${t}\uFF08${s ? (e === "chairs" || e === "drawer" ? "\u5DF2\u62C9\u51FA" : "\u5DF2\u5F00") : e === "chairs" ? "\u5DF2\u6536\u56DE" : e === "drawer" ? "\u5DF2\u6536" : "\u5DF2\u5173"}\uFF09`));
    if (e === "gate") n.textContent = `抽拉台面（${s ? "已收回" : "已拉出"}）`;
    if (e === "sofa") n.textContent = s ? "拼合沙发" : "拆分沙发";
    if (e === "tv") n.textContent = s ? "电视归位" : "电视换位";
  }
}
function fw() {
  let i = $e("#motion-controls"),
    e = (s, r, a) => {
      let o = document.createElement("button");
      return (
        (o.type = "button"),
        (o.id = s),
        (o.textContent = r),
        (o.onclick = a),
        i.append(o),
        o
      );
    };
  if (
    (St.entry.length &&
      e("entry-toggle", "\u5165\u6237\u95E8\uFF08\u5DF2\u5F00\uFF09", () => {
        let s = Dn.entry ? 0 : 1;
        (ns({ entry: s }), zc());
      }),
    St.gate.length)
  ) {
    let s = e("gate-toggle", "抽拉台面\uFF08\u5DF2\u5173\uFF09", () => {
      let r = Dn.gate ? 0 : 1;
      (ns({ gate: r }),
        (s.textContent = r
          ? "抽拉台面（已收回）"
          : "抽拉台面（已拉出）"),
        s.setAttribute("aria-pressed", String(!!r)));
    });
    s.setAttribute("aria-pressed", String(!!Dn.gate));
  }
  (St.kitchen.length &&
    e("kitchen-toggle", "\u53A8\u623F\u95E8\uFF08\u5DF2\u5173\uFF09", () => {
      let s = Dn.kitchen ? 0 : 1;
      (ns({ kitchen: s }),
        ($e("#kitchen-toggle").textContent = s
          ? "\u53A8\u623F\u95E8\uFF08\u5DF2\u5F00\uFF09"
          : "\u53A8\u623F\u95E8\uFF08\u5DF2\u5173\uFF09"),
        $e("#kitchen-toggle").setAttribute("aria-pressed", String(!!s)));
    }),
    St.fridge.length &&
      (e("fridge-toggle", "\u51B0\u7BB1\u95E8\uFF08\u5DF2\u5173\uFF09", () => {
        let s = Dn.fridge ? 0 : 1;
        (ns({ fridge: s }),
          ($e("#fridge-toggle").textContent = s
            ? "\u51B0\u7BB1\u95E8\uFF08\u5DF2\u5F00\uFF09"
            : "\u51B0\u7BB1\u95E8\uFF08\u5DF2\u5173\uFF09"),
          $e("#fridge-toggle").setAttribute("aria-pressed", String(!!s)));
      }),
      e("drawer-toggle", "\u62BD\u5C49\uFF08\u5DF2\u6536\uFF09", () => {
        let s = Dn.drawer ? 0 : 1;
        (ns({ drawer: s }),
          ($e("#drawer-toggle").textContent = s
            ? "\u62BD\u5C49\uFF08\u5DF2\u62C9\u51FA\uFF09"
            : "\u62BD\u5C49\uFF08\u5DF2\u6536\uFF09"),
          $e("#drawer-toggle").setAttribute("aria-pressed", String(!!s)));
      })),
    St.chairs.length &&
      e("chairs-toggle", "\u9910\u6905\uFF08\u5DF2\u6536\u56DE\uFF09", () => {
        let s = Dn.chairs ? 0 : 1;
        (ns({ chairs: s }), zc());
      }),
    St.storage.length &&
      e("storage-toggle", "收纳柜门（已关）", () => {
        let s = Dn.storage ? 0 : 1;
        (ns({ storage: s }),
          ($e("#storage-toggle").textContent = s
            ? "收纳柜门（已开）"
            : "收纳柜门（已关）"),
          $e("#storage-toggle").setAttribute("aria-pressed", String(!!s)));
      }),
    St.keg.length &&
      e(
        "keg-toggle",
        "\u7CBE\u917F\u67DC\u95E8\uFF08\u5DF2\u5173\uFF09",
        () => {
          let s = Dn.keg ? 0 : 1;
          (ns({ keg: s }),
            ($e("#keg-toggle").textContent = s
              ? "\u7CBE\u917F\u67DC\u95E8\uFF08\u5DF2\u5F00\uFF09"
              : "\u7CBE\u917F\u67DC\u95E8\uFF08\u5DF2\u5173\uFF09"),
            $e("#keg-toggle").setAttribute("aria-pressed", String(!!s)));
        },
      ));
  const modes = document.createElement("select");
  modes.id="living-mode";modes.setAttribute("aria-label","客厅生活场景");
  for(const [value,label] of [["relax","客厅 · 游戏休闲"],["dining","客厅 · 双人用餐"],["activity","客厅 · 开放活动"]]) {
    const option=document.createElement("option");option.value=value;option.textContent=label;modes.append(option);
  }
  modes.onchange=()=>setLivingMode(modes.value);i.append(modes);
  e("dining-toggle", "展开餐桌", () => {
    const open = !Dn.dining;
    setLivingMode(open ? "dining" : "relax");
    $e("#dining-toggle").textContent = open ? "收起餐桌" : "展开餐桌";
  });
  e("dishwasher-toggle", "打开洗碗机", () => {
    const open = !Dn.dishwasher;
    ns({ dishwasher: open ? 1 : 0 });
    $e("#dishwasher-toggle").textContent = open ? "收起洗碗机" : "打开洗碗机";
  });
  e("sofa-toggle", "拆分 / 拼合沙发", () => ns({ sofa: Dn.sofa ? 0 : 1, dining:0, activity:0 }));
  e("tv-toggle", "电视换位", () => setTVAlternative(!Dn.tv));
  e("laundry-toggle", "打开洗烘舱门", () =>
    ns({ laundry: Dn.laundry ? 0 : 1 }),
  );
  let n = ut.detailCameras || [];
  if (n.length) {
    let s = $e("#detail-controls");
    for (let r of n) {
      let a = document.createElement("button");
      ((a.textContent = r.label),
        (a.dataset.detail = r.id),
        (a.onclick = () => gw(r)),
        s.append(a));
    }
  }
}
var ghostWalk = null,
  walkCollision = null,
  lastWalkFrame = 0,
  lastWalkLightFocus = null,
  walkReturnView = null;
function pw() {
  if (ghostWalk) return ghostWalk.getTarget();
  return $n ? $n.getTarget() : Nt?.target || new P();
}
function Mx() {
  gpuFinish?.setCamera(ct);
  vi &&
    ((zp.camera = ct),
    (Oc.camera = ct),
    (Oc.gtaoMaterial.defines.PERSPECTIVE_CAMERA = ct.isPerspectiveCamera
      ? 1
      : 0),
    (Oc.gtaoMaterial.needsUpdate = !0));
}
function wx() {
  ghostWalk?.dispose();
  ghostWalk = null;
  document.body.classList.remove("ghost-mode");
  kn?.setAttribute("aria-label", "住宅三维空间，拖动旋转，双指或滚轮缩放");
  _r?.setObserver?.(null);
  (Nt?.dispose(), $n?.dispose(), (Nt = null), ($n = null));
}
function updateActionVisibility() {
  const rooms = {
    "sofa-toggle": ["living"],
    "tv-toggle": ["living"],
    "entry-toggle": ["hall"],
    "gate-toggle": ["all", "bar", "hall"],
    "kitchen-toggle": ["kitchen"],
    "fridge-toggle": ["kitchen","hall"],
    "drawer-toggle": ["kitchen"],
    "dishwasher-toggle": ["kitchen"],
    "chairs-toggle": ["master"],
    "dining-toggle": ["all", "living"],
    "living-mode": ["all", "living"],
    "keg-toggle": ["bar"],
    "laundry-toggle": ["balcony"],
    "storage-toggle": [
      "all",
      "bar",
      "kitchen",
      "living",
      "master",
      "guest",
      "bath",
      "hall",
      "balcony",
    ],
    "cinema-door-toggle": ["guest"],
    "bed-state": ["all", "guest"],
  };
  for (const [id, visibleRooms] of Object.entries(rooms)) {
    const node = $e(`#${id}`);
    if (node) node.hidden = !visibleRooms.includes(Wt);
  }
  for (const id of [
    "scenario-run",
    "scenario-stop",
    "scenario-status",
    "atmosphere-toggle",
    "physics-drop",
    "cinema-door-review",
  ])
    if ($e(`#${id}`)) $e("#internal-controls").append($e(`#${id}`));
}
function mw() {
  let container = $e("#viewpoint-controls");
  container.replaceChildren();
  const views = ut.presentation.interiorViews.filter(
    (view) => view.roomId === Wt,
  );
  const select = document.createElement("select");
  select.id = "viewpoint-select";
  select.setAttribute("aria-label", "选择观察角度");
  for (const view of views) {
    const option = document.createElement("option");
    option.value = view.id;
    option.textContent = view.label;
    option.selected = view.id === vr;
    select.append(option);
  }
  select.onchange = () => {
    const view = views.find((v) => v.id === select.value);
    if (view) Ka(view);
    Hp?.closePanel();
  };
  container.append(select);
  container.hidden = Wt === "all";
  updateActionVisibility();
}
function Ax() {
  ($e(".room-tabs")
    .querySelectorAll("button")
    .forEach((i) => {
      (i.classList.toggle("active", i.dataset.view === Wt),
        i.setAttribute("aria-pressed", String(i.dataset.view === Wt)));
    }),
    ($e("#detail-controls").hidden = !0),
    ($e("#projection").textContent = Ln
      ? "\u7A7A\u95F4\u900F\u89C6"
      : "\u4FEF\u89C6"),
    mw());
}
function toggleNearbyCabinet(id) {
  const from = localStorageProgress.get(id) ?? an.storage,
    to = from > 0.5 ? 0 : 1,
    start = performance.now();
  xu.set("cabinet:" + id, (now) => {
    const p = Math.max(0, Math.min(1, (now - start) / 450));
    localStorageProgress.set(id, from + (to - from) * p * p * (3 - 2 * p));
    bx();
    return p < 1;
  });
  Jt?.request({ shadow: true });
}
const localRoomDoors = new Map();
function setWalkDoorOpen(id, open) {
  if (id === "guest-door") {
    roomAtmosphere.setDoorOpen(open);
    Jt?.request({ shadow: true });
    return;
  }
  if (id === "entry-door" || id === "kitchen-door") {
    ns({ [id === "entry-door" ? "entry" : "kitchen"]: open ? 1 : 0 });
    return;
  }
  const opening = ut.openings.find((o) => o.id === id && o.type === "door");
  const group = Ct.getObjectByName("opening:" + id);
  if (!opening || !group) return;
  const from = group.rotation.y;
  const to = -Kn.degToRad(opening.rotation || 0) - Kn.degToRad(opening.openAngle || 0) * Number(open);
  const start = performance.now();
  localRoomDoors.set(id, open);
  xu.set("walk-door:" + id, (now) => {
    const t = Kn.clamp((now - start) / 550, 0, 1);
    group.rotation.y = from + (to - from) * t * t * (3 - 2 * t);
    return t < 1;
  });
  Jt?.request({ shadow: true });
}
function walkTargets() {
  const targets = [],
    add = (id, label, position, activate, normal) => {
      if (
        normal &&
        (ct.position.x - position[0]) * normal[0] +
          (ct.position.z - position[2]) * normal[1] <
          -0.05
      )
        return;
      targets.push({ id, label, position, activate });
    };
  const point = (id, y) => {
    const group = Ct.getObjectByName(id);
    return group ? group.getWorldPosition(new P()).setY(y).toArray() : null;
  };
  const toggle = (id, label, objectId, y, key, normal) => {
    const p = point(objectId, y);
    if (p) add(id, label, p, () => ns({ [key]: Dn[key] ? 0 : 1 }), normal);
  };
  toggle(
    "walk-fridge",
    "开合冰箱门",
    "kitchen-fridge",
    1.15,
    "fridge",
    [1, 0],
  );
  toggle("walk-drinks-fridge","开合饮料冰箱","guest-drinks-fridge",0.7,"miniFridge",[0,1]);
  toggle("walk-shower","开合淋浴门","shower",1.1,"shower");
  toggle("walk-folding-shelf","展开 / 收起叠衣板","laundry-folding-shelf",0.95,"foldingShelf",[0,-1]);
  toggle(
    "walk-dishwasher",
    "开合洗碗机",
    "kitchen-dishwasher",
    0.62,
    "dishwasher",
    [0, 1],
  );
  toggle("walk-laundry", "开合洗烘机门", "washer", 0.65, "laundry", [0, 1]);
  toggle("walk-keg", "开合精酿柜", "kegerator", 0.65, "keg", [0, -1]);
  toggle("walk-sofa", "拼合 / 拆分沙发", "living-sofa", 0.65, "sofa");
  const table = point("dining-table", 0.85);
  if (table)
    add("walk-table", "展开 / 收起餐桌", table, () =>
      setLivingMode(Dn.dining ? "relax" : "dining"),
    );
  const hatch = ut.homeDesign.hatch;
  add(
    "walk-hatch",
    "拉出 / 收回台面",
    [hatch.centerX ?? ut.objects.find((o) => o.id === "s02-entry-return").x, hatch.worktopTopM ?? 0.88, hatch.drawerFrontZ ?? hatch.hinge?.z ?? 7.425],
    () => ns({ gate: Dn.gate ? 0 : 1 }),
  );
  const bed = point("guest-sofa-bed", 0.65);
  if (bed) add("walk-bed", "展开 / 收起客床", bed, () => vx(!Vp));
  const tv = point("living-tv", 1.265);
  if (tv)
    add(
      "walk-tv",
      "开关电视",
      tv,
      () => roomAtmosphere.toggleScreen("living"),
      [0, -1],
    );
  const kitchen = ut.openings.find((o) => o.id === "kitchen-door");
  if (kitchen)
    add(
      "walk-kitchen-door",
      "开合厨房门",
      [kitchen.center[0], 1.15, kitchen.center[1]],
      () => ns({ kitchen: Dn.kitchen ? 0 : 1 }),
    );
  const door = ut.openings.find((o) => o.id === "guest-door");
  if (door)
    add(
      "walk-guest-door",
      "开合影音室门",
      [door.center[0], 1.15, door.center[1]],
      () => {
        roomAtmosphere.setDoorOpen(!roomAtmosphere.getState().doorOpen);
        Jt?.request({ shadow: true });
      },
    );
  for (const [id, label] of [["master-door", "主卧门"], ["bath-door", "卫浴门"], ["entry-door", "入户门"]]) {
    const opening = ut.openings.find((o) => o.id === id);
    if (!opening) continue;
    add("walk-" + id, "开合" + label, [opening.center[0], 1.15, opening.center[1]], () =>
      setWalkDoorOpen(id, id === "entry-door" ? !Dn.entry : !(localRoomDoors.get(id) ?? true)),
    );
  }
  for (const unit of currentStorage()) {
    const a = Kn.degToRad(unit.rotation || 0),
      normal = [Math.sin(a), -Math.cos(a)];
    add(
      "walk-storage:" + unit.id,
      "开合收纳柜",
      [
        unit.x + normal[0] * (unit.d / 2 + 0.02),
        Math.min(1.75, unit.y + 0.25),
        unit.z + normal[1] * (unit.d / 2 + 0.02),
      ],
      () => toggleNearbyCabinet(unit.id),
      normal,
    );
  }
  const walls = Gp.filter((node) => node.userData.kind === "wall");
  const ray = new yi.Raycaster();
  return targets.filter((target) => {
    const delta = new P(...target.position).sub(ct.position),
      distance = delta.length();
    if (distance > 1.6) return false;
    ray.set(ct.position, delta.normalize());
    ray.far = Math.max(0, distance - 0.03);
    return ray.intersectObjects(walls, true).length === 0;
  });
}
function enterGhostWalk(pose) {
  if (!vu) return;
  const original =
    ut.presentation.interiorViews.find((view) => view.id === vr) ||
    ut.presentation.interiorViews.find((view) => view.roomId === "bar");
  const prior = yr === "interior" ? ct.position.toArray() : [6.9, 1.74, 7.6],
    target = yr === "interior" ? pw().toArray() : [5.15, 1.3, 7.0];
  wx();
  walkReturnView = original;
  yr = "walk";
  Ln = false;
  Wt = "all";
  vr = null;
  wu = "walk";
  ct = new Ut(62, Ui.clientWidth / Ui.clientHeight, 0.045, 100);
  ct.position.fromArray(pose?.position || prior);
  ct.position.y = 1.74;
  ct.lookAt(new P(...(pose?.target || target)));
  ct.updateMatrixWorld(true);
  Mx();
  document.body.classList.add("ghost-mode");
  kn.setAttribute("aria-label", "住宅三维空间，左摇杆行走，右摇杆转头；WASD移动，IJKL转头");
  lastWalkFrame = performance.now();
  lastWalkLightFocus = null;
  Xp({ mode: "all" });
  walkCollision ||= createWalkCollision(ut, Ct);
  const safeStart = walkCollision.move([ct.position.x, ct.position.z], [ct.position.x, ct.position.z]);
  ct.position.x = safeStart[0];
  ct.position.z = safeStart[1];
  ghostWalk = createGhostWalk({
    camera: ct,
    canvas: kn,
    onChange: () => {
      if (
        !lastWalkLightFocus ||
        lastWalkLightFocus.distanceTo(ct.position) > 0.7
      ) {
        _r?.setObserver?.(ct.position.toArray());
        lastWalkLightFocus = ct.position.clone();
        roomRadiance?.setRoom(observerRoom(ut.rooms,ct.position.toArray(),"all"));
        syncDiffuseRoom(observerRoom(ut.rooms,ct.position.toArray(),"all"));
        Jt?.request({ shadow: true });
      }
      Oi();
    },
    onMotion: (active) => (active ? Jt?.begin() : Jt?.end()),
    getTargets: walkTargets,
    resolveMove: (from, to) => walkCollision.move(from, to),
    onExit: exitGhostWalk,
  });
  Xp({ mode: "all" });
  Hp?.closePanel();
  $e("#view-title").textContent = "自由漫游";
  Ax();
  kn.focus({ preventScroll: true });
  Oi();
}
function exitGhostWalk() {
  if (ghostWalk) Ka(walkReturnView || ut.presentation.interiorViews[0]);
}
function Ka(i) {
  (wx(),
    (yr = "interior"),
    (Ln = !1),
    (Wt = i.roomId),
    (vr = i.id),
    (wu = i.id),
    (Au = !1),
    (ct = new Ut(40, Ui.clientWidth / Ui.clientHeight, 0.045, 100)),
    Mx(),
    ($n = ox({
      THREE: yi,
      camera: ct,
      canvas: kn,
      onChange: Oi,
      onStart: () => Jt?.begin(),
      onEnd: () => Jt?.end(),
    })),
    $n.resize(Ui.clientWidth, Ui.clientHeight),
    $n.setPose(new P(...i.position), new P(...i.target), i.horizontalFov || 72),
    Xp({
      mode: themeMoments.some((m) => m.viewId === i.id) ? "current" : "all",
    }),
    _r?.setObserver?.(i.position),
    roomRadiance?.setRoom(i.roomId),
    syncDiffuseRoom(i.roomId),
    ($e("#view-title").textContent = i.label),
    Ax(),
    Oi());
}
function gw(i) {
  let e = ut.presentation.interiorViews.find((t) => t.id === i.id);
  e && Ka(e);
}
var wu = null,
  vi,
  zp,
  Oc,
  Au = !0;
let cu, hu, Rc, fu, gpuFinish, staticOcclusion;
async function xw() {
  if (rendering.backend === "WebGPU" && quality.postprocessing) {
    const {createGPUFinish} = await import("./gpu-effects");
    gpuFinish = createGPUFinish(Ht,Ct,ct);
    return;
  }
  if (rendering.backend !== "WebGL2" || !quality.postprocessing) return;
  matchMedia("(max-width: 1000px), (pointer: coarse)").matches ||
    ((vi = new cu(Ht)),
    vi.setPixelRatio(Ht.getPixelRatio()),
    (vi.renderTarget1.samples = 4),
    (vi.renderTarget2.samples = 4),
    (zp = new hu(Ct, ct)),
    (Oc = new Rc(Ct, ct, Ui.clientWidth, Ui.clientHeight, void 0, {
      radius: 0.12,
      thickness: 0.08,
      scale: 0.55,
      samples: 12,
    })),
    vi.addPass(zp),
    vi.addPass(Oc),
    vi.addPass(new fu()));
}
function qp() {
  if (!Ht) return;
  let i = Ui.clientWidth,
    e = Ui.clientHeight;
  if (ghostWalk) ghostWalk.resize(i, e);
  if ((Ht.setSize(i, e, !1), vi?.setSize(i, e), $n)) $n.resize(i, e);
  else {
    if (((ct.aspect = i / e), ct.isOrthographicCamera)) {
      let t = ct.userData.span || 12;
      ((ct.left = (-t * i) / e / 2),
        (ct.right = (t * i) / e / 2),
        (ct.top = t / 2),
        (ct.bottom = -t / 2));
    }
    ct.updateProjectionMatrix();
  }
  Oi();
}
function ja(i) {
  if (!Ht) return;
  if (i === "all") {
    ((Wt = "all"), Ja(!1));
    return;
  }
  let e =
    ut.presentation.interiorViews.find((t) => t.id === i + "-main") ||
    ut.presentation.interiorViews.find((t) => t.roomId === i);
  e && Ka(e);
}
function Ja(i = !1) {
  (wx(),
    (yr = "overview"),
    (Ln = i),
    (wu = null),
    (vr = null),
    (Au = !0),
    (ct = Ln ? new jn(-10, 10, 8, -8, 0.1, 100) : new Ut(40, 1, 0.1, 120)),
    Mx(),
    (Nt = new Mc(ct, kn)),
    Tx());
  let e = Wt,
    t = ut.cameras.find((l) => l.id === e) || ut.cameras[0],
    n =
      e === "all"
        ? [
            ...ut.shell,
            ...(ut.homeDesign?.bayWindows || []).flatMap((b) => {
              const opening = ut.openings.find((o) => o.id === b.windowId);
              const c = b.center || opening.center;
              const dir = b.outward?.[0] || (b.roomId === "guest" ? -1 : 1);
              return [
                [c[0] + dir * b.projectionM, c[1] - b.widthM / 2],
                [c[0] + dir * b.projectionM, c[1] + b.widthM / 2],
              ];
            }),
          ]
        : e === "bar"
          ? [
              [0, 5.2],
              [5.7, 5.2],
              [5.7, 8.45],
              [0, 8.45],
            ]
          : yx.find((l) => l.id === e)?.polygon || ut.shell,
    s = new Ft().setFromPoints(
      n.flatMap(([l, c]) => [new P(l, 0, c), new P(l, 2.7, c)]),
    ),
    r = s.getCenter(new P());
  Nt.target.copy(r);
  let a = Ln
    ? new P(0, 1, 0.001)
    : new P(
        Math.sin(t.azimuth) * 0.67,
        0.9,
        Math.cos(t.azimuth) * 0.67,
      ).normalize();
  (ct.position.copy(r).addScaledVector(a, 20),
    ct.lookAt(r),
    ct.updateMatrixWorld());
  let o = Ui.clientWidth / Ui.clientHeight;
  if (Ln) {
    let l = Math.max(s.getSize(new P()).z, s.getSize(new P()).x / o) * 1.13;
    ct.userData.span = l;
  } else {
    let l = Math.tan(Kn.degToRad(20)),
      c = 0;
    for (let h of [s.min.x, s.max.x])
      for (let u of [s.min.y, s.max.y])
        for (let d of [s.min.z, s.max.z]) {
          let f = new P(h, u, d).applyMatrix4(ct.matrixWorldInverse);
          c = Math.max(
            c,
            20 +
              f.z +
              Math.max(Math.abs(f.y) / l, Math.abs(f.x) / (l * o)) * 1.12,
          );
        }
    ct.position.copy(r).addScaledVector(a, c);
  }
  (Nt.update(),
    Xp({ mode: "all" }),
    ($e("#view-title").textContent =
      (JM[Wt]?.[0] || "\u5168\u5C4B") +
      (Ln ? " \xB7 \u4FEF\u89C6" : " \xB7 \u5B8C\u6574\u5899\u4F53")),
    qp(),
    Ax(),
    Oi());
}
function _w() {
  Ja(yr === "interior" ? !0 : !Ln);
}
function Tx() {
  ((Nt.enableDamping = !0),
    (Nt.dampingFactor = 0.08),
    (Nt.minDistance = 2.8),
    (Nt.maxDistance = 45),
    (Nt.maxPolarAngle = Ln ? 0 : 1.39),
    (Nt.minPolarAngle = Ln ? 0 : 0.12),
    (Nt.minZoom = 0.6),
    (Nt.maxZoom = 4),
    (Nt.enableRotate = !Ln),
    Nt.addEventListener("change", Oi),
    Nt.addEventListener("start", () => {
      ((Au = !1), (kn.style.cursor = "grabbing"), Jt?.begin());
    }),
    Nt.addEventListener("end", () => {
      ((kn.style.cursor = "grab"), Jt?.end());
    }));
}
function recoverGPU(error) {
  if (kp) return;
  kp = true;
  vu = false;
  wx();
  atmosphere?.resetClock();
  Jt?.pause();
  const url = new URL(location.href);
  url.searchParams.set("renderer", "webgl");
  url.searchParams.set("gpuFallback", "1");
  // A lost device cannot safely reuse its textures or canvas context. Reload once
  // with an explicit WebGL backend; static preview remains the final fallback.
  location.replace(url.href);
}
window.addEventListener("unhandledrejection", event => {
  if (!["webgpu", "auto"].includes(rendering.requested) || !isGPUDeviceLoss(event.reason)) return;
  // Dawn can reject outstanding error-scope promises after the device is lost.
  // Treat those as the same bounded recovery, without hiding validation/network errors.
  event.preventDefault();
  rendering.deviceLossEvents++;
  if (rendering.backend !== "WebGL2") recoverGPU(event.reason);
});
function yw() {
  if (kp) return;
  try {
    Ht.info.reset();
    gpuFinish ? gpuFinish.render() : vi ? vi.render() : Ht.render(Ct, ct);
  } catch (error) {
    if (rendering.backend === "WebGPU") recoverGPU(error);
    else throw error;
  }
}
function Oi() {
  Jt?.request();
}
function Bp() {
  return (
    kp ||
    reflectionPauseDepth > 0 ||
    document.hidden ||
    matchMedia("(max-width:1024px) and (orientation:portrait)").matches
  );
}
let atmosphere, atmospherePromise;
async function enableAtmosphere() {
  if (!atmospherePromise)
    atmospherePromise = import("./atmosphere")
      .then(async (m) => {
        atmosphere = await m.createAtmosphere(Ct, ut, Vn);
        Oi();
        return atmosphere;
      })
      .catch((error) => {
        atmospherePromise = null;
        Su("模拟暂时无法启动，请稍后重试。");
        throw error;
      });
  return atmospherePromise;
}
function vw(i) {
  const walked =
    ghostWalk?.update(
      Math.min(0.05, Math.max(0, (i - lastWalkFrame) / 1000)),
    ) || false;
  lastWalkFrame = i;
  let e = ghostWalk ? walked : $n ? $n.update() : Nt?.update() || !1,
    t = e,
    n = !1,
    s = !1;
  for (let [r, a] of xu) {
    let o = a(i);
    ((t = !0), (n = !0), (s ||= o), o || xu.delete(r));
  }
  const physics = atmosphere?.step(i, Bp(), n);
  return {
    dirty: t || physics?.dirty,
    shadow: n || physics?.shadow,
    active: s || e || physics?.active,
  };
}
async function bw() {
  try {
    const geometryReady = initGeometry(
      `${import.meta.env.BASE_URL}transform.wasm`,
      new URLSearchParams(location.search).get("wasm") !== "0",
    );
    Ht = await createRenderer(kn);
    await geometryReady;
    startupStage("renderer");
    kn = Ht.domElement;
    await initAreaLighting(rendering.backend === "WebGPU" ? "webgpu" : "webgl");
    kn.dataset.renderer = rendering.backend;
    kn.dataset.geometryBackend = geometryState().backend;
    Ht.info.autoReset = false;
    if (rendering.backend === "WebGPU") Ht.onDeviceLost = recoverGPU;
    if (rendering.backend === "WebGL2" && quality.postprocessing) {
      ({ cu, hu, Rc, fu } = await import("./postprocessing"));
    }
    (Ht.setPixelRatio(quality.maxDpr),
      (Ht.shadowMap.enabled = !0),
      (Ht.shadowMap.autoUpdate = !1),
      (Ht.shadowMap.type = ws),
      (Ht.localClippingEnabled = !0),
      (Ht.toneMapping = Ts),
      (Ht.outputColorSpace = on),
      (Ct = new Xi()),
      (Ct.background = new ve("#e4e0d7")),
      (exteriorWorld = createExteriorWorld(Ct, quality)),
      (ct = new Ut(40, 1, 0.1, 120)),
      (Nt = new Mc(ct, kn)),
      await ew(),
      ow(),
      lw(),
      lifeMotion.fridges.filter(f=>f.id === "kitchen-fridge").forEach(f=>St.fridge.push({
        object:ut.objects.find(o=>o.id===f.id),pivot:f.leaves[0].pivot,drawer:f.drawer,
        lifeManaged:true,drawerClosedZ:f.drawerBase,hinge:1,max:Kn.degToRad(100),travel:0.48,
      })),
      hx({
        THREE: yi,
        scene: Ct,
        model: ut,
        mesh: re,
        tag: Mu,
        materials: Vn,
      }),
      finishFurniture(Ct, ut.objects, Vn),
      (roomAtmosphere = buildInteriorDetails(Ct, Vn, Mu, true, ut)),
      (spatialDesign = buildHomeArchitecture(Ct, ut, Vn, Mu, homeMotion)),
      (staticOcclusion = bakeStaticFloorOcclusion(Ct,ut,{size:quality.mobile?256:512})),
      homeMotion.sofaModules.forEach(root => attachDynamicContact(root, {w:0.98,d:0.86,y:0.003,strength:0.16})),
      attachDynamicContact(Ct.getObjectByName("living-tv"), {w:0.7,d:0.5,y:0.003,strength:0.12}),
      St.gate.push({
        group: homeMotion.hatch.group,
        axis: "x",
        base: 0,
        angle: 0,
      }),
      (xx = ax({ THREE: yi, scene: Ct, model: ut })),
      (roomBatching = batchFurniture(Ct, ut, Mu)),
      cw(),
      Tx(),
      await xw(),
      (Jt = tx({
        renderer: Ht,
        mobile: Lc,
        render: yw,
        step: vw,
        isSuspended: Bp,
        onQualityChange: ({effectTier} = {}) => {
          vi?.setPixelRatio(Ht.getPixelRatio());
          if (effectTier) {
            gpuFinish?.setEconomy(effectTier);
            if (Oc) Oc.enabled = false;
            _r?.apply(Wp);
          }
        },
      })),
      fw(),
      (an.entry = Dn.entry = 1),
      (an.gate = Dn.gate = 1),
      bx(),
      (Hp = $g({
        model: ut,
        onLighting: Fp,
        onVisibility: Xp,
        onFit: () => {
          (qp(),
            vu && Au && yr === "overview" && Ja(Ln),
            Bp() ? (atmosphere?.resetClock(), Jt?.pause()) : Jt?.resume());
        },
        getActive: () => Wt,
      })),
      Fp("day-public"),
      Ka(
        ut.presentation.interiorViews.find(
          (i) => i.id === ut.presentation.defaultView,
        ),
      ),
      zc(),
      (vu = !0),
      enterGhostWalk(),
      Jt.pause());
    startupStage("model");
    // Compile the actual entrance camera before exposing controls. WebGPU can
    // prepare independent material pipelines asynchronously instead of blocking
    // the first visible frame with synchronous shader compilation.
    $e("#loading-status").textContent = "准备光影与材质";
    diffuseBounce = await createDiffuseBounce({renderer:Ht,scene:Ct,model:ut,backend:rendering.backend==="WebGPU"?"webgpu":"webgl"});
    await loadDiffuseVariant(_u, false);
    bathMirror = await createBathMirror({scene:Ct,renderer:Ht,model:ut,materials:Vn,mobile:quality.mobile,backend:rendering.backend==="WebGPU"?"webgpu":"webgl"});
    if (gpuFinish) await gpuStartupDeadline(gpuFinish.compile(), 20000);
    else if (rendering.backend === "WebGPU") await gpuStartupDeadline(Ht.compileAsync(Ct, ct), 20000);
    else await Ht.compileAsync(Ct, ct);
    startupStage("compiled");
    (
      (kn.dataset.wasmVertices = String(geometryState().transformedVertices)),
      $e("#loading").classList.add("done"),
      $e("#loading").setAttribute("aria-hidden", "true"),
      (kn.style.cursor = "grab"),
      Jt.request({ shadow: !0 }),
      Jt.resume());
    startupStage("interactive");
    // Full-resolution images hydrate existing textures; they never block entry.
    // Capture reflections only after those images and the first visible frame,
    // so neither placeholder materials nor startup PMREM work are cached/shown.
    visualEnhancementsReady = (async () => {
      await whenMaterialTexturesReady();
      startupStage("textures");
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      roomRadiance = await createRoomRadiance({renderer:Ht,scene:Ct,model:ut,materials:Vn,mobile:quality.mobile,environmentGenerator,
        withRenderPaused: async work => { reflectionPauseDepth++; Jt.pause(); try { return await work(); } finally { reflectionPauseDepth--; if(!reflectionPauseDepth) { Jt.resume(); Jt.request({shadow:true}); } } }
      });
      await roomRadiance.refresh(_u);
      roomRadiance.setRoom(ghostWalk ? observerRoom(ut.rooms,ct.position.toArray(),"hall") : Wt);
      await roomRadiance.whenReady();
      startupStage("complete");
      Oi();
    })();
    visualEnhancementsReady.catch(error => {
      startupTiming.enhancementError = String(error);
      if (isGPUDeviceLoss(error) && rendering.backend === "WebGPU") recoverGPU(error);
      else console.warn("Local reflection preparation unavailable", error);
    });
  } catch (i) {
    if (rendering.backend === "WebGPU") { recoverGPU(i); return; }
    (vu = false,
      wx(),
      Jt?.pause(),
      console.error(i),
      ($e("#control-panel").hidden = !0),
      ($e("#panel-toggle").hidden = !0),
      ($e("#view-title").textContent = "\u5168\u5C4B\u9759\u6001\u9884\u89C8"),
      (kn.hidden = !0));
    let e = $e("#fallback");
    ((e.hidden = !1),
      (e.src = jM),
      $e("#loading").classList.add("done"),
      Su(
        "\u6B64\u8BBE\u5907\u6682\u4E0D\u652F\u6301\u4E09\u7EF4\u663E\u793A\uFF0C\u5DF2\u5207\u6362\u4E3A\u7A7A\u95F4\u9884\u89C8\u3002",
      ));
  }
}
await bw();
if (vu) {
  showWelcome();
}
if (vu)
  mountMomentControls(
    (id) => Fp(id),
    () => {
      roomAtmosphere.setDoorOpen(!roomAtmosphere.getState().doorOpen);
      Jt?.request({ shadow: true });
    },
    () => {},
  );
if (vu)
  mountStoragePanel(
    (id) => {
      const view = ut.presentation.interiorViews.find((v) => v.id === id);
      if (view) {
        Ka(view);
        Hp?.closePanel();
      }
    },
    () => $e("#storage-toggle")?.click(),
    currentStorage(),
  );
if (vu) {
  const windButton = document.createElement("button");
  windButton.textContent = "微风与水波";
  windButton.type = "button";
  windButton.setAttribute("aria-pressed", "false");
  windButton.id = "atmosphere-toggle";
  windButton.onclick = async () => {
    windButton.disabled = true;
    try {
      const physics = await enableAtmosphere();
      const enabled = !physics.getState().wind;
      physics.setWind(enabled);
      windButton.setAttribute("aria-pressed", String(enabled));
      Oi();
    } catch {
    } finally {
      windButton.disabled = false;
    }
  };
  const dropButton = document.createElement("button");
  dropButton.textContent = "碰撞演示";
  dropButton.type = "button";
  dropButton.id = "physics-drop";
  dropButton.onclick = async () => {
    dropButton.disabled = true;
    try {
      const physics = await enableAtmosphere();
      const camera = ct.position.clone(),
        direction = new P();
      ct.getWorldDirection(direction);
      const location = camera.addScaledVector(direction, 0.7);
      location.y = Math.min(2.35, Math.max(1.2, location.y));
      physics.drop(location);
      Oi();
    } catch {
    } finally {
      dropButton.disabled = false;
    }
  };
  $e("#internal-controls").append(windButton, dropButton);
  updateActionVisibility();
}
$e("#walk-start").onclick = () => enterGhostWalk();
$e("#interior-view").onclick = () => ja(Wt === "all" ? "bar" : Wt);
$e("#overview-view").onclick = () => {
  ((Wt = "all"), Ja(!1));
};
$e("#lighting").onclick = () => Fp(_u ? "day-public" : "aperitif");
$e("#bed-state").onclick = () => {
  (vx(!Vp), Wt !== "guest" && ja("guest"));
};
$e("#projection").onclick = _w;
$e("#reset").onclick = () => {
  if (ghostWalk) {
    const entry = ut.presentation.interiorViews.find((v) => v.id === ut.presentation.defaultView);
    enterGhostWalk({ position: entry.position, target: entry.target });
    return;
  }
  let i = ut.presentation.interiorViews.find((e) => e.id === vr);
  i ? Ka(i) : Ja(Ln);
};
$e("#export").onclick = () => {
  let i = Jt.capture(() => kn.toDataURL("image/png")),
    e = Uint8Array.from(atob(i.split(",")[1]), (s) => s.charCodeAt(0)),
    t = URL.createObjectURL(new Blob([e], { type: "image/png" })),
    n = document.createElement("a");
  ((n.href = t),
    (n.download = `MuKo-Home-${wu || Wt}-${Wp}.png`),
    (n.hidden = !0),
    document.body.append(n),
    n.click(),
    n.remove(),
    setTimeout(() => URL.revokeObjectURL(t), 3e4),
    Su(
      "\u753B\u9762\u5DF2\u51C6\u5907\uFF0C\u8BF7\u67E5\u770B\u6D4F\u89C8\u5668\u4E0B\u8F7D\u3002",
    ));
};
kn.addEventListener("keydown", (i) => {
  (!Nt && !$n) ||
    (i.key === "Home" &&
      (vr ? Ka(ut.presentation.interiorViews.find((e) => e.id === vr)) : ja(Wt),
      i.preventDefault()),
    ["+", "=", "-"].includes(i.key) &&
      Nt &&
      (ct.isOrthographicCamera
        ? ((ct.zoom = Kn.clamp(
            ct.zoom * (i.key === "-" ? 0.88 : 1.12),
            0.6,
            4,
          )),
          ct.updateProjectionMatrix())
        : ct.position
            .sub(Nt.target)
            .multiplyScalar(i.key === "-" ? 1.12 : 0.88)
            .add(Nt.target),
      Nt?.update(),
      Oi(),
      i.preventDefault()));
});
kn.addEventListener("webglcontextlost", (i) => {
  (i.preventDefault(),
    (kp = !0),
    (atmosphere?.resetClock(), Jt?.pause()),
    Su(
      "\u4E09\u7EF4\u663E\u793A\u6682\u65F6\u6682\u505C\uFF0C\u6B63\u5728\u7B49\u5F85\u6062\u590D\u3002",
    ));
});
kn.addEventListener("webglcontextrestored", () => {
  ((kp = !1),
    qp(),
    Jt?.request({ shadow: !0 }),
    Su("\u4E09\u7EF4\u663E\u793A\u5DF2\u6062\u590D\u3002"));
});
document.addEventListener("visibilitychange", () => {
  Bp() ? (atmosphere?.resetClock(), Jt?.pause()) : Jt?.resume();
});
window.homePresentation = {
  whenVisualReady: async () => { await visualEnhancementsReady; await Promise.all([whenMaterialTexturesReady(), roomRadiance?.whenReady(), diffuseReady]); },
  bakeDiffuseRoom: async (roomId) => {
    if (!bakeOnly) throw new Error("Offline bake requires the developer gi-bake URL flag.");
    await visualEnhancementsReady;
    await roomRadiance?.whenReady();
    Jt.pause();
    const service = await createDiffuseBounce({renderer:Ht,scene:Ct,model:ut,backend:rendering.backend==="WebGPU"?"webgpu":"webgl"});
    try { return await service.bakeRoom(roomId); }
    finally { service.dispose(); Jt.resume(); Jt.request({shadow:true}); }
  },
  startGhostWalk: (pose) => enterGhostWalk(pose),
  stopGhostWalk: () => exitGhostWalk(),
  getGhostWalkState: () => ghostWalk?.getState() || { active: false },
  getWalkCollisionAudit: () => walkCollision?.audit || null,
  getWalkNavigationSnapshot: () => walkCollision?.navigationSnapshot() || null,
  setWalkLookTarget: target => ghostWalk?.lookToward(target),
  getAccessoryAudit: () => ({
    plan: ut.homeDesign.accessoryReconciliation,
    nodes: ["ps5", "home:mobile-game-dock", "home:game-controller-left", "home:game-controller-right", "home:mobile-power-pack", "home:daily-console-tray"].map(id => {
      const node = Ct.getObjectByName(id);
      let meshes = 0;
      node?.traverse(child => { if (child.isMesh) meshes++; });
      return { id, present: !!node, parent: node?.parent?.name || null, meshes, position: node?.getWorldPosition(new P()).toArray() || null };
    }),
    retiredPresent: [...ut.homeDesign.accessoryReconciliation.retiredObjects, "living:media-pier", "living:media-crown"].filter(id => !!Ct.getObjectByName(id)),
  }),
  setWalkDoorOpen,
  getWalkDoorStates: () => Object.fromEntries(ut.openings.filter((o) => o.type === "door").map((o) => [o.id, Ct.getObjectByName("opening:" + o.id)?.rotation.y])),
  getModelAudit: () => auditSceneModel(Ct, ut),
  getModel: () => structuredClone(ut),
  getHomeDesign: () => ({
    ...ut.homeDesign,
    motionBounds: homeMotionBounds(homeMotion),
    architecture: spatialDesign,
    daylight: {
      ...daylightStudy,
      roofProxyPresent: !!Ct.getObjectByName("daylight:roof-shadow"),
      transparentShadowCasters: (() => {
        let count = 0;
        Ct.traverse((node) => {
          if (
            node.isMesh &&
            node.castShadow &&
            !Array.isArray(node.material) &&
            node.material?.transparent &&
            node.material.opacity < 0.8
          )
            count++;
        });
        return count;
      })(),
    },
    states: { dining: an.dining, hatch: an.gate, dishwasher: an.dishwasher },
  }),
  setDiningOpen: (open) => {
    setLivingMode(open ? "dining" : "relax");
  },
  setDiningChairRetreat: (pulled) =>
    ns({ dining: 1, diningRetreat: pulled ? 1 : 0, gate: 1, activity:0, sofa:0 }),
  setHatchOpen: (open) => {
    ns({ gate: open ? 1 : 0 });
  },
  setSofaSeparated: (separated) => ns({ sofa: separated ? 1 : 0, activity:0, dining:0 }),
  setLivingMode,
  getLivingMode: () => Dn.activity ? "activity" : Dn.dining ? "dining" : "relax",
  setDrinksFridgeOpen: open => ns({miniFridge:open?1:0}),
  setShowerOpen: open => ns({shower:open?1:0}),
  setFoldingShelfOpen: open => ns({foldingShelf:open?1:0}),
  setMobileTVAlternative: setTVAlternative,
  setLaundryOpen: (open) => {
    ns({ laundry: open ? 1 : 0 });
  },
  setDishwasherOpen: (open) => {
    ns({ dishwasher: open ? 1 : 0 });
  },
  setAtmosphereEnabled: async (enabled) => {
    const physics = await enableAtmosphere();
    physics.setWind(enabled);
    $e("#atmosphere-toggle")?.setAttribute("aria-pressed", String(enabled));
    Oi();
  },
  dropPhysicsBall: async (position) => {
    const physics = await enableAtmosphere();
    physics.drop(new P(...position));
    Oi();
  },
  capturePNG: () => Jt.capture(() => kn.toDataURL("image/png")),
  setLightingScene: (id) => Fp(id),
  setInteriorView: (id) => gw({ id }),
  getSpatialDesign: () => ({
    ...spatialDesign,
    furniture: ut.objects
      .filter((o) =>
        [
          "dining-table",
          "dining-chair-left",
          "dining-chair-right",
          "living-sofa",
          "salon-coffee-table",
          "side-table",
        ].includes(o.id),
      )
      .map((o) => ({
        id: o.id,
        x: o.x,
        z: o.z,
        w: o.w,
        d: o.d,
        h: o.h,
        rotation: o.rotation,
      })),
    routes: ut.presentationScenarios.map((s) => ({
      id: s.id,
      people: s.people,
    })),
  }),
  setCompositionStudy: (enabled) => {
    compositionMaterial ||= new ui({ color: "#bdb6a9", roughness: 0.9 });
    Ct.overrideMaterial = enabled ? compositionMaterial : null;
    Jt?.request({ shadow: true });
  },
  getAtmosphereDesign: () => roomAtmosphere?.getState(),
  getPerformance: () => ({
    ...Jt?.getState(),
    materialDetail: materialDetailState(),
    startup: { ...startupTiming, stages: { ...startupTiming.stages } },
    exterior: exteriorWorld?.audit(),
    roomRadiance: roomRadiance?.audit(),
    diffuseBounce: diffuseBounce?.audit(),
    mirror: bathMirror?.audit(),
    staticOcclusion,
    materials: auditMaterialSet(Vn),
    gpuFinish: gpuFinish?.audit() || {enabled:false,reason:quality.mobile?"mobile_budget":"compatible_direct_renderer"},
    qualityProfile: { ...quality },
    storage: storageCapacity(currentStorage()),
    geometry: geometryState(),
    physics: atmosphere?.getState() ?? { loaded: false },
    rendering: { ...rendering },
    drawCalls: Ht?.info.render.drawCalls ?? Ht?.info.render.calls,
    triangles: Ht?.info.render.triangles,
    geometries: Ht?.info.memory.geometries,
    lightCount: _r?.getState().slotCount || _r?.getState().fixtureCount,
    batching: xx,
    roomBatching,
    architectureBatching: _x,
  }),
  getStorage: () => storageCapacity(currentStorage()),
  setStorageOpen: (open) => {
    ns({ storage: open ? 1 : 0 }, 0);
    $e("#storage-toggle")?.setAttribute("aria-pressed", String(open));
    Oi();
  },
  getStorageDoors: () =>
    St.storage
      .filter((d) => d.unitId)
      .map((d) => ({
        unitId: d.unitId,
        angle: d.pivot.rotation[d.axis || "y"],
      })),
  getState: () => ({
    version: ut.version,
    active: Wt,
    activeDetail: wu,
    viewMode: yr,
    activePoint: vr,
    ceilingVisible: Nc?.visible,
    wallClipping: !1,
    night: _u,
    top: Ln,
    bedOpen: Vp,
    lightScene: Wp,
    visibleRooms: [...Ni],
    lighting: _r?.getState(),
    bedProgress: yu[0]?.progress || 0,
    entryAngle: St.entry[0]?.group.rotation.y || 0,
    gateAngle: homeMotion.hatch?.group.rotation.x || 0,
    hatchProgress: an.gate,
    diningProgress: an.dining,
    diningRetreatProgress: an.diningRetreat,
    dishwasherProgress: an.dishwasher,
    laundryProgress: an.laundry,
    tvProgress: an.tv,
    sofaProgress: an.sofa,
    activityProgress: an.activity,
    drinksFridgeProgress: an.miniFridge,
    showerProgress: an.shower,
    foldingShelfProgress: an.foldingShelf,
    kitchenProgress: an.kitchen,
    fridgeAngle: St.fridge[0]?.pivot.rotation.y || 0,
    drawerProgress: an.drawer,
    scenario: Za,
    ready: vu,
    renderer: vu ? rendering.backend : "unavailable",
    quality: gpuFinish ? "WebGPU PBR + TSL glow" : vi ? "PBR + GTAO" : "PBR",
    objectCount: ut.objects.length,
    glVersion:
      rendering.backend === "WebGL2"
        ? Ht?.getContext().getParameter(Ht.getContext().VERSION)
        : null,
  }),
  getMovingPartTransforms: () => ({
    storage: St.storage.map((i) => i.pivot.rotation[i.axis || "y"]),
    keg: St.keg.map((i) => ({
      angle: i.pivot.rotation.y,
      inside: i.inside.visible,
    })),
    entry: St.entry.map((i) => i.group.rotation.y),
    gate: St.gate.map((i) => i.group.rotation[i.axis || "y"]),
    home: homeMotionBounds(homeMotion),
    kitchen: St.kitchen.map((i) => i.group.position.toArray()),
    fridge: St.fridge.map((i) => ({
      angle: i.pivot.rotation.y,
      drawer: i.drawer.position.toArray(),
    })),
    chairs: St.chairs.map((i) => [i.group.name, i.group.position.toArray()]),
    people: Fc.map((i) => ({
      name: i.g.name,
      visible: i.g.visible,
      position: i.g.position.toArray(),
    })),
  }),
  getArchitecture: () => {
    Ct.updateMatrixWorld(!0);
    let i = [];
    return (
      Ct.traverse((e) => {
        if (e.userData.kind === "wall" || e.userData.kind === "ceiling") {
          let t = new Ft().setFromObject(e);
          i.push({
            name: e.name,
            kind: e.userData.kind,
            visible: e.visible,
            min: t.min.toArray(),
            max: t.max.toArray(),
          });
        }
      }),
      i
    );
  },
  getPreview: (i) => QM[i],
  getObjectFrames: () =>
    ut.objects
      .filter((i) => i.type !== "door_leaf" && !i.rendererHidden)
      .map((i) => {
        let e = Ct?.getObjectByName(i.id);
        return [i.id, e?.position.toArray(), e?.rotation.y];
      }),
  getCamera: () =>
    ct
      ? {
          position: ct.position.toArray(),
          target: pw().toArray(),
          verticalFov: ct.fov,
          aspect: ct.aspect,
        }
      : null,
};
window.homePresentation.getObjectBounds = () => (
  Ct.updateMatrixWorld(!0),
  ut.objects
    .filter((i) => i.type !== "door_leaf" && !i.rendererHidden)
    .map((i) => {
      let e = Ct.getObjectByName(i.id);
      if (!e) return { id: i.id, missing: !0 };
      let t = new Ft().setFromObject(e);
      return {
        id: i.id,
        min: t.min.toArray(),
        max: t.max.toArray(),
        size: t.getSize(new P()).toArray(),
      };
    })
);
