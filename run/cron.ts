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

export class Cron {
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private entries: CronEntry[] = [];
  private started = false;
  /** JS handlers registered for specific job names. */
  private handlers = new Map<string, CronHandler>();

  constructor(
    private configPath: string,
    private manager: SubagentManager,
    private getSessionId: () => string,
    private onError?: (msg: string) => void,
  ) {}

  /**
   * Register a JS handler for a cron job by name.
   * When the job fires, the handler runs instead of sending followUp() to the LLM.
   * This saves the cost of an LLM call for formulaic/deterministic tasks.
   */
  registerHandler(jobName: string, handler: CronHandler): void {
    this.handlers.set(jobName, handler);
  }

  /** Load entries from config file (does NOT start jobs). */
  load(): CronEntry[] {
    this.entries = [];
    if (!existsSync(this.configPath)) return this.entries;
    try {
      const raw = readFileSync(this.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.onError?.(`Cron config is not an array: ${this.configPath}`);
        return this.entries;
      }
      for (const entry of parsed) {
        if (typeof entry.name !== "string" || typeof entry.intervalMs !== "number" || typeof entry.message !== "string") {
          this.onError?.(`Invalid cron entry: ${JSON.stringify(entry)}`);
          continue;
        }
        if (entry.intervalMs < 10_000) {
          this.onError?.(`Cron job "${entry.name}" intervalMs too low (${entry.intervalMs}ms < 10s minimum)`);
          continue;
        }
        this.entries.push(entry);
      }
    } catch (err) {
      this.onError?.(`Failed to parse cron config: ${err}`);
    }
    return this.entries;
  }

  /** Start enabled jobs. Call after the session is ready. */
  start(): void {
    this.stop();
    this.started = true;
    for (const entry of this.entries) {
      if (entry.enabled === false) continue;
      this.startEntry(entry);
    }
  }

  /** Stop all jobs. */
  stop(): void {
    this.started = false;
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
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
