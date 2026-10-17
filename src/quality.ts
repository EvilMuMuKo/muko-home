const mobile = matchMedia("(max-width:1000px), (pointer:coarse)").matches;
const device = navigator as Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};
const economical =
  device.connection?.saveData ||
  (device.deviceMemory !== undefined && device.deviceMemory <= 4) ||
  navigator.hardwareConcurrency <= 4;
// Phones share thermal/memory bandwidth with the browser UI. Keep one stable
// raster budget rather than spending desktop-like pixels on a small display.
const pixelBudget = mobile ? (economical ? 650_000 : 1_000_000) : 4_200_000;
const cap = Math.sqrt(pixelBudget / Math.max(1, innerWidth * innerHeight));
export const quality = {
  mobile,
  economical: !!economical,
  lightSlots: mobile ? (economical ? 3 : 4) : 12,
  shadowLights: mobile ? 1 : 2,
  shadowSize: mobile ? 512 : 1024,
  sunShadowSize: mobile ? 1024 : 2048,
  sunShadowRadius: mobile ? 1.25 : 2,
  maxDpr: Math.min(devicePixelRatio, mobile ? (economical ? 1.25 : 1.5) : 2, cap),
  // Preserve texture and silhouette clarity while walking. Interaction is not
  // a separate resolution tier; effects may be shed without resizing the frame.
  interactionDpr: Math.min(devicePixelRatio, mobile ? (economical ? 1.25 : 1.5) : 2, cap),
  resolutionPolicy: "stable_per_profile" as const,
  targetFrameMs: mobile ? 1000 / 30 : 1000 / 60,
  roomReflections: !mobile,
  liveMirrors: !mobile,
  reflectionStrategy: mobile ? "shared-environment" : "room-capture",
  physicsHz: mobile ? 30 : 60,
  postprocessing: !mobile && !economical,
};
