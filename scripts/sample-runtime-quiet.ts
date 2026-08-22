import { readFileSync, readdirSync } from "node:fs";
import { Socket } from "node:net";
import { resolve } from "node:path";
import { Database } from "bun:sqlite";

type StatusSample = {
  at: number;
  activeExecutions: number;
  pid: number;
  cpuMicros: number;
  rssBytes: number;
  heapUsedBytes: number;
  externalBytes: number;
  directChildren: number;
  runningAttempts: number;
  runningWorkflows: number;
  latestEventId: number;
  taskVersionSum: number;
  sessionCount: number;
  sessionActivityAt: number;
  sessionOperations: number;
  attemptCount: number;
  workflowCount: number;
};

type StatusResponse = {
  type?: string;
  activeAgents?: unknown;
  diagnostics?: unknown;
};

type PendingStatus = {
  resolve(response: StatusResponse): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
};

/** Reuse one socket so observation does not become the daemon's measured load. */
class RuntimeStatusConnection {
  private readonly socket = new Socket();
  private readonly connected: Promise<void>;
  private readonly pending: PendingStatus[] = [];
  private buffer = "";
  private failed?: Error;

  constructor(socketPath: string) {
    this.connected = new Promise<void>((resolveConnected, rejectConnected) => {
      this.socket.once("connect", resolveConnected);
      this.socket.once("error", rejectConnected);
    });
    this.socket.on("data", (chunk) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        try {
          const response = JSON.parse(line) as StatusResponse;
          if (response.type !== "status") continue;
          const request = this.pending.shift();
          if (!request) continue;
          clearTimeout(request.timer);
          request.resolve(response);
        } catch {
          // Ignore the initial connected frame and malformed unrelated output.
        }
      }
    });
    const fail = (error: unknown) => {
      this.failed = error instanceof Error ? error : new Error(String(error));
      for (const request of this.pending.splice(0)) {
        clearTimeout(request.timer);
        request.reject(this.failed);
      }
    };
    this.socket.on("error", fail);
    this.socket.on("close", () => fail(new Error("Runtime status socket closed")));
    this.socket.connect(socketPath);
  }

  async read(): Promise<StatusResponse> {
    await this.connected;
    if (this.failed) throw this.failed;
    return await new Promise<StatusResponse>((resolveResponse, rejectResponse) => {
      const request: PendingStatus = {
        resolve: resolveResponse,
        reject: rejectResponse,
        timer: setTimeout(() => {
          const index = this.pending.indexOf(request);
          if (index >= 0) this.pending.splice(index, 1);
          rejectResponse(new Error("Runtime status request timed out"));
        }, 5_000),
      };
      this.pending.push(request);
      this.socket.write(`${JSON.stringify({ type: "status", diagnostics: true })}\n`);
    });
  }

  close(): void {
    this.socket.destroy();
  }
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

function positiveNumber(name: string, fallback: number): number {
  const value = Number(option(name, String(fallback)));
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
}

const clockTicksPerSecond = Number(Bun.spawnSync(["getconf", "CLK_TCK"]).stdout.toString().trim()) || 100;

function processCpuMicros(pid: number): number {
  const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
  const afterName = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  const ticks = Number(afterName[11] ?? 0) + Number(afterName[12] ?? 0);
  return (ticks / clockTicksPerSecond) * 1_000_000;
}

function processRssBytes(pid: number): number {
  const status = readFileSync(`/proc/${pid}/status`, "utf8");
  const kib = Number(status.match(/^VmRSS:\s+(\d+)\s+kB$/m)?.[1] ?? 0);
  return kib * 1_024;
}

function countChildren(pid: number): number {
  let count = 0;
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
      const afterName = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      if (Number(afterName[1]) === pid) count += 1;
    } catch {
      // A process may exit while /proc is being sampled.
    }
  }
  return count;
}

function scalar(db: Database, sql: string): number {
  const row = db.query(sql).get() as { value?: number } | null;
  return Number(row?.value ?? 0);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function runtimePid(response: StatusResponse, pidOverride?: number): number {
  const diagnostics = record(response.diagnostics);
  const pid = pidOverride ?? Number(diagnostics.pid);
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new Error("Daemon status does not expose a valid diagnostics.pid; pass --pid only for an older Runtime");
  }
  return pid;
}

function statusMemory(response: StatusResponse): { heapUsedBytes: number; externalBytes: number } {
  const memory = record(record(response.diagnostics).memory);
  return {
    heapUsedBytes: Number(memory.heapUsedBytes ?? 0),
    externalBytes: Number(memory.externalBytes ?? 0),
  };
}

function statusActiveExecutions(response: StatusResponse): number {
  return Array.isArray(response.activeAgents)
    ? response.activeAgents.filter((item) => record(item).status === "running").length
    : 0;
}

