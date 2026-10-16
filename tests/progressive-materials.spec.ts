import { test, expect } from "@playwright/test";

test("home renders while material images are delayed, then hydrates all shared maps", async ({
  page,
}, testInfo) => {
  let releaseRequests!: () => void;
  const requestsReleased = new Promise<void>((resolveRelease) => {
    releaseRequests = resolveRelease;
  });
  const materialRequests = new Set<string>();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (/\/materials\/.*\.webp(?:\?|$)/.test(request.url()))
      materialRequests.add(request.url());
  });
  await page.route("**/materials/*.webp", async (route) => {
    await requestsReleased;
    const url = new URL(route.request().url());
    const path = `public${decodeURIComponent(url.pathname)}`;
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    await route.fulfill({
      contentType: "image/webp",
      body: await readFile(resolve(path)),
    });
  });

  try {
    // Test texture identity on one stable renderer. CPU-only CI uses WebGL;
    // native hardware runs the WebGPU path. Device-loss reloads are covered by
    // the separate default-renderer recovery test, which deliberately rebuilds textures.
    const backend = testInfo.config.metadata.hardwareGPU ? "webgpu" : "webgl";
    await page.goto(`/?renderer=${backend}`, { waitUntil: "commit" });
    await page.waitForFunction(
      () => {
        const home = (window as any).homePresentation;
        const loading = document.querySelector("#loading");
        if (!home || !loading?.classList.contains("done")) return false;
        const state = home.getPerformance();
        return state.drawCalls > 0 && home.getGhostWalkState().active;
      },
      null,
      { timeout: 100_000 },
    );
    await expect
      .poll(() => materialRequests.size, { timeout: 20_000 })
      .toBe(12);

    const before = await page.evaluate(() => {
      const home = (window as any).homePresentation;
      const state = home.getPerformance();
      const find = (key: string) =>
        state.materials.find((material: any) => material.key === key);
      return {
        backend: state.rendering.backend,
        loaded: state.materialDetail.loaded,
        failed: state.materialDetail.failed,
        drawCalls: state.drawCalls,
        ghostWalkActive: home.getGhostWalkState().active,
        textures: [
          find("oak")?.channels.map((channel: any) => channel.uuid),
          find("darkoak")?.channels.map((channel: any) => channel.uuid),
          find("linen")?.channels.map((channel: any) => channel.uuid),
          find("sage")?.channels.map((channel: any) => channel.uuid),
        ],
      };
    });
    expect(before.loaded).toBe(0);
    expect(before.backend).toBe(testInfo.config.metadata.hardwareGPU ? "WebGPU" : "WebGL2");
    expect(before.failed).toEqual([]);
    expect(before.drawCalls).toBeGreaterThan(0);
    expect(before.ghostWalkActive).toBe(true);
    expect(before.textures[0]).toEqual(before.textures[1]);
    expect(before.textures[2]).toEqual(before.textures[3]);

    releaseRequests();
    await page.evaluate(() =>
      (window as any).homePresentation.whenVisualReady(),
    );
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            (window as any).homePresentation.getPerformance().materialDetail
              .loaded,
        ),
      )
      .toBe(12);
    const after = await page.evaluate(() => {
      const state = (window as any).homePresentation.getPerformance();
      const find = (key: string) =>
        state.materials.find((material: any) => material.key === key);
      return {
        loaded: state.materialDetail.loaded,
        failed: state.materialDetail.failed,
        textures: [
          find("oak")?.channels.map((channel: any) => channel.uuid),
          find("darkoak")?.channels.map((channel: any) => channel.uuid),
          find("linen")?.channels.map((channel: any) => channel.uuid),
          find("sage")?.channels.map((channel: any) => channel.uuid),
        ],
        dimensions: find("oak")?.channels.map((channel: any) => [
          channel.width,
          channel.height,
        ]),
      };
    });
    expect(after.loaded).toBe(12);
    expect(after.failed).toEqual([]);
    expect(after.textures).toEqual(before.textures);
    expect(after.textures[0]).toEqual(after.textures[1]);
    expect(after.textures[2]).toEqual(after.textures[3]);
    expect(
      after.dimensions.every(
        ([width, height]: number[]) => width > 1 && height > 1,
      ),
    ).toBe(true);
    expect(pageErrors).toEqual([]);
  } finally {
    releaseRequests();
  }
});
