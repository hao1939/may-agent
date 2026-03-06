/**
 * Cron tool — CRUD for cron.json entries.
 * Agents use this to manage their own scheduled jobs.
 */

import { Type, type Static } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export interface CronEntry {
  name: string;
  intervalMs: number;
  message: string;
  enabled: boolean;
  description?: string;
  /** Entry type: "heartbeat" fires into persistent session, "job" spawns task or runs handler. */
  type?: "heartbeat" | "job";
  /** Agent to run this job. For heartbeat: which agent's session. For job: spawns dedicated instance. */
  agent?: string;
  /** JS handler name. If set, runs in-process instead of spawning. */
  handler?: string;
  /** Timeout for spawned job processes in ms (default: 600000 = 10 min). */
  timeoutMs?: number;
}

export interface JobResult {
  jobName: string;
  type: "heartbeat" | "job";
  status: "success" | "failure" | "skipped" | "timeout";
  summary: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  agent?: string;
  sessionId?: string;
  artifacts?: string[];
  error?: string;
}

function textResult(text: string): AgentToolResult<string> {
  return { content: [{ type: "text", text }], details: text };
}

const CronParams = Type.Object({
  action: Type.Union([
    Type.Literal("list"),
    Type.Literal("add"),
    Type.Literal("remove"),
    Type.Literal("update"),
    Type.Literal("status"),
  ], { description: "list | add | remove | update | status" }),
  name: Type.Optional(Type.String({ description: "Job name (required for add/remove/update)" })),
  intervalMs: Type.Optional(Type.Number({ description: "Interval in milliseconds (required for add, optional for update). Minimum 10000 (10s)." })),
  message: Type.Optional(Type.String({ description: "Message to send on each interval (required for add, optional for update)" })),
  enabled: Type.Optional(Type.Boolean({ description: "Whether the job is enabled (default true). Disabled jobs won't fire." })),
  description: Type.Optional(Type.String({ description: "Optional description for the job" })),
});

type CronInput = Static<typeof CronParams>;

export interface CronToolOptions {
  /** Path to the agent's cron.json */
  configPath: string;
  /** Called after any write to cron.json so the cron runner can reload. */
  onConfigChange: () => void;
  /** Whether cron is active (jobs actually fire). */
  cronEnabled?: boolean;
}

