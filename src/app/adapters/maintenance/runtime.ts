/**
 * Host-private maintenance, configured by the conventional cron.json file.
 * Only named deterministic handlers run here. App schedules publish events;
 * App model/workflow execution belongs exclusively to Task attempts.
 * Maintenance observations are best-effort and never acknowledge App work.
 *
 * Design: projects/may-agent.app/docs/2a-design/cron.md
 */

import { resolve, dirname } from "node:path";
import { childEventTrace, EVENT_ROW_ID, type EventBus, type SystemEvent } from "../../core/events/bus.js";
import { getDb } from "../../../lib/requests.js";
import type { MaintenanceEntry } from "./contracts.js";
import { readMaintenanceEntries } from "./configuration.js";
import type { EventEnvelope } from "../../core/events/bus.js";
import { OwnedTimer } from "../../core/scheduling/timer.js";

// ── Types ─────────────────────────────────────────────────────────────

/** One bounded deterministic Host duty. */
export type MaintenanceHandler = (event?: EventEnvelope, signal?: AbortSignal) => Promise<void>;

/** Callback when a job fires (for notifications). */
type CronJobCallback = (entry: MaintenanceEntry) => void;

// Transient errors that should not escalate to human notification unless they
// persist for multiple consecutive ticks (see reportFailure suppression logic).
const TRANSIENT_ERROR_PATTERNS: RegExp[] = [
  /database is locked/i,
  /SQLITE_BUSY/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /socket hang up/i,
];

/** Number of consecutive transient failures before escalating to notify(). */
const TRANSIENT_ESCALATION_THRESHOLD = 3;

