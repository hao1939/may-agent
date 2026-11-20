import { Type } from "typebox";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { getDb } from "../db/connection.js";
import { readStoredRuntimeTaskView } from "../../app/core/reads/app-read.js";
import {
  ensureTaskReferenceIndex,
  resolveTaskReference,
  taskReferenceDigest,
} from "../../app/core/state/task-reference-index.js";
import { taskStatusFromPhase } from "../../app/core/reads/task-status.js";
import { taskViewPhaseSql } from "../../app/core/state/task-view-phase.js";
import type { EventBus } from "../../app/core/events/bus.js";
import { getLoadedAppInputContract } from "../../app/core/tasks/app-task-runtime.js";

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;

export type TaskInspectToolOptions = {
  persistDir: string;
  bus?: EventBus;
};

const TaskInspectParams = Type.Union([
  Type.Object(
    {
      action: Type.Literal("get"),
      ref: Type.Optional(
        Type.String({
          description: "8-character Task ref (e.g. '353c145d' or 'a3219321'). Provide ref OR (appId + taskId).",
        }),
      ),
      appId: Type.Optional(
        Type.String({
          description: "App ID (e.g. 'aks-rp-e2e', 'alex', 'may', 'scout-knowledge-lib').",
        }),
      ),
      taskId: Type.Optional(
        Type.String({
          description: "Exact Task ID when ref is not used (e.g. 'workstream/spec-fixer').",
        }),
      ),
      includeEvidence: Type.Optional(
        Type.Boolean({
          description: "When true, include the latest accepted attempt evidence page.",
        }),
      ),
      inputKeys: Type.Optional(
        Type.Array(Type.String(), {
          maxItems: 8,
          description: "Optional exact input admission keys to inspect original input events.",
        }),
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      action: Type.Literal("list"),
      appId: Type.Optional(
        Type.String({
          description: "Optional App ID filter (e.g. 'aks-rp-e2e', 'alex', 'may').",
        }),
      ),
      status: Type.Optional(
        Type.String({
          description: "Optional status filter: pending, running, waiting, attention, idle, done.",
        }),
      ),
      q: Type.Optional(
        Type.String({
          description: "Optional substring filter on taskId, outcome, or summary.",
        }),
      ),
      limit: Type.Optional(
        Type.Integer({
          minimum: 1,
          maximum: MAX_LIST_LIMIT,
          default: DEFAULT_LIST_LIMIT,
        }),
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      action: Type.Literal("contract"),
      appId: Type.String({
        description: "App ID whose installed input schema and task routing contract to read.",
      }),
    },
    { additionalProperties: false },
  ),
]);

function textResult(payload: unknown): AgentToolResult<undefined> {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: undefined,
  };
}

export function createTaskInspectTool(options: TaskInspectToolOptions): AgentTool {
  return {
    name: "task_inspect",
    label: "Inspect Task State & Contracts",
    description:
      "Read-only system mechanism inspector for Tasks and App contracts. Use action='get' (by 8-char ref or appId+taskId) to read a Task's exact generation, status, outcome, acceptance, summary, facts, open conditions, and currentObligations in 1 call (never curl HTTP endpoints or grep docs for ports). Use action='list' to list Tasks by appId/status/query, or action='contract' to inspect an App's input contract.",
    parameters: TaskInspectParams,
    execute: async (_toolCallId, rawParams) => {
      try {
        const params = rawParams as Record<string, unknown>;
        const action = String(params.action ?? "");
        const db = getDb(options.persistDir);
        ensureTaskReferenceIndex(db);

        if (action === "get") {
          const rawRef = typeof params.ref === "string" ? params.ref.trim() : "";
          let appId = typeof params.appId === "string" ? params.appId.trim().replace(/\.app$/, "") : "";
          let taskId = typeof params.taskId === "string" ? params.taskId.trim() : "";

          if (rawRef) {
            const resolved = resolveTaskReference(db, rawRef);
            if (resolved.kind === "missing") {
              return textResult({ error: `Task reference not found: ${rawRef}` });
            }
            if (resolved.kind === "ambiguous") {
              return textResult({
                error: `Task reference '${rawRef}' is ambiguous`,
                candidates: resolved.candidates,
              });
            }
            appId = resolved.task.appId;
            taskId = resolved.task.taskId;
          }
          if (!appId || !taskId) {
            return textResult({
              error: "task_inspect action='get' requires either 'ref' or both 'appId' and 'taskId'.",
            });
          }

          const detail = readStoredRuntimeTaskView(db, appId, taskId, {
            ...(params.includeEvidence === true ? { acceptedEvidence: { limit: 4 } } : {}),
            ...(Array.isArray(params.inputKeys)
              ? { inputKeys: params.inputKeys.filter((k): k is string => typeof k === "string") }
              : {}),
          });
          if (!detail) {
            return textResult({
              error: `Task not found: ${appId}/${taskId}`,
            });
          }
          const ref = taskReferenceDigest(appId, taskId).slice(0, 8);
          return textResult({
            appId,
            taskId,
            ref,
            ...detail,
          });
        }

        if (action === "list") {
          const appId = typeof params.appId === "string" ? params.appId.trim().replace(/\.app$/, "") : "";
          const statusFilter = typeof params.status === "string" ? params.status.trim().toLowerCase() : "";
          const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
          const limit =
            typeof params.limit === "number" && Number.isFinite(params.limit)
              ? Math.max(1, Math.min(MAX_LIST_LIMIT, Math.floor(params.limit)))
              : DEFAULT_LIST_LIMIT;

          const clauses: string[] = [
            "NOT EXISTS (SELECT 1 FROM app_task_cancellations c WHERE c.app_id = app_tasks.app_id AND c.task_id = app_tasks.task_id)",
          ];
          const bind: Array<string | number> = [];
          if (appId) {
            clauses.push("app_id = ?");
            bind.push(appId);
          }
          if (q) {
            const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
            clauses.push(
              "(LOWER(task_id) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(json_extract(resource_json, '$.spec.outcome'), '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(json_extract(resource_json, '$.status.summary'), '')) LIKE ? ESCAPE '\\')",
            );
            bind.push(pattern, pattern, pattern);
          }

          const rows = db
            .prepare(
              `SELECT app_id, task_id, phase, updated_at, resource_json, (${taskViewPhaseSql("app_tasks")}) AS view_phase
               FROM app_tasks
               WHERE ${clauses.join(" AND ")}
               ORDER BY updated_at DESC, app_id ASC, task_id ASC
               LIMIT 200`,
            )
            .all(...bind) as Array<{
            app_id: string;
            task_id: string;
            phase: string;
            updated_at: number;
            resource_json: string;
            view_phase: string;
          }>;

          const items = [];
          for (const row of rows) {
            const status = taskStatusFromPhase(row.view_phase as any);
            if (statusFilter && status !== statusFilter && row.view_phase !== statusFilter) continue;
            const parsed = JSON.parse(row.resource_json) as Record<string, any>;
            items.push({
              appId: row.app_id,
              taskId: row.task_id,
              ref: taskReferenceDigest(row.app_id, row.task_id).slice(0, 8),
              status,
              generation: Number(parsed.metadata?.generation ?? 1),
              resourceVersion: Number(parsed.metadata?.resourceVersion ?? 1),
              outcome: String(parsed.spec?.outcome ?? "").slice(0, 240),
              summary: typeof parsed.status?.summary === "string" ? parsed.status.summary.slice(0, 240) : null,
              conditionIds: Array.isArray(parsed.status?.conditionIds) ? parsed.status.conditionIds : [],
              updatedAt: row.updated_at,
            });
            if (items.length >= limit) break;
          }

          return textResult({
            count: items.length,
            items,
          });
        }

        if (action === "contract") {
          const appId = typeof params.appId === "string" ? params.appId.trim().replace(/\.app$/, "") : "";
          if (!appId) {
            return textResult({ error: "task_inspect action='contract' requires 'appId'." });
          }
          if (!options.bus) {
            return textResult({ error: "App contract inspection is unavailable in this context." });
          }
          const contract = getLoadedAppInputContract({ bus: options.bus, appId });
          if (!contract) {
            return textResult({ error: `App contract not found for '${appId}'.` });
          }
          return textResult(contract);
        }

        return textResult({ error: `Unsupported task_inspect action: ${action}` });
      } catch (error) {
        return textResult({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}
