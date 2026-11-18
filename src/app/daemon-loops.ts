import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EventBus } from "./core/events/bus.js";
import { readSqlPerformance } from "../lib/db/query-performance.js";
import { currentProcessInstance, type ProcessInstance } from "../lib/process-identity.js";

export type DaemonHeartbeatRecord = ProcessInstance & {
  version: 1;
  recordedAt: number;
  interfaceAgent: string;
  socketEnabled: boolean;
  sql: {
    since: number;
    calls: number;
    errors: number;
    totalMs: number;
    untrackedCalls: number;
  };
};

export function daemonHeartbeatPath(persistDir: string, instanceLabel: string, interfaceAgent: string): string {
  return resolve(persistDir, "instances", instanceLabel, `${interfaceAgent}.heartbeat.json`);
}

export function writeDaemonHeartbeat(path: string, record: DaemonHeartbeatRecord): void {
  mkdirSync(resolve(path, ".."), { recursive: true });
  const stage = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(stage, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(stage, path);
  } finally {
    rmSync(stage, { force: true });
  }
}

export async function runDaemonKeepalive(opts: {
  bus: EventBus;
  persistDir: string;
  instanceLabel: string;
  interfaceAgent: string;
  socketEnabled: boolean;
}): Promise<never> {
  const heartbeatPath = daemonHeartbeatPath(opts.persistDir, opts.instanceLabel, opts.interfaceAgent);
  const emitHeartbeat = () => {
    try {
      const { since, calls, errors, totalMs, untracked } = readSqlPerformance();
      writeDaemonHeartbeat(heartbeatPath, {
        version: 1,
        recordedAt: Date.now(),
        ...currentProcessInstance(),
        interfaceAgent: opts.interfaceAgent,
        socketEnabled: opts.socketEnabled,
        // Cumulative counters make interval cost reconstructable from successive
        // reads of this bounded record. Query details remain an on-demand read.
        sql: { since, calls, errors, totalMs, untrackedCalls: untracked.calls },
      });
    } catch (error) {
      // A missing observation must not stop work. Keep the diagnostic outside
      // the event/database path and try again at the next ordinary interval.
      console.error(JSON.stringify({ type: "runtime.daemon.heartbeat.failed", error: String(error) }));
    }
  };

  opts.bus.emit({
    type: "info",
    message: `[daemon] Running. Interface agent: ${opts.interfaceAgent}.${opts.socketEnabled ? " Use socket for control." : " Socket disabled — no external control available."}`,
  });

  emitHeartbeat();
  const heartbeatTimer = setInterval(emitHeartbeat, 60_000);

  process.stdin.on("end", () => {});
  process.stdin.resume();

  try {
    return await new Promise<never>(() => {});
  } finally {
    clearInterval(heartbeatTimer);
  }
}