function isTransientError(msg: string): boolean {
  return TRANSIENT_ERROR_PATTERNS.some((p) => p.test(msg));
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

// ── Scheduling cadence ───────────────────────────────────────────────

/**
 * Reconstruct the next timer delay from durable last-fire state.
 * Kept pure so restart behavior can be verified without waiting through
 * production-sized hourly/daily intervals.
 */
export function computeMaintenanceResumeDelay(input: {
  intervalMs: number;
  lastFireTime: number | null;
  now: number;
  offsetMs?: number;
  random?: () => number;
}): number {
  if (input.lastFireTime == null) {
    if ((input.offsetMs ?? 0) > 0) return input.offsetMs!;
    const jitterWindow = Math.min(input.intervalMs, 5 * 60_000);
    return Math.floor((input.random ?? Math.random)() * jitterWindow);
  }

  const elapsed = input.now - input.lastFireTime;
  return elapsed >= input.intervalMs ? 0 : input.intervalMs - elapsed;
}

// ── HostMaintenance class ────────────────────────────────────────────────────────

export class HostMaintenance {
  private timers = new Map<string, OwnedTimer>();
  /** Pending setTimeout handles from startEntry (not yet promoted to setInterval). */
  private pendingStartTimers = new Map<string, OwnedTimer>();
  private entries: MaintenanceEntry[] = [];
  private started = false;
  private retired = false;
  private handlers = new Map<string, MaintenanceHandler>();
  private onJobFire?: CronJobCallback;
  /** Event-to-handler subscriptions: event type → list of entry names. */
  private eventSubscriptions = new Map<string, Set<string>>();
  /** Event-trigger queue per entry. Preserves event-driven work when an entry is at concurrency capacity. */
  private queuedEventTriggers = new Map<string, EventEnvelope[]>();
  /** Dynamic handler resolver — called when reload() finds an entry with `handler` but no registered handler. */
  private handlerResolver?: (entry: MaintenanceEntry) => Promise<MaintenanceHandler | undefined>;

  /** Default minimum ms between reactive triggers for same entry.
   *  Per-entry cooldown = 75% of the entry's intervalMs (min 60s). */
  readonly defaultCooldownMs = 60_000;

  private persistDir: string;
  private readonly configPath: string;
  private readonly onError?: (message: string) => void;
  private readonly notify?: (message: string) => void;
  private readonly emitEvent?: (event: SystemEvent) => void;

  /** In-flight jobs: entry name → start timestamps. */
  private inflightJobs = new Map<string, number[]>();

  /** Process-local sequence used to distinguish concurrent runs of one handler. */
  private handlerRunSequence = 0;

  /** Last fire time per entry. */
  private lastFireTimes = new Map<string, number>();

  /** Consecutive transient failure count per entry (reset on success or non-transient error). */
  private transientFailureCounts = new Map<string, number>();

  constructor(options: {
    configPath: string;
    projectRoot?: string;
    persistDir?: string;
    onError?: (message: string) => void;
    notify?: (message: string) => void;
    emitEvent?: (event: SystemEvent) => void;
  }) {
    this.configPath = options.configPath;
    this.onError = options.onError;
    this.notify = options.notify;
    this.emitEvent = options.emitEvent;
    this.persistDir =
      options.persistDir ?? resolve(options.projectRoot ?? resolve(dirname(options.configPath), "../.."), ".state");
  }

  registerHandler(jobName: string, handler: MaintenanceHandler): void {
    this.handlers.set(jobName, handler);
  }

  hasHandler(jobName: string): boolean {
    return this.handlers.has(jobName);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  /** Set a resolver for dynamically loading handlers when new entries appear post-startup. */
  setHandlerResolver(resolver: (entry: MaintenanceEntry) => Promise<MaintenanceHandler | undefined>): void {
    this.handlerResolver = resolver;
  }

  /** Loading prepares a handler; only the current entry may install it. */
  private async resolveHandler(entry: MaintenanceEntry): Promise<void> {
    const resolver = this.handlerResolver;
    if (!resolver) return;
    try {
      const handler = await resolver(entry);
      if (this.handlerResolver !== resolver || !this.entries.includes(entry) || entry.enabled === false) return;
      if (!handler) {
        this.report(`[handler] Failed to resolve handler for "${entry.name}" — retry on next reload`);
        return;
      }
      this.registerHandler(entry.name, handler);
      this.report(`[handler] Resolved handler for "${entry.name}" on reload`);
      if (this.started) this.startEntry(entry);
    } catch (error) {
      if (this.handlerResolver !== resolver || !this.entries.includes(entry)) return;
      this.report(
        `[handler] Error resolving handler for "${entry.name}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  onFire(cb: CronJobCallback): void {
    this.onJobFire = cb;
  }
  load(): MaintenanceEntry[] {
    // Parse before publication: malformed/rejected files retain the active set.
    const loaded = readMaintenanceEntries(this.configPath);
    this.entries = loaded.map((entry) => {
      const previous = this.entries.find((candidate) => candidate.name === entry.name);
      return previous && JSON.stringify(previous) === JSON.stringify(entry) ? previous : entry;
    });
    this.buildEventSubscriptions();
    return this.entries;
  }

  private stopEntryScheduling(entryName: string, discardQueued = false): void {
    const timer = this.timers.get(entryName);
    timer?.close();
    this.timers.delete(entryName);
    const pending = this.pendingStartTimers.get(entryName);
    pending?.close();
    this.pendingStartTimers.delete(entryName);
    if (discardQueued) this.queuedEventTriggers.delete(entryName);
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
  private triggerSubscribers(eventType: string, event: EventEnvelope): number {
    let triggered = 0;
    for (const name of this.eventSubscriptions.get(eventType) ?? []) {
      if (this.triggerNow(name, { force: true, triggerEvent: event })) triggered++;
    }
    return triggered;
  }

  private _busSubscribed = false;
  private _unsubscribeBus?: () => void;
  subscribeToBus(bus: EventBus): void {
    if (this._busSubscribed) return;
    this._busSubscribed = true;
    this._unsubscribeBus = bus.subscribe((event) => {
      // This is passive maintenance, not durable App-input acceptance.
      if (event.type.startsWith("trigger.")) {
        this.triggerNow(event.type.slice("trigger.".length), {
          force: true,
          triggerEvent: toEventEnvelope(event as any, { source: "manual", owner: "host:maintenance" }),
        });
      } else if (isEventEnvelope(event)) this.triggerSubscribers(event.type, event);
    });
  }

  start(): void {
    if (this.retired) return;
    this.stop();
    this.started = true;
    // Activation uses the prepared declarations. File changes require reload.
    for (const entry of this.entries) {
      if (entry.enabled === false) continue;
      this.startEntry(entry);
    }
  }

  stop(): void {
    for (const timer of this.timers.values()) timer.close();
    this.timers.clear();
    for (const timer of this.pendingStartTimers.values()) timer.close();
    this.pendingStartTimers.clear();
    this.started = false;
  }

  /** Retire this scheduler generation, including its EventBus attachment. */
  close(): void {
    this.retired = true;
    this.stop();
    this.handlerResolver = undefined;
    this.queuedEventTriggers.clear();
    this._unsubscribeBus?.();
    this._unsubscribeBus = undefined;
    this._busSubscribed = false;
  }

  reload(): void {
    const oldEntries = new Map(this.entries.map((e) => [e.name, e]));
    this.load();
    const newNames = new Set(this.entries.map((e) => e.name));
    for (const name of oldEntries.keys()) {
      if (!newNames.has(name)) {
        this.stopEntryScheduling(name, true);
        this.handlers.delete(name);
      }
    }

    let changedCount = 0;
    for (const entry of this.entries) {
      const old = oldEntries.get(entry.name);
      const configChanged = old !== entry;

      if (entry.enabled === false) {
        this.stopEntryScheduling(entry.name, true);
        continue;
      }
      if (configChanged) {
        changedCount++;
        this.stopEntryScheduling(entry.name);
        // File-backed handlers capture the exact configuration.
        if (this.handlerResolver) this.handlers.delete(entry.name);
        this.report(
          `Reloaded "${entry.name}": intervalMs=${entry.intervalMs ?? "event-only"}${old ? ` (was ${old.intervalMs ?? "event-only"})` : " (new)"}`,
        );
      }

      // Handler availability is independent of timers. This also retries a
      // repaired handler with unchanged configuration on an explicit reload.
      if (entry.handler && !this.handlers.has(entry.name) && this.handlerResolver) {
        void this.resolveHandler(entry);
      } else if (configChanged && this.started) {
        this.startEntry(entry);
      }
      // Unchanged, already registered handlers keep their existing timer.
    }
    if (changedCount === 0) this.report("Config reload: no entries changed");
  }

  getEntries(): MaintenanceEntry[] {
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
    if (this.retired) return false;
    const entry = this.entries.find((e) => e.name === entryName);
    if (!entry || entry.enabled === false) return false;

    if (!this.hasCapacity(entry)) {
      if (opts?.triggerEvent) {
        this.enqueueEventTrigger(entryName, opts.triggerEvent);
        return true;
      }
      this.report(`HostMaintenance "${entryName}" trigger skipped — at concurrency capacity`);
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
    return this.fireHandler(
      entry,
      opts?.triggerEvent ?? {
        type: `trigger.${entry.name}`,
        source: "manual",
        owner: `agent:${entry.agent || "may"}`,
        timestamp: Date.now(),
        data: { entry: entry.name },
      },
    );
  }

  private enqueueEventTrigger(entryName: string, event: EventEnvelope): void {
    const maxDepth = 3; // Bounded best-effort maintenance observations, never accepted work.

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
      this.report(
        `HostMaintenance "${entryName}" queue full (${maxDepth}) — dropping oldest event (type=${dropped?.type ?? "unknown"})`,
      );
    }

    queue.push(event);
    this.report(
      `HostMaintenance "${entryName}" event queued — at concurrency capacity (${queue.length} pending, max ${maxDepth})`,
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
    let delayMs = 0;
    if (opts?.afterError) {
      const errorCount = (this.consecutiveErrors.get(entryName) ?? 0) + 1;
      this.consecutiveErrors.set(entryName, errorCount);

      // Exponential backoff: 5s, 10s, 20s, 40s, capped at 60s
      delayMs = Math.min(5_000 * Math.pow(2, errorCount - 1), 60_000);

      // If too many consecutive errors, drop the queue to prevent unbounded accumulation
      if (errorCount >= 5) {
        const dropped = queue.length;
        queue.length = 0;
        this.queuedEventTriggers.delete(entryName);
        this.report(
          `HostMaintenance "${entryName}" queue dropped (${dropped} events) after ${errorCount} consecutive errors`,
        );
        return;
      }
    } else {
      this.consecutiveErrors.delete(entryName);
    }

    setTimeout(() => {
      // Removing/disabling an entry or retiring its generation discards the
      // queue, including deliveries already scheduled for a later turn.
      if (this.queuedEventTriggers.get(entryName) !== queue) return;
      const event = queue.shift();
      if (queue.length === 0) this.queuedEventTriggers.delete(entryName);
      if (!event) return;
      this.triggerNow(entryName, { force: true, triggerEvent: event });
    }, delayMs).unref();
  }

  /** Resolve the effective execution mode for an entry. */
  private resolveMode(entry: MaintenanceEntry): boolean {
    if (entry.handler) {
      const handler = this.handlers.get(entry.name);
      if (handler) return true;
      this.report(
        `Maintenance entry "${entry.name}" declares handler "${entry.handler}" but it is not registered — skipping`,
      );
      return false;
    }
    this.report(`HostMaintenance entry "${entry.name}" has no handler — skipping`);
    return false;
  }

  // ── In-flight execution state ───────────────────────────────────────

  /**
   * Return currently in-flight handler start times.
   *
   * Do not age-prune these rows: the cron timeout path intentionally keeps a
   * handler in flight until its promise actually settles so follow-up triggers
   * cannot overlap lingering side effects. A fixed 10-minute prune window let
   * long-running/timed-out handlers disappear from capacity checks and re-fire
   * while they were still running.
   *
   * Process restarts already clear this in-memory map, so stale entries only
   * exist while the current process still has a live handler promise.
   */
  private activeInflightStarts(entryName: string): number[] {
    return this.inflightJobs.get(entryName) ?? [];
  }

  private hasCapacity(entry: MaintenanceEntry): boolean {
    return this.activeInflightStarts(entry.name).length === 0;
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
  private getLastFireTime(entryName: string): number | null {
    const previous = this.lastFireTimes.get(entryName);
    if (previous != null) return previous;
    // Private maintenance cadence uses its own observed start, never workflow
    // execution facts. No schedule/work ledger is introduced.
    const row = getDb(this.persistDir)
      .prepare(
        "SELECT timestamp FROM events WHERE event_type = 'handler.started' AND handler = ? ORDER BY timestamp DESC LIMIT 1",
      )
      .get(entryName) as { timestamp: number } | undefined;
    if (row) this.lastFireTimes.set(entryName, row.timestamp);
    return row?.timestamp ?? null;
  }

  // ── Scheduling with resume ──────────────────────────────────────────

  private startEntry(entry: MaintenanceEntry): void {
    if (!this.resolveMode(entry)) return;
    if (!entry.intervalMs) return; // event-only subscription; triggerSubscribers fires it.

    const fire = () => {
      if (!this.started || this.retired || !this.entries.includes(entry)) return;
      // Overlap protection: skip if a previous run is still in flight.
      if (!this.hasCapacity(entry)) {
        this.report(`HostMaintenance "${entry.name}" skipped — at concurrency capacity`);
        return;
      }

      // A recent event-driven invocation also satisfies this cadence. Uses
      // 75% of intervalMs as the minimum gap, matching triggerNow debounce.
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
        owner: `agent:${entry.agent || "may"}`,
        timestamp: Date.now(),
        data: { entry: entry.name },
      });
    };

    const delay = this.computeResumeDelay(entry);

    this.stopEntryScheduling(entry.name);
    const startTimer = new OwnedTimer(`maintenance:${entry.name}:initial`);
    startTimer.after(delay, () => {
      this.pendingStartTimers.delete(entry.name);
      fire();
      if (!this.started || this.retired || !this.entries.includes(entry)) return;
      const timer = new OwnedTimer(`maintenance:${entry.name}`);
      timer.every(entry.intervalMs!, fire);
      this.timers.set(entry.name, timer);
    });
    this.pendingStartTimers.set(entry.name, startTimer);
    // Note: only store in pendingStartTimers during initial delay.
    // The setInterval handle is stored in this.timers once the setTimeout fires.
    // Do NOT store the setTimeout in this.timers — reload() clears both maps.
  }

  /** Compute the initial delay for an entry based on when it last ran. */
  private computeResumeDelay(entry: MaintenanceEntry): number {
    return computeMaintenanceResumeDelay({
      intervalMs: entry.intervalMs ?? this.defaultCooldownMs,
      lastFireTime: this.getLastFireTime(entry.name),
      now: Date.now(),
      offsetMs: entry.offsetMs,
    });
  }

  // ── Job with JS handler: run in-process ─────────────────────────────

  private fireHandler(entry: MaintenanceEntry, triggerEvent?: EventEnvelope): boolean {
    const handler = this.handlers.get(entry.name);
    if (!handler) {
      this.report(`HostMaintenance job "${entry.name}" has no registered handler`);
      return false;
    }

    try {
      this.onJobFire?.(entry);
    } catch (error) {
      this.report(`Fire notification failed: ${String(error)}`);
    }
    const startMs = Date.now();
    const trace = childEventTrace(triggerEvent);
    this.addInflight(entry.name, startMs);
    const agent = entry.agent || "may";
    const handlerRunId = `handler:${entry.name}:${startMs}:${++this.handlerRunSequence}`;

    const recorded = this.observe({
      type: "handler.started",
      source: "cron",
      owner: `agent:${agent}`,
      data: { handler: entry.name, handlerRunId, agent },
      ...(trace ? { trace } : {}),
    });
    if (!recorded) {
      this.removeInflight(entry.name, startMs);
      return false;
    }
    this.lastFireTimes.set(entry.name, startMs);

    const HANDLER_TIMEOUT_MS = entry.timeoutMs ?? 5 * 60_000;

    const abortController = new AbortController();
    let timedOut = false;
    let failureReported = false;
    const reportFailure = (err: unknown): void => {
      if (failureReported) return;
      failureReported = true;
      const errMsg = err instanceof Error ? err.message : String(err);
      this.observe({
        type: "handler.failed",
        source: "cron",
        owner: `agent:${agent}`,
        data: { handler: entry.name, handlerRunId, agent, error: errMsg, durationMs: Date.now() - startMs },
        ...(trace ? { trace } : {}),
      });
      this.report(`Host maintenance handler "${entry.name}" failed: ${errMsg}`);

      // Transient-error suppression: known-transient failures (e.g. "database is locked")
      // only escalate to human notification after TRANSIENT_ESCALATION_THRESHOLD consecutive
      // occurrences. The handler.failed event is always emitted for observability.
      if (isTransientError(errMsg)) {
        const count = (this.transientFailureCounts.get(entry.name) ?? 0) + 1;
        this.transientFailureCounts.set(entry.name, count);
        if (count < TRANSIENT_ESCALATION_THRESHOLD) return;
      }
      this.transientFailureCounts.delete(entry.name); // reset on escalation or non-transient
      try {
        this.notify?.(`Handler "${entry.name}" failed: ${errMsg}`);
      } catch (error) {
        this.report(`Failure notification unavailable: ${String(error)}`);
      }
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
        this.observe({
          type: "handler.completed",
          source: "cron",
          owner: `agent:${agent}`,
          data: { handler: entry.name, handlerRunId, agent, durationMs: Date.now() - startMs },
          ...(trace ? { trace } : {}),
        });
        this.transientFailureCounts.delete(entry.name); // reset on success
        this.drainQueuedEventTrigger(entry.name);
      })
      .catch((err) => {
        clearTimeout(timeoutTimer);
        this.removeInflight(entry.name, startMs);
        reportFailure(err);
        this.drainQueuedEventTrigger(entry.name, { afterError: true });
      });
    return true;
  }

  private report(message: string): void {
    try {
      if (this.onError) this.onError(message);
      else console.error(`[maintenance] ${message}`);
    } catch (error) {
      console.error(`[maintenance] ${message}; diagnostic publication failed: ${String(error)}`);
    }
  }

  private observe(event: SystemEvent): boolean {
    try {
      this.emitEvent?.(event);
      return true;
    } catch (error) {
      this.report(`Observation publication failed: ${String(error)}`);
      return false;
    }
  }
}
