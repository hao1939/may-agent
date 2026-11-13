import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

type StepDoneEvent = Extract<WorkflowGuardEvent, { type: "step_done" }>;
type FinishResult = NonNullable<StepDoneEvent["result"]["finishResult"]>;

/**
 * finish-guard — FM-3.4 Persistent-Task Enforcement.
 *
 * Blocks workflow steps that finish(success) when the task required
 * persistent-task workflow usage but the agent worked inline instead.
 *
 * Evidence: EXP-188 confirmed +100pp (0% → 100%) adoption with this guard.
 * Without it, agents read the instruction, work inline, and skip the workflow.
 *
 * Detection contract:
 * - Task explicitly requests the persistent-task workflow → required
 * - Result messages contain a workflow.run("persistent-task") call → satisfied
 *
 * Fail-open: only blocks finish(success). Other statuses pass through.
 */

/**
 * Check if the task text indicates persistent-task workflow is required.
 */
function isPersistentTaskRequired(taskText: string): boolean {
  if (!taskText) return false;
  const lower = taskText.toLowerCase();

  if (/workflow\.run\(\s*["']persistent-task["']/.test(lower)) return true;

  const request = /\b(?:run|use|invoke|start)\s+(?:the\s+)?persistent-task(?:\s+workflow)?\b/g;
  for (const match of lower.matchAll(request)) {
    const prefix = lower.slice(Math.max(0, match.index - 16), match.index);
    if (!/(?:do not|don't|must not|should not|need not|never)\s*$/.test(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if persistent-task workflow was actually invoked during the step.
 * Scans messages for workflow.run tool calls with "persistent-task".
 */
function wasPersistentTaskRun(result: any): boolean {
  // Check messages for workflow tool calls
  for (const msg of result?.messages ?? []) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      // Check for workflow.run tool call
      if (part.type === "toolCall" && part.name === "workflow") {
        const args = part.arguments;
        if (args?.action === "run" && args?.name === "persistent-task") {
          return true;
        }
      }
      // Also check tool_use blocks (different message formats)
      if (part.type === "tool_use" && part.name === "workflow") {
        const input = part.input;
        if (input?.action === "run" && input?.name === "persistent-task") {
          return true;
        }
      }
    }
  }

  return false;
}

// ── Shared worktree dirt warning ───────────────────────────────────

function normalizeStatusPath(line: string): string {
  const porcelain = line.match(/^.. (.+)$/);
  if (porcelain) return porcelain[1].trim();
  return line.replace(/^[ MARCUD?!]{1,2}\s+/, "").trim();
}

function normalizeAgentRepoPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .replace(/^\/app\/agents\//, "")
    .replace(/^\/app\//, "")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");

  if (normalized.startsWith("agents/")) return normalized.slice("agents/".length);
  if (normalized.startsWith("shared/") || normalized.startsWith(".lab/") || normalized.startsWith("gym/") || /^[^/]+\//.test(normalized)) {
    return normalized;
  }
  return undefined;
}

function stripShellTokenQuotes(token: string): string {
  const trimmed = token.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function extractBashWritePaths(command: string): string[] {
  const paths: string[] = [];
  const add = (raw: string | undefined) => {
    const normalized = normalizeAgentRepoPath(stripShellTokenQuotes(raw ?? ""));
    if (normalized) paths.push(normalized);
  };

  const redirectPattern = /(?:^|[\s;&|])(?:\d?>|>>)\s*(['"]?)([^'"\s;&|]+)\1/g;
  for (const match of command.matchAll(redirectPattern)) add(match[2]);

  const teePattern = /(?:^|[\s;&|])tee(?:\s+-a)?(?:\s+--)?\s+(['"]?)([^'"\s;&|]+)\1/g;
  for (const match of command.matchAll(teePattern)) add(match[2]);

  const copyMovePattern = /(?:^|[\s;&|])(?:cp|mv)(?:\s+-[A-Za-z0-9]+)*\s+(['"]?)[^'"\s;&|]+\1\s+(['"]?)([^'"\s;&|]+)\2/g;
  for (const match of command.matchAll(copyMovePattern)) add(match[3]);

  const touchPattern = /(?:^|[\s;&|])touch(?:\s+-[A-Za-z0-9]+)*\s+(['"]?)([^'"\s;&|]+)\1/g;
  for (const match of command.matchAll(touchPattern)) add(match[2]);

  return [...new Set(paths)];
}

function toolCallsFromMessages(messages: unknown[]): any[] {
  const calls: any[] = [];
  for (const msg of messages ?? []) {
    if (!Array.isArray((msg as any)?.content)) continue;
    for (const part of (msg as any).content) {
      if (part?.type === "toolCall" || part?.type === "tool_use") calls.push(part);
    }
  }
  return calls;
}

function messagesForEvent(event: StepDoneEvent): unknown[] {
  const messages: unknown[] = [];
  for (const step of event.completedSteps ?? []) {
    messages.push(...((step.result?.messages as unknown[]) ?? []));
  }
  messages.push(...((event.result?.messages as unknown[]) ?? []));
  return messages;
}

function claimedDeliverablePaths(finishResult: FinishResult | undefined): string[] {
  return (finishResult?.deliverables ?? [])
    .map((deliverable) => normalizeAgentRepoPath(deliverable.path))
    .filter((p): p is string => !!p);
}

function touchedPathsFromMessages(messages: unknown[]): string[] {
  const paths: string[] = [];
  for (const call of toolCallsFromMessages(messages)) {
    const name = String(call.name ?? call.toolName ?? "");
    const args = call.arguments ?? call.input ?? {};
    if ((name === "write" || name === "edit") && typeof args.path === "string") {
      const normalized = normalizeAgentRepoPath(args.path);
      if (normalized) paths.push(normalized);
    }
    if (name === "bash" && typeof args.command === "string") {
      paths.push(...extractBashWritePaths(args.command));
    }
  }
  return [...new Set(paths)];
}

function agentNameFromEvent(event: StepDoneEvent): string | undefined {
  const raw =
    (event as any).agentName ??
    (event as any).agent ??
    (event.result as any)?.agentName ??
    (event.result as any)?.agent;
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

function agentsDirFromEvent(event: StepDoneEvent): string | undefined {
  const explicit = (event as any).agentsRoot ?? (event.result as any)?.agentsRoot;
  if (typeof explicit === "string") return explicit;

  const projectRoot = (event as any).projectRoot ?? (event.result as any)?.projectRoot;
  if (typeof projectRoot === "string") {
    return path.basename(projectRoot) === "agents" ? projectRoot : path.join(projectRoot, "agents");
  }

  return undefined;
}

function isSameOrChild(candidate: string, ownerPath: string): boolean {
  return candidate === ownerPath || candidate.startsWith(`${ownerPath.replace(/\/$/, "")}/`);
}

function dirtyWorktreeWarning(event: StepDoneEvent, finishResult: FinishResult): Demand | null {
  const agentName = agentNameFromEvent(event);
  const agentsDir = agentsDirFromEvent(event);
  if (!agentsDir || !fs.existsSync(path.join(agentsDir, ".git"))) return null;

  let statusOutput = "";
  try {
    statusOutput = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: agentsDir,
      encoding: "utf-8",
      timeout: 5000,
    });
  } catch {
    return null;
  }

  const fileLines = statusOutput.split("\n").filter((line) => line.trim());
  if (fileLines.length === 0) return null;

  const ownedPaths = new Set([
    ...claimedDeliverablePaths(finishResult),
    ...touchedPathsFromMessages(messagesForEvent(event)),
  ]);

  const ownedFileLines = fileLines.filter((line) => {
    const changedPath = normalizeStatusPath(line);
    if (ownedPaths.size > 0) {
      return [...ownedPaths].some((ownedPath) => isSameOrChild(changedPath, ownedPath));
    }
    return !!agentName && changedPath.startsWith(`${agentName}/`);
  });
  const unrelatedFileLines = fileLines.filter((line) => !ownedFileLines.includes(line));

  if (unrelatedFileLines.length === 0) {
    return {
      type: "warn",
      reason:
        `Shared agents worktree has ${ownedFileLines.length} dirty path(s) touched or claimed by this session. ` +
        `Guards are warning only; commit intentional paths or revert accidental paths before relying on the work.`,
    };
  }

  return {
    type: "warn",
    reason:
      `Shared agents worktree has ${unrelatedFileLines.length} unrelated dirty path(s); finish must not be blocked for these. ` +
      `Unrelated: ${unrelatedFileLines.map(normalizeStatusPath).join(", ")}.` +
      (ownedFileLines.length > 0
        ? ` Session-touched dirty path(s): ${ownedFileLines.map(normalizeStatusPath).join(", ")}.`
        : " No dirty path matches this session's deliverables or write/edit/bash-touched paths."),
  };
}

export const guard: WorkflowGuard = {
  name: "finish-guard",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];

    const finishResult = event.result?.finishResult;

    // Only gate finish(success) — other statuses are legitimate
    if (!finishResult || finishResult.status !== "success") return [];

    const demands: Demand[] = [];
    const dirtyWarning = dirtyWorktreeWarning(event, finishResult);
    if (dirtyWarning) demands.push(dirtyWarning);

    // Get the task text from the event
    const taskText = (event as any).task ?? event.step ?? "";

    // Check if persistent-task was required
    if (!isPersistentTaskRequired(taskText)) return demands;

    // Check if persistent-task was actually run
    if (wasPersistentTaskRun(event.result)) return demands;

    // Persistent-task was required but not run — block
    demands.push({
      type: "block",
      reason:
        "FM-3.4 Persistent-Task Required: This task required the persistent-task " +
        "workflow but it was never invoked. The agent must use " +
        'workflow.run("persistent-task", "project: <path>\\ngoal: <goal>") ' +
        "instead of working inline. Do NOT do the work directly — run the workflow.",
    });
    return demands;
  },
};
