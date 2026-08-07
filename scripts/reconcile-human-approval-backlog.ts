import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";
import { daemonSocketPath, emitDaemonEvent } from "../packages/control/src/client.js";

type TaskResource = {
  metadata?: { id?: string; generation?: number };
  spec?: { owner?: string };
  status?: { phase?: string; conditionIds?: string[] };
};

type Condition = {
  spec?: {
    type?: string;
    expected?: Record<string, unknown>;
  };
};

type TaskState = {
  resources?: Record<string, TaskResource>;
  conditions?: Record<string, Condition>;
};

export type ApprovalBacklogItem = {
  approvalId: string;
  waitId?: string;
  pathId?: string;
  approvalKind: string;
  taskId: string;
  taskGeneration?: number;
  targetOwner: string;
};

export type OrphanedApprovalNotification = {
  approvalId: string;
  approvalKind: string;
  agent: string;
  projectId?: string;
  taskId?: string;
  sentAt: number;
};

export function collectApprovalBacklog(state: TaskState): ApprovalBacklogItem[] {
  const found = new Map<string, ApprovalBacklogItem>();
  for (const [taskId, resource] of Object.entries(state.resources ?? {})) {
    if (resource.status?.phase !== "waiting") continue;
    for (const conditionId of resource.status.conditionIds ?? []) {
      const condition = state.conditions?.[conditionId];
      if (condition?.spec?.type !== "project.approval.submitted") continue;
      const expected = condition.spec.expected ?? {};
      const approvalId = stringValue(expected.approvalId);
      if (!approvalId) continue;
      found.set(approvalId, {
        approvalId,
        ...(stringValue(expected.waitId) ? { waitId: stringValue(expected.waitId) } : {}),
        ...(stringValue(expected.pathId) ? { pathId: stringValue(expected.pathId) } : {}),
        approvalKind: stringValue(expected.approvalKind) ?? "approval-packet-dispatch",
        taskId,
        ...(resource.metadata?.generation ? { taskGeneration: resource.metadata.generation } : {}),
        targetOwner: stringValue(resource.spec?.owner) ?? "app-owner",
      });
    }
  }
  return [...found.values()].sort((left, right) => left.taskId.localeCompare(right.taskId));
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function collectActiveApprovalIds(states: TaskState[]): Set<string> {
  const active = new Set<string>();
  for (const state of states) {
    for (const resource of Object.values(state.resources ?? {})) {
      if (resource.status?.phase !== "waiting") continue;
      for (const conditionId of resource.status.conditionIds ?? []) {
        const condition = state.conditions?.[conditionId];
        if (condition?.spec?.type !== "project.approval.submitted") continue;
        const approvalId = stringValue(condition.spec.expected?.approvalId);
        if (approvalId) active.add(approvalId);
      }
    }
  }
  return active;
}

export function collectOrphanedApprovalNotifications(
  notifications: OrphanedApprovalNotification[],
  activeApprovalIds: Set<string>,
  resolvedApprovalIds: Set<string>,
  olderThan: number,
): OrphanedApprovalNotification[] {
  return notifications
    .filter(
      (item) =>
        item.sentAt < olderThan && !activeApprovalIds.has(item.approvalId) && !resolvedApprovalIds.has(item.approvalId),
    )
    .sort((left, right) => left.sentAt - right.sentAt || left.approvalId.localeCompare(right.approvalId));
}

export function approvalBelongsToProject(
  item: Pick<OrphanedApprovalNotification, "approvalId" | "projectId">,
  project: string,
): boolean {
  return (
    projectName(item.projectId) === project ||
    item.approvalId.startsWith(`${project}:`)
  );
}

function alreadyResolvedApprovalIds(dbPath: string): Set<string> {
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db
      .query(
        `SELECT data
           FROM events
          WHERE event_type IN ('project.approval.submitted', 'project.approval.resolved')
            AND json_valid(data) = 1
            AND json_extract(data, '$.approvalId') IS NOT NULL`,
      )
      .all() as Array<{ data: string }>;
    return new Set(
      rows.flatMap((row) => {
        try {
          const approvalId = stringValue(JSON.parse(row.data).approvalId);
          return approvalId ? [approvalId] : [];
        } catch {
          return [];
        }
      }),
    );
  } finally {
    db.close();
  }
}

function deliveredApprovalNotifications(dbPath: string): OrphanedApprovalNotification[] {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .query(
        `SELECT json_extract(data, '$.approvalId') AS approvalId,
                coalesce(json_extract(data, '$.approvalKind'), 'approval') AS approvalKind,
                agent,
                project_id AS projectId,
                json_extract(data, '$.taskId') AS taskId,
                max(sent_at) AS sentAt
           FROM notification_messages
          WHERE event_type = 'message.created'
            AND json_valid(data) = 1
            AND json_extract(data, '$.approvalId') IS NOT NULL
          GROUP BY approvalId, approvalKind, agent, projectId, taskId`,
      )
      .all() as OrphanedApprovalNotification[];
  } finally {
    db.close();
  }
}

function readProjectTaskStates(appRoot: string): TaskState[] {
  const projectsRoot = resolve(appRoot, "projects");
  return readdirSync(projectsRoot, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || !entry.name.endsWith(".app")) return [];
    const statePath = resolve(projectsRoot, entry.name, ".state/tasks/state.json");
    if (!existsSync(statePath)) return [];
    try {
      return [JSON.parse(readFileSync(statePath, "utf8")) as TaskState];
    } catch {
      return [];
    }
  });
}

