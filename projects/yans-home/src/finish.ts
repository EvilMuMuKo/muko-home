import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
export function createGLFinish(
  renderer: T.WebGLRenderer,
  scene: T.Scene,
  camera: T.Camera,
) {
  const target = new T.WebGLRenderTarget(innerWidth, innerHeight, {
    type: T.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  ao.blendIntensity = 0.4;
  ao.updateGtaoMaterial({
    radius: 0.18,
    thickness: 0.7,
    distanceExponent: 1.5,
    scale: 1,
  });
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  return {
    render: () => composer.render(),
    setNight: (_night: boolean) => {},
    resize: (w: number, h: number, dpr: number) => {
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
    },
    audit: () => ({ kind: "4xMSAA + GTAO", rayTracing: false }),
    dispose: () => composer.dispose(),
  };
}
