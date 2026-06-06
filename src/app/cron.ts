/**
 * Cron — historical name for the trigger scheduler.
 *
 * One trigger entry shape. Timer ticks, event subscriptions, and manual
 * `trigger.<entry>` shortcuts invoke the same handler interface:
 * - `handler: "name"` runs a registered JS function in-process.
 * - `handler: { workflow, agent, task }` runs a workflow-backed handler.
 *
 * Heartbeats are normal workflow-backed handlers.
 *
 * Handler execution is tracked in memory for single-flight/concurrency control.
 * On restart, timer entries resume based on when they actually last ran — not from zero.
 * All trigger paths use the same per-entry capacity limit.
 *
 * Design: docs/design/cron-sqlite.md
 */

import { readFileSync, existsSync, watchFile, unwatchFile, type StatWatcher } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import type { EventBus, SystemEvent } from "./event-bus.js";
import type { SubagentManager } from "../lib/index.js";
import { getDb } from "../lib/requests.js";
import type { CronEntry, WorkflowBackedHandler } from "../lib/cron-tool.js";
import type { EventEnvelope } from "../lib/handler-context.js";

// ── Types ─────────────────────────────────────────────────────────────

/** A JS function that replaces the LLM for a specific cron job. */
type CronHandler = (event?: EventEnvelope) => Promise<void>;

/** Callback when a job fires (for notifications). */
type CronJobCallback = (entry: CronEntry) => void;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function workflowHandler(handler: CronEntry["handler"]): WorkflowBackedHandler | undefined {
  return handler && typeof handler === "object" && typeof handler.workflow === "string" ? handler : undefined;
}

function handlerDisplay(handler: CronEntry["handler"]): string {
  if (!handler) return "";
  if (typeof handler === "string") return handler;
  return `workflow:${handler.agent ? `${handler.agent}/` : ""}${handler.workflow}`;
}

function ownerAgent(owner: unknown): string | undefined {
  if (typeof owner !== "string") return undefined;
  const value = owner.trim();
  if (value.startsWith("agent:")) return value.slice("agent:".length);
  return value || undefined;
}

function heartbeatTriggerAgent(event: unknown): string | undefined {
  const record = asRecord(event);
  const nested = asRecord(record?.data);
  const fromData = typeof nested?.agent === "string" ? nested.agent.trim() : "";
  return fromData || ownerAgent(record?.owner) || ownerAgent(record?.agent);
}

function entryAgent(entry: CronEntry): string | undefined {
  const fromHandler = workflowHandler(entry.handler)?.agent?.trim() ?? "";
  const fromEntry = typeof entry.agent === "string" ? entry.agent.trim() : "";
  if (fromHandler || fromEntry) return fromHandler || fromEntry;
  if (entry.name === "heartbeat") return "may";
  if (entry.name.startsWith("heartbeat-")) return entry.name.slice("heartbeat-".length);
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isEventEnvelope(event: unknown): event is EventEnvelope {
  return isRecord(event)
    && typeof event.type === "string"
    && typeof event.source === "string"
    && typeof event.owner === "string"
    && isRecord(event.data);
}

function eventPayloadFromFlatCommand(event: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (key === "type" || key === "source" || key === "owner" || key === "timestamp" || key === "urgency" || key === "ttl_ms") continue;
    payload[key] = value;
  }
  return payload;
}

