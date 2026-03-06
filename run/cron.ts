/**
 * Cron — manages periodic jobs.
 *
 * Three execution modes:
 * 1. JS handler  — registered function, runs in-process (cheapest)
 * 2. Heartbeat   — followUp() into main session (no `agent` field)
 * 3. Task        — spawns dedicated instance via may.sh task (`agent` field)
 */

import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { SubagentManager } from "../src/index.js";
import type { CronEntry } from "../src/cron-tool.js";

/** A JS function that replaces the LLM for a specific cron job. */
export type CronHandler = () => Promise<void>;

/** Callback when a job fires (for notifications). */
export type CronJobCallback = (entry: CronEntry, type: "js" | "heartbeat" | "task") => void;

export class Cron {
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private entries: CronEntry[] = [];
  private started = false;
  private handlers = new Map<string, CronHandler>();
  private onJobFire?: CronJobCallback;
  /** Track running task instances to prevent overlap. */
  private runningTasks = new Set<string>();
  private projectRoot: string;

  constructor(
    private configPath: string,
    private manager: SubagentManager,
    private getSessionId: () => string,
    private onError?: (msg: string) => void,
  ) {
    this.projectRoot = resolve(dirname(configPath), "..");
  }

  registerHandler(jobName: string, handler: CronHandler): void {
    this.handlers.set(jobName, handler);
  }

  onFire(cb: CronJobCallback): void {
    this.onJobFire = cb;
  }

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

  private startEntry(entry: CronEntry): void {
    const handler = this.handlers.get(entry.name);

    const timer = setInterval(() => {
      if (handler) {
        // JS handler — run directly
        this.onJobFire?.(entry, "js");
        handler().catch((err) => {
          this.onError?.(`Cron handler "${entry.name}" failed: ${err}`);
        });
      } else if (entry.agent) {
        // Has agent → spawn dedicated instance
        this.spawnTask(entry);
      } else {
        // No agent → heartbeat into main session
        this.onJobFire?.(entry, "heartbeat");
        try {
          const sid = this.getSessionId();
          this.manager.followUp(sid, entry.message, "cron");
        } catch (err) {
          this.onError?.(`Cron job "${entry.name}" followUp failed: ${err}`);
        }
      }
    }, entry.intervalMs);
    timer.unref();
    this.timers.set(entry.name, timer);
  }

  private spawnTask(entry: CronEntry): void {
    // Don't spawn if already running
    if (this.runningTasks.has(entry.name)) {
      this.onError?.(`Cron job "${entry.name}" skipped — already running`);
      return;
    }

    this.onJobFire?.(entry, "task");
    this.runningTasks.add(entry.name);

    const taskMsg = entry.message || `[cron:${entry.name}] Run your task.`;

    // Spawn: ./may.sh task --agent <agent> --name <name> "message"
    const proc = spawn("bash", [
      resolve(this.projectRoot, "may.sh"),
      "task",
      "--agent", entry.agent!,
      "--name", entry.name,
      taskMsg,
    ], {
      cwd: this.projectRoot,
      stdio: "ignore",
      detached: true,
    });
    proc.unref();

    proc.on("exit", () => {
      this.runningTasks.delete(entry.name);
    });

    proc.on("error", (err) => {
      this.runningTasks.delete(entry.name);
      this.onError?.(`Cron job "${entry.name}" spawn failed: ${err}`);
    });
  }
}