export function createCronTool(opts: CronToolOptions): AgentTool<typeof CronParams, string> {
  function readEntries(): CronEntry[] {
    if (!existsSync(opts.configPath)) return [];
    try {
      const raw = readFileSync(opts.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      // Migrate legacy entries that lack the `enabled` field
      return parsed.map((e: any) => ({
        ...e,
        enabled: e.enabled !== undefined ? e.enabled : true,
      }));
    } catch {
      return [];
    }
  }

  function writeEntries(entries: CronEntry[]): void {
    mkdirSync(dirname(opts.configPath), { recursive: true });
    writeFileSync(opts.configPath, JSON.stringify(entries, null, 2) + "\n");
    opts.onConfigChange();
  }

  return {
    name: "cron",
    label: "cron",
    description:
      "Manage YOUR cron jobs — recurring tasks that automatically send a message " +
      "into your session on a fixed interval. These are your built-in scheduled tasks, " +
      "persisted in your cron.json config file.\n\n" +
      "Actions:\n" +
      "- list: show all your cron jobs and whether cron is currently active\n" +
      "- add: create a new job (name, intervalMs, message)\n" +
      "- remove: delete a job by name\n" +
      "- update: modify an existing job's interval or message\n" +
      "- status: brief summary (job count, enabled/disabled, next to fire)\n\n" +
      "When cron is active (SCHEDULERS=1), each job fires its message into your " +
      "session at the configured interval. When disabled, you can still manage " +
      "jobs but they won't fire.",
    parameters: CronParams,
    execute: async (_toolCallId: string, input: CronInput) => {
      switch (input.action) {
        case "list": {
          const entries = readEntries();
          const status = opts.cronEnabled ? "Status: ACTIVE" : "Status: DISABLED (jobs defined but won't fire until SCHEDULERS=1)";
          if (entries.length === 0) return textResult(`no cron jobs configured\n${status}`);
          const lines = entries.map(e => {
            const prefix = e.enabled ? "" : "[DISABLED] ";
            const desc = e.description ? ` — ${e.description.slice(0, 50)}` : "";
            return `- ${prefix}${e.name}: every ${(e.intervalMs / 1000).toFixed(0)}s → "${e.message.slice(0, 100)}"${desc}`;
          });
          lines.push("", status);
          return textResult(lines.join("\n"));
        }

        case "add": {
          if (!input.name) return textResult("Error: 'name' is required for add");
          if (input.name.length > 50) return textResult("Error: name must be <= 50 characters");
          if (!input.intervalMs) return textResult("Error: 'intervalMs' is required for add");
          if (!input.message) return textResult("Error: 'message' is required for add");
          if (input.message.length > 500) return textResult("Error: message must be <= 500 characters");
          if (input.intervalMs < 10_000) return textResult("Error: intervalMs must be >= 10000 (10 seconds)");
          const entries = readEntries();
          if (entries.some(e => e.name === input.name)) {
            return textResult(`Error: job "${input.name}" already exists. Use 'update' to modify.`);
          }
          const newEntry: CronEntry = {
            name: input.name,
            intervalMs: input.intervalMs,
            message: input.message,
            enabled: input.enabled !== undefined ? input.enabled : true,
          };
          if (input.description !== undefined) newEntry.description = input.description.length > 200 ? input.description.slice(0, 200) + "..." : input.description;
          entries.push(newEntry);
          writeEntries(entries);
          return textResult(`Added job "${input.name}": every ${(input.intervalMs / 1000).toFixed(0)}s`);
        }

        case "remove": {
          if (!input.name) return textResult("Error: 'name' is required for remove");
          const entries = readEntries();
          const idx = entries.findIndex(e => e.name === input.name);
          if (idx === -1) return textResult(`Error: job "${input.name}" not found`);
          entries.splice(idx, 1);
          writeEntries(entries);
          return textResult(`Removed job "${input.name}"`);
        }

        case "update": {
          if (!input.name) return textResult("Error: 'name' is required for update");
          if (input.name.length > 50) return textResult("Error: name must be <= 50 characters");
          const entries = readEntries();
          const entry = entries.find(e => e.name === input.name);
          if (!entry) return textResult(`Error: job "${input.name}" not found`);
          if (input.intervalMs !== undefined) {
            if (input.intervalMs < 10_000) return textResult("Error: intervalMs must be >= 10000 (10 seconds)");
            entry.intervalMs = input.intervalMs;
          }
          if (input.message !== undefined) entry.message = input.message;
          if (input.description !== undefined) entry.description = input.description.length > 200 ? input.description.slice(0, 200) + "..." : input.description;
          if (input.enabled !== undefined) entry.enabled = input.enabled;
          writeEntries(entries);
          return textResult(`Updated job "${input.name}"`);
        }

        case "status": {
          const entries = readEntries();
          const status = opts.cronEnabled ? "Status: ACTIVE" : "Status: DISABLED (jobs defined but won't fire until SCHEDULERS=1)";
          if (entries.length === 0) {
            return textResult(`No cron jobs configured.\n${status}`);
          }
          const enabledEntries = entries.filter(e => e.enabled);
          let nextToFire: string;
          if (enabledEntries.length === 0) {
            nextToFire = "Next to fire: none (all jobs disabled)";
          } else {
            const shortest = enabledEntries.reduce((a, b) => a.intervalMs <= b.intervalMs ? a : b);
            nextToFire = `Next to fire: "${shortest.name}" (every ${(shortest.intervalMs / 1000).toFixed(0)}s)`;
          }
          return textResult(
            `${entries.length} job(s) configured\n` +
            `${nextToFire}\n\n` +
            status
          );
        }

        default:
          return textResult(`Error: unknown action "${input.action}". Use list/add/remove/update/status.`);
      }
    },
  };
}
