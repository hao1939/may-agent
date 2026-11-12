import type { WebUIOptions } from "../http/server.js";

export function parseWebPort(value: string | undefined): number {
  const port = parseInt(value || "8080", 10);
  return Number.isFinite(port) ? port : 8080;
}

export async function startWebMode(opts: WebUIOptions): Promise<{ port: number }> {
  const { startWebUI } = await import("../http/server.js");
  return startWebUI({ ...opts, hostname: opts.hostname?.trim() || process.env.WEB_HOST?.trim() || undefined });
}

export async function runWebOnlyMode(opts: WebUIOptions): Promise<never> {
  const { port } = await startWebMode(opts);
  console.log(`[web] Dashboard running on http://localhost:${port}`);
  setInterval(() => {}, 30_000);
  return await new Promise<never>(() => {});
}
