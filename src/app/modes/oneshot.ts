import type { SubagentManager } from "../../lib/index.js";

export function parseOneshotTimeoutMinutes(argv: string[]): number {
  const arg = argv.find((a) => a.startsWith("--timeout="));
  if (!arg) return 5;

  const val = parseInt(arg.split("=")[1]!, 10);
  return Number.isFinite(val) && val > 0 && val * 60_000 <= 2_147_483_647 ? val : 5;
}

export async function runOneshotMode(opts: {
  task: string | null;
  agentName: string;
  manager: SubagentManager;
  timeoutMinutes: number;
  formatDurationMs: (ms: number) => string;
}): Promise<number> {
  if (!opts.task) {
    throw new Error("Error: --oneshot requires --task <description>");
  }

  const startedAt = Date.now();
  const timeoutMs = opts.timeoutMinutes * 60 * 1000;
  const sessionId = opts.manager.run(opts.agentName, opts.task, { kind: "call", timeoutMs });
  const execution = await opts.manager.waitFor(sessionId);
  const status = execution.status === "done" ? "success" : "error";

  const result = {
    sessionId,
    status,
    duration: opts.formatDurationMs(Date.now() - startedAt),
    result: execution.lastAssistantText ?? execution.error ?? "",
    ...(execution.error ? { error: execution.error } : {}),
    ...(execution.structuredResult !== undefined ? { output: execution.structuredResult } : {}),
  };
  console.log(JSON.stringify(result));

  return status === "success" ? 0 : 1;
}
