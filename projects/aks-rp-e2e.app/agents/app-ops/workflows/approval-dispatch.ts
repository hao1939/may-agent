import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  resolveTaskTreePath,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  field,
  parseTriggerEvent,
  resolveAppDir,
  triggerString,
  triggerValue,
} from "./lib/workflow-input.ts";

export const name = "approval-dispatch";
export const description =
  "Emit a packet-linked human-facing approval message for an exact approval ask.";

function finishApprovalDispatch(
  ctx: WorkflowContext,
  input: {
    state: "converged" | "needs-owner";
    summary: string;
    evidence: string[];
  },
): WorkflowResult {
  return ctx.done(input.summary, {
    state: input.state,
    summary: input.summary,
    evidence: input.evidence,
    actions: [],
  });
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

function isTrustedDispatchLedgerRow(parsed: {
  workflow?: unknown;
  result?: unknown;
  correlationKey?: unknown;
  packetAbsolutePath?: unknown;
}): boolean {
  if (
    parsed.workflow !== "approval-dispatch" ||
    parsed.result !== "message.created"
  ) {
    return false;
  }

  return (
    typeof parsed.packetAbsolutePath === "string" &&
    parsed.packetAbsolutePath.startsWith("/")
  );
}

function hasPriorDispatchForCorrelation(input: {
  appDir: string;
  correlationKey: string;
}): boolean {
  const path = approvalDispatchLedgerPath(input.appDir);
  if (!existsSync(path)) return false;

  try {
    const lines = readFileSync(path, "utf8").trim().split("\n");
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index]?.trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line) as {
          workflow?: unknown;
          result?: unknown;
          correlationKey?: unknown;
          packetAbsolutePath?: unknown;
        };
        if (
          parsed.correlationKey === input.correlationKey &&
          isTrustedDispatchLedgerRow(parsed)
        ) {
          return true;
        }
      } catch {
        continue;
      }
    }
  } catch {
    return false;
  }

  return false;
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  const trigger = parseTriggerEvent(ctx.task);

  if (trigger?.type !== "project.approval.requested") {
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
    stringValue(triggerValue(trigger, "packet_path"));
  const pathId =
    triggerString(trigger, "pathId") ||
    triggerString(trigger, "path_id") ||
    stringValue(triggerValue(trigger, "pathId")) ||
    stringValue(triggerValue(trigger, "path_id"));
  const requestedAction =
    triggerString(trigger, "requestedAction") ||
    triggerString(trigger, "requested_action") ||
    stringValue(triggerValue(trigger, "requestedAction")) ||
    stringValue(triggerValue(trigger, "requested_action"));
  const reason =
    triggerString(trigger, "reason") ||
    stringValue(triggerValue(trigger, "reason")) ||
    "Approval packet dispatch requested";
  const summary =
    triggerString(trigger, "summary") ||
    stringValue(triggerValue(trigger, "summary"));
  const target =
    triggerString(trigger, "target") ||
    stringValue(triggerValue(trigger, "target")) ||
    "human";
  const explicitApprovalId =
    triggerString(trigger, "approvalId") ||
    triggerString(trigger, "approval_id") ||
    stringValue(triggerValue(trigger, "approvalId")) ||
    stringValue(triggerValue(trigger, "approval_id"));
  const explicitWaitId =
    triggerString(trigger, "waitId") ||
    triggerString(trigger, "wait_id") ||
    stringValue(triggerValue(trigger, "waitId")) ||
    stringValue(triggerValue(trigger, "wait_id"));
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
  if (
    hasPriorDispatchForCorrelation({
      appDir,
      correlationKey,
    })
  ) {
    appendDispatchRun(appDir, {
      result: "duplicate-suppressed",
      packetPath: repoPacketPath,
      packetAbsolutePath: absolutePacketPath,
      pathId,
      requestedAction,
      correlationKey,
      duplicateReason:
        "prior approval-dispatch ledger row already emitted message.created for this correlationKey",
    });
    return finishApprovalDispatch(ctx, {
      state: "converged",
      summary: `Approval dispatch suppressed duplicate message.created for ${pathId} using ${repoPacketPath}.`,
      evidence: [`approval-dispatch:${correlationKey}`],
    });
  }

  const approvalId = explicitApprovalId || correlationKey;
  const waitId = explicitWaitId || `wait:${correlationKey}`;
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
      to: target,
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
    target,
  });

  return finishApprovalDispatch(ctx, {
    state: "converged",
    summary: `Approval dispatch emitted message.created for ${pathId} using ${repoPacketPath}.`,
    evidence: [`approval-dispatch:${correlationKey}`],
  });
}
