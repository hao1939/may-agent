/**
 * Cron — reads agents/<name>/cron.json, fires manager.followUp()
 * on intervals. That's it. No history, no conditions, no decisions.
 *
 * Supports JS handler registration: when a handler is registered for a
 * job name, it runs the handler instead of sending followUp() to the LLM.
 * This is the LLM-to-JS replacement mechanism for formulaic cron tasks.
 */

import { readFileSync, existsSync } from "node:fs";
import type { SubagentManager } from "../src/index.js";
import type { CronEntry } from "../src/cron-tool.js";

/** A JS function that replaces the LLM for a specific cron job. */
export type CronHandler = () => Promise<void>;

/** Callback when a job fires (for notifications). */
export type CronJobCallback = (entry: CronEntry, type: "js" | "llm") => void;

export class Cron {
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private entries: CronEntry[] = [];
  private started = false;
  /** JS handlers registered for specific job names. */
  private handlers = new Map<string, CronHandler>();
  /** Callback fired when any job starts. */
  private onJobFire?: CronJobCallback;

  constructor(
    private configPath: string,
    private manager: SubagentManager,
    private getSessionId: () => string,
    private onError?: (msg: string) => void,
  ) {}

  /**
   * Register a JS handler for a cron job by name.
   * When the job fires, the handler runs instead of sending followUp() to the LLM.
   */
  registerHandler(jobName: string, handler: CronHandler): void {
    this.handlers.set(jobName, handler);
  }

  /** Register a callback for when any job fires (for notifications/briefs). */
  onFire(cb: CronJobCallback): void {
    this.onJobFire = cb;
  }

  /** Load (or reload) cron config from disk. */
  load(): void {
    if (!existsSync(this.configPath)) {
      this.entries = [];
      return;
    }
    try {
      const raw = readFileSync(this.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.onError?.(`Cron config is not an array: ${this.configPath}`);
        return;
      }
      this.entries = parsed.filter((entry: CronEntry) => {
        if (!entry.name || !entry.intervalMs || !entry.message) {
          this.onError?.(`Invalid cron entry: ${JSON.stringify(entry)}`);
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
  }

  /** Start all enabled cron jobs. */
  start(): void {
    this.stop();
    this.started = true;
    this.load();
    for (const entry of this.entries) {
      if (entry.enabled === false) continue;
      this.startEntry(entry);
    }
  }

  /** Stop all running jobs. */
  stop(): void {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
    this.started = false;
  }

  /** Reload config and restart jobs. */
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

  /** Get current entries (for inspection). */
  getEntries(): CronEntry[] {
    return [...this.entries];
  }

  private startEntry(entry: CronEntry): void {
    const handler = this.handlers.get(entry.name);

    const timer = setInterval(() => {
      const type = handler ? "js" : "llm";
      this.onJobFire?.(entry, type);

      if (handler) {
        // JS handler — run directly, bypass LLM
        handler().catch((err) => {
          this.onError?.(`Cron handler "${entry.name}" failed: ${err}`);
        });
      } else {
        // Default: send message to LLM via followUp
        try {
          const sid = this.getSessionId();
          this.manager.followUp(sid, entry.message, "cron");
        } catch (err) {
          this.onError?.(`Cron job "${entry.name}" followUp failed: ${err}`);
        }
      }
    }, entry.intervalMs);
    // Don't keep the process alive just for cron
    timer.unref();
    this.timers.set(entry.name, timer);
  }
}
