export function parseWebPort(value: string | undefined): number {
  const port = parseInt(value || "8080", 10);
  return Number.isFinite(port) ? port : 8080;
}

export async function startWebMode(opts: {
  interfaceAgent?: string;
  stateDir: string;
  port: number;
}): Promise<{ port: number }> {
  const { startWebUI } = await import("../http/server.js");
  return startWebUI(opts);
}

export async function runWebOnlyMode(opts: {
  interfaceAgent?: string;
  stateDir: string;
  port: number;
}): Promise<never> {
  const { port } = await startWebMode(opts);
  console.log(`[web] Dashboard running on http://localhost:${port}`);
  setInterval(() => {}, 30_000);
  return await new Promise<never>(() => {});
}
