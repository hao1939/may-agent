import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Database } from "bun:sqlite";
import { sendSocketCommand } from "../packages/control/src/client.js";

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
};

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
  return ticks / clockTicksPerSecond * 1_000_000;
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

async function statusSample(socketPath: string, db: Database, pidOverride?: number): Promise<StatusSample> {
  const response = await sendSocketCommand(socketPath, { type: "status", diagnostics: true });
  const diagnostics = record(response.diagnostics);
  const cpu = record(diagnostics.cpu);
  const memory = record(diagnostics.memory);
  const pid = pidOverride ?? Number(diagnostics.pid);
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new Error("Daemon status does not expose a valid diagnostics.pid; pass --pid only for an older Runtime");
  }
  const reportedCpuMicros = Number(cpu.userMicros ?? 0) + Number(cpu.systemMicros ?? 0);
  return {
    at: Date.now(),
    activeExecutions: Array.isArray(response.activeAgents)
      ? response.activeAgents.filter((item) => record(item).status === "running").length
      : 0,
    pid,
    cpuMicros: reportedCpuMicros > 0 ? reportedCpuMicros : processCpuMicros(pid),
    rssBytes: Number(memory.rssBytes ?? 0),
    heapUsedBytes: Number(memory.heapUsedBytes ?? 0),
    externalBytes: Number(memory.externalBytes ?? 0),
    directChildren: countChildren(pid),
    runningAttempts: scalar(db, "SELECT COUNT(*) AS value FROM app_task_attempts WHERE state = 'running'"),
    runningWorkflows: scalar(db, "SELECT COUNT(*) AS value FROM workflow_runs WHERE status = 'running'"),
    latestEventId: scalar(db, "SELECT COALESCE(MAX(id), 0) AS value FROM events"),
  };
}

const socketPath = resolve(option("--socket", "/app/.state/instances/background/may.sock"));
const stateDir = resolve(option("--state-dir", "/app/.state"));
const durationMs = positiveNumber("--seconds", 30) * 1_000;
const intervalMs = positiveNumber("--interval-ms", 1_000);
const pidOption = Number(option("--pid", "0"));
const pidOverride = Number.isSafeInteger(pidOption) && pidOption > 0 ? pidOption : undefined;
const db = new Database(resolve(stateDir, "may.db"), { readonly: true, strict: true });
const samples: StatusSample[] = [];

try {
  const deadline = Date.now() + durationMs;
  samples.push(await statusSample(socketPath, db, pidOverride));
  while (Date.now() < deadline) {
    await Bun.sleep(Math.min(intervalMs, Math.max(1, deadline - Date.now())));
    samples.push(await statusSample(socketPath, db, pidOverride));
  }
} finally {
  db.close();
}

const first = samples[0]!;
const last = samples.at(-1)!;
const elapsedSeconds = Math.max(0.001, (last.at - first.at) / 1_000);
const cpuPercent = Math.max(0, last.cpuMicros - first.cpuMicros) / 1_000_000 / elapsedSeconds * 100;
const maximum = (field: keyof StatusSample) => Math.max(...samples.map((sample) => Number(sample[field])));
const minimum = (field: keyof StatusSample) => Math.min(...samples.map((sample) => Number(sample[field])));
const reasons = [
  ...(maximum("activeExecutions") > 0 ? ["agent execution was active"] : []),
  ...(maximum("runningAttempts") > 0 ? ["a Task attempt was active"] : []),
  ...(maximum("runningWorkflows") > 0 ? ["a workflow was active"] : []),
  ...(maximum("directChildren") > 0 ? ["the daemon had a child process"] : []),
  ...(last.latestEventId !== first.latestEventId ? ["new durable events were recorded"] : []),
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
