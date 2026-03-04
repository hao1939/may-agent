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
      return JSON.parse(raw);
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
          const lines = entries.map(e =>
            `- ${e.name}: every ${(e.intervalMs / 1000).toFixed(0)}s → "${e.message.slice(0, 100)}"`
          );
          lines.push("", status);
          return textResult(lines.join("\n"));
        }

        case "add": {
          if (!input.name) return textResult("Error: 'name' is required for add");
          if (!input.intervalMs) return textResult("Error: 'intervalMs' is required for add");
          if (!input.message) return textResult("Error: 'message' is required for add");
          if (input.intervalMs < 10_000) return textResult("Error: intervalMs must be >= 10000 (10 seconds)");
          const entries = readEntries();
          if (entries.some(e => e.name === input.name)) {
            return textResult(`Error: job "${input.name}" already exists. Use 'update' to modify.`);
          }
          entries.push({ name: input.name, intervalMs: input.intervalMs, message: input.message });
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
          const entries = readEntries();
          const entry = entries.find(e => e.name === input.name);
          if (!entry) return textResult(`Error: job "${input.name}" not found`);
          if (input.intervalMs !== undefined) {
            if (input.intervalMs < 10_000) return textResult("Error: intervalMs must be >= 10000 (10 seconds)");
            entry.intervalMs = input.intervalMs;
          }
          if (input.message !== undefined) entry.message = input.message;
          writeEntries(entries);
          return textResult(`Updated job "${input.name}"`);
        }

        case "status": {
          const entries = readEntries();
          const enabled = opts.cronEnabled ? "enabled" : "disabled";
          if (entries.length === 0) {
            return textResult(`Cron status: ${enabled}, 0 jobs`);
          }
          const shortest = entries.reduce((a, b) => a.intervalMs <= b.intervalMs ? a : b);
          return textResult(
            `Cron status: ${enabled}, ${entries.length} job(s)\n` +
            `Next to fire: "${shortest.name}" (every ${(shortest.intervalMs / 1000).toFixed(0)}s)`
          );
        }

        default:
          return textResult(`Error: unknown action "${input.action}". Use list/add/remove/update/status.`);
      }
    },
  };
}
