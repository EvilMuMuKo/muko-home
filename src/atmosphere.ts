import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ShallowWater } from "./shallow-water";
import { Curtain } from "./cloth";
import { quality } from "./quality";

interface Model {
  objects: {
    id: string;
    type: string;
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    y?: number;
    rotation?: number;
  }[];
  openings: {
    id: string;
    type: string;
    width: number;
    wallId?: string;
    center?: number[];
    height?: number;
    sill?: number;
  }[];
  walls: {
    id: string;
    thickness: number;
    a: number[];
    b: number[];
    height: number;
  }[];
}
interface Body {
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  age: number;
}
export async function createAtmosphere(
  scene: THREE.Scene,
  model: Model,
  materials: Record<string, THREE.Material>,
) {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(8, 0.05, 6)
      .setTranslation(6.4, -0.05, 4.7)
      .setFriction(0.7),
  );
  const colliders: {
    group: THREE.Object3D;
    collider: RAPIER.Collider;
    body: RAPIER.RigidBody;
  }[] = [];
  const bounds = new THREE.Box3(),
    size = new THREE.Vector3(),
    center = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  for (const object of [
    ...model.objects,
    ...model.openings
      .filter((o) => ["door", "sliding_door", "gate"].includes(o.type))
      .map((o) => ({ id: "opening:" + o.id, type: "opening" })),
  ]) {
    const group = scene.getObjectByName(object.id);
    if (
      !group ||
      ["keg", "co2", "door_leaf", "sink", "study_basin"].includes(object.type)
    )
      continue;
    bounds.setFromObject(group);
    bounds.getSize(size);
    bounds.getCenter(center);
    if (Math.min(size.x, size.y, size.z) <= 0.001) continue;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        center.x,
        center.y,
        center.z,
      ),
    );
    const collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        size.x / 2,
        size.y / 2,
        size.z / 2,
      ).setFriction(0.6),
      body,
    );
    colliders.push({ group, collider, body });
  }
  // Wall segments preserve door/window openings instead of sealing them with room AABBs.
  for (const wall of model.walls) {
    const dx = wall.b[0] - wall.a[0],
      dz = wall.b[1] - wall.a[1],
      length = Math.hypot(dx, dz),
      angle = -Math.atan2(dz, dx);
    const holes = model.openings
      .filter((o) => o.wallId === wall.id && o.center)
      .map((o) => ({
        ...o,
        along:
          ((o.center![0] - wall.a[0]) * dx + (o.center![1] - wall.a[1]) * dz) /
          length,
      }));
    const cuts = [
      0,
      length,
      ...holes.flatMap((o) => [
        Math.max(0, o.along - o.width / 2),
        Math.min(length, o.along + o.width / 2),
      ]),
    ].sort((a, b) => a - b);
    const block = (a: number, b: number, bottom: number, top: number) => {
      if (b - a < 1e-4 || top - bottom < 1e-4) return;
      const t = (a + b) / 2 / length;
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          (b - a) / 2,
          (top - bottom) / 2,
          wall.thickness / 2,
        )
          .setTranslation(
            wall.a[0] + dx * t,
            (top + bottom) / 2,
            wall.a[1] + dz * t,
          )
          .setRotation({
            x: 0,
            y: Math.sin(angle / 2),
            z: 0,
            w: Math.cos(angle / 2),
          }),
      );
    };
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1],
        b = cuts[i],
        hole = holes.find(
          (o) =>
            (a + b) / 2 > o.along - o.width / 2 &&
            (a + b) / 2 < o.along + o.width / 2,
        );
      if (hole) {
        const sill = hole.type === "window" ? (hole.sill ?? 0.9) : 0;
        block(a, b, 0, sill);
        block(a, b, sill + (hole.height ?? 2.08), wall.height);
      } else block(a, b, 0, wall.height);
    }
  }
  const curtains: Curtain[] = [];
  for (const opening of model.openings.filter(
    (o) => o.type === "window" && /^(master|guest|balcony)-/.test(o.id),
  )) {
    const group = scene.getObjectByName(
      "window-treatment:" + opening.id,
    ) as THREE.Group;
    if (!group) continue;
    // Replace decorative cylinder folds with six low-resolution constrained cloth sheets.
    for (const child of [...group.children])
      if (
        child instanceof THREE.Mesh &&
        child.geometry.type === "CylinderGeometry"
      )
        group.remove(child);
    const sign = opening.id.startsWith("guest") ? -1 : 1;
    const z =
      sign *
      ((model.walls.find((w) => w.id === opening.wallId)?.thickness ?? 0.18) /
        2 +
        0.07);
    for (const side of [-1, 1])
      curtains.push(
        new Curtain(
          group,
          opening.id.startsWith("guest")
            ? (materials.cinemaCurtain ?? materials.linen)
            : materials.linen,
          side * (opening.width / 2 + 0.14),
          z,
          sign,
        ),
      );
  }
  const basin = new ShallowWater();
  const waterGeometry = new THREE.PlaneGeometry(
    basin.width,
    basin.depth,
    basin.nx - 1,
    basin.nz - 1,
  );
  waterGeometry.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(
    waterGeometry,
    new THREE.MeshPhysicalMaterial({
      color: "#8ba8a0",
      metalness: 0.08,
      roughness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    }),
  );
  water.name = "sink-water";
  water.position.y = -0.08;
  scene.getObjectByName("kitchen-sink")?.add(water);
  const balls: Body[] = [];
  const ballGeometry = new THREE.SphereGeometry(0.065, 16, 12);
  const ballMaterial = new THREE.MeshStandardMaterial({
    color: "#bb7b4f",
    roughness: 0.32,
    metalness: 0.25,
  });
  let wind = false,
    last = 0,
    accumulator = 0,
    ticks = 0,
    elapsed = 0;
  function drop(position: THREE.Vector3) {
    if (balls.length >= 8) {
      const old = balls.shift()!;
      scene.remove(old.mesh);
      world.removeRigidBody(old.body);
    }
    const mesh = new THREE.Mesh(ballGeometry, ballMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setCcdEnabled(true)
        .setLinearDamping(0.15),
    );
    world.createCollider(
      RAPIER.ColliderDesc.ball(0.065).setRestitution(0.3).setFriction(0.65),
      body,
    );
    balls.push({ mesh, body, age: 0 });
  }
  function step(now: number, suspended: boolean, moving = false) {
    if (suspended) {
      last = 0;
      accumulator = 0;
      return { active: false, dirty: false, shadow: false };
    }
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
    last = now;
    let active = wind || moving || balls.some((b) => !b.body.isSleeping());
    if (!active) {
      last = 0;
      return { active: false, dirty: false, shadow: false };
    }
    accumulator = Math.min(accumulator + dt, 3 / 60);
    if (accumulator < 1 / quality.physicsHz)
      return { active, dirty: false, shadow: false };
    const before = ticks;
    const visibleCurtains = curtains.filter((c) => c.mesh.parent?.visible);
    while (accumulator >= 1 / 60) {
      // Conservative furniture AABBs follow articulated objects; never alter design transforms.
      if (moving)
        for (const { group, collider, body } of colliders) {
          bounds.setFromObject(group);
          bounds.getSize(size);
          bounds.getCenter(center);
          body.setNextKinematicTranslation(center);
          collider.setShape(
            new RAPIER.Cuboid(
              Math.max(0.001, size.x / 2),
              Math.max(0.001, size.y / 2),
              Math.max(0.001, size.z / 2),
            ),
          );
        }
      world.step();
      elapsed += 1 / 60;
      if (wind) {
        for (const curtain of visibleCurtains) {
          const spheres = balls.map((b) => ({
            position: curtain.mesh.parent!.worldToLocal(
              new THREE.Vector3().copy(b.body.translation()),
            ),
            radius: 0.065,
          }));
          curtain.step(1 / 60, elapsed, spheres);
        }
        if (water.parent?.visible) {
          if (ticks % 150 === 0) basin.disturb(0.38, 0.55, 0.008);
          basin.step(1 / 60);
        }
      }
      for (const ball of balls) {
        ball.mesh.position.copy(ball.body.translation());
        ball.mesh.quaternion.copy(ball.body.rotation());
        ball.age += 1 / 60;
      }
      accumulator -= 1 / 60;
      ticks++;
    }
    if (wind && water.parent?.visible) {
      const vertices = waterGeometry.attributes.position;
      for (let i = 0; i < vertices.count; i++)
        vertices.setY(i, basin.state[i * 3] - basin.restDepth);
      vertices.needsUpdate = true;
      waterGeometry.computeVertexNormals();
    }
    return {
      active,
      dirty: ticks > before,
      shadow: Math.floor(ticks / 6) !== Math.floor(before / 6),
    };
  }
  return {
    step,
    setWind(value: boolean) {
      wind = value;
      last = 0;
    },
    resetClock() {
      last = 0;
      accumulator = 0;
    },
    drop,
    splash() {
      basin.disturb(0.5, 0.5, 0.025);
    },
    getState: () => ({
      wind,
      curtains: curtains.length,
      bodies: balls.length,
      awake: balls.filter((b) => !b.body.isSleeping()).length,
      colliders: colliders.length,
      waterVolume: basin.volume,
      waterTime: basin.time,
      ticks,
      positions: balls.map((b) => ({ ...b.body.translation() })),
    }),
  };
}
