/**
 * Cron tool — CRUD for cron.json entries.
 * Agents use this to manage their own scheduled jobs. Each agent has its own cron.json.
 */

import { Type } from "@earendil-works/pi-ai";
import type { TSchema } from "@earendil-works/pi-ai";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Pre-flight check configuration for cron jobs. Runs a lightweight JS check
 * before spawning an LLM session. If the check returns false, the session is
 * skipped entirely — saving LLM costs when there's nothing to process.
 */
export interface PreflightCheck {
  /** Check type:
   *  - `file-has-content`: skip if file has fewer than `minLines` non-empty lines
   *  - `new-entries-since`: skip if file has no new entries since last successful run (tracked by stateKey)
   */
  type: "file-has-content" | "new-entries-since";
  /** Path to the file to check (relative to project root). */
  path: string;
  /** For `new-entries-since`: key in preflight state to track last-checked position. */
  stateKey?: string;
  /** For `file-has-content`: minimum number of non-empty lines required (default: 1). */
  minLines?: number;
}

export interface WorkflowBackedHandler {
  workflow: string;
  agent?: string;
  task: string;
  includeEvent?: boolean;
  projectId?: string;
  timeoutMs?: number;
}

export type CronHandlerSpec = string | WorkflowBackedHandler;

export interface CronEntry {
  name: string;
  /** Typed operational role. Legacy heartbeat names are normalized at config ingress. */
  category?: "handler" | "heartbeat";
  intervalMs?: number;
  /** Deprecated config field. Scheduler does not treat message as a trigger mode. */
  message?: string;
  enabled: boolean;
  description?: string;
  /** Durable maintenance context for the loop this trigger serves. Local paths from app root. */
  context?: string[];
  /** Agent associated with the trigger. Workflow-backed handlers set this inside handler.agent. */
  agent?: string;
  /** Handler implementation: a named JS handler or a workflow-backed handler object. */
  handler?: CronHandlerSpec;
  /** Timeout for spawned job processes in ms (default: 600000 = 10 min). */
  timeoutMs?: number;
  /** Config passed to the handler's create() factory. Handler-specific. */
  handlerConfig?: Record<string, unknown>;
  lastModified?: string;
  /**
   * Pre-flight check for run-agent-task jobs. If the check fails, the LLM
   * session is skipped entirely — saving cost when there's nothing to process.
   */
  preflight?: PreflightCheck;
  /**
   * Fixed offset in ms from the start of each interval cycle.
   * Use to stagger jobs that share the same intervalMs so they don't all
   * fire at once. E.g., 5 heartbeats at 30min with offsets 0, 6min, 12min,
   * 18min, 24min fire evenly across the window. Default: 0.
   */
  offsetMs?: number;
  /**
   * Event types that trigger this handler immediately (in addition to timer).
   * E.g., ["project.comment.created", "project.owner.requested"] fires the handler when these events occur.
   */
  on?: string[];
  /**
   * Maximum concurrent handler invocations for this entry.
   * Defaults to 1. Use only for event-driven handlers that are idempotent or
   * route each event to an independently leased unit of work.
   */
  maxConcurrentTriggers?: number;
  /**
   * Maximum number of events to queue when the handler is at capacity.
   * When the queue reaches this depth, the oldest event is dropped so the
   * newest (most up-to-date) event is kept. Default: 3.
   * Set to 0 to disable queueing entirely (events are silently dropped
   * when at capacity).
   */
  maxQueueDepth?: number;
}

function textResult(text: string): AgentToolResult<string> {
  return { content: [{ type: "text", text }], details: text };
}

function handlerLabel(handler: CronEntry["handler"]): string {
  if (!handler) return "";
  if (typeof handler === "string") return handler;
  return `workflow:${handler.agent ? `${handler.agent}/` : ""}${handler.workflow}`;
}

const CronParams: TSchema = Type.Object({
  action: Type.Union(
    [Type.Literal("list"), Type.Literal("add"), Type.Literal("remove"), Type.Literal("update"), Type.Literal("status")],
    {
      description:
        "'list': show configured jobs and timer status. 'add': create a new job. 'remove': delete a job. 'update': change interval, message, or enabled state. 'status': summarize configured jobs and intervals (not live run state).",
    },
  ),
  name: Type.Optional(
    Type.String({ description: "Job name (required for add/remove/update). Use 'list' to see existing job names." }),
  ),
  intervalMs: Type.Optional(
    Type.Number({
      description:
        "Interval in milliseconds (required for 'add', optional for 'update'). Minimum 10000 (10s). Common values: 1800000 (30min), 3600000 (1h), 7200000 (2h).",
    }),
  ),
  message: Type.Optional(
    Type.String({
      description:
        "Task prompt used by the workflow-backed handler each time the timer fires (required for 'add').",
    }),
  ),
  enabled: Type.Optional(
    Type.Boolean({
      description: "Whether the job is enabled. Set to false to pause a job without removing it. Default: true.",
    }),
  ),
  description: Type.Optional(Type.String({ description: "Human-readable description of what this job does." })),
});

interface CronInput {
  action: "list" | "add" | "remove" | "update" | "status";
  name?: string;
  intervalMs?: number;
  message?: string;
  enabled?: boolean;
  description?: string;
}

