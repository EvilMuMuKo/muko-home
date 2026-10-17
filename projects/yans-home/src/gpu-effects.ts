import { RenderPipeline, type WebGPURenderer } from "three/webgpu";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
import type { Scene, Camera } from "three";

/** Small, thresholded quarter-resolution glow. Never enabled on mobile. */
export function createGPUFinish(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
) {
  const scenePass = pass(scene, camera, { samples: 4 });
  scenePass.setResolutionScale(1);
  const color = scenePass.getTextureNode("output");
  // Spatial SMAA cleans fine silhouettes without temporal trailing or motion blur.
  // Three's SMAA node expects linear input, before RenderPipeline's one output transform.
  const antialiasEffect = smaa(color);
  const antialiased = antialiasEffect.getTextureNode();
  const glow = bloom(color, 0.015, 0.18, 1.5);
  glow.setResolutionScale(0.25);
  const pipeline = new RenderPipeline(renderer);
  pipeline.outputNode = antialiased.add(glow);
  let night = false,
    economy = 0;
  return {
    render: () => pipeline.render(),
    // Compile the actual multisampled scene target, not the canvas target.
    // Only called while startup rendering is paused: PassNode temporarily binds it.
    compile: () => scenePass.compileAsync(renderer),
    setCamera: (next: Camera) => {
      scenePass.camera = next;
    },
    setNight: (next: boolean) => {
      night = next;
      glow.strength.value = next ? 0.16 : 0.015;
    },
    setEconomy: (tier: number) => {
      if (economy === tier) return;
      economy = tier;
      pipeline.outputNode = tier ? antialiased : antialiased.add(glow);
      pipeline.needsUpdate = true;
    },
    audit: () => ({
      kind: "WebGPU spatial SMAA + thresholded bloom",
      enabled: true,
      mobile: false,
      antialiasing: "4xMSAA + SMAA 1x",
      temporalAccumulation: false,
      motionBlur: false,
      resolutionScale: 0.25,
      mainResolutionScale: scenePass.getResolutionScale(),
      mainSamples: scenePass.renderTarget.samples,
      economy,
      strength: economy ? 0 : night ? 0.16 : 0.015,
      threshold: 1.5,
      rayTracing: false,
    }),
    dispose: () => {
      pipeline.dispose();
      antialiasEffect.dispose();
      glow.dispose();
      scenePass.dispose();
    },
  };
}
