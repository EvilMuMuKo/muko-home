import * as THREE from "three";

export type MirrorBackend = "webgpu" | "webgl";

export interface PlanarMirrorAudit {
  enabled: boolean;
  backend: MirrorBackend | null;
  storageUnitId: string | null;
  expectedLeafCount: number;
  enabledLeafCount: number;
  perLeafEdge: number;
  perLeafWidth: number;
  perLeafHeight: number;
  samples: number;
  totalPixelBudget: number;
  totalSamplePixelBudget: number;
  renderedFramesObserved: number;
  note: string;
}

export function planarMirrorBudget(mobile: boolean) {
  // Each moving door gets a bounded 512px mobile / 1024px desktop target.
  // Four samples smooth thin reflected edges without turning the panels into
  // full-window render targets.
  const perLeafEdge = mobile ? 512 : 1024;
  const samples = 4;
  const totalPixelBudget = 2 * perLeafEdge * perLeafEdge;
  return { perLeafEdge, samples, totalPixelBudget, totalSamplePixelBudget: totalPixelBudget * samples };
}

type StorageMirror = { id: string; type: string; fronts?: string[] };
type ReflectorHandle = { dispose(): void };

function findMirrorStorage(model: { objects?: StorageMirror[] }) {
  return model.objects?.find((unit) => unit.id === "upper-bath-mirror" && unit.type === "wall_storage" && unit.fronts?.includes("mirror")) ?? null;
}

function cameraFacesMirror(camera: THREE.Camera, mirror: THREE.Object3D) {
  const mirrorPosition = mirror.getWorldPosition(new THREE.Vector3());
  const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mirror.getWorldQuaternion(new THREE.Quaternion()));
  return cameraPosition.sub(mirrorPosition).dot(normal) > 0;
}

