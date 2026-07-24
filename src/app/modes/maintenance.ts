import { spawnSync } from "node:child_process";
import { runDbMaintenancePass } from "../../lib/db/maintenance.js";
import { closeAllDbs } from "../../lib/db/connection.js";
import { daemonSocketPath, sendSocketCommand } from "../../../packages/control/src/client.js";

const LIVENESS_INTERVAL_MS = 30_000;
const LIVENESS_STARTUP_GRACE_MS = 2 * 60_000;
const LIVENESS_FAILURE_THRESHOLD = 6;
const LIVENESS_RESTART_COOLDOWN_MS = 10 * 60_000;
const LIVENESS_PROBE_TIMEOUT_MS = 5_000;

export type RuntimeLivenessState = {
  consecutiveFailures: number;
  lastRestartAt: number;
};

export function observeRuntimeLiveness(
  state: RuntimeLivenessState,
  healthy: boolean,
  now: number,
  opts: { failureThreshold?: number; restartCooldownMs?: number } = {},
): { state: RuntimeLivenessState; requestRestart: boolean } {
  if (healthy) {
    return {
      state: { ...state, consecutiveFailures: 0 },
      requestRestart: false,
    };
  }
  const consecutiveFailures = state.consecutiveFailures + 1;
  const threshold = Math.max(1, opts.failureThreshold ?? LIVENESS_FAILURE_THRESHOLD);
  const cooldownMs = Math.max(0, opts.restartCooldownMs ?? LIVENESS_RESTART_COOLDOWN_MS);
  const cooledDown = state.lastRestartAt === 0 || now - state.lastRestartAt >= cooldownMs;
  return {
    state: { ...state, consecutiveFailures },
    requestRestart: consecutiveFailures >= threshold && cooledDown,
  };
}

async function daemonResponsive(persistDir: string): Promise<boolean> {
  const socketPath = daemonSocketPath(persistDir, {
    instance: process.env.INSTANCE || "default",
    interfaceAgent: process.env.DAEMON_AGENT || "may",
  });
  try {
    await sendSocketCommand(socketPath, { type: "status" }, { timeoutMs: LIVENESS_PROBE_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

function requestSupervisorRestart(): boolean {
  const result = spawnSync("supervisorctl", ["start", "may-agent-restarter"], {
    encoding: "utf8",
    timeout: 10_000,
  });
  return result.status === 0;
}

function parseIntervalMs(argv: string[]): number {
  const index = argv.indexOf("--maintenance-interval-ms");
  const value = index >= 0 ? Number(argv[index + 1]) : 60 * 60 * 1_000;
  return Number.isFinite(value) ? Math.max(60_000, value) : 60 * 60 * 1_000;
}

export async function runMaintenanceMode(opts: { persistDir: string; argv?: string[] }): Promise<void> {
  const argv = opts.argv ?? process.argv;
  const once = argv.includes("--maintenance-once");
  const intervalMs = parseIntervalMs(argv);
  let stopping = false;
  let livenessRunning = false;
  const livenessNotBefore = Date.now() + LIVENESS_STARTUP_GRACE_MS;
  let livenessState: RuntimeLivenessState = {
    consecutiveFailures: 0,
    lastRestartAt: 0,
  };
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  const livenessTimer = once
    ? null
    : setInterval(() => {
        if (stopping || livenessRunning || Date.now() < livenessNotBefore) return;
        livenessRunning = true;
        void daemonResponsive(opts.persistDir)
          .then((healthy) => {
            const observed = observeRuntimeLiveness(livenessState, healthy, Date.now());
            livenessState = observed.state;
            if (!observed.requestRestart) return;
            const requestedAt = Date.now();
            const restarted = requestSupervisorRestart();
            console[restarted ? "log" : "error"](
              JSON.stringify({
                type: restarted ? "runtime.liveness.restart_requested" : "runtime.liveness.restart_failed",
                requestedAt,
                consecutiveFailures: livenessState.consecutiveFailures,
              }),
            );
            if (restarted) {
              livenessState = {
                consecutiveFailures: 0,
                lastRestartAt: requestedAt,
              };
            }
          })
          .finally(() => {
            livenessRunning = false;
          });
      }, LIVENESS_INTERVAL_MS);

  try {
    do {
      const startedAt = Date.now();
      try {
        const result = runDbMaintenancePass(opts.persistDir);
        console.log(
          JSON.stringify({
            type: "db.maintenance.completed",
            startedAt,
            durationMs: Date.now() - startedAt,
            ...result,
          }),
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            type: "db.maintenance.failed",
            startedAt,
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
      if (once || stopping) break;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          clearInterval(poll);
          resolve();
        }, intervalMs);
        const poll = setInterval(() => {
          if (!stopping) return;
          clearInterval(poll);
          clearTimeout(timer);
          resolve();
        }, 250);
      });
    } while (!stopping);
  } finally {
    if (livenessTimer) clearInterval(livenessTimer);
    closeAllDbs();
  }
}
