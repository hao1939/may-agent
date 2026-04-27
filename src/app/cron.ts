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

import { readFileSync, existsSync, watchFile, unwatchFile, type StatWatcher } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import type { SubagentManager } from "../lib/index.js";
import { generateId } from "../lib/index.js";
// Budget tiers now auto-resolved in manager.run() — import no longer needed here
import { getDb } from "../lib/requests.js";
import { spawnDetachedAgent } from "../lib/detached.js";
import {
  isAgentAutoPaused,
  getAutoPauseState,
  shouldFireProbe,
  buildProbeTaskMessage,
  createPauseEscalation,
  createRecoveryNotification,
  getLastErrors,
  parseAutoPauseConfig,
  AUTO_PAUSE_DEFAULTS,
  type AutoPauseConfig,
  type AutoPauseStateInfo,
} from "../lib/auto-pause.js";
import type { CronEntry } from "../lib/cron-tool.js";
import type { TriggerEvent } from "../lib/handler-context.js";

// ── Types ─────────────────────────────────────────────────────────────

/** A JS function that replaces the LLM for a specific cron job. */
type CronHandler = (event?: TriggerEvent) => Promise<void>;

/** Callback when a job fires (for notifications). */
type CronJobCallback = (entry: CronEntry, type: "js" | "heartbeat" | "detached") => void;

// ── Cron class ────────────────────────────────────────────────────────

export class Cron {
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  /** Pending setTimeout handles from startEntry (not yet promoted to setInterval). */
  private pendingStartTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private entries: CronEntry[] = [];
  private started = false;
  private handlers = new Map<string, CronHandler>();
  private onJobFire?: CronJobCallback;
  private configWatcher?: StatWatcher;
  /** Event-to-handler subscriptions: event type → list of entry names. */
  private eventSubscriptions = new Map<string, Set<string>>();
  /** Last event-trigger time per entry (for dedup). */
  private lastEventTrigger = new Map<string, number>();
  /** Dynamic handler resolver — called when reload() finds an entry with `handler` but no registered handler. */
  private handlerResolver?: (entryName: string, entry: CronEntry) => Promise<boolean>;

  /** Default minimum ms between reactive triggers for same entry.
   *  Per-entry cooldown = 75% of the entry's intervalMs (min 60s). */
  readonly defaultCooldownMs = 60_000;

  private projectRoot: string;
  private persistDir: string;

  /** Track which agents have already had an escalation created (avoid duplicates). */
  private autoPauseEscalated = new Set<string>();
  /** Track which agents were in auto-pause state (to detect recovery). */
  private autoPauseActive = new Map<string, { pausedAt: number; probeCount: number }>();
  /** In-flight jobs: entry name → start timestamp. Replaces requests table overlap check. */
  private inflightJobs = new Map<string, number>();
  /** Last fire time per entry. */
  private lastFireTimes = new Map<string, number>();

  constructor(
    private configPath: string,
    private manager: SubagentManager,
    private getSessionId: () => string,
    private onError?: (msg: string) => void,
    projectRoot?: string,
    private notify?: (msg: string) => void,
    private emitEvent?: (event: any) => void,
  ) {
    this.projectRoot = projectRoot ?? resolve(dirname(configPath), "../..");
    this.persistDir = resolve(this.projectRoot, ".state");
  }

  registerHandler(jobName: string, handler: CronHandler): void {
    this.handlers.set(jobName, handler);
  }

  /** Set a resolver for dynamically loading handlers when new entries appear post-startup. */
  setHandlerResolver(resolver: (entryName: string, entry: CronEntry) => Promise<boolean>): void {
    this.handlerResolver = resolver;
  }

  onFire(cb: CronJobCallback): void {
    this.onJobFire = cb;
  }

  private lastConfigHash = "";
  private configPollTimer?: ReturnType<typeof setInterval>;

  /** Compute MD5 hash of file content for change detection. */
  private hashFileContent(path: string): string {
    try {
      const content = readFileSync(path, "utf-8");
      return createHash("md5").update(content).digest("hex");
    } catch {
      return "";
    }
  }

