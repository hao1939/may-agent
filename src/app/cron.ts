/**
 * Cron — manages periodic jobs with persistent state via request tracking.
 *
 * One scheduled job shape. The executor is determined by entry fields:
 * - `handler`: run a registered JS function in-process.
 * - no `handler` + `agent`: spawn a detached agent process.
 *
 * Heartbeats are normal handler jobs that run per-agent heartbeat workflows.
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
import type { EventBus, SystemEvent } from "./event-bus.js";
import type { SubagentManager } from "../lib/index.js";
import { generateId } from "../lib/index.js";
// Budget tiers now auto-resolved in manager.run() — import no longer needed here
import { getDb } from "../lib/requests.js";
import { spawnDetachedAgent } from "../lib/detached.js";
import type { CronEntry } from "../lib/cron-tool.js";
import type { TriggerEvent } from "../lib/handler-context.js";

// ── Types ─────────────────────────────────────────────────────────────

/** A JS function that replaces the LLM for a specific cron job. */
type CronHandler = (event?: TriggerEvent) => Promise<void>;

type CronExecutor = "handler" | "agent";

/** Callback when a job fires (for notifications). */
type CronJobCallback = (entry: CronEntry, executor: CronExecutor) => void;

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
    private emitEvent?: (event: SystemEvent) => void,
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

  /** Dispatch a system event — triggers all handlers subscribed to this event type AND emits on bus. */
  dispatchEvent(eventType: string, data?: Record<string, unknown>): number {
    // Emit on EventBus for system-wide observability (metric.breach, etc.)
    if (this.emitEvent) {
      this.emitEvent({ type: eventType, ...(data || {}) } as any);
    }
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

  /** Subscribe to bus — auto-dispatch domain events (dot-separated types) to handlers.
   *  Also handles `heartbeat` events: triggers the matching heartbeat entry. */
  subscribeToBus(bus: EventBus): void {
    bus.subscribe((event) => {
      // Heartbeat event → trigger the matching cron entry
      if (event.type === "heartbeat" && "agent" in event) {
        const agent = (event as any).agent as string;
        const entryName = agent === "may" ? "heartbeat" : `heartbeat-${agent}`;
        // Only trigger if it wasn't fired by us (avoid loop: fireHandler emits → bus → triggerNow)
        if (!this.isRunning(entryName)) {
          this.triggerNow(entryName, { force: true });
        }
        return;
      }
      if (!event.type.includes('.')) return;
      this.dispatchEvent(event.type, event as any);
    });
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
      case "handler":
        this.fireHandler(entry, opts?.triggerEvent ?? { type: "manual.trigger", source: "manual", entry: entry.name, timestamp: Date.now() });
        break;
      case "agent":
        this.fireDetachedJob(entry);
        break;
    }
    return true;
  }

  /** Resolve the effective execution mode for an entry. */
  private resolveMode(entry: CronEntry): CronExecutor | null {
    if (entry.handler) {
      const handler = this.handlers.get(entry.name);
      if (handler) return "handler";
      this.onError?.(`Cron entry "${entry.name}" declares handler "${entry.handler}" but it is not registered — skipping`);
      return null;
    }
    if (entry.agent) return "agent";

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

  /** Get the last fire time for a job (epoch ms). */
  private getLastFireTime(entryName: string): number | null {
    return this.lastFireTimes.get(entryName) ?? null;
  }

  // ── Scheduling with resume ──────────────────────────────────────────

  private startEntry(entry: CronEntry): void {
    const mode = this.resolveMode(entry);
    if (!mode) return;

    const fire = () => {
      // Overlap protection: skip if a previous run is still in flight.
      if (this.isRunning(entry.name)) {
        this.onError?.(`Cron "${entry.name}" skipped — still running`);
        return;
      }

      // Auto-pause was removed in v0.5 cleanup — agent health is now
      // observable through metrics + escalations instead of being
      // enforced at the cron layer.

      switch (mode) {
        case "handler":
          this.fireHandler(entry, { type: "timer.tick", source: "timer", entry: entry.name, timestamp: Date.now() });
          break;
        case "agent":
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
  private computeResumeDelay(entry: CronEntry, _mode: string): number {
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

  // ── Job with JS handler: run in-process ─────────────────────────────

  private fireHandler(entry: CronEntry, triggerEvent?: TriggerEvent): void {
    const handler = this.handlers.get(entry.name);
    if (!handler) {
      this.onError?.(`Cron job "${entry.name}" has no registered handler`);
      return;
    }

    this.onJobFire?.(entry, "handler");
    const startMs = Date.now();
    this.inflightJobs.set(entry.name, startMs);
    this.lastFireTimes.set(entry.name, startMs);
    const agent = entry.agent || "may";

    // Emit heartbeat event on bus for heartbeat entries (event-driven: anything can trigger via bus)
    if (entry.name.startsWith("heartbeat")) {
      this.emitEvent?.({ type: "heartbeat", agent, entry: entry.name });
    }

    this.emitEvent?.({ type: "handler.started", handler: entry.name, agent });

    const HANDLER_TIMEOUT_MS = Number(entry.handlerConfig?.timeoutMs) || 5 * 60_000; // per-handler or 5min default

    const handlerPromise = handler(triggerEvent);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Handler "${entry.name}" timed out after ${HANDLER_TIMEOUT_MS / 1000}s`)), HANDLER_TIMEOUT_MS)
    );

    Promise.race([handlerPromise, timeoutPromise])
      .then(() => {
        this.inflightJobs.delete(entry.name);
        this.emitEvent?.({ type: "handler.completed", handler: entry.name, agent, durationMs: Date.now() - startMs });
      })
      .catch((err) => {
        this.inflightJobs.delete(entry.name);
        const errMsg = err instanceof Error ? err.message : String(err);
        this.emitEvent?.({ type: "handler.failed", handler: entry.name, agent, error: errMsg, durationMs: Date.now() - startMs });
        this.onError?.(`Cron handler "${entry.name}" failed: ${errMsg}`);
        this.notify?.(`\u26a0\ufe0f Handler "${entry.name}" failed: ${errMsg}`);
      });
  }

  // ── Detached agent job: spawn separate OS process ───────────────────

  private fireDetachedJob(entry: CronEntry): void {
    this.onJobFire?.(entry, "agent");

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
}
