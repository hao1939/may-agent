import { dirname } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { appendDiscussionComment } from "../../../shared/lib/project-health.ts";

export const name = "project-creative-audit";

export const description =
  "Run a proposal-only May audit that looks for unknown project issues and writes suggestions for normal project review.";

type AuditRequest = {
  projectId: string;
  projectPath: string;
  projectDir: string;
  owner: string;
  status: string;
  trigger: string;
  selectionReason: string;
};

function extractJsonBlock(task: string, heading: string): Record<string, unknown> | null {
  const marker = `## ${heading}`;
  const idx = task.indexOf(marker);
  if (idx < 0) return null;
  const rest = task.slice(idx + marker.length);
  const fenced = rest.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (!fenced) return null;
  try {
    return JSON.parse(fenced) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseAuditRequest(task: string): AuditRequest | null {
  const data = extractJsonBlock(task, "Project Audit Request");
  if (!data) return null;
  const projectDir = typeof data.projectDir === "string" ? data.projectDir : "";
  const projectPath = typeof data.projectPath === "string" ? data.projectPath : "";
  const projectId = typeof data.projectId === "string" ? data.projectId : "";
  if (!projectDir || !projectPath || !projectId) return null;
  return {
    projectId,
    projectPath,
    projectDir,
    owner: typeof data.owner === "string" ? data.owner : "unknown",
    status: typeof data.status === "string" ? data.status : "unknown",
    trigger: typeof data.trigger === "string" ? data.trigger : "unknown",
    selectionReason: typeof data.selectionReason === "string" ? data.selectionReason : "selected for audit",
  };
}

function cleanSuggestion(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "No substantive suggestion was returned by the audit session.";
  return trimmed.length <= 5000 ? trimmed : `${trimmed.slice(0, 5000)}\n\n[truncated by project-creative-audit workflow]`;
}

function buildAgentTask(request: AuditRequest): string {
  return [
    "[project-creative-audit] Inspect this project for unknown issues.",
    "",
    "This is not a deterministic rule check. Think broadly and creatively, then return review notes.",
    "",
    "Boundaries:",
    "- Do not edit project files directly.",
    "- Do not create or change project tasks directly.",
    "- Do not mark the project blocked or closed.",
    "- Produce suggestions that the project owner can review in the normal loop.",
    "",
    "Suggested audit path:",
    "- Read project.md, discussion.md, journal.md, and recent outputs when they exist.",
    "- Check whether the current task/state is moving the project toward its stated goal.",
    "- Look for missing next actions, stale assumptions, contradictory evidence, untracked blockers, weak task decomposition, and misleading manual instructions.",
    "- Prefer concrete evidence paths and exact suggested changes.",
    "- If the project looks coherent, say so and explain the evidence.",
    "",
    "Return a concise review with:",
    "- Finding or observation",
    "- Evidence",
    "- Suggested owner action",
    "- Confidence",
    "",
    "## Project",
    JSON.stringify({
      projectId: request.projectId,
      projectPath: request.projectPath,
      projectDir: request.projectDir,
      owner: request.owner,
      status: request.status,
      trigger: request.trigger,
      selectionReason: request.selectionReason,
    }, null, 2),
  ].join("\n");
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const request = parseAuditRequest(ctx.task);
  if (!request) {
    return ctx.blocked("Project creative audit request is missing project metadata", {
      taskPreview: ctx.task.slice(0, 500),
    });
  }

  const result = await ctx.runAgent("may", buildAgentTask(request));
  const status = result.status ?? "done";
  if (status === "error") {
    return ctx.blocked("Project creative audit session failed", {
      projectId: request.projectId,
      projectPath: request.projectPath,
      sessionId: result.sessionId,
      summary: result.lastAssistantText,
    });
  }

  const comment = [
    "**Project creative audit suggestion**",
    "",
    "This is a proposal-only fallback review. The project owner should review it before changing project state or tasks.",
    "",
    `- Project: ${request.projectPath}`,
    `- Trigger: ${request.trigger}`,
    `- Selection reason: ${request.selectionReason}`,
    `- Audit session: ${result.sessionId}`,
    "",
    cleanSuggestion(result.lastAssistantText ?? ""),
  ].join("\n");

  appendDiscussionComment(request.projectDir, comment, "project-creative-audit");

  ctx.emit({
    type: "project.audit.suggested",
    projectId: request.projectId,
    projectPath: request.projectPath,
    owner: request.owner,
    source: "project-creative-audit",
    sessionId: result.sessionId,
  });

  ctx.dispatchEvent("project.nudge", {
    projectId: request.projectId,
    projectPath: request.projectPath,
    comment: true,
    source: "project-creative-audit",
  });

  return ctx.done(`Project creative audit suggestion appended for ${request.projectPath} from ${result.sessionId}.`);
}