function toEventEnvelope(
  event: { type: string; [key: string]: unknown },
  defaults: { source: string; owner: string; data?: Record<string, unknown> },
): EventEnvelope {
  if (isEventEnvelope(event)) return event;
  return {
    type: event.type,
    source: typeof event.source === "string" ? event.source : defaults.source,
    owner: typeof event.owner === "string" ? event.owner : defaults.owner,
    timestamp: typeof event.timestamp === "number" ? event.timestamp : Date.now(),
    data: defaults.data ?? eventPayloadFromFlatCommand(event),
  };
}

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
  /** Event-trigger queue per entry. Preserves event-driven work when an entry is at concurrency capacity. */
  private queuedEventTriggers = new Map<string, EventEnvelope[]>();
  /** Dynamic handler resolver — called when reload() finds an entry with `handler` but no registered handler. */
  private handlerResolver?: (entryName: string, entry: CronEntry) => Promise<boolean>;

  /** Default minimum ms between reactive triggers for same entry.
   *  Per-entry cooldown = 75% of the entry's intervalMs (min 60s). */
  readonly defaultCooldownMs = 60_000;

  private persistDir: string;

  /** In-flight jobs: entry name → start timestamps. Replaces requests table overlap check. */
  private inflightJobs = new Map<string, number[]>();

  /** Last fire time per entry. */
  private lastFireTimes = new Map<string, number>();

  constructor(
    private configPath: string,
    _manager: SubagentManager,
    _getSessionId: () => string,
    private onError?: (msg: string) => void,
    projectRoot?: string,
    private notify?: (msg: string) => void,
    private emitEvent?: (event: SystemEvent) => void,
  ) {
    this.persistDir = resolve(projectRoot ?? resolve(dirname(configPath), "../.."), ".state");
  }

  registerHandler(jobName: string, handler: CronHandler): void {
    this.handlers.set(jobName, handler);
  }

  getConfigPath(): string {
    return this.configPath;
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
        const hasEventSubscription = Array.isArray(entry.on) && entry.on.length > 0;
        if (!entry.name || (!entry.intervalMs && !hasEventSubscription)) {
          this.onError?.(`Invalid cron entry: ${JSON.stringify(entry)}`);
          return false;
        }
        if (!entry.handler) {
          this.onError?.(`Cron entry "${entry.name}" needs handler`);
          return false;
        }
        const workflow = workflowHandler(entry.handler);
        if (workflow && (!workflow.workflow || !workflow.task)) {
          this.onError?.(`Cron entry "${entry.name}" workflow handler needs workflow and task`);
          return false;
        }
        if (entry.intervalMs != null && entry.intervalMs < 10_000) {
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
      // For handler-based entries not yet registered, try handlerResolver first
      if (entry.handler && !this.handlers.has(entry.name) && this.handlerResolver) {
        const entrySnapshot = { ...entry };
        this.handlerResolver(entry.name, entrySnapshot)
          .then((resolved) => {
            if (resolved) {
              this.startEntry(entrySnapshot);
            } else {
              this.onError?.(`Synthetic entry "${entry.name}" handler "${handlerDisplay(entry.handler)}" could not be resolved`);
            }
          })
          .catch(() => {
            this.onError?.(`Synthetic entry "${entry.name}" handler resolution failed`);
          });
      } else {
        this.startEntry(entry);
      }
    }
  }

  /** Build event-to-handler mapping from `on` fields in cron entries. */
  private buildEventSubscriptions(): void {
    this.eventSubscriptions.clear();
    for (const entry of this.entries) {
      if (entry.enabled === false || !entry.on?.length) continue;
      for (const eventType of entry.on) {
        let set = this.eventSubscriptions.get(eventType);
        if (!set) { set = new Set(); this.eventSubscriptions.set(eventType, set); }
        set.add(entry.name);
      }
    }
  }

  /** Dispatch a new system event — emits it on the bus, then triggers subscribed handlers. */
  dispatchEvent(eventType: string, data?: Record<string, unknown>): number {
    const event: EventEnvelope = {
      type: eventType,
      source: "cron",
      owner: "agent:may",
      timestamp: Date.now(),
      data: data ?? {},
    };
    if (this.emitEvent) {
      this.emitEvent(event as any);
    }
    return this.triggerSubscribers(eventType, event);
  }

  /** Trigger handlers subscribed to an event that is already on the bus. */
  private triggerSubscribers(eventType: string, event: EventEnvelope): number {
    const subscribers = this.eventSubscriptions.get(eventType);
    if (!subscribers?.size) return 0;
    let triggered = 0;
    const targetHeartbeatAgent = eventType === "heartbeat.trigger" ? heartbeatTriggerAgent(event) : undefined;
    for (const entryName of subscribers) {
      const entry = this.entries.find((candidate) => candidate.name === entryName);
      if (targetHeartbeatAgent && entry && entryAgent(entry) !== targetHeartbeatAgent) continue;
      if (this.triggerNow(entryName, { force: true, triggerEvent: event })) triggered++;
    }
    return triggered;
  }

  /** Subscribe to bus — auto-dispatch domain events (dot-separated types) to handlers.
   *  Also handles `heartbeat` events: triggers the matching heartbeat entry. */
  subscribeToBus(bus: EventBus): void {
    bus.subscribe((event) => {
      // Convention trigger: any entry can be manually fired by emitting
      // `trigger.<entry-name>`. This keeps operator/adapters simple and avoids
      // per-entry `on` boilerplate for timer jobs.
      if (event.type.startsWith("trigger.")) {
        const entryName = event.type.slice("trigger.".length);
        if (entryName) {
          this.triggerNow(entryName, {
            force: true,
            triggerEvent: toEventEnvelope(event as any, { source: "manual", owner: "agent:may" }),
          });
        }
        return;
      }

      // Heartbeat event -> trigger the matching entry.
      if (event.type === "heartbeat" && "agent" in event) {
        const agent = (event as any).agent as string;
        const entryName = agent === "may" ? "heartbeat" : `heartbeat-${agent}`;
        // Only trigger if it wasn't fired by us (avoid loop: fireHandler emits → bus → triggerNow)
        if (!this.isRunning(entryName)) {
          this.triggerNow(entryName, { force: true });
        }
        return;
      }
      if (!event.type.includes(".")) return;
      if (!isEventEnvelope(event)) return;
      this.triggerSubscribers(event.type, event);
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
          old.maxConcurrentTriggers !== entry.maxConcurrentTriggers ||
          old.message !== entry.message ||
          old.agent !== entry.agent ||
          JSON.stringify(old.handler ?? null) !== JSON.stringify(entry.handler ?? null) ||
          JSON.stringify(old.on ?? []) !== JSON.stringify(entry.on ?? []) ||
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
            `Reloaded "${entry.name}": intervalMs=${entry.intervalMs ?? "event-only"}${old ? ` (was ${old.intervalMs ?? "event-only"})` : " (new)"}`,
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

  /** Trigger an entry immediately. Force bypasses debounce, but never overlaps a running entry.
   *  Returns false if entry not found, debounced, or already running. */
  triggerNow(entryName: string, opts?: { force?: boolean; triggerEvent?: EventEnvelope }): boolean {
    const entry = this.entries.find((e) => e.name === entryName);
    if (!entry) return false;

    if (!this.hasCapacity(entry)) {
      if (opts?.triggerEvent) {
        this.enqueueEventTrigger(entryName, opts.triggerEvent);
        return true;
      }
      this.onError?.(`Cron "${entryName}" trigger skipped — at concurrency capacity`);
      return false;
    }

    // Debounce rapid re-triggers (unless forced)
    if (!opts?.force) {
      const cooldownMs = Math.max((entry.intervalMs ?? this.defaultCooldownMs) * 0.75, this.defaultCooldownMs);
      try {
        const lastFire = this.getLastFireTime(entryName);
        if (lastFire && Date.now() - lastFire < cooldownMs) return false;
      } catch {
        /* db unavailable — allow trigger */
      }
    }

    if (!this.resolveMode(entry)) return false;

    // Manual/event/timer triggers all use the same handler execution path.
    this.fireHandler(entry, opts?.triggerEvent ?? {
      type: `trigger.${entry.name}`,
      source: "manual",
      owner: `agent:${entryAgent(entry) || "may"}`,
      timestamp: Date.now(),
      data: { entry: entry.name },
    });
    return true;
  }

  private enqueueEventTrigger(entryName: string, event: EventEnvelope): void {
    let queue = this.queuedEventTriggers.get(entryName);
    if (!queue) {
      queue = [];
      this.queuedEventTriggers.set(entryName, queue);
    }
    queue.push(event);
    this.onError?.(`Cron "${entryName}" event queued — at concurrency capacity (${queue.length} pending)`);
  }

  private drainQueuedEventTrigger(entryName: string): void {
    const entry = this.entries.find((candidate) => candidate.name === entryName);
    if (!entry || entry.enabled === false) return;
    if (!this.hasCapacity(entry)) return;

    const queue = this.queuedEventTriggers.get(entryName);
    if (!queue || queue.length === 0) {
      this.queuedEventTriggers.delete(entryName);
      return;
    }
    const event = queue.shift()!;
    if (queue.length === 0) this.queuedEventTriggers.delete(entryName);

    setTimeout(() => {
      this.triggerNow(entryName, { force: true, triggerEvent: event });
    }, 0).unref();
  }

  /** Resolve the effective execution mode for an entry. */
  private resolveMode(entry: CronEntry): boolean {
    if (entry.handler) {
      const handler = this.handlers.get(entry.name);
      if (handler) return true;
      this.onError?.(`Cron entry "${entry.name}" declares handler "${handlerDisplay(entry.handler)}" but it is not registered — skipping`);
      return false;
    }
    this.onError?.(`Cron entry "${entry.name}" has no handler — skipping`);
    return false;
  }

  // ── In-flight execution state ───────────────────────────────────────

  /** Return active handler start times, pruning stale entries. */
  private activeInflightStarts(entryName: string): number[] {
    const starts = this.inflightJobs.get(entryName) ?? [];
    const cutoff = Date.now() - 10 * 60_000;
    const active = starts.filter((start) => start >= cutoff);
    if (active.length > 0) {
      this.inflightJobs.set(entryName, active);
    } else {
      this.inflightJobs.delete(entryName);
    }
    return active;
  }

  private maxConcurrentTriggers(entry: CronEntry): number {
    const configured = entry.maxConcurrentTriggers;
    return typeof configured === "number" && Number.isFinite(configured) && configured > 1
      ? Math.floor(configured)
      : 1;
  }

  private hasCapacity(entry: CronEntry): boolean {
    return this.activeInflightStarts(entry.name).length < this.maxConcurrentTriggers(entry);
  }

  private isRunning(entryName: string): boolean {
    return this.activeInflightStarts(entryName).length > 0;
  }

  private addInflight(entryName: string, startMs: number): void {
    this.inflightJobs.set(entryName, [...this.activeInflightStarts(entryName), startMs]);
  }

  private removeInflight(entryName: string, startMs: number): void {
    const starts = this.activeInflightStarts(entryName);
    const index = starts.indexOf(startMs);
    if (index >= 0) starts.splice(index, 1);
    if (starts.length > 0) {
      this.inflightJobs.set(entryName, starts);
    } else {
      this.inflightJobs.delete(entryName);
    }
  }

  /** Get the last fire time for a job (epoch ms).
   *  Falls back to workflow_runs DB if no in-memory record (e.g. after restart). */
  private getLastFireTime(entryName: string): number | null {
    const mem = this.lastFireTimes.get(entryName);
    if (mem != null) return mem;

    // Fall back to DB: check workflow_runs for the most recent run of this entry's workflow
    try {
      const db = getDb(this.persistDir);
      const entry = this.entries.find(e => e.name === entryName);
      const configuredWorkflowName = entry ? workflowHandler(entry.handler)?.workflow : undefined;
      const latestWorkflowName = configuredWorkflowName ?? entryName;
      const row = db.prepare(
        "SELECT startedAt FROM workflow_runs WHERE workflow = ? ORDER BY startedAt DESC LIMIT 1"
      ).get(latestWorkflowName) as { startedAt: number } | undefined;
      if (row?.startedAt) {
        // Cache it in memory so we don't query DB again
        this.lastFireTimes.set(entryName, row.startedAt);
        return row.startedAt;
      }
    } catch {
      // DB unavailable — treat as never ran
    }
    return null;
  }

  // ── Scheduling with resume ──────────────────────────────────────────

  private startEntry(entry: CronEntry): void {
    if (!this.resolveMode(entry)) return;
    if (!entry.intervalMs) return; // event-only subscription; triggerSubscribers fires it.

    const fire = () => {
      // Overlap protection: skip if a previous run is still in flight.
      if (!this.hasCapacity(entry)) {
        this.onError?.(`Cron "${entry.name}" skipped — at concurrency capacity`);
        return;
      }

      // Auto-pause was removed in v0.5 cleanup — agent health is now
      // observable through metrics + escalations instead of being
      // enforced at the cron layer.

      this.fireHandler(entry, {
        type: "timer.tick",
        source: "timer",
        owner: `agent:${entryAgent(entry) || "may"}`,
        timestamp: Date.now(),
        data: { entry: entry.name },
      });
    };

    const delay = this.computeResumeDelay(entry);

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
  private computeResumeDelay(entry: CronEntry): number {
    const intervalMs = entry.intervalMs ?? this.defaultCooldownMs;
    const lastFire = this.getLastFireTime(entry.name);
    if (lastFire == null) {
      // Never ran — use offsetMs for deterministic staggering.
      // If no offsetMs, fall back to random jitter.
      const offset = entry.offsetMs ?? 0;
      if (offset > 0) {
        return offset;
      }
      const MAX_INITIAL_JITTER_MS = 5 * 60 * 1000; // 5 minutes
      const jitterWindow = Math.min(intervalMs, MAX_INITIAL_JITTER_MS);
      return Math.floor(Math.random() * jitterWindow);
    }

    const elapsed = Date.now() - lastFire;
    if (elapsed >= intervalMs) {
      return 0; // overdue
    }
    return intervalMs - elapsed;
  }

  // ── Job with JS handler: run in-process ─────────────────────────────

  private fireHandler(entry: CronEntry, triggerEvent?: EventEnvelope): void {
    const handler = this.handlers.get(entry.name);
    if (!handler) {
      this.onError?.(`Cron job "${entry.name}" has no registered handler`);
      return;
    }

    this.onJobFire?.(entry);
    const startMs = Date.now();
    this.addInflight(entry.name, startMs);
    this.lastFireTimes.set(entry.name, startMs);
    const agent = entryAgent(entry) || "may";

    // Emit heartbeat event on bus for heartbeat entries (event-driven: anything can trigger via bus)
    if (entry.name.startsWith("heartbeat")) {
      this.emitEvent?.({ type: "heartbeat", agent, entry: entry.name });
    }

    this.emitEvent?.({
      type: "handler.started",
      source: "cron",
      owner: `agent:${agent}`,
      data: { handler: entry.name, agent },
    });

    const workflowTimeout = workflowHandler(entry.handler)?.timeoutMs;
    const HANDLER_TIMEOUT_MS = Number(entry.timeoutMs ?? workflowTimeout) || 5 * 60_000; // per-handler or 5min default

    const handlerPromise = handler(triggerEvent);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Handler "${entry.name}" timed out after ${HANDLER_TIMEOUT_MS / 1000}s`)), HANDLER_TIMEOUT_MS)
    );

    Promise.race([handlerPromise, timeoutPromise])
      .then(() => {
        this.removeInflight(entry.name, startMs);
        this.emitEvent?.({
          type: "handler.completed",
          source: "cron",
          owner: `agent:${agent}`,
          data: { handler: entry.name, agent, durationMs: Date.now() - startMs },
        });
        this.drainQueuedEventTrigger(entry.name);
      })
      .catch((err) => {
        this.removeInflight(entry.name, startMs);
        const errMsg = err instanceof Error ? err.message : String(err);
        this.emitEvent?.({
          type: "handler.failed",
          source: "cron",
          owner: `agent:${agent}`,
          data: { handler: entry.name, agent, error: errMsg, durationMs: Date.now() - startMs },
        });
        this.onError?.(`Cron handler "${entry.name}" failed: ${errMsg}`);
        this.notify?.(`\u26a0\ufe0f Handler "${entry.name}" failed: ${errMsg}`);
        this.drainQueuedEventTrigger(entry.name);
      });
  }

}
