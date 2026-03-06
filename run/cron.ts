/**
 * Cron — manages periodic jobs.
 *
 * Three execution modes (determined by entry `type` + `handler`):
 *
 * 1. **heartbeat** — `followUp()` into agent's persistent heartbeat session.
 *    Session is created lazily on first fire and reused across fires.
 *    If the session is still processing when the timer fires again, the fire is skipped.
 *
 * 2. **job** (no handler) — spawns `./may.sh task` as a child process.
 *    Each fire gets its own ephemeral session/process. Overlap is prevented
 *    (skip if previous instance still running). Timeout protection with SIGTERM/SIGKILL.
 *
 * 3. **job** (with handler) — runs a registered JS function in-process.
 *    Result is tracked the same as LLM jobs. No process spawn, no LLM cost.
 *
 * Backward compatibility: if `type` is missing, infer from fields:
 *   - Has `handler` registered → job with handler
 *   - Has `agent` → job (spawn task)
 *   - Otherwise → followUp into caller's session (legacy heartbeat behavior)
 *
 * Every completed execution appends a JobResult to `.state/job-history.jsonl`.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { SubagentManager } from "../src/index.js";
import type { CronEntry, JobResult } from "../src/cron-tool.js";

/** A JS function that replaces the LLM for a specific cron job. */
export type CronHandler = () => Promise<void>;

/** Callback when a job fires (for notifications). */
export type CronJobCallback = (entry: CronEntry, type: "js" | "heartbeat" | "task") => void;

/** Default timeout for spawned job processes: 10 minutes. */
const DEFAULT_TIMEOUT_MS = 600_000;

/** Grace period between SIGTERM and SIGKILL. */
const KILL_GRACE_MS = 5_000;

export class Cron {
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private entries: CronEntry[] = [];
  private started = false;
  private handlers = new Map<string, CronHandler>();
  private onJobFire?: CronJobCallback;

  /** Track running task processes to prevent overlap. */
  private runningTasks = new Map<string, ChildProcess>();

  /** Track running heartbeat sessions (sessionId per agent). */
  private heartbeatSessions = new Map<string, string>();

  /** Track whether a heartbeat is currently processing (prevents overlap). */
  private heartbeatRunning = new Set<string>();

  /** Track whether a JS handler is currently running (prevents overlap). */
  private handlerRunning = new Set<string>();

  private projectRoot: string;
  private persistDir: string;

  constructor(
    private configPath: string,
    private manager: SubagentManager,
    private getSessionId: () => string,
    private onError?: (msg: string) => void,
  ) {
    this.projectRoot = resolve(dirname(configPath), "..");
    this.persistDir = resolve(this.projectRoot, ".state");
  }

  registerHandler(jobName: string, handler: CronHandler): void {
    this.handlers.set(jobName, handler);
  }

  onFire(cb: CronJobCallback): void {
    this.onJobFire = cb;
  }

  load(): CronEntry[] {
    if (!existsSync(this.configPath)) {
      this.entries = [];
      return this.entries;
    }
    try {
      const raw = readFileSync(this.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.onError?.(`Cron config is not an array: ${this.configPath}`);
        return this.entries;
      }
      this.entries = parsed.filter((entry: CronEntry) => {
        if (!entry.name || !entry.intervalMs) {
          this.onError?.(`Invalid cron entry: ${JSON.stringify(entry)}`);
          return false;
        }
        if (!entry.message && !entry.agent) {
          this.onError?.(`Cron entry "${entry.name}" needs message or agent`);
          return false;
        }
        if (entry.intervalMs < 10_000) {
          this.onError?.(`Cron job "${entry.name}" intervalMs too low (${entry.intervalMs}ms < 10s minimum)`);
          return false;
        }
        return true;
      });
    } catch (err) {
      this.onError?.(`Failed to parse cron config: ${err}`);
    }
    return this.entries;
  }

  start(): void {
    this.stop();
    this.started = true;
    this.load();
    for (const entry of this.entries) {
      if (entry.enabled === false) continue;
      this.startEntry(entry);
    }
  }

  stop(): void {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
    this.started = false;
  }

  reload(): void {
    this.load();
    if (this.started) {
      this.stop();
      this.started = true;
      for (const entry of this.entries) {
        if (entry.enabled === false) continue;
        this.startEntry(entry);
      }
    }
  }

  getEntries(): CronEntry[] {
    return [...this.entries];
  }

