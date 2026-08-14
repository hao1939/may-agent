import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  resolveTaskTreePath,
  type ProjectAppTaskHandlerResult,
  type ProjectAppTaskVerificationContext,
  type ProjectAppTaskVerificationResult,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk/legacy";
import {
  field,
  parseReconciliationTaskPayload,
  parseTriggerEvent,
  resolveAppDir,
  triggerString,
  triggerValue,
} from "./lib/workflow-input.ts";

export const name = "approval-dispatch";
export const description =
  "Route a packet-linked decision to the declared project owner, escalating to a human only for an explicit human authority boundary.";

function finishApprovalDispatch(
  ctx: WorkflowContext,
  input: {
    state: "converged" | "needs-owner";
    summary: string;
    evidence: string[];
  },
): WorkflowResult {
  return ctx.done(
    input.summary,
    input.state === "converged"
      ? {
          state: input.state,
          summary: input.summary,
          evidence: input.evidence,
          actions: [],
        }
      : {
          state: input.state,
          summary: input.summary,
          evidence: input.evidence,
        },
  );
}

function truncate(text: string, max = 1800): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stableIdPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function approvalDispatchTaskInput(
  raw: string,
): Record<string, unknown> | null {
  const payload = parseReconciliationTaskPayload(raw);
  return recordValue(payload?.input);
}