export interface CronToolOptions {
  /** Path to the agent's cron.json */
  configPath: string;
  /** Agent that owns this cron tool. New workflow-backed jobs run this agent. */
  agentName?: string;
  /** Called after any write to cron.json so the cron runner can reload. */
  onConfigChange: () => void;
  /** Whether optional interval timers are enabled; independent of event/manual triggers. */
  cronEnabled?: boolean;
}

export function createCronTool(opts: CronToolOptions): AgentTool {
  const timerStatus = `Timers: ${opts.cronEnabled ? "ENABLED" : "DISABLED (enable with --cron)"}. Event/manual triggers are independent of this setting.`;
  function readEntries(): CronEntry[] {
    if (!existsSync(opts.configPath)) return [];
    try {
      const raw = readFileSync(opts.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      return parsed;
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
      "Manage YOUR timer-triggered handlers — recurring tasks that run on a fixed interval. " +
      "By default, new jobs use a workflow-backed handler that runs you with the configured task. " +
      "Jobs are persisted in your cron.json config file.\n\n" +
      "Actions:\n" +
      "- list: show all your cron jobs and whether timers are enabled\n" +
      "- add: create a new job (name, intervalMs, message)\n" +
      "- remove: delete a job by name\n" +
      "- update: modify an existing job's interval or message\n" +
      "- status: configuration summary (job count and shortest enabled interval), not live run state\n\n" +
      "The --cron flag enables optional interval timers. Event/manual triggers are independent " +
      "of this setting. Disabling an individual job stops all its triggers.",
    parameters: CronParams,
    execute: async (_toolCallId: string, _input: unknown) => {
      const input = _input as CronInput;
      switch (input.action) {
        case "list": {
          const entries = readEntries();
          if (entries.length === 0) return textResult(`no cron jobs configured\n${timerStatus}`);
          const lines = entries.map((e) => {
            const prefix = e.enabled === false ? "[DISABLED] " : "";
            const desc = e.description ? ` — ${e.description.slice(0, 50)}` : "";
            const cadence = e.intervalMs ? `every ${(e.intervalMs / 1000).toFixed(0)}s` : "event-only";
            return `- ${prefix}${e.name}: ${cadence} → "${(e.handler ? handlerLabel(e.handler) : e.message ?? "").slice(0, 100)}"${desc}`;
          });
          lines.push("", timerStatus);
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
          if (entries.some((e) => e.name === input.name)) {
            return textResult(
              `Error: job "${input.name}" already exists. Use 'update' to modify it, or 'remove' first to replace it.`,
            );
          }
          const executor = opts.agentName ?? "may";
          const newEntry: CronEntry = {
            name: input.name,
            intervalMs: input.intervalMs,
            handler: {
              workflow: "verify-wrap",
              agent: executor,
              task: input.message,
            },
            enabled: input.enabled !== undefined ? input.enabled : true,
          };
          if (input.description !== undefined)
            newEntry.description =
              input.description.length > 200 ? input.description.slice(0, 200) + "..." : input.description;
          entries.push(newEntry);
          writeEntries(entries);
          return textResult(`Added job "${input.name}": every ${(input.intervalMs / 1000).toFixed(0)}s`);
        }

        case "remove": {
          if (!input.name) return textResult("Error: 'name' is required for remove");
          const entries = readEntries();
          const idx = entries.findIndex((e) => e.name === input.name);
          if (idx === -1) return textResult(`Error: job "${input.name}" not found`);
          entries.splice(idx, 1);
          writeEntries(entries);
          return textResult(`Removed job "${input.name}"`);
        }

        case "update": {
          if (!input.name) return textResult("Error: 'name' is required for update");
          if (input.name.length > 50) return textResult("Error: name must be <= 50 characters");
          const entries = readEntries();
          const entry = entries.find((e) => e.name === input.name);
          if (!entry) return textResult(`Error: job "${input.name}" not found`);
          if (input.intervalMs !== undefined) {
            if (input.intervalMs < 10_000) return textResult("Error: intervalMs must be >= 10000 (10 seconds)");
            entry.intervalMs = input.intervalMs;
          }
          if (input.message !== undefined && typeof entry.handler === "object") {
            entry.handler.task = input.message;
            delete entry.message;
          } else if (input.message !== undefined) {
            entry.message = input.message;
          }
          if (input.description !== undefined)
            entry.description =
              input.description.length > 200 ? input.description.slice(0, 200) + "..." : input.description;
          if (input.enabled !== undefined) entry.enabled = input.enabled;
          entry.lastModified = new Date().toISOString();
          writeEntries(entries);
          return textResult(`Updated job "${input.name}"`);
        }

        case "status": {
          const entries = readEntries();
          if (entries.length === 0) {
            return textResult(`No cron jobs configured.\n${timerStatus}`);
          }
          const timedEntries = entries.filter((e) => e.enabled !== false && e.intervalMs);
          const shortest = timedEntries.reduce<CronEntry | undefined>(
            (a, b) => (a && (a.intervalMs ?? Infinity) <= (b.intervalMs ?? Infinity) ? a : b),
            undefined,
          );
          const cadence = shortest
            ? `Shortest configured interval: "${shortest.name}" (every ${((shortest.intervalMs ?? 0) / 1000).toFixed(0)}s)`
            : "No enabled interval jobs configured.";
          return textResult(`${entries.length} job(s) configured\n${cadence}\n\n${timerStatus}`);
        }

        default:
          return textResult(`Error: unknown action "${input.action}". Use list/add/remove/update/status.`);
      }
    },
  };
}
