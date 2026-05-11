export interface WebIdentity {
  pid: number;
  agent: "web";
  instance: string;
  socket: "";
  startedAt: string;
  startedBy: "web";
  task: null;
  status: "running";
}

export function parseWebPort(value: string | undefined): number {
  const port = parseInt(value || "8080", 10);
  return Number.isFinite(port) ? port : 8080;
}

export async function startWebMode(opts: {
  stateDir: string;
  port: number;
}): Promise<{ port: number }> {
  const { startWebUI } = await import("../../../packages/webui/src/server.js");
  return startWebUI({ stateDir: opts.stateDir, port: opts.port });
}

export async function runWebOnlyMode(opts: {
  stateDir: string;
  port: number;
  instanceLabel: string;
  writeIdentity: (identity: WebIdentity) => void;
}): Promise<never> {
  const { port } = await startWebMode({ stateDir: opts.stateDir, port: opts.port });
  opts.writeIdentity({
    pid: process.pid,
    agent: "web",
    instance: opts.instanceLabel,
    socket: "",
    startedAt: new Date().toISOString(),
    startedBy: "web",
    task: null,
    status: "running",
  });
  console.log(`[web] Dashboard running on http://localhost:${port}`);
  setInterval(() => {}, 30_000);
  return await new Promise<never>(() => {});
}