function packetAbsolutePath(input: {
  appDir: string;
  projectDir: string;
  packetPath: string;
}): string | null {
  const raw = input.packetPath.trim();
  if (!raw) return null;

  const candidates = raw.startsWith("/")
    ? [
        raw,
        join(input.projectDir, raw),
        join(input.appDir, raw),
        resolve(input.appDir, raw),
        resolve(input.projectDir, raw),
      ]
    : [
        join(input.projectDir, raw),
        join(input.appDir, raw),
        resolve(input.appDir, raw),
        resolve(input.projectDir, raw),
        raw,
      ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function packetRepoPath(input: {
  appDir: string;
  projectDir: string;
  absolutePath: string;
}): string {
  const normalizedPacket = resolve(input.absolutePath);
  const roots = [input.projectDir, input.appDir].map((root) => resolve(root));

  for (const root of roots) {
    const relativePath = relative(root, normalizedPacket).replace(/\\/g, "/");
    if (
      relativePath &&
      relativePath !== "." &&
      !relativePath.startsWith("../") &&
      relativePath !== ".."
    ) {
      return relativePath;
    }
  }

  return normalizedPacket;
}

function appendDispatchRun(
  appDir: string,
  entry: Record<string, unknown>,
): void {
  const path = join(appDir, ".state", "approval-dispatch-runs.jsonl");
  mkdirSync(join(appDir, ".state"), { recursive: true });
  appendFileSync(
    path,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      workflow: "approval-dispatch",
      ...entry,
    })}\n`,
  );
}

function approvalDispatchLedgerPath(appDir: string): string {
  return join(appDir, ".state", "approval-dispatch-runs.jsonl");
}

type DispatchLedgerRow = {
  workflow?: unknown;
  result?: unknown;
  correlationKey?: unknown;
  packetAbsolutePath?: unknown;
  approvalId?: unknown;
  waitId?: unknown;
  pathId?: unknown;
};

function isTrustedDispatchLedgerRow(parsed: DispatchLedgerRow): boolean {
  if (
    parsed.workflow !== "approval-dispatch" ||
    !["message.created", "project.owner.requested"].includes(
      String(parsed.result),
    )
  ) {
    return false;
  }

  return (
    typeof parsed.packetAbsolutePath === "string" &&
    parsed.packetAbsolutePath.startsWith("/")
  );
}

function latestTrustedDispatchLedgerRow(input: {
  appDir: string;
  correlationKey: string;
}): DispatchLedgerRow | null {
  const path = approvalDispatchLedgerPath(input.appDir);
  if (!existsSync(path)) return null;

  try {
    const lines = readFileSync(path, "utf8").trim().split("\n");
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index]?.trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line) as DispatchLedgerRow;
        if (
          parsed.correlationKey === input.correlationKey &&
          isTrustedDispatchLedgerRow(parsed)
        ) {
          return parsed;
        }
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function approvalDispatchCorrelationKeyFromIntent(
  input: Record<string, unknown> | undefined,
): string {
  const approvalId = stringValue(input?.approvalId);
  if (approvalId.startsWith("aks-rp-e2e:approval:")) return approvalId;

  const pathId = stringValue(input?.pathId) || stringValue(input?.path_id);
  const packetPath =
    stringValue(input?.packetPath) || stringValue(input?.packet_path);
  if (!pathId || !packetPath) return "";

  return `aks-rp-e2e:approval:${stableIdPart(pathId)}:${stableIdPart(packetPath)}`;
}

function booleanFlag(value: unknown): boolean | null {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return null;
}

type QueryDatabase = {
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
  };
};

function isQueryDatabase(value: unknown): value is QueryDatabase {
  const candidate = recordValue(value);
  return typeof candidate?.prepare === "function";
}

function priorHumanDispatchRemainsDuplicateProof(
  ctx: WorkflowContext,
  input: {
    approvalId: string;
    waitId: string;
    pathId: string;
    correlationKey: string;
  },
): {
  suppress: boolean;
  reason: string;
} {
  try {
    const db = ctx.getDb?.();
    if (!isQueryDatabase(db)) {
      return {
        suppress: true,
        reason:
          "runtime-db-unavailable; preserve duplicate suppression rather than guessing delivery failure",
      };
    }

    const lineageParams = [
      input.approvalId,
      input.waitId,
      input.pathId,
      input.correlationKey,
    ];
    const notificationRow = db
      .prepare(
        `SELECT telegram_msg_id AS telegramMsgId
           FROM notification_messages
          WHERE json_extract(data, '$.approvalId') = ?
             OR json_extract(data, '$.waitId') = ?
             OR json_extract(data, '$.pathId') = ?
             OR json_extract(data, '$.correlationKey') = ?
          ORDER BY sent_at DESC, telegram_msg_id DESC
          LIMIT 1`,
      )
      .get(...lineageParams) as { telegramMsgId?: unknown } | undefined;
    if (notificationRow?.telegramMsgId !== undefined) {
      return {
        suppress: true,
        reason: `durable notification_messages proof still exists (${String(notificationRow.telegramMsgId)})`,
      };
    }

    const submittedRow = db
      .prepare(
        `SELECT id
           FROM events
          WHERE event_type = 'project.approval.submitted'
            AND (
              json_extract(data, '$.approvalId') = ?
              OR json_extract(data, '$.waitId') = ?
              OR json_extract(data, '$.pathId') = ?
              OR json_extract(data, '$.correlationKey') = ?
            )
          ORDER BY id DESC
          LIMIT 1`,
      )
      .get(...lineageParams) as { id?: unknown } | undefined;
    if (submittedRow?.id !== undefined) {
      return {
        suppress: true,
        reason: `project.approval.submitted already returned for this lineage (${String(submittedRow.id)})`,
      };
    }

    const messageRow = db
      .prepare(
        `SELECT id
           FROM events
          WHERE event_type = 'message.created'
            AND (
              json_extract(data, '$.approvalId') = ?
              OR json_extract(data, '$.waitId') = ?
              OR json_extract(data, '$.pathId') = ?
              OR json_extract(data, '$.correlationKey') = ?
            )
          ORDER BY id DESC
          LIMIT 1`,
      )
      .get(...lineageParams) as { id?: unknown } | undefined;
    const sourceEventId = Number(messageRow?.id);
    if (!Number.isFinite(sourceEventId)) {
      return {
        suppress: true,
        reason:
          "trusted ledger row exists but no matching runtime message.created row is currently queryable",
      };
    }

    const reviewRow = db
      .prepare(
        `SELECT id,
                json_extract(data, '$.delivered') AS delivered,
                json_extract(data, '$.admitted') AS admitted
           FROM events
          WHERE event_type = 'human.attention.reviewed'
            AND json_extract(data, '$.sourceEventId') = ?
          ORDER BY id DESC
          LIMIT 1`,
      )
      .get(sourceEventId) as
      | { id?: unknown; delivered?: unknown; admitted?: unknown }
      | undefined;
    const delivered = booleanFlag(reviewRow?.delivered);
    const admitted = booleanFlag(reviewRow?.admitted);
    if (
      reviewRow?.id !== undefined &&
      delivered === false &&
      admitted === false
    ) {
      return {
        suppress: false,
        reason: `human.attention.reviewed ${String(reviewRow.id)} verified non-delivery for message.created ${sourceEventId}`,
      };
    }

    return {
      suppress: true,
      reason:
        reviewRow?.id !== undefined
          ? `human dispatch still has a live return producer after review ${String(reviewRow.id)}`
          : `message.created ${sourceEventId} still stands as the live return producer for this lineage`,
    };
  } catch {
    return {
      suppress: true,
      reason:
        "runtime-db-query-failed; preserve duplicate suppression rather than guessing delivery failure",
    };
  }
}

function approvalDispatchVerificationInput(
  context: ProjectAppTaskVerificationContext,
): {
  pathId: string;
  packetPath: string;
  approvalId: string;
  waitId: string;
  correlationKey: string;
  requiresHumanDecision: boolean;
} | null {
  const taskInput = recordValue(context.intent.input);
  const pathId = stringValue(taskInput?.pathId) || stringValue(taskInput?.path_id);
  const packetPath =
    stringValue(taskInput?.packetPath) || stringValue(taskInput?.packet_path);
  if (!pathId || !packetPath) return null;

  const absolutePacketPath = packetAbsolutePath({
    appDir: context.appDir,
    projectDir: context.projectDir,
    packetPath,
  });
  if (!absolutePacketPath) return null;

  const repoPacketPath = packetRepoPath({
    appDir: context.appDir,
    projectDir: context.projectDir,
    absolutePath: absolutePacketPath,
  });
  const correlationKey = `aks-rp-e2e:approval:${stableIdPart(pathId)}:${stableIdPart(repoPacketPath)}`;
  const approvalId =
    stringValue(taskInput?.approvalId) ||
    stringValue(taskInput?.approval_id) ||
    correlationKey;
  const waitId =
    stringValue(taskInput?.waitId) ||
    stringValue(taskInput?.wait_id) ||
    `wait:${correlationKey}`;
  const authority = stringValue(taskInput?.authority).toLowerCase();
  const target = stringValue(taskInput?.target).toLowerCase();
  const requiresHumanDecision =
    taskInput?.requiresHumanDecision === true ||
    taskInput?.requires_human_decision === true ||
    authority === "human" ||
    target === "human" ||
    target === "human:operator";

  return {
    pathId,
    packetPath: repoPacketPath,
    approvalId,
    waitId,
    correlationKey,
    requiresHumanDecision,
  };
}

function approvalDispatchTextProof(
  verification: NonNullable<ReturnType<typeof approvalDispatchVerificationInput>>,
  result: ProjectAppTaskHandlerResult,
): boolean {
  const combined = [result.summary, ...result.evidence].join("\n");
  const required = [
    verification.pathId,
    verification.packetPath,
    verification.approvalId,
    verification.waitId,
    "project.approval.requested",
  ];
  if (!required.every((value) => combined.includes(value))) return false;
  if (verification.requiresHumanDecision) {
    return combined.includes("message.created");
  }
  return combined.includes("project.owner.requested");
}

export async function verify(
  context: ProjectAppTaskVerificationContext,
  result: ProjectAppTaskHandlerResult,
): Promise<ProjectAppTaskVerificationResult> {
  if (result.state !== "converged") {
    return {
      accepted: false,
      summary:
        "Approval dispatch owner handoff may converge only from a converged handler result.",
      evidence: [`handler-state:${result.state}`],
    };
  }

  const verification = approvalDispatchVerificationInput(context);
  if (!verification) {
    return {
      accepted: false,
      summary:
        "Approval dispatch verifier requires packetPath and pathId in the task input.",
      evidence: ["verification-finding:missing-approval-lineage"],
    };
  }

  const trustedLedger = latestTrustedDispatchLedgerRow({
    appDir: context.appDir,
    correlationKey: verification.correlationKey,
  });
  if (trustedLedger) {
    const expectedLedgerResult = verification.requiresHumanDecision
      ? "message.created"
      : "project.owner.requested";
    if (String(trustedLedger.result ?? "") !== expectedLedgerResult) {
      return {
        accepted: false,
        summary:
          `Approval dispatch verifier found ${String(trustedLedger.result ?? "unknown")} for ${verification.pathId}, but expected ${expectedLedgerResult}.`,
        evidence: [
          `approval-dispatch:${verification.correlationKey}`,
          `ledger-result:${String(trustedLedger.result ?? "unknown")}`,
          `expected-ledger-result:${expectedLedgerResult}`,
        ],
      };
    }

    return {
      accepted: true,
      summary:
        `Verified approval-dispatch handoff for ${verification.pathId} from durable ${expectedLedgerResult} proof.`,
      evidence: [
        `approval-dispatch:${verification.correlationKey}`,
        `ledger-result:${expectedLedgerResult}`,
        "deterministic:owner-handoff-postcondition",
      ],
    };
  }

  if (approvalDispatchTextProof(verification, result)) {
    return {
      accepted: true,
      summary:
        `Verified approval-dispatch handoff for ${verification.pathId} from exact owner-returned event proof.`,
      evidence: [
        `approval-dispatch:${verification.correlationKey}`,
        verification.requiresHumanDecision
          ? "event-proof:project.approval.requested+message.created"
          : "event-proof:project.approval.requested+project.owner.requested",
        "deterministic:owner-handoff-postcondition",
      ],
    };
  }

  return {
    accepted: false,
    summary:
      `Approval dispatch verifier could not confirm current send proof for ${verification.pathId}.`,
    evidence: [
      `approval-dispatch:${verification.correlationKey}`,
      `expected-packet:${verification.packetPath}`,
      `expected-approval:${verification.approvalId}`,
      `expected-wait:${verification.waitId}`,
    ],
  };
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir =
    ctx.projectDir ?? field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(
    projectDir,
    ctx.appDir ?? field(ctx.task, "app"),
  );
  const trigger = parseTriggerEvent(ctx.task);
  const taskInput = approvalDispatchTaskInput(ctx.task);
  const recoveredFromTaskTick =
    trigger?.type === "project.task.tick" && Boolean(taskInput);

  if (
    trigger?.type !== "project.approval.requested" &&
    !recoveredFromTaskTick
  ) {
    return finishApprovalDispatch(ctx, {
      state: "needs-owner",
      summary: `Approval dispatch ignored trigger ${String(trigger?.type ?? "unknown")}; use project.approval.requested.`,
      evidence: ["approval-dispatch:invalid-trigger"],
    });
  }

  const packetPath =
    triggerString(trigger, "packetPath") ||
    triggerString(trigger, "packet_path") ||
    stringValue(triggerValue(trigger, "packetPath")) ||
    stringValue(triggerValue(trigger, "packet_path")) ||
    stringValue(taskInput?.packetPath) ||
    stringValue(taskInput?.packet_path);
  const pathId =
    triggerString(trigger, "pathId") ||
    triggerString(trigger, "path_id") ||
    stringValue(triggerValue(trigger, "pathId")) ||
    stringValue(triggerValue(trigger, "path_id")) ||
    stringValue(taskInput?.pathId) ||
    stringValue(taskInput?.path_id);
  const requestedAction =
    triggerString(trigger, "requestedAction") ||
    triggerString(trigger, "requested_action") ||
    stringValue(triggerValue(trigger, "requestedAction")) ||
    stringValue(triggerValue(trigger, "requested_action")) ||
    stringValue(taskInput?.requestedAction) ||
    stringValue(taskInput?.requested_action);
  const reason =
    triggerString(trigger, "reason") ||
    stringValue(triggerValue(trigger, "reason")) ||
    stringValue(taskInput?.reason) ||
    "Approval packet dispatch requested";
  const summary =
    triggerString(trigger, "summary") ||
    stringValue(triggerValue(trigger, "summary")) ||
    stringValue(taskInput?.summary);
  const target =
    triggerString(trigger, "target") ||
    stringValue(triggerValue(trigger, "target")) ||
    stringValue(taskInput?.target) ||
    "owner";
  const authority =
    triggerString(trigger, "authority") ||
    stringValue(triggerValue(trigger, "authority")) ||
    stringValue(taskInput?.authority);
  const requiresHumanDecision =
    triggerValue(trigger, "requiresHumanDecision") === true ||
    triggerValue(trigger, "requires_human_decision") === true ||
    taskInput?.requiresHumanDecision === true ||
    taskInput?.requires_human_decision === true ||
    authority.toLowerCase() === "human";
  const deliveryTarget =
    requiresHumanDecision && target === "owner" ? "human" : target;
  const explicitApprovalId =
    triggerString(trigger, "approvalId") ||
    triggerString(trigger, "approval_id") ||
    stringValue(triggerValue(trigger, "approvalId")) ||
    stringValue(triggerValue(trigger, "approval_id")) ||
    stringValue(taskInput?.approvalId) ||
    stringValue(taskInput?.approval_id);
  const explicitWaitId =
    triggerString(trigger, "waitId") ||
    triggerString(trigger, "wait_id") ||
    stringValue(triggerValue(trigger, "waitId")) ||
    stringValue(triggerValue(trigger, "wait_id")) ||
    stringValue(taskInput?.waitId) ||
    stringValue(taskInput?.wait_id);
  const sender =
    field(ctx.task, "owner") ?? field(ctx.task, "agent") ?? ctx.agent;

  if (!packetPath || !pathId || !requestedAction) {
    appendDispatchRun(appDir, {
      result: "ignored",
      reason: "missing-required-fields",
      packetPath,
      pathId,
      requestedAction,
    });
    return finishApprovalDispatch(ctx, {
      state: "needs-owner",
      summary:
        "Approval dispatch ignored: packetPath, pathId, and requestedAction are required.",
      evidence: ["approval-dispatch:missing-required-fields"],
    });
  }

  const absolutePacketPath = packetAbsolutePath({
    appDir,
    projectDir,
    packetPath,
  });
  if (!absolutePacketPath) {
    appendDispatchRun(appDir, {
      result: "ignored",
      reason: "packet-not-found",
      packetPath,
      pathId,
      requestedAction,
    });
    return finishApprovalDispatch(ctx, {
      state: "needs-owner",
      summary: `Approval dispatch ignored: packetPath ${packetPath} was not found under the app/domain workspace.`,
      evidence: [`approval-dispatch:${pathId}:packet-not-found`],
    });
  }

  const repoPacketPath = packetRepoPath({
    appDir,
    projectDir,
    absolutePath: absolutePacketPath,
  });

  if (!repoPacketPath.startsWith("evidence/archive/")) {
    appendDispatchRun(appDir, {
      result: "ignored",
      reason: "packet-outside-evidence-archive",
      packetPath,
      absolutePacketPath,
      pathId,
      requestedAction,
    });
    return finishApprovalDispatch(ctx, {
      state: "needs-owner",
      summary: `Approval dispatch ignored: packetPath ${packetPath} must resolve inside evidence/archive/.`,
      evidence: [`approval-dispatch:${pathId}:packet-outside-evidence-archive`],
    });
  }

  const correlationKey = `aks-rp-e2e:approval:${stableIdPart(pathId)}:${stableIdPart(repoPacketPath)}`;
  const approvalId = explicitApprovalId || correlationKey;
  const waitId = explicitWaitId || `wait:${correlationKey}`;
  const priorDispatch = latestTrustedDispatchLedgerRow({
    appDir,
    correlationKey,
  });
  if (priorDispatch) {
    const priorResult = String(priorDispatch.result ?? "");
    const duplicateDisposition =
      priorResult === "project.owner.requested"
        ? {
            suppress: true,
            reason:
              "prior project.owner.requested routing already owns this approval lineage",
          }
        : priorHumanDispatchRemainsDuplicateProof(ctx, {
            approvalId,
            waitId,
            pathId,
            correlationKey,
          });
    if (duplicateDisposition.suppress) {
      appendDispatchRun(appDir, {
        result: "duplicate-suppressed",
        packetPath: repoPacketPath,
        packetAbsolutePath: absolutePacketPath,
        pathId,
        requestedAction,
        approvalId,
        waitId,
        correlationKey,
        duplicateReason: duplicateDisposition.reason,
      });
      return finishApprovalDispatch(ctx, {
        state: "converged",
        summary: `Approval dispatch suppressed duplicate message.created for ${pathId} using ${repoPacketPath}.`,
        evidence: [
          `approval-dispatch:${correlationKey}`,
          `approval-dispatch:duplicate-proof:${duplicateDisposition.reason}`,
        ],
      });
    }
  }

  const expectedResponse = {
    type: "project.approval.submitted",
    target: { project: "aks-rp-e2e" },
    approvalKind: "approval-packet-dispatch",
    approvalId,
    waitId,
    pathId,
    packetPath: repoPacketPath,
    acceptedDecisions: ["approve", "adjust", "hold", "decline", "reroute"],
  };
  const resumeCondition =
    "Resume the linked wait when project.approval.submitted carries this approvalId or waitId with a bounded decision.";
  const approval = {
    kind: "approval-packet-dispatch",
    approvalId,
    waitId,
    pathId,
    packetPath: repoPacketPath,
    question: `Review the approval packet for ${pathId} and choose one bounded decision.`,
    options: [
      {
        id: "approve",
        label: "Approve",
        effect:
          "Accept the exact requested action and let planner/app-ops continue.",
      },
      {
        id: "adjust",
        label: "Adjust",
        effect:
          "Accept the request with bounded changes; planner/app-ops must use the returned adjustments.",
      },
      {
        id: "hold",
        label: "Hold",
        effect:
          "Keep the linked wait blocked for now while preserving the same approval lineage.",
      },
      {
        id: "decline",
        label: "Decline",
        effect:
          "Reject the current ask so planner/app-ops can record the exact terminal or replacement reason.",
      },
      {
        id: "reroute",
        label: "Reroute",
        effect:
          "Return the exact replacement owner/surface that should take over this approval lineage.",
      },
    ],
    directEvent: {
      type: "project.approval.submitted",
      project: "aks-rp-e2e",
      projectPath: "projects/aks-rp-e2e.app",
      approvalKind: "approval-packet-dispatch",
      approvalId,
      waitId,
      pathId,
      packetPath: repoPacketPath,
    },
  };

  if (!requiresHumanDecision) {
    try {
      ctx.dispatchEvent("project.owner.requested", {
        target: { project: "aks-rp-e2e" },
        project: "aks-rp-e2e",
        reason: "approval-owner-routing",
        params: {
          packetPath: repoPacketPath,
          packetAbsolutePath: absolutePacketPath,
          pathId,
          requestedAction,
          summary,
          approval,
          approvalId,
          waitId,
          correlationKey,
          expectedResponse,
          resumeCondition,
          instruction:
            "Handle this decision under the ownership convention. Investigate and return the bounded project.approval.submitted result yourself. Escalate to Hao only if the remaining choice requires human authority or preference, and include that exact decision and proof.",
        },
      });
    } catch {
      appendDispatchRun(appDir, {
        result: "dispatch-failed",
        route: "project-owner",
        packetPath: repoPacketPath,
        pathId,
        requestedAction,
      });
      return finishApprovalDispatch(ctx, {
        state: "needs-owner",
        summary: `Approval dispatch failed while routing ${pathId} to the declared project owner.`,
        evidence: [`approval-dispatch:${correlationKey}:owner-dispatch-failed`],
      });
    }

    appendDispatchRun(appDir, {
      result: "project.owner.requested",
      route: "project-owner",
      packetPath: repoPacketPath,
      packetAbsolutePath: absolutePacketPath,
      pathId,
      requestedAction,
      approvalId,
      waitId,
      correlationKey,
      expectedResponse,
      resumeCondition,
    });

    return finishApprovalDispatch(ctx, {
      state: "converged",
      summary: `Approval dispatch routed ${pathId} to the declared AKS project owner; no human message was emitted.`,
      evidence: [`approval-dispatch:${correlationKey}:project-owner`],
    });
  }

  const content = [
    "AKS RP E2E approval packet dispatch",
    "",
    `Approval id: ${approvalId}`,
    `Wait id: ${waitId}`,
    `Requested action: ${requestedAction}`,
    `Feature path: ${pathId}`,
    `Packet: ${repoPacketPath}`,
    `Reason: ${reason}`,
    summary ? "" : "",
    summary ? `Context: ${truncate(summary, 1200)}` : "",
    "",
    "Reply to this notification with one bounded decision: approve, adjust <changes>, hold, decline, or reroute.",
    "That reply should emit project.approval.submitted carrying the approval id or wait id above.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    ctx.dispatchEvent("message.created", {
      target: { project: "aks-rp-e2e", human: true },
      from: sender,
      to: deliveryTarget,
      content,
      priority: "P2",
      intent: "approval-packet-dispatch",
      project: "aks-rp-e2e",
      projectId: "projects/aks-rp-e2e.app",
      domainProjectId: "aks-rp-e2e",
      projectPath: "projects/aks-rp-e2e.app",
      reason,
      requestedAction,
      approval,
      approvalId,
      waitId,
      correlationKey,
      pathId,
      packetPath: repoPacketPath,
      packetAbsolutePath: absolutePacketPath,
      expectedResponse,
      resumeCondition,
      summary: truncate(summary, 3000),
      evidence: {
        packetPath: repoPacketPath,
        packetAbsolutePath: absolutePacketPath,
        pathId,
        appTaskTree: resolveTaskTreePath(appDir),
        projectState: join(appDir, ".state", "project-state.json"),
      },
      dedupKey: correlationKey,
    });
  } catch {
    appendDispatchRun(appDir, {
      result: "dispatch-failed",
      packetPath: repoPacketPath,
      pathId,
      requestedAction,
    });
    return finishApprovalDispatch(ctx, {
      state: "needs-owner",
      summary: `Approval dispatch failed while emitting message.created for ${pathId}.`,
      evidence: [`approval-dispatch:${correlationKey}:dispatch-failed`],
    });
  }

  appendDispatchRun(appDir, {
    result: "message.created",
    packetPath: repoPacketPath,
    packetAbsolutePath: absolutePacketPath,
    pathId,
    requestedAction,
    approvalId,
    waitId,
    correlationKey,
    expectedResponse,
    resumeCondition,
    target: deliveryTarget,
  });

  return finishApprovalDispatch(ctx, {
    state: "converged",
    summary: `Approval dispatch emitted message.created for ${pathId} using ${repoPacketPath}.`,
    evidence: [`approval-dispatch:${correlationKey}`],
  });
}