function statusSample(
  db: Database,
  pid: number,
  activeExecutions: number,
  memory: { heapUsedBytes: number; externalBytes: number },
): StatusSample {
  return {
    at: Date.now(),
    activeExecutions,
    pid,
    cpuMicros: processCpuMicros(pid),
    rssBytes: processRssBytes(pid),
    heapUsedBytes: memory.heapUsedBytes,
    externalBytes: memory.externalBytes,
    directChildren: countChildren(pid),
    runningAttempts: scalar(db, "SELECT COUNT(*) AS value FROM app_task_attempts WHERE state = 'running'"),
    runningWorkflows: scalar(db, "SELECT COUNT(*) AS value FROM workflow_runs WHERE status = 'running'"),
    latestEventId: scalar(db, "SELECT COALESCE(MAX(id), 0) AS value FROM events"),
    taskVersionSum: scalar(db, "SELECT COALESCE(SUM(resource_version), 0) AS value FROM app_tasks"),
    sessionCount: scalar(db, "SELECT COUNT(*) AS value FROM sessions"),
    sessionActivityAt: scalar(
      db,
      "SELECT COALESCE(MAX(MAX(startedAt, COALESCE(lastActivityAt, 0), COALESCE(endedAt, 0))), 0) AS value FROM sessions",
    ),
    sessionOperations: scalar(db, "SELECT COALESCE(SUM(opCount), 0) AS value FROM sessions"),
    attemptCount: scalar(db, "SELECT COUNT(*) AS value FROM app_task_attempts"),
    workflowCount: scalar(db, "SELECT COUNT(*) AS value FROM workflow_runs"),
  };
}

const socketPath = resolve(option("--socket", "/app/.state/instances/background/may.sock"));
const stateDir = resolve(option("--state-dir", "/app/.state"));
const durationMs = positiveNumber("--seconds", 30) * 1_000;
const intervalMs = positiveNumber("--interval-ms", 1_000);
const pidOption = Number(option("--pid", "0"));
const pidOverride = Number.isSafeInteger(pidOption) && pidOption > 0 ? pidOption : undefined;
const db = new Database(resolve(stateDir, "may.db"), { readonly: true, strict: true });
const status = new RuntimeStatusConnection(socketPath);
const samples: StatusSample[] = [];

try {
  const initialStatus = await status.read();
  const pid = runtimePid(initialStatus, pidOverride);
  let activeExecutions = statusActiveExecutions(initialStatus);
  let memory = statusMemory(initialStatus);
  const deadline = Date.now() + durationMs;
  samples.push(statusSample(db, pid, activeExecutions, memory));
  while (Date.now() < deadline) {
    await Bun.sleep(Math.min(intervalMs, Math.max(1, deadline - Date.now())));
    if (Date.now() >= deadline) {
      const finalStatus = await status.read();
      activeExecutions = statusActiveExecutions(finalStatus);
      memory = statusMemory(finalStatus);
    }
    samples.push(statusSample(db, pid, activeExecutions, memory));
  }
} finally {
  status.close();
  db.close();
}

const first = samples[0]!;
const last = samples.at(-1)!;
const elapsedSeconds = Math.max(0.001, (last.at - first.at) / 1_000);
const cpuPercent = (Math.max(0, last.cpuMicros - first.cpuMicros) / 1_000_000 / elapsedSeconds) * 100;
const maximum = (field: keyof StatusSample) => Math.max(...samples.map((sample) => Number(sample[field])));
const minimum = (field: keyof StatusSample) => Math.min(...samples.map((sample) => Number(sample[field])));
const reasons = [
  ...(maximum("activeExecutions") > 0 ? ["agent execution was active"] : []),
  ...(maximum("runningAttempts") > 0 ? ["a Task attempt was active"] : []),
  ...(maximum("runningWorkflows") > 0 ? ["a workflow was active"] : []),
  ...(maximum("directChildren") > 0 ? ["the daemon had a child process"] : []),
  ...(last.latestEventId !== first.latestEventId ? ["new durable events were recorded"] : []),
  ...(last.taskVersionSum !== first.taskVersionSum ? ["Task resources changed"] : []),
  ...(last.sessionCount !== first.sessionCount ||
  last.sessionActivityAt !== first.sessionActivityAt ||
  last.sessionOperations !== first.sessionOperations
    ? ["agent session activity was recorded"]
    : []),
  ...(last.attemptCount !== first.attemptCount ? ["Task attempts were recorded"] : []),
  ...(last.workflowCount !== first.workflowCount ? ["workflow runs were recorded"] : []),
];
const result = {
  validQuietWindow: reasons.length === 0,
  invalidReasons: reasons,
  pid: first.pid,
  elapsedSeconds,
  samples: samples.length,
  cpuPercent,
  eventIdDelta: last.latestEventId - first.latestEventId,
  rssBytes: { min: minimum("rssBytes"), max: maximum("rssBytes"), delta: last.rssBytes - first.rssBytes },
  heapUsedBytes: {
    min: minimum("heapUsedBytes"),
    max: maximum("heapUsedBytes"),
    delta: last.heapUsedBytes - first.heapUsedBytes,
  },
  externalBytes: {
    min: minimum("externalBytes"),
    max: maximum("externalBytes"),
    delta: last.externalBytes - first.externalBytes,
  },
  maxima: {
    activeExecutions: maximum("activeExecutions"),
    runningAttempts: maximum("runningAttempts"),
    runningWorkflows: maximum("runningWorkflows"),
    directChildren: maximum("directChildren"),
  },
};

console.log(JSON.stringify(result, null, 2));
if (!result.validQuietWindow) process.exitCode = 2;
