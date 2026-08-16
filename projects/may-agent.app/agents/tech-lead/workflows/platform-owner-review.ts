import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  taskOwnerResultSchema,
  type ExecutionResult,
  type TaskReconcileResult,
  type WorkflowContext,
} from "@may-agent/sdk";

type OwnerResult = Omit<TaskReconcileResult, "state"> & {
  state: "converged" | "waiting";
};

type OwnerAuthFailure = {
  provider: string;
  detail: string;
};

type OwnerReviewArtifactStatus =
  | "pending"
  | "blocked"
  | "waiting"
  | "converged";

type OwnerReviewArtifact = {
  generated_at: string;
  updated_at: string;
  trigger_event_id: number | null;
  status: OwnerReviewArtifactStatus;
  packet_path: string;
  owner_prompt_artifact_path: string;
  trigger_excerpt: string;
  reconciliation_task_id: string;
  owner_worklog?: {
    required_before_speculative_edits: boolean;
    prompt: string;
    current_hypothesis: string | null;
    next_step: string | null;
    updated_at: string | null;
  };
  owner_execution?: {
    execution_id: string | null;
    status: string;
    summary: string | null;
  };
  owner_result?: OwnerResult;
  interim_note?: string;
};

export const name = "platform-owner-review";
export const description =
  "May-agent.app local owner workflow. Builds a bounded platform review packet, then asks tech-lead to judge and advance the project.";

