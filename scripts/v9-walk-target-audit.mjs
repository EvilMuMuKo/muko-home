import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const [key, inline] = process.argv[i].split("=", 2);
  if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
  args.set(key.slice(2), inline ?? process.argv[++i]);
}
const baseURL = args.get("url");
const outPath = resolve(args.get("out") ?? "../../outputs/MuKo Home V9/walk-target-audit.json");
if (!baseURL) throw new Error("Pass --url=http://localhost:4173");
const executablePath = process.env.CHROMIUM_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
await mkdir(dirname(outPath), { recursive: true });

const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"],
});
const report = {
  capturedAt: new Date().toISOString(),
  baseURL,
  method: "Start the real scene ghost-walk at paired eye-height/aim coordinates; observe the actual proximity-filtered UI target. Each pose must be within 1.6 m and have unobstructed view; candidate points use the delivered model and scene target API.",
  limitation: "Browser geometry and target-selection evidence only. It does not establish physical reach, product operation, as-built clearance, or phone performance.",
  cases: [],
};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.homePresentation?.getState().ready, { timeout: 120_000 });
  await page.waitForTimeout(1400); // Avoid sampling during the arrival greeting.
  const poses = await page.evaluate(() => {
    const api = window.homePresentation;
    const model = api.getModel();
    const object = (id) => model.objects.find((item) => item.id === id);
    const fridge = object("kitchen-fridge");
    const dishwasher = object("kitchen-dishwasher");
    const keg = object("kegerator");
    const tv = object("living-tv");
    const bed = object("guest-sofa-bed");
    const hatch = model.homeDesign.hatch;
    const storage = object("upper-fridge");
    const storageFacingPose = (unit) => {
      const angle = (unit.rotation || 0) * Math.PI / 180;
      const nx = Math.sin(angle), nz = -Math.cos(angle);
      const target = [
        unit.x + nx * (unit.d / 2 + 0.02),
        Math.min(1.75, unit.y + 0.25),
        unit.z + nz * (unit.d / 2 + 0.02),
      ];
      return { position: [target[0] + nx * 0.55, 1.74, target[2] + nz * 0.55], target };
    };
    const storagePose = storageFacingPose(storage);
    return [
      { name: "fridge", expectedId: "walk-fridge", position: [3.25, 1.74, 4.05], target: [fridge.x, 1.15, fridge.z] },
      { name: "dishwasher", expectedId: "walk-dishwasher", position: [dishwasher.x, 1.74, dishwasher.z + 0.985], target: [dishwasher.x, 0.62, dishwasher.z] },
      { name: "keg", expectedId: "walk-keg", position: [keg.x, 1.74, keg.z - 0.95], target: [keg.x, 0.65, keg.z] },
      { name: "mobile-tv", expectedId: "walk-tv", position: [tv.x, 1.74, tv.z - 1.4], target: [tv.x, 1.265, tv.z] },
      { name: "hatch", expectedId: "walk-hatch", position: [hatch.hinge.x - 0.95, 1.74, hatch.hinge.z - 0.4], target: [hatch.hinge.x, 1.1, hatch.hinge.z - 0.4] },
      { name: "guest-bed", expectedId: "walk-bed", position: [bed.x, 1.74, bed.z + 1.13], target: [bed.x, 0.65, bed.z] },
      { name: "upper-fridge-storage", expectedId: "walk-storage:upper-fridge", ...storagePose },
    ];
  });
  for (const pose of poses) {
    await page.evaluate((p) => window.homePresentation.startGhostWalk(p), pose);
    const actual = await page.evaluate(() => ({
      state: window.homePresentation.getGhostWalkState(),
      selectedId: document.querySelector(".ghost-interact")?.dataset.targetId ?? null,
      selectedLabel: document.querySelector(".ghost-interact")?.textContent ?? null,
      camera: window.homePresentation.getCamera(),
    }));
    report.cases.push({ ...pose, ...actual, pass: actual.selectedId === pose.expectedId });
    await page.evaluate(() => window.homePresentation.stopGhostWalk());
    await page.waitForTimeout(80);
  }
  report.pageErrors = pageErrors;
  report.status = pageErrors.length === 0 && report.cases.every((item) => item.pass) ? "PASS" : "FAIL";
} finally {
  await browser.close();
}
await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outPath, status: report.status, cases: report.cases.map(({ name, expectedId, selectedId, pass }) => ({ name, expectedId, selectedId, pass })), pageErrors: report.pageErrors }, null, 2));
