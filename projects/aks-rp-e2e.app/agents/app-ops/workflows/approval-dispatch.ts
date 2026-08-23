import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import type {
  AppEvent,
  ExecutionResult,
  TaskReconcileResult,
  TaskVerificationContext,
  TaskVerificationResult,
  WorkflowContext,
} from "@may-agent/sdk";
import {
  parseTriggerEvent,
  triggerString,
  triggerValue,
} from "./lib/workflow-input.ts";

export const name = "approval-dispatch";
export const description =
  "Route one packet-linked decision through the owning task, using durable human delivery only for an explicit human authority boundary.";

type ApprovalInput = {
  pathId: string;
  packetPath: string;
  requestedAction: string;
  reason: string;
  summary: string;
  target: string;
  approvalId: string;
  waitId: string;
  correlationKey: string;
  requiresHumanDecision: boolean;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
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

function truncate(value: string, max = 1800): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function authoredInput(ctx: WorkflowContext): Record<string, unknown> {
  return record(ctx.reconciliation?.input ?? ctx.input);
}

function value(
  trigger: ReturnType<typeof parseTriggerEvent>,
  input: Record<string, unknown>,
  ...names: string[]
): unknown {
  for (const name of names) {
    const fromTrigger = triggerValue(trigger, name);
    if (
      fromTrigger !== undefined &&
      fromTrigger !== null &&
      fromTrigger !== ""
    ) {
      return fromTrigger;
    }
    if (
      input[name] !== undefined &&
      input[name] !== null &&
      input[name] !== ""
    ) {
      return input[name];
    }
  }
  return undefined;
}

function within(root: string, candidate: string): boolean {
  const path = relative(resolve(root), resolve(candidate));
  return (
    path === "" ||
    (path !== ".." &&
      !path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`))
  );
}

function packetAbsolutePath(input: {
  appDir: string;
  projectDir: string;
  packetPath: string;
}): string | null {
  const roots = [resolve(input.projectDir), resolve(input.appDir)];
  const candidates = input.packetPath.startsWith("/")
    ? [resolve(input.packetPath)]
    : roots.map((root) => resolve(root, input.packetPath));
  for (const candidate of candidates) {
    if (
      roots.some((root) => within(root, candidate)) &&
      existsSync(candidate)
    ) {
      return candidate;
    }
  }
  return null;
}

function packetRepoPath(input: {
  appDir: string;
  projectDir: string;
  absolutePath: string;
}): string {
  for (const root of [input.projectDir, input.appDir]) {
    if (!within(root, input.absolutePath)) continue;
    const path = relative(resolve(root), resolve(input.absolutePath)).replace(
      /\\/g,
      "/",
    );
    if (path) return path;
  }
  return "";
}

function parsedApprovalInput(
  ctx: WorkflowContext,
  packetPath: string,
): Omit<
  ApprovalInput,
  "packetPath" | "approvalId" | "waitId" | "correlationKey"
> | null {
  const trigger = parseTriggerEvent(ctx);
  const input = authoredInput(ctx);
  const pathId = text(value(trigger, input, "pathId", "path_id"));
  const requestedAction = text(
    value(trigger, input, "requestedAction", "requested_action"),
  );
  if (!packetPath || !pathId || !requestedAction) return null;
  const authority = text(value(trigger, input, "authority")).toLowerCase();
  const target = text(value(trigger, input, "target")) || "owner";
  return {
    pathId,
    requestedAction,
    reason:
      text(value(trigger, input, "reason")) ||
      "Approval packet dispatch requested",
    summary: text(value(trigger, input, "summary")),
    target,
    requiresHumanDecision:
      value(
        trigger,
        input,
        "requiresHumanDecision",
        "requires_human_decision",
      ) === true ||
      authority === "human" ||
      target === "human" ||
      target === "human:operator",
  };
}

function finish(
  ctx: WorkflowContext,
  state: TaskReconcileResult["state"],
  summary: string,
  evidence: string[],
): ExecutionResult<TaskReconcileResult> {
  return ctx.done(summary, {
    state,
    summary,
    evidence,
    ...(state === "converged" ? { actions: [] } : {}),
  });
}

function approvalMetadata(input: ApprovalInput) {
  return {
    kind: "approval-packet-dispatch",
    approvalId: input.approvalId,
    waitId: input.waitId,
    pathId: input.pathId,
    packetPath: input.packetPath,
    question: `Review the approval packet for ${input.pathId} and choose one bounded decision.`,
    options: [
      {
        id: "approve",
        label: "Approve",
        effect: "Accept the exact requested action and let app-ops continue.",
      },
      {
        id: "adjust",
        label: "Adjust",
        effect: "Accept the request with bounded changes.",
      },
      {
        id: "hold",
        label: "Hold",
        effect: "Keep the linked wait blocked while preserving this lineage.",
      },
      {
        id: "decline",
        label: "Decline",
        effect: "Reject the current request with an exact reason.",
      },
      {
        id: "reroute",
        label: "Reroute",
        effect: "Name the exact replacement owner for this lineage.",
      },
    ],
    directEvent: {
      type: "project.approval.submitted",
      project: "aks-rp-e2e",
      projectPath: "projects/aks-rp-e2e.app",
      approvalKind: "approval-packet-dispatch",
      approvalId: input.approvalId,
      waitId: input.waitId,
      pathId: input.pathId,
      packetPath: input.packetPath,
    },
  };
}

function lineageEvidence(input: ApprovalInput): string[] {
  return [
    `approval-dispatch:${input.correlationKey}`,
    `approval-id:${input.approvalId}`,
    `wait-id:${input.waitId}`,
    `path-id:${input.pathId}`,
    `packet:${input.packetPath}`,
  ];
}

export async function execute(
  ctx: WorkflowContext,
): Promise<ExecutionResult<TaskReconcileResult>> {
  const appDir = ctx.workspace?.appRoot;
  const projectDir = ctx.workspace?.projectRoot;
  if (!appDir || !projectDir) {
    throw new Error(
      "approval-dispatch requires App and project workspace roots",
    );
  }
  const trigger = parseTriggerEvent(ctx);
  const input = authoredInput(ctx);
  const packetPath = text(value(trigger, input, "packetPath", "packet_path"));
  const parsed = parsedApprovalInput(ctx, packetPath);
  if (!parsed) {
    return finish(
      ctx,
      "needs-agent",
      "Approval dispatch requires packetPath, pathId, and requestedAction.",
      ["approval-dispatch:missing-required-fields"],
    );
  }

  const absolutePacketPath = packetAbsolutePath({
    appDir,
    projectDir,
    packetPath,
  });
  if (!absolutePacketPath) {
    return finish(
      ctx,
      "needs-agent",
      `Approval dispatch packet ${packetPath} was not found inside the bounded App or project workspace.`,
      [`approval-dispatch:${parsed.pathId}:packet-not-found`],
    );
  }
  const repoPacketPath = packetRepoPath({
    appDir,
    projectDir,
    absolutePath: absolutePacketPath,
  });
  if (!repoPacketPath.startsWith("evidence/archive/")) {
    return finish(
      ctx,
      "needs-agent",
      `Approval dispatch packet ${packetPath} must resolve inside evidence/archive/.`,
      [`approval-dispatch:${parsed.pathId}:packet-outside-evidence-archive`],
    );
  }

  const correlationKey = `aks-rp-e2e:approval:${stableIdPart(parsed.pathId)}:${stableIdPart(repoPacketPath)}`;
  const approvalId =
    text(value(trigger, input, "approvalId", "approval_id")) || correlationKey;
  const waitId =
    text(value(trigger, input, "waitId", "wait_id")) ||
    `wait:${correlationKey}`;
  const approval: ApprovalInput = {
    ...parsed,
    packetPath: repoPacketPath,
    approvalId,
    waitId,
    correlationKey,
  };

  if (!approval.requiresHumanDecision) {
    const summary =
      `Approval ${approval.pathId} requires bounded project-owner judgment for ${approval.requestedAction}. ` +
      `Review ${approval.packetPath} and return approve, adjust, hold, decline, or reroute under approval ${approval.approvalId}.`;
    return finish(ctx, "needs-agent", summary, [
      ...lineageEvidence(approval),
      "owner-handoff:approval-dispatch",
    ]);
  }

  const content = [
    "AKS RP E2E approval packet dispatch",
    "",
    `Approval id: ${approval.approvalId}`,
    `Wait id: ${approval.waitId}`,
    `Requested action: ${approval.requestedAction}`,
    `Feature path: ${approval.pathId}`,
    `Packet: ${approval.packetPath}`,
    `Reason: ${approval.reason}`,
    approval.summary ? `Context: ${truncate(approval.summary, 1200)}` : "",
    "",
    "Reply with one bounded decision: approve, adjust <changes>, hold, decline, or reroute.",
  ]
    .filter(Boolean)
    .join("\n");
  await ctx.events.emit({
    type: "message.created",
    source: "workflow:approval-dispatch",
    target: { appId: "aks-rp-e2e", project: "aks-rp-e2e", human: true },
    data: {
      from: ctx.reconciliation?.agent ?? "app-ops",
      to: approval.target === "owner" ? "human" : approval.target,
      content,
      priority: "P2",
      intent: "approval-packet-dispatch",
      project: "aks-rp-e2e",
      projectId: "projects/aks-rp-e2e.app",
      projectPath: "projects/aks-rp-e2e.app",
      reason: approval.reason,
      requestedAction: approval.requestedAction,
      approval: approvalMetadata(approval),
      approvalId: approval.approvalId,
      waitId: approval.waitId,
      correlationKey: approval.correlationKey,
      pathId: approval.pathId,
      packetPath: approval.packetPath,
      summary: truncate(approval.summary, 3000),
      resumeCondition:
        "Resume the linked wait when project.approval.submitted carries this approvalId or waitId with a bounded decision.",
      dedupKey: approval.correlationKey,
      idempotencyKey: approval.correlationKey,
    },
  } satisfies AppEvent<Record<string, unknown>>);

  const summary = `Approval dispatch durably emitted message.created for ${approval.pathId} using ${approval.packetPath}.`;
  return finish(ctx, "converged", summary, [
    ...lineageEvidence(approval),
    "event:message.created",
  ]);
}

function verificationInput(
  context: TaskVerificationContext,
): ApprovalInput | null {
  const input = record(context.intent.input);
  const pathId = text(input.pathId ?? input.path_id);
  const packetPath = text(input.packetPath ?? input.packet_path);
  const requestedAction = text(input.requestedAction ?? input.requested_action);
  if (!pathId || !packetPath || !requestedAction) return null;
  const correlationKey = `aks-rp-e2e:approval:${stableIdPart(pathId)}:${stableIdPart(packetPath)}`;
  const approvalId =
    text(input.approvalId ?? input.approval_id) || correlationKey;
  const waitId =
    text(input.waitId ?? input.wait_id) || `wait:${correlationKey}`;
  const authority = text(input.authority).toLowerCase();
  const target = text(input.target) || "owner";
  return {
    pathId,
    packetPath,
    requestedAction,
    reason: text(input.reason),
    summary: text(input.summary),
    target,
    approvalId,
    waitId,
    correlationKey,
    requiresHumanDecision:
      input.requiresHumanDecision === true ||
      input.requires_human_decision === true ||
      authority === "human" ||
      target === "human" ||
      target === "human:operator",
  };
}

export async function verify(
  context: TaskVerificationContext,
  result: TaskReconcileResult,
): Promise<TaskVerificationResult> {
  if (result.state !== "converged") {
    return {
      accepted: false,
      summary:
        "Approval dispatch can be accepted only from a converged result.",
      evidence: [`handler-state:${result.state}`],
    };
  }
  const input = verificationInput(context);
  if (!input) {
    return {
      accepted: false,
      summary:
        "Approval dispatch verification requires packetPath, pathId, and requestedAction.",
      evidence: ["verification-finding:missing-approval-lineage"],
    };
  }
  const proof = [result.summary, ...result.evidence].join("\n");
  const required = [
    input.pathId,
    input.packetPath,
    input.approvalId,
    input.waitId,
  ];
  const routeProof = input.requiresHumanDecision
    ? "event:message.created"
    : "owner-handoff:approval-dispatch";
  const accepted =
    required.every((value) => proof.includes(value)) &&
    proof.includes(routeProof);
  return accepted
    ? {
        accepted: true,
        summary: `Verified approval dispatch for ${input.pathId} from exact durable route evidence.`,
        evidence: [`approval-dispatch:${input.correlationKey}`, routeProof],
      }
    : {
        accepted: false,
        summary: `Approval dispatch verification could not confirm exact route proof for ${input.pathId}.`,
        evidence: [
          `approval-dispatch:${input.correlationKey}`,
          `expected-route:${routeProof}`,
        ],
      };
}