  /** Watch cron.json for changes and auto-reload when modified.
   *  Uses content-hash comparison (not mtime) for reliability in containers. */
  watchConfig(): void {
    if (this.configWatcher) return; // already watching
    if (!existsSync(this.configPath)) return;

    // Record current content hash so we can detect changes
    this.lastConfigHash = this.hashFileContent(this.configPath);

    // Primary: fs.watchFile (stat-based polling every 30s)
    this.configWatcher = watchFile(this.configPath, { interval: 30_000 }, () => {
      const newHash = this.hashFileContent(this.configPath);
      if (newHash && newHash !== this.lastConfigHash) {
        this.lastConfigHash = newHash;
        this.onError?.(`Config file changed on disk — auto-reloading (watchFile)`);
        this.reload();
      }
    });

    // Fallback: explicit content-hash poll every 15s (watchFile can be unreliable in containers)
    this.configPollTimer = setInterval(() => {
      try {
        if (!existsSync(this.configPath)) return;
        const newHash = this.hashFileContent(this.configPath);
        if (this.lastConfigHash && newHash && newHash !== this.lastConfigHash) {
          this.lastConfigHash = newHash;
          this.onError?.(`Config file changed on disk — auto-reloading (poll fallback)`);
          this.reload();
        }
      } catch {}
    }, 15_000);
  }

  /** Stop watching cron.json. */
  unwatchConfig(): void {
    if (this.configWatcher) {
      unwatchFile(this.configPath);
      this.configWatcher = undefined;
    }
    if (this.configPollTimer) {
      clearInterval(this.configPollTimer);
      this.configPollTimer = undefined;
    }
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
    this.buildEventSubscriptions();
    return this.entries;
  }

  /** Add a synthetic (auto-generated) entry not from cron.json. Starts it if cron is running. */
  addSyntheticEntry(entry: CronEntry): void {
    // Don't add if an entry with this name already exists
    if (this.entries.some(e => e.name === entry.name)) return;
    this.entries.push(entry);
    this.buildEventSubscriptions();
    if (this.started && entry.enabled !== false) {
      this.startEntry(entry);
    }
  }

  /** Build event-to-handler mapping from `on` fields in cron entries. */
  private buildEventSubscriptions(): void {
    this.eventSubscriptions.clear();
    for (const entry of this.entries) {
      if (!entry.enabled || !entry.on?.length) continue;
      for (const eventType of entry.on) {
        let set = this.eventSubscriptions.get(eventType);
        if (!set) { set = new Set(); this.eventSubscriptions.set(eventType, set); }
        set.add(entry.name);
      }
    }
  }

  /** Dispatch a system event — triggers all handlers subscribed to this event type. */
  dispatchEvent(eventType: string, data?: Record<string, unknown>): number {
    const subscribers = this.eventSubscriptions.get(eventType);
    if (!subscribers?.size) return 0;
    let triggered = 0;
    for (const entryName of subscribers) {
      // Dedup: skip if triggered < 5s ago
      const last = this.lastEventTrigger.get(entryName) || 0;
      if (Date.now() - last < 5000) continue;
      this.lastEventTrigger.set(entryName, Date.now());
      const triggerEvent: TriggerEvent = {
        type: eventType, source: "event", entry: entryName,
        data, timestamp: Date.now(),
      };
      if (this.triggerNow(entryName, { force: true, triggerEvent })) triggered++;
    }
    return triggered;
  }

  start(): void {
    this.stop();
    this.started = true;
    this.load();
    for (const entry of this.entries) {
      if (entry.enabled === false) continue;
      this.startEntry(entry);
    }
    this.watchConfig();
  }

  stop(): void {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
    for (const timer of this.pendingStartTimers.values()) clearTimeout(timer);
    this.pendingStartTimers.clear();
    this.started = false;
    this.unwatchConfig();
  }

