const mobile = matchMedia("(max-width:1000px), (pointer:coarse)").matches;
const device = navigator as Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};
const economical =
  device.connection?.saveData ||
  (device.deviceMemory !== undefined && device.deviceMemory <= 4) ||
  navigator.hardwareConcurrency <= 4;
const pixelBudget = mobile ? (economical ? 1_500_000 : 2_600_000) : 4_200_000;
const cap = Math.sqrt(pixelBudget / Math.max(1, innerWidth * innerHeight));
export const quality = {
  mobile,
  economical: !!economical,
  lightSlots: mobile ? (economical ? 4 : 6) : 12,
  shadowLights: mobile ? 1 : 2,
  shadowSize: mobile ? 512 : 1024,
  sunShadowSize: mobile ? 1024 : 2048,
  maxDpr: Math.min(devicePixelRatio, mobile ? (economical ? 1.35 : 2) : 2, cap),
  // Preserve texture and silhouette clarity while walking. Interaction is not
  // a separate resolution tier; effects may be shed without resizing the frame.
  interactionDpr: Math.min(devicePixelRatio, mobile ? (economical ? 1.35 : 2) : 2, cap),
  resolutionPolicy: "stable_per_profile" as const,
  targetFrameMs: mobile ? 1000 / 30 : 1000 / 60,
  physicsHz: mobile ? 30 : 60,
  postprocessing: !mobile && !economical,
};
