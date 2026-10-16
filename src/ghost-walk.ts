import * as THREE from "three";
import "./ghost-walk.css";

export type GhostWalkTarget = {
  id: string;
  label: string;
  position: [number, number, number];
  activate: () => void;
};

export type GhostWalkOptions = {
  camera: THREE.PerspectiveCamera;
  canvas: HTMLElement;
  onChange: () => void;
  onMotion: (active: boolean) => void;
  getTargets: () => GhostWalkTarget[];
  onExit: () => void;
  resolveMove?: (from: [number, number], to: [number, number]) => [number, number];
};

export type GhostWalkState = {
  active: boolean;
  yaw: number;
  pitch: number;
  position: [number, number, number];
  nearestId: string | null;
};

const EYE_HEIGHT = 1.74;
const WORLD_BOUNDS = { minX: -0.4, maxX: 13.3, minZ: -0.4, maxZ: 9.8 };
const WALK_SPEED = 1.35;
const TURN_PER_PIXEL = 0.0032;
const LOOK_SPEED = 1.65;
const INTERACTION_DISTANCE = 1.6;
const MIN_PITCH = THREE.MathUtils.degToRad(-65);
const MAX_PITCH = THREE.MathUtils.degToRad(65);

/** First-person walk with independent movement/look sticks and optional solid-world resolution. */
export function createGhostWalk({
  camera,
  canvas,
  onChange,
  onMotion,
  getTargets,
  onExit,
  resolveMove,
}: GhostWalkOptions) {
  const doc = canvas.ownerDocument;
  const win = doc.defaultView ?? window;
  const overlay = doc.createElement("div");
  overlay.className = "ghost-walk-controls";
  overlay.setAttribute("aria-label", "室内漫游控制");

  const joystick = doc.createElement("div");
  joystick.className = "ghost-joystick";
  joystick.setAttribute("role", "application");
  joystick.setAttribute("aria-label", "移动摇杆，拖动行走");
  joystick.tabIndex = 0;
  const thumb = doc.createElement("span");
  thumb.className = "ghost-joystick__thumb";
  thumb.setAttribute("aria-hidden", "true");
  joystick.append(thumb);

  const lookJoystick = doc.createElement("div");
  lookJoystick.className = "ghost-joystick ghost-look-joystick";
  lookJoystick.setAttribute("role", "application");
  lookJoystick.setAttribute("aria-label", "视角摇杆，拖动转头；键盘 I J K L");
  lookJoystick.tabIndex = 0;
  const lookThumb = doc.createElement("span");
  lookThumb.className = "ghost-joystick__thumb";
  lookThumb.setAttribute("aria-hidden", "true");
  lookJoystick.append(lookThumb);
  for (const [stick, name] of [[joystick, "移动"], [lookJoystick, "视角"]] as const) {
    const label = doc.createElement("span");
    label.className = "ghost-joystick__label";
    label.textContent = name;
    label.setAttribute("aria-hidden", "true");
    stick.append(label);
  }

  const exitButton = doc.createElement("button");
  exitButton.className = "ghost-exit";
  exitButton.type = "button";
  exitButton.textContent = "退出漫游";
  exitButton.setAttribute("aria-label", "退出室内漫游");

  const interactButton = doc.createElement("button");
  interactButton.className = "ghost-interact";
  interactButton.type = "button";
  interactButton.hidden = true;

  overlay.append(joystick, lookJoystick, exitButton, interactButton);
  (canvas.parentElement ?? doc.body).append(overlay);
  canvas.classList.add("ghost-walk-active");

  let active = true;
  let disposed = false;
  let motionActive = false;
  let yaw = 0;
  let pitch = 0;
  let nearestId: string | null = null;
  let joystickPointer: number | null = null;
  let dragPointer: number | null = null;
  let lookPointer: number | null = null;
  let lookX = 0;
  let lookY = 0;
  let lastDragX = 0;
  let lastDragY = 0;
  let axisX = 0;
  let axisY = 0;
  let nearestTarget: GhostWalkTarget | null = null;
  const keys = new Set<string>();
  const direction = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const position = new THREE.Vector3();
  const targetVector = new THREE.Vector3();
  const EPSILON = 1e-5;

  position.copy(camera.position);
  position.y = EYE_HEIGHT;
  const initialDirection = camera
    .getWorldDirection(direction)
    .clone()
    .normalize();
  yaw = Math.atan2(initialDirection.x, -initialDirection.z);
  pitch = Math.asin(THREE.MathUtils.clamp(initialDirection.y, -1, 1));

  function setMotion(next: boolean) {
    if (motionActive === next) return;
    motionActive = next;
    onMotion(next);
  }

  function hasInput() {
    return joystickPointer !== null || lookPointer !== null || dragPointer !== null || keys.size > 0;
  }

  function syncMotion() {
    setMotion(active && hasInput());
  }

  function applyCameraPose() {
    camera.position.copy(position);
    const cosPitch = Math.cos(pitch);
    direction.set(
      Math.sin(yaw) * cosPitch,
      Math.sin(pitch),
      -Math.cos(yaw) * cosPitch,
    );
    camera.lookAt(position.clone().add(direction));
    camera.updateMatrixWorld(true);
  }

  function horizontalHalfFov() {
    const vertical = THREE.MathUtils.degToRad(camera.fov);
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
    return Math.min(
      THREE.MathUtils.degToRad(55),
      horizontal / 2 + THREE.MathUtils.degToRad(8),
    );
  }

  function refreshNearest() {
    camera.getWorldDirection(forward).normalize();
    let best: GhostWalkTarget | null = null;
    let bestScore = Infinity;
    const halfFov = horizontalHalfFov();
    const threshold = Math.cos(halfFov);
    for (const candidate of getTargets()) {
      targetVector.set(...candidate.position).sub(position);
      const distance = targetVector.length();
      if (!distance || distance > INTERACTION_DISTANCE) continue;
      const alignment = targetVector.dot(forward) / distance;
      const visible = alignment >= threshold;
      // Favor the object the user is deliberately aiming at over a closer
      // neighboring face (for example, a fridge beneath an upper cabinet),
      // while still allowing the cabinet to win when the view is aimed there.
      const score = distance + 8 * (1 - alignment);
      if (visible && score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    nearestTarget = best;
    nearestId = best?.id ?? null;
    interactButton.hidden = !best;
    if (best) {
      interactButton.textContent = `使用：${best.label}`;
      interactButton.setAttribute("aria-label", `与${best.label}互动`);
      interactButton.dataset.targetId = best.id;
    } else {
      interactButton.removeAttribute("data-target-id");
    }
  }

  function resize(width: number, height: number) {
    if (disposed) return;
    clearInputAndReleasePointers();
    camera.aspect = Math.max(1, width) / Math.max(1, height);
    camera.updateProjectionMatrix();
    onChange();
    refreshNearest();
  }

  function updateJoystick(event: PointerEvent) {
    const bounds = joystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(bounds.width, bounds.height) * 0.37);
    let dx = event.clientX - (bounds.left + bounds.width / 2);
    let dy = event.clientY - (bounds.top + bounds.height / 2);
    const magnitude = Math.hypot(dx, dy);
    if (magnitude > radius) {
      dx = (dx / magnitude) * radius;
      dy = (dy / magnitude) * radius;
    }
    axisX = dx / radius;
    axisY = dy / radius;
    if (Math.hypot(axisX, axisY) < 0.08) axisX = axisY = 0;
    thumb.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function onJoystickDown(event: PointerEvent) {
    if (!active || joystickPointer !== null) return;
    joystickPointer = event.pointerId;
    joystick.setPointerCapture?.(event.pointerId);
    updateJoystick(event);
    syncMotion();
    event.preventDefault();
    event.stopPropagation();
  }

  function releaseJoystick(event: PointerEvent) {
    if (joystickPointer !== event.pointerId) return;
    joystickPointer = null;
    axisX = axisY = 0;
    thumb.style.transform = "translate(0, 0)";
    try {
      if (joystick.hasPointerCapture?.(event.pointerId))
        joystick.releasePointerCapture(event.pointerId);
    } catch {
      // A browser may have already released a cancelled pointer.
    }
    syncMotion();
    event.preventDefault?.();
    event.stopPropagation?.();
  }

  function onJoystickMove(event: PointerEvent) {
    if (joystickPointer !== event.pointerId) return;
    updateJoystick(event);
    event.preventDefault();
    event.stopPropagation();
  }

  function updateLookJoystick(event: PointerEvent) {
    const bounds = lookJoystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(bounds.width, bounds.height) * 0.34);
    let dx = event.clientX - (bounds.left + bounds.width / 2);
    let dy = event.clientY - (bounds.top + bounds.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > radius) { dx *= radius / length; dy *= radius / length; }
    lookX = dx / radius;
    lookY = dy / radius;
    if (Math.hypot(lookX, lookY) < 0.12) lookX = lookY = 0;
    lookThumb.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function onLookDown(event: PointerEvent) {
    if (!active || lookPointer !== null) return;
    lookPointer = event.pointerId;
    lookJoystick.setPointerCapture?.(event.pointerId);
    updateLookJoystick(event);
    syncMotion();
    event.preventDefault();
    event.stopPropagation();
  }
  function onLookMove(event: PointerEvent) {
    if (lookPointer !== event.pointerId) return;
    updateLookJoystick(event);
    event.preventDefault();
    event.stopPropagation();
  }
  function releaseLook(event: PointerEvent) {
    if (lookPointer !== event.pointerId) return;
    lookPointer = null;
    lookX = lookY = 0;
    lookThumb.style.transform = "translate(0, 0)";
    try {
      if (lookJoystick.hasPointerCapture?.(event.pointerId))
        lookJoystick.releasePointerCapture(event.pointerId);
    } catch { /* cancelled capture was already released */ }
    syncMotion();
    event.preventDefault?.();
    event.stopPropagation?.();
  }

  function onCanvasDown(event: PointerEvent) {
    if (!active || dragPointer !== null || event.button !== 0 || event.pointerType === "touch") return;
    dragPointer = event.pointerId;
    lastDragX = event.clientX;
    lastDragY = event.clientY;
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is optional for synthetic or detached test canvases.
    }
    canvas.focus?.({ preventScroll: true });
    syncMotion();
    event.preventDefault();
  }

  function onCanvasMove(event: PointerEvent) {
    if (dragPointer !== event.pointerId || !active) return;
    const dx = event.clientX - lastDragX;
    const dy = event.clientY - lastDragY;
    lastDragX = event.clientX;
    lastDragY = event.clientY;
    yaw -= dx * TURN_PER_PIXEL;
    pitch = THREE.MathUtils.clamp(
      pitch - dy * TURN_PER_PIXEL,
      MIN_PITCH,
      MAX_PITCH,
    );
    applyCameraPose();
    refreshNearest();
    onChange();
    event.preventDefault();
  }

  function releaseCanvas(event: PointerEvent) {
    if (dragPointer !== event.pointerId) return;
    dragPointer = null;
    try {
      if (canvas.hasPointerCapture?.(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
    } catch {
      // A browser may have already released a cancelled pointer.
    }
    syncMotion();
    event.preventDefault?.();
  }

  const keyAliases: Record<string, string> = {
    w: "forward",
    arrowup: "forward",
    s: "backward",
    arrowdown: "backward",
    a: "left",
    arrowleft: "left",
    d: "right",
    arrowright: "right",
    i: "look-up",
    k: "look-down",
    j: "look-left",
    l: "look-right",
  };
  function onKeyDown(event: KeyboardEvent) {
    if (!active || disposed) return;
    if (event.key === "Escape") {
      event.preventDefault();
      active = false;
      clearInputAndReleasePointers();
      refreshNearest();
      onExit();
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.matches("input, textarea, select, [contenteditable=true]"))
      return;
    const action = keyAliases[event.key.toLowerCase()];
    if (!action) return;
    keys.add(action);
    syncMotion();
    event.preventDefault();
  }

  function onKeyUp(event: KeyboardEvent) {
    const action = keyAliases[event.key.toLowerCase()];
    if (!action) return;
    keys.delete(action);
    syncMotion();
    event.preventDefault();
  }

  function onVisibilityChange() {
    if (doc.hidden) clearInputAndReleasePointers();
  }

  function onWindowBlur() {
    clearInputAndReleasePointers();
  }

  function activateNearest() {
    if (!active || disposed) return;
    refreshNearest();
    const target = nearestTarget;
    if (!target) return;
    target.activate();
    onChange();
    refreshNearest();
  }

  function clearInputAndReleasePointers() {
    const joystickId = joystickPointer;
    const canvasId = dragPointer;
    const lookId = lookPointer;
    joystickPointer = dragPointer = lookPointer = null;
    lookX = lookY = 0;
    lookThumb.style.transform = "translate(0, 0)";
    keys.clear();
    axisX = axisY = 0;
    thumb.style.transform = "translate(0, 0)";
    try {
      if (joystickId !== null && joystick.hasPointerCapture?.(joystickId))
        joystick.releasePointerCapture(joystickId);
    } catch {
      // Ignore captures the browser has already cancelled.
    }
    try {
      if (canvasId !== null && canvas.hasPointerCapture?.(canvasId))
        canvas.releasePointerCapture(canvasId);
    } catch {
      // Ignore captures the browser has already cancelled.
    }
    try {
      if (lookId !== null && lookJoystick.hasPointerCapture?.(lookId))
        lookJoystick.releasePointerCapture(lookId);
    } catch { /* capture can already be lost */ }
    syncMotion();
  }

  function update(dtSeconds: number) {
    if (!active || disposed) return false;
    const dt = THREE.MathUtils.clamp(
      Number.isFinite(dtSeconds) ? dtSeconds : 0,
      0,
      0.05,
    );
    const moveX =
      axisX + (Number(keys.has("right")) - Number(keys.has("left")));
    const moveY =
      -axisY + (Number(keys.has("forward")) - Number(keys.has("backward")));
    const length = Math.hypot(moveX, moveY);
    let moved = false;
    const turnX = lookX + Number(keys.has("look-right")) - Number(keys.has("look-left"));
    const turnY = -lookY + Number(keys.has("look-up")) - Number(keys.has("look-down"));
    if (dt > 0 && (Math.abs(turnX) > 0.08 || Math.abs(turnY) > 0.08)) {
      const priorPitch = pitch;
      yaw += THREE.MathUtils.clamp(turnX, -1, 1) * LOOK_SPEED * dt;
      pitch = THREE.MathUtils.clamp(pitch + THREE.MathUtils.clamp(turnY, -1, 1) * LOOK_SPEED * 0.75 * dt, MIN_PITCH, MAX_PITCH);
      moved = Math.abs(turnX) > 0.08 || Math.abs(pitch - priorPitch) > EPSILON;
    }
    if (length > 0.08 && dt > 0) {
      const nx = moveX / Math.max(1, length);
      const ny = moveY / Math.max(1, length);
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      const deltaX = (sin * ny + cos * nx) * WALK_SPEED * dt;
      const deltaZ = (-cos * ny + sin * nx) * WALK_SPEED * dt;
      let nextX = THREE.MathUtils.clamp(
        position.x + deltaX,
        WORLD_BOUNDS.minX,
        WORLD_BOUNDS.maxX,
      );
      let nextZ = THREE.MathUtils.clamp(
        position.z + deltaZ,
        WORLD_BOUNDS.minZ,
        WORLD_BOUNDS.maxZ,
      );
      if (resolveMove) {
        [nextX, nextZ] = resolveMove([position.x, position.z], [nextX, nextZ]);
      }
      moved = moved ||
        Math.abs(nextX - position.x) > EPSILON ||
        Math.abs(nextZ - position.z) > EPSILON;
      position.set(nextX, EYE_HEIGHT, nextZ);
    }
    // Door and furniture animations can reach a stationary player too.
    if (resolveMove && length <= 0.08) {
      const [safeX, safeZ] = resolveMove([position.x, position.z], [position.x, position.z]);
      moved = moved || Math.abs(safeX - position.x) > EPSILON || Math.abs(safeZ - position.z) > EPSILON;
      position.set(safeX, EYE_HEIGHT, safeZ);
    }
    if (moved) applyCameraPose();
    refreshNearest();
    if (moved) onChange();
    return moved;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    active = false;
    clearInputAndReleasePointers();
    joystick.removeEventListener("pointerdown", onJoystickDown);
    joystick.removeEventListener("pointermove", onJoystickMove);
    joystick.removeEventListener("pointerup", releaseJoystick);
    joystick.removeEventListener("pointercancel", releaseJoystick);
    joystick.removeEventListener("lostpointercapture", releaseJoystick);
    lookJoystick.removeEventListener("pointerdown", onLookDown);
    lookJoystick.removeEventListener("pointermove", onLookMove);
    lookJoystick.removeEventListener("pointerup", releaseLook);
    lookJoystick.removeEventListener("pointercancel", releaseLook);
    lookJoystick.removeEventListener("lostpointercapture", releaseLook);
    canvas.removeEventListener("pointerdown", onCanvasDown);
    canvas.removeEventListener("pointermove", onCanvasMove);
    canvas.removeEventListener("pointerup", releaseCanvas);
    canvas.removeEventListener("pointercancel", releaseCanvas);
    canvas.removeEventListener("lostpointercapture", releaseCanvas);
    win.removeEventListener("keydown", onKeyDown);
    win.removeEventListener("keyup", onKeyUp);
    win.removeEventListener("blur", onWindowBlur);
    doc.removeEventListener("visibilitychange", onVisibilityChange);
    interactButton.removeEventListener("click", activateNearest);
    exitButton.removeEventListener("click", requestExit);
    overlay.remove();
    canvas.classList.remove("ghost-walk-active");
  }

  function requestExit() {
    if (!active || disposed) return;
    active = false;
    clearInputAndReleasePointers();
    refreshNearest();
    onExit();
  }

  joystick.addEventListener("pointerdown", onJoystickDown);
  joystick.addEventListener("pointermove", onJoystickMove);
  joystick.addEventListener("pointerup", releaseJoystick);
  joystick.addEventListener("pointercancel", releaseJoystick);
  joystick.addEventListener("lostpointercapture", releaseJoystick);
  lookJoystick.addEventListener("pointerdown", onLookDown);
  lookJoystick.addEventListener("pointermove", onLookMove);
  lookJoystick.addEventListener("pointerup", releaseLook);
  lookJoystick.addEventListener("pointercancel", releaseLook);
  lookJoystick.addEventListener("lostpointercapture", releaseLook);
  canvas.addEventListener("pointerdown", onCanvasDown);
  canvas.addEventListener("pointermove", onCanvasMove);
  canvas.addEventListener("pointerup", releaseCanvas);
  canvas.addEventListener("pointercancel", releaseCanvas);
  canvas.addEventListener("lostpointercapture", releaseCanvas);
  win.addEventListener("keydown", onKeyDown);
  win.addEventListener("keyup", onKeyUp);
  win.addEventListener("blur", onWindowBlur);
  doc.addEventListener("visibilitychange", onVisibilityChange);
  interactButton.addEventListener("click", activateNearest);
  exitButton.addEventListener("click", requestExit);

  applyCameraPose();
  refreshNearest();

  return {
    update,
    lookToward(target: [number, number, number]) {
      if (!active || disposed) return;
      direction.set(...target).sub(position).normalize();
      yaw = Math.atan2(direction.x, -direction.z);
      pitch = THREE.MathUtils.clamp(Math.asin(direction.y), MIN_PITCH, MAX_PITCH);
      applyCameraPose();
      refreshNearest();
      onChange();
    },
    getTarget() {
      camera.getWorldDirection(direction).normalize();
      return camera.position.clone().add(direction);
    },
    resize,
    dispose,
    getState(): GhostWalkState {
      return {
        active: active && !disposed,
        yaw,
        pitch,
        position: [position.x, position.y, position.z],
        nearestId,
      };
    },
  };
}
