import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
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

function truncate(text: string, max = 1800): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function packetAbsolutePath(input: {
  appDir: string;
  projectDir: string;
  packetPath: string;
}): string | null {
  const raw = input.packetPath.trim();
  if (!raw) return null;

  const candidates = [
    raw,
    join(input.projectDir, raw),
    join(input.appDir, raw),
    resolve(input.appDir, raw),
    resolve(input.projectDir, raw),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function packetRepoPath(input: {
  projectDir: string;
  absolutePath: string;
}): string {
  const normalizedProject = `${resolve(input.projectDir)}/`;
  const normalizedPacket = resolve(input.absolutePath);
  if (normalizedPacket.startsWith(normalizedProject)) {
    return normalizedPacket.slice(normalizedProject.length);
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

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  const trigger = parseTriggerEvent(ctx.task);

  if (trigger?.type !== "project.approval.requested") {
    return ctx.done(
      `Approval dispatch ignored trigger ${String(trigger?.type ?? "unknown")}; use project.approval.requested.`,
    );
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
    return ctx.done(
      "Approval dispatch ignored: packetPath, pathId, and requestedAction are required.",
    );
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
    return ctx.done(
      `Approval dispatch ignored: packetPath ${packetPath} was not found under the app/domain workspace.`,
    );
  }

  const repoPacketPath = packetRepoPath({
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
    return ctx.done(
      `Approval dispatch ignored: packetPath ${packetPath} must resolve inside evidence/archive/.`,
    );
  }

  const content = [
    "AKS RP E2E approval packet dispatch",
    "",
    `Requested action: ${requestedAction}`,
    `Feature path: ${pathId}`,
    `Packet: ${repoPacketPath}`,
    `Reason: ${reason}`,
    summary ? "" : "",
    summary ? `Context: ${truncate(summary, 1200)}` : "",
    "",
    `Please review the exact packet at ${repoPacketPath} and reply through the normal human/operator channel if action is approved or adjusted.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    ctx.dispatchEvent("message.created", {
      target: { project: "aks-rp-e2e", human: true },
      from: sender,
      to: target,
      intent: "approval-packet-dispatch",
      project: "aks-rp-e2e",
      projectId: "projects/aks-rp-e2e.app",
      domainProjectId: "aks-rp-e2e",
      projectPath: "projects/aks-rp-e2e.app",
      priority: "P2",
      reason,
      requestedAction,
      pathId,
      packetPath: repoPacketPath,
      packetAbsolutePath: absolutePacketPath,
      summary: truncate(summary, 3000),
      content,
      evidence: {
        packetPath: repoPacketPath,
        packetAbsolutePath: absolutePacketPath,
        pathId,
        appTaskTree: "/app/projects/aks-rp-e2e.app/tasks/tree.json",
        projectState: "/app/projects/aks-rp-e2e.app/project.json",
      },
      dedupKey: `aks-rp-e2e:approval-dispatch:${pathId}:${requestedAction}:${repoPacketPath}`,
    });
  } catch {
    appendDispatchRun(appDir, {
      result: "dispatch-failed",
      packetPath: repoPacketPath,
      pathId,
      requestedAction,
    });
    return ctx.done(
      `Approval dispatch failed while emitting message.created for ${pathId}.`,
    );
  }

  appendDispatchRun(appDir, {
    result: "message.created",
    packetPath: repoPacketPath,
    packetAbsolutePath: absolutePacketPath,
    pathId,
    requestedAction,
    target,
  });

  return ctx.done(
    `Approval dispatch emitted message.created for ${pathId} using ${repoPacketPath}.`,
  );
}