function projectName(projectId: string | undefined): string | undefined {
  if (!projectId) return undefined;
  return basename(projectId).replace(/\.app$/, "");
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const projectArgument = process.argv.find((value) =>
    value.startsWith("--project="),
  );
  const selectedProject = projectArgument?.slice("--project=".length).trim();
  const limitArgument = process.argv.find((value) => value.startsWith("--limit="));
  const limit = limitArgument ? Math.max(1, Number(limitArgument.slice("--limit=".length)) || 1) : Infinity;
  const appRoot = resolve(process.env.APP_ROOT ?? "/app");
  const stateDir = resolve(process.env.STATE_DIR ?? resolve(appRoot, ".state"));
  const dbPath = resolve(stateDir, "may.db");
  const projectStatePath = resolve(
    process.env.PROJECT_TASK_STATE ?? resolve(appRoot, "projects/alpha-project.app/.state/tasks/state.json"),
  );
  const projectAppPath = dirname(dirname(dirname(projectStatePath)));
  const stateProject = basename(projectAppPath).replace(/\.app$/, "");
  const project = selectedProject || stateProject;
  const taskState = JSON.parse(readFileSync(projectStatePath, "utf8")) as TaskState;
  const resolved = alreadyResolvedApprovalIds(dbPath);
  const allBacklog = collectApprovalBacklog(taskState).filter((item) => !resolved.has(item.approvalId));
  const activeApprovalIds = collectActiveApprovalIds(readProjectTaskStates(appRoot));
  const allOrphans = collectOrphanedApprovalNotifications(
    deliveredApprovalNotifications(dbPath),
    activeApprovalIds,
    resolved,
    Date.now() - 10 * 60_000,
  ).filter((item) => approvalBelongsToProject(item, project));
  const backlog = allBacklog.slice(0, limit);
  const orphans = allOrphans.slice(0, Math.max(0, limit - backlog.length));

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        rerouteCandidates: allBacklog.length,
        orphanCandidates: allOrphans.length,
        selected: backlog.length + orphans.length,
      },
      null,
      2,
    ),
  );
  for (const item of backlog) {
    console.log(`reroute\t${item.taskId}\t${item.targetOwner}\t${item.approvalId}`);
  }
  for (const item of orphans) {
    console.log(`close-orphan\t${item.taskId ?? "-"}\t${item.agent}\t${item.approvalId}`);
  }
  if (!apply || (backlog.length === 0 && orphans.length === 0)) return;

  const socket = daemonSocketPath(stateDir, {
    instance: process.env.DAEMON_INSTANCE ?? "background",
    interfaceAgent: process.env.DAEMON_AGENT ?? "may",
  });
  let applied = 0;
  const failures: Array<{ approvalId: string; error: string }> = [];
  for (const item of backlog) {
    try {
      const response = await emitDaemonEvent(
        socket,
        "project.approval.submitted",
        {
          source: "owner:human",
          owner: "agent:may",
          project,
          projectId: project,
          projectPath: `projects/${basename(projectAppPath)}`,
          approvalKind: item.approvalKind,
          approvalId: item.approvalId,
          ...(item.waitId ? { waitId: item.waitId } : {}),
          ...(item.pathId ? { pathId: item.pathId } : {}),
          taskId: item.taskId,
          ...(item.taskGeneration ? { taskGeneration: item.taskGeneration } : {}),
          decision: "reroute",
          targetOwner: item.targetOwner,
          reason:
            "Historical human wait rerouted under the ownership convention. The app owner must re-read current evidence and own the next action.",
          adjustments:
            "Handle current app-owned work directly. If a real external authority remains, identify the exact authority owner and decision surface; involve Hao only when that authority or preference is genuinely his.",
          idempotencyKey: `historical-human-wait-reroute:${item.approvalId}`,
        },
        { timeoutMs: 10_000 },
      );
      if (response.type !== "ok") {
        throw new Error(response.message ?? response.type);
      }
      applied += 1;
    } catch (error) {
      failures.push({
        approvalId: item.approvalId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  for (const item of orphans) {
    try {
      const response = await emitDaemonEvent(
        socket,
        "project.approval.resolved",
        {
          source: "historical-approval-repair",
          owner: `agent:${item.agent}`,
          ...(projectName(item.projectId) ? { project: projectName(item.projectId) } : {}),
          ...(item.projectId ? { projectId: item.projectId } : {}),
          approvalKind: item.approvalKind,
          approvalId: item.approvalId,
          ...(item.taskId ? { taskId: item.taskId } : {}),
          resolution: "orphaned",
          reason:
            "The delivered approval no longer has a live waiting task. Close the stale human card; the app must create a new durable task and exact approval if authority is still required.",
          idempotencyKey: `historical-orphaned-approval:${item.approvalId}`,
        },
        { timeoutMs: 10_000 },
      );
      if (response.type !== "ok") {
        throw new Error(response.message ?? response.type);
      }
      applied += 1;
    } catch (error) {
      failures.push({
        approvalId: item.approvalId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  console.log(JSON.stringify({ applied, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
}

if (import.meta.main) {
  await main();
}
