/**
 * Cron — manages periodic jobs with persistent state via request tracking.
 *
 * Three execution modes (determined by entry fields):
 *
 * 1. **heartbeat** — `manager.run()` spawns a fresh in-process task session.
 * 2. **job** (with JS handler) — runs a registered JS function in-process.
 * 3. **job** (agent task) — `spawnDetachedAgent()` in a separate OS process.
 *
 * Each job execution is tracked as a request in `.state/may.db`.
 * On restart, jobs resume based on when they actually last ran — not from zero.
 * The cron timer skips if a previous execution is still IN_PROGRESS.
 * Manual triggers (`triggerNow`) always fire regardless of overlap.
 *
 * Design: docs/design/cron-sqlite.md
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { SubagentManager } from "../lib/index.js";
import { generateId } from "../lib/index.js";
import {
  getDb,
  trackRequest,
  updateRequest,
} from "../lib/requests.js";
import { spawnDetachedAgent } from "../lib/detached.js";
import type { CronEntry } from "../lib/cron-tool.js";

// ── Types ─────────────────────────────────────────────────────────────

/** A JS function that replaces the LLM for a specific cron job. */
export type CronHandler = () => Promise<void>;

/** Callback when a job fires (for notifications). */
export type CronJobCallback = (entry: CronEntry, type: "js" | "heartbeat" | "detached") => void;

// ── Cron class ────────────────────────────────────────────────────────

export class Cron {
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private entries: CronEntry[] = [];
  private started = false;
  private handlers = new Map<string, CronHandler>();
  private onJobFire?: CronJobCallback;

  /** Default minimum ms between reactive triggers for same entry.
   *  Per-entry cooldown = half the entry's intervalMs (min 60s). */
  readonly defaultCooldownMs = 60_000;

  private projectRoot: string;
  private persistDir: string;