  reload(): void {
    const oldEntries = new Map(this.entries.map((e) => [e.name, e]));
    this.load();
    if (this.started) {
      // Smart reload: only restart entries whose config actually changed.
      // This prevents the "timer reset" bug where reload() resets all
      // timers and long-interval entries fire early (P-cron-overtrigger).
      const newNames = new Set(this.entries.map((e) => e.name));

      // Stop entries that were removed or disabled
      for (const [name, _old] of oldEntries) {
        if (!newNames.has(name)) {
          const timer = this.timers.get(name);
          if (timer) clearInterval(timer);
          this.timers.delete(name);
          const pending = this.pendingStartTimers.get(name);
          if (pending) clearTimeout(pending);
          this.pendingStartTimers.delete(name);
        }
      }

      let changedCount = 0;
      for (const entry of this.entries) {
        const old = oldEntries.get(entry.name);
        const configChanged =
          !old ||
          old.intervalMs !== entry.intervalMs ||
          old.message !== entry.message ||
          old.agent !== entry.agent ||
          old.handler !== entry.handler ||
          old.type !== entry.type ||
          (old.enabled === false) !== (entry.enabled === false) ||
          JSON.stringify(old.handlerConfig ?? {}) !== JSON.stringify(entry.handlerConfig ?? {});

        if (entry.enabled === false) {
          // Newly disabled — stop timer
          const timer = this.timers.get(entry.name);
          if (timer) clearInterval(timer);
          this.timers.delete(entry.name);
          const pending = this.pendingStartTimers.get(entry.name);
          if (pending) clearTimeout(pending);
          this.pendingStartTimers.delete(entry.name);
          continue;
        }

        if (configChanged) {
          changedCount++;
          // Config changed — restart this entry's timer
          const timer = this.timers.get(entry.name);
          if (timer) clearInterval(timer);
          this.timers.delete(entry.name);
          const pending = this.pendingStartTimers.get(entry.name);
          if (pending) clearTimeout(pending);
          this.pendingStartTimers.delete(entry.name);

          // If entry has a handler field but no registered handler, try dynamic resolution
          if (entry.handler && !this.handlers.has(entry.name) && this.handlerResolver) {
            const entrySnapshot = { ...entry };
            this.handlerResolver(entry.name, entrySnapshot)
              .then((resolved) => {
                if (resolved) {
                  this.onError?.(`[handler] Dynamically resolved handler for "${entrySnapshot.name}" on reload`);
                } else {
                  this.onError?.(
                    `⚠️ [handler] Failed to resolve handler for "${entrySnapshot.name}" — entry will be skipped until next reload`,
                  );
                }
                this.startEntry(entrySnapshot);
              })
              .catch((err) => {
                const errMsg = err instanceof Error ? err.message : String(err);
                this.onError?.(
                  `⚠️ [handler] Error resolving handler for "${entrySnapshot.name}": ${errMsg} — entry will be skipped`,
                );
                // Still try to start — resolveMode() will skip if handler is missing
                this.startEntry(entrySnapshot);
              });
          } else {
            this.startEntry(entry);
          }

          this.onError?.(
            `Reloaded "${entry.name}": intervalMs=${entry.intervalMs}${old ? ` (was ${old.intervalMs})` : " (new)"}`,
          );
        }
        // Unchanged entries keep their existing timer — no reset
        // But try to register unregistered handlers (e.g., handler file was fixed after startup)
        if (!configChanged && entry.handler && !this.handlers.has(entry.name) && this.handlerResolver) {
          const entrySnapshot = { ...entry };
          this.handlerResolver(entry.name, entrySnapshot)
            .then((resolved) => {
              if (resolved) {
                this.onError?.(`[handler] Late-registered handler for "${entrySnapshot.name}" on reload`);
              }
            })
            .catch(() => { /* silent — will retry on next reload */ });
        }
      }
      if (changedCount === 0) {
        this.onError?.(`Config reload: no entries changed`);
      }
    }
  }

  getEntries(): CronEntry[] {
    return [...this.entries];
  }

