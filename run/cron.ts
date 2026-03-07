/**
 * Cron — manages periodic jobs.
 *
 * Three execution modes (determined by entry `type` + `handler`):
 *
 * 1. **heartbeat** — `followUp()` into agent's persistent heartbeat session.
 *    Session is created lazily on first fire and reused across fires.
 *    If the session is still processing when the timer fires again, the fire is skipped.
 *
 * 2. **job** (with handler) — runs a registered JS function in-process.
 *    Result is tracked the same as LLM jobs. No process spawn, no LLM cost.
 *    All job entries MUST have a handler registered (via loadAgentHandlers).
 *
 * 3. **legacy-followup** — spawns a detached agent process (backward compat
 *    for entries with no type/handler/agent). Runs out-of-process so it
 *    does not compete with the main event loop.
 *
 * Every completed execution appends a JobResult to `.state/job-history.jsonl`.
 */

import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { SubagentManager } from "../src/index.js";
import { generateId } from "../src/index.js";
import { spawnDetachedAgent } from "../src/detached.js";
import type { CronEntry, JobResult } from "../src/cron-tool.js";

/** A JS function that replaces the LLM for a specific cron job. */
export type CronHandler = () => Promise<void>;

/** Callback when a job fires (for notifications). */
export type CronJobCallback = (entry: CronEntry, type: "js" | "heartbeat" | "legacy") => void;

export class Cron {
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private entries: CronEntry[] = [];
  private started = false;
  private handlers = new Map<string, CronHandler>();
  private onJobFire?: CronJobCallback;

  /** Track running heartbeat sessions (sessionId per agent). */
  private heartbeatSessions = new Map<string, string>();

  /** Track whether a heartbeat is currently processing (prevents overlap). */
  private heartbeatRunning = new Set<string>();

  /** Track whether a JS handler is currently running (prevents overlap). */
  private handlerRunning = new Set<string>();

  /** Track running detached legacy tasks: name → { sessionId, pid, startedAt }. */
  private legacyRunning = new Map<string, { sessionId: string; pid: number | undefined; startedAt: string }>();

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
  private resolveMode(entry: CronEntry): "heartbeat" | "job-handler" | "legacy-followup" | null {
    const handler = this.handlers.get(entry.name);

    if (entry.type === "heartbeat") {
      return "heartbeat";
    }

    if (entry.type === "job") {
      if (handler) return "job-handler";
      this.onError?.(`Cron entry "${entry.name}" has type "job" but no registered handler — skipping. All job entries require a handler.`);
      return null;
    }

    // Backward compatibility: no type field — infer from fields
    if (handler) return "job-handler";
    if (entry.agent && !handler) {
      this.onError?.(`Cron entry "${entry.name}" has agent "${entry.agent}" but no registered handler — skipping. Use handler: "run-agent-task" in cron.json.`);
      return null;
    }
    return "legacy-followup";
  }

  private startEntry(entry: CronEntry): void {
    const mode = this.resolveMode(entry);
    if (!mode) return; // entry was rejected by resolveMode

    const timer = setInterval(() => {
      switch (mode) {
        case "heartbeat":
          this.fireHeartbeat(entry);
          break;
        case "job-handler":
          this.fireHandler(entry);
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

  // ── Legacy: spawn detached agent process (backward compat) ──────────

  /** Check if a process with the given pid is still running. */
  private isProcessAlive(pid: number | undefined): boolean {
    if (pid === undefined) return false;
    try {
      process.kill(pid, 0); // signal 0: check existence without killing
      return true;
    } catch {
      return false;
    }
  }

  private fireLegacyFollowUp(entry: CronEntry): void {
    // If a detached process for this entry is tracked, check if it's still alive
    if (this.legacyRunning.has(entry.name)) {
      const tracked = this.legacyRunning.get(entry.name)!;
      if (this.isProcessAlive(tracked.pid)) {
        // Process still running — skip this fire
        const result = this.makeSkipResult(entry, "job");
        this.appendJobResult(result);
        this.onError?.(`Cron legacy job "${entry.name}" skipped — detached process still running (pid=${tracked.pid})`);
        return;
      }
      // Process is no longer running — clear tracking and allow re-fire
      this.legacyRunning.delete(entry.name);
    }

    this.onJobFire?.(entry, "legacy");
    const startedAt = new Date().toISOString();

    try {
      const sessionId = generateId("cron");
      let parentSessionId: string | undefined;
      try {
        parentSessionId = this.getSessionId();
      } catch {
        // No active parent session — that's fine for detached spawn
      }

      const { pid } = spawnDetachedAgent({
        projectRoot: this.projectRoot,
        agentName: entry.agent ?? "may",
        task: entry.message,
        sessionId,
        parentSessionId,
      });

      this.legacyRunning.set(entry.name, { sessionId, pid, startedAt });

      this.appendJobResult({
        jobName: entry.name,
        type: "job",
        status: "success",
        summary: `Detached agent spawned (pid=${pid ?? "unknown"}, session=${sessionId})`,
        startedAt,
        endedAt: new Date().toISOString(),
        durationMs: 0,
        agent: entry.agent ?? "may",
        sessionId,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.appendJobResult({
        jobName: entry.name,
        type: "job",
        status: "failure",
        summary: `Failed to spawn detached agent for "${entry.name}"`,
        startedAt,
        endedAt: new Date().toISOString(),
        durationMs: 0,
        agent: entry.agent,
        error: errMsg,
      });
      this.onError?.(`Cron job "${entry.name}" detached spawn failed: ${errMsg}`);
    }
  }

  /** Clear tracking for a legacy detached task (called when process completes). */
  clearLegacyTask(jobName: string): void {
    this.legacyRunning.delete(jobName);
  }

  /** Get info about running legacy detached tasks. */
  getLegacyRunning(): Map<string, { sessionId: string; pid: number | undefined; startedAt: string }> {
    return new Map(this.legacyRunning);
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
