import { expect, test } from "@playwright/test";
import { gpuStartupDeadline, isGPUDeviceLoss, isSoftwareAdapter } from "../src/gpu-recovery";

test.describe("isGPUDeviceLoss", () => {
  test("recognizes Dawn popErrorScope and explicit GPU device loss", () => {
    expect(isGPUDeviceLoss("Instance dropped in popErrorScope")).toBe(true);
    expect(isGPUDeviceLoss(new Error("Instance dropped in popErrorScope"))).toBe(true);
    expect(isGPUDeviceLoss(new Error("Aborted: Instance dropped in popErrorScope"))).toBe(true);
    expect(isGPUDeviceLoss({ message: "Instance dropped in popErrorScope" })).toBe(true);
    expect(isGPUDeviceLoss("GPUDevice lost")).toBe(true);
    expect(isGPUDeviceLoss("GPUDevice was destroyed")).toBe(true);
    expect(isGPUDeviceLoss("The GPU device has been lost")).toBe(true);
    expect(isGPUDeviceLoss("The GPU device is destroyed")).toBe(true);
    expect(isGPUDeviceLoss("GPUDeviceLost")).toBe(true);
    expect(isGPUDeviceLoss("GPU device loss")).toBe(true);
    expect(isGPUDeviceLoss("lost GPU device")).toBe(true);
    expect(isGPUDeviceLoss(new Error("GPU device destroyed"))).toBe(true);
  });

  test("ignores generic validation, network, and non-device failures", () => {
    expect(isGPUDeviceLoss("validation error")).toBe(false);
    expect(isGPUDeviceLoss(new Error("Validation error: invalid bind group"))).toBe(false);
    expect(isGPUDeviceLoss("Shader module validation failed")).toBe(false);
    expect(isGPUDeviceLoss("network error")).toBe(false);
    expect(isGPUDeviceLoss(new Error("Failed to fetch"))).toBe(false);
    expect(isGPUDeviceLoss({ message: "network error: timeout" })).toBe(false);
    expect(isGPUDeviceLoss("Instance dropped in pushErrorScope")).toBe(false);
    expect(isGPUDeviceLoss("destroyed")).toBe(false);
    expect(isGPUDeviceLoss("device was lost")).toBe(false);
    expect(isGPUDeviceLoss("GPUDevice is not defined")).toBe(false);
    expect(isGPUDeviceLoss(null)).toBe(false);
    expect(isGPUDeviceLoss(undefined)).toBe(false);
    expect(isGPUDeviceLoss({ reason: "destroyed" })).toBe(false);
  });
});

test.describe("isSoftwareAdapter", () => {
  test("reads the modern info flag or the legacy flag", () => {
    expect(isSoftwareAdapter({ info: { isFallbackAdapter: true } })).toBe(true);
    expect(isSoftwareAdapter({ isFallbackAdapter: true })).toBe(true);
    expect(isSoftwareAdapter({ info: { isFallbackAdapter: true }, isFallbackAdapter: false })).toBe(true);
    expect(isSoftwareAdapter({ info: { isFallbackAdapter: false }, isFallbackAdapter: true })).toBe(true);
  });

  test("does not treat hardware or unknown metadata as software", () => {
    expect(isSoftwareAdapter(null)).toBe(false);
    expect(isSoftwareAdapter({})).toBe(false);
    expect(isSoftwareAdapter({ info: {} })).toBe(false);
    expect(isSoftwareAdapter({ info: { isFallbackAdapter: false } })).toBe(false);
    expect(isSoftwareAdapter({ isFallbackAdapter: false })).toBe(false);
    expect(isSoftwareAdapter({ info: { isFallbackAdapter: false }, isFallbackAdapter: false })).toBe(false);
  });
});

test.describe("gpuStartupDeadline", () => {
  test("resolves with the startup result", async () => {
    await expect(gpuStartupDeadline(Promise.resolve("ready"), 5_000)).resolves.toBe("ready");
    const delayed = new Promise<number>((resolve) => {
      setTimeout(() => resolve(7), 20);
    });
    await expect(gpuStartupDeadline(delayed, 5_000)).resolves.toBe(7);
  });

  test("rejects with the underlying error", async () => {
    const cause = new Error("adapter request failed");
    await expect(gpuStartupDeadline(Promise.reject(cause), 5_000)).rejects.toBe(cause);
    const late = new Promise<never>((_, reject) => {
      setTimeout(() => reject(cause), 20);
    });
    await expect(gpuStartupDeadline(late, 5_000)).rejects.toBe(cause);
    await expect(gpuStartupDeadline(Promise.reject("no adapter"), 5_000)).rejects.toBe("no adapter");
  });

  test("rejects with a timeout error when startup misses the deadline", async () => {
    const pending = new Promise<string>(() => {});
    await expect(gpuStartupDeadline(pending, 30)).rejects.toThrow("GPU startup timed out after 30ms");
  });

  test("clears the timer on resolve, reject, and timeout", async () => {
    const original = globalThis.clearTimeout;
    let cleared = 0;
    globalThis.clearTimeout = ((handle: ReturnType<typeof setTimeout>) => {
      cleared += 1;
      return original(handle);
    }) as typeof clearTimeout;
    try {
      await gpuStartupDeadline(Promise.resolve(1), 5_000);
      await expect(gpuStartupDeadline(Promise.reject(new Error("boom")), 5_000)).rejects.toThrow("boom");
      await expect(gpuStartupDeadline(new Promise(() => {}), 30)).rejects.toThrow(/timed out/);
      expect(cleared).toBeGreaterThanOrEqual(3);
    } finally {
      globalThis.clearTimeout = original;
    }
  });
});
