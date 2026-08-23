import { mkdirSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import type { EventBus } from "./event-bus.js";
import type { SubagentManager } from "../lib/index.js";
import type { AgentLoaderOptions } from "./agent-loader.js";
import { getAgentCrons, prepareAgentGeneration, publishPreparedAgentGeneration } from "./agent-loader.js";
import type { AgentGenerationPublication, PreparedAgentGeneration } from "./loader/agent-registry-loader.js";
import { discardAgentGeneration } from "./loader/agent-registry-loader.js";
import { invalidateRuntimeModuleCache } from "../lib/runtime-import.js";

export type AppGenerationReloadResult = {
  appIds: string[];
  taskApps: number;
};

export type RuntimeReloadResult = {
  ok: boolean;
  summary: string;
};

type ExecFileFn = (
  file: string,
  args: string[],
  options: { timeout: number },
  callback: (error: Error | null, stdout: string, stderr: string) => void,
) => unknown;

export interface InstanceIdentity {
  pid: number;
  agent: string;
  instance: string;
  socket: string;
  startedAt: string;
  startedBy: string;
  task: string | null;
  status: "running" | "done" | "error";
  exitCode?: number | null;
  endedAt?: string;
  duration?: string;
  sessionId?: string;
}

export function formatDurationMs(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return seconds + "s";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return minutes + "m" + secs + "s";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours + "h" + mins + "m";
}

export function createIdentityWriter(opts: {
  persistDir: string;
  instanceLabel: string;
}): (data: Partial<InstanceIdentity>) => void {
  const identityPath = resolve(opts.persistDir, "instances", opts.instanceLabel, "identity.json");
  return (data: Partial<InstanceIdentity>) => {
    const dir = resolve(opts.persistDir, "instances", opts.instanceLabel);
    mkdirSync(dir, { recursive: true });
    writeFileSync(identityPath, JSON.stringify(data, null, 2));
  };
}

export function startSupervisorRestarter(bus: Pick<EventBus, "emit">, execFileImpl: ExecFileFn = execFile): void {
  execFileImpl("supervisorctl", ["start", "may-agent-restarter"], { timeout: 10000 }, (err, stdout, stderr) => {
    if (err) {
      const detail = stderr.trim() || stdout.trim() || err.message;
      bus.emit({ type: "info", message: `[restart] Failed to start supervisor restarter: ${detail}` });
    }
  });
}

export function createDaemonLifecycle(opts: {
  bus: EventBus;
  manager: SubagentManager;
  loaderOpts: AgentLoaderOptions;
  closeAllDbs: () => void;
  writeIdentity: (data: Partial<InstanceIdentity>) => void;
  processStartTime: number;
  getTelegramBot: () => { close: () => void } | undefined;
  getActiveReadline: () => { close: () => void } | null;
  clearActiveReadline: () => void;
  beforeShutdown?: () => void;
  prepareAgents?: typeof prepareAgentGeneration;
  publishAgents?: typeof publishPreparedAgentGeneration;
  reloadApps?: (input: {
    agents: PreparedAgentGeneration;
    publishAgents: () => void;
  }) => Promise<AppGenerationReloadResult>;
}) {
  let shuttingDown = false;

  const gracefulShutdown = (shutdownOpts: { preserveSessions?: boolean } = {}) => {
    if (shuttingDown) {
      process.kill(process.pid, "SIGKILL");
      return;
    }
    shuttingDown = true;
    opts.bus.emit({ type: "info", message: "Shutting down..." });
    opts.beforeShutdown?.();

    for (const cron of getAgentCrons().values()) {
      cron.stop();
    }

    opts.getTelegramBot()?.close();

    const activeRL = opts.getActiveReadline();
    if (activeRL) {
      activeRL.close();
      opts.clearActiveReadline();
    }

    if (shutdownOpts.preserveSessions) {
      opts.bus.emit({ type: "info", message: "[shutdown] Preserving running sessions for restart/resume" });
    } else {
      for (const session of opts.manager.status()) {
        if (session.status === "running") {
          opts.manager.cancel(session.sessionId);
        }
      }
    }

    setTimeout(() => {
      try {
        opts.closeAllDbs();
      } catch {
        /* best-effort */
      }
      process.exit(0);
    }, 2000);
    setTimeout(() => process.kill(process.pid, "SIGKILL"), 5000).unref();
  };

  const gracefulRestart = () => {
    startSupervisorRestarter(opts.bus);
  };

  const handleReload = async (reloadOptions: { throwOnError?: boolean } = {}): Promise<RuntimeReloadResult> => {
    invalidateRuntimeModuleCache();
    let added: string[] = [];
    let updated: string[] = [];
    const errors: string[] = [];
    let appGeneration: AppGenerationReloadResult | undefined;
    let publication: AgentGenerationPublication | undefined;
    let agents: PreparedAgentGeneration | undefined;
    try {
      const prepared = await (opts.prepareAgents ?? prepareAgentGeneration)(opts.loaderOpts);
      agents = prepared;
      added = prepared.added;
      updated = prepared.updated;
      const publishAgents = () => {
        if (publication) throw new Error("Agent generation was published more than once");
        publication = (opts.publishAgents ?? publishPreparedAgentGeneration)(opts.loaderOpts, prepared);
      };
      if (opts.reloadApps) {
        appGeneration = await opts.reloadApps({ agents: prepared, publishAgents });
        if (!publication) throw new Error("App generation committed without publishing its prepared agent generation");
      } else {
        publishAgents();
      }
      publication?.finalize();
    } catch (err) {
      try {
        if (publication) publication.rollback();
        else if (agents) discardAgentGeneration(agents);
      } catch (rollbackError) {
        errors.push(
          `[agent-rollback] ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
        );
      }
      errors.push(`[runtime-generation] ${err instanceof Error ? err.message : String(err)}`);
    }
    let summary: string;
    if (errors.length > 0) {
      summary = `[reload] Validation errors:\n${errors.join("\n")}`;
    } else if (added.length > 0 || updated.length > 0) {
      const parts: string[] = [];
      if (added.length > 0) parts.push(`${added.length} new (${added.join(", ")})`);
      if (updated.length > 0) parts.push(`${updated.length} updated (${updated.join(", ")})`);
      if (appGeneration && appGeneration.taskApps > 0) {
        parts.push(`${appGeneration.taskApps} task-enabled App(s)`);
      }
      if (appGeneration) parts.push(`${appGeneration.appIds.length} durable App address(es)`);
      summary = `[reload] ${parts.join(", ")}`;
    } else {
      summary = appGeneration
        ? `[reload] ${appGeneration.taskApps} task-enabled App(s), ${appGeneration.appIds.length} durable App address(es)`
        : "[reload] No changes";
    }
    // info events are forwarded to stdout by attachConsoleUI (chat/console
    // mode) or attachDaemonInfoLog (default daemon mode). See
    // src/app/transport/daemon-info-log.ts.
    opts.bus.emit({ type: "info", message: summary });
    const ok = errors.length === 0;
    if (reloadOptions.throwOnError && !ok) {
      throw new Error(summary);
    }
    return { ok, summary };
  };

  const installProcessHandlers = () => {
    process.on("SIGINT", () => {
      gracefulShutdown();
    });
    process.on("SIGTERM", () => {
      opts.bus.emit({ type: "info", message: "[signal] SIGTERM received" });
      gracefulShutdown({ preserveSessions: true });
    });
    process.on("SIGHUP", () => {
      opts.bus.emit({ type: "info", message: "[signal] SIGHUP received (ignoring)" });
    });
    process.on("uncaughtException", (err) => {
      try {
        console.error(`[fatal] Uncaught exception: ${err.message}\n${err.stack}`);
      } catch {}
      try {
        opts.closeAllDbs();
      } catch {}
      process.exit(1);
    });
    process.on("unhandledRejection", (reason) => {
      try {
        console.error(`[fatal] Unhandled rejection: ${reason}`);
      } catch {}
    });
    process.on("exit", (code) => {
      try {
        opts.closeAllDbs();
      } catch {}
      try {
        opts.writeIdentity({
          status: code === 0 ? "done" : "error",
          exitCode: code,
          endedAt: new Date().toISOString(),
          duration: formatDurationMs(Date.now() - opts.processStartTime),
        });
      } catch {}
    });
  };

  return { gracefulShutdown, gracefulRestart, handleReload, installProcessHandlers };
}
