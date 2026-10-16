import * as THREE from "three";
import { createGhostWalk } from "/src/ghost-walk.ts";

const canvas = document.querySelector("#scene");
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
camera.position.set(6, 1.74, 5);
camera.lookAt(6, 1.74, 4);
let target = {
  id: "test-target",
  label: "测试柜门",
  position: [6, 1.74, 3.7],
  activations: 0,
};
let extraTargets = [];
const events = { changes: 0, motion: [], exits: 0 };
const walk = createGhostWalk({
  camera,
  canvas,
  onChange: () => events.changes++,
  onMotion: (active) => events.motion.push(active),
  getTargets: () => [
    {
      id: target.id,
      label: target.label,
      position: target.position,
      activate: () => target.activations++,
    },
    ...extraTargets,
  ],
  onExit: () => events.exits++,
});

window.ghostWalkHarness = {
  walk,
  events,
  camera,
  get target() { return target; },
  get extraTargets() { return extraTargets; },
  setTargetPosition(position) { target.position = position; },
  setExtraTargets(targets) { extraTargets = targets; },
  step(dt = 0.05) { return walk.update(dt); },
  dispose() { walk.dispose(); },
};
