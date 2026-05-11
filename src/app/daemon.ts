import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { exec } from "node:child_process";
import type { EventBus } from "./event-bus.js";
import type { SubagentManager } from "../lib/index.js";
import type { ModelWithApiKey } from "../lib/types.js";
import type { AgentLoaderOptions } from "./agent-loader.js";
import {
  generateAutoHeartbeats,
  getAgentCrons,
  loadAgents,
  reloadAgents,
  runAgentCleanup,
  setAgentSessionId,
} from "./agent-loader.js";
import { DbWriter } from "../lib/db-writer.js";
import {
  createAutoResume,
  createDigestWriter,
  createLastSessionWriter,
  createStuckDetector,
} from "../lib/session-subscribers.js";
import { log } from "../lib/log.js";

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

export function createDaemonLifecycle(opts: {
  bus: EventBus;
  manager: SubagentManager;
  loaderOpts: AgentLoaderOptions;
  closeAllDbs: () => void;
  writeIdentity: (data: Partial<InstanceIdentity>) => void;
  processStartTime: number;
  getChatSession: () => { cancelAll: () => void } | undefined;
  getTelegramBot: () => { close: () => void } | undefined;
  getActiveReadline: () => { close: () => void } | null;
  clearActiveReadline: () => void;
}) {
  let shuttingDown = false;

  const gracefulShutdown = (shutdownOpts: { preserveSessions?: boolean } = {}) => {
    if (shuttingDown) {
      process.kill(process.pid, "SIGKILL");
      return;
    }
    shuttingDown = true;
    opts.bus.emit({ type: "info", message: "Shutting down..." });

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
      opts.getChatSession()?.cancelAll();
      for (const session of opts.manager.status()) {
        if (session.status === "running") {
          opts.manager.cancel(session.sessionId);
        }
      }
    }

    setTimeout(() => {
      try { opts.closeAllDbs(); } catch { /* best-effort */ }
      process.exit(0);
    }, 2000);
    setTimeout(() => process.kill(process.pid, "SIGKILL"), 5000).unref();
  };

  const gracefulRestart = () => {
    exec("supervisorctl restart may-agent", { timeout: 10000 });
  };

  const handleReload = async (): Promise<void> => {
    const result = await reloadAgents(opts.loaderOpts);
    if (result.errors.length > 0) {
      opts.bus.emit({ type: "info", message: `[reload] Validation errors:\n${result.errors.join("\n")}` });
    } else if (result.added.length > 0 || result.updated.length > 0) {
      const parts: string[] = [];
      if (result.added.length > 0) parts.push(`${result.added.length} new (${result.added.join(", ")})`);
      if (result.updated.length > 0) parts.push(`${result.updated.length} updated (${result.updated.join(", ")})`);
      opts.bus.emit({ type: "info", message: `[reload] ${parts.join(", ")}` });
    } else {
      opts.bus.emit({ type: "info", message: "[reload] No changes" });
    }
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
      try { console.error(`[fatal] Uncaught exception: ${err.message}\n${err.stack}`); } catch {}
      try { opts.closeAllDbs(); } catch {}
      process.exit(1);
    });
    process.on("unhandledRejection", (reason) => {
      try { console.error(`[fatal] Unhandled rejection: ${reason}`); } catch {}
    });
    process.on("exit", (code) => {
      try { opts.closeAllDbs(); } catch {}
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

export function attachEventPersistence(opts: {
  bus: EventBus;
  persistDir: string;
}): void {
  const dbWriter = new DbWriter(opts.persistDir);
  opts.bus.subscribe(dbWriter.handler, { priority: "first" });
}

export function attachDaemonEventSubscribers(opts: {
  bus: EventBus;
  manager: SubagentManager;
  persistDir: string;
  projectRoot: string;
}): void {
  const { bus, manager, persistDir, projectRoot } = opts;

  bus.subscribe(createDigestWriter(persistDir));
  bus.subscribe(createLastSessionWriter(projectRoot));
  bus.subscribe(createStuckDetector(
    (sessionId, _reason) => {
      bus.emit({ type: "cancel", sessionId } as any);
    },
    (agent, sessionId, reason) => {
      bus.emit({
        type: "message.created",
        from: "system:circuit-breaker",
        to: "may",
        content: `[circuit-breaker] Agent "${agent}" terminated (session ${sessionId}): ${reason}. Investigate the root cause — check the session transcript, recent errors, and whether the agent needs guidance or a code fix.`,
        intent: "investigate",
        priority: "P1",
      } as any);
    },
    persistDir,
    () => manager,
  ));
  bus.subscribe(createAutoResume(
    (sessionId, agent, _attempt) => {
      const ok = manager.resumeInterrupted(sessionId);
      if (ok) {
        log("info", `[resume] Resumed ${agent} session ${sessionId}`);
      } else {
        log("warn", `[resume] Failed to resume ${sessionId}`);
      }
    },
    (agent, _sessionId, reason) => {
      log("warn", `[resume] ${agent} exhausted resume attempts — escalating`);
      try {
        const escalationPath = resolve(persistDir, "escalations.jsonl");
        appendFileSync(escalationPath, JSON.stringify({ ts: new Date().toISOString(), agent, reason, notified: true }) + "\n", "utf-8");
      } catch { /* best-effort */ }
      bus.emit({ type: "message.created", from: "may", to: "human", content: `⚠️ *Agent Blocked*\n${agent} — ${reason}` } as any);
    },
    persistDir,
    () => manager,
  ));

  bus.subscribe((event) => {
    if (event.type === "session.start" && "agent" in event && "sessionId" in event) {
      setAgentSessionId(event.agent as string, event.sessionId as string);
    }
    if (event.type === "session.end" && "agent" in event) {
      runAgentCleanup(event.agent as string);
    }
  });

  bus.subscribe((event) => {
    if (event.type !== "session.end") return;
    const info = event as any;

    if (info.error && info.status === "error") {
      bus.emit({ type: "session.failed",
        sessionId: info.sessionId, agent: info.agent, error: info.error, task: info.task,
      } as any);
    }

    const fp = info.finishParams;
    if (fp && (fp.status === "blocked" || fp.status === "failure")) {
      bus.emit({ type: "session.escalated",
        sessionId: info.sessionId, agent: info.agent, finishParams: fp,
      } as any);
    }

    if (info.agent !== "evaluator" && info.agent !== "judge") {
      bus.emit({ type: "session.completed",
        sessionId: info.sessionId, agent: info.agent,
        parentSessionId: info.parentSessionId, outcome: info.outcome,
        status: info.status, source: info.source, kind: info.kind,
      } as any);
    }
  });
}

export async function prepareDaemonAgents(opts: {
  agentsRoot: string;
  projectRoot: string;
  persistDir: string;
  models: Record<string, ModelWithApiKey>;
  manager: SubagentManager;
  bus: EventBus;
  cronEnabled: boolean;
}): Promise<{ loaderOpts: AgentLoaderOptions }> {
  const loaderOpts: AgentLoaderOptions = {
    agentsRoot: opts.agentsRoot,
    projectRoot: opts.projectRoot,
    persistDir: opts.persistDir,
    models: opts.models,
    manager: opts.manager,
    bus: opts.bus,
    cronEnabled: opts.cronEnabled,
  };

  const loadResult = await loadAgents(loaderOpts);
  console.log(`[agents] Loaded ${loadResult.added.length}: ${loadResult.added.join(", ")}`);
  opts.bus.emit({ type: "info", message: `Loaded ${loadResult.added.length} agent(s): ${loadResult.added.join(", ")}` });

  const autoHeartbeats = generateAutoHeartbeats(opts.agentsRoot);
  if (autoHeartbeats.length > 0) {
    const mayCron = getAgentCrons().get("may");
    if (mayCron) {
      for (const entry of autoHeartbeats) {
        mayCron.addSyntheticEntry(entry);
      }
      opts.bus.emit({ type: "info", message: `[auto-heartbeat] Generated ${autoHeartbeats.length} heartbeat(s): ${autoHeartbeats.map((e) => e.agent).join(", ")}` });
    }
  }

  for (const cron of getAgentCrons().values()) {
    cron.subscribeToBus(opts.bus);
  }

  let failures = 0;
  const heartbeatFiles = autoHeartbeats.map((entry) => {
    const agentWfDir = join(opts.agentsRoot, entry.agent!, "workflows");
    return join(agentWfDir, `${entry.agent}-heartbeat.ts`);
  }).filter((file) => existsSync(file));

  for (const file of heartbeatFiles) {
    try {
      await import(file);
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      opts.bus.emit({ type: "info", message: `[startup-check] ⚠️ WORKFLOW BROKEN: ${file.split("/").slice(-3).join("/")} — ${msg}` });
      console.error(`[startup-check] BROKEN WORKFLOW: ${file}\n  ${msg}`);
    }
  }
  if (failures > 0) {
    opts.bus.emit({ type: "info", message: `[startup-check] ⚠️ ${failures} heartbeat workflow(s) failed to load! Heartbeats will NOT fire for those agents.` });
  }

  return { loaderOpts };
}
