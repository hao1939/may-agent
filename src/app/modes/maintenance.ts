import { spawnSync } from "node:child_process";
import { runDbMaintenancePass } from "../../lib/db/maintenance.js";
import { closeAllDbs, getDb } from "../../lib/db/connection.js";
import { DbWriter, EVENT_DELIVERY_HOUSEKEEPING_INTERVAL_MS } from "../../lib/db-writer.js";
import { daemonSocketPath, sendSocketCommand } from "../../../packages/control/src/client.js";

const LIVENESS_INTERVAL_MS = 30_000;
const LIVENESS_STARTUP_GRACE_MS = 2 * 60_000;
const LIVENESS_FAILURE_THRESHOLD = 6;
const LIVENESS_RESTART_COOLDOWN_MS = 10 * 60_000;
const LIVENESS_PROBE_TIMEOUT_MS = 5_000;
const LIVENESS_ACTIVE_WORK_GRACE_MS = 30 * 60_000;
const LIVENESS_HEARTBEAT_FRESH_MS = 150_000;
const MAINTENANCE_STARTUP_DELAY_MS = 2 * 60_000;

export type RuntimeLivenessState = {
  consecutiveFailures: number;
  lastRestartAt: number;
  activeWorkProtectedUntil: number;
};

export type RuntimeLivenessObservation = {
  responsive: boolean;
  activeWork: boolean;
};

export function observeRuntimeLiveness(
  state: RuntimeLivenessState,
  observation: RuntimeLivenessObservation,
  now: number,
  opts: { failureThreshold?: number; restartCooldownMs?: number; activeWorkGraceMs?: number } = {},
): { state: RuntimeLivenessState; requestRestart: boolean; protectedActiveWork: boolean } {
  const activeWorkGraceMs = Math.max(0, opts.activeWorkGraceMs ?? LIVENESS_ACTIVE_WORK_GRACE_MS);
  if (observation.responsive) {
    return {
      state: {
        ...state,
        consecutiveFailures: 0,
        activeWorkProtectedUntil: observation.activeWork ? now + activeWorkGraceMs : 0,
      },
      requestRestart: false,
      protectedActiveWork: false,
    };
  }
  const consecutiveFailures = state.consecutiveFailures + 1;
  const threshold = Math.max(1, opts.failureThreshold ?? LIVENESS_FAILURE_THRESHOLD);
  const cooldownMs = Math.max(0, opts.restartCooldownMs ?? LIVENESS_RESTART_COOLDOWN_MS);
  const cooledDown = state.lastRestartAt === 0 || now - state.lastRestartAt >= cooldownMs;
  const activeWorkProtectedUntil =
    observation.activeWork && state.activeWorkProtectedUntil === 0
      ? now + activeWorkGraceMs
      : state.activeWorkProtectedUntil;
  const protectedActiveWork = now < activeWorkProtectedUntil;
  return {
    state: { ...state, consecutiveFailures, activeWorkProtectedUntil },
    requestRestart: consecutiveFailures >= threshold && cooledDown && !protectedActiveWork,
    protectedActiveWork,
  };
}

export function observeDurableDaemonHeartbeat(
  heartbeatAt: number | undefined,
  activeCount: number,
  now: number,
  freshMs = LIVENESS_HEARTBEAT_FRESH_MS,
): RuntimeLivenessObservation {
  return {
    responsive: Number.isFinite(heartbeatAt) && now - Number(heartbeatAt) <= freshMs,
    activeWork: activeCount > 0,
  };
}

async function observeDaemonLiveness(persistDir: string): Promise<RuntimeLivenessObservation> {
  const socketPath = daemonSocketPath(persistDir, {
    instance: process.env.INSTANCE || "default",
    interfaceAgent: process.env.DAEMON_AGENT || "may",
  });
  try {
    const response = await sendSocketCommand(socketPath, { type: "status" }, { timeoutMs: LIVENESS_PROBE_TIMEOUT_MS });
    return {
      responsive: true,
      activeWork: Array.isArray(response.activeAgents) && response.activeAgents.length > 0,
    };
  } catch {
    const db = getDb(persistDir);
    const heartbeat = db
      .prepare(
        `SELECT timestamp
       FROM events
       WHERE event_type = 'runtime.daemon.heartbeat'
       ORDER BY timestamp DESC
       LIMIT 1`,
      )
      .get() as { timestamp?: number } | undefined;
    const active = db
      .prepare(
        `SELECT COUNT(*) AS count
       FROM sessions
       WHERE status IN ('running', 'idle') AND endedAt IS NULL`,
      )
      .get() as { count?: number } | undefined;
    return observeDurableDaemonHeartbeat(heartbeat?.timestamp, Number(active?.count ?? 0), Date.now());
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

function parseStartupDelayMs(argv: string[]): number {
  const index = argv.indexOf("--maintenance-startup-delay-ms");
  const value = index >= 0 ? Number(argv[index + 1]) : MAINTENANCE_STARTUP_DELAY_MS;
  return Number.isFinite(value) ? Math.max(0, value) : MAINTENANCE_STARTUP_DELAY_MS;
}

async function waitForDelay(delayMs: number, stopped: () => boolean): Promise<void> {
  if (delayMs <= 0 || stopped()) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      clearInterval(poll);
      resolve();
    }, delayMs);
    const poll = setInterval(() => {
      if (!stopped()) return;
      clearInterval(poll);
      clearTimeout(timer);
      resolve();
    }, 250);
  });
}

export async function runMaintenanceMode(opts: { persistDir: string; argv?: string[] }): Promise<void> {
  const argv = opts.argv ?? process.argv;
  const once = argv.includes("--maintenance-once");
  const intervalMs = parseIntervalMs(argv);
  const startupDelayMs = parseStartupDelayMs(argv);
  let stopping = false;
  let livenessRunning = false;
  const deliveryWriter = new DbWriter(opts.persistDir, {
    housekeepingIntervalMs: once ? 0 : EVENT_DELIVERY_HOUSEKEEPING_INTERVAL_MS,
  });
  const livenessNotBefore = Date.now() + LIVENESS_STARTUP_GRACE_MS;
  let livenessState: RuntimeLivenessState = {
    consecutiveFailures: 0,
    lastRestartAt: 0,
    activeWorkProtectedUntil: 0,
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
        void observeDaemonLiveness(opts.persistDir)
          .then((observation) => {
            const observed = observeRuntimeLiveness(livenessState, observation, Date.now());
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
                activeWorkProtectedUntil: 0,
              };
            }
          })
          .finally(() => {
            livenessRunning = false;
          });
      }, LIVENESS_INTERVAL_MS);
  const deliveryTimer = once
    ? null
    : setInterval(() => deliveryWriter.runHousekeeping(), EVENT_DELIVERY_HOUSEKEEPING_INTERVAL_MS);

  try {
    if (once) deliveryWriter.runHousekeeping();
    if (!once) await waitForDelay(startupDelayMs, () => stopping);
    do {
      if (stopping) break;
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
      await waitForDelay(intervalMs, () => stopping);
    } while (!stopping);
  } finally {
    if (livenessTimer) clearInterval(livenessTimer);
    if (deliveryTimer) clearInterval(deliveryTimer);
    closeAllDbs();
  }
}
