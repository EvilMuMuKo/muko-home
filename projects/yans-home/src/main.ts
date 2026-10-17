import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  createRenderer,
  environmentGenerator,
  rendering,
  type Renderer,
} from "./renderer";
import { quality } from "./quality";
import { initGeometry, geometryState } from "./geometry";
import { model, rooms, roomAt, insideShell, type RoomId } from "./plan";
import { createMaterials, hydrateMaterials, textureStatus } from "./materials";
import { buildHome, type Collider, type Action } from "./meshes";
import { FloatingSticks } from "./controls";

const $ = <T extends HTMLElement = HTMLElement>(q: string) =>
  document.querySelector<T>(q)!;
let renderer: Renderer,
  home: ReturnType<typeof buildHome>,
  sticks: FloatingSticks,
  orbit: OrbitControls;
const scene = new T.Scene();
scene.background = new T.Color("#d3dedc");
const camera = new T.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 80);
let ready = false,
  visualReady: Promise<void> = Promise.resolve(),
  walking = true,
  currentRoom: RoomId = "lift-lobby",
  lighting = "day",
  overview = false;
let yaw = -Math.PI / 2,
  pitch = 0,
  queued = false,
  lastTime = 0,
  renders = 0,
  lastFrameMs = 0,
  dirtyShadow = true,
  animating = false;
const keys = new Set<string>(),
  clockStats = { steps: 0, collisions: 0 },
  playerRadius = 0.26;
