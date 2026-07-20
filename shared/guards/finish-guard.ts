import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk";

/**
 * finish-guard — FM-3.4 Persistent-Task Enforcement.
 *
 * Blocks workflow steps that finish(success) when the task required
 * persistent-task workflow usage but the agent worked inline instead.
 *
 * Evidence: EXP-188 confirmed +100pp (0% → 100%) adoption with this guard.
 * Without it, agents read the instruction, work inline, and skip the workflow.
 *
 * Detection heuristic:
 * - Task contains "project:" pointing to a directory with project.md → required
 * - Task explicitly mentions persistent-task workflow → required
 * - Result messages contain workflow.run("persistent-task") call → satisfied
 *
 * Fail-open: only blocks finish(success). Other statuses pass through.
 */

/**
 * Check if the task text indicates persistent-task workflow is required.
 */
function isPersistentTaskRequired(taskText: string): boolean {
  if (!taskText) return false;
  const lower = taskText.toLowerCase();

  // Explicit opt-out: project-app planning sessions and other workflows
  // that review/plan rather than implement. Respects "persistent-task: skip"
  // or "persistent-task: false" in the task text.
  if (/^persistent-task:\s*(?:skip|false|no|off|not-required)/m.test(lower)) {
    return false;
  }

  // Explicit workflow mention
  if (lower.includes('workflow.run("persistent-task"') ||
      lower.includes("workflow.run('persistent-task'") ||
      lower.includes('run the persistent-task workflow') ||
      lower.includes('use persistent-task workflow') ||
      lower.includes('must use persistent-task')) {
    return true;
  }

  // Task has a project: field pointing to a directory — indicates a
  // persistent-task ask. (Single-file `.md` project format is gone, so the
  // legacy `.endsWith('.md')` exclusion was removed; see
  // projects/may-agent.app/docs/archive/implementation/2026-05-20-legacy-cleanup-resume-path.md L1.)
  const projectMatch = taskText.match(/^project:\s*(.+)$/m);
  if (projectMatch) {
    const projectPath = projectMatch[1].trim();
    if (projectPath.includes('/projects/') || projectPath.includes('/project.md') === false) {
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

  // Check the result text for evidence of persistent-task execution
  const text = result?.lastAssistantText ?? "";
  if (text.includes("persistent-task") && (
    text.includes("workflow.run") ||
    text.includes("workflow completed") ||
    text.includes("iterations"))) {
    return true;
  }

  return false;
}

// ── Types ──────────────────────────────────────────────────────────

export interface FinishDeliverable {
  path: string;
  description: string;
}

export interface FinishCallParams {
  status: string;
  deliverables?: FinishDeliverable[] | null;
  verification_evidence?: string[] | null;
}

export interface FinishValidationResult {
  valid: boolean;
  missing: string[];
}

export interface EvidenceValidationResult {
  valid: boolean;
  warnings: string[];
}

// ── FM-3.1: Deliverable validation ────────────────────────────────

import { execFileSync } from "node:child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Return plausible on-disk locations for a declared deliverable path.
 *
 * The finish tool runs with project root `/app`, while agents often report
 * agent-local paths such as `arc/heartbeat.md`. Treat those as aliases for
 * `agents/arc/...` instead of rejecting otherwise-real deliverables as ghosts.
 */
function deliverablePathCandidates(deliverablePath: string, rootDir: string): string[] {
  if (path.isAbsolute(deliverablePath)) return [deliverablePath];

  const normalized = deliverablePath.replace(/^\.\//, "").replace(/\/+/g, "/");
  const candidates = [path.join(rootDir, normalized)];

  if (!normalized.startsWith("agents/") && path.basename(rootDir) !== "agents") {
    const firstSegment = normalized.split("/")[0];
    if (firstSegment && fs.existsSync(path.join(rootDir, "agents", firstSegment))) {
      candidates.push(path.join(rootDir, "agents", normalized));
    }
  }

  return candidates;
}

/**
 * Validate that all declared deliverables exist on disk.
 * Returns a result object (non-throwing).
 */
export function validateFinishDeliverables(
  deliverables: FinishDeliverable[] | null | undefined,
  _status: string,
  rootDir: string,
): FinishValidationResult {
  if (!deliverables || deliverables.length === 0) {
    return { valid: true, missing: [] };
  }
  const missing: string[] = [];
  for (const d of deliverables) {
    const exists = deliverablePathCandidates(d.path, rootDir).some((candidate) => fs.existsSync(candidate));
    if (!exists) {
      missing.push(d.path);
    }
  }
  return { valid: missing.length === 0, missing };
}

/**
 * Throw if any declared deliverables don't exist (ghost deliverables).
 * Only enforced when status is "success".
 */
export function enforceFinishDeliverables(
  deliverables: FinishDeliverable[] | null | undefined,
  status: string,
  rootDir: string,
): void {
  if (status !== "success") return;
  const result = validateFinishDeliverables(deliverables, status, rootDir);
  if (!result.valid) {
    throw new Error(
      `Ghost deliverables — files declared but not found: ${result.missing.join(", ")}`,
    );
  }
}

// ── FM-3.3: Verification evidence validation ──────────────────────

/**
 * Validate that finish(success) includes verification evidence.
 * Returns a result object (non-throwing).
 */
export function validateVerificationEvidence(
  params: FinishCallParams,
): EvidenceValidationResult {
  const warnings: string[] = [];
  if (params.status === "success") {
    if (!params.verification_evidence || params.verification_evidence.length === 0) {
      warnings.push("finish(success) has no verification_evidence — add tool-output references proving deliverables work.");
    }
  }
  return { valid: warnings.length === 0, warnings };
}

/**
 * Enforce verification evidence. Returns warnings (non-throwing).
 */
export function enforceVerificationEvidence(
  params: FinishCallParams,
): string[] {
  return validateVerificationEvidence(params).warnings;
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

function messagesForEvent(event: WorkflowGuardEvent): unknown[] {
  const messages: unknown[] = [];
  for (const step of event.completedSteps ?? []) {
    messages.push(...((step.result?.messages as unknown[]) ?? []));
  }
  messages.push(...((event.result?.messages as unknown[]) ?? []));
  return messages;
}

function claimedDeliverablePaths(finishResult: FinishCallParams | undefined): string[] {
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

function agentNameFromEvent(event: WorkflowGuardEvent): string | undefined {
  const raw =
    (event as any).agentName ??
    (event as any).agent ??
    (event.result as any)?.agentName ??
    (event.result as any)?.agent;
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

function agentsDirFromEvent(event: WorkflowGuardEvent): string | undefined {
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

function dirtyWorktreeWarning(event: WorkflowGuardEvent, finishResult: FinishCallParams): Demand | null {
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
    const dirtyWarning = dirtyWorktreeWarning(event, finishResult as unknown as FinishCallParams);
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