  constructor(
    private configPath: string,
    private manager: SubagentManager,
    private getSessionId: () => string,
    private onError?: (msg: string) => void,
    projectRoot?: string,
    private notify?: (msg: string) => void,
  ) {
    this.projectRoot = projectRoot ?? resolve(dirname(configPath), "../..");
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

  /** Trigger a cron entry immediately. Always fires (no overlap check).
   *  Returns false only if entry not found or debounced. */
  triggerNow(entryName: string, opts?: { force?: boolean }): boolean {
    const entry = this.entries.find((e) => e.name === entryName);
    if (!entry) return false;

    // Debounce rapid re-triggers (unless forced)
    if (!opts?.force) {
      const cooldownMs = Math.max(entry.intervalMs * 0.75, this.defaultCooldownMs);
      try {
        const lastFire = this.getLastFireTime(entryName);
        if (lastFire && Date.now() - lastFire < cooldownMs) return false;
      } catch { /* db unavailable — allow trigger */ }
    }

    const mode = this.resolveMode(entry);
    if (!mode) return false;

    // Manual trigger — always fire, no overlap check
    switch (mode) {
      case "heartbeat": this.fireHeartbeat(entry); break;
      case "job-handler": this.fireHandler(entry); break;
      case "job-detached": this.fireDetachedJob(entry); break;
    }
    return true;
  }

  /** Resolve the effective execution mode for an entry. */
  private resolveMode(entry: CronEntry): "heartbeat" | "job-handler" | "job-detached" | null {
    const handler = this.handlers.get(entry.name);

    if (entry.type === "heartbeat") return "heartbeat";

    if (handler) return "job-handler";
    if (entry.agent) return "job-detached";

    this.onError?.(`Cron entry "${entry.name}" has no handler and no agent — skipping`);
    return null;
  }

  // ── Request-based state queries ─────────────────────────────────────

  /** Check if a job (by artifact name) has an active request. */
  private isRunning(entryName: string): boolean {
    try {
      const db = getDb(this.persistDir);
      const row = db
        .query(
          `SELECT 1 FROM requests
           WHERE artifact = ? AND status IN ('CREATED', 'IN_PROGRESS')
           LIMIT 1`,
        )
        .get(entryName);
      return row !== null;
    } catch {
      return false;
    }
  }

  /** Check if any heartbeat for a given agent is currently active. */
  private isAgentHeartbeatRunning(agentName: string): boolean {
    try {
      const db = getDb(this.persistDir);
      // Find all heartbeat entry names for this agent
      const heartbeatNames = this.entries
        .filter((e) => e.type === "heartbeat" && (e.agent || "may") === agentName)
        .map((e) => e.name);
      if (heartbeatNames.length === 0) return false;

      const placeholders = heartbeatNames.map(() => "?").join(",");
      const row = db
        .query(
          `SELECT 1 FROM requests
           WHERE artifact IN (${placeholders})
           AND status IN ('CREATED', 'IN_PROGRESS')
           LIMIT 1`,
        )
        .get(...heartbeatNames);
      return row !== null;
    } catch {
      return false;
    }
  }

  /** Get the last fire time for a job (epoch ms). */
  private getLastFireTime(entryName: string): number | null {
    try {
      const db = getDb(this.persistDir);
      const row = db
        .query("SELECT MAX(createdAt) as lastFire FROM requests WHERE artifact = ?")
        .get(entryName) as { lastFire: number | null } | null;
      return row?.lastFire ?? null;
    } catch {
      return null;
    }
  }

  /** Get PID from a running detached job's context. */
  private getRunningPid(entryName: string): number | null {
    try {
      const db = getDb(this.persistDir);
      const row = db
        .query(
          `SELECT context FROM requests
           WHERE artifact = ? AND status IN ('CREATED', 'IN_PROGRESS')
           ORDER BY createdAt DESC LIMIT 1`,
        )
        .get(entryName) as { context: string | null } | null;
      if (!row?.context) return null;
      const ctx = JSON.parse(row.context);
      return ctx.pid ?? null;
    } catch {
      return null;
    }
  }

  /** Fail any orphaned running requests for a job (from a previous crashed process). */
  private failOrphans(entryName: string): void {
    try {
      const db = getDb(this.persistDir);
      const now = Date.now();
      db.run(
        `UPDATE requests SET status = 'FAILED', error = 'orphaned by restart', updatedAt = ?, completedAt = ?
         WHERE artifact = ? AND status IN ('CREATED', 'IN_PROGRESS')`,
        [now, now, entryName],
      );
    } catch { /* ignore */ }
  }

  // ── Scheduling with resume ──────────────────────────────────────────

  private startEntry(entry: CronEntry): void {
    const mode = this.resolveMode(entry);
    if (!mode) return;

    const fire = () => {
      // Cron timer: skip if already running (overlap protection)
      if (mode === "heartbeat") {
        const agentName = entry.agent || "may";
        if (this.isAgentHeartbeatRunning(agentName)) {
          this.onError?.(`Cron "${entry.name}" skipped — ${agentName} heartbeat still running`);
          return;
        }
      } else if (mode === "job-detached") {
        // For detached: check if process is actually alive
        const pid = this.getRunningPid(entry.name);
        if (pid && this.isProcessAlive(pid)) {
          this.onError?.(`Cron "${entry.name}" skipped — detached process still running (pid=${pid})`);
          return;
        }
        // PID dead but request still active → fail the orphan
        if (this.isRunning(entry.name)) {
          this.failOrphans(entry.name);
        }
      } else {
        if (this.isRunning(entry.name)) {
          this.onError?.(`Cron "${entry.name}" skipped — still running`);
          return;
        }
      }

      switch (mode) {
        case "heartbeat": this.fireHeartbeat(entry); break;
        case "job-handler": this.fireHandler(entry); break;
        case "job-detached": this.fireDetachedJob(entry); break;
      }
    };

    const delay = this.computeResumeDelay(entry, mode);

    const startTimer = setTimeout(() => {
      fire();
      const timer = setInterval(fire, entry.intervalMs);
      timer.unref();
      this.timers.set(entry.name, timer);
    }, delay);
    startTimer.unref();
    this.timers.set(entry.name, startTimer as unknown as ReturnType<typeof setInterval>);
  }

  /** Compute the initial delay for an entry based on when it last ran. */
  private computeResumeDelay(entry: CronEntry, mode: string): number {
    // Clean up orphaned running requests from previous instance
    if (mode === "job-detached") {
      // For detached: only fail if the PID is dead
      const pid = this.getRunningPid(entry.name);
      if (pid && this.isProcessAlive(pid)) {
        // Process survived restart — schedule normally from when it started
        const lastFire = this.getLastFireTime(entry.name);
        if (lastFire) {
          const elapsed = Date.now() - lastFire;
          return elapsed >= entry.intervalMs ? 0 : entry.intervalMs - elapsed;
        }
      } else if (this.isRunning(entry.name)) {
        this.failOrphans(entry.name);
      }
    } else if (this.isRunning(entry.name)) {
      // In-process job from previous instance — it's dead
      this.failOrphans(entry.name);
    }

    const lastFire = this.getLastFireTime(entry.name);
    if (lastFire == null) {
      // Never ran — jitter so entries don't all fire at once
      return Math.floor(Math.random() * entry.intervalMs);
    }

    const elapsed = Date.now() - lastFire;
    if (elapsed >= entry.intervalMs) {
      return 0; // overdue
    }
    return entry.intervalMs - elapsed;
  }

  // ── Heartbeat: spawn fresh task session ─────────────────────────────

  private fireHeartbeat(entry: CronEntry): void {
    const agentName = entry.agent || "may";
    this.onJobFire?.(entry, "heartbeat");

    // Track as a request
    const requestId = trackRequest(this.persistDir, {
      fromEntity: "cron",
      toAgent: agentName,
      task: entry.message.slice(0, 500),
      method: "call",
      artifact: entry.name,
      context: JSON.stringify({ type: "heartbeat" }),
    });

    updateRequest(this.persistDir, requestId, { status: "IN_PROGRESS" });
    const startMs = Date.now();

    try {
      // F3: Auto-inject context files into heartbeat task message.
      let taskMessage = entry.message;
      const injections: string[] = [];

      try {
        const agentDir = resolve(this.projectRoot, "agents", agentName);

        const heartbeatPath = resolve(agentDir, "heartbeat.md");
        if (existsSync(heartbeatPath)) {
          const content = readFileSync(heartbeatPath, "utf-8").trim();
          if (content) injections.push(`## Injected: heartbeat.md\n\n${content}`);
        }

        // Inject pending tasks from DB (replaces todo.md parsing)
        try {
          const db = getDb(this.persistDir);
          const pending = db
            .query(
              `SELECT task, fromEntity, createdAt, requestId FROM requests
               WHERE toAgent = ? AND status IN ('CREATED', 'IN_PROGRESS') AND method = 'send'
               ORDER BY createdAt ASC`
            )
            .all(agentName) as { task: string; fromEntity: string; createdAt: number; requestId: string }[];
          if (pending.length > 0) {
            const lines = pending.map(r => {
              const ts = new Date(r.createdAt).toISOString().slice(0, 16);
              return `- [from:${r.fromEntity} ${ts}] [req:${r.requestId.slice(0, 8)}] ${r.task}`;
            });
            injections.push(`## Injected: pending tasks (${pending.length} items)\n\n${lines.join("\n")}`);
          }
        } catch {
          // Non-fatal: fall back silently if DB unavailable
        }

        const commonSensePath = resolve(this.projectRoot, "agents", "shared", "common-sense.md");
        if (existsSync(commonSensePath)) {
          const content = readFileSync(commonSensePath, "utf-8").trim();
          if (content) injections.push(`## Injected: shared/common-sense.md\n\n${content}`);
        }
      } catch {
        // Non-fatal
      }

      if (injections.length > 0) {
        taskMessage = `${entry.message}\n\n---\n${injections.join("\n\n---\n")}`;
      }

      const sessionId = this.manager.run(agentName, taskMessage, { kind: "job" });
      updateRequest(this.persistDir, requestId, { sessionId });

      this.manager
        .waitFor(sessionId)
        .then((taskResult) => {
          updateRequest(this.persistDir, requestId, {
            status: "COMPLETED",
            completedAt: Date.now(),
            durationMs: Date.now() - startMs,
            summary: `Heartbeat for ${agentName} completed`,
          });
          if (entry.notifyBrief && this.notify) {
            const text = taskResult?.lastAssistantText?.trim();
            if (text) {
              this.notify(`📋 *${agentName}* heartbeat brief:\n\n${text}`);
            }
          }
        })
        .catch((err) => {
          const errMsg = err instanceof Error ? err.message : String(err);
          this.onError?.(`Cron heartbeat "${entry.name}" failed — resetting session for next fire`);
          updateRequest(this.persistDir, requestId, {
            status: "FAILED",
            completedAt: Date.now(),
            durationMs: Date.now() - startMs,
            error: errMsg,
          });
          this.onError?.(`Cron heartbeat "${entry.name}" failed: ${errMsg}`);
        });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      updateRequest(this.persistDir, requestId, {
        status: "FAILED",
        completedAt: Date.now(),
        durationMs: Date.now() - startMs,
        error: errMsg,
      });
      this.onError?.(`Cron heartbeat "${entry.name}" failed: ${errMsg}`);
    }
  }

  // ── Job with JS handler: run in-process ─────────────────────────────

  private fireHandler(entry: CronEntry): void {
    const handler = this.handlers.get(entry.name);
    if (!handler) {
      this.onError?.(`Cron job "${entry.name}" has no registered handler`);
      return;
    }

    this.onJobFire?.(entry, "js");

    const requestId = trackRequest(this.persistDir, {
      fromEntity: "cron",
      toAgent: entry.agent || "may",
      task: entry.message.slice(0, 500),
      method: "call",
      artifact: entry.name,
      context: JSON.stringify({ type: "handler" }),
    });

    updateRequest(this.persistDir, requestId, { status: "IN_PROGRESS" });
    const startMs = Date.now();

    handler()
      .then(() => {
        updateRequest(this.persistDir, requestId, {
          status: "COMPLETED",
          completedAt: Date.now(),
          durationMs: Date.now() - startMs,
          summary: `JS handler "${entry.name}" completed`,
        });
      })
      .catch((err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        updateRequest(this.persistDir, requestId, {
          status: "FAILED",
          completedAt: Date.now(),
          durationMs: Date.now() - startMs,
          error: errMsg,
        });
        this.onError?.(`Cron handler "${entry.name}" failed: ${errMsg}`);
      });
  }

  // ── Detached agent job: spawn separate OS process ───────────────────

  private isProcessAlive(pid: number | undefined | null): boolean {
    if (pid == null) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private fireDetachedJob(entry: CronEntry): void {
    this.onJobFire?.(entry, "detached");

    const sessionId = generateId("cron");
    let parentSessionId: string | undefined;
    try {
      parentSessionId = this.getSessionId();
    } catch { /* no active parent session */ }

    try {
      const { pid } = spawnDetachedAgent({
        projectRoot: this.projectRoot,
        agentName: entry.agent ?? "may",
        task: entry.message,
        sessionId,
        parentSessionId,
      });

      trackRequest(this.persistDir, {
        fromEntity: "cron",
        toAgent: entry.agent ?? "may",
        task: entry.message.slice(0, 500),
        method: "call",
        artifact: entry.name,
        sessionId,
        context: JSON.stringify({ type: "detached", pid: pid ?? null }),
      });

      // Detached jobs are IN_PROGRESS immediately — they complete when the
      // process finishes and calls clearDetachedTask(), or get cleaned up
      // as orphans on next restart.
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Track the failed spawn attempt
      const requestId = trackRequest(this.persistDir, {
        fromEntity: "cron",
        toAgent: entry.agent ?? "may",
        task: entry.message.slice(0, 500),
        method: "call",
        artifact: entry.name,
      });
      updateRequest(this.persistDir, requestId, {
        status: "FAILED",
        completedAt: Date.now(),
        error: errMsg,
      });
      this.onError?.(`Cron job "${entry.name}" detached spawn failed: ${errMsg}`);
    }
  }

  /** Clear tracking for a detached task (called when process completes). */
  clearDetachedTask(jobName: string): void {
    try {
      const db = getDb(this.persistDir);
      const now = Date.now();
      db.run(
        `UPDATE requests SET status = 'COMPLETED', updatedAt = ?, completedAt = ?
         WHERE artifact = ? AND status IN ('CREATED', 'IN_PROGRESS')`,
        [now, now, jobName],
      );
    } catch { /* ignore */ }
  }

  /** Get info about running detached tasks (from requests table). */
  getDetachedRunning(): Map<string, { sessionId: string; pid: number | undefined; startedAt: string }> {
    const result = new Map<string, { sessionId: string; pid: number | undefined; startedAt: string }>();
    try {
      const db = getDb(this.persistDir);
      const rows = db
        .query(
          `SELECT artifact, sessionId, context, createdAt FROM requests
           WHERE fromEntity = 'cron' AND status IN ('CREATED', 'IN_PROGRESS')
           AND context LIKE '%"type":"detached"%'`,
        )
        .all() as Array<{ artifact: string; sessionId: string | null; context: string | null; createdAt: number }>;
      for (const row of rows) {
        let pid: number | undefined;
        try {
          const ctx = JSON.parse(row.context ?? "{}");
          pid = ctx.pid ?? undefined;
        } catch { /* ignore */ }
        if (pid && this.isProcessAlive(pid)) {
          result.set(row.artifact, {
            sessionId: row.sessionId ?? "",
            pid,
            startedAt: new Date(row.createdAt).toISOString(),
          });
        }
      }
    } catch { /* ignore */ }
    return result;
  }
}
