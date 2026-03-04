/**
 * Cron — reads agents/<name>/cron.json, fires manager.followUp()
 * on intervals. That's it. No history, no conditions, no decisions.
 */

import { readFileSync, existsSync } from "node:fs";
import type { SubagentManager } from "../src/index.js";
import type { CronEntry } from "../src/cron-tool.js";

export class Cron {
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private entries: CronEntry[] = [];
  private started = false;

  constructor(
    private configPath: string,
    private manager: SubagentManager,
    private getSessionId: () => string,
    private onError?: (msg: string) => void,
  ) {}

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
    const timer = setInterval(() => {
      try {
        const sid = this.getSessionId();
        this.manager.followUp(sid, entry.message);
      } catch (err) {
        this.onError?.(`Cron job "${entry.name}" followUp failed: ${err}`);
      }
    }, entry.intervalMs);
    // Don't keep the process alive just for cron
    timer.unref();
    this.timers.set(entry.name, timer);
  }
}
