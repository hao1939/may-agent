import type { EventBus } from "./event-bus.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function healthUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const root = trimmed.replace(/\/v1$/, "");
  return `${root}/health/liveliness`;
}

export async function waitForModelEndpoint(opts: {
  baseUrl: string;
  bus?: EventBus;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const intervalMs = opts.intervalMs ?? 2_000;
  const url = healthUrl(opts.baseUrl);
  const deadline = Date.now() + timeoutMs;
  let attempts = 0;
  let lastError = "";

  opts.bus?.emit({
    type: "info",
    message: `[startup] Waiting for model endpoint: ${url}`,
  });

  while (Date.now() < deadline) {
    attempts++;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(Math.min(intervalMs, 5_000)) });
      if (response.ok) {
        opts.bus?.emit({
          type: "info",
          message: `[startup] Model endpoint is live after ${attempts} attempt(s)`,
        });
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await sleep(intervalMs);
  }

  throw new Error(
    `Model endpoint not live after ${Math.round(timeoutMs / 1000)}s at ${url}: ${lastError || "no response"}`,
  );
}
