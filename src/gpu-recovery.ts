// Import-safe on CPU: no DOM or location access.

const DAWN_INSTANCE_DROPPED = "Instance dropped in popErrorScope";

const EXPLICIT_GPU_DEVICE_LOSS =
  /\bgpu\s*device(?:\s+(?:was|has\s+been|is|got|became))?\s+(?:lost|destroyed)\b|\bgpu\s*device(?:\s*|-)?(?:lost|destroyed|loss)\b|\b(?:lost|destroyed)\s+gpu\s*device\b/i;

function reasonMessage(reason: unknown): string | undefined {
  if (typeof reason === "string") return reason;
  if (typeof reason === "object" && reason !== null && "message" in reason) {
    const message = (reason as { message: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

export function isGPUDeviceLoss(reason: unknown): boolean {
  const message = reasonMessage(reason);
  if (!message) return false;
  if (message.includes(DAWN_INSTANCE_DROPPED)) return true;
  return EXPLICIT_GPU_DEVICE_LOSS.test(message);
}

export function isSoftwareAdapter(
  adapter: { info?: { isFallbackAdapter?: boolean }; isFallbackAdapter?: boolean } | null,
): boolean {
  if (adapter == null) return false;
  return adapter.info?.isFallbackAdapter === true || adapter.isFallbackAdapter === true;
}

export function gpuStartupDeadline<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (timer !== undefined) clearTimeout(timer);
    };

    timer = setTimeout(() => {
      clear();
      if (settled) return;
      settled = true;
      reject(new Error(`GPU startup timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    work.then(
      (value) => {
        clear();
        if (settled) return;
        settled = true;
        resolve(value);
      },
      (error: unknown) => {
        clear();
        if (settled) return;
        settled = true;
        reject(error);
      },
    );
  });
}