const eye = new T.Vector3(2.2, 1.62, 5.65);
camera.position.copy(eye);
const materials = createMaterials();
const ambient = new T.HemisphereLight("#f1eee9", "#9a8e81", 1.05);
scene.add(ambient);
const sun = new T.DirectionalLight("#fff0de", 2.4);
sun.position.set(5, 12, -6);
sun.target.position.set(6, 0, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(quality.sunShadowSize, quality.sunShadowSize);
Object.assign(sun.shadow.camera, {
  left: -10,
  right: 10,
  top: 11,
  bottom: -11,
  near: 0.1,
  far: 45,
});
sun.shadow.normalBias = 0.035;
sun.shadow.bias = -0.0002;
scene.add(sun, sun.target);
let finish: any;
const lightPool: T.SpotLight[] = [];
const lightPositions: Record<string, [number, number, number]> = {
  "lift-lobby": [2.65, 2.58, 4.7],
  entry: [2.5, 2.58, 6],
  dining: [5.75, 2.55, 5.75],
  living: [5.5, 2.58, 9.1],
  guest: [1.45, 2.55, 9.1],
  master: [10, 2.58, 9.1],
  gaming: [8.3, 2.52, 2.7],
  kitchen: [5.5, 2.55, 2.8],
  bath: [9.6, 2.55, 4.4],
  ensuite: [10, 2.55, 6.2],
  balcony: [5.3, 2.55, 11.7],
  utility: [5.3, 2.5, 0.8],
};
function allocateLights() {
  const center = lightPositions[currentRoom];
  const ids = [
    currentRoom,
    ...Object.keys(lightPositions)
      .filter((id) => id !== currentRoom)
      .sort((a, b) => {
        const pa = lightPositions[a],
          pb = lightPositions[b];
        return (
          Math.hypot(pa[0] - center[0], pa[2] - center[2]) -
          Math.hypot(pb[0] - center[0], pb[2] - center[2])
        );
      }),
  ].slice(0, quality.lightSlots);
  lightPool.forEach((light, i) => {
    const id = ids[i],
      p = lightPositions[id];
    light.position.set(...p);
    light.target.position.set(p[0], 0, p[2]);
    light.color.set(id === "gaming" ? "#f0e7da" : "#ffe4c2");
    light.intensity = lighting === "day" ? 8 : lighting === "quiet" ? 7 : 15;
    light.shadow.needsUpdate = true;
  });
  dirtyShadow = true;
}
function schedule(shadow = false) {
  dirtyShadow ||= shadow;
  if (!ready || queued || document.hidden) return;
  queued = true;
  requestAnimationFrame(frame);
}
function pose(
  x: number,
  y: number,
  z: number,
  tx: number,
  ty: number,
  tz: number,
) {
  camera.position.set(x, y, z);
  const d = new T.Vector3(tx - x, ty - y, tz - z).normalize();
  yaw = Math.atan2(-d.x, -d.z);
  pitch = Math.asin(d.y);
  camera.rotation.set(pitch, yaw, 0, "YXZ");
}
function setWalking(on: boolean) {
  walking = on;
  overview = false;
  home.setOverview(false);
  orbit.enabled = !on;
  sticks?.clear();
  keys.clear();
  $("#leave-walk").hidden = !on;
  $("#walk-hint").hidden = !on;
  if (on) {
    eye.copy(camera.position);
    eye.y = 1.62;
    camera.position.copy(eye);
    pitch = Math.max(-0.5, Math.min(0.5, pitch));
  }
  schedule(true);
}
function setRoom(id: RoomId) {
  const room = rooms.find((r) => r.id === id);
  if (!room) return;
  currentRoom = id;
  camera.fov = 72;
  camera.updateProjectionMatrix();
  setWalking(false);
  pose(...room.camera, ...room.target);
  orbit.target.set(...room.target);
  $("#location").textContent = room.name;
  allocateLights();
  updateActions();
  markRoom();
  closePanel();
  schedule(true);
}
function setOverview() {
  walking = false;
  overview = true;
  sticks.clear();
  keys.clear();
  home.setOverview(true);
  orbit.enabled = true;
  camera.fov = 45;
  camera.updateProjectionMatrix();
  camera.position.set(15, 14, 17);
  orbit.target.set(6, 0, 6.5);
  camera.lookAt(orbit.target);
  $("#location").textContent = "全屋概览";
  $("#leave-walk").hidden = true;
  $("#walk-hint").hidden = true;
  $("#interaction").hidden = true;
  closePanel();
  schedule(true);
}
function enterWalk() {
  const r = rooms.find((r) => r.id === currentRoom)!;
  pose(r.spawn[0], 1.62, r.spawn[1], ...r.target);
  setWalking(true);
  closePanel();
  toast("左半屏移动，右半屏转向；松手即停。");
}
function markRoom() {
  document
    .querySelectorAll("[data-room]")
    .forEach((el) =>
      el.classList.toggle(
        "selected",
        (el as HTMLElement).dataset.room === currentRoom,
      ),
    );
}
function setLight(mode: string) {
  lighting = mode;
  const day = mode === "day";
  scene.background = new T.Color(day ? "#d3dedc" : "#172529");
  ambient.intensity = day ? 1.05 : mode === "quiet" ? 0.18 : 0.28;
  scene.environmentIntensity = day ? 0.36 : mode === "quiet" ? 0.09 : 0.14;
  sun.intensity = day ? 2.4 : 0.035;
  materials.glow.emissiveIntensity = day ? 0.8 : 1.6;
  materials.coveWash.emissiveIntensity = day ? 0.28 : 0.72;
  materials.paper.emissiveIntensity = day ? 0.1 : 0.38;
  materials.screen.emissiveIntensity = day ? 0.24 : 0.55;
  finish?.setNight(mode !== "day");
  allocateLights();
  document
    .querySelectorAll("[data-light]")
    .forEach((el) =>
      el.classList.toggle(
        "selected",
        (el as HTMLElement).dataset.light === mode,
      ),
    );
  schedule(true);
}
function toast(message: string) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 2400);
}
function closePanel() {
  $("#panel").hidden = true;
  $("#panel-toggle").setAttribute("aria-expanded", "false");
}
function toggle(a: Action) {
  a.target = a.target > 0.5 ? 0 : 1;
  animating = true;
  schedule(true);
  updateActions();
}
function updateActions() {
  if (!home) return;
  const container = $("#action-list");
  container.replaceChildren();
  const list = home.actions.filter(
    (a) =>
      a.room === currentRoom ||
      (a.kind === "door" && a.at.distanceTo(camera.position) < 3),
  );
  for (const a of list) {
    const b = document.createElement("button");
    b.textContent = `${a.target > 0.5 ? "收起 / 关闭" : "展开 / 打开"} · ${a.name}`;
    b.onclick = () => toggle(a);
    container.append(b);
  }
  if (!list.length) container.textContent = "这个空间没有需要展开的家具。";
}
function refreshDynamic() {
  for (const c of home.colliders)
    if (c.dynamic) {
      c.dynamic.updateWorldMatrix(true, false);
      const b = new T.Box3().setFromObject(c.dynamic);
      c.min.copy(b.min);
      c.max.copy(b.max);
    }
}
function clearAt(x: number, z: number) {
  if (
    !insideShell(x, z) ||
    !insideShell(x - playerRadius, z) ||
    !insideShell(x + playerRadius, z) ||
    !insideShell(x, z - playerRadius) ||
    !insideShell(x, z + playerRadius)
  )
    return false;
  for (const c of home.colliders) {
    if (c.max.y < 0.24 || c.min.y > 1.75) continue;
    const dx = Math.max(c.min.x - x, 0, x - c.max.x),
      dz = Math.max(c.min.z - z, 0, z - c.max.z);
    if (Math.hypot(dx, dz) < playerRadius - 0.002) return false;
  }
  return true;
}
function movePlayer(dx: number, dz: number) {
  const length = Math.hypot(dx, dz),
    steps = Math.max(1, Math.ceil(length / 0.06));
  for (let i = 0; i < steps; i++) {
    const x = eye.x + dx / steps,
      z = eye.z + dz / steps;
    if (clearAt(x, eye.z)) eye.x = x;
    else clockStats.collisions++;
    if (clearAt(eye.x, z)) eye.z = z;
    else clockStats.collisions++;
  }
  camera.position.copy(eye);
}
let activeAction: Action | undefined,
  lastInteraction = 0;
