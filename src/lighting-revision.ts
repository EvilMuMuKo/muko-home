type Fixture = { id: string; position: number[]; target?: number[]; anchor?: string | null; installation?: string; lumens?: number; [key: string]: any };
type Model = { objects: any[]; lighting: { fixtures: Fixture[]; scenes: any[]; defaultScene?: string }; homeDesign?: any };

const byId = (items: any[], id: string) => items.find((item) => item.id === id);

/** Apply bounded, concept-only corrections against the completed V9 object poses. */
export function reviseHomeLighting<T extends Model>(model: T): T {
  const fixtures = model.lighting.fixtures;
  const fixture = (id: string) => byId(fixtures, id) as Fixture | undefined;
  const dining = byId(model.objects, "dining-table");
  const tablePath = model.homeDesign?.dining?.sequence?.tablePath;
  const expanded = Array.isArray(tablePath) ? tablePath.at(-1) : undefined;
  if (dining && expanded) {
    const [x, z] = expanded;
    for (const [id, dx] of [["dining-offset-1", -0.28], ["dining-offset-2", 0.28]] as const) {
      const f = fixture(id);
      if (!f) continue;
      f.position = [x + dx, 2.55, z];
      f.target = [x + dx, Number(dining.y ?? 0) + Number(dining.h ?? 0.74) + 0.01, z];
      f.lumens = 200;
      f.beamAngle = 58;
    }
  }

  const coffee = byId(model.objects, "upper-bar-coffee");
  const barTask = fixture("bar-task");
  if (coffee && barTask) {
    const frontZ = Number(coffee.z) - Number(coffee.d ?? 0) / 2 - 0.04;
    barTask.position = [Number(coffee.x), Number(coffee.y) - 0.025, frontZ];
    barTask.target = [Number(coffee.x), 0.95, 7.95];
    barTask.installation = "surface profile below the actual coffee cabinet, forward/downward shield; concept position";
  }

  const display = byId(model.objects, "upper-bar-display");
  const displayLevels = ["display-level-1", "display-level-2", "display-level-3"];
  if (display) {
    const x = Number(display.x), frontZ = Number(display.z) - Number(display.d ?? 0) / 2 - 0.025;
    const shelfYs = [...display.shelves, Number(display.h) - 0.018]
      .map((offset) => Number(display.y) + offset - 0.018);
    displayLevels.forEach((id, index) => {
      const f = fixture(id);
      if (!f) return;
      const y = shelfYs[index];
      f.position = [x, y, frontZ];
      f.target = [x, y - 0.18, Number(display.z) - 0.04];
    });
  }

  // The rear cornice is an architectural feature not represented by the media cabinet.
  const cove = fixture("living-wall-cove");
  if (cove) {
    cove.anchor = null;
    cove.lumens = 600;
    cove.installation = "concealed architectural cornice uplight; cornice and ceiling detail require site confirmation";
  }

  // Aim the balcony task fitting from the ceiling at the actual laundry basket zone.
  const basket = byId(model.objects, "laundry-basket");
  const balcony = fixture("balcony-laundry");
  if (basket && balcony) {
    balcony.anchor = null;
    balcony.position = [Number(basket.x) + 0.13, 2.5, Number(basket.z) - 0.35];
    balcony.target = [Number(basket.x), 0.62, Number(basket.z)];
    balcony.installation = "surface shielded ceiling task fitting aimed at laundry basket zone; concept position";
  }

  const bed = byId(model.objects, "master-bed");
  if (bed) {
    const left = Number(bed.x) - Number(bed.w) / 2;
    const right = Number(bed.x) + Number(bed.w) / 2;
    for (const [id, side] of [["master-reading-1", -1], ["master-reading-2", 1]] as const) {
      const f = fixture(id);
      if (!f) continue;
      const edgeX = side < 0 ? left : right;
      f.position = [edgeX + side * 0.08, 1.12, Number(bed.z) - Number(bed.d) / 2 + 0.075];
      f.target = [edgeX + side * 0.28, 0.56, Number(bed.z) - Number(bed.d) / 2 + 0.42];
      f.lumens = 130;
      f.beamAngle = 45;
    }
  }
  model.lighting.defaultScene = "day-public";
  for (const source of fixtures) {
    if (["bar-wall-wash", "master-wall-wash", "corridor-wash"].includes(source.id)) {
      source.beamAngle = 80;
      source.lumens = Math.min(source.lumens ?? 300, 300);
    }
  }
  // Preserve material colour at night while relying on local task/accent sources.
  for (const scene of model.lighting.scenes) {
    if (scene.daylight) {
      scene.levels = {...scene.levels, night: 0};
      for (const room of Object.values(scene.roomLevels ?? {}) as any[]) room.night = 0;
      for (const source of fixtures.filter(f => f.group === "night"))
        if (scene.fixtureLevels?.[source.id] !== undefined) scene.fixtureLevels[source.id] = 0;
    }
    if (["aperitif", "game"].includes(scene.id)) {
      scene.ambientIntensity = 0.36;
      scene.environmentIntensity = 0.17;
    }
    if (scene.id === "cinema") {
      scene.ambientIntensity = 0.28;
      scene.environmentIntensity = 0.13;
    }
  }
  model.homeDesign.lighting = {
    revision: "final-furniture-anchors-2026-10-16",
    scope: "concept visual lighting; no surveyed daylight or photometric acceptance",
    corrected: ["dining-offset-1", "dining-offset-2", "bar-task", ...displayLevels,
      "living-wall-cove", "balcony-laundry", "master-reading-1", "master-reading-2"],
  };
  return model;
}