const ownerAgent = "tech-lead";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function triggerEventId(ctx: WorkflowContext): number | null {
  const trigger = record(ctx.reconciliation?.trigger);
  const data = record(trigger.data);
  const value = trigger.eventId ?? data.eventId ?? data.event_id;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function triggerText(ctx: WorkflowContext): string {
  return ctx.reconciliation?.trigger
    ? JSON.stringify(ctx.reconciliation.trigger, null, 2)
    : JSON.stringify(ctx.input, null, 2);
}

export function buildOwnerReviewArtifactPath(
  appDir: string,
  eventId: number | null,
  now = Date.now(),
): string {
  const fileName = eventId ? `event-${eventId}.json` : `review-${now}.json`;
  return join(appDir, ".state", "owner-review-artifacts", fileName);
}

export function writeOwnerReviewArtifact(
  path: string,
  artifact: OwnerReviewArtifact,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`, "utf-8");
}

function parseJsonFile(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function preservedOwnerProgress(
  path: string,
): Pick<OwnerReviewArtifact, "owner_worklog" | "interim_note"> {
  const current = parseJsonFile(path);
  const ownerWorklog = record(current.owner_worklog);
  return {
    owner_worklog:
      Object.keys(ownerWorklog).length > 0
        ? (ownerWorklog as OwnerReviewArtifact["owner_worklog"])
        : undefined,
    interim_note:
      typeof current.interim_note === "string"
        ? current.interim_note
        : undefined,
  };
}

function metricIdFromTrigger(ctx: WorkflowContext): string | null {
  const trigger = ctx.reconciliation?.trigger;
  const data = record(trigger?.data);
  const value =
    trigger?.target?.metricId ?? data.metricId ?? data.metric_id ?? null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function buildReviewPacket(
  ctx: WorkflowContext,
): Promise<Record<string, unknown>> {
  const reconciliation = ctx.reconciliation;
  if (!reconciliation) return { available: false };

  const metricId = metricIdFromTrigger(ctx);
  let triggerMetric: unknown = null;
  if (metricId) {
    try {
      triggerMetric = await ctx.read.metric(metricId);
    } catch (error) {
      triggerMetric = {
        id: metricId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    generated_at: new Date().toISOString(),
    task: {
      app_id: reconciliation.appId,
      id: reconciliation.taskId,
      generation: reconciliation.generation,
      resource_version: reconciliation.resourceVersion,
      owner: reconciliation.owner,
      mode: reconciliation.mode,
      outcome: reconciliation.outcome,
      acceptance: reconciliation.acceptance,
      input: reconciliation.input,
    },
    trigger: reconciliation.trigger ?? null,
    trigger_metric: triggerMetric,
    children: {
      live: reconciliation.children.live,
      completed: reconciliation.children.completed.slice(-12),
    },
    project_live_tasks: {
      tasks: reconciliation.taskSnapshot.live.slice(0, 24),
      truncated: reconciliation.taskSnapshot.truncated,
    },
  };
}

function buildPacketSummary(packet: Record<string, unknown>): string {
  if (packet.available === false)
    return "No reconciliation packet is available.";
  const task = record(packet.task);
  const children = record(packet.children);
  const snapshot = record(packet.project_live_tasks);
  const liveChildren = Array.isArray(children.live) ? children.live : [];
  const completedChildren = Array.isArray(children.completed)
    ? children.completed
    : [];
  const liveTasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  const byStatus = new Map<string, string[]>();
  for (const value of liveTasks) {
    const item = record(value);
    const status = typeof item.status === "string" ? item.status : "unknown";
    const id = typeof item.taskId === "string" ? item.taskId : "unknown";
    byStatus.set(status, [...(byStatus.get(status) ?? []), id]);
  }

  const lines = [
    `Current task: ${String(task.id)} (generation=${String(task.generation)}, owner=${String(task.owner)})`,
    `Running: ${String(task.id)}`,
    `Children: live=${liveChildren.length}, completed-in-packet=${completedChildren.length}`,
  ];
  for (const [status, ids] of [...byStatus.entries()].sort()) {
    lines.push(
      `${status[0]?.toUpperCase() ?? ""}${status.slice(1)}: ${ids.join(", ")}`,
    );
  }
  if (snapshot.truncated)
    lines.push("Project live-task snapshot is truncated.");
  const metric = record(packet.trigger_metric);
  if (Object.keys(metric).length > 0) {
    lines.push(
      `Trigger metric: ${String(metric.id)} (value=${String(metric.value)}, status=${String(metric.status)})`,
    );
  }
  return lines.join("\n");
}

export function buildOwnerPrompt(input: {
  appDir: string;
  projectDir: string;
  packetPath: string;
  packetSummary: string;
  trigger: string;
  reviewArtifactPath: string;
}): string {
  return [
    "You are the May-agent platform project owner.",
    "",
    `App/control plane: ${input.appDir}`,
    `Domain workspace: ${input.projectDir}`,
    "",
    "Current trigger:",
    input.trigger || "(no trigger event was provided)",
    "",
    "Trigger priority:",
    "- When project.owner.requested carries an explicit instruction, treat that instruction as the primary bounded owner request.",
    "- Use the review packet as context; do not silently replace the requested review with an unrelated alert review.",
    "- If the instruction cannot be completed safely, return the exact conflict or blocker and the smallest supported task action.",
    "",
    "Admission-review terminal decision gate:",
    "- For a held admission candidate, gather only three anchors: the exact candidate payload, its exact runtime lineage, and any exact prior terminal closure.",
    "- Resolve each anchor by exact event ID, cited artifact path, or exact task/resource ID. Do not read whole state files, discover schemas, or load broad reference documents when an exact lookup is available.",
    "- As soon as all three anchors are known, stop investigating. Immediately checkpoint the supported disposition, then return the safest terminal handle, route, clarify-producer, reject, or deliver result and call finish.",
    "- Reserve the final quarter of the session budget for the terminal decision and finish. If an anchor remains unavailable at that checkpoint, choose the safest supported route or clarify-producer disposition instead of starting another lookup.",
    "",
    "The bounded reconciliation review packet is at:",
    `  ${input.packetPath}`,
    "",
    "Packet summary:",
    input.packetSummary,
    "",
    "Required owner judgment:",
    "- Start from bounded durable evidence: the packet, cited artifact paths, the supplied reconciliation context, and exact runtime records for the named lineage or alert. Do not fall back to repository-wide search unless one exact cited file path still needs inspection.",
    "- Prefer project-local App workflow/design fixes over adding behavior to global May handlers.",
    "- Never write the runtime database directly. Durable App and task changes must pass through the owning App and the event/reconciliation contracts.",
    "- Route cross-project durable task changes through the target App owner; do not mutate another App's task state from this workflow.",
    "- You may edit May-agent-owned code and docs when that is the smallest useful step. Cite the resulting files and checks as evidence.",
    "- If you edit files, run focused checks and cite them before finish.",
    "- The generic reconciler is the sole task-tree mutation authority. Never edit task-tree JSON, call task-tree mutation commands, or write task state through the database.",
    "- Return task-tree changes only as typed actions in finish. Existing-task actions require the exact generation shown in the packet.",
    "- For an unfinished owner message, create required delegated work as a direct child of runtime/platform-owner-review and return waiting. Routing or task creation is progress, not message completion.",
    "- Return converged only when the bounded request is handled and no required delegated child remains live.",
    "- Never mutate or create task ids beginning with runtime/; those standing responsibilities belong to the reconciler.",
    "- Use converged after the current bounded actions are declared, and waiting only for a named external fact with an exact Condition that an observer can emit.",
    "- Every waiting Condition subject must be typed (for example event:5011463, session:s_123, pull-request:77); bare numeric ids or free-text subjects are rejected by the task-handler contract.",
    "- An evidence-backed no-op is valid; return an empty actions array and explain why existing work already covers the signal.",
    "",
    "Loss-prevention discipline for this owner review:",
    "- As soon as you confirm the primary trigger evidence and your first gap/no-op hypothesis, immediately call checkpoint() with that proof and the likely next step.",
    `- Immediately after that checkpoint, update ${input.reviewArtifactPath} with a 1-3 sentence interim note before any speculative edit, broad repo search, or secondary investigation.`,
    "- If a later interruption occurs, the checkpoint and interim note must support a recoverable waiting/converged decision.",
    "",
    "Start with these files:",
    `- ${input.packetPath}`,
    `- ${input.appDir}/project.json`,
    `- ${input.appDir}/app.ts`,
    `- ${input.appDir}/agents/tech-lead/workflows/platform-owner-review.ts`,
  ].join("\n");
}

function classifyOwnerAuthFailure(error: string): OwnerAuthFailure | null {
  const genericAuth =
    /(AuthenticationError|auth(?:entication)? failed|unauthorized|token expired|oauth)/i;
  if (!genericAuth.test(error)) return null;
  if (/Github_copilotException|github-copilot|copilot/i.test(error)) {
    return { provider: "github-copilot", detail: error };
  }
  return { provider: "llm-provider", detail: error };
}

export function normalizeOwnerResult(ownerResult: OwnerResult): OwnerResult {
  const createsRequiredChild = ownerResult.actions?.some(
    (action) => action.kind === "create-task",
  );
  if (ownerResult.state !== "converged" || !createsRequiredChild) {
    return ownerResult;
  }
  return {
    ...ownerResult,
    state: "waiting",
    evidence: [
      ...ownerResult.evidence,
      "owner-result-normalized: create-task actions require waiting until delegated work converges",
    ],
  };
}

function authFailureOwnerResult(input: {
  provider: string;
  detail: string;
  executionId: string | null;
  reviewArtifactPath: string;
}): OwnerResult {
  const providerLabel =
    input.provider === "github-copilot" ? "GitHub Copilot" : input.provider;
  return {
    state: "waiting",
    summary: `Platform owner review could not complete because the ${ownerAgent} execution hit a ${providerLabel} authentication failure; refresh the credential and rerun the owner review.`,
    evidence: [
      `owner-execution:${input.executionId ?? "unknown"}`,
      `provider-auth:${input.detail}`,
      `artifact:${input.reviewArtifactPath}`,
    ],
    actions: [],
    conditions: [
      {
        id: "owner-provider-auth-restored",
        type: "external.fact",
        subject: `credential:${input.provider}`,
        expected: { status: "valid", agent: ownerAgent },
        owner: "human",
        reviewAfterMs: 300_000,
      },
    ],
  };
}

function isOwnerResult(value: unknown): value is OwnerResult {
  const result = record(value);
  return (
    (result.state === "converged" || result.state === "waiting") &&
    typeof result.summary === "string" &&
    Array.isArray(result.evidence)
  );
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  if (!ctx.workspace || !ctx.reconciliation) {
    return ctx.blocked(
      "Platform owner review requires a bounded App workspace and reconciliation context",
    );
  }

  const appDir = ctx.workspace.appRoot;
  const projectDir = ctx.workspace.projectRoot;
  const eventId = triggerEventId(ctx);
  const trigger = triggerText(ctx);
  const packet = await buildReviewPacket(ctx);
  const packetPath = join(appDir, ".state", "review-packet.json");
  mkdirSync(dirname(packetPath), { recursive: true });
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf-8");

  const reviewArtifactPath = buildOwnerReviewArtifactPath(appDir, eventId);
  const reviewArtifactBase = {
    generated_at: new Date().toISOString(),
    trigger_event_id: eventId,
    packet_path: packetPath,
    owner_prompt_artifact_path: reviewArtifactPath,
    trigger_excerpt: trigger,
    reconciliation_task_id: ctx.reconciliation.taskId,
    owner_worklog: {
      required_before_speculative_edits: true,
      prompt:
        "After the first evidence checkpoint, write a 1-3 sentence interim note here before any speculative edit, broad repo search, or secondary investigation.",
      current_hypothesis: null,
      next_step: null,
      updated_at: null,
    },
  };
  writeOwnerReviewArtifact(reviewArtifactPath, {
    ...reviewArtifactBase,
    updated_at: new Date().toISOString(),
    status: "pending",
  });

  const prompt = buildOwnerPrompt({
    appDir,
    projectDir,
    packetPath,
    packetSummary: buildPacketSummary(packet),
    trigger,
    reviewArtifactPath,
  });
  const result = await ctx.agents.call(ownerAgent, prompt, {
    timeoutMs: 1_800_000,
    schema: taskOwnerResultSchema,
  });

  if (result.status !== "done") {
    const authFailure = classifyOwnerAuthFailure(result.summary);
    if (authFailure) {
      const ownerResult = authFailureOwnerResult({
        provider: authFailure.provider,
        detail: authFailure.detail,
        executionId: result.id,
        reviewArtifactPath,
      });
      writeOwnerReviewArtifact(reviewArtifactPath, {
        ...reviewArtifactBase,
        ...preservedOwnerProgress(reviewArtifactPath),
        updated_at: new Date().toISOString(),
        status: "waiting",
        owner_execution: {
          execution_id: result.id,
          status: result.status,
          summary: result.summary,
        },
        owner_result: ownerResult,
      });
      return ctx.done(ownerResult.summary, ownerResult);
    }
    writeOwnerReviewArtifact(reviewArtifactPath, {
      ...reviewArtifactBase,
      ...preservedOwnerProgress(reviewArtifactPath),
      updated_at: new Date().toISOString(),
      status: "blocked",
      owner_execution: {
        execution_id: result.id,
        status: result.status,
        summary: result.summary,
      },
    });
    return ctx.blocked("Platform owner review execution failed", {
      executionId: result.id,
      status: result.status,
      summary: result.summary,
      artifactPath: reviewArtifactPath,
    });
  }

  if (!isOwnerResult(result.output)) {
    writeOwnerReviewArtifact(reviewArtifactPath, {
      ...reviewArtifactBase,
      ...preservedOwnerProgress(reviewArtifactPath),
      updated_at: new Date().toISOString(),
      status: "blocked",
      owner_execution: {
        execution_id: result.id,
        status: result.status,
        summary: result.summary,
      },
    });
    return ctx.blocked(
      "Platform owner returned no typed reconciliation result",
      {
        executionId: result.id,
        artifactPath: reviewArtifactPath,
      },
    );
  }

  const ownerResult = normalizeOwnerResult(result.output);
  writeOwnerReviewArtifact(reviewArtifactPath, {
    ...reviewArtifactBase,
    ...preservedOwnerProgress(reviewArtifactPath),
    updated_at: new Date().toISOString(),
    status: ownerResult.state,
    owner_execution: {
      execution_id: result.id,
      status: result.status,
      summary: result.summary,
    },
    owner_result: ownerResult,
  });
  return ctx.done(ownerResult.summary, ownerResult);
}
