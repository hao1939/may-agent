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
import { childEventTrace, EVENT_ROW_ID, type DeliveryResult, type EventBus, type SystemEvent } from "./event-bus.js";
import type { SubagentManager } from "../lib/index.js";
import { getDb } from "../lib/requests.js";
import type { CronEntry, WorkflowBackedHandler } from "../lib/cron-tool.js";
import type { EventEnvelope } from "../lib/handler-context.js";

// ── Types ─────────────────────────────────────────────────────────────

/** A JS function that replaces the LLM for a specific cron job. */
type CronHandler = (event?: EventEnvelope, signal?: AbortSignal) => Promise<void>;

/** Callback when a job fires (for notifications). */
type CronJobCallback = (entry: CronEntry) => void;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
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
  return fromHandler || fromEntry || undefined;
}

function normalizeCronEntry(entry: CronEntry): CronEntry {
  if (entry.category) return entry;
  if (entry.name === "heartbeat") return { ...entry, category: "heartbeat", agent: entry.agent ?? "may" };
  if (entry.name.startsWith("heartbeat-")) {
    return { ...entry, category: "heartbeat", agent: entry.agent ?? entry.name.slice("heartbeat-".length) };
  }
  return { ...entry, category: "handler" };
}

function projectIdFromRecord(record: Record<string, unknown> | undefined): string {
  if (!record) return "";
  for (const key of ["project", "projectId", "project_id"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/** Extract the project identifier from an event envelope or nested payload. */
function eventProjectId(event: EventEnvelope): string {
  const data = event.data;
  return (
    projectIdFromRecord(data) ||
    projectIdFromRecord(asRecord(data?.data)) ||
    projectIdFromRecord(asRecord(data?.payload)) ||
    projectIdFromRecord(asRecord(data?.params)) ||
    projectIdFromRecord(event as unknown as Record<string, unknown>)
  );
}

function isProjectEvent(type: string): boolean {
  return type === "project" || type.startsWith("project.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isEventEnvelope(event: unknown): event is EventEnvelope {
  return (
    isRecord(event) &&
    typeof event.type === "string" &&
    typeof event.source === "string" &&
    typeof event.owner === "string" &&
    isRecord(event.data)
  );
}

function eventPayloadFromFlatCommand(event: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (
      key === "type" ||
      key === "source" ||
      key === "owner" ||
      key === "timestamp" ||
      key === "urgency" ||
      key === "ttl_ms"
    )
      continue;
    payload[key] = value;
  }
  return payload;
}

function toEventEnvelope(
  event: { type: string; [key: string]: unknown },
  defaults: { source: string; owner: string; data?: Record<string, unknown> },
): EventEnvelope {
  if (isEventEnvelope(event)) return event;
  const envelope: EventEnvelope = {
    type: event.type,
    source: typeof event.source === "string" ? event.source : defaults.source,
    owner: typeof event.owner === "string" ? event.owner : defaults.owner,
    timestamp: typeof event.timestamp === "number" ? event.timestamp : Date.now(),
    data: defaults.data ?? eventPayloadFromFlatCommand(event),
  };
  // Preserve DB row ID so handlers can mark the event as handled after completion.
  const rowId = (event as any)[EVENT_ROW_ID];
  if (typeof rowId === "number") {
    Object.defineProperty(envelope, EVENT_ROW_ID, { value: rowId, configurable: true });
  }
  return envelope;
}

// ── Cron class ────────────────────────────────────────────────────────

export class Cron {
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  /** Pending setTimeout handles from startEntry (not yet promoted to setInterval). */
  private pendingStartTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private entries: CronEntry[] = [];
  private syntheticEntries = new Map<string, CronEntry>();
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

  /** In-flight jobs: entry name → start timestamps. */
  private inflightJobs = new Map<string, number[]>();

  /** Process-local sequence used to distinguish concurrent runs of one handler. */
  private handlerRunSequence = 0;

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

  hasHandler(jobName: string): boolean {
    return this.handlers.has(jobName);
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
    let loaded: CronEntry[] = [];
    if (!existsSync(this.configPath)) {
      this.entries = [...this.syntheticEntries.values()];
      this.buildEventSubscriptions();
      return this.entries;
    }
    try {
      const raw = readFileSync(this.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.onError?.(`Cron config is not an array: ${this.configPath}`);
        return this.entries;
      }
      loaded = parsed.filter((entry: CronEntry) => {
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
      }).map(normalizeCronEntry);
    } catch (err) {
      this.onError?.(`Failed to parse cron config: ${err}`);
    }
    const syntheticNames = new Set(this.syntheticEntries.keys());
    this.entries = [...loaded.filter((entry) => !syntheticNames.has(entry.name)), ...this.syntheticEntries.values()];
    this.buildEventSubscriptions();
    return this.entries;
  }

  /** Add a synthetic (auto-generated) entry not from cron.json. Starts it if cron is running. */
  addSyntheticEntry(entry: CronEntry): void {
    entry = normalizeCronEntry(entry);
    // Don't override a real cron.json entry with the same name.
    if (this.entries.some((e) => e.name === entry.name) && !this.syntheticEntries.has(entry.name)) return;

    const old = this.syntheticEntries.get(entry.name);
    if (old && JSON.stringify(old) === JSON.stringify(entry)) {
      // Reinstalling a disabled entry must also repair timers left behind by
      // an older runtime. This makes an app pause effective on hot reload.
      if (entry.enabled === false) this.stopEntryScheduling(entry.name, true);
      this.buildEventSubscriptions();
      return;
    }

    this.syntheticEntries.set(entry.name, entry);
    const index = this.entries.findIndex((candidate) => candidate.name === entry.name);
    if (index >= 0) {
      this.entries[index] = entry;
    } else {
      this.entries.push(entry);
    }
    this.buildEventSubscriptions();
    if (entry.enabled === false) {
      this.stopEntryScheduling(entry.name, true);
      return;
    }
    if (this.started) {
      this.stopEntryScheduling(entry.name);

      // For handler-based entries not yet registered, try handlerResolver first.
      // Synthetic project-app schedules register their in-memory handler before
      // adding the entry, so they must start directly instead of resolving a
      // fake handler file such as "__project_app_schedule__".
      if (entry.handler && !this.handlers.has(entry.name) && this.handlerResolver) {
        const entrySnapshot = { ...entry };
        this.handlerResolver(entry.name, entrySnapshot)
          .then((resolved) => {
            if (resolved) {
              this.startEntry(entrySnapshot);
            } else {
              this.onError?.(
                `Synthetic entry "${entry.name}" handler "${handlerDisplay(entry.handler)}" could not be resolved`,
              );
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

  private stopEntryScheduling(entryName: string, discardQueued = false): void {
    const timer = this.timers.get(entryName);
    if (timer) clearInterval(timer);
    this.timers.delete(entryName);
    const pending = this.pendingStartTimers.get(entryName);
    if (pending) clearTimeout(pending);
    this.pendingStartTimers.delete(entryName);
    if (discardQueued) this.queuedEventTriggers.delete(entryName);
  }

  removeSyntheticEntry(entryName: string): boolean {
    if (!this.syntheticEntries.has(entryName)) return false;
    this.syntheticEntries.delete(entryName);
    this.entries = this.entries.filter((entry) => entry.name !== entryName);
    this.handlers.delete(entryName);
    this.stopEntryScheduling(entryName, true);
    this.buildEventSubscriptions();
    return true;
  }

  /**
   * Rebuild event subscriptions from the current entries list.
   * Public so that cron-startup.ts can call it after subscribeToBus to
   * ensure the subscription map matches the final entry list.
   *
   * Root-cause context (evaluation-aftermath-session-dispatch-fix):
   * Intermittent startup-ordering bug — if installProjectApps adds synthetic
   * entries (which call buildEventSubscriptions) but a concurrent reload()
   * or load() resets the map before subscribeToBus runs, the bus subscriber
   * finds no subscribers for the event type. Calling this once after
   * subscribeToBus + start is a defensive idempotent fix.
   */
  rebuildEventSubscriptions(): void {
    this.buildEventSubscriptions();
  }

  /**
   * Verify that every enabled entry with `on` events has its events in the
   * subscription map. Returns an array of { entryName, missingEvents } for
   * any entries whose events are not subscribed. Empty array = healthy.
   */
  verifyEventSubscriptions(): Array<{ entryName: string; missingEvents: string[] }> {
    const gaps: Array<{ entryName: string; missingEvents: string[] }> = [];
    for (const entry of this.entries) {
      if (entry.enabled === false || !entry.on?.length) continue;
      const missing: string[] = [];
      for (const eventType of entry.on) {
        const subscribers = this.eventSubscriptions.get(eventType);
        if (!subscribers || !subscribers.has(entry.name)) {
          missing.push(eventType);
        }
      }
      if (missing.length > 0) {
        gaps.push({ entryName: entry.name, missingEvents: missing });
      }
    }
    return gaps;
  }

  /** Build event-to-handler mapping from `on` fields in cron entries. */
  private buildEventSubscriptions(): void {
    this.eventSubscriptions.clear();
    for (const entry of this.entries) {
      if (entry.enabled === false || !entry.on?.length) continue;
      for (const eventType of entry.on) {
        let set = this.eventSubscriptions.get(eventType);
        if (!set) {
          set = new Set();
          this.eventSubscriptions.set(eventType, set);
        }
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
    const evtProject = eventProjectId(event);
    for (const entryName of subscribers) {
      const entry = this.entries.find((candidate) => candidate.name === entryName);
      if (targetHeartbeatAgent && entry && entryAgent(entry) !== targetHeartbeatAgent) continue;
      // Target-first routing: if a workflow handler declares a project target
      // and the event names another project, this is not that handler's event.
      if (entry) {
        const wf = workflowHandler(entry.handler);
        if (wf?.projectId && isProjectEvent(eventType)) {
          if (!evtProject) continue;
          if (wf.projectId !== evtProject && !evtProject.startsWith(wf.projectId + ".")) continue;
        }
      }
      if (this.triggerNow(entryName, { force: true, triggerEvent: event })) triggered++;
    }
    return triggered;
  }

  private _busSubscribed = false;

  /** Subscribe to bus — auto-dispatch domain events (dot-separated types) to handlers.
   *  Also handles `heartbeat` events: triggers the matching heartbeat entry. */
  subscribeToBus(bus: EventBus): void {
    if (this._busSubscribed) return;
    this._busSubscribed = true;
    bus.subscribe((event): DeliveryResult | void => {
      // Convention trigger: any entry can be manually fired by emitting
      // `trigger.<entry-name>`. This keeps operator/adapters simple and avoids
      // per-entry `on` boilerplate for timer jobs.
      if (event.type.startsWith("trigger.")) {
        const entryName = event.type.slice("trigger.".length);
        if (entryName) {
          const triggered = this.triggerNow(entryName, {
            force: true,
            triggerEvent: toEventEnvelope(event as any, { source: "manual", owner: "agent:may" }),
          });
          if (triggered) {
            return {
              accepted: true,
              by: `cron:${entryName}`,
              route: "direct",
              note: "manual trigger dispatched",
            };
          }
        }
        return;
      }

      // Compatibility heartbeat signal -> trigger the typed heartbeat entry.
      if (event.type === "heartbeat" && "agent" in event) {
        const agent = (event as any).agent as string;
        const entryName = this.entries.find(
          (entry) => entry.category === "heartbeat" && entryAgent(entry) === agent,
        )?.name;
        if (!entryName) return;
        // Only trigger if it wasn't fired by us (avoid loop: fireHandler emits → bus → triggerNow)
        if (!this.isRunning(entryName)) {
          const triggered = this.triggerNow(entryName, { force: true });
          if (triggered) {
            return {
              accepted: true,
              by: `cron:${entryName}`,
              route: "direct",
              note: "heartbeat trigger dispatched",
            };
          }
        }
        return;
      }
      if (!event.type.includes(".")) return;
      if (!isEventEnvelope(event)) return;
      const triggered = this.triggerSubscribers(event.type, event);
      if (triggered > 0) {
        return {
          accepted: true,
          by: `cron:${triggered}`,
          route: "direct",
          note: `dispatched ${triggered} subscribed handler(s)`,
        };
      }
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
          old.maxQueueDepth !== entry.maxQueueDepth ||
          old.message !== entry.message ||
          old.category !== entry.category ||
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
            .catch(() => {
              /* silent — will retry on next reload */
            });
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

  getEventSubscriptions(): Record<string, string[]> {
    return Object.fromEntries(
      [...this.eventSubscriptions.entries()].map(([eventType, entryNames]) => [eventType, [...entryNames]]),
    );
  }

  /** Trigger an entry immediately. Force bypasses debounce, but never overlaps a running entry.
   *  Returns false if entry not found, debounced, or already running. */
  triggerNow(entryName: string, opts?: { force?: boolean; triggerEvent?: EventEnvelope }): boolean {
    const entry = this.entries.find((e) => e.name === entryName);
    if (!entry || entry.enabled === false) return false;

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
    this.fireHandler(
      entry,
      opts?.triggerEvent ?? {
        type: `trigger.${entry.name}`,
        source: "manual",
        owner: `agent:${entryAgent(entry) || "may"}`,
        timestamp: Date.now(),
        data: { entry: entry.name },
      },
    );
    return true;
  }

  private enqueueEventTrigger(entryName: string, event: EventEnvelope): void {
    const entry = this.entries.find((e) => e.name === entryName);
    const maxDepth = this.maxQueueDepth(entry);

    // If queueing is disabled entirely, silently drop the event.
    if (maxDepth <= 0) {
      this.onError?.(`Cron "${entryName}" event dropped — queueing disabled (maxQueueDepth=0)`);
      return;
    }

    let queue = this.queuedEventTriggers.get(entryName);
    if (!queue) {
      queue = [];
      this.queuedEventTriggers.set(entryName, queue);
    }

    // Enforce max queue depth: keep-latest, drop-oldest policy.
    // The newest event carries the most recent state, so it's the most
    // valuable for owner-review-style handlers.
    while (queue.length >= maxDepth) {
      const dropped = queue.shift();
      this.onError?.(
        `Cron "${entryName}" queue full (${maxDepth}) — dropping oldest event (type=${dropped?.type ?? "unknown"})`,
      );
    }

    queue.push(event);
    this.onError?.(
      `Cron "${entryName}" event queued — at concurrency capacity (${queue.length} pending, max ${maxDepth})`,
    );
  }

  /** Track consecutive errors per entry for exponential backoff on queue drain. */
  private consecutiveErrors = new Map<string, number>();

  private drainQueuedEventTrigger(entryName: string, opts?: { afterError?: boolean }): void {
    const entry = this.entries.find((candidate) => candidate.name === entryName);
    if (!entry || entry.enabled === false) return;
    if (!this.hasCapacity(entry)) return;

    const queue = this.queuedEventTriggers.get(entryName);
    if (!queue || queue.length === 0) {
      this.queuedEventTriggers.delete(entryName);
      return;
    }

    // After an error, apply exponential backoff before draining the next event.
    // This prevents tight error→drain→error loops when handlers fail instantly
    // (e.g. provider errors, concurrency blocks) which otherwise cascade into
    // event pileups and blocked-run bursts.
    if (opts?.afterError) {
      const errorCount = (this.consecutiveErrors.get(entryName) ?? 0) + 1;
      this.consecutiveErrors.set(entryName, errorCount);

      // Exponential backoff: 5s, 10s, 20s, 40s, capped at 60s
      const backoffMs = Math.min(5_000 * Math.pow(2, errorCount - 1), 60_000);

      // If too many consecutive errors, drop the queue to prevent unbounded accumulation
      if (errorCount >= 5) {
        const dropped = queue.length;
        queue.length = 0;
        this.queuedEventTriggers.delete(entryName);
        this.onError?.(
          `Cron "${entryName}" queue dropped (${dropped} events) after ${errorCount} consecutive errors`,
        );
        return;
      }

      setTimeout(() => {
        this.triggerNow(entryName, { force: true, triggerEvent: queue.shift()! });
        if (queue.length === 0) this.queuedEventTriggers.delete(entryName);
      }, backoffMs).unref();
      return;
    }

    // Success path: reset error count.
    this.consecutiveErrors.delete(entryName);
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
      this.onError?.(
        `Cron entry "${entry.name}" declares handler "${handlerDisplay(entry.handler)}" but it is not registered — skipping`,
      );
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
    return typeof configured === "number" && Number.isFinite(configured) && configured > 1 ? Math.floor(configured) : 1;
  }

  private maxQueueDepth(entry: CronEntry | undefined): number {
    const DEFAULT_MAX_QUEUE_DEPTH = 3;
    if (!entry) return DEFAULT_MAX_QUEUE_DEPTH;
    const configured = entry.maxQueueDepth;
    if (typeof configured === "number" && Number.isFinite(configured)) {
      return configured <= 0 ? 0 : Math.floor(configured);
    }
    return DEFAULT_MAX_QUEUE_DEPTH;
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
   *  Falls back to workflow_runs DB if no in-memory record (e.g. after restart).
   *  For synthetic project-app schedule entries (handler = "__project_app_schedule__"),
   *  workflow_runs won't have a matching row because the workflow name differs from
   *  the entry name. In that case, fall back to the events table where
   *  handler.started records always use the entry name. */
  private getLastFireTime(entryName: string): number | null {
    const mem = this.lastFireTimes.get(entryName);
    if (mem != null) return mem;

    // Fall back to DB: check workflow_runs for the most recent run of this entry's workflow
    try {
      const db = getDb(this.persistDir);
      const entry = this.entries.find((e) => e.name === entryName);
      const configuredWorkflowName = entry ? workflowHandler(entry.handler)?.workflow : undefined;
      const latestWorkflowName = configuredWorkflowName ?? entryName;
      const row = db
        .prepare("SELECT startedAt FROM workflow_runs WHERE workflow = ? ORDER BY startedAt DESC LIMIT 1")
        .get(latestWorkflowName) as { startedAt: number } | undefined;
      if (row?.startedAt) {
        // Cache it in memory so we don't query DB again
        this.lastFireTimes.set(entryName, row.startedAt);
        return row.startedAt;
      }

      // Handler events project the entry name into the typed handler column.
      // This covers synthetic project-app schedule entries whose
      // handler string ("__project_app_schedule__") doesn't map to a workflow name.
      const evtRow = db
        .prepare(
          `SELECT timestamp FROM events
           WHERE event_type = 'handler.started'
             AND handler = ?
           ORDER BY timestamp DESC LIMIT 1`,
        )
        .get(entryName) as { timestamp: number } | undefined;
      if (evtRow?.timestamp) {
        this.lastFireTimes.set(entryName, evtRow.timestamp);
        return evtRow.timestamp;
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

      // Cooldown guard: prevent timer-based over-firing when startEntry is
      // called multiple times (e.g. project-app watcher reinstalls after
      // app.ts changes). Each call creates a new setTimeout→setInterval
      // chain; without this guard, multiple chains fire concurrently at
      // short intervals. Uses 75% of intervalMs as minimum gap, matching
      // the triggerNow debounce convention.
      if (entry.intervalMs) {
        const cooldownMs = Math.max(entry.intervalMs * 0.75, 1);
        const lastFire = this.lastFireTimes.get(entry.name);
        if (lastFire && Date.now() - lastFire < cooldownMs) {
          return; // too soon — skip silently
        }
      }

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
    const trace = childEventTrace(triggerEvent);
    this.addInflight(entry.name, startMs);
    this.lastFireTimes.set(entry.name, startMs);
    const agent = entryAgent(entry) || "may";
    const handlerRunId = `handler:${entry.name}:${startMs}:${++this.handlerRunSequence}`;

    // Emit heartbeat event on bus for typed heartbeat entries.
    if (entry.category === "heartbeat") {
      this.emitEvent?.({ type: "heartbeat", agent, entry: entry.name, ...(trace ? { trace } : {}) });
    }

    this.emitEvent?.({
      type: "handler.started",
      source: "cron",
      owner: `agent:${agent}`,
      data: { handler: entry.name, handlerRunId, agent },
      ...(trace ? { trace } : {}),
    });

    const workflowTimeout = workflowHandler(entry.handler)?.timeoutMs;
    const HANDLER_TIMEOUT_MS = Number(entry.timeoutMs ?? workflowTimeout) || 5 * 60_000; // per-handler or 5min default

    const abortController = new AbortController();
    let timedOut = false;
    let failureReported = false;
    const reportFailure = (err: unknown): void => {
      if (failureReported) return;
      failureReported = true;
      const errMsg = err instanceof Error ? err.message : String(err);
      this.emitEvent?.({
        type: "handler.failed",
        source: "cron",
        owner: `agent:${agent}`,
        data: { handler: entry.name, handlerRunId, agent, error: errMsg, durationMs: Date.now() - startMs },
        ...(trace ? { trace } : {}),
      });
      this.onError?.(`Cron handler "${entry.name}" failed: ${errMsg}`);
      this.notify?.(`\u26a0\ufe0f Handler "${entry.name}" failed: ${errMsg}`);
    };
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      abortController.abort(new Error(`Handler "${entry.name}" timed out`));
      reportFailure(new Error(`Handler "${entry.name}" timed out after ${HANDLER_TIMEOUT_MS / 1000}s`));
      // Keep the entry in-flight until the handler actually settles. Starting
      // queued work here would overlap the still-running side effects.
    }, HANDLER_TIMEOUT_MS);
    timeoutTimer.unref?.();

    Promise.resolve()
      .then(() => handler(triggerEvent, abortController.signal))
      .then(() => {
        clearTimeout(timeoutTimer);
        this.removeInflight(entry.name, startMs);
        if (timedOut) {
          this.drainQueuedEventTrigger(entry.name, { afterError: true });
          return;
        }
        this.emitEvent?.({
          type: "handler.completed",
          source: "cron",
          owner: `agent:${agent}`,
          data: { handler: entry.name, handlerRunId, agent, durationMs: Date.now() - startMs },
          ...(trace ? { trace } : {}),
        });
        this.drainQueuedEventTrigger(entry.name);
      })
      .catch((err) => {
        clearTimeout(timeoutTimer);
        this.removeInflight(entry.name, startMs);
        reportFailure(err);
        this.drainQueuedEventTrigger(entry.name, { afterError: true });
      });
  }

}
