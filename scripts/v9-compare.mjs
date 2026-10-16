import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function options(argv) {
  const parsed = {};
  for (let i = 2; i < argv.length; i++) {
    const [key, inline] = argv[i].split("=", 2);
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const name = key.slice(2);
    parsed[name] = inline ?? (argv[i + 1]?.startsWith("--") ? "true" : argv[++i]);
  }
  return parsed;
}

const args = options(process.argv);
if (!args.v8 || !args.v9) {
  throw new Error("Usage: node scripts/v9-compare.mjs --v8=<v8-audit.json> --v9=<v9-audit.json> [--out=<comparison.json>]");
}
const [v8, v9] = await Promise.all(
  [args.v8, args.v9].map(async (path) => JSON.parse(await readFile(resolve(path), "utf8"))),
);
const key = (profile, capture) => `${profile}/${capture.view}/${capture.lighting}`;
const flatten = (report) => new Map(
  report.runs.flatMap((run) =>
    run.captures.map((capture) => [key(run.profile, capture), capture]),
  ),
);
const before = flatten(v8), after = flatten(v9);
const metrics = [
  "renderMs.p50",
  "renderMs.p95",
  "frameMs.p50",
  "frameMs.p95",
  "drawCalls",
  "triangles",
  "geometries",
  "lightCount",
  "pixelRatio",
];
function getMetric(record, path) {
  return path.split(".").reduce((value, part) => value?.[part], record);
}
const cameraTolerance = {
  positionM: 0.01,
  targetM: 0.01,
  verticalFovDegrees: 0.1,
  aspect: 0.01,
};
function cameraEquivalence(a, b) {
  const first = a?.camera, second = b?.camera;
  if (!first || !second || !Array.isArray(first.position) || !Array.isArray(second.position) ||
      !Array.isArray(first.target) || !Array.isArray(second.target))
    return { equivalent: false, reason: "camera data missing", deltas: null };
  const deltas = {
    positionM: Math.max(...first.position.map((value, index) => Math.abs(value - second.position[index]))),
    targetM: Math.max(...first.target.map((value, index) => Math.abs(value - second.target[index]))),
    verticalFovDegrees: Math.abs(first.verticalFov - second.verticalFov),
    aspect: Math.abs(first.aspect - second.aspect),
  };
  const equivalent = Object.entries(cameraTolerance).every(([key, tolerance]) =>
    Number.isFinite(deltas[key]) && deltas[key] <= tolerance,
  );
  return { equivalent, deltas, tolerance: cameraTolerance };
}
const comparisons = [...new Set([...before.keys(), ...after.keys()])].sort().map((capture) => {
  const base = before.get(capture), candidate = after.get(capture);
  const cameraMatch = cameraEquivalence(base, candidate);
  const rows = Object.fromEntries(metrics.map((metric) => {
    const baseline = getMetric(base?.performance, metric), current = getMetric(candidate?.performance, metric);
    return [metric, {
      v8: baseline ?? null,
      v9: current ?? null,
      delta: Number.isFinite(baseline) && Number.isFinite(current) ? current - baseline : null,
      percent: Number.isFinite(baseline) && baseline !== 0 && Number.isFinite(current)
        ? ((current - baseline) / baseline) * 100
        : null,
    }];
  }));
  return {
    capture,
    matched: !!base && !!candidate,
    cameraEquivalent: cameraMatch,
    timingComparable: !!base && !!candidate && cameraMatch.equivalent,
    metrics: rows,
  };
});
const result = {
  baseline: { label: v8.label, capturedAt: v8.capturedAt, note: v8.note },
  candidate: { label: v9.label, capturedAt: v9.capturedAt, note: v9.note },
  note: "Performance metrics are comparable only within this matched SwiftShader/emulated-browser setup and when timingComparable is true. View IDs are not assumed to imply equal camera poses. Camera equivalence tolerances are 0.01 m for position/target, 0.1 degrees vertical FOV, and 0.01 aspect ratio. renderMs is synchronous JavaScript render-call duration; frameMs is requestAnimationFrame interval during an automated pointer gesture, not GPU timing or real-device FPS. Extra design-state screenshots are not performance measurements.",
  cameraTolerance,
  timingComparableCount: comparisons.filter((item) => item.timingComparable).length,
  poseChanged: comparisons.filter((item) => item.matched && !item.timingComparable).map((item) => item.capture),
  comparisons,
  unmatchedV8: [...before.keys()].filter((capture) => !after.has(capture)),
  unmatchedV9: [...after.keys()].filter((capture) => !before.has(capture)),
  v9Evidence: v9.runs.map((run) => ({
    profile: run.profile,
    extraCaptures: run.extraCaptures?.map(({ id, screenshot }) => ({ id, screenshot })) ?? [],
    pageErrors: run.pageErrors,
  })),
};
const out = resolve(args.out ?? "/tmp/muko-home-v9-audit/v8-v9-comparison.json");
await writeFile(out, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ out, matched: comparisons.filter((item) => item.matched).length, unmatchedV8: result.unmatchedV8.length, unmatchedV9: result.unmatchedV9.length }, null, 2));