  /** Trigger a cron entry immediately. Always fires (no overlap check).
   *  Returns false only if entry not found or debounced. */
  triggerNow(entryName: string, opts?: { force?: boolean; triggerEvent?: TriggerEvent }): boolean {
    const entry = this.entries.find((e) => e.name === entryName);
    if (!entry) return false;

    // Debounce rapid re-triggers (unless forced)
    if (!opts?.force) {
      const cooldownMs = Math.max(entry.intervalMs * 0.75, this.defaultCooldownMs);
      try {
        const lastFire = this.getLastFireTime(entryName);
        if (lastFire && Date.now() - lastFire < cooldownMs) return false;
      } catch {
        /* db unavailable — allow trigger */
      }
    }

    const mode = this.resolveMode(entry);
    if (!mode) return false;

    // Manual trigger — always fire, no overlap check
    switch (mode) {
      case "heartbeat":
        this.fireHeartbeat(entry);
        break;
      case "job-handler":
        this.fireHandler(entry, opts?.triggerEvent ?? { type: "manual.trigger", source: "manual", entry: entry.name, timestamp: Date.now() });
        break;
      case "job-detached":
        this.fireDetachedJob(entry);
        break;
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
    const start = this.inflightJobs.get(entryName);
    if (!start) return false;
    // Consider dead after 10 min
    if (Date.now() - start > 10 * 60_000) {
      this.inflightJobs.delete(entryName);
      return false;
    }
    return true;
  }

  /** Check if any heartbeat for a given agent is currently active. */
  private isAgentHeartbeatRunning(agentName: string): boolean {
    for (const entry of this.entries) {
      if ((entry.agent || "may") === agentName && this.isRunning(entry.name)) return true;
    }
    return false;
  }

  /** Get the last fire time for a job (epoch ms). */
  private getLastFireTime(entryName: string): number | null {
    return this.lastFireTimes.get(entryName) ?? null;
  }

  /** Get PID from a running detached job's context. */
  private getRunningPid(entryName: string): number | null {
    try {
      const db = getDb(this.persistDir);
      const row = db
        .prepare(
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
    } catch {
      /* ignore */
    }
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
        // DB-based auto-pause with recovery: persistent across restarts
        const apConfig = parseAutoPauseConfig(entry.handlerConfig);
        const apState = getAutoPauseState(this.persistDir, agentName, apConfig);
        if (apState.state === "auto-paused") {
          if (apState.probeDue) {
            // Probe is due — fire a probe session instead of normal heartbeat
            this.fireHeartbeat(entry, { probe: true, apState, apConfig });
            return;
          }
          // Still paused, no probe due — skip
          const nextProbeIn = apState.nextProbeDelayMs
            ? `next probe in ~${Math.round(apState.nextProbeDelayMs / 60000)}m`
            : "calculating";
          this.onError?.(
            `[auto-pause] Skipping ${agentName} heartbeat — paused (${apState.probeFailCount} probe failures, ${nextProbeIn})`,
          );
          // Create escalation on first detection (idempotent via set check)
          if (!this.autoPauseEscalated.has(agentName)) {
            this.autoPauseEscalated.add(agentName);
            this.autoPauseActive.set(agentName, {
              pausedAt: apState.pausedAt!,
              probeCount: apState.probeFailCount,
            });
            const errors = getLastErrors(this.persistDir, agentName, apConfig.threshold);
            createPauseEscalation(this.persistDir, agentName, apConfig, errors);
            const msg = `[auto-pause] Agent "${agentName}" paused after ${apConfig.threshold} consecutive errors. Probe in ${Math.round(apConfig.initialProbeDelayMs / 60000)}m.`;
            this.notify?.(msg);
          }
          return;
        }
        if (apState.state === "probing") {
          // A probe is currently running — don't fire another one
          this.onError?.(`[auto-pause] Skipping ${agentName} heartbeat — probe in progress`);
          return;
        }
        // state === "running" — check if we just recovered from auto-pause
        if (this.autoPauseActive.has(agentName)) {
          const pauseInfo = this.autoPauseActive.get(agentName)!;
          const pauseDurationMs = Date.now() - pauseInfo.pausedAt;
          createRecoveryNotification(
            this.persistDir,
            agentName,
            apConfig,
            pauseInfo.probeCount,
            pauseDurationMs,
          );
          this.autoPauseActive.delete(agentName);
          this.autoPauseEscalated.delete(agentName);
          const msg = `[auto-pause] Agent "${agentName}" recovered after ${pauseInfo.probeCount} probes.`;
          this.notify?.(msg);
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

      // Auto-pause for non-heartbeat agent modes: persistent across restarts
      if (mode !== "heartbeat" && entry.agent) {
        const jobApConfig = parseAutoPauseConfig(entry.handlerConfig);
        const jobApState = getAutoPauseState(this.persistDir, entry.agent, jobApConfig);
        if (jobApState.state === "auto-paused" && !jobApState.probeDue) {
          this.onError?.(
            `[auto-pause] Skipping ${entry.agent} job "${entry.name}" — paused (${jobApState.probeFailCount} probe failures)`,
          );
          return;
        }
      }

      switch (mode) {
        case "heartbeat":
          this.fireHeartbeat(entry);
          break;
        case "job-handler":
          this.fireHandler(entry, { type: "timer.tick", source: "timer", entry: entry.name, timestamp: Date.now() });
          break;
        case "job-detached":
          this.fireDetachedJob(entry);
          break;
      }
    };

    const delay = this.computeResumeDelay(entry, mode);

    const startTimer = setTimeout(() => {
      this.pendingStartTimers.delete(entry.name);
      fire();
      const timer = setInterval(fire, entry.intervalMs);
      timer.unref();
      this.timers.set(entry.name, timer);
    }, delay);
    startTimer.unref();
    this.pendingStartTimers.set(entry.name, startTimer);
    // Note: only store in pendingStartTimers during initial delay.
    // The setInterval handle is stored in this.timers once the setTimeout fires.
    // Do NOT store the setTimeout in this.timers — reload() clears both maps.
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
      // Never ran — use offsetMs for deterministic staggering.
      // If no offsetMs, fall back to random jitter.
      const offset = entry.offsetMs ?? 0;
      if (offset > 0) {
        return offset;
      }
      const MAX_INITIAL_JITTER_MS = 5 * 60 * 1000; // 5 minutes
      const jitterWindow = Math.min(entry.intervalMs, MAX_INITIAL_JITTER_MS);
      return Math.floor(Math.random() * jitterWindow);
    }

    const elapsed = Date.now() - lastFire;
    if (elapsed >= entry.intervalMs) {
      return 0; // overdue
    }
    return entry.intervalMs - elapsed;
  }

  // ── Heartbeat: spawn fresh task session ─────────────────────────────

  private fireHeartbeat(
    entry: CronEntry,
    _opts?: { probe?: boolean; apState?: AutoPauseStateInfo; apConfig?: AutoPauseConfig },
  ): void {
    // Legacy: no cron entries use type=heartbeat anymore.
    // All agents use type=job + handler=run-workflow.
    this.onError?.(`fireHeartbeat called for "${entry.name}" but type=heartbeat is deprecated. Use handler=run-workflow.`);
  }


  // ── Job with JS handler: run in-process ─────────────────────────────

  private fireHandler(entry: CronEntry, triggerEvent?: TriggerEvent): void {
    const handler = this.handlers.get(entry.name);
    if (!handler) {
      this.onError?.(`Cron job "${entry.name}" has no registered handler`);
      return;
    }

    this.onJobFire?.(entry, "js");
    const startMs = Date.now();
    this.inflightJobs.set(entry.name, startMs);
    this.lastFireTimes.set(entry.name, startMs);
    const agent = entry.agent || "may";

    this.emitEvent?.({ type: "emit", event: "handler.started", data: { handler: entry.name, agent } });

    const HANDLER_TIMEOUT_MS = 5 * 60_000; // 5 min max per handler

    const handlerPromise = handler(triggerEvent);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Handler "${entry.name}" timed out after ${HANDLER_TIMEOUT_MS / 1000}s`)), HANDLER_TIMEOUT_MS)
    );

    Promise.race([handlerPromise, timeoutPromise])
      .then(() => {
        this.inflightJobs.delete(entry.name);
        this.emitEvent?.({ type: "emit", event: "handler.completed", data: { handler: entry.name, agent, durationMs: Date.now() - startMs } });
      })
      .catch((err) => {
        this.inflightJobs.delete(entry.name);
        const errMsg = err instanceof Error ? err.message : String(err);
        this.emitEvent?.({ type: "emit", event: "handler.failed", data: { handler: entry.name, agent, error: errMsg, durationMs: Date.now() - startMs } });
        this.onError?.(`Cron handler "${entry.name}" failed: ${errMsg}`);
        this.notify?.(`⚠️ Handler "${entry.name}" failed: ${errMsg}`);
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
    } catch {
      /* no active parent session */
    }

    try {
      const { pid } = spawnDetachedAgent({
        projectRoot: this.projectRoot,
        agentName: entry.agent ?? "may",
        task: entry.message ?? "",
        sessionId,
        parentSessionId,
      });

      this.inflightJobs.set(entry.name, Date.now());
      this.lastFireTimes.set(entry.name, Date.now());

      // Detached jobs are IN_PROGRESS immediately — they complete when the
      // process finishes and calls clearDetachedTask(), or get cleaned up
      // as orphans on next restart.
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Track the failed spawn attempt
      // Error tracked via onError/notify
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
    } catch {
      /* ignore */
    }
  }

  /** Get info about running detached tasks (from requests table). */
  getDetachedRunning(): Map<string, { sessionId: string; pid: number | undefined; startedAt: string }> {
    const result = new Map<string, { sessionId: string; pid: number | undefined; startedAt: string }>();
    try {
      const db = getDb(this.persistDir);
      const rows = db
        .prepare(
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
        } catch {
          /* ignore */
        }
        if (pid && this.isProcessAlive(pid)) {
          result.set(row.artifact, {
            sessionId: row.sessionId ?? "",
            pid,
            startedAt: new Date(row.createdAt).toISOString(),
          });
        }
      }
    } catch {
      /* ignore */
    }
    return result;
  }
}
