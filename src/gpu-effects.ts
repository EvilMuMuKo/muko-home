import { RenderPipeline, type WebGPURenderer } from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import type { Scene, Camera } from 'three';

/** Small, thresholded quarter-resolution glow. Never enabled on mobile. */
export function createGPUFinish(renderer: WebGPURenderer, scene: Scene, camera: Camera) {
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode('output');
  const glow = bloom(color, 0.015, 0.18, 1.5);
  glow.setResolutionScale(0.25);
  const pipeline = new RenderPipeline(renderer);
  pipeline.outputNode = color.add(glow);
  let night=false;
  return {
    render:()=>pipeline.render(),
    setCamera:(next:Camera)=>{scenePass.camera=next;},
    setNight:(next:boolean)=>{night=next;glow.strength.value=next?0.16:0.015;},
    audit:()=>({kind:'WebGPU TSL thresholded bloom',enabled:true,mobile:false,resolutionScale:0.25,strength:night?0.16:0.015,threshold:1.5,rayTracing:false}),
    dispose:()=>{pipeline.dispose();glow.dispose();scenePass.dispose();},
  };
}