  /** Resolve the effective execution mode for an entry. */
  private resolveMode(entry: CronEntry): "heartbeat" | "job-handler" | "job-task" | "legacy-followup" {
    const handler = this.handlers.get(entry.name);

    if (entry.type === "heartbeat") {
      return "heartbeat";
    }

    if (entry.type === "job") {
      return handler ? "job-handler" : "job-task";
    }

    // Backward compatibility: no type field — infer from fields
    if (handler) return "job-handler";
    if (entry.agent) return "job-task";
    return "legacy-followup";
  }

  private startEntry(entry: CronEntry): void {
    const mode = this.resolveMode(entry);

    const timer = setInterval(() => {
      switch (mode) {
        case "heartbeat":
          this.fireHeartbeat(entry);
          break;
        case "job-handler":
          this.fireHandler(entry);
          break;
        case "job-task":
          this.fireTask(entry);
          break;
        case "legacy-followup":
          this.fireLegacyFollowUp(entry);
          break;
      }
    }, entry.intervalMs);
    timer.unref();
    this.timers.set(entry.name, timer);
  }

  // ── Heartbeat: followUp into persistent heartbeat session ───────────

  private fireHeartbeat(entry: CronEntry): void {
    const agentName = entry.agent || "may";
    const heartbeatKey = `heartbeat:${agentName}`;

    // Skip if still processing
    if (this.heartbeatRunning.has(heartbeatKey)) {
      const result = this.makeSkipResult(entry, "heartbeat");
      this.appendJobResult(result);
      this.onError?.(`Cron heartbeat "${entry.name}" skipped — ${agentName} still processing`);
      return;
    }

    this.onJobFire?.(entry, "heartbeat");
    this.heartbeatRunning.add(heartbeatKey);
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
      let sessionId = this.heartbeatSessions.get(agentName);

      if (!sessionId || !this.isSessionAlive(sessionId)) {
        // Create a new persistent session for this agent's heartbeat
        sessionId = this.manager.run(agentName, entry.message, {
          persistent: true,
          compaction: { threshold: 0.6, keepRatio: 0.3 },
        });
        this.heartbeatSessions.set(agentName, sessionId);
      } else {
        // Follow up into existing persistent session
        this.manager.followUp(sessionId, entry.message, "cron");
      }

      // Wait for idle then record result
      this.manager.waitForIdle(sessionId).then(() => {
        this.heartbeatRunning.delete(heartbeatKey);
        this.appendJobResult({
          jobName: entry.name,
          type: "heartbeat",
          status: "success",
          summary: `Heartbeat for ${agentName} completed`,
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: Date.now() - startMs,
          agent: agentName,
          sessionId,
        });
      }).catch((err) => {
        this.heartbeatRunning.delete(heartbeatKey);
        const errMsg = err instanceof Error ? err.message : String(err);

        // Any heartbeat error → hard reset session to recover
        this.onError?.(`Cron heartbeat "${entry.name}" failed — resetting session for next fire`);
        this.heartbeatSessions.delete(agentName);

        this.appendJobResult({
          jobName: entry.name,
          type: "heartbeat",
          status: "failure",
          summary: `Heartbeat for ${agentName} failed`,
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: Date.now() - startMs,
          agent: agentName,
          sessionId,
          error: errMsg,
        });
        this.onError?.(`Cron heartbeat "${entry.name}" failed: ${errMsg}`);
      });
    } catch (err) {
      this.heartbeatRunning.delete(heartbeatKey);
      const errMsg = err instanceof Error ? err.message : String(err);
      this.appendJobResult({
        jobName: entry.name,
        type: "heartbeat",
        status: "failure",
        summary: `Heartbeat for ${agentName} failed to start`,
        startedAt,
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
        agent: agentName,
        error: errMsg,
      });
      this.onError?.(`Cron heartbeat "${entry.name}" failed: ${errMsg}`);
    }
  }

  /** Check if a session is still in the manager (includes idle persistent sessions). */
  private isSessionAlive(sessionId: string): boolean {
    try {
      const sessions = this.manager.status();
      return sessions.some(s => s.sessionId === sessionId);
    } catch {
      return false;
    }
  }

  // ── Job with JS handler: run in-process ─────────────────────────────

  private fireHandler(entry: CronEntry): void {
    const handler = this.handlers.get(entry.name);
    if (!handler) {
      this.onError?.(`Cron job "${entry.name}" has no registered handler`);
      return;
    }

    // Skip if still running
    if (this.handlerRunning.has(entry.name)) {
      const result = this.makeSkipResult(entry, "job");
      this.appendJobResult(result);
      this.onError?.(`Cron handler "${entry.name}" skipped — still running`);
      return;
    }

    this.onJobFire?.(entry, "js");
    this.handlerRunning.add(entry.name);
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    handler().then(() => {
      this.handlerRunning.delete(entry.name);
      this.appendJobResult({
        jobName: entry.name,
        type: "job",
        status: "success",
        summary: `JS handler "${entry.name}" completed`,
        startedAt,
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
      });
    }).catch((err) => {
      this.handlerRunning.delete(entry.name);
      const errMsg = err instanceof Error ? err.message : String(err);
      this.appendJobResult({
        jobName: entry.name,
        type: "job",
        status: "failure",
        summary: `JS handler "${entry.name}" failed`,
        startedAt,
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
        error: errMsg,
      });
      this.onError?.(`Cron handler "${entry.name}" failed: ${errMsg}`);
    });
  }

  // ── Job without handler: spawn task process ─────────────────────────

  private fireTask(entry: CronEntry): void {
    // Don't spawn if already running
    if (this.runningTasks.has(entry.name)) {
      const result = this.makeSkipResult(entry, "job");
      this.appendJobResult(result);
      this.onError?.(`Cron job "${entry.name}" skipped — already running`);
      return;
    }

    this.onJobFire?.(entry, "task");
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    const taskMsg = entry.message || `[cron:${entry.name}] Run your task.`;
    const agentName = entry.agent || "may";
    const timeoutMs = entry.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Spawn: ./may.sh task --agent <agent> --name <name> "message"
    const proc = spawn("bash", [
      resolve(this.projectRoot, "may.sh"),
      "task",
      "--agent", agentName,
      "--name", entry.name,
      taskMsg,
    ], {
      cwd: this.projectRoot,
      stdio: "ignore",
      detached: true,
    });
    proc.unref();

    this.runningTasks.set(entry.name, proc);

    // Timeout protection
    const timeoutTimer = setTimeout(() => {
      if (!this.runningTasks.has(entry.name)) return;

      this.onError?.(`Cron job "${entry.name}" timed out after ${timeoutMs}ms — sending SIGTERM`);

      try { proc.kill("SIGTERM"); } catch {}

      // SIGKILL after grace period
      const killTimer = setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch {}
      }, KILL_GRACE_MS);
      killTimer.unref();
    }, timeoutMs);
    timeoutTimer.unref();

    const cleanup = (status: JobResult["status"], error?: string) => {
      clearTimeout(timeoutTimer);
      this.runningTasks.delete(entry.name);

      const isTimeout = status === "failure" && error?.includes("timed out");
      this.appendJobResult({
        jobName: entry.name,
        type: "job",
        status: isTimeout ? "timeout" : status,
        summary: isTimeout
          ? `Job "${entry.name}" timed out after ${timeoutMs}ms`
          : status === "success"
            ? `Job "${entry.name}" completed`
            : `Job "${entry.name}" failed`,
        startedAt,
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
        agent: agentName,
        error,
      });
    };

    proc.on("exit", (code, signal) => {
      if (signal === "SIGTERM" || signal === "SIGKILL") {
        cleanup("timeout", `Process killed by ${signal} after timeout`);
      } else if (code === 0) {
        cleanup("success");
      } else {
        cleanup("failure", `Process exited with code ${code}`);
      }
    });

    proc.on("error", (err) => {
      cleanup("failure", `Spawn failed: ${err.message}`);
    });
  }

  // ── Legacy: followUp into main session (backward compat) ────────────

  private fireLegacyFollowUp(entry: CronEntry): void {
    this.onJobFire?.(entry, "heartbeat");
    try {
      const sid = this.getSessionId();
      this.manager.followUp(sid, entry.message, "cron");
    } catch (err) {
      this.onError?.(`Cron job "${entry.name}" followUp failed: ${err}`);
    }
  }

  // ── JobResult tracking ──────────────────────────────────────────────

  private makeSkipResult(entry: CronEntry, type: "heartbeat" | "job"): JobResult {
    const now = new Date().toISOString();
    return {
      jobName: entry.name,
      type,
      status: "skipped",
      summary: `Skipped — previous execution still running`,
      startedAt: now,
      endedAt: now,
      durationMs: 0,
      agent: entry.agent,
    };
  }

  private appendJobResult(result: JobResult): void {
    try {
      mkdirSync(this.persistDir, { recursive: true });
      const historyPath = resolve(this.persistDir, "job-history.jsonl");
      appendFileSync(historyPath, JSON.stringify(result) + "\n");
    } catch (err) {
      this.onError?.(`Failed to write job history: ${err}`);
    }
  }
}
