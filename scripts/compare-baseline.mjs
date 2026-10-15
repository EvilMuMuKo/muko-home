import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
const original = execFileSync("git", ["show", "36ac9b1:index.html"], {
  maxBuffer: 4e6,
}).toString();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const observations = [];
for (const baseline of [true, false]) {
  const page = await browser.newPage({
    viewport: { width: 900, height: 560 },
    reducedMotion: "reduce",
  });
  if (baseline)
    await page.route("**/baseline.html", (route) =>
      route.fulfill({ contentType: "text/html", body: original }),
    );
  await page.goto("http://localhost:8080/" + (baseline ? "baseline.html" : ""));
  await page.waitForFunction(() => window.homePresentation?.getState().ready);
  observations.push(
    await page.evaluate(() => ({
      bounds: window.homePresentation.getObjectBounds(),
      frames: window.homePresentation.getObjectFrames(),
      performance: window.homePresentation.getPerformance(),
      resources: performance
        .getEntriesByType("resource")
        .map((r) => ({
          name: r.name.split("/").pop(),
          bytes: r.decodedBodySize,
        })),
    })),
  );
  await page.close();
}
let maxDelta = 0,
  nonfiniteBoundsIdentical = true;
for (let i = 0; i < observations[0].bounds.length; i++)
  if (observations[0].bounds[i].min && observations[1].bounds[i].min)
    for (const key of ["min", "max"])
      for (let j = 0; j < 3; j++) {
        const a = observations[0].bounds[i][key][j],
          b = observations[1].bounds[i][key][j];
        if (Number.isFinite(a) && Number.isFinite(b))
          maxDelta = Math.max(maxDelta, Math.abs(a - b));
        else if (a !== b) nonfiniteBoundsIdentical = false;
      }
const result = {
  baselineCommit: "36ac9b1",
  viewport: "900x560",
  backend: "Chromium + software SwiftShader (not a phone FPS benchmark)",
  objects: observations[0].bounds.length,
  nonfiniteBoundsIdentical,
  maxBoundsDeltaMetres: maxDelta,
  missingObjectsIdentical:
    JSON.stringify(
      observations[0].bounds.filter((o) => o.missing).map((o) => o.id),
    ) ===
    JSON.stringify(
      observations[1].bounds.filter((o) => o.missing).map((o) => o.id),
    ),
  framesIdentical:
    JSON.stringify(observations[0].frames) ===
    JSON.stringify(observations[1].frames),
  roomBatching: observations[1].performance.roomBatching,
  lightSlots: {
    before: observations[0].performance.lightCount,
    after: observations[1].performance.lightCount,
  },
  resources: observations[1].resources,
};
console.log(JSON.stringify(result, null, 2));
await writeFile(
  "docs/baseline-validation.json",
  JSON.stringify(result, null, 2) + "\n",
);
await browser.close();
