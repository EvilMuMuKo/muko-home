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
const INTERACTION_DISTANCE = 1.6;
const MIN_PITCH = THREE.MathUtils.degToRad(-65);
const MAX_PITCH = THREE.MathUtils.degToRad(65);

/** First-person, no-collision concept walk with touch, pointer and keyboard input. */
export function createGhostWalk({
  camera,
  canvas,
  onChange,
  onMotion,
  getTargets,
  onExit,
}: GhostWalkOptions) {
  const doc = canvas.ownerDocument;
  const win = doc.defaultView ?? window;
  const overlay = doc.createElement("div");
  overlay.className = "ghost-walk-controls";
  overlay.setAttribute("aria-label", "幽灵漫游控制");

  const joystick = doc.createElement("div");
  joystick.className = "ghost-joystick";
  joystick.setAttribute("role", "application");
  joystick.setAttribute("aria-label", "触控摇杆，拖动移动");
  joystick.tabIndex = 0;
  const thumb = doc.createElement("span");
  thumb.className = "ghost-joystick__thumb";
  thumb.setAttribute("aria-hidden", "true");
  joystick.append(thumb);

  const exitButton = doc.createElement("button");
  exitButton.className = "ghost-exit";
  exitButton.type = "button";
  exitButton.textContent = "退出漫游";
  exitButton.setAttribute("aria-label", "退出幽灵漫游");

  const interactButton = doc.createElement("button");
  interactButton.className = "ghost-interact";
  interactButton.type = "button";
  interactButton.hidden = true;

  overlay.append(joystick, exitButton, interactButton);
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
    return joystickPointer !== null || dragPointer !== null || keys.size > 0;
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

  function onCanvasDown(event: PointerEvent) {
    if (!active || dragPointer !== null || event.button !== 0) return;
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
    joystickPointer = dragPointer = null;
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
    if (length > 0.08 && dt > 0) {
      const nx = moveX / Math.max(1, length);
      const ny = moveY / Math.max(1, length);
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      const deltaX = (sin * ny + cos * nx) * WALK_SPEED * dt;
      const deltaZ = (-cos * ny + sin * nx) * WALK_SPEED * dt;
      const nextX = THREE.MathUtils.clamp(
        position.x + deltaX,
        WORLD_BOUNDS.minX,
        WORLD_BOUNDS.maxX,
      );
      const nextZ = THREE.MathUtils.clamp(
        position.z + deltaZ,
        WORLD_BOUNDS.minZ,
        WORLD_BOUNDS.maxZ,
      );
      moved =
        Math.abs(nextX - position.x) > EPSILON ||
        Math.abs(nextZ - position.z) > EPSILON;
      position.set(nextX, EYE_HEIGHT, nextZ);
      if (moved) applyCameraPose();
    }
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
    canvas.removeEventListener("pointerdown", onCanvasDown);
    canvas.removeEventListener("pointermove", onCanvasMove);
    canvas.removeEventListener("pointerup", releaseCanvas);
    canvas.removeEventListener("pointercancel", releaseCanvas);
    canvas.removeEventListener("lostpointercapture", releaseCanvas);
    win.removeEventListener("keydown", onKeyDown);
    win.removeEventListener("keyup", onKeyUp);
    win.removeEventListener("blur", onWindowBlur);
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
  canvas.addEventListener("pointerdown", onCanvasDown);
  canvas.addEventListener("pointermove", onCanvasMove);
  canvas.addEventListener("pointerup", releaseCanvas);
  canvas.addEventListener("pointercancel", releaseCanvas);
  canvas.addEventListener("lostpointercapture", releaseCanvas);
  win.addEventListener("keydown", onKeyDown);
  win.addEventListener("keyup", onKeyUp);
  win.addEventListener("blur", onWindowBlur);
  interactButton.addEventListener("click", activateNearest);
  exitButton.addEventListener("click", requestExit);

  applyCameraPose();
  refreshNearest();

  return {
    update,
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