/** Creates reflectors only on the two moving mirror leaves in the final bath mirror cabinet. */
export async function createUpperBathMirror(args: {
  scene: THREE.Scene;
  renderer: any;
  model: { objects?: StorageMirror[] };
  materials: Record<string, THREE.Material>;
  mobile: boolean;
  backend: MirrorBackend;
}) {
  const { scene, renderer, model, materials, mobile, backend } = args;
  const storage = findMirrorStorage(model);
  const root = scene.getObjectByName("upper-bath-mirror");
  const budget = planarMirrorBudget(mobile);
  const drawingBufferSize = new THREE.Vector2(1, 1);
  if (typeof renderer?.getDrawingBufferSize === "function") renderer.getDrawingBufferSize(drawingBufferSize);
  const webgpuResolutionScale = Math.min(1, budget.perLeafEdge / Math.max(1, drawingBufferSize.x, drawingBufferSize.y));
  const webgpuWidth = Math.max(1, Math.round(drawingBufferSize.x * webgpuResolutionScale));
  const webgpuHeight = Math.max(1, Math.round(drawingBufferSize.y * webgpuResolutionScale));
  const overlays: Array<{ mesh: THREE.Mesh; reflector: ReflectorHandle }> = [];
  let renderedFramesObserved = 0;
  let lastError: string | null = null;

  if (storage && root && renderer && backend) {
    const leaves: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const list = Array.isArray(node.material) ? node.material : [node.material];
      if (list.some((material) => material === materials.mirror || material.name === "mirror")) leaves.push(node);
    });

    // The final model has two side-hinged leaf panels with one capped target each.
    for (const leaf of leaves.slice(0, 2)) {
      leaf.geometry.computeBoundingBox();
      const bounds = leaf.geometry.boundingBox!;
      const width = Math.max(0.05, bounds.max.x - bounds.min.x - 0.012);
      const height = Math.max(0.05, bounds.max.y - bounds.min.y - 0.012);
      const geometry = new THREE.PlaneGeometry(width, height);
      try {
        let overlay: THREE.Mesh;
        let reflector: ReflectorHandle;
        if (backend === "webgl") {
          const { Reflector } = await import("three/addons/objects/Reflector.js");
          const webgl = new Reflector(geometry, {
            color: 0xc5c9c6,
            textureWidth: budget.perLeafEdge,
            textureHeight: budget.perLeafEdge,
            clipBias: 0.003,
            multisample: budget.samples,
          });
          const callback = webgl.onBeforeRender;
          webgl.onBeforeRender = function (rendering, currentScene, camera, ...rest) {
            if (cameraFacesMirror(camera, webgl)) renderedFramesObserved++;
            return callback.call(this, rendering, currentScene, camera, ...rest);
          };
          overlay = webgl;
          reflector = webgl;
        } else {
          const webgpu = await import("three/webgpu");
          const placeholder = new THREE.MeshBasicMaterial({ color: 0xffffff });
          overlay = new THREE.Mesh(geometry, placeholder);
          const reflectorNode = new webgpu.ReflectorNode({
            target: overlay,
            resolutionScale: webgpuResolutionScale,
            generateMipmaps: false,
            bounces: false,
            samples: budget.samples,
          });
          const base = reflectorNode.reflector as unknown as { updateBefore(frame: unknown): unknown };
          const updateBefore = base.updateBefore.bind(base);
          base.updateBefore = (frame: unknown) => {
            const camera = (frame as { camera?: THREE.Camera }).camera;
            if (camera && cameraFacesMirror(camera, overlay)) renderedFramesObserved++;
            return updateBefore(frame);
          };
          const material = new webgpu.MeshBasicNodeMaterial();
          material.name = "upper-bath-mirror-planar";
          material.colorNode = reflectorNode;
          material.toneMapped = false;
          placeholder.dispose();
          overlay.material = material;
          reflector = reflectorNode;
        }
        overlay.name = `upper-bath-mirror-reflector:${overlays.length + 1}`;
        overlay.position.set(0, 0, -bounds.max.z - 0.002);
        overlay.rotation.y = Math.PI;
        overlay.renderOrder = 3;
        overlay.castShadow = false;
        overlay.receiveShadow = false;
        overlay.userData.spaceIds = ["bath"];
        overlay.userData.kind = "planar-mirror";
        leaf.add(overlay);
        overlays.push({ mesh: overlay, reflector });
      } catch (error) {
        geometry.dispose();
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    if (leaves.length !== 2 && !lastError) lastError = `Expected two visible mirror door panels, found ${leaves.length}.`;
  }

  const enabledLeafCount = overlays.length;
  return {
    audit(): PlanarMirrorAudit {
      return {
        enabled: enabledLeafCount === 2,
        backend: enabledLeafCount ? backend : null,
        storageUnitId: storage?.id ?? null,
        expectedLeafCount: 2,
        enabledLeafCount,
        perLeafEdge: budget.perLeafEdge,
        perLeafWidth: backend === "webgpu" ? webgpuWidth : budget.perLeafEdge,
        perLeafHeight: backend === "webgpu" ? webgpuHeight : budget.perLeafEdge,
        samples: budget.samples,
        totalPixelBudget: enabledLeafCount * (backend === "webgpu" ? webgpuWidth * webgpuHeight : budget.perLeafEdge ** 2),
        totalSamplePixelBudget: enabledLeafCount * (backend === "webgpu" ? webgpuWidth * webgpuHeight : budget.perLeafEdge ** 2) * budget.samples,
        renderedFramesObserved,
        note: enabledLeafCount === 2
          ? "Two reflectors are attached to the final moving bath mirror leaves with recursive bounces disabled. Live output remains unverified until rendered on the selected backend. Three.js updates them only when visible mirror faces are rendered."
          : lastError ?? "The final upper-bath-mirror storage root or its mirror leaves were not found.",
      };
    },
    dispose() {
      for (const { mesh, reflector } of overlays) {
        mesh.parent?.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
        else mesh.material.dispose();
        reflector.dispose();
      }
    },
  };
}

// Keep a short name for integration sites that already refer to the bath mirror feature.
export const createBathMirror = createUpperBathMirror;
