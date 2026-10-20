/**
 * R6 builds on R5 without changing the approved architecture, furniture poses or material budget.
 *
 * Two additions, both concept-level and explicitly not site-surveyed:
 * 1. Wall-switch points (SW01–SW16) and the weak-current topology live in
 *    `electrical-layout.json` (A11) and are rendered by `electrical-mesh.ts`.
 * 2. Every lighting fixture carries a lighting-quality criterion (target illuminance,
 *    minimum colour rendering, glare note) so the existing fixture list can be reviewed
 *    against something other than "it looks warm".
 *
 * Values are concept targets, not photometric acceptance. `qualityStatus` keeps that
 * boundary visible in the exported model, matching the existing `fluxStatus` convention.
 */

const TARGET_LUX_BY_GROUP: Record<string, number> = {
  basic: 150,
  task: 300,
  accent: 150,
  ambient: 80,
  night: 20,
  reading: 300,
  work: 500,
  decor: 100,
  screen: 30,
};

/** Fixtures that read or work close to the eye get a stricter target than their group default. */
const TARGET_LUX_OVERRIDES: Record<string, number> = {
  "pc-desk-task": 500,
  "mac-desk-task": 500,
  "kitchen-prep-profile": 500,
  "kitchen-sink-task": 500,
  "bath-mirror-side-1": 300,
  "bath-mirror-side-2": 300,
  "master-reading-1": 300,
  "master-reading-2": 300,
  "living-reading-lamp": 300,
  "reading-local-task": 300,
  "guest-reader": 300,
  "master-underbed": 10,
  "corridor-guide": 10,
  "bath-night": 10,
  "guest-night-guide": 10,
  "balcony-low": 10,
};

export function createR6Design<T extends Record<string, any>>(base: T): T {
  const m: any = structuredClone(base);
  m.version = "16.0.0";

  const fixtures: any[] = m.lighting?.fixtures ?? [];
  for (const f of fixtures) {
    const group = String(f.group ?? "basic");
    f.targetLux = f.targetLux ?? TARGET_LUX_OVERRIDES[f.id] ?? TARGET_LUX_BY_GROUP[group] ?? 150;
    f.criMin = f.criMin ?? 90;
    f.glareNote =
      f.glareNote ??
      (group === "night"
        ? "low-level guide light; keep the source below eye height and out of the walking sightline"
        : "avoid direct view of the source; wash surfaces instead of aiming at eye height");
    f.qualityStatus = "concept_target_not_photometric_acceptance";
  }

  const electrical = m.homeDesign?.electrical;
  const switchPoints: any[] = Array.isArray(electrical?.points)
    ? electrical.points.filter((p: any) => p.kind === "switch")
    : [];
  const topology = electrical?.weakCurrentTopology ?? null;

  m.homeDesign.r6Revision = {
    sources: [
      "R6 开关点位（按房间 + 双控 + 0.70/1.20m 高度）",
      "R6 光品质指标（目标照度 / Ra≥90 / 防眩说明）",
      "R6 弱电拓扑（星型汇聚 + AP 只穿一堵墙）",
    ],
    structureChanged: false,
    furnitureChanged: false,
    materialBudgetChanged: false,
    switchPoints: switchPoints.length,
    switchDualPairs: switchPoints
      .filter((p: any) => p.switch?.dualControlOf)
      .map((p: any) => [p.id, p.switch.dualControlOf]),
    lightingCriteria: {
      fixtureCount: fixtures.length,
      defaultCriMin: 90,
      status: "concept_target_not_photometric_acceptance",
    },
    weakCurrentTopology: topology
      ? { nodes: topology.nodes?.length ?? 0, rules: topology.rules?.length ?? 0, scope: topology.scope }
      : null,
    scope: "switch and lighting-quality data added on top of the R5 unified model; no layout, furniture or material change",
  };

  return m;
}
