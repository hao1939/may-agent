import type { SubagentManager } from "../../lib/index.js";

export function parseOneshotTimeoutMinutes(argv: string[]): number {
  const arg = argv.find((a) => a.startsWith("--timeout="));
  if (!arg) return 5;

  const val = parseInt(arg.split("=")[1]!, 10);
  return Number.isFinite(val) ? val : 5;
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
  const sessionId = opts.manager.run(opts.agentName, opts.task, { kind: "job" });

  const timeoutTimer = setTimeout(() => {
    opts.manager.cancel(sessionId);
    const result = {
      sessionId,
      status: "timeout",
      duration: `${opts.timeoutMinutes}m`,
      result: `Session timed out after ${opts.timeoutMinutes} minutes`,
    };
    console.log(JSON.stringify(result));
    process.exit(1);
  }, timeoutMs);
  timeoutTimer.unref();

  await opts.manager.waitForIdle(sessionId);
  clearTimeout(timeoutTimer);

  const sessions = opts.manager.status();
  const session = sessions.find((s) => s.sessionId === sessionId);
  const status = session?.status === "error" || session?.status === "interrupted" ? "error" : "success";

  const result = {
    sessionId,
    status,
    duration: opts.formatDurationMs(Date.now() - startedAt),
    result: session ? `Agent ${opts.agentName} completed (${session.status})` : `Agent ${opts.agentName} completed`,
  };
  console.log(JSON.stringify(result));

  return status === "success" ? 0 : 1;
}
