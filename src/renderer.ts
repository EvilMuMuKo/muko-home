import { WebGLRenderer, PMREMGenerator } from "three";
import type { WebGPURenderer } from "three/webgpu";

export type Renderer = WebGLRenderer | WebGPURenderer;
export const rendering = {
  requested: new URLSearchParams(location.search).get("renderer") ?? "webgpu",
  backend: "unavailable",
  fallbackReason: new URLSearchParams(location.search).has("gpuFallback")
    ? "WebGPU runtime lost; recovered with WebGL"
    : "",
};
let GPUEnvironment: typeof import("three/webgpu").PMREMGenerator | undefined;

export async function createRenderer(
  canvas: HTMLCanvasElement,
): Promise<Renderer> {
  if (["webgpu", "auto"].includes(rendering.requested)) {
    // Probe before claiming a canvas context so WebGL can use the same canvas on failure.
    try {
      if (!("gpu" in navigator)) throw new Error("WebGPU API unavailable");
      const gpu = (
        navigator as Navigator & { gpu: { requestAdapter(): Promise<unknown> } }
      ).gpu;
      if (!(await gpu.requestAdapter()))
        throw new Error("WebGPU adapter unavailable");
      const module = await import("three/webgpu");
      const gpuCanvas = canvas.cloneNode(false) as HTMLCanvasElement;
      const renderer = new module.WebGPURenderer({
        canvas: gpuCanvas,
        antialias: true,
      });
      try {
        await renderer.init();
        if (!("isWebGPUBackend" in renderer.backend))
          throw new Error("WebGPU backend unavailable");
      } catch (error) {
        renderer.dispose();
        throw error;
      }
      GPUEnvironment = module.PMREMGenerator;
      canvas.replaceWith(gpuCanvas);
      rendering.backend = "WebGPU";
      return renderer;
    } catch (error) {
      rendering.fallbackReason =
        error instanceof Error ? error.message : String(error);
    }
  }
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: false,
  });
  rendering.backend = "WebGL2";
  return renderer;
}

export function environmentGenerator(renderer: Renderer) {
  return rendering.backend === "WebGPU"
    ? new GPUEnvironment!(renderer as WebGPURenderer)
    : new PMREMGenerator(renderer as WebGLRenderer);
}