function nearby(now: number) {
  if (now - lastInteraction < 100) return;
  lastInteraction = now;
  if (!walking) {
    $("#interaction").hidden = true;
    return;
  }
  const direction = new T.Vector3();
  camera.getWorldDirection(direction);
  let score = Infinity;
  activeAction = undefined;
  for (const a of home.actions) {
    const vector = a.at.clone().sub(camera.position),
      distance = vector.length();
    if (distance > 2.1) continue;
    const dot = direction.dot(vector.normalize());
    if (dot < 0.4) continue;
    const value = distance + (1 - dot);
    if (value < score) {
      score = value;
      activeAction = a;
    }
  }
  $("#interaction").hidden = !activeAction;
  if (activeAction)
    $("#interaction").textContent =
      `${activeAction.target > 0.5 ? "关闭" : "打开"} · ${activeAction.name}`;
}
function frame(now: number) {
  queued = false;
  if (document.hidden) return;
  if (lastTime && now - lastTime < quality.targetFrameMs - 1) {
    schedule();
    return;
  }
  const dt = Math.min(0.06, lastTime ? (now - lastTime) / 1000 : 1 / 30);
  lastFrameMs = now - lastTime;
  lastTime = now;
  let again = false,
    changed = false;
  for (const a of home.actions)
    if (Math.abs(a.target - a.value) > 0.001) {
      a.value = T.MathUtils.damp(a.value, a.target, 8, dt);
      if (Math.abs(a.target - a.value) < 0.003) a.value = a.target;
      a.apply(a.value);
      again = true;
      changed = true;
      dirtyShadow = true;
    }
  animating = again;
  if (changed) refreshDynamic();
  if (walking) {
    const side =
      (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
      (keys.has("a") || keys.has("arrowleft") ? 1 : 0) +
      sticks.move.vector[0];
    const forward =
      (keys.has("w") || keys.has("arrowup") ? 1 : 0) -
      (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
      sticks.move.vector[1];
    const rx =
        sticks.look.vector[0] +
        (keys.has("l") ? 1 : 0) -
        (keys.has("j") ? 1 : 0),
      ry =
        sticks.look.vector[1] +
        (keys.has("k") ? 1 : 0) -
        (keys.has("i") ? 1 : 0);
    if (side || forward || rx || ry) {
      const len = Math.max(1, Math.hypot(side, forward));
      yaw -= rx * dt * 1.65;
      pitch = T.MathUtils.clamp(pitch - ry * dt * 1.15, -0.95, 0.95);
      camera.rotation.set(pitch, yaw, 0, "YXZ");
      movePlayer(
        ((Math.cos(yaw) * side - Math.sin(yaw) * forward) * dt * 1.5) / len,
        ((-Math.sin(yaw) * side - Math.cos(yaw) * forward) * dt * 1.5) / len,
      );
      again = true;
      clockStats.steps++;
      const r = roomAt(eye.x, eye.z);
      if (r !== currentRoom) {
        currentRoom = r;
        $("#location").textContent = rooms.find((a) => a.id === r)!.name;
        allocateLights();
        updateActions();
        markRoom();
      }
    }
  } else orbit.update();
  nearby(now);
  if ("needsUpdate" in renderer.shadowMap)
    renderer.shadowMap.needsUpdate = dirtyShadow;
  sun.shadow.needsUpdate = dirtyShadow;
  for (const light of lightPool)
    if (light.castShadow) light.shadow.needsUpdate = dirtyShadow;
  dirtyShadow = false;
  if (finish) finish.render();
  else renderer.render(scene, camera);
  renders++;
  if (again) schedule();
}
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(quality.maxDpr);
  renderer.setSize(innerWidth, innerHeight);
  finish?.resize?.(innerWidth, innerHeight, quality.maxDpr);
  schedule(true);
}
async function boot() {
  const wasm = initGeometry(
    `${import.meta.env.BASE_URL}transform.wasm`,
    new URLSearchParams(location.search).get("wasm") !== "0",
  );
  renderer = await createRenderer($("#scene"));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  if ("autoUpdate" in renderer.shadowMap) renderer.shadowMap.autoUpdate = false;
  sun.shadow.autoUpdate = false;
  await wasm;
  home = buildHome(scene, materials);
  refreshDynamic();
  // A single shared, bounded environment; no room recaptures or live mirrors on mobile.
  const envGen = environmentGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const env = envGen.fromScene(roomEnv, 0.055);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.36;
  roomEnv.dispose();
  envGen.dispose();
  // Exterior is a quiet schematic garden, not a claim about the real property's surroundings.
  const garden = new T.Mesh(
    new T.PlaneGeometry(160, 160),
    new T.MeshStandardMaterial({ color: "#8b9981", roughness: 1 }),
  );
  garden.rotation.x = -Math.PI / 2;
  garden.position.set(6, -1.6, 6);
  scene.add(garden);
  for (let i = 0; i < 16; i++) {
    const x = -12 + (i % 8) * 5,
      z = i < 8 ? -8 : 20;
    const trunk = new T.Mesh(
      new T.CylinderGeometry(0.07, 0.11, 3, 8),
      materials.oak,
    );
    trunk.position.set(x, -0.1, z);
    scene.add(trunk);
    const crown = new T.Mesh(new T.SphereGeometry(1, 12, 8), materials.leaf);
    crown.scale.set(1.25, 1.7, 1.25);
    crown.position.set(x, 1.6, z);
    scene.add(crown);
  }
  for (let i = 0; i < quality.lightSlots; i++) {
    const light = new T.SpotLight("#ffe4bc", 4, 8, Math.PI * 0.38, 0.75, 1.35);
    light.castShadow = i < quality.shadowLights;
    light.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 8;
    light.shadow.normalBias = 0.025;
    light.shadow.bias = -0.00015;
    light.shadow.autoUpdate = false;
    lightPool.push(light);
    scene.add(light, light.target);
  }
  allocateLights();
  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enabled = false;
  orbit.enableDamping = false;
  orbit.minDistance = 0.5;
  orbit.maxDistance = 38;
  orbit.maxPolarAngle = Math.PI * 0.49;
  orbit.addEventListener("change", () => schedule());
  sticks = new FloatingSticks(
    renderer.domElement,
    () => walking && !$("#panel").matches(":not([hidden])"),
    () => schedule(),
  );
  for (const room of rooms) {
    const b = document.createElement("button");
    b.dataset.room = room.id;
    b.textContent = room.name;
    b.onclick = () => setRoom(room.id);
    $("#room-list").append(b);
  }
  $("#panel-toggle").onclick = () => {
    const panel = $("#panel");
    panel.hidden = !panel.hidden;
    $("#panel-toggle").setAttribute("aria-expanded", String(!panel.hidden));
    sticks.clear();
    keys.clear();
    updateActions();
  };
  $("#panel-close").onclick = closePanel;
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(
    (button) =>
      (button.onclick = () => {
        for (const tab of ["rooms", "light", "actions"])
          $(`#tab-${tab}`).hidden = button.dataset.tab !== tab;
        document
          .querySelectorAll("[data-tab]")
          .forEach((b) => b.classList.toggle("selected", b === button));
      }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-light]").forEach(
    (button) =>
      (button.onclick = () => {
        setLight(button.dataset.light!);
      }),
  );
  $("#overview").onclick = setOverview;
  $("#walk-start").onclick = enterWalk;
  $("#leave-walk").onclick = () => setRoom(currentRoom);
  $("#interaction").onclick = () => {
    if (activeAction) toggle(activeAction);
  };
  $("#export").onclick = () => {
    renderer.render(scene, camera);
    const a = document.createElement("a");
    a.download = "YANs-Home.png";
    a.href = renderer.domElement.toDataURL("image/png");
    a.click();
  };
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePanel();
      if (walking) setRoom(currentRoom);
      return;
    }
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    keys.add(e.key.toLowerCase());
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
    )
      e.preventDefault();
    schedule();
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.key.toLowerCase());
    schedule();
  });
  window.addEventListener("blur", () => {
    keys.clear();
    sticks.clear();
  });
  document.addEventListener("visibilitychange", () => {
    keys.clear();
    sticks.clear();
    lastTime = 0;
    if (!document.hidden) schedule();
  });
  if (quality.postprocessing) {
    if (rendering.backend === "WebGPU") {
      const { createGPUFinish } = await import("./gpu-effects");
      finish = createGPUFinish(renderer as any, scene, camera);
      await finish.compile();
    } else {
      const { createGLFinish } = await import("./finish");
      finish = createGLFinish(renderer as T.WebGLRenderer, scene, camera);
    }
  }
  window.addEventListener("resize", resize);
  ready = true;
  pose(2.55, 1.62, 4.4, 3.7, 1.4, 5.2);
  eye.copy(camera.position);
  $("#location").textContent = "自用电梯厅";
  resize();
  markRoom();
  updateActions();
  $("#loading").hidden = true;
  schedule(true);
  visualReady = hydrateMaterials(materials, () => schedule());
  // No old-house ids, furniture states, private images or room-specific overrides are inherited.
  const api = {
    getState: () => ({
      ready,
      version: model.version,
      name: model.name,
      room: currentRoom,
      lighting,
      walking,
      overview,
      position: camera.position.toArray(),
      renderer: rendering.backend,
      sticks: sticks.getState(),
      actions: home.actions.map((a) => ({
        id: a.id,
        name: a.name,
        value: a.value,
        target: a.target,
        room: a.room,
      })),
    }),
    getModel: () => structuredClone(model),
    getBounds: () => structuredClone(home.bounds),
    getColliders: () =>
      home.colliders.map((c) => ({
        id: c.id,
        min: c.min.toArray(),
        max: c.max.toArray(),
      })),
    getPerformance: () => ({
      renders,
      pending: queued,
      animating,
      frameMs: lastFrameMs,
      quality,
      geometry: geometryState(),
      textures: textureStatus,
      batching: home.batching,
      contact: home.contact,
      lighting: {
        slots: lightPool.length,
        shadowLights: lightPool.filter((l) => l.castShadow).length,
        localIntensity: lightPool[0]?.intensity,
      },
      clock: clockStats,
      finish: finish?.audit() ?? { kind: "native AA + shared PBR environment" },
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      canvas: [renderer.domElement.width, renderer.domElement.height],
    }),
    whenVisualReady: () => visualReady,
    setRoom,
    setOverview,
    setLightingScene: setLight,
    enterWalk,
    interact: (id: string) => {
      const a = home.actions.find((a) => a.id === id);
      if (a) toggle(a);
    },
    clearAt: (x: number, z: number) => clearAt(x, z),
    facePoint: (x: number, z: number) => {
      yaw = Math.atan2(camera.position.x - x, camera.position.z - z);
      pitch = 0;
      camera.rotation.set(0, yaw, 0, "YXZ");
      schedule();
    },
    setWalkPosition: (x: number, z: number) => {
      if (!clearAt(x, z)) return false;
      eye.set(x, 1.62, z);
      camera.position.copy(eye);
      currentRoom = roomAt(x, z);
      allocateLights();
      schedule();
      return true;
    },
  };
  (window as any).homePresentation = api;
}
boot().catch((error) => {
  console.error(error);
  $("#loading").hidden = true;
  $("#fallback").hidden = false;
});
