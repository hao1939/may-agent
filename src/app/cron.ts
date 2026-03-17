/**
 * Cron — manages periodic jobs.
 *
 * Three execution modes (determined by entry fields):
 *
 * 1. **heartbeat** — `manager.run()` spawns a fresh in-process task session.
 *    Overlap protection: if the previous heartbeat is still running, skip.
 *
 * 2. **job** (with JS handler) — runs a registered JS function in-process.
 *    This is the optimized path for mature patterns (e.g., watchdog, evaluate-sessions).
 *
 * 3. **job** (agent task) — `spawnDetachedAgent()` in a separate OS process.
 *    Default for agent work. Does not compete with the main event loop.
 *    Overlap protection: if the previous PID is still alive, skip.
 *
 * Every completed execution appends a JobResult to `.state/job-history.jsonl`.
 */

import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { SubagentManager } from "../lib/index.js";
import { generateId } from "../lib/index.js";
import { spawnDetachedAgent } from "../lib/detached.js";
import type { CronEntry, JobResult } from "../lib/cron-tool.js";

/** A JS function that replaces the LLM for a specific cron job. */
export type CronHandler = () => Promise<void>;

/** Callback when a job fires (for notifications). */
export type CronJobCallback = (entry: CronEntry, type: "js" | "heartbeat" | "detached") => void;

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

  /** Track running detached agent tasks: name → { sessionId, pid, startedAt }. */
  private detachedRunning = new Map<string, { sessionId: string; pid: number | undefined; startedAt: string }>();

  /** Tracks entry names that need re-fire after the current run completes (latch). */
  private pendingTriggers = new Set<string>();

  /** Per-entry last trigger timestamp for debounce. */
  private lastTriggerTime = new Map<string, number>();

  /** Minimum ms between reactive triggers for same entry. */
  readonly triggerCooldownMs = 60_000;

  /** Tracks consecutive re-trigger count per entry (drains todo list). */
  private retriggerCounts = new Map<string, number>();

  /** Maximum consecutive re-triggers before waiting for next scheduled interval. */
  readonly maxRetriggers = 3;

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
    // configPath is <projectRoot>/agents/<name>/cron.json → go up 2 levels
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

  /** Trigger a cron entry immediately. Returns true if fired or latched, false if debounced/unknown. */
  triggerNow(entryName: string, opts?: { force?: boolean }): boolean {
    const entry = this.entries.find((e) => e.name === entryName);
    if (!entry) return false;

    // Debounce: skip if triggered too recently (unless forced by re-trigger)
    const lastTrigger = this.lastTriggerTime.get(entryName) ?? 0;
    if (!opts?.force && Date.now() - lastTrigger < this.triggerCooldownMs) return false;
    this.lastTriggerTime.set(entryName, Date.now());

    const mode = this.resolveMode(entry);
    if (mode === "heartbeat") {
      const key = `heartbeat:${entry.agent || "may"}`;
      if (this.heartbeatRunning.has(key)) {
        // Agent busy — latch for re-run after completion (Task 2 handles drain)
        this.pendingTriggers.add(entryName);
        return true;
      }
      this.fireHeartbeat(entry);
    } else if (mode === "job-handler") {
      if (this.handlerRunning.has(entryName)) {
        this.pendingTriggers.add(entryName);
        return true;
      }
      this.fireHandler(entry);
    } else if (mode === "job-detached") {
      this.fireDetachedJob(entry);
    }
    return true;
  }

  /** Resolve the effective execution mode for an entry. */
  private resolveMode(entry: CronEntry): "heartbeat" | "job-handler" | "job-detached" | null {
    const handler = this.handlers.get(entry.name);

    if (entry.type === "heartbeat") return "heartbeat";

    // type: "job" or no type — both resolve the same way
    if (handler) return "job-handler";
    if (entry.agent) return "job-detached";

    // No handler, no agent — can't execute
    this.onError?.(`Cron entry "${entry.name}" has no handler and no agent — skipping`);
    return null;
  }

  private startEntry(entry: CronEntry): void {
    const mode = this.resolveMode(entry);
    if (!mode) return; // entry was rejected by resolveMode

    const fire = () => {
      switch (mode) {
        case "heartbeat":
          this.fireHeartbeat(entry);
          break;
        case "job-handler":
          this.fireHandler(entry);
          break;
        case "job-detached":
          this.fireDetachedJob(entry);
          break;
      }
    };

    // Jitter: random initial delay (0 to intervalMs) so entries don't all fire at once
    const jitter = Math.floor(Math.random() * entry.intervalMs);
    const startTimer = setTimeout(() => {
      fire();
      const timer = setInterval(fire, entry.intervalMs);
      timer.unref();
      this.timers.set(entry.name, timer);
    }, jitter);
    startTimer.unref();
    // Store the initial timeout so stop() can clear it
    this.timers.set(entry.name, startTimer as unknown as ReturnType<typeof setInterval>);
  }

  // ── Heartbeat: spawn fresh task session (Chat+Task model) ──────────

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
      // Always spawn a fresh task session — no persistent heartbeat sessions.
      // The agent reads todo.md/SOUL.md for context. Memory is the filesystem.
      const sessionId = this.manager.run(agentName, entry.message, { kind: "job" });
      this.heartbeatSessions.set(agentName, sessionId);

      // Wait for completion then record result
      this.manager
        .waitFor(sessionId)
        .then((taskResult) => {
          this.heartbeatRunning.delete(heartbeatKey);
          // Check latch: re-fire if a trigger arrived while busy
          this.checkPendingTrigger(entry);
          // Post-heartbeat re-trigger: drain todo list if work remains
          // Only re-trigger after successful sessions — error sessions should
          // wait for the next scheduled interval to avoid error-chaining loops
          // (e.g., May firing every 45s instead of every 10min).
          if (!this.heartbeatRunning.has(heartbeatKey) && taskResult?.status !== "error") {
            this.checkRetrigger(entry);
          }
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
          // Send brief to human if configured
          if (entry.notifyBrief && this.notify) {
            const text = taskResult?.lastAssistantText?.trim();
            if (text) {
              this.notify(`📋 *${agentName}* heartbeat brief:\n\n${text}`);
            }
          }
        })
        .catch((err) => {
          this.heartbeatRunning.delete(heartbeatKey);
          // Reset re-trigger count on failure (don't fast-loop on errors)
          this.retriggerCounts.set(entry.name, 0);
          // Don't drain pending triggers on failure — prevents tight error loops
          // where a latched trigger causes immediate re-fire after each failure.
          // Wait for the next scheduled interval instead.
          this.pendingTriggers.delete(entry.name);
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

  /** Check latch: if a trigger arrived while entry was busy, re-fire it now. */
  private checkPendingTrigger(entry: CronEntry): void {
    if (this.pendingTriggers.has(entry.name)) {
      this.pendingTriggers.delete(entry.name);
      const mode = this.resolveMode(entry);
      if (mode === "heartbeat") this.fireHeartbeat(entry);
      else if (mode === "job-handler") this.fireHandler(entry);
      else if (mode === "job-detached") this.fireDetachedJob(entry);
    }
  }

  /** Post-heartbeat re-trigger: if agent has remaining work in todo.md, fire again (up to maxRetriggers). */
  private checkRetrigger(entry: CronEntry): void {
    const agentName = entry.agent || "may";
    const heartbeatKey = `heartbeat:${agentName}`;
    const count = this.retriggerCounts.get(entry.name) ?? 0;

    if (this.hasRemainingWork(agentName)) {
      if (count < this.maxRetriggers) {
        this.retriggerCounts.set(entry.name, count + 1);
        this.triggerNow(entry.name, { force: true });
      } else {
        // Max re-triggers reached — reset and wait for next scheduled interval
        this.retriggerCounts.set(entry.name, 0);
        this.onError?.(`Cron re-trigger "${entry.name}" max reached (${this.maxRetriggers}) — waiting for next interval`);
      }
    } else {
      // No remaining work — reset count
      this.retriggerCounts.set(entry.name, 0);
    }
  }

  /** Check if an agent has unchecked tasks in their todo.md. */
  private hasRemainingWork(agentName: string): boolean {
    try {
      const todoPath = resolve(this.projectRoot, "agents", agentName, "workspace", "todo.md");
      if (!existsSync(todoPath)) return false;
      const content = readFileSync(todoPath, "utf-8");
      return content.includes("- [ ]");
    } catch {
      return false;
    }
  }

  /** Check if a session is still in the manager (includes idle persistent sessions). */
  private isSessionAlive(sessionId: string): boolean {
    try {
      const sessions = this.manager.status();
      return sessions.some((s) => s.sessionId === sessionId);
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

    handler()
      .then(() => {
        this.handlerRunning.delete(entry.name);
        this.checkPendingTrigger(entry);
        this.appendJobResult({
          jobName: entry.name,
          type: "job",
          status: "success",
          summary: `JS handler "${entry.name}" completed`,
          startedAt,
          endedAt: new Date().toISOString(),
          durationMs: Date.now() - startMs,
        });
      })
      .catch((err) => {
        this.handlerRunning.delete(entry.name);
        // Don't drain pending triggers on failure — prevents tight error loops
        this.pendingTriggers.delete(entry.name);
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

  // ── Detached agent job: spawn separate OS process ───────────────────

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

  private fireDetachedJob(entry: CronEntry): void {
    // If a detached process for this entry is tracked, check if it's still alive
    if (this.detachedRunning.has(entry.name)) {
      const tracked = this.detachedRunning.get(entry.name)!;
      if (this.isProcessAlive(tracked.pid)) {
        // Process still running — skip this fire
        const result = this.makeSkipResult(entry, "job");
        this.appendJobResult(result);
        this.onError?.(
          `Cron detached job "${entry.name}" skipped — detached process still running (pid=${tracked.pid})`,
        );
        return;
      }
      // Process is no longer running — clear tracking and allow re-fire
      this.detachedRunning.delete(entry.name);
    }

    this.onJobFire?.(entry, "detached");
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

      this.detachedRunning.set(entry.name, { sessionId, pid, startedAt });

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

  /** Clear tracking for a detached task (called when process completes). */
  clearDetachedTask(jobName: string): void {
    this.detachedRunning.delete(jobName);
  }

  /** Get info about running detached tasks. */
  getDetachedRunning(): Map<string, { sessionId: string; pid: number | undefined; startedAt: string }> {
    return new Map(this.detachedRunning);
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
