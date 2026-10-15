const mobile = matchMedia("(max-width:1000px), (pointer:coarse)").matches;
const device = navigator as Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};
const economical =
  device.connection?.saveData ||
  (device.deviceMemory !== undefined && device.deviceMemory <= 4) ||
  navigator.hardwareConcurrency <= 4;
const pixelBudget = mobile ? 1_500_000 : 3_000_000;
const cap = Math.sqrt(pixelBudget / Math.max(1, innerWidth * innerHeight));
export const quality = {
  mobile,
  economical: !!economical,
  lightSlots: mobile ? (economical ? 4 : 6) : 12,
  shadowLights: mobile ? 1 : 2,
  shadowSize: mobile ? 512 : 1024,
  sunShadowSize: mobile ? 1024 : 2048,
  maxDpr: Math.min(devicePixelRatio, mobile ? 1.25 : 1.75, cap),
  interactionDpr: Math.min(devicePixelRatio, mobile ? 1 : 1.5, cap),
  physicsHz: mobile ? 30 : 60,
  postprocessing: !mobile && !economical,
};
